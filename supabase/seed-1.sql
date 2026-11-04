-- SAMPLE CONTENT so the landing page is not empty. Run once. You will replace all of it from the admin pages.
insert into hero_slides (headline, body, button_label, button_href, sort) values
 ('Advancing radiography practice in Uganda', 'Professional development, standards and a voice for radiographers across the country.', 'Become a member', '/join', 1),
 ('Annual Scientific Conference', 'Registration opens soon to members and guests.', 'View events', '/#events', 2),
 ('Track your CPD points', 'Submit certificates for verification and follow your yearly progress.', 'Open my membership', '/member', 3);

insert into articles (author_id, title, body, status) values
 (null, 'Welcome to the new SRU portal', 'Members can now register, renew and record their CPD points online, and build a verified career record for job applications.', 'approved'),
 (null, 'Annual membership renewal', 'Membership runs from 1 January to 31 December. Renew early to avoid the late renewal fine.', 'approved'),
 (null, 'Radiation safety guidance for district hospitals', 'Practical measures for protecting staff and patients where resources are limited, prepared with the technical committee.', 'approved');

insert into events (title, venue_date, description) values
 ('Annual Scientific Conference', 'Kampala, November', 'Plenary talks, workshops and CPD accredited sessions over three days.'),
 ('Radiation Protection Workshop', 'Mbarara, August', 'A hands-on one-day workshop on dosimetry and room design.'),
 ('CT Dose Optimisation Webinar', 'Online, June', 'Practical protocols for reducing dose in CT without losing image quality.');

insert into committee (year, role, full_name, email) values
 (extract(year from now())::int, 'President', 'Dr. A. Mugisha', 'president@sru.example'),
 (extract(year from now())::int, 'Secretary', 'B. Namuli', 'secretary@sru.example'),
 (extract(year from now())::int, 'Treasurer', 'C. Okello', 'treasurer@sru.example'),
 (extract(year from now())::int - 1, 'President', 'Dr. D. Ssemwogerere', 'past-president@sru.example'),
 (extract(year from now())::int - 1, 'Secretary', 'E. Akello', 'past-secretary@sru.example'),
 (extract(year from now())::int - 1, 'Treasurer', 'F. Kato', 'past-treasurer@sru.example');

insert into site_settings (key, value) values
 ('contact_email', 'info@sru.example'), ('contact_phone', '+256 700 000 000'), ('contact_address', 'Kampala, Uganda')
 on conflict (key) do nothing;
