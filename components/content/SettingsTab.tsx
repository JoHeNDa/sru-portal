'use client';
import { useCallback, useEffect, useState } from 'react';
import { SB, input, btn, dangerBtn, pub, uploadPublic, removePublic } from './shared';
import { playUiSound } from '@/lib/ui-sound';
import ConfirmModal from '@/components/ConfirmModal';
import { useConfirm } from '@/lib/use-confirm';

// Contact details shown on the landing page, and the Society's logo shown in the top bar.
export default function SettingsTab({ sb }: { sb: SB }) {
  const { confirm, modalState, handleConfirm, handleCancel } = useConfirm();
  const [c, setC] = useState({ contact_email: '', contact_phone: '', contact_address: '' });
  const [logo, setLogo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [rk, setRk] = useState(0);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await sb.from('site_settings').select('key,value');
    const m: Record<string, string> = Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
    setC({ contact_email: m.contact_email ?? '', contact_phone: m.contact_phone ?? '', contact_address: m.contact_address ?? '' });
    setLogo(m.logo_path ?? '');
  }, [sb]);
  useEffect(() => { load(); }, [load]);

  async function saveContacts() {
    setMsg('');
    const { error } = await sb.from('site_settings').upsert(Object.entries(c).map(([key, value]) => ({ key, value: value.trim() })));
    if (!error) playUiSound('success');
    setMsg(error ? 'Could not save: ' + error.message : 'Contacts saved.');
  }
  async function saveLogo() {
    setMsg('');
    if (!file) return setMsg('Choose a logo image first.');
    setBusy(true);
    const old = logo;
    const r = await uploadPublic(sb, 'branding', file);
    if (r.error) { setBusy(false); return setMsg('The logo could not be uploaded: ' + r.error); }
    const { error } = await sb.from('site_settings').upsert({ key: 'logo_path', value: r.path! });
    setBusy(false);
    if (error) return setMsg('Could not save the logo: ' + error.message);
    playUiSound('success');
    await removePublic(sb, old);
    setFile(null); setRk(k => k + 1); setMsg('Logo saved. Reload the page to see it in the top bar.'); load();
  }
  async function removeLogo() {
    if (!logo) return;
    const ok = await confirm({
      title: 'Remove logo?',
      message: 'The logo will be removed from the top bar. You can upload a new one at any time.',
      confirmLabel: 'Remove logo',
      tone: 'danger',
    });
    if (!ok) return;
    const { error } = await sb.from('site_settings').delete().eq('key', 'logo_path');
    if (error) return setMsg('Could not remove the logo: ' + error.message);
    playUiSound('delete');
    await removePublic(sb, logo); setMsg('Logo removed.'); load();
  }

  return (
    <div className="space-y-8">
      {msg && <p className="text-sm">{msg}</p>}
      <div className="space-y-2 rounded border border-gray-200 p-4">
        <h2 className="font-medium">Contacts</h2>
        <input className={input + ' w-full'} placeholder="Email" value={c.contact_email} onChange={e => setC({ ...c, contact_email: e.target.value })} />
        <input className={input + ' w-full'} placeholder="Phone" value={c.contact_phone} onChange={e => setC({ ...c, contact_phone: e.target.value })} />
        <input className={input + ' w-full'} placeholder="Address" value={c.contact_address} onChange={e => setC({ ...c, contact_address: e.target.value })} />
        <button className={btn} onClick={saveContacts}>Save contacts</button>
      </div>
      <div className="space-y-2 rounded border border-gray-200 p-4">
        <h2 className="font-medium">Logo</h2>
        {logo ? <img src={pub(sb, logo)} alt="Current logo" className="h-16" /> : <p className="text-sm text-gray-500">No logo uploaded yet.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <input key={rk} type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          <button className={btn} disabled={busy} onClick={saveLogo}>{busy ? 'Saving...' : logo ? 'Replace logo' : 'Save logo'}</button>
          {logo && <button className={dangerBtn} onClick={removeLogo}>Remove logo</button>}
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
        busy={false}
      />
    </div>
  );
}
