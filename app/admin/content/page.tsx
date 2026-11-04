'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { browser } from '@/lib/browser';
import CommitteeTab from '@/components/content/CommitteeTab';
import HeroTab from '@/components/content/HeroTab';
import EventsTab from '@/components/content/EventsTab';
import SettingsTab from '@/components/content/SettingsTab';
import ArticlesTab from '@/components/content/ArticlesTab';
import PurposeTab from '@/components/content/PurposeTab';
import ShowcasesTab from '@/components/content/ShowcasesTab';
import Icon from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import Breadcrumbs from '@/components/Breadcrumbs';

const CONTENT_TABS: { key: string; label: string; icon: IconName }[] = [
  { key: 'purpose', label: 'Our purpose', icon: 'home' },
  { key: 'committee', label: 'Committee', icon: 'users' },
  { key: 'hero', label: 'Hero slides', icon: 'article' },
  { key: 'articles', label: 'Articles', icon: 'article' },
  { key: 'showcases', label: 'Homepage showcases', icon: 'article' },
  { key: 'events', label: 'Events', icon: 'calendar' },
  { key: 'settings', label: 'Contacts and logo', icon: 'settings' },
];
const CONTENT_LABELS = Object.fromEntries(CONTENT_TABS.map(item => [item.key, item.label]));

// Content managers for admins. Every item can be added, edited, reordered where it matters, and deleted.
export default function ContentAdmin() {
  const sb = useMemo(() => browser(), []);
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [tab, setTab] = useState('committee');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return setRole(null);
      const { data } = await sb.rpc('my_role');
      setRole((data as string) ?? null);
    })();
  }, [sb]);

  if (role === undefined) return <main className="p-8">Loading...</main>;
  if (role !== 'chief_admin' && role !== 'admin') return <main className="p-8">This page is for admins. <Link className="underline" href="/">Home</Link></main>;

  return (
    <main className="workspace-compact min-h-[calc(100vh-4rem)] bg-gray-50 px-3 py-4 sm:px-5 lg:px-6 lg:py-5">
      <div className="mx-auto max-w-[1440px]">
        <Breadcrumbs items={[{ label: 'Administration', href: '/admin' }, { label: 'Content' }]} className="mb-2" />
        <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 font-brand text-xs font-semibold uppercase tracking-[0.16em] text-teal-800"><Icon name="article" className="h-4 w-4" /> Society workspace</p>
            <h1 className="mt-1 font-serif font-semibold">Content management</h1>
            <p className="mt-1 text-gray-600">Publish and maintain the public SRU website.</p>
          </div>
          <Link href="/admin" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-teal-700 hover:text-teal-800"><Icon name="arrow" className="h-4 w-4 rotate-180" /> Administration</Link>
        </header>
        <div className="grid items-start gap-3 lg:grid-cols-[190px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm lg:sticky lg:top-16">
            <p className="flex items-center gap-2 px-3 pb-2 pt-1 font-brand text-xs font-semibold uppercase tracking-[0.12em] text-gray-500"><Icon name="settings" className="h-3.5 w-3.5" /> Website</p>
            <nav aria-label="Content sections" className="grid grid-cols-2 gap-0.5 sm:grid-cols-3 lg:grid-cols-1">
              {CONTENT_TABS.map(({ key, label, icon }) => (
                <button key={key} type="button" aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)} className="button-choice w-full justify-start rounded-md px-2.5 py-2 text-left">
                  <span className="flex items-center gap-2"><Icon name={icon} className="h-3.5 w-3.5 shrink-0" />{label}</span>
                </button>
              ))}
            </nav>
          </aside>
          <section className="min-w-0 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-3 py-2.5 sm:px-4">
              <h2 className="font-serif font-semibold">{CONTENT_LABELS[tab]}</h2>
              <p className="mt-0.5 text-gray-600">Update public-facing content and media.</p>
            </div>
            <div className="min-w-0 p-3 sm:p-4">
              {tab === 'committee' && <CommitteeTab sb={sb} />}
              {tab === 'purpose' && <PurposeTab sb={sb} />}
              {tab === 'hero' && <HeroTab sb={sb} />}
              {tab === 'articles' && <ArticlesTab sb={sb} />}
              {tab === 'showcases' && <ShowcasesTab sb={sb} />}
              {tab === 'events' && <EventsTab sb={sb} />}
              {tab === 'settings' && <SettingsTab sb={sb} />}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
