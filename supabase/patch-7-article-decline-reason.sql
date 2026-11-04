-- Run once in the Supabase SQL Editor after patch-4-admin-content-crud.sql.
-- The admin article workflow stores a reason when an article is declined.

begin;

alter table public.articles
  add column if not exists decline_reason text;

grant update (title, body, image_path, status, decline_reason)
  on public.articles to authenticated;

commit;
