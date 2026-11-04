'use client';
import { useCallback, useEffect, useState } from 'react';
import { SB, input, btn } from './shared';
import PhotoField from '@/components/content/PhotoField';
import { uploadPublic, removePublic } from '@/components/content/shared';
import { playUiSound } from '@/lib/ui-sound';
import WaveCard from '@/components/WaveCard';

// The member's own details. They appear on the CV and on articles the member writes.
export default function ProfileSection({ sb, memberId }: { sb: SB; memberId: string }) {
  const [f, setF] = useState({ full_name: '', phone: '', workplace: '', bio: '' });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [remove, setRemove] = useState(false);
  const [rk, setRk] = useState(0);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await sb.from('members').select('full_name,phone,workplace,bio,avatar_path').eq('id', memberId).maybeSingle();
    if (!data) return;
    setF({ full_name: data.full_name ?? '', phone: data.phone ?? '', workplace: data.workplace ?? '', bio: data.bio ?? '' });
    setAvatar(data.avatar_path ?? null);
  }, [sb, memberId]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setMsg('');
    if (!f.full_name.trim()) return setMsg('Your name cannot be empty.');
    setBusy(true);
    const old = avatar;
    let avatar_path: string | null | undefined;
    if (file) {
      const r = await uploadPublic(sb, memberId, file);
      if (r.error) { setBusy(false); return setMsg('The photo could not be uploaded: ' + r.error); }
      avatar_path = r.path!;
    } else if (remove) avatar_path = null;

    const payload: Record<string, unknown> = { full_name: f.full_name.trim(), phone: f.phone.trim() || null, workplace: f.workplace.trim() || null, bio: f.bio.trim() || null };
    if (avatar_path !== undefined) payload.avatar_path = avatar_path;
    const { error } = await sb.from('members').update(payload).eq('id', memberId);
    setBusy(false);
    if (error) return setMsg('Could not save: ' + error.message);
    playUiSound('success');
    if (avatar_path !== undefined) await removePublic(sb, old);
    setFile(null); setRemove(false); setRk(k => k + 1); setMsg('Saved.'); load();
  }

  return (
    <section>
      <h2 className="text-xl font-semibold">My details</h2>
      <WaveCard className="mt-3 space-y-2 rounded border border-gray-200 p-4">
        <input className={input + ' w-full'} placeholder="Full name" value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} />
        <div className="flex flex-wrap gap-2">
          <input className={input + ' flex-1'} placeholder="Phone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
          <input className={input + ' flex-1'} placeholder="Workplace or school" value={f.workplace} onChange={e => setF({ ...f, workplace: e.target.value })} />
        </div>
        <textarea className={input + ' w-full'} rows={3} placeholder="A short bio" value={f.bio} onChange={e => setF({ ...f, bio: e.target.value })} />
        <PhotoField sb={sb} current={avatar} file={file} setFile={setFile} remove={remove} setRemove={setRemove} resetKey={rk} round />
        <button className={btn} disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save details'}</button>
        {msg && <p className="text-sm text-gray-700">{msg}</p>}
      </WaveCard>
    </section>
  );
}
