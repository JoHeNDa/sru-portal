-- Run ONCE in the Supabase SQL Editor (after schema.sql and patch-1.sql).
-- Lets staff see member names in the CPD review queue without opening the whole members table to coordinators.

create function cpd_queue() returns table (
  id uuid, member_name text, member_type text, title text, points int, year int,
  proof_path text, status review_status, rejection_reason text, added_by_staff boolean
) language sql stable security definer set search_path = public as $$
  select c.id, m.full_name, m.member_type, c.title, c.points, c.year, c.proof_path, c.status, c.rejection_reason, c.added_by_staff
  from cpd_entries c join members m on m.id = c.member_id
  where is_staff()
  order by (c.status = 'pending') desc, c.created_at desc $$;

create function member_directory() returns table (id uuid, full_name text, member_type text, paid_through_year int)
language sql stable security definer set search_path = public as $$
  select id, full_name, member_type, paid_through_year from members where is_staff() order by full_name $$;

revoke execute on function cpd_queue() from public, anon;
revoke execute on function member_directory() from public, anon;
grant execute on function cpd_queue() to authenticated;
grant execute on function member_directory() to authenticated;
