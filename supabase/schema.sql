-- SRU membership portal: schema, roles, row level security, payment confirmation.
-- Run in the Supabase SQL editor. Membership is calendar-year based:
-- a member is active when paid_through_year >= the current year.

create type staff_role as enum ('chief_admin','admin','cpd_coordinator');
create type review_status as enum ('pending','verified','rejected');

create table membership_types (
  code text primary key,                 -- 'professional' | 'student'
  registration_fee numeric not null,
  renewal_fee numeric not null,
  late_fine numeric not null default 0,
  cpd_min int not null default 0
);
insert into membership_types values
 ('professional',150000,100000,20000,20),
 ('student',30000,20000,5000,0);        -- placeholder amounts: set real ones

create table staff_roles (
  email text primary key,                -- must equal the person's Google account email
  name text not null,
  role staff_role not null
);

create table members (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  member_type text not null references membership_types(code),
  reg_no text, phone text, workplace text, bio text, avatar_path text,
  paid_through_year int,                 -- set only by confirm_payment()
  created_at timestamptz not null default now()
);

create table applications (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  member_type text not null references membership_types(code),
  reg_no text,
  phone text,
  workplace text,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),   -- also the Pesapal merchant reference
  member_id uuid references members(id),
  applicant_id uuid,
  purpose text not null check (purpose in ('registration','renewal')),
  year int not null,
  amount numeric not null,
  fine numeric not null default 0,
  currency text not null default 'UGX',
  order_tracking_id text,
  status text not null default 'pending' check (status in ('pending','completed','failed','reversed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table cpd_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  title text not null, points int not null check (points > 0),
  year int not null default extract(year from now()),
  proof_path text,
  status review_status not null default 'pending',
  rejection_reason text,
  added_by_staff boolean not null default false,
  reviewed_by text, created_at timestamptz not null default now()
);

create table career_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  kind text not null check (kind in ('education','employment')),
  organisation text not null, title text not null,
  from_year int not null, to_year int,
  proof_path text not null,              -- admission or posting letter is mandatory
  status review_status not null default 'pending',
  rejection_reason text, reviewed_by text
);

create table articles (
  id bigint generated always as identity primary key,
  author_id uuid references members(id),  -- null = Secretariat
  title text not null, body text not null, image_path text,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  decline_reason text,
  created_at timestamptz not null default now()
);
create table article_reactions (
  article_id bigint references articles(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  kind text not null check (kind in ('like','unlike')),
  primary key (article_id, member_id)
);
create table comments (
  id bigint generated always as identity primary key,
  article_id bigint not null references articles(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  parent_id bigint references comments(id) on delete cascade,
  body text not null, created_at timestamptz not null default now()
);

create table hero_slides (id bigint generated always as identity primary key, headline text, body text,
  button_label text, button_href text, image_path text, sort int default 0, live boolean default true);
create table events (id bigint generated always as identity primary key, title text, venue_date text,
  description text, image_path text, starts_on date);
create table committee (id bigint generated always as identity primary key, year int not null, role text not null,
  full_name text not null, email text not null, phone text, workplace text, photo_path text);
create table site_settings (key text primary key, value text);   -- e.g. 'logo_path'

-- Roles ---------------------------------------------------------------
create function my_role() returns staff_role language sql stable security definer set search_path=public as $$
  select role from staff_roles where lower(email) = lower(auth.jwt()->>'email') $$;
create function is_admin() returns boolean language sql stable as $$
  select coalesce(my_role() in ('chief_admin','admin'), false) $$;
create function is_staff() returns boolean language sql stable as $$ select my_role() is not null $$;

-- Row level security --------------------------------------------------
alter table membership_types enable row level security; alter table staff_roles enable row level security;
alter table members enable row level security; alter table applications enable row level security;
alter table payments enable row level security;
alter table cpd_entries enable row level security; alter table career_entries enable row level security;
alter table articles enable row level security; alter table article_reactions enable row level security;
alter table comments enable row level security; alter table hero_slides enable row level security;
alter table events enable row level security; alter table committee enable row level security;
alter table site_settings enable row level security;

create policy "types readable" on membership_types for select using (true);
-- Only the chief admin changes roles. Admins and coordinators may read the list.
create policy "roles read" on staff_roles for select using (is_staff());
create policy "roles write" on staff_roles for all using (my_role()='chief_admin') with check (my_role()='chief_admin');
create policy "types write" on membership_types for all using (my_role()='chief_admin') with check (my_role()='chief_admin');

create policy "member self read" on members for select using (id = auth.uid() or is_admin());
create policy "member self update" on members for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on members from authenticated;
grant update (full_name, phone, workplace, bio, avatar_path) on members to authenticated;
-- paid_through_year is never writable from the browser.

create policy "application self read" on applications for select using (id = auth.uid());
create policy "application self insert" on applications for insert
  with check (id = auth.uid() and email = auth.jwt()->>'email');
create policy "application self update" on applications for update
  using (id = auth.uid()) with check (id = auth.uid() and email = auth.jwt()->>'email');
grant select, insert, update on applications to authenticated;
revoke insert on members from anon, authenticated;

create policy "own payments" on payments for select using (member_id = auth.uid() or applicant_id = auth.uid() or is_admin());   -- no client writes

create policy "cpd read" on cpd_entries for select using (member_id = auth.uid() or is_staff());
create policy "cpd submit" on cpd_entries for insert with check (member_id = auth.uid() and status='pending' and not added_by_staff);
create policy "cpd staff add" on cpd_entries for insert with check (my_role() in ('chief_admin','admin','cpd_coordinator'));
create policy "cpd review" on cpd_entries for update using (my_role() in ('chief_admin','admin','cpd_coordinator'));

create policy "career read" on career_entries for select using (member_id = auth.uid() or is_admin());
create policy "career add" on career_entries for insert with check (member_id = auth.uid() and status='pending');
create policy "career review" on career_entries for update using (is_admin());

create policy "articles public" on articles for select using (status='approved' or author_id = auth.uid() or is_admin());
create policy "articles submit" on articles for insert with check (author_id = auth.uid() and status='pending');
create policy "articles admin" on articles for all using (is_admin()) with check (is_admin());

create policy "reactions read" on article_reactions for select using (true);
create policy "reactions own insert" on article_reactions for insert to authenticated
  with check (
    member_id = auth.uid()
    and exists (select 1 from members m where m.id = auth.uid() and m.paid_through_year is not null)
    and exists (select 1 from articles a where a.id = article_id and a.status = 'approved')
  );
create policy "reactions own update" on article_reactions for update to authenticated
  using (
    member_id = auth.uid()
    and exists (select 1 from members m where m.id = auth.uid() and m.paid_through_year is not null)
  )
  with check (
    member_id = auth.uid()
    and exists (select 1 from members m where m.id = auth.uid() and m.paid_through_year is not null)
    and exists (select 1 from articles a where a.id = article_id and a.status = 'approved')
  );
create policy "reactions own delete" on article_reactions for delete to authenticated
  using (member_id = auth.uid());
revoke update on article_reactions from authenticated;
grant select, insert, delete on article_reactions to authenticated;
grant update (kind) on article_reactions to authenticated;
create policy "comments read" on comments for select using (true);
create policy "comments own insert" on comments for insert to authenticated
  with check (
    member_id = auth.uid()
    and exists (select 1 from members m where m.id = auth.uid() and m.paid_through_year is not null)
    and exists (select 1 from articles a where a.id = article_id and a.status = 'approved')
    and (comments.parent_id is null or exists (
      select 1 from comments parent
      where parent.id = comments.parent_id and parent.article_id = comments.article_id
    ))
  );
create policy "comments own update" on comments for update to authenticated
  using (
    member_id = auth.uid()
    and exists (select 1 from members m where m.id = auth.uid() and m.paid_through_year is not null)
    and exists (select 1 from articles a where a.id = article_id and a.status = 'approved')
  )
  with check (
    member_id = auth.uid()
    and exists (select 1 from members m where m.id = auth.uid() and m.paid_through_year is not null)
    and exists (select 1 from articles a where a.id = article_id and a.status = 'approved')
  );
create policy "comments moderate" on comments for delete using (member_id = auth.uid() or is_admin());
revoke update on comments from authenticated;
grant select, insert, delete on comments to authenticated;
grant update (body) on comments to authenticated;

create policy "hero public" on hero_slides for select using (live or is_admin());
create policy "hero admin" on hero_slides for all using (is_admin()) with check (is_admin());
create policy "events public" on events for select using (true);
create policy "events admin" on events for all using (is_admin()) with check (is_admin());
create policy "committee public" on committee for select using (year >= extract(year from now())-1 or is_admin());
create policy "committee admin" on committee for all using (is_admin()) with check (is_admin());
create policy "settings public" on site_settings for select using (true);
create policy "settings admin" on site_settings for all using (is_admin()) with check (is_admin());

-- Public pieces -------------------------------------------------------
create view public_profiles as
  select id, full_name, workplace, bio, avatar_path from members where paid_through_year is not null;
grant select on public_profiles to anon, authenticated;

create function member_stats() returns json language sql stable security definer set search_path=public as $$
  select json_build_object(
    'total', count(*) filter (where paid_through_year is not null),
    'active', count(*) filter (where paid_through_year >= extract(year from now())),
    'joined_this_year', count(*) filter (where extract(year from created_at) = extract(year from now()) and paid_through_year is not null)
  ) from members $$;
grant execute on function member_stats() to anon, authenticated;

-- The only way a membership becomes active ---------------------------
create function confirm_payment(p_id uuid, p_tracking text) returns void language plpgsql security definer set search_path=public as $$
declare
  p payments;
  a applications;
  target_member_id uuid;
begin
  select * into p from payments where id = p_id for update;
  if not found or p.status = 'completed' then return; end if;     -- idempotent
  if p.purpose = 'registration' then
    target_member_id := coalesce(p.applicant_id, p.member_id);
    if target_member_id is null then raise exception 'Registration payment has no applicant'; end if;
    select * into a from applications where id = target_member_id;
    if not found then raise exception 'Registration application was not found'; end if;
    insert into members as existing_member (id, email, full_name, member_type, reg_no, phone, workplace, paid_through_year)
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
    update members
      set paid_through_year = greatest(coalesce(paid_through_year, 0), p.year)
      where id = target_member_id;
    if not found then raise exception 'Member for renewal payment was not found'; end if;
  end if;
  update payments set member_id = target_member_id, status='completed',
    confirmed_at=now(), order_tracking_id=p_tracking where id = p_id;
end $$;
revoke execute on function confirm_payment(uuid, text) from public, anon, authenticated;
grant execute on function confirm_payment(uuid, text) to service_role;

-- First chief admin: insert yourself once, then manage others from the app.
-- insert into staff_roles values ('you@gmail.com','Your Name','chief_admin');
