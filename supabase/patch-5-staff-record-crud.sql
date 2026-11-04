-- Run once in the Supabase SQL Editor after schema.sql and patches 1-4.
-- Staff can correct CPD records; admins can correct career records.

grant update (title, points, year, proof_path, status, rejection_reason, reviewed_by)
  on public.cpd_entries to authenticated;
grant delete on public.cpd_entries to authenticated;

drop policy if exists "cpd staff delete" on public.cpd_entries;
create policy "cpd staff delete" on public.cpd_entries
  for delete to authenticated
  using (public.my_role() in ('chief_admin', 'admin', 'cpd_coordinator'));

grant update (kind, organisation, title, from_year, to_year, proof_path, status, rejection_reason, reviewed_by)
  on public.career_entries to authenticated;
grant delete on public.career_entries to authenticated;

drop policy if exists "career admin delete" on public.career_entries;
create policy "career admin delete" on public.career_entries
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "proofs upload staff" on storage.objects;
create policy "proofs upload staff" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'proofs' and public.is_staff());

create or replace function public.proof_is_unreferenced(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
    and not exists (
    select 1 from public.cpd_entries c where c.proof_path = p_path
  ) and not exists (
    select 1 from public.career_entries c where c.proof_path = p_path
  );
$$;

revoke all on function public.proof_is_unreferenced(text) from public, anon;
grant execute on function public.proof_is_unreferenced(text) to authenticated;

drop policy if exists "proofs delete staff unreferenced" on storage.objects;
create policy "proofs delete staff unreferenced" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'proofs'
    and public.is_staff()
    and public.proof_is_unreferenced(name)
  );

drop function if exists public.cpd_queue();
create function public.cpd_queue() returns table (
  id uuid, member_id uuid, member_name text, member_type text, title text, points int, year int,
  proof_path text, status review_status, rejection_reason text, added_by_staff boolean
) language sql stable security definer set search_path = public as $$
  select c.id, c.member_id, m.full_name, m.member_type, c.title, c.points, c.year,
    c.proof_path, c.status, c.rejection_reason, c.added_by_staff
  from public.cpd_entries c join public.members m on m.id = c.member_id
  where public.is_staff()
  order by (c.status = 'pending') desc, c.created_at desc
$$;

revoke execute on function public.cpd_queue() from public, anon;
grant execute on function public.cpd_queue() to authenticated;
