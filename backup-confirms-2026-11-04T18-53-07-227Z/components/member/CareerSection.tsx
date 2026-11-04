'use client';
import { useCallback, useEffect, useState } from 'react';
import { SB, input, btn, alt, editBtn, dangerBtn, tag, uploadProof, removeProof, viewProof } from './shared';
import { playUiSound } from '@/lib/ui-sound';
import WaveCard from '@/components/WaveCard';

type Car = { id: string; kind: string; organisation: string; title: string; from_year: number; to_year: number | null; status: string; rejection_reason: string | null; proof_path: string | null };
const blank = { kind: 'education', organisation: '', title: '', from_year: '', to_year: '' };

export default function CareerSection({ sb, memberId }: { sb: SB; memberId: string }) {
  const [rows, setRows] = useState<Car[]>([]);
  const [f, setF] = useState(blank);
  const [file, setFile] = useState<File | null>(null);
  const [rk, setRk] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await sb.from('career_entries').select('id,kind,organisation,title,from_year,to_year,status,rejection_reason,proof_path').eq('member_id', memberId).order('from_year', { ascending: false });
    setRows(data ?? []);
  }, [sb, memberId]);
  useEffect(() => { load(); }, [load]);

  const editing = editId ? rows.find(r => r.id === editId) : undefined;
  const reset = () => { setEditId(null); setF(blank); setFile(null); setRk(k => k + 1); };

  function edit(c: Car) {
    setEditId(c.id); setFile(null); setRk(k => k + 1); setMsg('');
    setF({ kind: c.kind, organisation: c.organisation, title: c.title, from_year: String(c.from_year), to_year: c.to_year ? String(c.to_year) : '' });
  }

  async function save() {
    setMsg('');
    const from = Number(f.from_year), to = f.to_year ? Number(f.to_year) : null;
    if (!f.organisation.trim() || !f.title.trim() || !from) return setMsg('Enter the institution, the title and the start year.');
    if (to && to < from) return setMsg('The end year cannot be before the start year.');
    if (!editId && !file) return setMsg('Attach proof, such as an admission letter or a posting letter.');
    setBusy(true);
    let proof_path: string | undefined;
    if (file) {
      const r = await uploadProof(sb, memberId, file);
      if (r.error) { setBusy(false); return setMsg('The document could not be uploaded: ' + r.error); }
      proof_path = r.path;
    }
    const payload: Record<string, unknown> = { kind: f.kind, organisation: f.organisation.trim(), title: f.title.trim(), from_year: from, to_year: to };
    if (proof_path) payload.proof_path = proof_path;
    if (editId) Object.assign(payload, { status: 'pending', rejection_reason: null, reviewed_by: null });
    else payload.member_id = memberId;

    const { error } = editId ? await sb.from('career_entries').update(payload).eq('id', editId) : await sb.from('career_entries').insert(payload);
    setBusy(false);
    if (error) return setMsg('Could not save the entry: ' + error.message);
    playUiSound('success');
    if (editId && proof_path) await removeProof(sb, editing?.proof_path);
    setMsg(editId ? 'Updated. It will be checked again.' : 'Added. It shows as verified once the Society checks your proof.'); reset(); load();
  }

  async function remove(c: Car) {
    if (!confirm('Delete this entry?')) return;
    const { error } = await sb.from('career_entries').delete().eq('id', c.id);
    if (error) return setMsg('Could not delete: ' + error.message);
    playUiSound('delete');
    await removeProof(sb, c.proof_path); if (editId === c.id) reset(); load();
  }

  return (
    <section>
      <h2 className="text-xl font-semibold">Career journey</h2>
      <p className="mt-1 text-gray-600">Record your education and each workplace with proof. Verified entries carry the Society’s mark on your CV.</p>

      <WaveCard className="mt-4 space-y-2 rounded border border-gray-200 p-4">
        <h3 className="font-medium">{editId ? 'Edit entry' : 'Add an entry'}</h3>
        <div className="flex flex-wrap gap-2">
          <select className={input} value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>
            <option value="education">Education</option><option value="employment">Employment</option>
          </select>
          <input className={input + ' flex-1'} placeholder="School or hospital" value={f.organisation} onChange={e => setF({ ...f, organisation: e.target.value })} />
          <input className={input + ' flex-1'} placeholder="Programme or job title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <input className={input + ' w-32'} type="number" placeholder="From year" value={f.from_year} onChange={e => setF({ ...f, from_year: e.target.value })} />
          <input className={input + ' w-44'} type="number" placeholder="To year, blank if current" value={f.to_year} onChange={e => setF({ ...f, to_year: e.target.value })} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label>{editId ? 'Replace proof (optional)' : 'Proof (admission or posting letter)'} <input key={rk} type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
          <button className={btn} disabled={busy} onClick={save}>{busy ? 'Saving...' : editId ? 'Save changes' : 'Add entry'}</button>
          {editId && <button className={alt} onClick={reset}>Cancel</button>}
        </div>
        {msg && <p className="text-sm text-gray-700">{msg}</p>}
      </WaveCard>

      <ul className="mt-4 divide-y divide-gray-200">
        {rows.map((c, index) => (
          <li key={c.id}>
            <WaveCard index={index} className="py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-48 flex-1"><b>{c.title}</b>, {c.organisation} ({c.from_year} to {c.to_year ?? 'present'}) <span className={tag(c.status)}>{c.status}</span></div>
              {c.proof_path && <button className={alt} onClick={() => viewProof(sb, c.proof_path)}>View proof</button>}
              {c.status !== 'verified' && <button className={editBtn} onClick={() => edit(c)}>Edit</button>}
              {c.status !== 'verified' && <button className={dangerBtn} onClick={() => remove(c)}>Delete</button>}
            </div>
            {c.rejection_reason && <div className="text-sm text-gray-600">Reason: {c.rejection_reason}</div>}
            {c.status === 'verified' && <div className="text-sm text-gray-500">Verified entries are locked. Contact the Society to correct one.</div>}
            </WaveCard>
          </li>
        ))}
      </ul>
    </section>
  );
}
