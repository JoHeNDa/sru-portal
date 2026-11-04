'use client';
import { SB, pub } from './shared';

// Photo control for an add or edit form: shows the current photo, lets you replace it, or remove it.
export default function PhotoField({ sb, current, file, setFile, remove, setRemove, resetKey, round }: {
  sb: SB; current: string | null; file: File | null; setFile: (f: File | null) => void;
  remove: boolean; setRemove: (b: boolean) => void; resetKey: number; round?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {current && !remove && !file && <img src={pub(sb, current)} alt="Current photo" className={`h-14 w-14 object-cover ${round ? 'rounded-full' : ''}`} />}
      <label>{current ? 'Replace photo' : 'Photo'}{' '}
        <input key={resetKey} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0] ?? null; setFile(f); if (f) setRemove(false); }} />
      </label>
      {current && !file && (
        <label className="flex items-center gap-1"><input type="checkbox" checked={remove} onChange={e => setRemove(e.target.checked)} /> Remove current photo</label>
      )}
    </div>
  );
}
