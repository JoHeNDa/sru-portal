-- Run this ONCE in the Supabase SQL Editor, after schema.sql.

-- 1. Members are created by the verified-payment function, never by the browser.
drop policy if exists "member self insert" on public.members;
revoke insert on public.members from anon, authenticated;

-- 2. Storage rules. Members upload into a folder named after their own user id.
-- proofs (private): certificates, admission letters, posting letters. Staff can read them for verification.
create policy "proofs upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "proofs read" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- public-media (public): photos, logo, hero images. Members use their own folder, admins can write anywhere.
create policy "media upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "media replace admin" on storage.objects for update to authenticated
  using (bucket_id = 'public-media' and public.is_admin());
