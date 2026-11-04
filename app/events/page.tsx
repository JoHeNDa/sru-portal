'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { browser } from '@/lib/browser';
import { EventRow, isUpcoming, feeLabel, safeUrl, localToday } from '@/lib/events';
import { StatusBadge } from '@/components/ui';
import RevealSection from '@/components/RevealSection';
import WaveCard from '@/components/WaveCard';
import TextReveal from '@/components/TextReveal';
import Breadcrumbs from '@/components/Breadcrumbs';

export default function EventsPage() {
  const sb = useMemo(() => browser(), []);
  const pub = (p: string) => sb.storage.from('public-media').getPublicUrl(p).data.publicUrl;
  const [evs, setEvs] = useState<EventRow[]>([]);
  const [today, setToday] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from('events').select('*').order('starts_on', { ascending: false });
      setEvs((data ?? []) as EventRow[]);
      setToday(localToday());
      setDone(true);
    })();
  }, [sb]);

  const upcoming = evs.filter(e => isUpcoming(e, today)).sort((a, b) => (a.starts_on ?? '9999').localeCompare(b.starts_on ?? '9999'));
  const past     = evs.filter(e => !isUpcoming(e, today)).sort((a, b) => (b.ends_on ?? b.starts_on ?? '').localeCompare(a.ends_on ?? a.starts_on ?? ''));

  const excerpt = (body: string | null) => {
    if (!body) return '';
    const trimmed = body.trim().replace(/\s+/g, ' ');
    return trimmed.length > 160 ? trimmed.slice(0, 160).trimEnd() + '…' : trimmed;
  };

  const EventCard = ({ e, index }: { e: EventRow; index: number }) => {
    const up = isUpcoming(e, today);
    const url = safeUrl(e.register_url);
    return (
      <WaveCard index={index % 8} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-gray-300 hover:shadow-md">
        <Link href={`/event?id=${e.id}`} className="block aspect-[16/9] overflow-hidden bg-gray-100">
          {e.image_path ? (
            <img src={pub(e.image_path)} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <div aria-hidden="true" className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-900 to-slate-900 font-serif text-3xl text-white/40">SRU</div>
          )}
        </Link>
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {today && <StatusBadge upcoming={up} />}
            {e.venue_date && <span>{e.venue_date}</span>}
          </div>
          <h2 className="mt-2 font-serif text-lg font-semibold leading-snug">
            <Link href={`/event?id=${e.id}`} className="hover:underline">{e.title}</Link>
          </h2>
          {e.description && <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-gray-700">{excerpt(e.description)}</p>}
          {up && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs">{feeLabel(e)}</span>
              {url && (
                <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-900">Register now</a>
              )}
            </div>
          )}
          <Link href={`/event?id=${e.id}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal-800 hover:underline">
            View event <span aria-hidden="true">→</span>
          </Link>
        </div>
      </WaveCard>
    );
  };

  return (
    <main>
      <RevealSection className="border-b border-gray-200 bg-gray-50 py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-6">
          <Breadcrumbs items={[{ label: 'Events' }]} />
          <p className="mt-6 font-brand text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Learn &amp; connect</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            <TextReveal>All events</TextReveal>
          </h1>
          <p className="mt-3 max-w-2xl text-gray-600">
            Conferences, workshops and webinars from the Society. Register for upcoming events or browse the archive.
          </p>
        </div>
      </RevealSection>

      <div className="mx-auto max-w-7xl space-y-12 px-6 py-10 md:py-14">
        {!done && <p className="text-gray-600">Loading events…</p>}

        {done && evs.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-lg font-semibold">No events yet</p>
            <p className="mt-2 text-sm text-gray-600">Upcoming events will be listed here.</p>
            <Link href="/" className="mt-4 inline-flex rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black">Back to home</Link>
          </div>
        )}

        {done && upcoming.length > 0 && (
          <section aria-labelledby="upcoming-events-title">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-brand text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">Upcoming</p>
                <h2 id="upcoming-events-title" className="mt-1 font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Upcoming events</h2>
              </div>
              <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600">{upcoming.length} {upcoming.length === 1 ? 'event' : 'events'}</span>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((e, i) => <EventCard key={e.id} e={e} index={i} />)}
            </div>
          </section>
        )}

        {done && past.length > 0 && (
          <>
            {upcoming.length > 0 && <hr className="border-0 border-t border-gray-200" />}
            <section aria-labelledby="past-events-title">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-brand text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">Archive</p>
                  <h2 id="past-events-title" className="mt-1 font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Past events</h2>
                </div>
                <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600">{past.length} {past.length === 1 ? 'event' : 'events'}</span>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((e, i) => <EventCard key={e.id} e={e} index={i} />)}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
