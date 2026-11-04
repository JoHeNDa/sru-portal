'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { browser } from '@/lib/browser';
import WaveCard from '@/components/WaveCard';
import Breadcrumbs from '@/components/Breadcrumbs';

type T = { code: string; registration_fee: number; renewal_fee: number };
type Designation = 'Imaging Technologist' | 'Radiographer' | 'Sonographer';
type JoinForm = {
  title: '' | 'Dr.' | 'Mr.' | 'Ms.';
  full_name: string;
  member_type: string;
  designation: '' | Designation;
  ahpc_no: string;
  reg_no: string;
  workplace: string;
  phone: string;
};

// Registration stays pending until Pesapal confirms payment.
export default function Join() {
  const sb = useMemo(() => browser(), []);
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [already, setAlready] = useState(false);
  const [types, setTypes] = useState<T[]>([]);
  const [f, setF] = useState<JoinForm>({ title: '', full_name: '', member_type: 'professional', designation: '', ahpc_no: '', reg_no: '', workplace: '', phone: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sb.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email ?? null);
      if (!data.user) return;
      const { data: m } = await sb.from('members')
        .select('title,full_name,member_type,designation,ahpc_no,reg_no,workplace,phone,paid_through_year')
        .eq('id', data.user.id)
        .maybeSingle();
      if (m?.paid_through_year != null) return setAlready(true);
      if (m) {
        setF({
          title: m.title ?? '',
          full_name: m.full_name,
          member_type: m.member_type,
          designation: m.designation ?? '',
          ahpc_no: m.ahpc_no ?? '',
          reg_no: m.reg_no ?? '',
          workplace: m.workplace ?? '',
          phone: m.phone ?? '',
        });
        return;
      }
      const { data: a } = await sb.from('applications').select('title,full_name,member_type,designation,ahpc_no,reg_no,workplace,phone').eq('id', data.user.id).maybeSingle();
      if (a) {
        setF({
          title: a.title ?? '',
          full_name: a.full_name,
          member_type: a.member_type,
          designation: a.designation ?? '',
          ahpc_no: a.ahpc_no ?? '',
          reg_no: a.reg_no ?? '',
          workplace: a.workplace ?? '',
          phone: a.phone ?? '',
        });
      }
    });
    sb.from('membership_types').select('code,registration_fee,renewal_fee').then(({ data }) => setTypes(data ?? []));
  }, [sb]);

  const signIn = () => sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/auth/callback?next=/join`, queryParams: { prompt: 'select_account' } },
  });

  async function switchAccount() { await sb.auth.signOut(); location.reload(); }

  async function pay() {
    setBusy(true); setMsg('');
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setBusy(false); return; }
    if (!f.title) { setMsg('Choose a title.'); setBusy(false); return; }
    if (!f.full_name.trim()) { setMsg('Enter your full name.'); setBusy(false); return; }
    if (!f.designation) { setMsg('Choose your professional designation.'); setBusy(false); return; }

    const { error } = await sb.from('applications').upsert({
      id: user.id,
      email: user.email,
      ...f,
      ahpc_no: f.ahpc_no.trim() || null,
      reg_no: f.reg_no.trim() || null,
      workplace: f.workplace.trim() || null,
      phone: f.phone.trim() || null,
      full_name: f.full_name.trim(),
    });
    if (error) { console.error('Application save failed:', error); setMsg(`Could not save your details: ${error.message}`); setBusy(false); return; }

    try {
      const r = await fetch('/api/pay/start', { method: 'POST' });
      const j = await r.json();
      if (!r.ok || !j.redirect_url) {
        setMsg(j.error ?? 'Payment could not be started.');
        setBusy(false);
        return;
      }
      location.href = j.redirect_url;
    } catch (error) {
      console.error('Payment request failed:', error);
      setMsg('Could not connect to the payment service. Please try again.');
      setBusy(false);
    }
  }

  const fee = types.find(t => t.code === f.member_type);
  const input = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border focus:border-[#111318] focus:outline-none focus:ring-0';
  const label = 'mb-1 block text-xs font-medium text-gray-700';
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumbs items={[{ label: 'Join SRU' }]} className="mb-4" />
      <WaveCard className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-600">Society membership</p>
      <h1 className="mt-2 font-semibold text-2xl sm:text-3xl">Become a member</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">Enter your professional and contact details to apply. Membership runs from 1 January to 31 December and begins only after payment is confirmed.</p>
      {email === undefined ? null : email === null ? (
        <button onClick={signIn} className="mt-6 rounded bg-teal-800 px-4 py-2 text-white">Continue with Google</button>
      ) : already ? (
        <p className="mt-6">You are already a member. <Link className="underline" href="/member">Go to my membership</Link> to renew or manage your records.</p>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-gray-600">
            Signed in as {email}.{' '}
            <button onClick={switchAccount} className="underline">Use a different Google account</button>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className={label}>Title</span>
              <select className={input} required value={f.title} onChange={e => setF({ ...f, title: e.target.value as JoinForm['title'] })}>
                <option value="">Select title</option><option value="Dr.">Dr.</option><option value="Mr.">Mr.</option><option value="Ms.">Ms.</option>
              </select>
            </label>
            <label><span className={label}>Full name</span>
              <input className={input} required autoComplete="name" placeholder="Enter your full name" value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} />
            </label>
            <label><span className={label}>Membership category</span>
              <select className={input} value={f.member_type} onChange={e => setF({ ...f, member_type: e.target.value })}>
                {types.map(type => <option key={type.code} value={type.code}>{type.code.replace(/[_-]/g, ' ')} member</option>)}
              </select>
            </label>
            <label><span className={label}>Designation</span>
              <select className={input} required value={f.designation} onChange={e => setF({ ...f, designation: e.target.value as JoinForm['designation'] })}>
                <option value="">Select designation</option>
                <option value="Imaging Technologist">Imaging Technologist</option>
                <option value="Radiographer">Radiographer</option>
                <option value="Sonographer">Sonographer</option>
              </select>
            </label>
            <label><span className={label}>AHPC No. <span className="font-normal text-gray-500">(optional)</span></span>
              <input className={input} autoComplete="off" placeholder="e.g. AHPC/12345" value={f.ahpc_no} onChange={e => setF({ ...f, ahpc_no: e.target.value })} />
            </label>
            <label><span className={label}>Workplace or school</span>
              <input className={input} autoComplete="organization" placeholder="Enter your hospital, clinic, or school" value={f.workplace} onChange={e => setF({ ...f, workplace: e.target.value })} />
            </label>
            <label><span className={label}>Phone number</span>
              <input className={input} type="tel" autoComplete="tel" placeholder="e.g. +256 7XX XXX XXX" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
            </label>
            <label><span className={label}>Registration number <span className="font-normal text-gray-500">(if applicable)</span></span>
              <input className={input} placeholder="Enter your registration number" value={f.reg_no} onChange={e => setF({ ...f, reg_no: e.target.value })} />
            </label>
          </div>
          {fee && <p className="text-sm text-gray-600">Registration fee: <span className="font-semibold text-gray-900">UGX {Number(fee.registration_fee).toLocaleString('en-US')}</span></p>}
          <button disabled={busy} onClick={pay} className="button-primary px-4 py-2.5 text-sm disabled:opacity-50">{busy ? 'Connecting to Pesapal...' : 'Continue to secure payment'}</button>
          {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}
        </div>
      )}
      </WaveCard>
    </main>
  );
}