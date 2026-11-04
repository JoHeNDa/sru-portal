-- ============================================================
-- SRU Portal — consolidated schema
-- Replaces: schema.sql, patch-1 through patch-13, articles-crud.sql,
-- engagement.sql, events-register-fee.sql, member-crud.sql,
-- storage-delete.sql, start-new-term.sql
--
-- Run ONCE on a fresh Supabase project (SQL Editor).
-- After this: run seed.sql for sample content.
-- ============================================================

-- ============================================================
-- 1. Enums
-- ============================================================
create type staff_role as enum ('chief_admin', 'admin', 'cpd_coordinator');
create type review_status as enum ('pending', 'verified', 'rejected');

-- ============================================================
-- 2. Tables
-- ============================================================

create table membership_types (
  code text primary key,
  registration_fee numeric not null,
  renewal_fee numeric not null,
  late_fine numeric not null default 0,
  cpd_min int not null default 0
);

create table staff_roles (
  email text primary key,
  name text not null,
  role staff_role not null
);

create table members (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  title text,
  full_name text not null,
  member_type text not null references membership_types(code),
  designation text,
  ahpc_no text,
  reg_no text,
  phone text,
  workplace text,
  bio text,
  avatar_path text,
  paid_through_year int,
  created_at timestamptz not null default now()
);

create table applications (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  title text,
  full_name text not null,
  member_type text not null references membership_types(code),
  designation text,
  ahpc_no text,
  reg_no text,
  phone text,
  workplace text,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id),
  applicant_id uuid,
  purpose text not null check (purpose in ('registration', 'renewal')),
  year int not null,
  amount numeric not null,
  fine numeric not null default 0,
  currency text not null default 'UGX',
  order_tracking_id text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'reversed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table cpd_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  title text not null,
  points int not null check (points > 0),
  year int not null default extract(year from now()),
  proof_path text,
  status review_status not null default 'pending',
  rejection_reason text,
  added_by_staff boolean not null default false,
  reviewed_by text,
  created_at timestamptz not null default now()
);

create table career_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  kind text not null check (kind in ('education', 'employment')),
  organisation text not null,
  title text not null,
  from_year int not null,
  to_year int,
  proof_path text not null,
  status review_status not null default 'pending',
  rejection_reason text,
  reviewed_by text
);

create table articles (
  id bigint generated always as identity primary key,
  author_id uuid references members(id),
  title text not null,
  body text not null,
  image_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decline_reason text,
  created_at timestamptz not null default now()
);

create table article_reactions (
  article_id bigint not null references articles(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  kind text not null check (kind in ('like', 'unlike')),
  primary key (article_id, member_id)
);

create table comments (
  id bigint generated always as identity primary key,
  article_id bigint not null references articles(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  parent_id bigint references comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table hero_slides (
  id bigint generated always as identity primary key,
  headline text,
  body text,
  button_label text,
  button_href text,
  image_path text,
  sort int default 0,
  live boolean default true
);

create table events (
  id bigint generated always as identity primary key,
  title text,
  venue_date text,
  description text,
  image_path text,
  starts_on date,
  ends_on date,
  register_url text,
  is_paid boolean not null default false,
  fee_amount numeric check (fee_amount is null or fee_amount >= 0)
);

create table committee_terms (
  id bigint generated always as identity primary key,
  starts_on date not null,
  ends_on date
);

create table committee (
  id bigint generated always as identity primary key,
  term_id bigint not null references committee_terms(id) on delete cascade,
  role text not null,
  full_name text not null,
  email text not null,
  phone text,
  workplace text,
  photo_path text,
  message text,
  sort int not null default 0
);

create table site_settings (
  key text primary key,
  value text
);

create table homepage_showcases (
  slot smallint primary key check (slot between 1 and 3),
  label text,
  sub_label text,
  message text not null default '',
  image_path text,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 3. RLS enable
-- ============================================================
alter table membership_types enable row level security;
alter table staff_roles enable row level security;
alter table members enable row level security;
alter table applications enable row level security;
alter table payments enable row level security;
alter table cpd_entries enable row level security;
alter table career_entries enable row level security;
alter table articles enable row level security;
alter table article_reactions enable row level security;
alter table comments enable row level security;
alter table hero_slides enable row level security;
alter table events enable row level security;
alter table committee_terms enable row level security;
alter table committee enable row level security;
alter table site_settings enable row level security;
alter table homepage_showcases enable row level security;

-- ============================================================
-- 4. Helper functions
-- ============================================================
create or replace function my_role() returns staff_role
language sql stable security definer set search_path = public as $$
  select role from staff_roles where lower(email) = lower(auth.jwt()->>'email')
$$;

create or replace function is_admin() returns boolean
language sql stable as $$
  select coalesce(my_role() in ('chief_admin', 'admin'), false)
$$;

create or replace function is_staff() returns boolean
language sql stable as $$
  select my_role() is not null
$$;

-- ============================================================
-- 5. Business functions
-- ============================================================

create or replace function member_stats() returns json
language sql stable security definer set search_path = public as $$
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
  from members
$$;

create or replace function confirm_payment(p_id uuid, p_tracking text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  p payments;
  a applications;
  target_member_id uuid;
begin
  select * into p from payments where id = p_id for update;
  if not found or p.status = 'completed' then return; end if;

  if p.purpose = 'registration' then
    target_member_id := coalesce(p.applicant_id, p.member_id);
    if target_member_id is null then raise exception 'Registration payment has no applicant'; end if;
    select * into a from applications where id = target_member_id;
    if not found then raise exception 'Registration application was not found'; end if;

    insert into members as existing_member (
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
    update members
      set paid_through_year = greatest(coalesce(paid_through_year, 0), p.year)
      where id = target_member_id;
    if not found then raise exception 'Member for renewal payment was not found'; end if;
  end if;

  update payments set member_id = target_member_id, status = 'completed',
    confirmed_at = now(), order_tracking_id = p_tracking where id = p_id;
end $$;

create or replace function cpd_queue() returns table (
  id uuid, member_id uuid, member_name text, member_type text, title text, points int, year int,
  proof_path text, status review_status, rejection_reason text, added_by_staff boolean
) language sql stable security definer set search_path = public as $$
  select c.id, c.member_id, m.full_name, m.member_type, c.title, c.points, c.year,
    c.proof_path, c.status, c.rejection_reason, c.added_by_staff
  from cpd_entries c join members m on m.id = c.member_id
  where is_staff()
  order by (c.status = 'pending') desc, c.created_at desc
$$;

create or replace function member_directory() returns table (id uuid, full_name text, member_type text, paid_through_year int)
language sql stable security definer set search_path = public as $$
  select id, full_name, member_type, paid_through_year
  from members
  where is_staff() and paid_through_year is not null
  order by full_name
$$;

create or replace function public_committee() returns table (
  term_id bigint, starts_on date, ends_on date, is_current boolean,
  role text, full_name text, photo_path text, message text
)
language sql stable security definer set search_path = public as $$
  with recent_terms as (
    select id, starts_on, ends_on, row_number() over (order by starts_on desc, id desc) as position
    from committee_terms
  )
  select
    terms.id, terms.starts_on, terms.ends_on, terms.ends_on is null,
    members.role, members.full_name, members.photo_path, members.message
  from recent_terms as terms
  join committee as members on members.term_id = terms.id
  where terms.position <= 2
  order by terms.starts_on desc, members.sort, members.id
$$;

create or replace function public_all_committees() returns table (
  member_id bigint, term_id bigint, starts_on date, ends_on date, is_current boolean,
  role text, full_name text, photo_path text, message text
)
language sql stable security definer set search_path = public as $$
  select
    members.id, terms.id, terms.starts_on, terms.ends_on, terms.ends_on is null,
    members.role, members.full_name, members.photo_path, members.message
  from committee_terms as terms
  left join committee as members on members.term_id = terms.id
  order by terms.starts_on desc, terms.id desc, members.sort, members.id
$$;

create or replace function start_new_term(p_start date) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  cur committee_terms;
  new_id bigint;
begin
  if not is_admin() then raise exception 'Only admins can start a new term'; end if;
  select * into cur from committee_terms where ends_on is null;
  if found then
    if p_start <= cur.starts_on then
      raise exception 'The new term must start after the current term began (%).', cur.starts_on;
    end if;
    update committee_terms set ends_on = p_start - 1 where id = cur.id;
  end if;
  insert into committee_terms (starts_on) values (p_start) returning id into new_id;
  return new_id;
end $$;

create or replace function proof_is_unreferenced(p_path text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_staff()
    and not exists (select 1 from cpd_entries c where c.proof_path = p_path)
    and not exists (select 1 from career_entries c where c.proof_path = p_path)
$$;

-- ============================================================
-- 6. Trigger functions + triggers
-- ============================================================

create or replace function protect_member_cpd_edits() returns trigger
language plpgsql set search_path = public, auth as $$
begin
  if old.member_id = auth.uid() and not is_staff() then
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
      raise exception 'CPD proof must be stored in the members own folder';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_member_cpd_edits on cpd_entries;
create trigger protect_member_cpd_edits
  before update on cpd_entries
  for each row execute function protect_member_cpd_edits();

create or replace function protect_member_career_edits() returns trigger
language plpgsql set search_path = public, auth as $$
begin
  if old.member_id = auth.uid() and not is_staff() then
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
      raise exception 'Career proof must be stored in the members own folder';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_member_career_edits on career_entries;
create trigger protect_member_career_edits
  before update on career_entries
  for each row execute function protect_member_career_edits();

create or replace function protect_member_article_edits() returns trigger
language plpgsql set search_path = public, auth as $$
begin
  if old.author_id = auth.uid() and not is_admin() then
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
      raise exception 'Article images must be stored in the members own folder';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_member_article_edits on articles;
create trigger protect_member_article_edits
  before update on articles
  for each row execute function protect_member_article_edits();

-- ============================================================
-- 7. View: public_profiles
-- ============================================================
create or replace view public_profiles as
  select id, full_name, workplace, bio, avatar_path
  from members
  where paid_through_year is not null;

-- ============================================================
-- 8. RLS policies
-- ============================================================

-- membership_types
drop policy if exists "types readable" on membership_types;
create policy "types readable" on membership_types for select using (true);
drop policy if exists "types write" on membership_types;
create policy "types write" on membership_types for all
  using (my_role() = 'chief_admin') with check (my_role() = 'chief_admin');

-- staff_roles
drop policy if exists "roles read" on staff_roles;
create policy "roles read" on staff_roles for select using (is_staff());
drop policy if exists "roles write" on staff_roles;
create policy "roles write" on staff_roles for all
  using (my_role() = 'chief_admin') with check (my_role() = 'chief_admin');

-- members
drop policy if exists "member self read" on members;
create policy "member self read" on members for select using (id = auth.uid() or is_admin());
drop policy if exists "member self update" on members;
create policy "member self update" on members for update
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "members admin edit" on members;
create policy "members admin edit" on members for update
  using (is_admin()) with check (is_admin());

-- applications
drop policy if exists "application self read" on applications;
create policy "application self read" on applications for select using (id = auth.uid());
drop policy if exists "application self insert" on applications;
create policy "application self insert" on applications for insert
  with check (id = auth.uid() and email = auth.jwt()->>'email');
drop policy if exists "application self update" on applications;
create policy "application self update" on applications for update
  using (id = auth.uid()) with check (id = auth.uid() and email = auth.jwt()->>'email');

-- payments
drop policy if exists "own payments" on payments;
create policy "own payments" on payments for select
  using (member_id = auth.uid() or applicant_id = auth.uid() or is_admin());

-- cpd_entries
drop policy if exists "cpd read" on cpd_entries;
create policy "cpd read" on cpd_entries for select using (member_id = auth.uid() or is_staff());
drop policy if exists "cpd submit" on cpd_entries;
create policy "cpd submit" on cpd_entries for insert
  with check (member_id = auth.uid() and status = 'pending' and not added_by_staff);
drop policy if exists "cpd staff add" on cpd_entries;
create policy "cpd staff add" on cpd_entries for insert
  with check (my_role() in ('chief_admin', 'admin', 'cpd_coordinator'));
drop policy if exists "cpd review" on cpd_entries;
create policy "cpd review" on cpd_entries for update
  using (my_role() in ('chief_admin', 'admin', 'cpd_coordinator'));
drop policy if exists "cpd member edit" on cpd_entries;
create policy "cpd member edit" on cpd_entries for update to authenticated
  using (member_id = auth.uid() and status in ('pending', 'rejected') and not added_by_staff)
  with check (member_id = auth.uid() and status in ('pending', 'rejected') and not added_by_staff);
drop policy if exists "cpd member delete" on cpd_entries;
create policy "cpd member delete" on cpd_entries for delete to authenticated
  using (member_id = auth.uid() and status in ('pending', 'rejected') and not added_by_staff);
drop policy if exists "cpd staff delete" on cpd_entries;
create policy "cpd staff delete" on cpd_entries for delete to authenticated
  using (my_role() in ('chief_admin', 'admin', 'cpd_coordinator'));

-- career_entries
drop policy if exists "career read" on career_entries;
create policy "career read" on career_entries for select using (member_id = auth.uid() or is_admin());
drop policy if exists "career add" on career_entries;
create policy "career add" on career_entries for insert
  with check (member_id = auth.uid() and status = 'pending');
drop policy if exists "career review" on career_entries;
create policy "career review" on career_entries for update using (is_admin());
drop policy if exists "career member edit" on career_entries;
create policy "career member edit" on career_entries for update to authenticated
  using (member_id = auth.uid() and status in ('pending', 'rejected'))
  with check (member_id = auth.uid() and status in ('pending', 'rejected'));
drop policy if exists "career member delete" on career_entries;
create policy "career member delete" on career_entries for delete to authenticated
  using (member_id = auth.uid() and status in ('pending', 'rejected'));
drop policy if exists "career admin delete" on career_entries;
create policy "career admin delete" on career_entries for delete to authenticated
  using (is_admin());

-- articles
drop policy if exists "articles public" on articles;
create policy "articles public" on articles for select
  using (status = 'approved' or author_id = auth.uid() or is_admin());
drop policy if exists "articles submit" on articles;
create policy "articles submit" on articles for insert
  with check (author_id = auth.uid() and status = 'pending');
drop policy if exists "articles admin" on articles;
create policy "articles admin" on articles for all
  using (is_admin()) with check (is_admin());
drop policy if exists "articles author edit" on articles;
create policy "articles author edit" on articles for update to authenticated
  using (author_id = auth.uid() and status in ('pending', 'declined'))
  with check (author_id = auth.uid() and status in ('pending', 'declined'));
drop policy if exists "articles author delete" on articles;
create policy "articles author delete" on articles for delete to authenticated
  using (author_id = auth.uid() and status in ('pending', 'declined'));

-- article_reactions
drop policy if exists "reactions read" on article_reactions;
create policy "reactions read" on article_reactions for select using (true);
drop policy if exists "reactions own insert" on article_reactions;
create policy "reactions own insert" on article_reactions for insert to authenticated
  with check (
    member_id = auth.uid()
    and exists (select 1 from members m where m.id = auth.uid() and m.paid_through_year is not null)
    and exists (select 1 from articles a where a.id = article_reactions.article_id and a.status = 'approved')
  );
drop policy if exists "reactions own update" on article_reactions;
create policy "reactions own update" on article_reactions for update to authenticated
  using (member_id = auth.uid() and exists (select 1 from members m where m.id = auth.uid() and m.paid_through_year is not null))
  with check (
    member_id = auth.uid()
    and exists (select 1 from members m where m.id = auth.uid() and m.paid_through_year is not null)
    and exists (select 1 from articles a where a.id = article_reactions.article_id and a.status = 'approved')
  );
drop policy if exists "reactions own delete" on article_reactions;
create policy "reactions own delete" on article_reactions for delete to authenticated
  using (member_id = auth.uid());

-- comments
drop policy if exists "comments read" on comments;
create policy "comments read" on comments for select using (true);
drop policy if exists "comments own insert" on comments;
create policy "comments own insert" on comments for insert to authenticated
  with check (
    member_id = auth.uid()
    and exists (select 1 from members m where m.id = auth.uid() and m.paid_through_year is not null)
    and exists (select 1 from articles a where a.id = comments.article_id and a.status = 'approved')
    and (comments.parent_id is null or exists (
      select 1 from comments parent
      where parent.id = comments.parent_id and parent.article_id = comments.article_id
    ))
  );
drop policy if exists "comments own update" on comments;
create policy "comments own update" on comments for update to authenticated
  using (
    member_id = auth.uid()
    and exists (select 1 from members m where m.id = auth.uid() and m.paid_through_year is not null)
    and exists (select 1 from articles a where a.id = comments.article_id and a.status = 'approved')
  )
  with check (
    member_id = auth.uid()
    and exists (select 1 from members m where m.id = auth.uid() and m.paid_through_year is not null)
    and exists (select 1 from articles a where a.id = comments.article_id and a.status = 'approved')
  );
drop policy if exists "comments moderate" on comments;
create policy "comments moderate" on comments for delete
  using (member_id = auth.uid() or is_admin());

-- hero_slides
drop policy if exists "hero public" on hero_slides;
create policy "hero public" on hero_slides for select using (live or is_admin());
drop policy if exists "hero admin" on hero_slides;
create policy "hero admin" on hero_slides for all
  using (is_admin()) with check (is_admin());

-- events
drop policy if exists "events public" on events;
create policy "events public" on events for select using (true);
drop policy if exists "events admin" on events;
create policy "events admin" on events for all
  using (is_admin()) with check (is_admin());

-- committee_terms
drop policy if exists "committee terms admin read" on committee_terms;
create policy "committee terms admin read" on committee_terms for select to authenticated using (is_admin());
drop policy if exists "committee terms admin edit" on committee_terms;
create policy "committee terms admin edit" on committee_terms for update to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists "committee terms admin delete" on committee_terms;
create policy "committee terms admin delete" on committee_terms for delete to authenticated
  using (is_admin());

-- committee
drop policy if exists "committee admin" on committee;
create policy "committee admin" on committee for all
  using (is_admin()) with check (is_admin());

-- site_settings
drop policy if exists "settings public" on site_settings;
create policy "settings public" on site_settings for select using (true);
drop policy if exists "settings admin" on site_settings;
create policy "settings admin" on site_settings for all
  using (is_admin()) with check (is_admin());

-- homepage_showcases
drop policy if exists "homepage showcases public read" on homepage_showcases;
create policy "homepage showcases public read" on homepage_showcases
  for select to anon, authenticated
  using (image_path is not null and length(trim(message)) > 0);
drop policy if exists "homepage showcases admin read" on homepage_showcases;
create policy "homepage showcases admin read" on homepage_showcases
  for select to authenticated using (is_admin());
drop policy if exists "homepage showcases admin insert" on homepage_showcases;
create policy "homepage showcases admin insert" on homepage_showcases
  for insert to authenticated with check (is_admin());
drop policy if exists "homepage showcases admin update" on homepage_showcases;
create policy "homepage showcases admin update" on homepage_showcases
  for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "homepage showcases admin delete" on homepage_showcases;
create policy "homepage showcases admin delete" on homepage_showcases
  for delete to authenticated using (is_admin());

-- ============================================================
-- 9. Grants
-- ============================================================
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

revoke insert on members from anon, authenticated;
revoke update on members from authenticated;
grant update (full_name, phone, workplace, bio, avatar_path) on members to authenticated;

revoke update on article_reactions from authenticated;
grant insert, delete on article_reactions to authenticated;
grant update (kind) on article_reactions to authenticated;

revoke update on comments from authenticated;
grant insert, delete on comments to authenticated;
grant update (body) on comments to authenticated;

revoke execute on function confirm_payment(uuid, text) from public, anon, authenticated;
grant execute on function confirm_payment(uuid, text) to service_role;

revoke execute on function proof_is_unreferenced(text) from public, anon;
grant execute on function proof_is_unreferenced(text) to authenticated;

revoke execute on function protect_member_cpd_edits() from public, anon, authenticated;
revoke execute on function protect_member_career_edits() from public, anon, authenticated;
revoke execute on function protect_member_article_edits() from public, anon, authenticated;

-- ============================================================
-- 10. Storage buckets + policies
-- ============================================================
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('public-media', 'public-media', true) on conflict (id) do nothing;

drop policy if exists "proofs upload own" on storage.objects;
create policy "proofs upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "proofs read" on storage.objects;
create policy "proofs read" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and ((storage.foldername(name))[1] = auth.uid()::text or is_staff()));
drop policy if exists "proofs upload staff" on storage.objects;
create policy "proofs upload staff" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and is_staff());
drop policy if exists "proofs delete own unverified" on storage.objects;
create policy "proofs delete own unverified" on storage.objects for delete to authenticated
  using (
    bucket_id = 'proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (select 1 from cpd_entries c where c.proof_path = objects.name and c.status = 'verified')
    and not exists (select 1 from career_entries c where c.proof_path = objects.name and c.status = 'verified')
  );
drop policy if exists "proofs delete staff unreferenced" on storage.objects;
create policy "proofs delete staff unreferenced" on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and is_staff() and proof_is_unreferenced(name));

drop policy if exists "media read" on storage.objects;
create policy "media read" on storage.objects for select using (bucket_id = 'public-media');
drop policy if exists "media upload" on storage.objects;
create policy "media upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));
drop policy if exists "media replace admin" on storage.objects;
create policy "media replace admin" on storage.objects for update to authenticated
  using (bucket_id = 'public-media' and is_admin());
drop policy if exists "media delete admin" on storage.objects;
create policy "media delete admin" on storage.objects for delete to authenticated
  using (bucket_id = 'public-media' and is_admin());
drop policy if exists "media delete own article image" on storage.objects;
create policy "media delete own article image" on storage.objects for delete to authenticated
  using (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (select 1 from articles a where a.image_path = objects.name)
  );

-- ============================================================
-- 11. Default data (required by the app)
-- ============================================================
insert into membership_types (code, registration_fee, renewal_fee, late_fine, cpd_min) values
  ('professional', 150000, 100000, 20000, 20),
  ('student', 30000, 20000, 5000, 0)
on conflict (code) do nothing;

insert into site_settings (key, value) values
  ('contact_email', 'info@sru.example'),
  ('contact_phone', '+256 700 000 000'),
  ('contact_address', 'Kampala, Uganda')
on conflict (key) do nothing;

-- ============================================================
-- 12. First chief admin — UNCOMMENT and edit, then run
-- ============================================================
-- insert into staff_roles (email, name, role) values
--   ('your.email@gmail.com', 'Your Name', 'chief_admin')
-- on conflict (email) do nothing;

notify pgrst, 'reload schema';