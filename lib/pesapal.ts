// Pesapal API 3.0 client. This module is used only by server-side payment handlers.
function apiBase() {
  const environment = process.env.PESAPAL_ENV ?? 'sandbox';
  if (environment === 'live') return 'https://pay.pesapal.com/v3/api';
  if (environment === 'sandbox') return 'https://cybqa.pesapal.com/pesapalv3/api';
  throw new Error('PESAPAL_ENV must be sandbox or live');
}

let cached: { token: string; exp: number } | null = null;

async function responseJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Pesapal returned an invalid response (${response.status})`);
  }
}

async function token(): Promise<string> {
  if (cached && cached.exp > Date.now() + 30_000) return cached.token;
  const key = process.env.PESAPAL_CONSUMER_KEY;
  const secret = process.env.PESAPAL_CONSUMER_SECRET;
  if (!key || !secret) throw new Error('Pesapal credentials are not configured');

  const response = await fetch(`${apiBase()}/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ consumer_key: key, consumer_secret: secret }),
  });
  const body = await responseJson(response);
  const expiresAt = Date.parse(body.expiryDate);
  if (!response.ok || typeof body.token !== 'string' || !Number.isFinite(expiresAt)) {
    throw new Error('Pesapal authentication failed');
  }
  cached = { token: body.token, exp: expiresAt };
  return body.token;
}

async function call(path: string, init?: RequestInit) {
  const accessToken = await token();
  const response = await fetch(`${apiBase()}/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const body = await responseJson(response);
  if (!response.ok) throw new Error(`Pesapal request failed (${response.status})`);
  return body;
}

// Run once per environment, then store the returned ipn_id in PESAPAL_IPN_ID.
export const registerIpn = (url: string) =>
  call('URLSetup/RegisterIPN', { method: 'POST', body: JSON.stringify({ url, ipn_notification_type: 'GET' }) });

export type PesapalOrder = {
  order_tracking_id?: string;
  merchant_reference?: string;
  redirect_url?: string;
};

export type PesapalStatus = {
  merchant_reference?: string;
  status_code?: number;
  amount?: number | string;
  currency?: string;
};

export const submitOrder = async (order: {
  id: string;
  amount: number;
  description: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}): Promise<PesapalOrder> => {
  const appUrl = process.env.APP_URL;
  const notificationId = process.env.PESAPAL_IPN_ID;
  if (!appUrl || !notificationId) throw new Error('Pesapal callback settings are not configured');

  let callbackUrl: URL;
  try {
    callbackUrl = new URL('/payment/return', appUrl);
  } catch {
    throw new Error('The application URL is invalid');
  }
  if (process.env.PESAPAL_ENV === 'live' && callbackUrl.protocol !== 'https:') {
    throw new Error('Live Pesapal payments require an HTTPS application URL');
  }

  return call('Transactions/SubmitOrderRequest', {
    method: 'POST',
    body: JSON.stringify({
      id: order.id,
      currency: 'UGX',
      amount: order.amount,
      description: order.description,
      callback_url: callbackUrl.toString(),
      notification_id: notificationId,
      billing_address: {
        email_address: order.email,
        phone_number: order.phone ?? '',
        first_name: order.firstName,
        last_name: order.lastName,
      },
    }),
  });
};

export const transactionStatus = (orderTrackingId: string): Promise<PesapalStatus> =>
  call(`Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`);
