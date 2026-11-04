'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { SB, input, btn, alt, editBtn, dangerBtn } from './shared';
import PhotoField from '@/components/content/PhotoField';
import { uploadPublic, removePublic } from '@/components/content/shared';
import WaveCard from '@/components/WaveCard';
import ConfirmModal from '@/components/ConfirmModal';
import { useConfirm } from '@/lib/use-confirm';

type Art = { id: number; title: string; body: string; image_path: string | null; status: string; decline_reason: string | null };
const LABEL: Record<string, [string, string]> = { approved: ['Published', 'text-green-700'], pending: ['Awaiting approval', 'text-amber-700'], declined: ['Declined', 'text-red-700'] };

// Members write articles here. An article is shown publicly only after an admin approves it.
export default function ArticlesSection({ sb, memberId }: { sb: SB; memberId: string }) {
  const { confirm, modalState, handleConfirm, handleCancel } = useConfirm();
  const [rows, setRows] = useState<Art[]>([]);
  const [f, setF] = useState({ title: '', body: '' });
  const [photo, setPhoto] = useState<File | null>(null);
  const [remove, setRemove] = useState(false);
  const [rk, setRk] = useState(0);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await sb.from('articles').select('id,title,body,image_path,status,decline_reason').eq('author_id', memberId).order('created_at', { ascending: false });
    setRows(data ?? []);
  }, [sb, memberId]);
  useEffect(() => { load(); }, [load]);

  const editing = editId ? rows.find(r => r.id === editId) : undefined;
  const reset = () => { setEditId(null); setF({ title: '', body: '' }); setPhoto(null); setRemove(false); setRk(k => k + 1); };

  function edit(a: Art) {
    setEditId(a.id); setF({ title: a.title, body: a.body }); setPhoto(null); setRemove(false); setRk(k => k + 1); setMsg('');
  }

  async function save() {
    setMsg('');
    if (!f.title.trim() || !f.body.trim()) return setMsg('Enter a title and the article text.');
    if (editing?.status === 'approved') {
      const ok = await confirm({
        title: 'Resubmit for approval?',
        message: 'Saving sends this article for approval again, and it is hidden from visitors until it is approved. Continue?',
        confirmLabel: 'Resubmit',
        tone: 'neutral',
      });
      if (!ok) return;
    }
    setBusy(true);
    const old = editing?.image_path ?? null;
    let image_path: string | null | undefined;
    if (photo) {
      const r = await uploadPublic(sb, memberId, photo);
      if (r.error) { setBusy(false); return setMsg('The photo could not be uploaded: ' + r.error); }
      image_path = r.path!;
    } else if (remove) image_path = null;

    const payload: Record<string, unknown> = { title: f.title.trim(), body: f.body.trim(), status: 'pending', decline_reason: null };
    if (image_path !== undefined) payload.image_path = image_path;
    if (!editId) payload.author_id = memberId;

    const { error } = editId ? await sb.from('articles').update(payload).eq('id', editId) : await sb.from('articles').insert(payload);
    setBusy(false);
    if (error) return setMsg('Could not save the article: ' + error.message);
    if (editId && image_path !== undefined) await removePublic(sb, old);
    setMsg('Saved. It will appear on the site once an admin approves it.'); reset(); load();
  }

  async function del(a: Art) {
    const ok = await confirm({
      title: 'Delete article?',
      message: 'This article will be permanently deleted. This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const { error } = await sb.from('articles').delete().eq('id', a.id);
    if (error) return setMsg('Could not delete: ' + error.message);
    await removePublic(sb, a.image_path); if (editId === a.id) reset(); load();
  }

  return (
    <section>
      <h2 className="text-xl font-semibold">My articles</h2>
      <p className="mt-1 text-gray-600">Articles appear on the site only after an admin approves them. Your name and photo are shown as the author.</p>

      <WaveCard className="mt-4 space-y-2 rounded border border-gray-200 p-4">
        <h3 className="font-medium">{editId ? 'Edit article' : 'Write an article'}</h3>
        <input className={input + ' w-full'} placeholder="Title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
        <textarea className={input + ' w-full'} rows={8} placeholder="Your article" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} />
        <PhotoField sb={sb} current={editing?.image_path ?? null} file={photo} setFile={setPhoto} remove={remove} setRemove={setRemove} resetKey={rk} />
        <div className="flex gap-2">
          <button className={btn} disabled={busy} onClick={save}>{busy ? 'Saving...' : editId ? 'Save changes' : 'Submit for approval'}</button>
          {editId && <button className={alt} onClick={reset}>Cancel</button>}
        </div>
        {msg && <p className="text-sm text-gray-700">{msg}</p>}
      </WaveCard>

      <ul className="mt-4 divide-y divide-gray-200">
        {rows.map((a, index) => {
          const [label, cls] = LABEL[a.status] ?? [a.status, ''];
          return (
            <li key={a.id}>
              <WaveCard index={index} className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-48 flex-1"><b>{a.title}</b> <span className={'text-sm ' + cls}>{label}</span></div>
                {a.status === 'approved' && <Link className={alt} href={`/article?id=${a.id}`}>View</Link>}
                <button className={editBtn} onClick={() => edit(a)}>Edit</button>
                <button className={dangerBtn} onClick={() => del(a)}>Delete</button>
              </div>
              {a.decline_reason && <div className="text-sm text-gray-600">Reason: {a.decline_reason}</div>}
              </WaveCard>
            </li>
          );
        })}
        {rows.length === 0 && <li className="py-3 text-sm text-gray-500">You have not written any articles yet.</li>}
      </ul>
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
