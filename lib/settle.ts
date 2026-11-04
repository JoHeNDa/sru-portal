import { admin } from './supabase';
import { transactionStatus } from './pesapal';

export type Settled = 'completed' | 'failed' | 'pending' | 'unknown';

// Asks Pesapal for the real status of a payment and activates the membership only if everything matches
// our own record. Used by both the notification (IPN) and the page members land on after paying.
export async function settlePayment(trackingId: string, ref: string): Promise<Settled> {
  const db = admin();
  const { data: pay, error: paymentError } = await db.from('payments').select('*').eq('id', ref).maybeSingle();
  if (paymentError) {
    console.error('Payment lookup failed:', paymentError.message);
    throw new Error('Payment could not be verified');
  }
  if (!pay) return 'unknown';
  if (pay.order_tracking_id && pay.order_tracking_id !== trackingId) return 'unknown';   // reference and tracking id must belong together
  if (pay.status === 'completed') return 'completed';

  const s = await transactionStatus(trackingId);
  if (s.merchant_reference !== pay.id) return 'unknown';

  if (s.status_code === 1 && Number(s.amount) === Number(pay.amount) && s.currency === pay.currency) {
    const { error } = await db.rpc('confirm_payment', { p_id: pay.id, p_tracking: trackingId });
    if (error) {
      console.error('Payment confirmation failed:', error.message);
      return 'pending';
    }
    return 'completed';
  }
  if (s.status_code === 2 || s.status_code === 3) {
    const { error } = await db.from('payments')
      .update({ status: s.status_code === 2 ? 'failed' : 'reversed' })
      .eq('id', pay.id)
      .neq('status', 'completed');
    if (error) {
      console.error('Failed payment status update failed:', error.message);
      return 'pending';
    }
    return 'failed';
  }
  return 'pending';
}
