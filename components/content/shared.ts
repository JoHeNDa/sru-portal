import { browser } from '@/lib/browser';

export type SB = ReturnType<typeof browser>;
export const input = 'rounded border border-gray-300 p-2 focus:border focus:border-[#111318] focus:outline-none focus:ring-0';
export const btn = 'button-primary px-3 py-1.5 disabled:opacity-50';
export const alt = 'button-neutral px-3 py-1.5 disabled:opacity-50';
export const editBtn = 'button-edit px-3 py-1.5 disabled:opacity-50';
export const successBtn = 'button-success px-3 py-1.5 disabled:opacity-50';
export const dangerBtn = 'button-danger px-3 py-1.5 disabled:opacity-50';
export const pub = (sb: SB, p: string) => sb.storage.from('public-media').getPublicUrl(p).data.publicUrl;

// Uploads a photo to the public media bucket. Returns the stored path, or an error message.
export async function uploadPublic(sb: SB, folder: string, file: File): Promise<{ path?: string; error?: string }> {
  const path = `${folder}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
  const { error } = await sb.storage.from('public-media').upload(path, file);
  return error ? { error: error.message } : { path };
}

// Deletes a stored photo. Used when a photo is replaced or removed, or its record is deleted.
export async function removePublic(sb: SB, path: string | null | undefined) {
  if (path) await sb.storage.from('public-media').remove([path]);
}
