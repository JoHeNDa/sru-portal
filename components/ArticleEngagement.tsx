'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { browser } from '@/lib/browser';
import { Avatar, fmt } from '@/components/ui';
import { playUiSound } from '@/lib/ui-sound';
import ConfirmModal from '@/components/ConfirmModal';
import { useConfirm } from '@/lib/use-confirm';

type Reaction = { member_id: string; kind: 'like' | 'unlike' };
type Cmt = { id: number; member_id: string; parent_id: number | null; body: string; created_at: string };
type Prof = { id: string; full_name: string; avatar_path: string | null };

const PAGE = 5;       // top-level comments shown before "Show more"
const MAX_INDENT = 3; // replies indent this many levels, then stay level so deep threads do not squeeze

const UP = 'M7 11v9H3v-9zM7 11l4-8c2 0 3 1 3 3v3h6l-1 8H7';
const DOWN = 'M7 13V4H3v9zM7 13l4 8c2 0 3-1 3-3v-3h6l-1-8H7';
const CHAT = 'M4 5h16v11H9l-5 4z';
const Icon = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const Badge = ({ n }: { n: number }) => <span className="min-w-5 rounded-full bg-gray-200 px-1.5 text-center text-xs font-medium text-gray-900">{n}</span>;
const field = 'min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm';
const btn = 'button-primary px-3 py-1.5 text-sm disabled:opacity-50';
const link = 'text-xs text-gray-600 hover:underline';

// Like and Unlike on the left; the full reply tree opens in a space-saving dialog.
export default function ArticleEngagement({ articleId }: { articleId: number }) {
  const { confirm, modalState, handleConfirm, handleCancel } = useConfirm();
  const sb = useMemo(() => browser(), []);
  const pub = (p: string) => sb.storage.from('public-media').getPublicUrl(p).data.publicUrl;
  const [me, setMe] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const [rx, setRx] = useState<Reaction[]>([]);
  const [cm, setCm] = useState<Cmt[]>([]);
  const [profs, setProfs] = useState<Record<string, Prof>>({});
  const [text, setText] = useState('');
  const [reply, setReply] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [open, setOpen] = useState(false);
  const [openNodes, setOpenNodes] = useState<Set<number>>(new Set());
  const [shown, setShown] = useState(PAGE);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])',
      );
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
    document.addEventListener('keydown', onKeyDown);
    closeRef.current?.focus();
    const triggerNode = triggerRef.current;
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      triggerNode?.focus();
    };
  }, [open]);

  const load = useCallback(async () => {
    const [r, c] = await Promise.all([
      sb.from('article_reactions').select('member_id,kind').eq('article_id', articleId),
      sb.from('comments').select('id,member_id,parent_id,body,created_at').eq('article_id', articleId).order('created_at'),
    ]);
    if (r.error || c.error) {
      const error = r.error ?? c.error;
      console.error('Article discussion could not be loaded:', error);
      setFailed(true);
      setNote(`Could not load the discussion: ${error?.message ?? "Unknown error"}`);
      return;
    }
    setFailed(false);
    setRx((r.data as Reaction[]) ?? []); setCm((c.data as Cmt[]) ?? []);
    const ids = Array.from(new Set((c.data ?? []).map((x: Cmt) => x.member_id)));
    if (ids.length) {
      const { data, error } = await sb.from('public_profiles').select('id,full_name,avatar_path').in('id', ids);
      if (error) {
        console.error('Comment author profiles could not be loaded:', error);
        setNote(`Comments loaded, but author profiles could not be fetched: ${error?.message ?? "Unknown error"}`);
        return;
      }
      setProfs(Object.fromEntries((data ?? []).map((p: Prof) => [p.id, p])));
    } else {
      setProfs({});
    }
    setNote('');
  }, [sb, articleId]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        const { data: m } = await sb.from('members').select('paid_through_year').eq('id', user.id).maybeSingle();
        setMe(m?.paid_through_year != null ? user.id : null);
        const { data: role } = await sb.rpc('my_role');
        setIsAdmin(role === 'chief_admin' || role === 'admin');
      }
      await load();
      setReady(true);
    })();
  }, [sb, load]);

  // Keep the thread stable if legacy comments refer to a missing parent or contain a cycle.
  const kids = useMemo(() => {
    const ids = new Set(cm.map(c => c.id));
    const parents = new Map<number, number | null>();
    cm.forEach(comment => {
      parents.set(comment.id, comment.parent_id && comment.parent_id !== comment.id && ids.has(comment.parent_id)
        ? comment.parent_id
        : null);
    });

    const complete = new Set<number>();
    for (const comment of cm) {
      const path: number[] = [];
      const positions = new Map<number, number>();
      let current: number | null = comment.id;
      while (current !== null && !complete.has(current)) {
        const cycleStart = positions.get(current);
        if (cycleStart !== undefined) {
          const root = Math.min(...path.slice(cycleStart));
          parents.set(root, null);
          break;
        }
        positions.set(current, path.length);
        path.push(current);
        current = parents.get(current) ?? null;
      }
      path.forEach(id => complete.add(id));
    }

    const map = new Map<number, Cmt[]>();
    cm.forEach(c => {
      const key = parents.get(c.id) ?? 0;
      map.set(key, [...(map.get(key) ?? []), c]);
    });
    return map;
  }, [cm]);
  const countBelow = (id: number): number => {
    const seen = new Set<number>();
    const pending = [...(kids.get(id) ?? [])];
    while (pending.length) {
      const current = pending.pop()!;
      if (seen.has(current.id)) continue;
      seen.add(current.id);
      pending.push(...(kids.get(current.id) ?? []));
    }
    return seen.size;
  };
  const tops = kids.get(0) ?? [];

  const mine = rx.find(x => x.member_id === me)?.kind;
  const likes = rx.filter(x => x.kind === 'like').length;
  const unlikes = rx.filter(x => x.kind === 'unlike').length;

  async function react(kind: 'like' | 'unlike') {
    if (!me) return setNote('Only members can like or comment.');
    if (busy) return;
    setBusy(true);
    const { error } = mine === kind
      ? await sb.from('article_reactions').delete().eq('article_id', articleId).eq('member_id', me)
      : await sb.from('article_reactions').upsert({ article_id: articleId, member_id: me, kind }, { onConflict: 'article_id,member_id' });
    setBusy(false);
    setNote(error ? 'Could not save your reaction. ' + error.message : '');
    load();
  }

  async function post(parent: number | null) {
    if (!me) return setNote('Only members can like or comment.');
    const body = (parent ? replyText : text).trim();
    if (!body) return setNote('Write something first.');
    if (busy) return;
    setBusy(true);
    const { error } = await sb.from('comments').insert({ article_id: articleId, member_id: me, parent_id: parent, body });
    setBusy(false);
    if (error) return setNote('Could not post. ' + error.message);
    playUiSound('success');
    setNote('');
    if (parent) { setReply(null); setReplyText(''); setOpenNodes(s => new Set(s).add(parent)); } else setText('');
    load();
  }
  async function saveEdit(id: number) {
    const body = editText.trim();
    if (!body || busy) return;
    setBusy(true);
    const { error } = await sb.from('comments').update({ body }).eq('id', id);
    setBusy(false);
    if (error) return setNote('Could not save. ' + error.message);
    playUiSound('success');
    setEditId(null); load();
  }
  async function del(id: number) {
    const n = countBelow(id);
    const ok = await confirm({
      title: n ? 'Delete comment and replies?' : 'Delete comment?',
      message: n
        ? `This comment has ${n} repl${n === 1 ? 'y' : 'ies'}. Deleting it also deletes ${n === 1 ? 'that reply' : 'all replies'}. This cannot be undone.`
        : 'Delete this comment? This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const { error } = await sb.from('comments').delete().eq('id', id);
    if (error) setNote('Could not delete. ' + error.message);
    else playUiSound('delete');
    load();
  }
  const toggle = (id: number) => setOpenNodes(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const cancelOn = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Escape') fn(); };

  // One comment, then (when expanded) its replies. A plain function, so typing never loses focus.
  const node = (c: Cmt, depth: number): React.ReactNode => {
    const p = profs[c.member_id];
    const name = p?.full_name ?? 'Member';
    const children = kids.get(c.id) ?? [];
    const expanded = openNodes.has(c.id);
    return (
      <div style={{ marginLeft: Math.min(depth, MAX_INDENT) * 14 }} className={'py-2 ' + (depth ? 'border-l border-gray-200 pl-3' : '')}>
          <div className="flex gap-2">
            <Link href={`/profile?id=${c.member_id}`} aria-label={`View ${name}'s profile`} className="shrink-0"><Avatar name={name} src={p?.avatar_path ? pub(p.avatar_path) : ''} size="h-7 w-7" /></Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <Link href={`/profile?id=${c.member_id}`} className="text-sm font-medium hover:underline">{name}</Link>
                <span className="text-gray-500">{fmt(c.created_at)}</span>
                {me && <button className={link} onClick={() => { setReply(reply === c.id ? null : c.id); setReplyText(''); }}>Reply</button>}
                {me === c.member_id && <button className={link} onClick={() => { setEditId(c.id); setEditText(c.body); }}>Edit</button>}
                {(me === c.member_id || isAdmin) && <button className={link} onClick={() => del(c.id)}>Delete</button>}
              </div>
              {editId === c.id ? (
                <div className="mt-1 flex gap-2">
                  <input className={field} autoFocus value={editText} maxLength={2000} onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(c.id); else cancelOn(() => setEditId(null))(e); }} />
                  <button className={btn} disabled={busy} onClick={() => saveEdit(c.id)}>Save</button>
                  <button className={link} onClick={() => setEditId(null)}>Cancel</button>
                </div>
              ) : <p className="whitespace-pre-line break-words text-sm text-gray-800">{c.body}</p>}
              {reply === c.id && (
                <div className="mt-1 flex gap-2">
                  <input className={field} autoFocus placeholder={`Reply to ${name}`} value={replyText} maxLength={2000} onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') post(c.id); else cancelOn(() => setReply(null))(e); }} />
                  <button className={btn} disabled={busy} onClick={() => post(c.id)}>Reply</button>
                  <button className={link} onClick={() => setReply(null)}>Cancel</button>
                </div>
              )}
              {children.length > 0 && (
                <button className={link + ' mt-0.5'} aria-expanded={expanded} onClick={() => toggle(c.id)}>
                  {expanded ? 'Hide replies' : `View ${countBelow(c.id)} ${countBelow(c.id) === 1 ? 'reply' : 'replies'}`}
                </button>
              )}
            </div>
          </div>
        </div>
    );
  };

  const composer = () => me ? (
    <div className="sticky bottom-0 flex gap-2 border-t border-gray-200 bg-white py-2">
      <input ref={inputRef} className={field} placeholder="Add a comment" value={text} maxLength={2000} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') post(null); }} />
      <button className={btn} disabled={busy} onClick={() => post(null)}>Post</button>
    </div>
  ) : <p className="pt-2 text-sm text-gray-600">Only members can comment. <Link className="underline" href="/join">Become a member</Link></p>;

  const thread = () => {
    const visible: Array<{ comment: Cmt; depth: number }> = [];
    const pending = tops.slice(0, shown).reverse().map(comment => ({ comment, depth: 0 }));
    while (pending.length) {
      const current = pending.pop()!;
      visible.push(current);
      if (openNodes.has(current.comment.id)) {
        const children = kids.get(current.comment.id) ?? [];
        for (let i = children.length - 1; i >= 0; i--) {
          pending.push({ comment: children[i], depth: current.depth + 1 });
        }
      }
    }

    return (
      <div>
        <div className="divide-y divide-gray-100">
          {visible.map(({ comment, depth }) => <div key={comment.id}>{node(comment, depth)}</div>)}
          {tops.length === 0 && !failed && <p className="py-2 text-sm text-gray-500">No comments yet.</p>}
        </div>
        {tops.length > shown && <button className={link + ' mt-1'} onClick={() => setShown(s => s + PAGE)}>Show {Math.min(PAGE, tops.length - shown)} more comments</button>}
        {failed && <p className="py-2 text-sm text-red-700">Could not load comments. <button className="underline" onClick={load}>Try again</button></p>}
        {composer()}
      </div>
    );
  };

  const pill = 'gap-1.5 px-2.5 py-1 text-sm disabled:opacity-60';
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between border-y border-gray-200 py-2">
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => react('like')} aria-pressed={mine === 'like'} className={`button-success ${pill}`}><Icon d={UP} />Like<Badge n={likes} /></button>
          <button disabled={busy} onClick={() => react('unlike')} aria-pressed={mine === 'unlike'} className={`button-danger ${pill}`}><Icon d={DOWN} />Unlike<Badge n={unlikes} /></button>
        </div>
        <button ref={triggerRef} onClick={() => setOpen(true)} className={`button-choice ${pill}`}><Icon d={CHAT} />Comments<Badge n={cm.length} /></button>
      </div>
      {ready && !me && <p className="mt-2 text-sm text-gray-600">Only members can like or comment. <Link className="underline" href="/join">Become a member</Link></p>}
      {note && <p className="mt-2 text-sm text-gray-700">{note}</p>}

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="article-comments-title"
            className="flex max-h-[88vh] w-full max-w-3xl animate-rise-in flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-5">
              <div>
                <h3 id="article-comments-title" className="font-serif text-base font-semibold">Comments</h3>
                <p className="text-xs text-gray-500">{cm.length} {cm.length === 1 ? 'comment' : 'comments'}</p>
              </div>
              <button ref={closeRef} type="button" className="button-neutral px-3 py-1.5 text-xs" onClick={() => setOpen(false)}>Close</button>
            </header>
            <div className="overflow-y-auto px-4 py-2 sm:px-5">
              {thread()}
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        open={!!modalState}
        title={modalState?.title ?? ''}
        message={modalState?.message ?? ''}
        confirmLabel={modalState?.confirmLabel}
        cancelLabel={modalState?.cancelLabel}
        tone={modalState?.tone}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        busy={false}
      />
    </section>
  );
}
