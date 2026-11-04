-- Run once after patch-11-homepage-showcases.sql.
-- Adds an optional secondary label for homepage showcase ad placements.

alter table public.homepage_showcases
  add column if not exists sub_label text;

notify pgrst, 'reload schema';
