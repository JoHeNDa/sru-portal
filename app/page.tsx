'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { browser } from '@/lib/browser';
import { Avatar, fmt, StatusBadge } from '@/components/ui';
import Icon from '@/components/Icon';
import RevealSection from '@/components/RevealSection';
import TextReveal from '@/components/TextReveal';
import WaveCard from '@/components/WaveCard';
import { EventRow, isUpcoming, feeLabel, safeUrl, localToday } from '@/lib/events';
import { useInView } from '@/lib/use-in-view';

type Slide = { id: number; headline: string; body: string | null; button_label: string | null; button_href: string | null; image_path: string | null };
type Art = { id: number; title: string; body: string; image_path: string | null; created_at: string; author_id: string | null };
type Showcase = { slot: number; label: string | null; sub_label: string | null; message: string; image_path: string | null };
type Ev = EventRow;
type Com = { term_id: number; starts_on: string; ends_on: string | null; is_current: boolean; role: string; full_name: string; photo_path: string | null; message: string | null };
type Prof = { id: string; full_name: string; avatar_path: string | null };
type Pub = (p: string) => string;

function CaptionLine() {
  const { ref, isVisible } = useInView<HTMLSpanElement>(0);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '3rem',
        height: 2,
      }}
    >
      <span
        data-caption-line
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          backgroundColor: '#111318',
        transform: `scaleX(${isVisible ? 1 : 0})`,
        transformOrigin: 'left center',
        transition: 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </span>
  );
}

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const [inView, setInView] = useState(false);
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = countRef.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    }, { threshold: 0.35 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const target = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    if (!inView) {
      setShown(0);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(target);
      return;
    }

    let frame = 0;
    let start: number | undefined;
    const duration = 1100;
    setShown(0);
    const animate = (now: number) => {
      if (start === undefined) start = now;
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, inView]);

  return <span ref={countRef} aria-label={String(value)}>{shown.toLocaleString('en-US')}</span>;
}

function ShowcaseBand({ item, pub, reverse }: { item: Showcase | undefined; pub: Pub; reverse: boolean }) {
  if (!item?.image_path || !item.message.trim()) return null;

  return (
    <RevealSection className="border-b border-gray-200 bg-white py-12 md:py-16">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-6 lg:grid-cols-2 lg:gap-14">
        <WaveCard index={reverse ? 1 : 0} className={`min-w-0 ${reverse ? 'lg:order-2' : 'lg:order-1'}`}>
          <figure>
            <img src={pub(item.image_path)} alt={item.label?.trim() || item.sub_label?.trim() || ''} className="h-56 w-full rounded-2xl object-cover shadow-md sm:h-80" />
            <figcaption className="mt-3">
              <span className="mb-2 inline-flex rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-600">Ad</span>
              {item.label?.trim() && <TextReveal className="font-serif text-2xl font-semibold leading-tight text-gray-950 sm:text-3xl">{item.label.trim()}</TextReveal>}
              {item.sub_label?.trim() && <TextReveal delay={90} className="mt-1 text-sm font-normal text-gray-500 sm:text-base">{item.sub_label.trim()}</TextReveal>}
            </figcaption>
          </figure>
        </WaveCard>
        <WaveCard index={reverse ? 0 : 1} className={`min-w-0 ${reverse ? 'lg:order-1' : 'lg:order-2'}`}>
          <p className="whitespace-pre-line text-base leading-7 text-gray-700 sm:text-lg sm:leading-8">{item.message}</p>
        </WaveCard>
      </div>
    </RevealSection>
  );
}

// Cycles through n items. `prev` lets the events panel slide the old one out as the new one comes in.
function useCycle(n: number, ms: number) {
  const [st, setSt] = useState({ cur: 0, prev: -1 });
  useEffect(() => {
    if (n < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setSt(s => ({ cur: (s.cur + 1) % n, prev: s.cur })), ms);
    return () => clearInterval(t);
  }, [n, ms]);
  return [st, setSt] as const;
}

function Hero({ slides, pub }: { slides: Slide[]; pub: Pub }) {
  const n = slides.length;
  const [st, setSt] = useCycle(n, 6000);
  const [zoomReady, setZoomReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setZoomReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  if (!n) return (
    <section className="bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-800 via-slate-900 to-slate-950 py-24 text-white">
      <div className="mx-auto max-w-7xl px-6">
        <p className="font-brand text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">Society of Radiography of Uganda</p>
        <h1 className="mt-4 max-w-3xl font-serif text-4xl font-semibold text-white sm:text-6xl"><TextReveal>Advancing imaging care. Together.</TextReveal></h1>
      </div>
    </section>
  );
  return (
    <section aria-label="Featured information" className="hero-entrance relative isolate min-h-[520px] overflow-hidden bg-slate-950 text-white">
      {slides.map((s, k) => (
        <div key={s.id} aria-hidden={k !== st.cur} className={`transition-opacity duration-700 ${k === st.cur ? 'relative opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'}`}>
          {s.image_path && <img src={pub(s.image_path)} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-55 blur-xl" />}
          <div className="absolute inset-0 bg-slate-950/45" />
          <div className="relative mx-auto flex w-full max-w-7xl items-center px-5 py-14 sm:px-8 sm:py-16">
            <div className="grid w-full items-center gap-8 rounded-[1.5rem] border border-white bg-white p-5 text-gray-950 shadow-xl sm:gap-10 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:p-12">
              <div className="animate-rise-in max-w-2xl py-3">
                <p className="font-brand text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 sm:hidden">Society of Radiography of Uganda</p>
                <h1 className="mt-4 font-serif text-3xl font-semibold leading-tight text-gray-950 sm:text-5xl lg:text-6xl"><TextReveal>{s.headline}</TextReveal></h1>
                {s.body && <p className="mt-5 max-w-xl text-base leading-7 text-gray-700 sm:text-lg sm:leading-8">{s.body}</p>}
                {s.button_label && <Link href={s.button_href || '/'} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gray-950 px-5 py-3 font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-black">{s.button_label}<span aria-hidden="true">→</span></Link>}
              </div>
              <div className="relative flex min-w-0 items-center justify-center">
                {s.image_path ? (
                  <div className="relative inline-flex max-w-full items-center justify-center overflow-hidden rounded-xl">
                    <img src={pub(s.image_path)} alt="" className={`h-auto w-auto max-h-[min(460px,55vh)] max-w-full rounded-xl border border-gray-200 object-contain shadow-2xl transition-transform duration-[6000ms] ease-out ${zoomReady && k === st.cur ? 'scale-100' : 'scale-[1.055]'}`} />
                  </div>
                ) : (
                  <div aria-hidden="true" className="flex min-h-56 w-full items-center justify-center rounded-2xl border border-gray-200 bg-gray-50">
                    <span className="font-brand text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">SRU · Uganda</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
      {n > 1 && (
        <div className="absolute bottom-5 left-0 right-0 z-10">
          <div className="mx-auto flex max-w-7xl gap-2 px-6 sm:px-8">
            {slides.map((s, k) => <button key={s.id} aria-label={`Go to slide ${k + 1}`} aria-current={k === st.cur} onClick={() => setSt({ cur: k, prev: st.cur })} className={`h-1.5 rounded-full transition-all ${k === st.cur ? 'w-10 bg-white' : 'w-5 bg-white/45 hover:bg-white/75'}`} />)}
          </div>
        </div>
      )}
    </section>
  );
}

// Latest articles, newest first, fading from one to the next.
function ArticleFade({ arts, profiles, pub }: { arts: Art[]; profiles: Record<string, Prof>; pub: Pub }) {
  const [st] = useCycle(arts.length, 6500);
  if (!arts.length) return <p className="text-gray-600">No articles yet.</p>;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {arts.map((a, k) => {
        const p = a.author_id ? profiles[a.author_id] : null;
        const name = p?.full_name ?? 'SRU Secretariat';
        return (
          <article key={a.id} aria-hidden={k !== st.cur} inert={k !== st.cur} className={`bg-white p-4 transition-opacity duration-700 sm:p-5 ${k === st.cur ? 'relative opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'}`}>
            <div className="flex items-center gap-2.5">
              {a.author_id
                ? <Link href={`/profile?id=${a.author_id}`} aria-label={`View ${name}'s profile`}><Avatar name={name} src={p?.avatar_path ? pub(p.avatar_path) : ''} size="h-9 w-9" /></Link>
                : <Avatar name={name} src="" size="h-9 w-9" />}
              <div>
                {a.author_id ? <Link href={`/profile?id=${a.author_id}`} className="text-sm font-medium leading-tight hover:underline">{name}</Link> : <div className="text-sm font-medium leading-tight">{name}</div>}
                <div className="text-xs text-gray-500">{fmt(a.created_at)}</div>
              </div>
            </div>
            {a.image_path && <img src={pub(a.image_path)} alt="" className="mt-3 max-h-40 w-full rounded-lg object-cover sm:max-h-48" />}
            <h3 className="mt-3 font-serif text-lg font-semibold leading-snug sm:text-xl"><Link href={`/article?id=${a.id}`} className="hover:underline">{a.title}</Link></h3>
            <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-gray-700">{a.body}</p>
            <Link href={`/article?id=${a.id}`} className="mt-2 inline-block text-sm font-medium text-teal-800 underline">Read the article</Link>
          </article>
        );
      })}
    </div>
  );
}

// Events: the current one slides up and out while the next one rises into place.
// Upcoming events show their fee and a Register Now button; past events show neither.
function EventRise({ evs, today, pub }: { evs: Ev[]; today: string; pub: Pub }) {
  const [st] = useCycle(evs.length, 5200);
  if (!evs.length) return <p className="text-gray-600">No events yet.</p>;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {evs.map((e, k) => {
        const on = k === st.cur, out = k === st.prev;
        const up = isUpcoming(e, today), url = safeUrl(e.register_url);
        return (
          <article key={e.id}
            aria-hidden={!on}
            inert={!on}
            style={{ transform: on ? 'translateY(0)' : out ? 'translateY(-100%)' : 'translateY(100%)', transition: on || out ? 'transform 0.8s ease' : 'none' }}
            className={`bg-white p-4 sm:p-5 ${on ? 'relative' : 'pointer-events-none absolute inset-0'}`}>
            {e.image_path && <img src={pub(e.image_path)} alt="" className="max-h-36 w-full rounded-lg object-cover sm:max-h-40" />}
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">{today && <StatusBadge upcoming={up} />}<span>{e.venue_date}</span></div>
            <h3 className="mt-1 font-serif text-lg font-semibold leading-snug sm:text-xl"><Link href={`/event?id=${e.id}`} className="hover:underline">{e.title}</Link></h3>
            {e.description && <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-gray-700">{e.description}</p>}
            {up && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="rounded border border-gray-300 px-2 py-0.5 text-sm">{feeLabel(e)}</span>
                {url && <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-900">Register now</a>}
              </div>
            )}
            <Link href={`/event?id=${e.id}`} className="mt-2 inline-block text-sm font-medium text-teal-800 underline">View event details</Link>
          </article>
        );
      })}
    </div>
  );
}

// Committee members one at a time. A committee with fromRight slides in from the right and out to the left;
// the other one slides in from the left and out to the right.
function CommitteeSlides({ rows, fromRight, ms, pub }: { rows: Com[]; fromRight: boolean; ms: number; pub: Pub }) {
  const [st, setSt] = useCycle(rows.length, ms);
  const wait = fromRight ? 'translateX(100%)' : 'translateX(-100%)';
  const exit = fromRight ? 'translateX(-100%)' : 'translateX(100%)';
  const ini = (n: string) => n.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
  return (
    <div>
      <div className="relative h-[500px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm sm:h-[460px] md:h-[340px]">
        {rows.map((c, i) => {
          const on = i === st.cur, out = i === st.prev;
          return (
            <article key={i}
              style={{ transform: on ? 'translateX(0)' : out ? exit : wait, transition: on || out ? 'transform 0.8s ease' : 'none' }}
              className="absolute inset-0 flex flex-col bg-white md:flex-row">
              {c.photo_path
                ? <div className="flex h-[220px] w-full shrink-0 items-center justify-center overflow-hidden bg-gray-50 md:h-full md:w-[42%]"><img src={pub(c.photo_path)} alt={c.full_name} className="h-full w-full object-contain" /></div>
                : <div className="flex h-[220px] w-full shrink-0 items-center justify-center bg-gradient-to-br from-teal-900 to-slate-900 font-serif text-6xl text-white md:h-full md:w-[42%]">{ini(c.full_name)}</div>}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center overflow-y-auto p-5 sm:p-6 md:p-7">
                <h4 className="mt-2 font-serif text-xl font-semibold leading-tight sm:text-2xl">{c.full_name}</h4>
                <p className="mt-1 text-sm font-medium text-gray-700">{c.role}</p>
                {c.message && <p className="mt-4 whitespace-pre-line border-t border-gray-200 pt-3 text-sm leading-6 text-gray-600">{c.message}</p>}
              </div>
            </article>
          );
        })}
      </div>
      {rows.length > 1 && (
        <div className="mt-3 flex gap-2">
          {rows.map((_, i) => <button key={i} aria-label={`Member ${i + 1}`} onClick={() => setSt({ cur: i, prev: st.cur })} className={`h-1 w-8 ${i === st.cur ? 'bg-teal-800' : 'bg-gray-300'}`} />)}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const sb = useMemo(() => browser(), []);
  const pub: Pub = (p) => sb.storage.from('public-media').getPublicUrl(p).data.publicUrl;
  const [slides, setSlides] = useState<Slide[]>([]);
  const [arts, setArts] = useState<Art[]>([]);
  const [showcases, setShowcases] = useState<Showcase[]>([]);
  const [evs, setEvs] = useState<Ev[]>([]);
  const [today, setToday] = useState('');
  const [com, setCom] = useState<Com[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    joined_this_year: number;
    imaging_technologists: number;
    sonographers: number;
    radiographers: number;
  } | null>(null);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, Prof>>({});

  useEffect(() => {
    (async () => {
      const [h, a, e, c, s, k, showcaseResult] = await Promise.all([
        sb.from('hero_slides').select('*').eq('live', true).order('sort'),
        sb.from('articles').select('id,title,body,image_path,created_at,author_id').eq('status', 'approved').order('created_at', { ascending: false }).limit(6),
        sb.from('events').select('*').order('id', { ascending: false }).limit(12),
        sb.rpc('public_committee'),
        sb.rpc('member_stats'),
        sb.from('site_settings').select('key,value'),
        sb.from('homepage_showcases').select('slot,label,sub_label,message,image_path').order('slot'),
      ]);
      setSlides(h.data ?? []); setArts(a.data ?? []); setEvs(e.data ?? []); setToday(localToday()); setCom(c.data ?? []);
      if (showcaseResult.error) {
        const migrationMissing = showcaseResult.error.code === '42P01' || showcaseResult.error.code === 'PGRST205';
        const subLabelMissing = showcaseResult.error.code === '42703' || showcaseResult.error.code === 'PGRST204';
        console.error(
          migrationMissing
            ? 'Homepage showcases are unavailable. Run supabase/patch-11-homepage-showcases.sql in the Supabase SQL Editor.'
            : subLabelMissing
              ? 'Homepage showcase sub-labels are unavailable. Run supabase/patch-12-showcase-ad-labels.sql in the Supabase SQL Editor.'
              : 'Homepage showcases could not be loaded:',
          showcaseResult.error,
        );
      }
      setShowcases((showcaseResult.data ?? []) as Showcase[]);
      setStats(s.data ?? null); setCfg(Object.fromEntries((k.data ?? []).map((r: { key: string; value: string }) => [r.key, r.value])));
      const ids = Array.from(new Set((a.data ?? []).map((x: Art) => x.author_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: pr } = await sb.from('public_profiles').select('id,full_name,avatar_path').in('id', ids);
        setProfiles(Object.fromEntries((pr ?? []).map((p: Prof) => [p.id, p])));
      }
    })();
  }, [sb]);

  const terms = Array.from(new Set(com.map(c => c.term_id))); // already ordered: current term first
  // Upcoming events first (soonest first), then past events (most recent first).
  const orderedEvs = (() => {
    const up = evs.filter(e => isUpcoming(e, today)).sort((a, b) => (a.starts_on ?? '9999').localeCompare(b.starts_on ?? '9999'));
    const past = evs.filter(e => !isUpcoming(e, today)).sort((a, b) => (b.ends_on ?? b.starts_on ?? '').localeCompare(a.ends_on ?? a.starts_on ?? ''));
    return [...up, ...past].slice(0, 6);
  })();
  const h2 = 'font-serif text-2xl font-semibold tracking-tight sm:text-3xl';

  return (
    <main>
      <Hero slides={slides} pub={pub} />

      <RevealSection id="about" className="border-b border-gray-200 bg-white py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="animate-rise-in">
            <p className="font-brand text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Our purpose</p>
            <h2 className="relative mt-3 inline-block max-w-xl pt-3 font-serif text-3xl font-semibold sm:text-4xl"><CaptionLine /><TextReveal>{cfg.purpose_headline || 'A stronger voice for radiography in Uganda.'}</TextReveal></h2>
            <p className="mt-4 max-w-xl leading-7 text-gray-600">{cfg.purpose_body || 'SRU brings radiographers together to advance professional standards, support lifelong learning, and strengthen the quality of imaging care.'}</p>
            <Link href="/join" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-teal-900">Explore membership <span aria-hidden="true">→</span></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['01', cfg.purpose_card_1_title || 'Professional community', cfg.purpose_card_1_body || 'Connect with radiographers and contribute to the profession.'],
              ['02', cfg.purpose_card_2_title || 'Continuing development', cfg.purpose_card_2_body || 'Record verified CPD and follow your annual progress.'],
              ['03', cfg.purpose_card_3_title || 'Career recognition', cfg.purpose_card_3_body || 'Build a trusted record of education and work experience.'],
            ].map(([number, title, body]) => (
              <WaveCard key={number} index={Number(number)} className="gradient-card purpose-card surface-lift rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <article>
                  <span className="gradient-accent-text font-brand text-xs font-bold tracking-widest">{number}</span>
                  <h3 className="mt-5 font-serif text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{body}</p>
                </article>
              </WaveCard>
            ))}
          </div>
        </div>
      </RevealSection>

      <ShowcaseBand item={showcases.find(item => item.slot === 1)} pub={pub} reverse={false} />

      <RevealSection className="border-b border-gray-200 bg-gray-50 py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="font-brand text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Our community</p><h2 className={`relative mt-2 inline-block max-w-full pt-3 ${h2}`}><CaptionLine /><TextReveal>Our members</TextReveal></h2></div>
            <Link href="/join" className="text-sm font-semibold text-teal-800 hover:underline">Become a member →</Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 xl:grid-cols-6 xl:gap-6">
            {[
              ['Registered members', stats?.total],
              ['Active this year', stats?.active],
              ['Joined this year', stats?.joined_this_year],
              ['Imaging Technologists', stats?.imaging_technologists],
              ['Sonographers', stats?.sonographers],
              ['Radiographers', stats?.radiographers],
            ].map(([label, value], index) => (
              <WaveCard key={String(label)} index={index} className="member-stat-card surface-lift aspect-square min-w-0 rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <div className="font-serif text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl"><CountUp value={Number(value ?? 0)} /></div>
                  <p className="text-[11px] font-medium leading-4 text-gray-600 sm:text-xs">{label}</p>
                </div>
              </WaveCard>
            ))}
          </div>
        </div>
      </RevealSection>

      <ShowcaseBand item={showcases.find(item => item.slot === 2)} pub={pub} reverse />

      <RevealSection id="news" className="border-b border-gray-200 bg-white py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl items-start gap-10 px-6 lg:grid-cols-2">
          <WaveCard id="articles" className="min-w-0"><div className="mb-4"><p className="gradient-accent-text font-brand text-xs font-semibold uppercase tracking-[0.16em]">News & updates</p><h2 className={`relative mt-2 inline-block max-w-full pt-3 ${h2}`}><CaptionLine /><TextReveal>News</TextReveal></h2></div><ArticleFade arts={arts} profiles={profiles} pub={pub} />
            <div className="mt-4 flex justify-end"><Link href="/articles" className="text-sm font-semibold text-teal-800 hover:underline">Explore all articles →</Link></div></WaveCard>
          <WaveCard id="events" index={1} className="min-w-0"><div className="mb-4"><p className="gradient-accent-text font-brand text-xs font-semibold uppercase tracking-[0.16em]">Learn & connect</p><h2 className={`relative mt-2 inline-block max-w-full pt-3 ${h2}`}><CaptionLine /><TextReveal>Events</TextReveal></h2></div><EventRise evs={orderedEvs} today={today} pub={pub} />
            <div className="mt-4 flex justify-end"><Link href="/events" className="text-sm font-semibold text-teal-800 hover:underline">Explore all events →</Link></div></WaveCard>
        </div>
      </RevealSection>

      <ShowcaseBand item={showcases.find(item => item.slot === 3)} pub={pub} reverse={false} />

      <RevealSection id="committee" className="border-b border-gray-200 bg-gray-50 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <p className="font-brand text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Leadership</p>
          <h2 className={h2 + ' mt-2'}><TextReveal>Executive Committee</TextReveal></h2>
          {terms.length === 0 && <p className="mt-3 text-gray-600">The committee will be listed here soon.</p>}
          <div className="mt-4 grid gap-10 md:grid-cols-2">
            {terms.map((t, i) => {
              const rows = com.filter(c => c.term_id === t);
              const f = rows[0];
              const label = f.is_current ? `Current committee, since ${f.starts_on.slice(0, 4)}` : `Previous committee, ${f.starts_on.slice(0, 4)} to ${f.ends_on?.slice(0, 4)}`;
              return (
                <WaveCard key={t} index={i} className="committee-card min-w-0">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-serif text-lg font-semibold">{label}</h3>
                    <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600">{rows.length} {rows.length === 1 ? 'member' : 'members'}</span>
                  </div>
                  <CommitteeSlides rows={rows} fromRight={f.is_current} ms={f.is_current ? 4500 : 5200} pub={pub} />
                </WaveCard>
              );
            })}
          </div>
          <div className="mt-6">
            <Link href="/committee" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-gray-900 hover:bg-gray-900 hover:text-white">
              See committee details <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </RevealSection>

      <RevealSection id="contacts" className="bg-white py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 md:grid-cols-[0.8fr_1.2fr] md:items-center">
          <div>
            <p className="font-brand text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Get in touch</p>
            <h2 className={`relative mt-2 inline-block max-w-full pt-3 ${h2}`}><CaptionLine />Connect with SRU</h2>
            <p className="mt-3 max-w-lg text-gray-600">Have a question about membership, professional development, or an upcoming event? Our Secretariat is ready to help.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {cfg.contact_email && <WaveCard className="surface-lift rounded-xl"><a href={`mailto:${cfg.contact_email}`} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-teal-800 shadow-sm"><Icon name="mail" /></span><span className="min-w-0"><span className="block text-xs text-gray-500">Email</span><span className="block truncate text-sm font-medium">{cfg.contact_email}</span></span></a></WaveCard>}
            {cfg.contact_phone && <WaveCard index={1} className="surface-lift rounded-xl"><a href={`tel:${cfg.contact_phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-teal-800 shadow-sm"><Icon name="phone" /></span><span className="min-w-0"><span className="block text-xs text-gray-500">Phone</span><span className="block truncate text-sm font-medium">{cfg.contact_phone}</span></span></a></WaveCard>}
            {cfg.contact_address && <WaveCard index={2} className="surface-lift rounded-xl sm:col-span-2"><div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-teal-800 shadow-sm"><Icon name="location" /></span><span><span className="block text-xs text-gray-500">Address</span><span className="block text-sm font-medium">{cfg.contact_address}</span></span></div></WaveCard>}
          </div>
        </div>
      </RevealSection>
    </main>
  );
}
