'use client';
import { useCallback, useEffect, useState } from 'react';
import { SB, input, btn, alt, editBtn, dangerBtn, pub, uploadPublic, removePublic } from './shared';
import PhotoField from './PhotoField';
import { EventRow, isUpcoming, feeLabel, safeUrl, localToday } from '@/lib/events';
import { playUiSound } from '@/lib/ui-sound';
import ConfirmModal from '@/components/ConfirmModal';
import { useConfirm } from '@/lib/use-confirm';

const blank = { title: '', venue_date: '', starts_on: '', ends_on: '', description: '', register_url: '', paid: 'free', fee_amount: '' };

export default function EventsTab({ sb }: { sb: SB }) {
  const { confirm, modalState, handleConfirm, handleCancel } = useConfirm();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState(blank);
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [rk, setRk] = useState(0);
  const [editId, setEditId] = useState<number | null>(null);
  const [today, setToday] = useState('');

  const load = useCallback(async () => {
    const { data } = await sb.from('events').select('*').order('id', { ascending: false });
    setRows(data ?? []); setToday(localToday());
  }, [sb]);
  useEffect(() => { load(); }, [load]);

  const current = editId ? rows.find(r => r.id === editId)?.image_path ?? null : null;
  const reset = () => { setEditId(null); setF(blank); setPhoto(null); setRemovePhoto(false); setRk(k => k + 1); };

  function edit(e: EventRow) {
    setEditId(e.id); setPhoto(null); setRemovePhoto(false); setRk(k => k + 1); setMsg('');
    setF({
      title: e.title, venue_date: e.venue_date ?? '', starts_on: e.starts_on ?? '', ends_on: e.ends_on ?? '', description: e.description ?? '',
      register_url: e.register_url ?? '', paid: e.is_paid ? 'paid' : 'free', fee_amount: e.fee_amount != null ? String(e.fee_amount) : '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save() {
    setMsg('');
    if (!f.title.trim()) return setMsg('Enter the event title.');
    if (!f.starts_on) return setMsg('Choose the start date. It decides when the event counts as previous.');
    if (f.ends_on && f.ends_on < f.starts_on) return setMsg('The end date cannot be before the start date.');
    if (f.register_url.trim() && !safeUrl(f.register_url.trim())) return setMsg('The registration link must start with http:// or https://');
    const paid = f.paid === 'paid', fee = Number(f.fee_amount);
    if (paid && (!fee || fee <= 0)) return setMsg('Enter the fee amount for a paid event.');

    setBusy(true);
    const old = current;
    let image_path: string | null | undefined;
    if (photo) {
      const r = await uploadPublic(sb, 'events', photo);
      if (r.error) { setBusy(false); return setMsg('The photo could not be uploaded: ' + r.error); }
      image_path = r.path!;
    } else if (removePhoto) image_path = null;

    const payload: Record<string, unknown> = {
      title: f.title.trim(), venue_date: f.venue_date.trim() || null, starts_on: f.starts_on, ends_on: f.ends_on || null,
      description: f.description.trim() || null, register_url: f.register_url.trim() || null, is_paid: paid, fee_amount: paid ? fee : null,
    };
    if (image_path !== undefined) payload.image_path = image_path;

    const { error } = editId ? await sb.from('events').update(payload).eq('id', editId) : await sb.from('events').insert(payload);
    setBusy(false);
    if (error) return setMsg('Could not save the event: ' + error.message);
    if (editId && image_path !== undefined) await removePublic(sb, old);
    playUiSound('success');
    setMsg(editId ? 'Event updated.' : 'Event added.'); reset(); load();
  }

  async function remove(e: EventRow) {
    const ok = await confirm({
      title: 'Delete event?',
      message: 'This event will be permanently deleted. This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const { error } = await sb.from('events').delete().eq('id', e.id);
    if (error) return setMsg(error.message);
    playUiSound('delete');
    await removePublic(sb, e.image_path); if (editId === e.id) reset(); load();
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">Upcoming events show their fee and a Register Now button. Once an event’s last day has passed, the button and the fee are hidden automatically.</p>
      {msg && <p className="text-sm">{msg}</p>}

      <div className="space-y-2 rounded border border-gray-200 p-4">
        <h2 className="font-medium">{editId ? 'Edit event' : 'Add an event'}</h2>
        <div className="flex flex-wrap gap-2">
          <input className={input + ' flex-1'} placeholder="Event title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
          <input className={input + ' flex-1'} placeholder="Venue and dates, as shown to visitors" value={f.venue_date} onChange={e => setF({ ...f, venue_date: e.target.value })} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label>Starts <input type="date" className={input} value={f.starts_on} onChange={e => setF({ ...f, starts_on: e.target.value })} /></label>
          <label>Ends (if more than one day) <input type="date" className={input} value={f.ends_on} onChange={e => setF({ ...f, ends_on: e.target.value })} /></label>
        </div>
        <textarea className={input + ' w-full'} rows={4} placeholder="Description" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
        <input className={input + ' w-full'} placeholder="Registration link, e.g. https://..." value={f.register_url} onChange={e => setF({ ...f, register_url: e.target.value })} />
        <div className="flex flex-wrap items-center gap-2">
          <select className={input} value={f.paid} onChange={e => setF({ ...f, paid: e.target.value })} aria-label="Free or paid">
            <option value="free">Free</option><option value="paid">Paid</option>
          </select>
          {f.paid === 'paid' && <input className={input + ' w-44'} type="number" min="1" placeholder="Amount in UGX" value={f.fee_amount} onChange={e => setF({ ...f, fee_amount: e.target.value })} />}
        </div>
        <PhotoField sb={sb} current={current} file={photo} setFile={setPhoto} remove={removePhoto} setRemove={setRemovePhoto} resetKey={rk} />
        <div className="flex gap-2">
          <button className={btn} disabled={busy} onClick={save}>{busy ? 'Saving...' : editId ? 'Save changes' : 'Add event'}</button>
          {editId && <button className={alt} onClick={reset}>Cancel</button>}
        </div>
      </div>

      <ul className="divide-y divide-gray-200">
        {rows.map(e => {
          const up = isUpcoming(e, today);
          return (
            <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
              {e.image_path ? <img src={pub(sb, e.image_path)} alt="" className="h-14 w-24 object-cover" /> : <div className="h-14 w-24 bg-gray-100" />}
              <div className="min-w-48 flex-1 text-sm">
                <b>{e.title}</b>
                <div className="text-gray-500">{e.venue_date}</div>
                <div className="text-gray-500">{e.starts_on ?? 'No date'}{e.ends_on ? ` to ${e.ends_on}` : ''} · {feeLabel(e)}{e.register_url ? ' · Link set' : ''}</div>
              </div>
              <span className={'text-sm ' + (up ? 'text-green-700' : 'text-gray-500')}>{today ? (up ? 'Upcoming' : 'Previous') : ''}</span>
              <button className={editBtn} onClick={() => edit(e)}>Edit</button>
              <button className={dangerBtn} onClick={() => remove(e)}>Delete</button>
            </li>
          );
        })}
        {rows.length === 0 && <li className="py-3 text-sm text-gray-500">No events yet.</li>}
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
