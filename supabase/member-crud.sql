-- Members can edit or delete their own CPD and career entries while pending or rejected. Verified entries are locked.
-- Run once in the Supabase SQL Editor.
grant delete on cpd_entries, career_entries to authenticated;

create policy "cpd edit own" on cpd_entries for update to authenticated
  using (member_id = auth.uid() and status in ('pending','rejected') and not added_by_staff)
  with check (member_id = auth.uid() and status = 'pending' and not added_by_staff);
create policy "cpd delete own" on cpd_entries for delete to authenticated
  using (member_id = auth.uid() and status in ('pending','rejected') and not added_by_staff);

create policy "career edit own" on career_entries for update to authenticated
  using (member_id = auth.uid() and status in ('pending','rejected'))
  with check (member_id = auth.uid() and status = 'pending');
create policy "career delete own" on career_entries for delete to authenticated
  using (member_id = auth.uid() and status in ('pending','rejected'));

-- Members can delete their own old files when they replace or remove them.
create policy "proofs delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'public-media' and (storage.foldername(name))[1] = auth.uid()::text);
