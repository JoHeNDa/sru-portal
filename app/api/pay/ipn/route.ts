import { NextResponse } from 'next/server';
import { settlePayment } from '@/lib/settle';

// Pesapal's payment notification. We never trust the query string alone: settlePayment() asks Pesapal
// for the real status and checks it against our own record.
async function handle(trackingId: string | null, ref: string | null) {
  const ack = { orderNotificationType: 'IPNCHANGE', orderTrackingId: trackingId, orderMerchantReference: ref, status: 200 };
  if (!trackingId || !ref) return NextResponse.json({ ...ack, status: 400 }, { status: 400 });
  try {
    const result = await settlePayment(trackingId, ref);
    if (result === 'unknown') return NextResponse.json({ ...ack, status: 404 }, { status: 404 });
    if (result === 'pending') return NextResponse.json({ ...ack, status: 503 }, { status: 503 });
    return NextResponse.json(ack);
  } catch (error) {
    console.error('Pesapal notification could not be processed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ ...ack, status: 503 }, { status: 503 });
  }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  return handle(q.get('OrderTrackingId'), q.get('OrderMerchantReference'));
}
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  return handle(b.OrderTrackingId ?? null, b.OrderMerchantReference ?? null);
}
