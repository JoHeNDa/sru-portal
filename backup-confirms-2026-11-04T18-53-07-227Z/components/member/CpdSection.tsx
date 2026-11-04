'use client';
import { useCallback, useEffect, useState } from 'react';
import { SB, input, btn, alt, editBtn, dangerBtn, tag, uploadProof, removeProof, viewProof } from './shared';
import { playUiSound } from '@/lib/ui-sound';
import WaveCard from '@/components/WaveCard';

type Cpd = { id: string; title: string; points: number; year: number; status: string; rejection_reason: string | null; proof_path: string | null; added_by_staff: boolean };

export default function CpdSection({ sb, memberId, min }: { sb: SB; memberId: string; min: number }) {
  const [rows, setRows] = useState<Cpd[]>([]);
  const [year, setYear] = useState(0);
  const [f, setF] = useState({ title: '', points: '' });
  const [file, setFile] = useState<File | null>(null);
  const [rk, setRk] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await sb.from('cpd_entries').select('id,title,points,year,status,rejection_reason,proof_path,added_by_staff').eq('member_id', memberId).order('created_at', { ascending: false });
    setRows(data ?? []); setYear(new Date().getFullYear());
  }, [sb, memberId]);
  useEffect(() => { load(); }, [load]);

  const editing = editId ? rows.find(r => r.id === editId) : undefined;
  const reset = () => { setEditId(null); setF({ title: '', points: '' }); setFile(null); setRk(k => k + 1); };
  const locked = (r: Cpd) => r.status === 'verified' || r.added_by_staff;

  function edit(r: Cpd) {
    setEditId(r.id); setF({ title: r.title, points: String(r.points) }); setFile(null); setRk(k => k + 1); setMsg('');
  }

  async function save() {
    setMsg('');
    const points = Number(f.points);
    if (!f.title.trim() || !points || points < 1) return setMsg('Enter the activity title and the points claimed.');
    if (!editId && !file) return setMsg('Attach your certificate as proof.');
    setBusy(true);
    let proof_path: string | undefined;
    if (file) {
      const r = await uploadProof(sb, memberId, file);
      if (r.error) { setBusy(false); return setMsg('The certificate could not be uploaded: ' + r.error); }
      proof_path = r.path;
    }
    const payload: Record<string, unknown> = { title: f.title.trim(), points };
    if (proof_path) payload.proof_path = proof_path;
    if (editId) Object.assign(payload, { status: 'pending', rejection_reason: null, reviewed_by: null });   // an edited entry is checked again
    else payload.member_id = memberId;

    const { error } = editId ? await sb.from('cpd_entries').update(payload).eq('id', editId) : await sb.from('cpd_entries').insert(payload);
    setBusy(false);
    if (error) return setMsg('Could not save the entry: ' + error.message);
    playUiSound('success');
    if (editId && proof_path) await removeProof(sb, editing?.proof_path);
    setMsg(editId ? 'Updated. It will be checked again.' : 'Submitted. It counts once a coordinator verifies it.'); reset(); load();
  }

  async function remove(r: Cpd) {
    if (!confirm('Delete this CPD entry?')) return;
    const { error } = await sb.from('cpd_entries').delete().eq('id', r.id);
    if (error) return setMsg('Could not delete: ' + error.message);
    playUiSound('delete');
    await removeProof(sb, r.proof_path); if (editId === r.id) reset(); load();
  }

  const pts = rows.filter(c => c.status === 'verified' && c.year === year).reduce((a, c) => a + c.points, 0);
  const total = rows.filter(c => c.status === 'verified').reduce((a, c) => a + c.points, 0);

  return (
    <section>
      <h2 className="text-xl font-semibold">CPD points</h2>
      <p className="mt-1">{pts}{min ? ` of ${min}` : ''} verified points in {year || ''}. All years: {total}. Points restart each year.</p>
      {min > 0 && <div className="mt-2 h-2 border border-gray-300"><div className="h-full bg-teal-800" style={{ width: `${Math.min(100, (pts / min) * 100)}%` }} /></div>}

      <WaveCard className="mt-4 space-y-2 rounded border border-gray-200 p-4">
        <h3 className="font-medium">{editId ? 'Edit CPD activity' : 'Submit a CPD activity'}</h3>
        <div className="flex flex-wrap gap-2">
          <input className={input + ' flex-1'} placeholder="Activity title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
          <input className={input + ' w-32'} type="number" min="1" placeholder="Points" value={f.points} onChange={e => setF({ ...f, points: e.target.value })} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label>{editId ? 'Replace certificate (optional)' : 'Certificate'} <input key={rk} type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
          <button className={btn} disabled={busy} onClick={save}>{busy ? 'Saving...' : editId ? 'Save changes' : 'Submit for verification'}</button>
          {editId && <button className={alt} onClick={reset}>Cancel</button>}
        </div>
        {msg && <p className="text-sm text-gray-700">{msg}</p>}
      </WaveCard>

      <ul className="mt-4 divide-y divide-gray-200">
        {rows.map((c, index) => (
          <li key={c.id}>
            <WaveCard index={index} className="py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-48 flex-1">{c.title} ({c.year}), {c.points} points. <span className={tag(c.status)}>{c.status}</span></div>
              {c.proof_path && <button className={alt} onClick={() => viewProof(sb, c.proof_path)}>View certificate</button>}
              {!locked(c) && <button className={editBtn} onClick={() => edit(c)}>Edit</button>}
              {!locked(c) && <button className={dangerBtn} onClick={() => remove(c)}>Delete</button>}
            </div>
            {c.rejection_reason && <div className="text-sm text-gray-600">Reason: {c.rejection_reason}</div>}
            {locked(c) && <div className="text-sm text-gray-500">Verified entries are locked. Contact the Society to correct one.</div>}
            </WaveCard>
          </li>
        ))}
      </ul>
    </section>
  );
}
