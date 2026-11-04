'use client';
import { useCallback, useEffect, useState } from 'react';
import { SB, input, btn, alt, editBtn, successBtn, dangerBtn, pub, uploadPublic, removePublic } from 
'./shared';
import PhotoField from './PhotoField';
import { playUiSound } from '@/lib/ui-sound';

type Art = { id: number; title: string; body: string; image_path: string | null; status: string; created_at: string; author_id: string | null; decline_reason: string | null; author_name: string | null };
const LABEL: Record<string, [string, string]> = { approved: ['Published', 'text-green-700'], pending: ['Awaiting approval', 'text-amber-700'], declined: ['Declined', 'text-red-700'] };

export default function ArticlesTab({ sb }: { sb: SB }) {
  const [rows, setRows] = useState<Art[]>([]);
  const [filter, setFilter] = useState('all');
  const [why, setWhy] = useState<Record<number, string>>({});
  const [f, setF] = useState({ title: '', body: '' });
  const [photo, setPhoto] = useState<File | null>(null);
  const [remove, setRemove] = useState(false);
  const [rk, setRk] = useState(0);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await sb.from('articles')
      .select('id,title,body,image_path,status,created_at,author_id,decline_reason')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Articles load failed:', error);
      setMsg(`Could not load articles: ${error.message}`);
      return;
    }

    const authorIds = Array.from(new Set((data ?? []).map(article => article.author_id).filter((id): id is string => !!id)));
    let names = new Map<string, string>();
    if (authorIds.length) {
      const { data: members, error: membersError } = await sb.from('members').select('id,full_name').in('id', authorIds);
      if (membersError) {
        console.error('Article author lookup failed:', membersError);
        setMsg(`Articles loaded, but author names could not be fetched: ${membersError.message}`);
      } else {
        names = new Map((members ?? []).map(member => [member.id, member.full_name]));
        setMsg('');
      }
    } else {
      setMsg('');
    }
    setRows((data ?? []).map(article => ({
      ...article,
      author_name: article.author_id ? names.get(article.author_id) ?? null : null,
    })));
  }, [sb]);
  useEffect(() => { load(); }, [load]);

  const editing = editId ? rows.find(r => r.id === editId) : undefined;
  const reset = () => { setEditId(null); setF({ title: '', body: '' }); setPhoto(null); setRemove(false); setRk(k => k + 1); };
  const author = (a: Art) => a.author_id ? a.author_name ?? 'Member author' : 'SRU Secretariat';

  function edit(a: Art) {
    setEditId(a.id); setF({ title: a.title, body: a.body }); setPhoto(null); setRemove(false); setRk(k => k + 1); setMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function setStatus(a: Art, status: string, reason: string | null = null) {
    const { error } = await sb.from('articles').update({ status, decline_reason: reason }).eq('id', a.id);
    if (!error) playUiSound('success');
    setMsg(error ? 'Could not update: ' + error.message : '');
    load();
  }
  function decline(a: Art) {
    const reason = (why[a.id] ?? '').trim();
    if (!reason) return setMsg('Write a reason before declining, so the author knows what to change.');
    setStatus(a, 'declined', reason);
  }

  async function save() {
    setMsg('');
    if (!f.title.trim() || !f.body.trim()) return setMsg('Enter a title and the article text.');
    setBusy(true);
    const old = editing?.image_path ?? null;
    let image_path: string | null | undefined;
    if (photo) {
      const r = await uploadPublic(sb, 'articles', photo);
      if (r.error) { setBusy(false); return setMsg('The photo could not be uploaded: ' + r.error); }
      image_path = r.path!;
    } else if (remove) image_path = null;

    const payload: Record<string, unknown> = { title: f.title.trim(), body: f.body.trim() };
    if (image_path !== undefined) payload.image_path = image_path;
    if (!editId) Object.assign(payload, { author_id: null, status: 'approved' });   // posted as the Secretariat

    const { error } = editId ? await sb.from('articles').update(payload).eq('id', editId) : await sb.from('articles').insert(payload);
    setBusy(false);
    if (error) return setMsg('Could not save: ' + error.message);
    if (editId && image_path !== undefined) await removePublic(sb, old);
    playUiSound('success');
    setMsg(editId ? 'Article updated.' : 'Article published.'); reset(); load();
  }

  async function del(a: Art) {
    if (!confirm('Delete this article?')) return;
    const { error } = await sb.from('articles').delete().eq('id', a.id);
    if (error) return setMsg('Could not delete: ' + error.message);
    playUiSound('delete');
    await removePublic(sb, a.image_path); if (editId === a.id) reset(); load();
  }

  const count = (s: string) => rows.filter(r => r.status === s).length;
  const shown = rows.filter(r => filter === 'all' || r.status === filter);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">Member articles are shown to visitors only after you approve them. Articles you post here appear as the Secretariat and are published straight away.</p>
      {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}

      <div className="space-y-2 rounded border border-gray-200 p-4">
        <h2 className="font-medium">{editId ? 'Edit article' : 'Post an article as the Secretariat'}</h2>
        <input className={input + ' w-full'} placeholder="Title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
        <textarea className={input + ' w-full'} rows={8} placeholder="Article text" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} />
        <PhotoField sb={sb} current={editing?.image_path ?? null} file={photo} setFile={setPhoto} remove={remove} setRemove={setRemove} resetKey={rk} />
        <div className="flex gap-2">
          <button className={btn} disabled={busy} onClick={save}>{busy ? 'Saving...' : editId ? 'Save changes' : 'Publish'}</button>
          {editId && <button className={alt} onClick={reset}>Cancel</button>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {[['all', `All (${rows.length})`], ['pending', `Awaiting approval (${count('pending')})`], ['approved', `Published (${count('approved')})`], ['declined', `Declined (${count('declined')})`]].map(([k, l]) => (
          <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)} className="button-choice px-3 py-1 text-sm">{l}</button>
        ))}
      </div>

      <ul className="divide-y divide-gray-200">
        {shown.map(a => {
          const [label, cls] = LABEL[a.status] ?? [a.status, ''];
          return (
            <li key={a.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                {a.image_path ? <img src={pub(sb, a.image_path)} alt="" className="h-14 w-24 object-cover" /> : <div className="h-14 w-24 bg-gray-100" />}
                <div className="min-w-48 flex-1 text-sm"><b>{a.title}</b><div className="text-gray-500">{author(a)} · <span className={cls}>{label}</span></div></div>
                {a.status === 'approved' && <button className={alt} onClick={() => setStatus(a, 'pending')}>Unpublish</button>}
                <button className={editBtn} onClick={() => edit(a)}>Edit</button>
                <button className={dangerBtn} onClick={() => del(a)}>Delete</button>
              </div>
              {a.status === 'pending' && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button className={successBtn} onClick={() => setStatus(a, 'approved')}>Approve</button>
                  <input className={input + ' w-64'} placeholder="Reason for declining" value={why[a.id] ?? ''} onChange={e => setWhy({ ...why, [a.id]: e.target.value })} />
                  <button className={dangerBtn} onClick={() => decline(a)}>Decline</button>
                </div>
              )}
              {a.decline_reason && <div className="mt-1 text-sm text-gray-600">Reason: {a.decline_reason}</div>}
            </li>
          );
        })}
        {shown.length === 0 && <li className="py-3 text-sm text-gray-500">Nothing here.</li>}
      </ul>
    </div>
  );
}
