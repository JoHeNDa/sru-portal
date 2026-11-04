'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { browser } from '@/lib/browser';
import RevealSection from '@/components/RevealSection';
import WaveCard from '@/components/WaveCard';
import Breadcrumbs from '@/components/Breadcrumbs';

type CommitteeMember = {
  member_id: number | null;
  term_id: number;
  starts_on: string;
  ends_on: string | null;
  is_current: boolean;
  role: string | null;
  full_name: string | null;
  photo_path: string | null;
  message: string | null;
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map(part => part[0] ?? '').join('').toUpperCase();
}

function formatTerm(start: string, end: string | null) {
  const startYear = start.slice(0, 4);
  const endYear = end?.slice(0, 4);
  return endYear ? `${startYear} – ${endYear}` : `${startYear} – Present`;
}

export default function CommitteeDirectory() {
  const sb = useMemo(() => browser(), []);
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error: queryError } = await sb.rpc('public_all_committees');
      if (!active) return;
      if (queryError) {
        console.error('Committee directory could not be loaded:', queryError);
        setError(queryError.code === 'PGRST202'
          ? 'The committee directory is not installed yet. Run supabase/patch-13-public-committee-directory.sql in the Supabase SQL Editor, then reload this page.'
          : `Could not load the committee directory: ${queryError.message}`);
      } else {
        setMembers((data ?? []) as CommitteeMember[]);
      }
      setLoading(false);
    })();

    return () => { active = false; };
  }, [sb]);

  const groups = useMemo(() => {
    const byTerm = new Map<number, CommitteeMember[]>();
    for (const member of members) {
      const group = byTerm.get(member.term_id) ?? [];
      group.push(member);
      byTerm.set(member.term_id, group);
    }
    return Array.from(byTerm.entries()).map(([termId, rows]) => ({ termId, rows }));
  }, [members]);
  const photoUrl = (path: string) => sb.storage.from('public-media').getPublicUrl(path).data.publicUrl;
  const currentGroup = groups.find(group => group.rows[0]?.is_current);
  const pastGroups = groups.filter(group => !group.rows[0]?.is_current);

  function renderTerm({ termId, rows }: typeof groups[number], groupIndex: number, label?: string) {
    const first = rows[0];
    const roster = rows.filter(member => member.member_id !== null);
    return (
      <section key={termId} aria-labelledby={`committee-term-${termId}`}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            {label && <p className="font-brand text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">{label}</p>}
            <h2 id={`committee-term-${termId}`} className={`${label ? 'mt-1' : ''} font-serif text-2xl font-semibold tracking-tight sm:text-3xl`}>{formatTerm(first.starts_on, first.ends_on)}</h2>
          </div>
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600">{roster.length} {roster.length === 1 ? 'member' : 'members'}</span>
        </div>
        {roster.length === 0
          ? <p className="rounded-xl border border-dashed border-gray-300 bg-white p-5 text-sm text-gray-600">No members listed for this term.</p>
          : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roster.map((member, index) => (
              <WaveCard key={member.member_id} index={groupIndex * 3 + index} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex h-56 items-center justify-center overflow-hidden bg-gray-100">
                  {member.photo_path
                    ? <img src={photoUrl(member.photo_path)} alt={member.full_name ?? ''} className="h-full w-full object-contain" />
                    : <span aria-hidden="true" className="font-serif text-5xl font-semibold text-gray-400">{initials(member.full_name ?? '')}</span>}
                </div>
                <div className="p-5">
                  {member.role && <p className="text-sm font-medium text-gray-600">{member.role}</p>}
                  <h3 className="mt-1 font-serif text-xl font-semibold text-gray-950">{member.full_name}</h3>
                </div>
              </WaveCard>
            ))}
          </div>}
      </section>
    );
  }

  return (
    <main>
      <RevealSection className="border-b border-gray-200 bg-gray-50 py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-6">
          <Breadcrumbs items={[{ label: 'Committee' }]} />
          <p className="mt-6 font-brand text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Leadership</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Our Committees</h1>
          <p className="mt-3 max-w-2xl text-gray-600">Meet the current and past committee members serving the Society of Radiography of Uganda.</p>
        </div>
      </RevealSection>

      <div className="mx-auto max-w-7xl space-y-12 px-6 py-10 md:py-14">
        {loading && <p role="status" className="text-gray-600">Loading committee members…</p>}
        {!loading && error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {!loading && !error && groups.length === 0 && <p className="text-gray-600">No committee members have been added yet.</p>}
        {!loading && !error && currentGroup && renderTerm(currentGroup, 0, 'Current committee')}
        {!loading && !error && pastGroups.length > 0 && (
          <>
            {currentGroup && <hr className="border-0 border-t border-gray-200" />}
            <section aria-labelledby="past-committees-title" className="space-y-8">
              <h2 id="past-committees-title" className="font-brand text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">Past committees</h2>
              {pastGroups.map((group, index) => renderTerm(group, index + (currentGroup ? 1 : 0)))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
