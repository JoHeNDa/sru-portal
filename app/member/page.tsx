'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { browser } from '@/lib/browser';
import ProfileSection from '@/components/member/ProfileSection';
import CpdSection from '@/components/member/CpdSection';
import CareerSection from '@/components/member/CareerSection';
import ArticlesSection from '@/components/member/ArticlesSection';
import WaveCard from '@/components/WaveCard';
import Breadcrumbs from '@/components/Breadcrumbs';

type Member = { id: string; full_name: string; member_type: string; paid_through_year: number | null };
type Type = { code: string; renewal_fee: number; late_fine: number; cpd_min: number };

const money = (n: number) => 'UGX ' + Number(n).toLocaleString('en-US');
const btn = 'button-primary px-4 py-2 disabled:opacity-50';
const memberPanels = [
  ['profile', 'Profile'],
  ['cpd', 'CPD'],
  ['career', 'Career'],
  ['articles', 'Articles'],
] as const;

export default function MemberPage() {
  const sb = useMemo(() => browser(), []);
  const [year, setYear] = useState(0); // set after the page loads in the browser
  const [state, setState] = useState<'loading' | 'signedout' | 'nomember' | 'ready'>('loading');
  const [hasApp, setHasApp] = useState(false);
  const [m, setM] = useState<Member | null>(null);
  const [t, setT] = useState<Type | null>(null);
  const [payMsg, setPayMsg] = useState('');
  const [panel, setPanel] = useState<'profile' | 'cpd' | 'career' | 'articles'>('profile');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return setState('signedout');
    const { data: mem } = await sb.from('members').select('id,full_name,member_type,paid_through_year').eq('id', user.id).maybeSingle();
    if (!mem) {
      const { data: app } = await sb.from('applications').select('id').eq('id', user.id).maybeSingle();
      setHasApp(!!app);
      return setState('nomember');
    }
    const { data: ty } = await sb.from('membership_types').select('code,renewal_fee,late_fine,cpd_min').eq('code', mem.member_type).single();
    setYear(new Date().getFullYear());
    setM(mem); setT(ty); setState('ready');
  }, [sb]);
  useEffect(() => { load(); }, [load]);

  async function renew() {
    setPayMsg('');
    const r = await fetch('/api/pay/start', { method: 'POST' });
    const j = await r.json();
    if (j.redirect_url) location.href = j.redirect_url; else setPayMsg(j.error ?? 'Could not start payment.');
  }

  if (state === 'loading') return <main className="p-8">Loading...</main>;
  if (state === 'signedout') return <main className="mx-auto max-w-lg p-8"><p>Please sign in first.</p><Link className="underline" href="/join">Go to sign in</Link></main>;
  if (state === 'nomember') return (
    <main className="mx-auto max-w-lg p-8">
      <p>{hasApp ? 'Your registration is not complete. Your payment has not been confirmed yet.' : 'You are not a member yet.'}</p>
      <Link className="underline" href="/join">{hasApp ? 'Complete registration' : 'Become a member'}</Link>
    </main>
  );

  const active = (m!.paid_through_year ?? 0) >= year;

  return (
    <main className="workspace-compact mx-auto max-w-[1440px] space-y-3 px-3 py-4 sm:px-5">
      <Breadcrumbs items={[{ label: 'My membership' }]} className="px-1" />
      <WaveCard className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-semibold">{m!.full_name}</h1>
            <p className="capitalize text-gray-600">{m!.member_type} member</p>
          </div>
          <Link href="/member/cv" className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Generate CV</Link>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-gray-50 px-3 py-2">
          {active
            ? <p><b className="text-green-700">Active</b> until 31 December {m!.paid_through_year}.</p>
            : <p><b className="text-red-700">Expired</b> on 31 December {m!.paid_through_year}.</p>}
          {!active && t && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-gray-600">Renewal {money(t.renewal_fee)}; any late fine is confirmed at checkout.</p>
              <button onClick={renew} className={btn}>Renew with Pesapal</button>
            </div>
          )}
          {active && <p className="text-gray-500">Renewal opens after 31 December.</p>}
          {payMsg && <p className="mt-2 text-red-700">{payMsg}</p>}
        </div>
      </WaveCard>

      <WaveCard className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm" index={1}>
      <section>
        <nav role="tablist" aria-label="Membership workspace" className="flex gap-1 overflow-x-auto border-b border-gray-200 p-1.5">
          {memberPanels.map(([key, label], index) => (
            <button
              key={key}
              ref={element => { tabRefs.current[index] = element; }}
              id={`member-tab-${key}`}
              type="button"
              role="tab"
              tabIndex={panel === key ? 0 : -1}
              aria-selected={panel === key}
              aria-controls="member-panel"
              onClick={() => setPanel(key)}
              onKeyDown={event => {
                let next = index;
                if (event.key === 'ArrowRight') next = (index + 1) % memberPanels.length;
                else if (event.key === 'ArrowLeft') next = (index - 1 + memberPanels.length) % memberPanels.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = memberPanels.length - 1;
                else return;
                event.preventDefault();
                setPanel(memberPanels[next][0]);
                tabRefs.current[next]?.focus();
              }}
              className="button-choice shrink-0 rounded-md px-3 py-1.5 text-xs"
            >
              {label}
            </button>
          ))}
        </nav>
        <div id="member-panel" role="tabpanel" aria-labelledby={`member-tab-${panel}`} className="min-w-0 p-3 sm:p-4">
          {panel === 'profile' && <ProfileSection sb={sb} memberId={m!.id} />}
          {panel === 'cpd' && <CpdSection sb={sb} memberId={m!.id} min={t?.cpd_min ?? 0} />}
          {panel === 'career' && <CareerSection sb={sb} memberId={m!.id} />}
          {panel === 'articles' && <ArticlesSection sb={sb} memberId={m!.id} />}
        </div>
      </section>
      </WaveCard>
    </main>
  );
}
