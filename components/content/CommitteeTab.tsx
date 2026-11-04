'use client';
import { useCallback, useEffect, useState } from 'react';
import { SB, input, btn, alt, editBtn, dangerBtn, pub, uploadPublic, removePublic } from './shared';
import PhotoField from './PhotoField';
import { playUiSound } from '@/lib/ui-sound';
import ConfirmModal from '@/components/ConfirmModal';
import { useConfirm } from '@/lib/use-confirm';

type Term = { id: number; starts_on: string; ends_on: string | null };
type Mem = { id: number; term_id: number; role: string; full_name: string; email: string; phone: string | null; workplace: string | null; photo_path: string | null; message: string | null; sort: number };
const blank = { term: '', role: '', full_name: '', email: '', phone: '', workplace: '', message: '' };

export default function CommitteeTab({ sb }: { sb: SB }) {
  const { confirm, modalState, handleConfirm, handleCancel } = useConfirm();
  const [terms, setTerms] = useState<Term[]>([]);
  const [mems, setMems] = useState<Mem[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [newStart, setNewStart] = useState('');
  const [f, setF] = useState(blank);
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [rk, setRk] = useState(0);
  const [editId, setEditId] = useState<number | null>(null);
  const [editTerm, setEditTerm] = useState<Term | null>(null);

  const load = useCallback(async () => {
    const [t, m] = await Promise.all([
      sb.from('committee_terms').select('*').order('starts_on', { ascending: false }),
      sb.from('committee').select('*').order('sort').order('id'),
    ]);
    setTerms(t.data ?? []); setMems(m.data ?? []);
    setF(x => x.term ? x : { ...x, term: String((t.data ?? []).find((r: Term) => !r.ends_on)?.id ?? (t.data ?? [])[0]?.id ?? '') });
  }, [sb]);
  useEffect(() => { load(); }, [load]);

  const current = editId ? mems.find(m => m.id === editId)?.photo_path ?? null : null;
  const resetForm = () => { setEditId(null); setF(x => ({ ...blank, term: x.term })); setPhoto(null); setRemovePhoto(false); setRk(k => k + 1); };

  // ---- Terms ----
  async function startTerm() {
    setMsg('');
    if (!newStart) return setMsg('Choose the date the new term starts.');
    const ok = await confirm({
      title: 'Start a new committee term?',
      message: `Start a new term on ${newStart}? The current committee becomes the previous committee.`,
      confirmLabel: 'Start term',
      tone: 'neutral',
    });
    if (!ok) return;
    const { data, error } = await sb.rpc('start_new_term', { p_start: newStart });
    if (error) return setMsg(error.message);
    playUiSound('success');
    setNewStart(''); setF(x => ({ ...x, term: String(data) })); setMsg('New term started. Add its members below.'); load();
  }
  async function saveTerm() {
    if (!editTerm) return;
    if (!editTerm.starts_on) return setMsg('A term needs a start date.');
    if (editTerm.ends_on && editTerm.ends_on < editTerm.starts_on) return setMsg('The end date cannot be before the start date.');
    const { error } = await sb.from('committee_terms').update({ starts_on: editTerm.starts_on, ends_on: editTerm.ends_on || null }).eq('id', editTerm.id);
    if (error) return setMsg('Could not save the term: ' + error.message);
    playUiSound('success');
    setEditTerm(null); setMsg('Term updated.'); load();
  }
  async function deleteTerm(t: Term) {
    const list = mems.filter(m => m.term_id === t.id);
    const ok = await confirm({
      title: 'Delete committee term?',
      message: `Delete the term ${t.starts_on} to ${t.ends_on ?? 'present'} and its ${list.length} member(s)? This cannot be undone.`,
      confirmLabel: 'Delete term',
      tone: 'danger',
    });
    if (!ok) return;
    await Promise.all(list.map(m => removePublic(sb, m.photo_path)));
    const { error } = await sb.from('committee_terms').delete().eq('id', t.id);
    if (!error) playUiSound('delete');
    setMsg(error ? 'Could not delete the term: ' + error.message : 'Term deleted.'); load();
  }

  // ---- Members ----
  function edit(m: Mem) {
    setEditId(m.id); setPhoto(null); setRemovePhoto(false); setRk(k => k + 1); setMsg('');
    setF({ term: String(m.term_id), role: m.role, full_name: m.full_name, email: m.email, phone: m.phone ?? '', workplace: m.workplace ?? '', message: m.message ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function save() {
    setMsg('');
    if (!f.term) return setMsg('Choose a term.');
    if (!f.role.trim() || !f.full_name.trim()) return setMsg('Enter the role and the full name.');
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setMsg('Enter the member’s Google account email.');
    setBusy(true);
    const old = current;
    let photo_path: string | null | undefined;           // undefined means unchanged
    if (photo) {
      const r = await uploadPublic(sb, 'committee', photo);
      if (r.error) { setBusy(false); return setMsg('The photo could not be uploaded: ' + r.error); }
      photo_path = r.path!;
    } else if (removePhoto) photo_path = null;

    const payload: Record<string, unknown> = {
      term_id: Number(f.term), role: f.role.trim(), full_name: f.full_name.trim(), email: f.email.trim().toLowerCase(),
      phone: f.phone.trim() || null, workplace: f.workplace.trim() || null, message: f.message.trim() || null,
    };
    if (photo_path !== undefined) payload.photo_path = photo_path;
    if (!editId) payload.sort = mems.filter(m => m.term_id === Number(f.term)).length;

    const { error } = editId ? await sb.from('committee').update(payload).eq('id', editId) : await sb.from('committee').insert(payload);
    setBusy(false);
    if (error) return setMsg('Could not save: ' + error.message);
    playUiSound('success');
    if (editId && photo_path !== undefined) await removePublic(sb, old);   // clear the replaced photo
    setMsg(editId ? 'Member updated.' : 'Member added.'); resetForm(); load();
  }
  async function remove(m: Mem) {
    const ok = await confirm({
      title: 'Remove committee member?',
      message: `Remove ${m.full_name} from the committee?`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    const { error } = await sb.from('committee').delete().eq('id', m.id);
    if (error) return setMsg('Could not remove: ' + error.message);
    playUiSound('delete');
    await removePublic(sb, m.photo_path); if (editId === m.id) resetForm(); load();
  }
  async function move(termId: number, id: number, d: number) {
    const list = mems.filter(m => m.term_id === termId);
    const i = list.findIndex(m => m.id === id), j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const results = await Promise.all(list.map((m, k) => sb.from('committee').update({ sort: k }).eq('id', m.id)));
    const failed = results.find(result => result.error)?.error;
    if (failed) return setMsg('Could not reorder committee members: ' + failed.message);
    playUiSound('success');
    load();
  }

  const ini = (n: string) => n.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();

  return (
    <div className="space-y-8">
      <p className="text-sm text-gray-600">Each committee serves a period. The current committee is the term with no end date. Visitors see the current committee and the most recent previous one. Every term stays here.</p>
      {msg && <p className="text-sm text-gray-800">{msg}</p>}

      <div className="rounded border border-gray-200 p-4">
        <h2 className="font-medium">Start a new term</h2>
        <p className="mt-1 text-sm text-gray-600">The current term ends the day before the new one starts.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input type="date" className={input} value={newStart} onChange={e => setNewStart(e.target.value)} aria-label="New term start date" />
          <button className={btn} onClick={startTerm}>Start new term</button>
        </div>
      </div>

      <div className="rounded border border-gray-200 p-4">
        <h2 className="font-medium">{editId ? 'Edit committee member' : 'Add a committee member'}</h2>
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            <select className={input} value={f.term} onChange={e => setF({ ...f, term: e.target.value })}>
              {terms.map(t => <option key={t.id} value={t.id}>{t.starts_on} to {t.ends_on ?? 'present'}</option>)}
            </select>
            <input className={input + ' flex-1'} placeholder="Role, e.g. President" value={f.role} onChange={e => setF({ ...f, role: e.target.value })} />
            <input className={input + ' flex-1'} placeholder="Full name" value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <input className={input + ' flex-1'} type="email" placeholder="Google account email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
            <input className={input} placeholder="Phone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
            <input className={input + ' flex-1'} placeholder="Workplace and qualification" value={f.workplace} onChange={e => setF({ ...f, workplace: e.target.value })} />
          </div>
          <label className="block text-xs font-medium text-gray-700">
            Message for the public committee card
            <textarea className={input + ' mt-1 w-full'} rows={3} maxLength={500} placeholder="A short message about your work or vision for the profession" value={f.message} onChange={e => setF({ ...f, message: e.target.value })} />
            <span className="mt-1 block text-right font-normal text-gray-500">{f.message.length}/500</span>
          </label>
          <PhotoField sb={sb} current={current} file={photo} setFile={setPhoto} remove={removePhoto} setRemove={setRemovePhoto} resetKey={rk} round />
          <div className="flex gap-2">
            <button className={btn} disabled={busy} onClick={save}>{busy ? 'Saving...' : editId ? 'Save changes' : 'Add member'}</button>
            {editId && <button className={alt} onClick={resetForm}>Cancel</button>}
          </div>
          <p className="text-sm text-gray-500">Email and phone are kept private. Visitors see the portrait, name, role and message.</p>
        </div>
      </div>

      {terms.map(t => {
        const list = mems.filter(m => m.term_id === t.id);
        return (
          <div key={t.id}>
            {editTerm?.id === t.id ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label>Starts <input type="date" className={input} value={editTerm.starts_on} onChange={e => setEditTerm({ ...editTerm, starts_on: e.target.value })} /></label>
                <label>Ends <input type="date" className={input} value={editTerm.ends_on ?? ''} onChange={e => setEditTerm({ ...editTerm, ends_on: e.target.value || null })} /></label>
                <button className={btn} onClick={saveTerm}>Save term</button>
                <button className={alt} onClick={() => setEditTerm(null)}>Cancel</button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-serif text-lg font-semibold">{t.starts_on} to {t.ends_on ?? 'present'}</h2>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600">{list.length} {list.length === 1 ? 'member' : 'members'}</span>
                {!t.ends_on && <span className="rounded border border-green-700 px-2 text-xs text-green-700">Current</span>}
                <button className={editBtn} onClick={() => setEditTerm(t)}>Edit dates</button>
                <button className={dangerBtn} onClick={() => deleteTerm(t)}>Delete term</button>
              </div>
            )}
            <ul className="mt-2 divide-y divide-gray-200">
              {list.map((m, i) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-2">
                  {m.photo_path
                    ? <img src={pub(sb, m.photo_path)} alt="" className="h-12 w-12 rounded-full object-cover" />
                    : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-800 text-sm font-semibold text-white">{ini(m.full_name)}</span>}
                  <div className="min-w-48 flex-1 text-sm"><b>{m.full_name}</b>, {m.role}<div className="text-gray-500">{m.email}{m.phone ? `, ${m.phone}` : ''}</div>{m.message && <div className="mt-1 line-clamp-2 text-gray-600">{m.message}</div>}</div>
                  <button className={alt} disabled={i === 0} onClick={() => move(t.id, m.id, -1)}>Up</button>
                  <button className={alt} disabled={i === list.length - 1} onClick={() => move(t.id, m.id, 1)}>Down</button>
                  <button className={editBtn} onClick={() => edit(m)}>Edit</button>
                  <button className={dangerBtn} onClick={() => remove(m)}>Remove</button>
                </li>
              ))}
              {list.length === 0 && <li className="py-2 text-sm text-gray-500">No members yet.</li>}
            </ul>
          </div>
        );
      })}
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
