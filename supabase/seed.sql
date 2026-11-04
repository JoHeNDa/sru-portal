-- ============================================================
-- SRU Portal — sample content
-- Run AFTER schema-consolidated.sql on a fresh project.
-- Run AFTER inserting your first chief admin.
-- All content here is replaceable from the admin UI.
-- ============================================================

-- Hero slides
insert into hero_slides (headline, body, button_label, button_href, sort) values
  ('Advancing radiography practice in Uganda', 'Professional development, standards and a voice for radiographers across the country.', 'Become a member', '/join', 1),
  ('Annual Scientific Conference', 'Registration opens soon to members and guests.', 'View events', '/events', 2),
  ('Track your CPD points', 'Submit certificates for verification and follow your yearly progress.', 'Open my membership', '/member', 3);

-- Articles
insert into articles (author_id, title, body, status) values
  (null, 'Welcome to the new SRU portal', 'Members can now register, renew and record their CPD points online, and build a verified career record for job applications.', 'approved'),
  (null, 'Annual membership renewal', 'Membership runs from 1 January to 31 December. Renew early to avoid the late renewal fine.', 'approved'),
  (null, 'Radiation safety guidance for district hospitals', 'Practical measures for protecting staff and patients where resources are limited, prepared with the technical committee.', 'approved');

-- Events
insert into events (title, venue_date, description, starts_on, ends_on, register_url) values
  ('Annual Scientific Conference', 'Kampala, November', 'Plenary talks, workshops and CPD accredited sessions over three days.',
   current_date + 30, current_date + 32, 'https://example.com/register'),
  ('Radiation Protection Workshop', 'Mbarara, August', 'A hands-on one-day workshop on dosimetry and room design.',
   make_date(extract(year from now())::int, 8, 14), null, 'https://example.com/register'),
  ('CT Dose Optimisation Webinar', 'Online, June', 'Practical protocols for reducing dose in CT without losing image quality.',
   make_date(extract(year from now())::int, 6, 5), null, 'https://example.com/register');

-- Committee: current term + members
with new_term as (
  insert into committee_terms (starts_on) values (make_date(extract(year from now())::int, 1, 1)) returning id
)
insert into committee (term_id, role, full_name, email, sort)
select id, role, full_name, email, sort from new_term, (values
  ('President', 'Dr. A. Mugisha', 'president@sru.example', 1),
  ('Secretary', 'B. Namuli', 'secretary@sru.example', 2),
  ('Treasurer', 'C. Okello', 'treasurer@sru.example', 3)
) as v(role, full_name, email, sort);

-- Previous term (for committee history demonstration)
with prev_term as (
  insert into committee_terms (starts_on, ends_on)
  values (make_date(extract(year from now())::int - 1, 1, 1), make_date(extract(year from now())::int, 1, 1) - 1)
  returning id
)
insert into committee (term_id, role, full_name, email, sort)
select id, role, full_name, email, sort from prev_term, (values
  ('President', 'Dr. D. Ssemwogerere', 'past-president@sru.example', 1),
  ('Secretary', 'E. Akello', 'past-secretary@sru.example', 2),
  ('Treasurer', 'F. Kato', 'past-treasurer@sru.example', 3)
) as v(role, full_name, email, sort);