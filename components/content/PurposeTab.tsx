'use client';
import { useCallback, useEffect, useState } from 'react';
import { SB, input, btn } from './shared';
import { playUiSound } from '@/lib/ui-sound';

const defaults = {
  purpose_headline: 'A stronger voice for radiography in Uganda.',
  purpose_body: 'SRU brings radiographers together to advance professional standards, support lifelong learning, and strengthen the quality of imaging care.',
  purpose_card_1_title: 'Professional community',
  purpose_card_1_body: 'Connect with radiographers and contribute to the profession.',
  purpose_card_2_title: 'Continuing development',
  purpose_card_2_body: 'Record verified CPD and follow your annual progress.',
  purpose_card_3_title: 'Career recognition',
  purpose_card_3_body: 'Build a trusted record of education and work experience.',
};

type PurposeContent = typeof defaults;

export default function PurposeTab({ sb }: { sb: SB }) {
  const [form, setForm] = useState<PurposeContent>(defaults);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await sb.from('site_settings').select('key,value');
    if (error) {
      console.error('Purpose content could not be loaded:', error);
      setMessage(`Could not load purpose content: ${error.message}`);
      return;
    }
    const values = Object.fromEntries((data ?? []).map(row => [row.key, row.value])) as Partial<PurposeContent>;
    setForm(Object.fromEntries(
      Object.entries(defaults).map(([key, fallback]) => [key, values[key as keyof PurposeContent] || fallback]),
    ) as PurposeContent);
    setMessage('');
  }, [sb]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setMessage('');
    setBusy(true);
    const { error } = await sb.from('site_settings').upsert(
      Object.entries(form).map(([key, value]) => ({ key, value: value.trim() })),
    );
    setBusy(false);
    if (error) {
      console.error('Purpose content could not be saved:', error);
      setMessage(`Could not save purpose content: ${error.message}`);
      return;
    }
    playUiSound('success');
    setMessage('Purpose content saved.');
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Edit the Our Purpose section and its three feature cards on the public landing page.</p>
      {message && <p role="status" className="text-sm text-gray-700">{message}</p>}
      <div className="space-y-3 rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium">Purpose statement</h3>
        <input className={input + ' w-full'} aria-label="Purpose headline" value={form.purpose_headline} onChange={event => setForm({ ...form, purpose_headline: event.target.value })} />
        <textarea className={input + ' w-full'} rows={3} aria-label="Purpose description" value={form.purpose_body} onChange={event => setForm({ ...form, purpose_body: event.target.value })} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map(index => {
          const titleKey = `purpose_card_${index}_title` as keyof PurposeContent;
          const bodyKey = `purpose_card_${index}_body` as keyof PurposeContent;
          return (
            <section key={index} className="space-y-2 rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium">Feature {index}</h3>
              <input className={input + ' w-full'} aria-label={`Feature ${index} title`} value={form[titleKey]} onChange={event => setForm({ ...form, [titleKey]: event.target.value })} />
              <textarea className={input + ' w-full'} rows={3} aria-label={`Feature ${index} description`} value={form[bodyKey]} onChange={event => setForm({ ...form, [bodyKey]: event.target.value })} />
            </section>
          );
        })}
      </div>
      <button className={btn} disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save purpose content'}</button>
    </div>
  );
}
