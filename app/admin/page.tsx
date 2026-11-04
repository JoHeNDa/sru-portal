'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { browser } from '@/lib/browser';
import Icon, { type IconName } from '@/components/Icon';
import { playUiSound } from '@/lib/ui-sound';
import ConfirmModal from '@/components/ConfirmModal';
import { useConfirm } from '@/lib/use-confirm';
import Breadcrumbs from '@/components/Breadcrumbs';

type Role = 'chief_admin' | 'admin' | 'cpd_coordinator';
type StaffRoleRow = { email: string; name: string; role: Role };
type SB = ReturnType<typeof browser>;
type AdminMember = { id: string; full_name: string; email: string; member_type: string; reg_no: string | null; phone: string | null; workplace: string | null; bio: string | null; paid_through_year: number | null };
type CpdRow = { id: string; member_id: string; member_name: string; member_type: string; title: string; points: number; year: number; proof_path: string | null; status: string; rejection_reason: string | null; added_by_staff: boolean };
type CareerRow = { id: string; member_id: string; kind: string; organisation: string; title: string; from_year: number; to_year: number | null; proof_path: string; status: string; rejection_reason: string | null; members: { full_name: string }[] | null };
const ROLE: Record<Role, string> = { chief_admin: 'Chief admin', admin: 'Admin', cpd_coordinator: 'CPD coordinator' };
const TAB_ICONS: Record<string, IconName> = {
  cpd: 'article',
  career: 'users',
  members: 'users',
  roles: 'shield',
  types: 'settings',
};
const tag = (s: string) => (s === 'verified' ? 'text-green-700' : s === 'rejected' ? 'text-red-700' : 'text-amber-700');
const money = (amount: number) => 'UGX ' + Number(amount).toLocaleString('en-US');
const input = 'rounded border border-gray-300 p-2';
const btn = 'button-primary px-3 py-1.5 disabled:opacity-50';
const alt = 'button-neutral px-3 py-1.5';
const editBtn = 'button-edit px-3 py-1.5';
const successBtn = 'button-success px-3 py-1.5';
const dangerBtn = 'button-danger px-3 py-1.5';
const th = 'p-2 text-left font-medium text-gray-600';
const td = 'p-2 align-top';

async function openProof(sb: SB, path: string | null) {
  if (!path) return;
  const { data } = await sb.storage.from('proofs').createSignedUrl(path, 300);
  if (data?.signedUrl) window.open(data.signedUrl, '_blank');
}
async function uploadStaffProof(sb: SB, memberId: string, file: File) {
  const path = `${memberId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
  const { error } = await sb.storage.from('proofs').upload(path, file);
  return error ? { error: error.message } : { path };
}
async function removeProof(sb: SB, path: string | null) {
  if (!path) return null;
  const { error } = await sb.storage.from('proofs').remove([path]);
  return error?.message ?? null;
}
async function me(sb: SB) { return (await sb.auth.getUser()).data.user?.email ?? 'staff'; }

// The page hides what a person may not use, but the real protection is the database rules (RLS).
export default function Admin() {
  const sb = useMemo(() => browser(), []);
  const [role, setRole] = useState<Role | null | undefined>(undefined);
  const [signed, setSigned] = useState(true);
  const [tab, setTab] = useState('cpd');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setSigned(false); setRole(null); return; }
      const { data } = await sb.rpc('my_role');
      setRole((data as Role) ?? null);
    })();
  }, [sb]);

  if (role === undefined) return <main className="p-8">Loading...</main>;
  if (!signed) return <main className="p-8">Please <Link className="underline" href="/join">sign in</Link> with your staff Google account.</main>;
  if (!role) return <main className="p-8">This account does not have staff access.</main>;

  const tabs = role === 'cpd_coordinator'
    ? [['cpd', 'CPD review']]
    : [['cpd', 'CPD review'], ['career', 'Career checks'], ['members', 'Members'], ['roles', 'Roles'], ...(role === 'chief_admin' ? [['types', 'Membership types']] : [])];
  const cur = tabs.some(t => t[0] === tab) ? tab : 'cpd';
  const currentLabel = tabs.find(([key]) => key === cur)?.[1] ?? 'CPD review';

  return (
    <main className="workspace-compact min-h-[calc(100vh-4rem)] bg-gray-50 px-3 py-4 sm:px-5 lg:px-6 lg:py-5">
      <div className="mx-auto max-w-[1440px]">
        <Breadcrumbs items={[{ label: 'Administration' }]} className="mb-2" />
        <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 font-brand text-xs font-semibold uppercase tracking-[0.16em] text-teal-800"><Icon name="shield" className="h-4 w-4" /> Society workspace</p>
            <h1 className="mt-1 font-serif font-semibold">Administration</h1>
            <p className="mt-1 text-gray-600">Review records and manage membership operations.</p>
          </div>
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm">{ROLE[role]}</span>
          {(role === 'chief_admin' || role === 'admin') && (
            <Link href="/admin/content" className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-black">
              <Icon name="article" className="h-4 w-4" />Content studio
            </Link>
          )}
        </header>
        <div className="grid items-start gap-3 lg:grid-cols-[190px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm lg:sticky lg:top-16">
            <p className="flex items-center gap-2 px-2 pb-1.5 pt-1 font-brand text-xs font-semibold uppercase tracking-[0.12em] text-gray-500"><Icon name="settings" className="h-3.5 w-3.5" /> Workspace</p>
            <nav aria-label="Administration sections" className="grid grid-cols-2 gap-0.5 sm:grid-cols-3 lg:grid-cols-1">
              {tabs.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-current={cur === key ? 'page' : undefined}
                  onClick={() => setTab(key)}
                  className={'rounded-md px-2.5 py-2 text-left font-medium transition ' + (cur === key ? 'bg-teal-50 text-teal-900 ring-1 ring-inset ring-teal-800/10' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}
                >
                  <span className="flex items-center gap-2"><Icon name={TAB_ICONS[key] ?? 'article'} className="h-3.5 w-3.5 shrink-0" />{label}</span>
                </button>
              ))}
            </nav>
          </aside>
          <section className="min-w-0 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-3 py-2.5 sm:px-4">
              <h2 className="font-serif font-semibold">{currentLabel}</h2>
              <p className="mt-0.5 text-gray-600">Manage records securely with role-based access.</p>
            </div>
            <div className="min-w-0 p-3 sm:p-4">
              {cur === 'cpd' && <CpdTab sb={sb} />}
              {cur === 'career' && <CareerTab sb={sb} />}
              {cur === 'members' && <MembersTab sb={sb} />}
              {cur === 'roles' && <RolesTab sb={sb} chief={role === 'chief_admin'} />}
              {cur === 'types' && role === 'chief_admin' && <MembershipTypesTab sb={sb} />}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function CpdTab({ sb }: { sb: SB }) {
  const { confirm, modalState, handleConfirm, handleCancel } = useConfirm();
  const [rows, setRows] = useState<CpdRow[]>([]);
  const [dir, setDir] = useState<Pick<AdminMember, 'id' | 'full_name' | 'member_type' | 'paid_through_year'>[]>([]);
  const [why, setWhy] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [awMsg, setAwMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [aw, setAw] = useState({ member: '', title: '', points: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', points: '', year: '', status: 'pending', rejection_reason: '' });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [removeProofFile, setRemoveProofFile] = useState(false);
  const [proofFileKey, setProofFileKey] = useState(0);

  const load = useCallback(async () => {
    const [q, d] = await Promise.all([sb.rpc('cpd_queue'), sb.rpc('member_directory')]);
    if (q.error) {
      console.error('cpd_queue failed:', q.error);
      setMsg(`Could not load CPD records: ${q.error.message}`);
    }
    if (d.error) console.error('member_directory failed:', d.error);
    setRows((q.data ?? []) as CpdRow[]); setDir(d.data ?? []);
  }, [sb]);
  useEffect(() => { load(); }, [load]);

  function edit(row: CpdRow) {
    setEditId(row.id);
    setEditForm({
      title: row.title,
      points: String(row.points),
      year: String(row.year),
      status: row.status,
      rejection_reason: row.rejection_reason ?? '',
    });
    setProofFile(null);
    setRemoveProofFile(false);
    setProofFileKey(key => key + 1);
    setMsg('');
  }

  function cancelEdit() {
    setEditId(null);
    setProofFile(null);
    setRemoveProofFile(false);
    setProofFileKey(key => key + 1);
  }

  async function saveEdit() {
    if (!editId) return;
    const row = rows.find(item => item.id === editId);
    if (!row) return setMsg('This CPD record is no longer available. Reload and try again.');
    const points = Number(editForm.points), year = Number(editForm.year);
    if (!editForm.title.trim() || !Number.isInteger(points) || points < 1) return setMsg('Enter an activity title and a whole number of points above 0.');
    if (!Number.isInteger(year) || year < 1900) return setMsg('Enter a valid CPD year.');
    if (editForm.status === 'rejected' && !editForm.rejection_reason.trim()) return setMsg('Enter a reason for rejecting this record.');

    setBusy(true);
    let uploadedPath: string | undefined;
    if (proofFile) {
      const upload = await uploadStaffProof(sb, row.member_id, proofFile);
      if (upload.error) { setBusy(false); return setMsg(`The proof could not be uploaded: ${upload.error}`); }
      uploadedPath = upload.path;
    }

    const status = editForm.status;
    const result = await sb.from('cpd_entries').update({
      title: editForm.title.trim(),
      points,
      year,
      status,
      rejection_reason: status === 'rejected' ? editForm.rejection_reason.trim() : null,
      reviewed_by: status === 'pending' ? null : await me(sb),
      ...(uploadedPath ? { proof_path: uploadedPath } : removeProofFile ? { proof_path: null } : {}),
    }).eq('id', editId).select('id').maybeSingle();
    if (result.error || !result.data) {
      const cleanupError = await removeProof(sb, uploadedPath ?? null);
      setBusy(false);
      return setMsg(`Could not update the CPD record: ${result.error?.message ?? 'The record was not changed.'}${cleanupError ? ` The new proof could not be removed: ${cleanupError}` : ''}`);
    }
    playUiSound('success');
    const cleanupError = uploadedPath || removeProofFile ? await removeProof(sb, row.proof_path) : null;
    setBusy(false);
    cancelEdit();
    setMsg(cleanupError ? `CPD record updated, but its previous proof could not be removed: ${cleanupError}` : 'CPD record updated.');
    await load();
  }

  async function deleteEntry(row: CpdRow) {
    const ok = await confirm({
      title: 'Delete CPD record?',
      message: `Delete "${row.title}" for ${row.member_name}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    const { data, error } = await sb.from('cpd_entries').delete().eq('id', row.id).select('id').maybeSingle();
    if (error || !data) {
      setBusy(false);
      return setMsg(`Could not delete the CPD record: ${error?.message ?? 'The record was not deleted.'}`);
    }
    playUiSound('delete');
    const cleanupError = await removeProof(sb, row.proof_path);
    setBusy(false);
    setMsg(cleanupError ? `CPD record deleted, but its proof could not be removed: ${cleanupError}` : 'CPD record deleted.');
    await load();
  }

  async function review(id: string, ok: boolean) {
    const reason = (why[id] ?? '').trim();
    if (!ok && !reason) return setMsg('Write a reason before rejecting, so the member knows what to fix.');
    const { error } = await sb.from('cpd_entries').update({ status: ok ? 'verified' : 'rejected', rejection_reason: ok ? null : reason, reviewed_by: await me(sb) }).eq('id', id);
    if (error) console.error('Review failed:', error);
    else playUiSound('success');
    setMsg(error ? `Could not save the decision: ${error.message}` : ''); load();
  }

  async function award() {
    setAwMsg('');
    const points = Number(aw.points);
    if (!aw.member) return setAwMsg('Choose a member from the list.');
    if (!aw.title.trim()) return setAwMsg('Enter the activity name.');
    if (!points || points < 1) return setAwMsg('Enter the points, as a number above 0.');
    setBusy(true);
    const { error } = await sb.from('cpd_entries').insert({
      member_id: aw.member, title: aw.title.trim(), points,
      status: 'verified', added_by_staff: true, reviewed_by: await me(sb),
    });
    setBusy(false);
    if (error) {
           console.error('Award failed:', error.message, error.code, error.details, error.hint);
      return setAwMsg(`Could not add the points: ${error.message}`);
    }
    playUiSound('success');
    setAwMsg(`Added ${points} points.`);
    setAw({ member: '', title: '', points: '' });
    load();
  }

  return (
    <div>
      <p className="text-sm text-gray-600">Points count towards a member only once verified. Staff can correct or remove records; members cannot change verified or staff-awarded CPD. A reason is required to reject.</p>
      {msg && <p className={'mt-2 text-sm ' + (msg === 'CPD record updated.' || msg === 'CPD record deleted.' ? 'text-green-700' : 'text-red-700')}>{msg}</p>}
      <table className="mt-3 w-full text-sm">
        <thead><tr><th className={th}>Member</th><th className={th}>Activity</th><th className={th}>Pts</th><th className={th}>Proof</th><th className={th}>Status</th><th className={th}>Actions</th></tr></thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map(r => (
            <tr key={r.id}>
              <td className={td}>{r.member_name}</td>
              <td className={td}>{r.title} ({r.year}){r.added_by_staff && <div className="text-gray-500">Added by staff</div>}</td>
              <td className={td}>{r.points}</td>
              <td className={td}>{r.proof_path ? <button className="underline" onClick={() => openProof(sb, r.proof_path)}>View</button> : 'None'}</td>
              <td className={td}><span className={tag(r.status)}>{r.status}</span>{r.rejection_reason && <div className="text-gray-500">{r.rejection_reason}</div>}</td>
              <td className={td}>
                <div className="flex flex-wrap gap-2">
                {r.status === 'pending' && (
                  <>
                    <button className={successBtn} onClick={() => review(r.id, true)}>Verify</button>
                    <input className={input + ' w-44'} placeholder="Reason for rejecting" value={why[r.id] ?? ''} onChange={e => setWhy({ ...why, [r.id]: e.target.value })} />
                    <button className={dangerBtn} onClick={() => review(r.id, false)}>Reject</button>
                  </>
                )}
                  <button className={editBtn} onClick={() => edit(r)}>Edit</button>
                  <button className={dangerBtn} disabled={busy} onClick={() => deleteEntry(r)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editId && (
        <div className="mt-6 space-y-3 rounded border border-gray-200 p-4">
          <h2 className="font-medium">Edit CPD record</h2>
          <p className="text-sm text-gray-600">Changes to a verified record take effect immediately. Members cannot edit verified or staff-awarded records.</p>
          <div className="flex flex-wrap gap-2">
            <input className={input + ' min-w-48 flex-1'} placeholder="Activity title" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
            <input className={input + ' w-28'} type="number" min="1" step="1" placeholder="Points" value={editForm.points} onChange={e => setEditForm({ ...editForm, points: e.target.value })} />
            <input className={input + ' w-28'} type="number" min="1900" step="1" aria-label="CPD year" value={editForm.year} onChange={e => setEditForm({ ...editForm, year: e.target.value })} />
            <select className={input} value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
              <option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option>
            </select>
          </div>
          {editForm.status === 'rejected' && <input className={input + ' w-full'} placeholder="Reason for rejection" value={editForm.rejection_reason} onChange={e => setEditForm({ ...editForm, rejection_reason: e.target.value })} />}
          {editId && rows.find(row => row.id === editId)?.proof_path && !removeProofFile && (
            <div className="flex items-center gap-3 text-sm">
              <button className="underline" onClick={() => openProof(sb, rows.find(row => row.id === editId)!.proof_path)}>View current proof</button>
              <button type="button" className={alt} onClick={() => setRemoveProofFile(true)}>Remove current proof</button>
            </div>
          )}
          {removeProofFile && <p className="text-sm text-amber-700">Current proof will be removed when you save.</p>}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm">Replace proof <input key={proofFileKey} type="file" onChange={e => { setProofFile(e.target.files?.[0] ?? null); if (e.target.files?.[0]) setRemoveProofFile(false); }} /></label>
            <button className={btn} disabled={busy} onClick={saveEdit}>{busy ? 'Saving...' : 'Save changes'}</button>
            <button className={alt} disabled={busy} onClick={cancelEdit}>Cancel</button>
          </div>
        </div>
      )}
      <div className="mt-8 space-y-2 rounded border border-gray-200 p-4">
        <h2 className="font-medium">Award points directly</h2>
        <div className="flex flex-wrap gap-2">
          <select className={input} value={aw.member} onChange={e => setAw({ ...aw, member: e.target.value })}>
            <option value="">Choose member</option>
            {dir.map(m => <option key={m.id} value={m.id}>{m.full_name}{m.paid_through_year ? '' : ' (not yet paid)'}</option>)}
          </select>
          <input className={input + ' flex-1'} placeholder="Activity" value={aw.title} onChange={e => setAw({ ...aw, title: e.target.value })} />
          <input className={input + ' w-28'} type="number" min="1" placeholder="Points" value={aw.points} onChange={e => setAw({ ...aw, points: e.target.value })} />
          <button className={btn} disabled={busy} onClick={award}>{busy ? 'Saving...' : 'Award'}</button>
        </div>
        {awMsg && <p className={'text-sm ' + (awMsg.startsWith('Added') ? 'text-green-700' : 'text-red-700')}>{awMsg}</p>}
        {dir.length === 0 && <p className="text-sm text-gray-500">No members found yet. Applicants appear here after their payment is confirmed.</p>}
      </div>
    
      <ConfirmModal
        open={!!modalState}
        title={modalState?.title ?? ''}
        message={modalState?.message ?? ''}
        confirmLabel={modalState?.confirmLabel}
        cancelLabel={modalState?.cancelLabel}
        tone={modalState?.tone}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        busy={busy}
      />
</div>
  );
}

function CareerTab({ sb }: { sb: SB }) {
  const { confirm, modalState, handleConfirm, handleCancel } = useConfirm();
  const [rows, setRows] = useState<CareerRow[]>([]);
  const [why, setWhy] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ kind: 'education', organisation: '', title: '', from_year: '', to_year: '', status: 'pending', rejection_reason: '' });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofFileKey, setProofFileKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await sb.from('career_entries')
      .select('id,member_id,kind,organisation,title,from_year,to_year,proof_path,status,rejection_reason,members(full_name)')
      .order('status', { ascending: false });
    if (error) {
      console.error('career entries load failed:', error);
      setMsg(`Could not load career records: ${error.message}`);
    } else setRows((data ?? []) as CareerRow[]);
  }, [sb]);
  useEffect(() => { load(); }, [load]);

  function edit(row: CareerRow) {
    setEditId(row.id);
    setEditForm({
      kind: row.kind,
      organisation: row.organisation,
      title: row.title,
      from_year: String(row.from_year),
      to_year: row.to_year == null ? '' : String(row.to_year),
      status: row.status,
      rejection_reason: row.rejection_reason ?? '',
    });
    setProofFile(null);
    setProofFileKey(key => key + 1);
    setMsg('');
  }

  function cancelEdit() {
    setEditId(null);
    setProofFile(null);
    setProofFileKey(key => key + 1);
  }

  async function saveEdit() {
    if (!editId) return;
    const row = rows.find(item => item.id === editId);
    if (!row) return setMsg('This career record is no longer available. Reload and try again.');
    const from = Number(editForm.from_year), to = editForm.to_year ? Number(editForm.to_year) : null;
    if (!editForm.organisation.trim() || !editForm.title.trim() || !Number.isInteger(from) || from < 1) return setMsg('Enter the institution, title, and a valid start year.');
    if (to != null && (!Number.isInteger(to) || to < from)) return setMsg('The end year must be a whole year no earlier than the start year.');
    if (editForm.status === 'rejected' && !editForm.rejection_reason.trim()) return setMsg('Enter a reason for rejecting this record.');

    setBusy(true);
    let uploadedPath: string | undefined;
    if (proofFile) {
      const upload = await uploadStaffProof(sb, row.member_id, proofFile);
      if (upload.error) { setBusy(false); return setMsg(`The proof could not be uploaded: ${upload.error}`); }
      uploadedPath = upload.path;
    }
    const status = editForm.status;
    const result = await sb.from('career_entries').update({
      kind: editForm.kind,
      organisation: editForm.organisation.trim(),
      title: editForm.title.trim(),
      from_year: from,
      to_year: to,
      ...(uploadedPath ? { proof_path: uploadedPath } : {}),
      status,
      rejection_reason: status === 'rejected' ? editForm.rejection_reason.trim() : null,
      reviewed_by: status === 'pending' ? null : await me(sb),
    }).eq('id', editId).select('id').maybeSingle();
    if (result.error || !result.data) {
      const cleanupError = await removeProof(sb, uploadedPath ?? null);
      setBusy(false);
      return setMsg(`Could not update the career record: ${result.error?.message ?? 'The record was not changed.'}${cleanupError ? ` The new proof could not be removed: ${cleanupError}` : ''}`);
    }
    playUiSound('success');
    const cleanupError = uploadedPath ? await removeProof(sb, row.proof_path) : null;
    setBusy(false);
    cancelEdit();
    setMsg(cleanupError ? `Career record updated, but its previous proof could not be removed: ${cleanupError}` : 'Career record updated.');
    await load();
  }

  async function deleteEntry(row: CareerRow) {
    const ok = await confirm({
      title: 'Delete career record?',
      message: `Delete "${row.title}" for ${row.members?.[0]?.full_name ?? 'this member'}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    const { data, error } = await sb.from('career_entries').delete().eq('id', row.id).select('id').maybeSingle();
    if (error || !data) {
      setBusy(false);
      return setMsg(`Could not delete the career record: ${error?.message ?? 'The record was not deleted.'}`);
    }
    playUiSound('delete');
    const cleanupError = await removeProof(sb, row.proof_path);
    setBusy(false);
    setMsg(cleanupError ? `Career record deleted, but its proof could not be removed: ${cleanupError}` : 'Career record deleted.');
    await load();
  }

  async function review(id: string, ok: boolean) {
    const reason = (why[id] ?? '').trim();
    if (!ok && !reason) return setMsg('Write a reason before rejecting.');
    const { error } = await sb.from('career_entries').update({ status: ok ? 'verified' : 'rejected', rejection_reason: ok ? null : reason, reviewed_by: await me(sb) }).eq('id', id);
    if (!error) playUiSound('success');
    setMsg(error ? 'Could not save the decision.' : ''); load();
  }

  return (
    <div>
      <p className="text-sm text-gray-600">Open the proof letter, check it matches the entry, then verify. Verified entries show the Society’s mark on the member’s CV. Admins can correct or remove career records.</p>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
      <table className="mt-3 w-full text-sm">
        <thead><tr><th className={th}>Member</th><th className={th}>Entry</th><th className={th}>Period</th><th className={th}>Proof</th><th className={th}>Status</th><th className={th}></th></tr></thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map(r => (
            <tr key={r.id}>
              <td className={td}>{r.members?.[0]?.full_name}</td>
              <td className={td}><b>{r.title}</b>, {r.organisation}<div className="text-gray-500 capitalize">{r.kind}</div></td>
              <td className={td}>{r.from_year} to {r.to_year ?? 'present'}</td>
              <td className={td}><button className="underline" onClick={() => openProof(sb, r.proof_path)}>View</button></td>
              <td className={td}><span className={tag(r.status)}>{r.status}</span>{r.rejection_reason && <div className="text-gray-500">{r.rejection_reason}</div>}</td>
              <td className={td}>
                <div className="flex flex-wrap gap-2">
                {r.status === 'pending' && (
                  <>
                    <button className={successBtn} onClick={() => review(r.id, true)}>Verify</button>
                    <input className={input + ' w-44'} placeholder="Reason for rejecting" value={why[r.id] ?? ''} onChange={e => setWhy({ ...why, [r.id]: e.target.value })} />
                    <button className={dangerBtn} onClick={() => review(r.id, false)}>Reject</button>
                  </>
                )}
                  <button className={editBtn} onClick={() => edit(r)}>Edit</button>
                  <button className={dangerBtn} disabled={busy} onClick={() => deleteEntry(r)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editId && (
        <div className="mt-6 space-y-3 rounded border border-gray-200 p-4">
          <h2 className="font-medium">Edit career record</h2>
          <p className="text-sm text-gray-600">Changing a verified record updates the member’s career history immediately. The proof letter is required and can be replaced.</p>
          <div className="flex flex-wrap gap-2">
            <select className={input} value={editForm.kind} onChange={e => setEditForm({ ...editForm, kind: e.target.value })}>
              <option value="education">Education</option><option value="employment">Employment</option>
            </select>
            <input className={input + ' min-w-48 flex-1'} placeholder="Institution or organisation" value={editForm.organisation} onChange={e => setEditForm({ ...editForm, organisation: e.target.value })} />
            <input className={input + ' min-w-48 flex-1'} placeholder="Qualification or job title" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <input className={input + ' w-32'} type="number" min="1" step="1" placeholder="From year" value={editForm.from_year} onChange={e => setEditForm({ ...editForm, from_year: e.target.value })} />
            <input className={input + ' w-32'} type="number" min="1" step="1" placeholder="To year (blank if current)" value={editForm.to_year} onChange={e => setEditForm({ ...editForm, to_year: e.target.value })} />
            <select className={input} value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
              <option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option>
            </select>
          </div>
          {editForm.status === 'rejected' && <input className={input + ' w-full'} placeholder="Reason for rejection" value={editForm.rejection_reason} onChange={e => setEditForm({ ...editForm, rejection_reason: e.target.value })} />}
          <div className="flex flex-wrap items-center gap-3">
            <button className="underline" onClick={() => openProof(sb, rows.find(row => row.id === editId)?.proof_path ?? null)}>View current proof</button>
            <label className="text-sm">Replace proof <input key={proofFileKey} type="file" onChange={e => setProofFile(e.target.files?.[0] ?? null)} /></label>
            <button className={btn} disabled={busy} onClick={saveEdit}>{busy ? 'Saving...' : 'Save changes'}</button>
            <button className={alt} disabled={busy} onClick={cancelEdit}>Cancel</button>
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
        busy={busy}
      />
</div>
  );
}

function MembersTab({ sb }: { sb: SB }) {
  const [rows, setRows] = useState<AdminMember[]>([]);
  const [year, setYear] = useState(0);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [types, setTypes] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState({ full_name: '', member_type: '', reg_no: '', phone: '', workplace: '', bio: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [members, membershipTypes] = await Promise.all([
      sb.from('members').select('id,full_name,email,member_type,reg_no,phone,workplace,bio,paid_through_year').not('paid_through_year', 'is', null).order('full_name'),
      sb.from('membership_types').select('code').order('code'),
    ]);
    if (members.error) { console.error('members load failed:', members.error); setErr(members.error.message); }
    else { setErr(''); setRows((members.data ?? []) as AdminMember[]); }
    if (membershipTypes.error) {
      console.error('membership types load failed:', membershipTypes.error);
      setMsg(`Could not load membership types: ${membershipTypes.error.message}`);
    } else setTypes((membershipTypes.data ?? []).map(type => type.code));
    setYear(new Date().getFullYear());
    setDone(true);
  }, [sb]);

  useEffect(() => {
    load();
  }, [load]);

  const status = (p: number | null) => (p == null ? 'Not paid' : p >= year ? 'Active' : 'Expired');

  function edit(member: AdminMember) {
    setEditId(member.id);
    setF({
      full_name: member.full_name,
      member_type: member.member_type,
      reg_no: member.reg_no ?? '',
      phone: member.phone ?? '',
      workplace: member.workplace ?? '',
      bio: member.bio ?? '',
    });
    setMsg('');
  }

  async function save() {
    if (!editId) return;
    if (!f.full_name.trim()) return setMsg('Enter the member’s full name.');
    if (!types.includes(f.member_type)) return setMsg('Choose a valid membership type.');
    setBusy(true);
    const { data, error } = await sb.from('members').update({
      full_name: f.full_name.trim(),
      member_type: f.member_type,
      reg_no: f.reg_no.trim() || null,
      phone: f.phone.trim() || null,
      workplace: f.workplace.trim() || null,
      bio: f.bio.trim() || null,
    }).eq('id', editId).select('id').maybeSingle();
    setBusy(false);
    if (error || !data) return setMsg(`Could not update member details: ${error?.message ?? 'The member was not changed.'}`);
    playUiSound('success');
    setEditId(null);
    setMsg('Member details updated. Payment status was not changed.');
    await load();
  }

  return (
    <div>
      {err && <p className="mb-3 text-sm text-red-700">Could not load members: {err}</p>}
      {msg && <p className="mb-3 text-sm text-gray-700">{msg}</p>}
      {done && !err && rows.length === 0 && <p className="text-sm text-gray-600">No members yet. Applicants appear here after their payment is confirmed.</p>}
      <table className="w-full text-sm">
        <thead><tr><th className={th}>Name</th><th className={th}>Email</th><th className={th}>Type</th><th className={th}>Reg. no</th><th className={th}>Status</th><th className={th}></th></tr></thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map(r => (
            <tr key={r.id}>
              <td className={td}>{r.full_name}</td><td className={td}>{r.email}</td>
              <td className={td + ' capitalize'}>{r.member_type}</td><td className={td}>{r.reg_no}</td>
              <td className={td}>{status(r.paid_through_year)}{r.paid_through_year ? ` (to ${r.paid_through_year})` : ''}</td>
              <td className={td}><button className={editBtn} onClick={() => edit(r)}>Edit details</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {editId && (
        <div className="mt-6 space-y-2 rounded border border-gray-200 p-4">
          <h2 className="font-medium">Edit member details</h2>
          <p className="text-sm text-gray-600">Email and payment status are read-only here. Membership status changes only after payment confirmation.</p>
          <input className={input + ' w-full'} placeholder="Full name" value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} />
          <select className={input} value={f.member_type} onChange={e => setF({ ...f, member_type: e.target.value })}>
            {types.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
          <input className={input} placeholder="Registration number" value={f.reg_no} onChange={e => setF({ ...f, reg_no: e.target.value })} />
          <input className={input} placeholder="Phone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
          <input className={input} placeholder="Workplace or school" value={f.workplace} onChange={e => setF({ ...f, workplace: e.target.value })} />
          <textarea className={input + ' w-full'} rows={3} placeholder="Biography" value={f.bio} onChange={e => setF({ ...f, bio: e.target.value })} />
          <div className="flex gap-2">
            <button className={btn} disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save details'}</button>
            <button className={alt} disabled={busy} onClick={() => setEditId(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function RolesTab({ sb, chief }: { sb: SB; chief: boolean }) {
  const { confirm, modalState, handleConfirm, handleCancel } = useConfirm();
  const [rows, setRows] = useState<{ email: string; name: string; role: Role }[]>([]);
  const [f, setF] = useState({ name: '', email: '', role: 'admin' });
  const [editName, setEditName] = useState<{ email: string; name: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const { data } = await sb.from('staff_roles').select('email,name,role').order('name'); setRows((data as StaffRoleRow[]) ?? []); }, [sb]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email)) return setMsg('Enter a name and the person’s Google account email.');
    const { error } = await sb.from('staff_roles').insert({ name: f.name.trim(), email: f.email.trim().toLowerCase(), role: f.role });
    if (!error) playUiSound('success');
    setMsg(error ? 'Could not add. Only the chief admin can change roles, and the email must be new.' : ''); if (!error) setF({ name: '', email: '', role: 'admin' }); load();
  }
  async function change(email: string, role: string) {
    const { error } = await sb.from('staff_roles').update({ role }).eq('email', email);
    if (!error) playUiSound('success');
    setMsg(error ? 'Could not change the role.' : ''); load();
  }
  async function saveName() {
    if (!editName || !editName.name.trim()) return setMsg('Enter a name.');
    const { error } = await sb.from('staff_roles').update({ name: editName.name.trim() }).eq('email', editName.email);
    if (error) return setMsg(`Could not update the staff name: ${error.message}`);
    playUiSound('success');
    setEditName(null); setMsg('Staff name updated.'); load();
  }
  async function remove(email: string) {
    const ok = await confirm({
      title: 'Remove staff access?',
      message: "Remove this person's access to the admin workspace? This cannot be undone.",
      confirmLabel: 'Remove access',
      tone: 'danger',
    });
    if (!ok) return;
    const { error } = await sb.from('staff_roles').delete().eq('email', email);
    if (!error) playUiSound('delete');
    setMsg(error ? 'Could not remove access.' : ''); load();
  }

  return (
    <div>
      <p className="text-sm text-gray-600">Admins can view everything. Only the chief admin can grant, change or remove roles. The email must match the person’s Google account.</p>
      {msg && <p className="mt-2 text-sm text-red-700">{msg}</p>}
      <table className="mt-3 w-full text-sm">
        <thead><tr><th className={th}>Name</th><th className={th}>Email</th><th className={th}>Role</th><th className={th}></th></tr></thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map(r => (
            <tr key={r.email}>
              <td className={td}>{chief && editName?.email === r.email
                ? <input className={input} value={editName.name} onChange={e => setEditName({ ...editName, name: e.target.value })} />
                : r.name}</td><td className={td}>{r.email}</td>
              <td className={td}>
                {chief && r.role !== 'chief_admin' ? (
                  <select className={input} value={r.role} onChange={e => change(r.email, e.target.value)}>
                    <option value="admin">Admin</option><option value="cpd_coordinator">CPD coordinator</option>
                  </select>
                ) : ROLE[r.role]}
              </td>
              <td className={td}>{chief && <>
                {editName?.email === r.email
                  ? <><button className={btn} onClick={saveName}>Save name</button> <button className={alt} onClick={() => setEditName(null)}>Cancel</button></>
                  : <button className={editBtn} onClick={() => { setEditName({ email: r.email, name: r.name }); setMsg(''); }}>Edit name</button>}
                {r.role !== 'chief_admin' && <button className={dangerBtn + ' ml-2'} onClick={() => remove(r.email)}>Remove access</button>}
              </>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {chief && (
        <div className="mt-8 space-y-2 rounded border border-gray-200 p-4">
          <h2 className="font-medium">Give access to an account</h2>
          <div className="flex flex-wrap gap-2">
            <input className={input} placeholder="Name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
            <input className={input + ' flex-1'} type="email" placeholder="Google account email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
            <select className={input} value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
              <option value="admin">Admin</option><option value="cpd_coordinator">CPD coordinator</option>
            </select>
            <button className={btn} onClick={add}>Grant access</button>
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
        busy={busy}
      />
</div>
  );
}

type MembershipType = { code: string; registration_fee: number; renewal_fee: number; late_fine: number; cpd_min: number };

function MembershipTypesTab({ sb }: { sb: SB }) {
  const { confirm, modalState, handleConfirm, handleCancel } = useConfirm();
  const [rows, setRows] = useState<MembershipType[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [editCode, setEditCode] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', registration_fee: '', renewal_fee: '', late_fine: '', cpd_min: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const types = await sb.from('membership_types').select('code,registration_fee,renewal_fee,late_fine,cpd_min').order('code');
    if (types.error) {
      console.error('membership types load failed:', types.error);
      setMsg(`Could not load membership types: ${types.error.message}`);
      return;
    }
    const usage = await Promise.all((types.data ?? []).map(async type => ({
      code: type.code,
      result: await sb.from('members').select('id', { count: 'exact', head: true }).eq('member_type', type.code).not('paid_through_year', 'is', null),
    })));
    const failedUsage = usage.find(item => item.result.error);
    if (failedUsage?.result.error) {
      console.error('member type usage load failed:', failedUsage.result.error);
      setMsg(`Could not check members using ${failedUsage.code}: ${failedUsage.result.error.message}`);
      return;
    }
    setRows((types.data ?? []) as MembershipType[]);
    setMemberCounts(Object.fromEntries(usage.map(item => [item.code, item.result.count ?? 0])));
  }, [sb]);

  useEffect(() => { load(); }, [load]);

  function startEdit(type: MembershipType) {
    setEditCode(type.code);
    setForm({
      code: type.code,
      registration_fee: String(type.registration_fee),
      renewal_fee: String(type.renewal_fee),
      late_fine: String(type.late_fine),
      cpd_min: String(type.cpd_min),
    });
    setMsg('');
  }

  function resetForm() {
    setEditCode(null);
    setForm({ code: '', registration_fee: '', renewal_fee: '', late_fine: '', cpd_min: '' });
  }

  async function save() {
    const code = form.code.trim().toLowerCase();
    const registrationFee = Number(form.registration_fee);
    const renewalFee = Number(form.renewal_fee);
    const lateFine = Number(form.late_fine);
    const cpdMin = Number(form.cpd_min);
    if (!/^[a-z][a-z0-9_-]*$/.test(code)) return setMsg('Use a lowercase code beginning with a letter; letters, numbers, underscores, and hyphens are allowed.');
    if (![registrationFee, renewalFee, lateFine].every(value => Number.isSafeInteger(value) && value >= 0)) return setMsg('Fees and fines must be whole, non-negative UGX amounts.');
    if (!Number.isInteger(cpdMin) || cpdMin < 0) return setMsg('The CPD minimum must be a whole number of 0 or more.');
    setBusy(true);
    const payload = {
      registration_fee: registrationFee,
      renewal_fee: renewalFee,
      late_fine: lateFine,
      cpd_min: cpdMin,
    };
    const result = editCode
      ? await sb.from('membership_types').update(payload).eq('code', editCode).select('code').maybeSingle()
      : await sb.from('membership_types').insert({ code, ...payload }).select('code').maybeSingle();
    setBusy(false);
    if (result.error || !result.data) return setMsg(`Could not ${editCode ? 'update' : 'add'} the membership type: ${result.error?.message ?? 'No changes were saved.'}`);
    playUiSound('success');
    resetForm();
    setMsg(editCode ? 'Membership type updated.' : 'Membership type added.');
    await load();
  }

  async function remove(type: MembershipType) {
    const count = memberCounts[type.code] ?? 0;
    if (count > 0) return setMsg(`Cannot delete ${type.code}: ${count} member${count === 1 ? ' uses' : 's use'} this type. Reassign them first.`);
    const ok = await confirm({
      title: 'Delete membership type?',
      message: `Delete the unused "${type.code}" membership type? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    const { data, error } = await sb.from('membership_types').delete().eq('code', type.code).select('code').maybeSingle();
    setBusy(false);
    if (error || !data) return setMsg(`Could not delete the membership type: ${error?.message ?? 'It may now be in use.'}`);
    playUiSound('delete');
    if (editCode === type.code) resetForm();
    setMsg('Membership type deleted.');
    await load();
  }

  return (
    <div>
      <p className="text-sm text-gray-600">Changes affect new registrations and future renewal calculations. Existing payment records are not changed. Only the chief admin can manage these settings.</p>
      {msg && <p className="mt-2 text-sm text-gray-700">{msg}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><th className={th}>Type</th><th className={th}>Registration</th><th className={th}>Renewal</th><th className={th}>Late fine</th><th className={th}>CPD minimum</th><th className={th}>Members</th><th className={th}>Actions</th></tr></thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map(type => (
              <tr key={type.code}>
                <td className={td + ' capitalize'}>{type.code}</td>
                <td className={td}>{money(type.registration_fee)}</td>
                <td className={td}>{money(type.renewal_fee)}</td>
                <td className={td}>{money(type.late_fine)}</td>
                <td className={td}>{type.cpd_min}</td>
                <td className={td}>{memberCounts[type.code] ?? 0}</td>
                <td className={td + ' whitespace-nowrap'}>
                  <button className={editBtn} onClick={() => startEdit(type)}>Edit</button>
                  <button className={dangerBtn + ' ml-2'} disabled={busy || (memberCounts[type.code] ?? 0) > 0} onClick={() => remove(type)}>Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className={td} colSpan={7}>No membership types configured.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-6 space-y-3 rounded border border-gray-200 p-4">
        <h2 className="font-medium">{editCode ? `Edit ${editCode}` : 'Add a membership type'}</h2>
        <div className="flex flex-wrap gap-2">
          <input className={input + ' w-40'} placeholder="Code, e.g. professional" value={form.code} disabled={Boolean(editCode)} onChange={e => setForm({ ...form, code: e.target.value })} />
          <label className="text-sm">Registration fee (UGX)<input className={input + ' ml-2 w-36'} type="number" min="0" step="1" value={form.registration_fee} onChange={e => setForm({ ...form, registration_fee: e.target.value })} /></label>
          <label className="text-sm">Renewal fee (UGX)<input className={input + ' ml-2 w-36'} type="number" min="0" step="1" value={form.renewal_fee} onChange={e => setForm({ ...form, renewal_fee: e.target.value })} /></label>
          <label className="text-sm">Late fine (UGX)<input className={input + ' ml-2 w-36'} type="number" min="0" step="1" value={form.late_fine} onChange={e => setForm({ ...form, late_fine: e.target.value })} /></label>
          <label className="text-sm">CPD minimum<input className={input + ' ml-2 w-28'} type="number" min="0" step="1" value={form.cpd_min} onChange={e => setForm({ ...form, cpd_min: e.target.value })} /></label>
        </div>
        <div className="flex gap-2">
          <button className={btn} disabled={busy} onClick={save}>{busy ? 'Saving...' : editCode ? 'Save changes' : 'Add type'}</button>
          {editCode && <button className={alt} disabled={busy} onClick={resetForm}>Cancel</button>}
        </div>
      </div>
    
      <ConfirmModal
        open={!!modalState}
        title={modalState?.title ?? ''}
        message={modalState?.message ?? ''}
        confirmLabel={modalState?.confirmLabel}
        cancelLabel={modalState?.cancelLabel}
        tone={modalState?.tone}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        busy={busy}
      />
</div>
  );
}
