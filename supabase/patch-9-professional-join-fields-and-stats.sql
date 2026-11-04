-- Run once in the Supabase SQL Editor after patch-6-application-based-registration.sql.
-- Professional details remain on the application until registration payment is confirmed.

begin;

alter table public.applications
  add column if not exists title text,
  add column if not exists designation text,
  add column if not exists ahpc_no text;

alter table public.members
  add column if not exists title text,
  add column if not exists designation text,
  add column if not exists ahpc_no text;

create or replace function public.confirm_payment(p_id uuid, p_tracking text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.payments;
  a public.applications;
  target_member_id uuid;
begin
  select * into p from public.payments where id = p_id for update;
  if not found or p.status = 'completed' then return; end if;

  if p.purpose = 'registration' then
    target_member_id := coalesce(p.applicant_id, p.member_id);
    if target_member_id is null then raise exception 'Registration payment has no applicant'; end if;
    select * into a from public.applications where id = target_member_id;
    if not found then raise exception 'Registration application was not found'; end if;

    insert into public.members as existing_member (
      id, email, title, full_name, member_type, designation, ahpc_no,
      reg_no, phone, workplace, paid_through_year
    )
    values (
      a.id, a.email, a.title, a.full_name, a.member_type, a.designation, a.ahpc_no,
      a.reg_no, a.phone, a.workplace, p.year
    )
    on conflict (id) do update set
      email = excluded.email,
      title = excluded.title,
      full_name = excluded.full_name,
      member_type = excluded.member_type,
      designation = excluded.designation,
      ahpc_no = excluded.ahpc_no,
      reg_no = excluded.reg_no,
      phone = excluded.phone,
      workplace = excluded.workplace,
      paid_through_year = greatest(coalesce(existing_member.paid_through_year, 0), excluded.paid_through_year);
  else
    target_member_id := p.member_id;
    if target_member_id is null then raise exception 'Renewal payment has no member'; end if;
    update public.members
      set paid_through_year = greatest(coalesce(paid_through_year, 0), p.year)
      where id = target_member_id;
    if not found then raise exception 'Member for renewal payment was not found'; end if;
  end if;

  update public.payments set member_id = target_member_id, status = 'completed',
    confirmed_at = now(), order_tracking_id = p_tracking where id = p_id;
end;
$$;

revoke execute on function public.confirm_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_payment(uuid, text) to service_role;

create or replace function public.member_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total', count(*) filter (where paid_through_year is not null),
    'active', count(*) filter (where paid_through_year >= extract(year from now())),
    'joined_this_year', count(*) filter (
      where extract(year from created_at) = extract(year from now())
        and paid_through_year is not null
    ),
    'imaging_technologists', count(*) filter (
      where paid_through_year is not null and designation = 'Imaging Technologist'
    ),
    'sonographers', count(*) filter (
      where paid_through_year is not null and designation = 'Sonographer'
    ),
    'radiographers', count(*) filter (
      where paid_through_year is not null and designation = 'Radiographer'
    )
  )
  from public.members
$$;

revoke execute on function public.member_stats() from public;
grant execute on function public.member_stats() to anon, authenticated;

commit;
