-- Lets admins delete replaced or removed photos from storage, so old files do not pile up. Run once.
create policy "media read" on storage.objects for select using (bucket_id = 'public-media');
create policy "media delete admin" on storage.objects for delete to authenticated
  using (bucket_id = 'public-media' and public.is_admin());
