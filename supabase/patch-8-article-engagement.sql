-- Run once in the Supabase SQL Editor after schema.sql and patches 1-7.
-- Enables member comment editing and secures article reactions/comments.

begin;

drop policy if exists "reactions own" on public.article_reactions;
drop policy if exists "reactions own insert" on public.article_reactions;
drop policy if exists "reactions own update" on public.article_reactions;
drop policy if exists "reactions own delete" on public.article_reactions;
create policy "reactions own insert" on public.article_reactions
  for insert to authenticated
  with check (
    member_id = auth.uid()
    and exists (
      select 1 from public.members m
      where m.id = auth.uid() and m.paid_through_year is not null
    )
    and exists (
      select 1 from public.articles a
      where a.id = article_reactions.article_id and a.status = 'approved'
    )
  );
create policy "reactions own update" on public.article_reactions
  for update to authenticated
  using (
    member_id = auth.uid()
    and exists (
      select 1 from public.members m
      where m.id = auth.uid() and m.paid_through_year is not null
    )
  )
  with check (
    member_id = auth.uid()
    and exists (
      select 1 from public.members m
      where m.id = auth.uid() and m.paid_through_year is not null
    )
    and exists (
      select 1 from public.articles a
      where a.id = article_reactions.article_id and a.status = 'approved'
    )
  );
create policy "reactions own delete" on public.article_reactions
  for delete to authenticated
  using (member_id = auth.uid());
revoke update on public.article_reactions from authenticated;
grant select, insert, delete on public.article_reactions to authenticated;
grant update (kind) on public.article_reactions to authenticated;

drop policy if exists "comments own" on public.comments;
drop policy if exists "comments own insert" on public.comments;
drop policy if exists "comments own update" on public.comments;
create policy "comments own insert" on public.comments
  for insert to authenticated
  with check (
    member_id = auth.uid()
    and exists (
      select 1 from public.members m
      where m.id = auth.uid() and m.paid_through_year is not null
    )
    and exists (
      select 1 from public.articles a
      where a.id = comments.article_id and a.status = 'approved'
    )
    and (
      comments.parent_id is null
      or exists (
        select 1 from public.comments parent
        where parent.id = comments.parent_id
          and parent.article_id = comments.article_id
      )
    )
  );
create policy "comments own update" on public.comments
  for update to authenticated
  using (
    member_id = auth.uid()
    and exists (
      select 1 from public.members m
      where m.id = auth.uid() and m.paid_through_year is not null
    )
    and exists (
      select 1 from public.articles a
      where a.id = comments.article_id and a.status = 'approved'
    )
  )
  with check (
    member_id = auth.uid()
    and exists (
      select 1 from public.members m
      where m.id = auth.uid() and m.paid_through_year is not null
    )
    and exists (
      select 1 from public.articles a
      where a.id = comments.article_id and a.status = 'approved'
    )
  );
revoke update on public.comments from authenticated;
grant select, insert, delete on public.comments to authenticated;
grant update (body) on public.comments to authenticated;

commit;
