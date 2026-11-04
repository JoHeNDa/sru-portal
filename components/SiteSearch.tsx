'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { browser } from '@/lib/browser';
import Icon from '@/components/Icon';

type SearchResult = { href: string; title: string; detail: string; kind: string };

export default function SiteSearch() {
  const sb = useMemo(() => browser(), []);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !searchRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    const term = query.trim().replace(/[%_]/g, '');
    if (term.length < 2) {
      setResults([]);
      setMessage('');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const pattern = `%${term}%`;
      const [articles, events, profiles] = await Promise.all([
        sb.from('articles').select('id,title').eq('status', 'approved').ilike('title', pattern).limit(4),
        sb.from('events').select('id,title,venue_date').ilike('title', pattern).limit(3),
        sb.from('public_profiles').select('id,full_name,workplace').ilike('full_name', pattern).limit(3),
      ]);
      if (!active) return;

      const errors = [articles.error, events.error, profiles.error].filter(Boolean);
      if (errors.length) {
        console.error('Site search failed:', errors);
        setMessage('Some search results could not be loaded. Please try again.');
      } else {
        setMessage('');
      }

      const items: SearchResult[] = [
        ...(articles.data ?? []).map(row => ({ href: `/article?id=${row.id}`, title: row.title, detail: 'Article', kind: 'Article' })),
        ...(events.data ?? []).map(row => ({ href: `/event?id=${row.id}`, title: row.title, detail: row.venue_date ?? 'Event', kind: 'Event' })),
        ...(profiles.data ?? []).map(row => ({ href: `/profile?id=${row.id}`, title: row.full_name, detail: row.workplace ?? 'Member profile', kind: 'Member' })),
      ];
      setResults(items);
      if (!items.length && !errors.length) setMessage('No matching articles, events, or member profiles.');
      setLoading(false);
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, sb]);

  return (
    <div ref={searchRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Search the SRU website"
        aria-expanded={open}
        aria-controls="site-search-panel"
        data-tooltip="Search"
        onClick={() => setOpen(value => !value)}
        className="tooltip-trigger inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#3a3b43] bg-[#1b1c22] text-gray-300 transition hover:border-gray-500 hover:bg-[#292a31] hover:text-white"
      >
        <Icon name="search" className="h-4 w-4" />
      </button>
      {open && (
        <div id="site-search-panel" className="absolute right-0 top-full z-[70] mt-2 w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
          <label className="sr-only" htmlFor="site-search">Search the SRU website</label>
          <div data-site-search-box className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 transition focus-within:border-gray-900 focus-within:bg-white focus-within:ring-0">
            <Icon name="search" className="h-4 w-4 shrink-0 text-gray-500" />
            <input
              ref={inputRef}
              id="site-search"
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search articles, events, members"
              autoComplete="off"
              className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-gray-900 outline-none ring-0 placeholder:text-gray-500 focus:border-0 focus:outline-none focus:ring-0"
              aria-expanded={query.trim().length >= 2}
              aria-controls="site-search-results"
              role="combobox"
              aria-autocomplete="list"
            />
            <kbd className="hidden rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-500 sm:inline">Esc</kbd>
          </div>
          {query.trim().length >= 2 && (
            <div id="site-search-results" role="listbox" className="mt-2 max-h-80 overflow-y-auto">
              {loading && <p className="px-3 py-3 text-sm text-gray-500">Searching…</p>}
              {!loading && results.map(result => (
                <Link
                  key={`${result.kind}:${result.href}`}
                  href={result.href}
                  role="option"
                  onClick={() => { setOpen(false); setQuery(''); }}
                  className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 hover:bg-gray-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">{result.title}</span>
                    <span className="block truncate text-xs text-gray-500">{result.detail}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600">{result.kind}</span>
                </Link>
              ))}
              {!loading && message && <p className={`px-3 py-3 text-sm ${message.startsWith('No matching') ? 'text-gray-500' : 'text-red-700'}`}>{message}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
