'use client';

import { useCallback, useEffect, useState } from 'react';
import { SB, input, btn, alt, dangerBtn, uploadPublic } from './shared';
import PhotoField from './PhotoField';
import { playUiSound } from '@/lib/ui-sound';
import ConfirmModal from '@/components/ConfirmModal';
import { useConfirm } from '@/lib/use-confirm';

type Slot = 1 | 2 | 3;
type Showcase = { slot: Slot; label: string | null; sub_label: string | null; message: string; image_path: string | null };
type Form = { label: string; subLabel: string; message: string; photo: File | null; removePhoto: boolean; resetKey: number };

const slots: Slot[] = [1, 2, 3];
const emptyForm = (): Form => ({ label: '', subLabel: '', message: '', photo: null, removePhoto: false, resetKey: 0 });

export default function ShowcasesTab({ sb }: { sb: SB }) {
  const { confirm, modalState, handleConfirm, handleCancel } = useConfirm();
  const [rows, setRows] = useState<Showcase[]>([]);
  const [forms, setForms] = useState<Record<Slot, Form>>({ 1: emptyForm(), 2: emptyForm(), 3: emptyForm() });
  const [message, setMessage] = useState('');
  const [busySlot, setBusySlot] = useState<Slot | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await sb.from('homepage_showcases').select('slot,label,sub_label,message,image_path').order('slot');
    if (error) {
      console.error('Homepage showcases could not be loaded:', error);
      const migrationMissing = error.code === '42P01' || error.code === 'PGRST205';
      const subLabelMissing = error.code === '42703' || error.code === 'PGRST204';
      setMessage(migrationMissing
        ? 'The homepage showcases table is not installed. Run supabase/patch-11-homepage-showcases.sql in the Supabase SQL Editor, then reload this page.'
        : subLabelMissing
          ? 'The showcase sub-label field is not installed. Run supabase/patch-12-showcase-ad-labels.sql in the Supabase SQL Editor, then reload this page.'
          : `Could not load showcase content: ${error.message}`);
      return;
    }

    const items = (data ?? []) as Showcase[];
    setRows(items);
    setForms(current => ({
      ...current,
      ...Object.fromEntries(items.map(item => [item.slot, {
        ...current[item.slot],
        label: item.label ?? '',
        subLabel: item.sub_label ?? '',
        message: item.message ?? '',
      }])),
    }));
    setMessage('');
  }, [sb]);

  useEffect(() => { load(); }, [load]);

  function updateForm(slot: Slot, patch: Partial<Form>) {
    setForms(current => ({ ...current, [slot]: { ...current[slot], ...patch } }));
  }

  async function save(slot: Slot) {
    setMessage('');
    const form = forms[slot];
    const existing = rows.find(row => row.slot === slot);
    if (!form.message.trim()) {
      setMessage(`Add a message for showcase ${slot}.`);
      return;
    }
    if (!form.photo && !existing) {
      setMessage(`Choose an image for showcase ${slot}.`);
      return;
    }

    setBusySlot(slot);
    let imagePath = existing?.image_path ?? null;
    if (form.photo) {
      const upload = await uploadPublic(sb, 'homepage-showcases', form.photo);
      if (upload.error || !upload.path) {
        setBusySlot(null);
        setMessage(`Showcase ${slot} image could not be uploaded: ${upload.error ?? 'No file path was returned.'}`);
        return;
      }
      imagePath = upload.path;
    } else if (form.removePhoto) {
      imagePath = null;
    }

    const { error } = await sb.from('homepage_showcases').upsert({
      slot,
      label: form.label.trim() || null,
      sub_label: form.subLabel.trim() || null,
      message: form.message.trim(),
      image_path: imagePath,
    }, { onConflict: 'slot' });

    if (error) {
      let cleanupWarning = '';
      if (form.photo && imagePath) {
        const { error: cleanupError } = await sb.storage.from('public-media').remove([imagePath]);
        if (cleanupError) {
          console.error(`Unattached showcase ${slot} image could not be removed:`, cleanupError);
          cleanupWarning = ` The uploaded image also could not be removed: ${cleanupError.message}`;
        }
      }
      setBusySlot(null);
      console.error(`Homepage showcase ${slot} could not be saved:`, error);
      setMessage(`Showcase ${slot} could not be saved: ${error.message}${cleanupWarning}`);
      return;
    }

    const oldImage = existing?.image_path;
    let cleanupWarning = '';
    if (form.photo && oldImage) {
      const { error: removeError } = await sb.storage.from('public-media').remove([oldImage]);
      if (removeError) {
        console.error(`Replaced showcase ${slot} image could not be removed:`, removeError);
        cleanupWarning = ` The previous image could not be removed: ${removeError.message}`;
      }
    } else if (form.removePhoto && oldImage) {
      const { error: removeError } = await sb.storage.from('public-media').remove([oldImage]);
      if (removeError) {
        console.error(`Removed showcase ${slot} image could not be deleted:`, removeError);
        cleanupWarning = ` The old image could not be removed: ${removeError.message}`;
      }
    }

    setBusySlot(null);
    playUiSound('success');
    setForms(current => ({
      ...current,
      [slot]: { ...current[slot], photo: null, removePhoto: false, resetKey: current[slot].resetKey + 1 },
    }));
    await load();
    setMessage(`Showcase ${slot} saved.${cleanupWarning}`);
  }

  async function remove(slot: Slot) {
    const existing = rows.find(row => row.slot === slot);
    if (!existing) return;
    const ok = await confirm({
      title: `Delete showcase ${slot}?`,
      message: 'The image and message for this showcase slot will be removed. This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setMessage('');
    setBusySlot(slot);
    const { error } = await sb.from('homepage_showcases').delete().eq('slot', slot);
    if (error) {
      setBusySlot(null);
      console.error(`Homepage showcase ${slot} could not be deleted:`, error);
      setMessage(`Showcase ${slot} could not be deleted: ${error.message}`);
      return;
    }

    let cleanupMessage = '';
    if (existing.image_path) {
      const { error: removeError } = await sb.storage.from('public-media').remove([existing.image_path]);
      if (removeError) {
        console.error(`Deleted showcase ${slot} image could not be removed:`, removeError);
        cleanupMessage = ` Showcase ${slot} was deleted, but its image could not be removed: ${removeError.message}`;
      }
    }

    setBusySlot(null);
    playUiSound('delete');
    setForms(current => ({ ...current, [slot]: emptyForm() }));
    await load();
    setMessage(cleanupMessage || `Showcase ${slot} deleted.`);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Add up to three homepage ad/showcase placements. Both labels are optional; a placement appears only when it has an image and message.</p>
      {message && <p role="status" className="text-sm text-gray-700">{message}</p>}
      <div className="grid gap-4 xl:grid-cols-3">
        {slots.map(slot => {
          const current = rows.find(row => row.slot === slot);
          const form = forms[slot];
          return (
            <section key={slot} className="space-y-3 rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium">Showcase {slot}</h3>
              <input
                className={input + ' w-full'}
                aria-label={`Showcase ${slot} main label (optional)`}
                placeholder="Main label (optional), e.g. DC-30"
                value={form.label}
                onChange={event => updateForm(slot, { label: event.target.value })}
              />
              <input
                className={input + ' w-full'}
                aria-label={`Showcase ${slot} sub-label (optional)`}
                placeholder="Sub-label (optional), e.g. Ultrasound Machine"
                value={form.subLabel}
                onChange={event => updateForm(slot, { subLabel: event.target.value })}
              />
              <textarea
                className={input + ' w-full'}
                aria-label={`Showcase ${slot} message`}
                placeholder="Message"
                rows={4}
                value={form.message}
                onChange={event => updateForm(slot, { message: event.target.value })}
              />
              <PhotoField
                sb={sb}
                current={current?.image_path ?? null}
                file={form.photo}
                setFile={photo => updateForm(slot, { photo })}
                remove={form.removePhoto}
                setRemove={removePhoto => updateForm(slot, { removePhoto })}
                resetKey={form.resetKey}
              />
              <div className="flex flex-wrap gap-2">
                <button className={btn} disabled={busySlot !== null} onClick={() => save(slot)}>
                  {busySlot === slot ? 'Saving...' : current ? 'Save changes' : 'Add showcase'}
                </button>
                {current && <button className={dangerBtn} disabled={busySlot !== null} onClick={() => remove(slot)}>Delete</button>}
                {form.photo || form.removePhoto ? <button className={alt} disabled={busySlot !== null} onClick={() => updateForm(slot, { photo: null, removePhoto: false, resetKey: form.resetKey + 1 })}>Cancel image change</button> : null}
              </div>
            </section>
          );
        })}
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
