'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { browser } from '@/lib/browser';
import { Avatar, fmt } from '@/components/ui';
import RevealSection from '@/components/RevealSection';
import WaveCard from '@/components/WaveCard';
import TextReveal from '@/components/TextReveal';
import Breadcrumbs from '@/components/Breadcrumbs';

type Art = { id: number; title: string; body: string; image_path: string | null; created_at: string; author_id: string | null };
type Prof = { id: string; full_name: string; avatar_path: string | null };

export default function ArticlesPage() {
  const sb = useMemo(() => browser(), []);
  const pub = (p: string) => sb.storage.from('public-media').getPublicUrl(p).data.publicUrl;
  const [arts, setArts] = useState<Art[]>([]);
  const [profs, setProfs] = useState<Record<string, Prof>>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from('articles')
        .select('id,title,body,image_path,created_at,author_id')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      setArts((data ?? []) as Art[]);
      const ids = Array.from(new Set((data ?? []).map(a => a.author_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: pr } = await sb.from('public_profiles').select('id,full_name,avatar_path').in('id', ids);
        setProfs(Object.fromEntries(((pr ?? []) as Prof[]).map(p => [p.id, p])));
      }
      setDone(true);
    })();
  }, [sb]);

  const excerpt = (body: string) => {
    const trimmed = body.trim().replace(/\s+/g, ' ');
    return trimmed.length > 180 ? trimmed.slice(0, 180).trimEnd() + '…' : trimmed;
  };

  return (
    <main>
      <RevealSection className="border-b border-gray-200 bg-gray-50 py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-6">
          <Breadcrumbs items={[{ label: 'Articles' }]} />
          <p className="mt-6 font-brand text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">News &amp; updates</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            <TextReveal>All articles</TextReveal>
          </h1>
          <p className="mt-3 max-w-2xl text-gray-600">
            Read every article the Society has published, from member contributions to Secretariat announcements.
          </p>
        </div>
      </RevealSection>

      <div className="mx-auto max-w-7xl px-6 py-10 md:py-14">
        {!done && <p className="text-gray-600">Loading articles…</p>}

        {done && arts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-lg font-semibold">No articles yet</p>
            <p className="mt-2 text-sm text-gray-600">Check back soon. Published articles will appear here.</p>
            <Link href="/" className="mt-4 inline-flex rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black">Back to home</Link>
          </div>
        )}

        {done && arts.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {arts.map((a, i) => {
              const p = a.author_id ? profs[a.author_id] : null;
              const name = p?.full_name ?? 'SRU Secretariat';
              return (
                <WaveCard key={a.id} index={i % 8} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-gray-300 hover:shadow-md">
                  <Link href={`/article?id=${a.id}`} className="block aspect-[16/9] overflow-hidden bg-gray-100">
                    {a.image_path ? (
                      <img src={pub(a.image_path)} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div aria-hidden="true" className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-900 to-slate-900 font-serif text-3xl text-white/40">SRU</div>
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <div className="flex items-center gap-2">
                      {a.author_id ? (
                        <Link href={`/profile?id=${a.author_id}`} aria-label={`View ${name}'s profile`} className="shrink-0">
                          <Avatar name={name} src={p?.avatar_path ? pub(p.avatar_path) : ''} size="h-7 w-7" />
                        </Link>
                      ) : (
                        <Avatar name={name} src="" size="h-7 w-7" />
                      )}
                      <div className="min-w-0">
                        {a.author_id ? (
                          <Link href={`/profile?id=${a.author_id}`} className="block truncate text-xs font-medium hover:underline">{name}</Link>
                        ) : (
                          <span className="block truncate text-xs font-medium">{name}</span>
                        )}
                        <div className="text-[11px] text-gray-500">{fmt(a.created_at)}</div>
                      </div>
                    </div>
                    <h2 className="mt-3 font-serif text-lg font-semibold leading-snug">
                      <Link href={`/article?id=${a.id}`} className="hover:underline">{a.title}</Link>
                    </h2>
                    <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-gray-700">{excerpt(a.body)}</p>
                    <Link href={`/article?id=${a.id}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal-800 hover:underline">
                      Read article <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </WaveCard>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
