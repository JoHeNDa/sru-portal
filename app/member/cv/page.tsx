'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { browser } from '@/lib/browser';
import Breadcrumbs from '@/components/Breadcrumbs';

type Car = { id: string; kind: string; organisation: string; title: string; from_year: number; to_year: number | null; status: string };
type Cpd = { id: string; title: string; points: number; year: number };
type CvMember = { full_name: string; email: string; phone: string | null; reg_no: string | null; member_type: string; bio: string | null };

export default function CvPage() {
  const sb = useMemo(() => browser(), []);
  const [year, setYear] = useState(0); // set after the page loads in the browser
  const [m, setM] = useState<CvMember | null>(null);
  const [car, setCar] = useState<Car[]>([]);
  const [cpd, setCpd] = useState<Cpd[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return setReady(true);
      const [a, b, c] = await Promise.all([
        sb.from('members').select('full_name,email,phone,reg_no,member_type,workplace,bio').eq('id', user.id).maybeSingle(),
        sb.from('career_entries').select('id,kind,organisation,title,from_year,to_year,status').eq('member_id', user.id).order('from_year', { ascending: false }),
        sb.from('cpd_entries').select('id,title,points,year').eq('member_id', user.id).eq('status', 'verified').order('year', { ascending: false }),
      ]);
      setYear(new Date().getFullYear());
      setM(a.data); setCar(b.data ?? []); setCpd(c.data ?? []); setReady(true);
    })();
  }, [sb]);

  if (!ready) return <main className="p-8">Loading...</main>;
  if (!m) return <main className="p-8">Please <Link className="underline" href="/join">sign in</Link> first.</main>;

  const block = (kind: string) => car.filter(c => c.kind === kind).map(c => (
    <li key={c.id} className="py-2">
      <span className="text-gray-600">{c.from_year} to {c.to_year ?? 'present'}</span>{' '}
      <b>{c.title}</b>, {c.organisation}
      {c.status === 'verified' && <span className="ml-2 rounded border border-green-700 px-2 text-xs text-green-700">Verified by SRU</span>}
    </li>
  ));
  const total = cpd.reduce((a, c) => a + c.points, 0);
  const thisYear = cpd.filter(c => c.year === year).reduce((a, c) => a + c.points, 0);
  const h = 'mt-8 border-b border-gray-300 pb-1 text-lg font-semibold';

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="print:hidden"><Breadcrumbs items={[{ label: 'My membership', href: '/member' }, { label: 'CV' }]} className="mb-4" /></div>
      <div className="mb-6 flex gap-4 print:hidden">
        <button onClick={() => window.print()} className="rounded bg-teal-800 px-4 py-2 text-white">Print or save as PDF</button>
        <Link href="/member" className="py-2 underline">Back</Link>
      </div>
      <h1 className="text-3xl font-semibold">{m.full_name}</h1>
      <p className="text-gray-600">{m.email}{m.phone ? `, ${m.phone}` : ''}<br />SRU registration {m.reg_no ?? 'pending'}, {m.member_type} member</p>
      {m.bio && <p className="mt-4">{m.bio}</p>}
      <h2 className={h}>Employment</h2><ul className="divide-y divide-gray-200">{block('employment')}</ul>
      <h2 className={h}>Education</h2><ul className="divide-y divide-gray-200">{block('education')}</ul>
      <h2 className={h}>Continuing professional development</h2>
      <p className="mt-2">{total} verified points across all years, {thisYear} in {year}.</p>
      <ul className="divide-y divide-gray-200">{cpd.map(c => <li key={c.id} className="py-2"><span className="text-gray-600">{c.year}</span> {c.title}, {c.points} points</li>)}</ul>
    </main>
  );
}