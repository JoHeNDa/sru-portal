-- Run once in the Supabase SQL Editor after schema.sql, patch-1.sql and patch-2.sql.
-- Members may update or delete their own pending/rejected submissions. Verified and
-- staff-awarded CPD records remain protected by both RLS and the trigger guards below.

drop policy if exists "cpd member edit" on public.cpd_entries;
create policy "cpd member edit" on public.cpd_entries
  for update to authenticated
  using (member_id = auth.uid() and status in ('pending', 'rejected') and not added_by_staff)
  with check (member_id = auth.uid() and status in ('pending', 'rejected') and not added_by_staff);

drop policy if exists "cpd member delete" on public.cpd_entries;
create policy "cpd member delete" on public.cpd_entries
  for delete to authenticated
  using (member_id = auth.uid() and status in ('pending', 'rejected') and not added_by_staff);

drop policy if exists "career member edit" on public.career_entries;
create policy "career member edit" on public.career_entries
  for update to authenticated
  using (member_id = auth.uid() and status in ('pending', 'rejected'))
  with check (member_id = auth.uid() and status in ('pending', 'rejected'));

drop policy if exists "career member delete" on public.career_entries;
create policy "career member delete" on public.career_entries
  for delete to authenticated
  using (member_id = auth.uid() and status in ('pending', 'rejected'));

grant delete on public.cpd_entries, public.career_entries to authenticated;

create or replace function public.protect_member_cpd_edits()
returns trigger
language plpgsql
set search_path = public, auth
as $$
begin
  if old.member_id = auth.uid() and not public.is_staff() then
    if old.status = 'verified' or old.added_by_staff then
      raise exception 'Members cannot edit verified or staff-awarded CPD entries';
    end if;
    if new.member_id is distinct from old.member_id
      or new.year is distinct from old.year
      or new.added_by_staff is distinct from old.added_by_staff
      or new.created_at is distinct from old.created_at then
      raise exception 'Members can only edit the details and proof of their CPD entry';
    end if;
    if old.status = 'pending' then
      if new.status is distinct from old.status
        or new.rejection_reason is distinct from old.rejection_reason
        or new.reviewed_by is distinct from old.reviewed_by then
        raise exception 'Pending CPD review fields cannot be changed by a member';
      end if;
    elsif old.status = 'rejected' then
      if new.status <> 'pending'
        or new.rejection_reason is not null
        or new.reviewed_by is not null then
        raise exception 'Editing a rejected CPD entry must resubmit it for review';
      end if;
    end if;
    if new.proof_path is not null
      and (storage.foldername(new.proof_path))[1] <> auth.uid()::text then
      raise exception 'CPD proof must be stored in the member’s own folder';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_member_cpd_edits on public.cpd_entries;
create trigger protect_member_cpd_edits
  before update on public.cpd_entries
  for each row execute function public.protect_member_cpd_edits();

create or replace function public.protect_member_career_edits()
returns trigger
language plpgsql
set search_path = public, auth
as $$
begin
  if old.member_id = auth.uid() and not public.is_staff() then
    if old.status = 'verified' then
      raise exception 'Members cannot edit verified career entries';
    end if;
    if new.member_id is distinct from old.member_id then
      raise exception 'Members can only edit the details and proof of their career entry';
    end if;
    if old.status = 'pending' then
      if new.status is distinct from old.status
        or new.rejection_reason is distinct from old.rejection_reason
        or new.reviewed_by is distinct from old.reviewed_by then
        raise exception 'Pending career review fields cannot be changed by a member';
      end if;
    elsif old.status = 'rejected' then
      if new.status <> 'pending'
        or new.rejection_reason is not null
        or new.reviewed_by is not null then
        raise exception 'Editing a rejected career entry must resubmit it for review';
      end if;
    end if;
    if new.proof_path is null
      or (storage.foldername(new.proof_path))[1] <> auth.uid()::text then
      raise exception 'Career proof must be stored in the member’s own folder';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_member_career_edits on public.career_entries;
create trigger protect_member_career_edits
  before update on public.career_entries
  for each row execute function public.protect_member_career_edits();

drop policy if exists "proofs delete own unverified" on storage.objects;
create policy "proofs delete own unverified" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (
      select 1 from public.cpd_entries c
      where c.proof_path = objects.name and c.status = 'verified'
    )
    and not exists (
      select 1 from public.career_entries c
      where c.proof_path = objects.name and c.status = 'verified'
    )
  );
