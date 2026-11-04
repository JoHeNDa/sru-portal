'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { browser } from '@/lib/browser';
import { Avatar, fmt } from '@/components/ui';
import WaveCard from '@/components/WaveCard';
import TextReveal from '@/components/TextReveal';
import Breadcrumbs from '@/components/Breadcrumbs';

type PublicProfile = {
  id: string;
  full_name: string;
  workplace: string | null;
  bio: string | null;
  avatar_path: string | null;
};

type PublishedArticle = {
  id: number;
  title: string;
  body: string;
  created_at: string;
};

// A member's public profile: what any visitor may see. Private details never appear here.
export default function ProfileView({ id }: { id: string }) {
  const sb = useMemo(() => browser(), []);
  const pub = (p: string) => sb.storage.from('public-media').getPublicUrl(p).data.publicUrl;
  const [p, setP] = useState<PublicProfile | null>(null);
  const [arts, setArts] = useState<PublishedArticle[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const [a, b] = await Promise.all([
        sb.from('public_profiles').select('id,full_name,workplace,bio,avatar_path').eq('id', id).maybeSingle(),
        sb.from('articles').select('id,title,body,created_at').eq('author_id', id).eq('status', 'approved').order('created_at', { ascending: false }),
      ]);
      if (!active) return;
      if (a.error || b.error) {
        const cause = a.error ?? b.error;
        console.error('Public profile could not be loaded:', cause);
        setError(`Could not load this profile: ${cause?.message ?? "Unknown error"}`);
      } else {
        setP(a.data as PublicProfile | null);
        setArts((b.data ?? []) as PublishedArticle[]);
      }
      setDone(true);
    })();
    return () => { active = false; };
  }, [sb, id]);

  if (!done) return (
    <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-8 sm:px-6">
      <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="h-1 w-full rounded-full bg-gray-100" />
        <div className="mt-5 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-100" />
          <div className="space-y-2"><div className="h-5 w-48 rounded bg-gray-100" /><div className="h-3 w-32 rounded bg-gray-100" /></div>
        </div>
      </div>
    </main>
  );
  if (error) return (
    <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-8 sm:px-6">
      <div role="alert" className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-800 shadow-sm">{error}</div>
      <Link className="mt-4 inline-flex text-sm font-medium text-gray-700 hover:text-black" href="/">← Back to home</Link>
    </main>
  );
  if (!p) return (
    <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-10">
        <p className="gradient-accent-text text-xs font-semibold uppercase tracking-[0.16em]">SRU community</p>
        <h1 className="mt-2 text-xl font-semibold">Profile not found</h1>
        <p className="mt-2 text-sm text-gray-600">This profile may no longer be available.</p>
        <Link className="mt-4 inline-flex rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black" href="/">Back to home</Link>
      </div>
    </main>
  );
  return (
    <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
      <Breadcrumbs items={[{ label: 'Members' }, { label: p.full_name }]} />

      <WaveCard className="gradient-card mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="h-20 bg-gradient-to-r from-gray-950 via-gray-800 to-gray-950 sm:h-28" />
        <div className="px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="-mt-8 flex flex-wrap items-end gap-3 sm:-mt-10 sm:gap-4">
            <div className="rounded-full bg-white p-1 shadow-md">
              <Avatar name={p.full_name} src={p.avatar_path ? pub(p.avatar_path) : ''} size="h-16 w-16 sm:h-20 sm:w-20" />
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <p className="gradient-accent-text text-[10px] font-semibold uppercase tracking-[0.16em]">SRU member profile</p>
              <h1 className="mt-0.5 break-words text-xl font-semibold tracking-tight sm:text-2xl"><TextReveal>{p.full_name}</TextReveal></h1>
              {p.workplace && <p className="mt-1 text-sm text-gray-600">{p.workplace}</p>}
            </div>
          </div>
          {p.bio && (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">About</h2>
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-gray-700">{p.bio}</p>
            </div>
          )}
        </div>
      </WaveCard>

      <WaveCard className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <section>
        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5">
          <div>
            <p className="gradient-accent-text text-[10px] font-semibold uppercase tracking-[0.16em]">Published writing</p>
            <h2 className="mt-0.5 text-base font-semibold">Articles</h2>
          </div>
          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">{arts.length}</span>
        </header>
        <ul className="divide-y divide-gray-100">
          {arts.map((a, i) => (
            <li key={a.id}>
              <WaveCard index={i} className="px-4 py-3 transition-colors hover:bg-gray-50/80 sm:px-5">
              <Link href={`/article?id=${a.id}`} className="font-medium text-gray-900 underline-offset-4 hover:text-indigo-700 hover:underline">{a.title}</Link>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-600">{a.body}</p>
              <div className="mt-1.5 text-[11px] text-gray-500">{fmt(a.created_at)}</div>
              </WaveCard>
            </li>
          ))}
          {arts.length === 0 && (
            <li className="px-4 py-8 text-center sm:px-5">
              <p className="text-sm font-medium text-gray-800">No published articles yet</p>
              <p className="mt-1 text-xs text-gray-500">Published contributions from this member will appear here.</p>
            </li>
          )}
        </ul>
      </section>
      </WaveCard>
    </main>
  );
}
