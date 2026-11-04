import { Suspense } from 'react';
import Link from 'next/link';
import { settlePayment } from '@/lib/settle';
import Breadcrumbs from '@/components/Breadcrumbs';

type SP = Promise<Record<string, string>>;

async function Result({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  let state: 'completed' | 'pending' | 'failed' | 'unknown' = 'unknown';
  if (q.OrderTrackingId && q.OrderMerchantReference) {
    try {
      state = await settlePayment(q.OrderTrackingId, q.OrderMerchantReference);
    } catch (error) {
      console.error('Payment return verification failed:', error instanceof Error ? error.message : 'Unknown error');
      state = 'pending';
    }
  }
  const text = {
    completed: ['Payment received', 'Your membership is now active. Thank you.'],
    pending: ['Payment is being confirmed', 'This can take a few minutes. Refresh this page shortly. You do not need to pay again.'],
    failed: ['Payment was not completed', 'You can try again.'],
    unknown: ['We could not find this payment', 'If you were charged, contact the Society with your payment receipt.'],
  }[state];
  return (
    <>
      <h1 className="text-2xl font-semibold">{text[0]}</h1>
      <p className="mt-3 text-gray-600">{text[1]}</p>
      <Link href={state === 'failed' ? '/join' : '/'} className="mt-6 inline-block rounded bg-teal-800 px-4 py-2 text-white">
        {state === 'failed' ? 'Try again' : 'Back to the home page'}
      </Link>
    </>
  );
}

// Members land here after paying on Pesapal. The page confirms the payment with Pesapal itself,
// so activation does not depend on the notification arriving first.
export default function PaymentReturn({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto max-w-lg p-8">
      <Breadcrumbs items={[{ label: 'Payment' }]} className="mb-6" />
      <Suspense fallback={<p>Confirming your payment...</p>}>
        <Result searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
