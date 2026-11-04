-- Run once in the Supabase SQL Editor after the committee terms/content patches.
-- Adds a public message for each committee member while keeping contact details private.

begin;

alter table public.committee
  add column if not exists message text;

grant select, insert, update, delete on public.committee to authenticated;

drop function if exists public.public_committee();

create function public.public_committee()
returns table (
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
  with recent_terms as (
    select id, starts_on, ends_on, row_number() over (order by starts_on desc, id desc) as position
    from public.committee_terms
  )
  select
    terms.id,
    terms.starts_on,
    terms.ends_on,
    terms.ends_on is null,
    members.role,
    members.full_name,
    members.photo_path,
    members.message
  from recent_terms as terms
  join public.committee as members on members.term_id = terms.id
  where terms.position <= 2
  order by terms.starts_on desc, members.sort, members.id
$$;

revoke execute on function public.public_committee() from public;
grant execute on function public.public_committee() to anon, authenticated;

commit;
