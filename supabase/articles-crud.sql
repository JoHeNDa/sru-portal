-- Articles: decline reason, and members can edit or delete their own articles. Run once.
alter table articles add column if not exists decline_reason text;

-- An edited article always goes back to 'pending' for approval.
create policy "articles edit own" on articles for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and status = 'pending');
create policy "articles delete own" on articles for delete to authenticated
  using (author_id = auth.uid());
