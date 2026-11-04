'use client';
import { useCallback, useEffect, useState } from 'react';
import { SB, input, btn, alt, editBtn, dangerBtn, pub, uploadPublic, removePublic } from './shared';
import PhotoField from './PhotoField';
import { playUiSound } from '@/lib/ui-sound';
import ConfirmModal from '@/components/ConfirmModal';
import { useConfirm } from '@/lib/use-confirm';

type Slide = { id: number; headline: string; body: string | null; button_label: string | null; button_href: string | null; image_path: string | null; sort: number; live: boolean };
const blank = { headline: '', body: '', button_label: '', button_href: '' };

export default function HeroTab({ sb }: { sb: SB }) {
  const { confirm, modalState, handleConfirm, handleCancel } = useConfirm();
  const [rows, setRows] = useState<Slide[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState(blank);
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [rk, setRk] = useState(0);
  const [editId, setEditId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data } = await sb.from('hero_slides').select('*').order('sort').order('id');
    setRows(data ?? []);
  }, [sb]);
  useEffect(() => { load(); }, [load]);

  const current = editId ? rows.find(r => r.id === editId)?.image_path ?? null : null;
  const reset = () => { setEditId(null); setF(blank); setPhoto(null); setRemovePhoto(false); setRk(k => k + 1); };

  function edit(s: Slide) {
    setEditId(s.id); setPhoto(null); setRemovePhoto(false); setRk(k => k + 1); setMsg('');
    setF({ headline: s.headline, body: s.body ?? '', button_label: s.button_label ?? '', button_href: s.button_href ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save() {
    setMsg('');
    if (!f.headline.trim()) return setMsg('Enter a headline.');
    setBusy(true);
    const old = current;
    let image_path: string | null | undefined;
    if (photo) {
      const r = await uploadPublic(sb, 'hero', photo);
      if (r.error) { setBusy(false); return setMsg('The photo could not be uploaded: ' + r.error); }
      image_path = r.path!;
    } else if (removePhoto) image_path = null;

    const payload: Record<string, unknown> = {
      headline: f.headline.trim(), body: f.body.trim() || null,
      button_label: f.button_label.trim() || null, button_href: f.button_href.trim() || null,
    };
    if (image_path !== undefined) payload.image_path = image_path;
    if (!editId) { payload.sort = rows.length + 1; payload.live = true; }

    const { error } = editId ? await sb.from('hero_slides').update(payload).eq('id', editId) : await sb.from('hero_slides').insert(payload);
    setBusy(false);
    if (error) return setMsg('Could not save the slide: ' + error.message);
    if (editId && image_path !== undefined) await removePublic(sb, old);
    playUiSound('success');
    setMsg(editId ? 'Slide updated.' : 'Slide added.'); reset(); load();
  }

  async function toggle(s: Slide) {
    const { error } = await sb.from('hero_slides').update({ live: !s.live }).eq('id', s.id);
    if (error) setMsg(error.message);
    else playUiSound('success');
    load();
  }
  async function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const order = rows.slice(); [order[i], order[j]] = [order[j], order[i]];
    const results = await Promise.all(order.map((s, k) => sb.from('hero_slides').update({ sort: k + 1 }).eq('id', s.id)));
    const failed = results.find(result => result.error)?.error;
    if (failed) return setMsg('Could not reorder the slides: ' + failed.message);
    playUiSound('success');
    load();
  }
  async function remove(s: Slide) {
    const ok = await confirm({
      title: 'Delete slide?',
      message: 'This slide will be removed from the homepage. This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const { error } = await sb.from('hero_slides').delete().eq('id', s.id);
    if (error) return setMsg(error.message);
    playUiSound('delete');
    await removePublic(sb, s.image_path); if (editId === s.id) reset(); load();
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">Slides appear on the landing page in this order. Hidden slides stay here but are not shown to visitors.</p>
      {msg && <p className="text-sm">{msg}</p>}

      <div className="space-y-2 rounded border border-gray-200 p-4">
        <h2 className="font-medium">{editId ? 'Edit slide' : 'Add a slide'}</h2>
        <div className="flex flex-wrap gap-2">
          <input className={input + ' flex-1'} placeholder="Headline" value={f.headline} onChange={e => setF({ ...f, headline: e.target.value })} />
          <input className={input + ' flex-1'} placeholder="Short text" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <input className={input + ' flex-1'} placeholder="Button label" value={f.button_label} onChange={e => setF({ ...f, button_label: e.target.value })} />
          <input className={input + ' flex-1'} placeholder="Button link, e.g. /join" value={f.button_href} onChange={e => setF({ ...f, button_href: e.target.value })} />
        </div>
        <PhotoField sb={sb} current={current} file={photo} setFile={setPhoto} remove={removePhoto} setRemove={setRemovePhoto} resetKey={rk} />
        <div className="flex gap-2">
          <button className={btn} disabled={busy} onClick={save}>{busy ? 'Saving...' : editId ? 'Save changes' : 'Add slide'}</button>
          {editId && <button className={alt} onClick={reset}>Cancel</button>}
        </div>
      </div>

      <ul className="divide-y divide-gray-200">
        {rows.map((s, i) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
            {s.image_path ? <img src={pub(sb, s.image_path)} alt="" className="h-14 w-24 object-cover" /> : <div className="h-14 w-24 bg-gray-100" />}
            <div className="min-w-48 flex-1 text-sm"><b>{s.headline}</b><div className="text-gray-500">{s.button_label ? `Button: ${s.button_label}` : 'No button'}</div></div>
            <span className={'text-sm ' + (s.live ? 'text-green-700' : 'text-amber-700')}>{s.live ? 'Live' : 'Hidden'}</span>
            <button className="button-choice px-3 py-1.5" aria-pressed={s.live} onClick={() => toggle(s)}>{s.live ? 'Hide' : 'Show'}</button>
            <button className={alt} disabled={i === 0} onClick={() => move(i, -1)}>Up</button>
            <button className={alt} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>Down</button>
            <button className={editBtn} onClick={() => edit(s)}>Edit</button>
            <button className={dangerBtn} onClick={() => remove(s)}>Delete</button>
          </li>
        ))}
        {rows.length === 0 && <li className="py-3 text-sm text-gray-500">No slides yet.</li>}
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
    </div>
  );
}
