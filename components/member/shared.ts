import { browser } from '@/lib/browser';

export type SB = ReturnType<typeof browser>;
export const input = 'rounded border border-gray-300 p-2';
export const btn = 'button-primary px-4 py-2 disabled:opacity-50';
export const alt = 'button-neutral px-3 py-1.5 text-sm disabled:opacity-50';
export const editBtn = 'button-edit px-3 py-1.5 text-sm disabled:opacity-50';
export const successBtn = 'button-success px-3 py-1.5 text-sm disabled:opacity-50';
export const dangerBtn = 'button-danger px-3 py-1.5 text-sm disabled:opacity-50';
export const tag = (s: string) => (s === 'verified' ? 'text-green-700' : s === 'rejected' ? 'text-red-700' : 'text-amber-700');

// Uploads a private proof document into the member's own folder.
export async function uploadProof(sb: SB, memberId: string, file: File) {
  const path = `${memberId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
  const { error } = await sb.storage.from('proofs').upload(path, file);
  return error ? { error: error.message } : { path };
}
export async function removeProof(sb: SB, path: string | null | undefined) {
  if (path) await sb.storage.from('proofs').remove([path]);
}
export async function viewProof(sb: SB, path: string | null) {
  if (!path) return;
  const { data } = await sb.storage.from('proofs').createSignedUrl(path, 300);
  if (data?.signedUrl) window.open(data.signedUrl, '_blank');
}
