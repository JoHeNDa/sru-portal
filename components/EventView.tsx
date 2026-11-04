'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { browser } from '@/lib/browser';
import { StatusBadge } from '@/components/ui';
import { EventRow, isUpcoming, feeLabel, safeUrl, localToday } from '@/lib/events';
import WaveCard from '@/components/WaveCard';
import TextReveal from '@/components/TextReveal';
import Breadcrumbs from '@/components/Breadcrumbs';

export default function EventView({ id }: { id: string }) {
  const sb = useMemo(() => browser(), []);
  const [e, setE] = useState<EventRow | null>(null);
  const [done, setDone] = useState(false);
  const [today, setToday] = useState('');
  useEffect(() => {
    sb.from('events').select('*').eq('id', id).maybeSingle().then(({ data }) => { setE(data); setToday(localToday()); setDone(true); });
  }, [sb, id]);

  if (!done) return <main className="p-8">Loading...</main>;
  if (!e) return <main className="p-8">Event not found. <Link className="underline" href="/">Home</Link></main>;
  return (
    <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      <Breadcrumbs items={[{ label: 'Events', href: '/events' }, { label: e.title }]} className="mb-4" />
      <WaveCard className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <article>
      {e.image_path && <img src={sb.storage.from('public-media').getPublicUrl(e.image_path).data.publicUrl} alt="" className="max-h-[34rem] w-full object-cover" />}
      <div className="p-5 sm:p-9">
      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-gray-500">{today && <StatusBadge upcoming={isUpcoming(e, today)} />}<span>{e.venue_date}</span></div>
      <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight sm:text-4xl"><TextReveal>{e.title}</TextReveal></h1>
      <div className="mt-4 whitespace-pre-line text-lg leading-relaxed text-gray-800">{e.description}</div>
      {isUpcoming(e, today) && (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <span className="rounded border border-gray-300 px-3 py-1">{feeLabel(e)}</span>
          {safeUrl(e.register_url) && <a href={safeUrl(e.register_url)!} target="_blank" rel="noopener noreferrer" className="rounded bg-teal-800 px-5 py-2.5 font-medium text-white">Register Now</a>}
        </div>
      )}
      </div>
      </article>
      </WaveCard>
    </main>
  );
}
