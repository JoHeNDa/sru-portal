-- Run once in the Supabase SQL Editor after schema.sql and the earlier patches.
-- Adds admin editing for member details and committee terms, and allows admins
-- to remove unused files from the public-media bucket.

grant update (full_name, member_type, reg_no, phone, workplace, bio)
  on public.members to authenticated;

drop policy if exists "members admin edit" on public.members;
create policy "members admin edit" on public.members
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, update, delete on public.committee_terms to authenticated;

drop policy if exists "committee terms admin read" on public.committee_terms;
create policy "committee terms admin read" on public.committee_terms
  for select to authenticated
  using (public.is_admin());

drop policy if exists "committee terms admin edit" on public.committee_terms;
create policy "committee terms admin edit" on public.committee_terms
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "committee terms admin delete" on public.committee_terms;
create policy "committee terms admin delete" on public.committee_terms
  for delete to authenticated
  using (public.is_admin());

grant update (title, body, image_path, status, decline_reason) on public.articles to authenticated;
grant insert (author_id, title, body, image_path, status) on public.articles to authenticated;
grant delete on public.articles to authenticated;

drop policy if exists "articles author edit" on public.articles;
create policy "articles author edit" on public.articles
  for update to authenticated
  using (author_id = auth.uid() and status in ('pending', 'declined'))
  with check (author_id = auth.uid() and status in ('pending', 'declined'));

drop policy if exists "articles author delete" on public.articles;
create policy "articles author delete" on public.articles
  for delete to authenticated
  using (author_id = auth.uid() and status in ('pending', 'declined'));

create or replace function public.protect_member_article_edits()
returns trigger
language plpgsql
set search_path = public, auth
as $$
begin
  if old.author_id = auth.uid() and not public.is_admin() then
    if old.status = 'approved' then
      raise exception 'Members cannot edit published articles';
    end if;
    if new.author_id is distinct from old.author_id
      or new.created_at is distinct from old.created_at then
      raise exception 'Members can only edit their own article content';
    end if;
    if old.status = 'pending' and new.status is distinct from old.status then
      raise exception 'Pending articles cannot change review status';
    end if;
    if old.status = 'declined' and new.status <> 'pending' then
      raise exception 'Editing a declined article must resubmit it for approval';
    end if;
    if new.image_path is not null
      and (storage.foldername(new.image_path))[1] <> auth.uid()::text then
      raise exception 'Article images must be stored in the member’s own folder';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_member_article_edits on public.articles;
create trigger protect_member_article_edits
  before update on public.articles
  for each row execute function public.protect_member_article_edits();

drop policy if exists "media delete admin" on storage.objects;
create policy "media delete admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-media' and public.is_admin());

drop policy if exists "media delete own article image" on storage.objects;
create policy "media delete own article image" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (
      select 1 from public.articles a
      where a.image_path = objects.name
    )
  );
