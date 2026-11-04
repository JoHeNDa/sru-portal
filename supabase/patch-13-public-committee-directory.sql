-- Run once in the Supabase SQL Editor after patch-10-committee-message.sql.
-- Exposes the complete committee history without exposing private contact fields.

create or replace function public.public_all_committees()
returns table (
  member_id bigint,
  term_id bigint,
  starts_on date,
  ends_on date,
  is_current boolean,
  role text,
  full_name text,
  photo_path text,
  message text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    members.id,
    terms.id,
    terms.starts_on,
    terms.ends_on,
    terms.ends_on is null,
    members.role,
    members.full_name,
    members.photo_path,
    members.message
  from public.committee_terms as terms
  left join public.committee as members on members.term_id = terms.id
  order by terms.starts_on desc, terms.id desc, members.sort, members.id
$$;

revoke execute on function public.public_all_committees() from public;
grant execute on function public.public_all_committees() to anon, authenticated;

notify pgrst, 'reload schema';
