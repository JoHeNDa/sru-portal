'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { browser } from '@/lib/browser';
import { Avatar, fmt } from '@/components/ui';
import ArticleEngagement from '@/components/ArticleEngagement';
import WaveCard from '@/components/WaveCard';
import TextReveal from '@/components/TextReveal';
import Breadcrumbs from '@/components/Breadcrumbs';

type Article = { id: number; title: string; body: string; image_path: string | null; created_at: string; author_id: string | null; status: string };
type PublicProfile = { full_name: string; avatar_path: string | null };

export default function ArticleView({ id }: { id: string }) {
  const sb = useMemo(() => browser(), []);
  const pub = (p: string) => sb.storage.from('public-media').getPublicUrl(p).data.publicUrl;
  const [a, setA] = useState<Article | null>(null);
  const [p, setP] = useState<PublicProfile | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from('articles').select('id,title,body,image_path,created_at,author_id,status').eq('id', id).maybeSingle();
      setA(data);
      if (data?.author_id) {
        const { data: pr } = await sb.from('public_profiles').select('full_name,avatar_path').eq('id', data.author_id).maybeSingle();
        setP(pr);
      }
      setDone(true);
    })();
  }, [sb, id]);

  if (!done) return <main className="p-8">Loading...</main>;
  if (!a) return <main className="p-8">Article not found. <Link className="underline" href="/">Home</Link></main>;
  const name = p?.full_name ?? 'SRU Secretariat';
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Breadcrumbs items={[{ label: 'Articles', href: '/articles' }, { label: a.title }]} />
      <div className="mt-6 flex items-center gap-3">
        {a.author_id
          ? <Link href={`/profile?id=${a.author_id}`} aria-label={`View ${name}'s profile`}><Avatar name={name} src={p?.avatar_path ? pub(p.avatar_path) : ''} /></Link>
          : <Avatar name={name} src="" />}
        <div>
          {a.author_id ? <Link href={`/profile?id=${a.author_id}`} className="font-medium leading-tight hover:underline">{name}</Link> : <div className="font-medium leading-tight">{name}</div>}
          <div className="text-sm text-gray-500">{fmt(a.created_at)}</div>
        </div>
      </div>
      <WaveCard className="mt-6">
        {a.image_path && <img src={pub(a.image_path)} alt="" className="w-full object-cover" />}
        <h1 className="mt-6 font-serif text-3xl font-semibold"><TextReveal>{a.title}</TextReveal></h1>
        <div className="mt-4 whitespace-pre-line text-lg leading-relaxed text-gray-800">{a.body}</div>
        {a.status === 'approved' && <ArticleEngagement articleId={a.id} />}
      </WaveCard>
    </main>
  );
}
