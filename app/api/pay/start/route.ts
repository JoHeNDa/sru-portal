import { NextResponse } from 'next/server';
import { admin, userClient } from '@/lib/supabase';
import { submitOrder } from '@/lib/pesapal';

type MemberRecord = {
  email: string;
  full_name: string;
  member_type: string;
  phone: string | null;
  reg_no: string | null;
  workplace: string | null;
  paid_through_year: number | null;
};

type ApplicationRecord = Omit<MemberRecord, 'paid_through_year'>;

function ugandaDate(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return { year: Number(value('year')), date: `${value('year')}-${value('month')}-${value('day')}` };
}

async function setPaymentStatus(db: ReturnType<typeof admin>, id: string, status: 'failed') {
  const { error } = await db.from('payments').update({ status }).eq('id', id);
  if (error) console.error('Could not update payment status:', error.message);
}

// Starts a registration or renewal. Fees come from Supabase; the browser never supplies an amount.
export async function POST() {
  const { data: { user } } = await (await userClient()).auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Sign in with an email account first.' }, { status: 401 });

  const db = admin();
  const { data: member, error: memberError } = await db.from('members')
    .select('id,email,full_name,member_type,phone,reg_no,workplace,paid_through_year')
    .eq('id', user.id)
    .maybeSingle();
  if (memberError) {
    console.error('Member lookup failed:', memberError.message);
    return NextResponse.json({ error: 'The server could not read your member record.' }, { status: 500 });
  }

  const isRegistration = !member || member.paid_through_year == null;
  let person: MemberRecord | ApplicationRecord | null = member as MemberRecord | null;

  if (isRegistration) {
    const { data: application, error: applicationError } = await db.from('applications')
      .select('full_name,member_type,reg_no,workplace,phone')
      .eq('id', user.id)
      .maybeSingle();
    if (applicationError) {
      console.error('Application lookup failed:', applicationError.message);
      return NextResponse.json({ error: 'The server could not read your registration details.' }, { status: 500 });
    }

    const details = application;
    if (!details || !String(details.full_name ?? '').trim() || !String(details.member_type ?? '').trim()) {
      return NextResponse.json({ error: 'Complete your membership details first.' }, { status: 400 });
    }

    const { data: membershipType, error: typeError } = await db.from('membership_types')
      .select('code')
      .eq('code', details.member_type)
      .maybeSingle();
    if (typeError || !membershipType) {
      console.error('Membership type lookup failed:', typeError?.message);
      return NextResponse.json({ error: 'Choose a valid membership type before paying.' }, { status: 400 });
    }

    person = {
      email: user.email,
      full_name: String(details.full_name).trim(),
      member_type: membershipType.code,
      reg_no: details.reg_no || null,
      workplace: details.workplace || null,
      phone: details.phone || null,
    };
  }

  if (!person) return NextResponse.json({ error: 'Member details are unavailable.' }, { status: 400 });

  const { data: fees, error: feeError } = await db.from('membership_types')
    .select('registration_fee,renewal_fee,late_fine')
    .eq('code', person.member_type)
    .single();
  if (feeError || !fees) {
    console.error('Membership fee lookup failed:', feeError?.message);
    return NextResponse.json({ error: 'Membership fees are not set up.' }, { status: 500 });
  }

  const { year, date } = ugandaDate(new Date());
  if (!isRegistration && member && (member.paid_through_year ?? 0) >= year) {
    return NextResponse.json({ error: 'Your membership is already active for this year.' }, { status: 409 });
  }

  const graceDays = Number(process.env.LATE_FINE_GRACE_DAYS ?? 0);
  const graceEnd = new Date(Date.UTC(year, 0, 1 + (Number.isInteger(graceDays) && graceDays >= 0 ? graceDays : 0)))
    .toISOString()
    .slice(0, 10);
  const fine = !isRegistration && date >= graceEnd ? Number(fees.late_fine) : 0;
  const amount = Number(isRegistration ? fees.registration_fee : fees.renewal_fee) + fine;
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    console.error('Invalid membership payment amount:', amount);
    return NextResponse.json({ error: 'The membership fee is not a valid payment amount.' }, { status: 500 });
  }

  const { data: payment, error: paymentError } = await db.from('payments').insert({
    member_id: isRegistration ? null : user.id,
    applicant_id: isRegistration ? user.id : null,
    purpose: isRegistration ? 'registration' : 'renewal',
    year,
    amount,
    fine,
  }).select('id').single();
  if (paymentError || !payment) {
    console.error('Payment record creation failed:', paymentError?.message);
    return NextResponse.json({ error: 'Could not create a payment record.' }, { status: 500 });
  }

  const [firstName, ...lastParts] = person.full_name.trim().split(/\s+/);
  let order;
  try {
    order = await submitOrder({
      id: payment.id,
      amount,
      email: person.email,
      phone: person.phone ?? undefined,
      firstName,
      lastName: lastParts.join(' ') || firstName,
      description: `SRU ${isRegistration ? 'registration' : 'renewal'} ${year}`,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown Pesapal error';
    console.error('Pesapal order submission failed:', reason);
    await setPaymentStatus(db, payment.id, 'failed');
    const message = reason.includes('not configured')
      ? 'Online payments are not configured yet. Please contact the Society.'
      : 'Pesapal could not start the payment. Please try again or contact the Society.';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!order.redirect_url || !order.order_tracking_id || order.merchant_reference !== payment.id) {
    console.error('Pesapal returned an incomplete or mismatched order response.');
    await setPaymentStatus(db, payment.id, 'failed');
    return NextResponse.json({ error: 'Pesapal returned an invalid payment response.' }, { status: 502 });
  }

  const { error: trackingError } = await db.from('payments')
    .update({ order_tracking_id: order.order_tracking_id })
    .eq('id', payment.id);
  if (trackingError) console.error('Payment tracking ID could not be saved:', trackingError.message);

  return NextResponse.json({ redirect_url: order.redirect_url });
}
