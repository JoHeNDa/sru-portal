-- Run once in the Supabase SQL Editor after schema.sql and patch-4-admin-content-crud.sql.
-- Adds three admin-managed image/message placements for the public homepage.

create table if not exists public.homepage_showcases (
  slot smallint primary key check (slot between 1 and 3),
  label text,
  sub_label text,
  message text not null default '',
  image_path text,
  updated_at timestamptz not null default now()
);

alter table public.homepage_showcases enable row level security;

grant select on public.homepage_showcases to anon, authenticated;
grant insert, update, delete on public.homepage_showcases to authenticated;

drop policy if exists "homepage showcases public read" on public.homepage_showcases;
create policy "homepage showcases public read" on public.homepage_showcases
  for select to anon, authenticated
  using (image_path is not null and length(trim(message)) > 0);

drop policy if exists "homepage showcases admin read" on public.homepage_showcases;
create policy "homepage showcases admin read" on public.homepage_showcases
  for select to authenticated
  using (public.is_admin());

drop policy if exists "homepage showcases admin insert" on public.homepage_showcases;
create policy "homepage showcases admin insert" on public.homepage_showcases
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "homepage showcases admin update" on public.homepage_showcases;
create policy "homepage showcases admin update" on public.homepage_showcases
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "homepage showcases admin delete" on public.homepage_showcases;
create policy "homepage showcases admin delete" on public.homepage_showcases
  for delete to authenticated
  using (public.is_admin());
