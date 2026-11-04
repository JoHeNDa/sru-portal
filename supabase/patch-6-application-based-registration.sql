-- Run once in the Supabase SQL Editor after schema.sql and patches 1-5.
-- Applicants remain in applications until a verified registration payment is confirmed.

begin;

create table if not exists public.applications (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  member_type text not null references public.membership_types(code),
  reg_no text,
  phone text,
  workplace text,
  created_at timestamptz not null default now()
);

alter table public.applications enable row level security;
drop policy if exists "application self read" on public.applications;
drop policy if exists "application self insert" on public.applications;
drop policy if exists "application self update" on public.applications;
create policy "application self read" on public.applications
  for select to authenticated using (id = auth.uid());
create policy "application self insert" on public.applications
  for insert to authenticated
  with check (id = auth.uid() and email = auth.jwt()->>'email');
create policy "application self update" on public.applications
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and email = auth.jwt()->>'email');
grant select, insert, update on public.applications to authenticated;

insert into public.applications (id, email, full_name, member_type, reg_no, phone, workplace)
  select id, email, full_name, member_type, reg_no, phone, workplace
  from public.members
  where paid_through_year is null
on conflict (id) do nothing;

alter table public.payments alter column member_id drop not null;
alter table public.payments add column if not exists applicant_id uuid;
update public.payments as payment
  set applicant_id = payment.member_id, member_id = null
  from public.members as member
  where payment.member_id = member.id
    and member.paid_through_year is null
    and payment.purpose = 'registration'
    and payment.status <> 'completed';
drop policy if exists "own payments" on public.payments;
create policy "own payments" on public.payments
  for select using (member_id = auth.uid() or applicant_id = auth.uid() or public.is_admin());

drop policy if exists "member self insert" on public.members;
revoke insert on public.members from anon, authenticated;

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

    insert into public.members as existing_member (id, email, full_name, member_type, reg_no, phone, workplace, paid_through_year)
      values (a.id, a.email, a.full_name, a.member_type, a.reg_no, a.phone, a.workplace, p.year)
      on conflict (id) do update set
        email = excluded.email,
        full_name = excluded.full_name,
        member_type = excluded.member_type,
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

create or replace function public.member_directory()
returns table (id uuid, full_name text, member_type text, paid_through_year int)
language sql
stable
security definer
set search_path = public
as $$
  select id, full_name, member_type, paid_through_year
  from public.members
  where public.is_staff() and paid_through_year is not null
  order by full_name
$$;
revoke execute on function public.member_directory() from public, anon;
grant execute on function public.member_directory() to authenticated;

commit;
