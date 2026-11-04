'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { browser } from '@/lib/browser';
import { Avatar } from '@/components/ui';
import Icon from '@/components/Icon';
import SiteSearch from '@/components/SiteSearch';
import { playUiSound, primeUiSounds } from '@/lib/ui-sound';

type S = {
  loaded: boolean;
  signedIn: boolean;
  member: { id: string; full_name: string; title: string | null; avatar_path: string | null; paid_through_year: number } | null;
  staff: string | null;
  logo: string;
};
type Notice = { key: string; kind: 'article' | 'event' | 'renewal'; title: string; href: string; isNew: boolean };
type NoticeState = { items: Notice[]; unread: number; newestArticleId: number; newestEventId: number; renewalDue: boolean; renewalYear: number };

const mainLinks = [
  { label: 'Home', href: '/', icon: 'home' as const },
  { label: 'News', href: '/#news', icon: 'article' as const },
  { label: 'Events', href: '/#events', icon: 'calendar' as const },
  { label: 'Committee', href: '/committee', icon: 'users' as const },
];

export default function TopBar() {
  const sb = useMemo(() => browser(), []);
  const pathname = usePathname();
  const [s, setS] = useState<S>({ loaded: false, signedIn: false, member: null, staff: null, logo: '' });
  const [noticeState, setNoticeState] = useState<NoticeState>({ items: [], unread: 0, newestArticleId: 0, newestEventId: 0, renewalDue: false, renewalYear: 0 });
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [currentHash, setCurrentHash] = useState('');
  const closeAccountRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!accountOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false);
      if (event.key !== 'Tab') return;
      const dialog = closeAccountRef.current?.closest('[role="dialog"]');
      const focusable = dialog?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    closeAccountRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
      returnFocusRef.current?.focus();
    };
  }, [accountOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Element && !event.target.closest('[data-notification-control]')) setNotificationsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      const { data: lg } = await sb.from('site_settings').select('value').eq('key', 'logo_path').maybeSingle();
      let member: S['member'] = null;
      let staff: string | null = null;
      if (user) {
        const [m, r] = await Promise.all([
          sb.from('members').select('id,full_name,title,avatar_path,paid_through_year').eq('id', user.id).maybeSingle(),
          sb.rpc('my_role'),
        ]);
        let memberData = m.data;
        if (m.error) {
          console.error('Member header details could not be loaded with professional fields:', m.error);
          const fallback = await sb.from('members').select('id,full_name,avatar_path,paid_through_year').eq('id', user.id).maybeSingle();
          if (fallback.error) console.error('Member header details could not be loaded:', fallback.error);
          else memberData = fallback.data ? { ...fallback.data, title: null } : null;
        }
        if (memberData?.paid_through_year != null) {
          member = { id: memberData.id, full_name: memberData.full_name, title: memberData.title, avatar_path: memberData.avatar_path, paid_through_year: memberData.paid_through_year };
        }
        staff = (r.data as string) ?? null;
      }
      const [articles, events] = await Promise.all([
        sb.from('articles').select('id,title').eq('status', 'approved').order('id', { ascending: false }).limit(20),
        sb.from('events').select('id,title').order('id', { ascending: false }).limit(20),
      ]);
      if (articles.error) console.error('Article notifications could not be loaded:', articles.error);
      if (events.error) console.error('Event notifications could not be loaded:', events.error);
      const articleRows = articles.data ?? [];
      const eventRows = events.data ?? [];
      const newestArticleId = articleRows.reduce((max, row) => Math.max(max, Number(row.id)), 0);
      const newestEventId = eventRows.reduce((max, row) => Math.max(max, Number(row.id)), 0);
      const storedArticleId = window.localStorage.getItem('sru-last-read-article-id');
      const storedEventId = window.localStorage.getItem('sru-last-read-event-id');
      const lastArticleId = storedArticleId === null ? newestArticleId : Number(storedArticleId);
      const lastEventId = storedEventId === null ? newestEventId : Number(storedEventId);
      if (storedArticleId === null) window.localStorage.setItem('sru-last-read-article-id', String(newestArticleId));
      if (storedEventId === null) window.localStorage.setItem('sru-last-read-event-id', String(newestEventId));
      const today = new Date();
      const renewalYear = today.getFullYear();
      const renewalDue = !!member && (member.paid_through_year < renewalYear || (member.paid_through_year === renewalYear && today.getMonth() >= 10));
      const renewalRead = window.localStorage.getItem('sru-renewal-read-year') === String(renewalYear);
      const items: Notice[] = [
        ...articleRows.slice(0, 3).map(row => ({ key: `article-${row.id}`, kind: 'article' as const, title: row.title, href: `/article?id=${row.id}`, isNew: Number(row.id) > lastArticleId })),
        ...eventRows.slice(0, 3).map(row => ({ key: `event-${row.id}`, kind: 'event' as const, title: row.title, href: `/event?id=${row.id}`, isNew: Number(row.id) > lastEventId })),
      ];
      if (renewalDue) items.unshift({ key: 'renewal', kind: 'renewal', title: 'Your membership renewal is due.', href: '/member', isNew: !renewalRead });
      const unread = articleRows.filter(row => Number(row.id) > lastArticleId).length
        + eventRows.filter(row => Number(row.id) > lastEventId).length
        + (renewalDue && !renewalRead ? 1 : 0);
      if (!active) return;
      setS({
        loaded: true,
        signedIn: !!user,
        member,
        staff,
        logo: lg?.value ? sb.storage.from('public-media').getPublicUrl(lg.value).data.publicUrl : '',
      });
      setNoticeState({
        items,
        unread,
        newestArticleId,
        newestEventId,
        renewalDue,
        renewalYear,
      });
    })();
    return () => { active = false; };
  }, [sb]);

  useEffect(() => {
    setSoundsEnabled(window.localStorage.getItem('sru-ui-sounds') !== 'off');
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');
    document.addEventListener('pointerdown', primeUiSounds, { once: true });
    document.addEventListener('keydown', primeUiSounds, { once: true });
    return () => {
      document.removeEventListener('pointerdown', primeUiSounds);
      document.removeEventListener('keydown', primeUiSounds);
    };
  }, []);

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash);
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  async function signOut() {
    await sb.auth.signOut();
    location.href = '/';
  }

  function toggleNotifications() {
    const opening = !notificationsOpen;
    setNotificationsOpen(opening);
    if (!opening) return;
    if (noticeState.unread > 0) playUiSound('attention');
    window.localStorage.setItem('sru-last-read-article-id', String(noticeState.newestArticleId));
    window.localStorage.setItem('sru-last-read-event-id', String(noticeState.newestEventId));
    if (noticeState.renewalDue) window.localStorage.setItem('sru-renewal-read-year', String(noticeState.renewalYear));
    setNoticeState(state => ({
      ...state,
      unread: 0,
      items: state.items.map(item => ({ ...item, isNew: false })),
    }));
  }

  const greetingName = s.member
    ? `${s.member.title ? `${s.member.title.replace(/\.$/, '')}. ` : ''}${s.member.full_name.trim().replace(/^(?:Dr\.?|Mr\.?|Ms\.?)\s+/i, '').split(/\s+/)[0]}`
    : '';
  const link = 'top-nav-link inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-2 text-sm text-gray-300 transition hover:bg-[#23242a] hover:text-white';
  const isActiveLink = (href: string) => {
    const [targetPath, targetHash] = href.split('#');
    const pathMatches = pathname === (targetPath || '/');
    return pathMatches && (targetHash ? currentHash === `#${targetHash}` : !currentHash);
  };
  const navClass = (href: string) => `${link} ${isActiveLink(href) ? '!border-white !bg-white !text-gray-950 [&_svg]:!text-gray-950' : ''}`;
  const notificationControl = (notificationId: string) => (
    <div data-notification-control className="relative">
        <button
          type="button"
          aria-label="Notifications"
          aria-expanded={notificationsOpen}
          aria-controls={notificationId}
          title={noticeState.unread ? `${noticeState.unread} new notifications` : 'Notifications'}
          onClick={toggleNotifications}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#3a3b43] bg-[#1b1c22] text-gray-300 transition hover:border-gray-500 hover:bg-[#292a31] hover:text-white"
        >
          <Icon name="bell" className="h-4 w-4" />
          {noticeState.unread > 0 && <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white">{noticeState.unread > 9 ? '9+' : noticeState.unread}</span>}
        </button>
        {notificationsOpen && (
          <section id={notificationId} role="dialog" aria-label="Notifications" className="absolute right-0 top-11 z-[70] w-[min(21rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <header className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5">
              <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
              <button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications" className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"><Icon name="close" className="h-4 w-4" /></button>
            </header>
            <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
              {noticeState.items.map(item => (
                <li key={item.key}>
                  <Link href={item.href} onClick={() => setNotificationsOpen(false)} className="flex items-start gap-2.5 px-3 py-2.5 text-sm hover:bg-gray-50">
                    <Icon name={item.kind === 'article' ? 'article' : item.kind === 'event' ? 'calendar' : 'shield'} className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-gray-800">
                        {item.kind === 'article' ? item.isNew ? 'New article' : 'Article'
                          : item.kind === 'event' ? item.isNew ? 'New event' : 'Event'
                            : 'Membership renewal'}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-gray-600">{item.title}</span>
                    </span>
                    {item.isNew && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="New" />}
                  </Link>
                </li>
              ))}
              {noticeState.items.length === 0 && <li className="px-3 py-5 text-center text-xs text-gray-500">You’re all caught up. New articles and events will appear here.</li>}
            </ul>
            <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2">
              <span className="text-[11px] text-gray-500">Soft sound for new alerts</span>
              <button type="button" onClick={() => {
                const next = window.localStorage.getItem('sru-ui-sounds') === 'off' ? 'on' : 'off';
                window.localStorage.setItem('sru-ui-sounds', next);
                setSoundsEnabled(next === 'on');
              }} className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50" aria-pressed={soundsEnabled}>
                Sounds {soundsEnabled ? 'on' : 'off'}
              </button>
            </div>
          </section>
        )}
    </div>
  );
  const profileControl = s.loaded && s.member && (
        <button type="button" onClick={event => {
          returnFocusRef.current = event.currentTarget;
          setAccountOpen(true);
        }} aria-label="Open profile and membership menu" title="Profile and membership" className="profile-trigger flex items-center gap-2 rounded-full py-0.5 pl-2 pr-0.5 ring-offset-2 transition hover:bg-[#23242a] hover:ring-1 hover:ring-gray-500">
          <span className="hidden text-right leading-tight sm:block">
            <span className="block text-[10px] text-gray-400">{greeting}</span>
            <span className="block max-w-36 truncate text-xs font-semibold text-white">{greetingName}</span>
          </span>
          <Avatar name={s.member.full_name} src={s.member.avatar_path ? sb.storage.from('public-media').getPublicUrl(s.member.avatar_path).data.publicUrl : ''} size="h-9 w-9" />
        </button>
  );
  const accountLinks = (
    <>
      {s.loaded && s.staff && <Link href="/admin" aria-current={pathname === '/admin' ? 'page' : undefined} className="button-neutral px-3 py-2 text-sm"><Icon name="shield" className="h-4 w-4" />Admin</Link>}
      {(s.staff === 'chief_admin' || s.staff === 'admin') && <Link href="/admin/content" aria-current={pathname === '/admin/content' ? 'page' : undefined} className="button-neutral px-3 py-2 text-sm"><Icon name="article" className="h-4 w-4" />Content</Link>}
      {s.loaded && !s.member && !s.staff && <Link href="/join" className="button-primary rounded-lg px-3 py-2 text-sm font-semibold shadow-sm">Join SRU</Link>}
      {s.signedIn && <button onClick={signOut} className="rounded-lg px-2 py-2 text-sm text-gray-500 underline-offset-4 hover:text-gray-900 hover:underline">Sign out</button>}
    </>
  );

  return (
    <header className="site-header sticky top-0 z-50 border-b-0 bg-[#101116] text-white shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-5 lg:px-7">
        <Link href="/" aria-label="Society of Radiography of Uganda" className="mr-auto flex min-w-0 items-center gap-2 font-brand text-sm font-bold tracking-[0.055em] text-white sm:text-base lg:text-lg">
          {s.logo && <img src={s.logo} alt="" className="h-9 w-auto object-contain" />}
          <span className="leading-tight sm:hidden">SRU</span>
          <span className="hidden leading-tight sm:inline">Society of Radiography of Uganda</span>
        </Link>
        <button
          type="button"
          className={`menu-toggle order-2 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition md:hidden ${menuOpen ? 'border-white bg-white text-gray-950' : 'border-[#3a3b43] bg-[#1b1c22] text-gray-200'}`}
          aria-expanded={menuOpen}
          aria-controls="mobile-main-navigation"
          onClick={() => setMenuOpen(open => !open)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} className="h-4 w-4" />
          {menuOpen ? 'Close' : 'Menu'}
        </button>
        <div className="order-2 flex items-center gap-2 md:hidden">
          {profileControl}
        </div>
        <nav aria-label="Main navigation" className="hidden items-center gap-0.5 lg:flex">
          {mainLinks.map(item => (
            <Link key={item.href} href={item.href} aria-current={isActiveLink(item.href) ? 'page' : undefined} onClick={() => setCurrentHash(item.href.includes('#') ? `#${item.href.split('#')[1]}` : '')} className={navClass(item.href)}>
              <Icon name={item.icon} className="h-4 w-4 text-gray-400" />{item.label}
            </Link>
          ))}
          <Link href="/#contacts" aria-current={isActiveLink('/#contacts') ? 'page' : undefined} onClick={() => setCurrentHash('#contacts')} className={navClass('/#contacts')}>Contact</Link>
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {profileControl}
          {accountLinks}
        </div>
        {menuOpen && (
          <div id="mobile-main-navigation" className="order-4 basis-full border-t border-[#3a3b43] pt-3 md:hidden">
            <nav aria-label="Mobile main navigation" className="grid gap-1 sm:grid-cols-2">
              {mainLinks.map(item => (
                <Link key={item.href} href={item.href} aria-current={isActiveLink(item.href) ? 'page' : undefined} onClick={() => { setCurrentHash(item.href.includes('#') ? `#${item.href.split('#')[1]}` : ''); setMenuOpen(false); }} className={navClass(item.href)}>
                  <Icon name={item.icon} className="h-4 w-4 text-gray-400" />{item.label}
                </Link>
              ))}
              <Link href="/#contacts" aria-current={isActiveLink('/#contacts') ? 'page' : undefined} onClick={() => { setCurrentHash('#contacts'); setMenuOpen(false); }} className={navClass('/#contacts')}>Contact</Link>
            </nav>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#303139] pt-3 text-sm">{accountLinks}</div>
          </div>
        )}
        <div className="order-2 ml-auto flex items-center gap-2 md:order-last md:ml-0">
          <SiteSearch />
          {notificationControl('site-notifications')}
        </div>
      </div>
      {accountOpen && s.member && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={event => {
          if (event.target === event.currentTarget) setAccountOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="account-dialog-title" className="w-full max-w-sm animate-rise-in rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
            <header className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <Avatar name={s.member.full_name} src={s.member.avatar_path ? sb.storage.from('public-media').getPublicUrl(s.member.avatar_path).data.publicUrl : ''} size="h-11 w-11" />
              <div className="min-w-0 flex-1">
                <h2 id="account-dialog-title" className="truncate text-base font-semibold">{s.member.full_name}</h2>
                <p className="text-xs text-gray-500">Member account</p>
              </div>
              <button ref={closeAccountRef} type="button" onClick={() => setAccountOpen(false)} aria-label="Close account menu" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
                <Icon name="close" className="h-4 w-4" />
              </button>
            </header>
            <nav aria-label="Member account" className="grid gap-1 pt-3">
              <Link href={`/profile?id=${s.member.id}`} onClick={() => setAccountOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Icon name="users" className="h-4 w-4 text-gray-500" />Public profile
              </Link>
              <Link href="/member" onClick={() => setAccountOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Icon name="shield" className="h-4 w-4 text-gray-500" />Membership workspace
              </Link>
            </nav>
          </section>
        </div>
      )}
    </header>
  );
}
