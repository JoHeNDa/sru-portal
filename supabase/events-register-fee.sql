-- Registration link, free or paid, amount and end date for events. Run once.
alter table events
  add column if not exists ends_on date,
  add column if not exists register_url text,
  add column if not exists is_paid boolean not null default false,
  add column if not exists fee_amount numeric check (fee_amount is null or fee_amount >= 0);

-- Sample dates so you can see upcoming and past events side by side. Replace these from the Content page.
update events set starts_on = current_date + 30, ends_on = current_date + 32, is_paid = true, fee_amount = 50000,
  register_url = 'https://example.com/register' where title = 'Annual Scientific Conference';
update events set starts_on = make_date(extract(year from now())::int, 8, 14), register_url = 'https://example.com/register'
  where title = 'Radiation Protection Workshop';
update events set starts_on = make_date(extract(year from now())::int, 6, 5), register_url = 'https://example.com/register'
  where title = 'CT Dose Optimisation Webinar';
