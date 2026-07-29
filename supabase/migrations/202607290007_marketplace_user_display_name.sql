-- Compatibility for the shared school invitation flow in i-scores.
-- The school administrator screen reads marketplace_users.display_name.

alter table public.marketplace_users
  add column if not exists display_name text;

update public.marketplace_users
set display_name = trim(concat_ws(' ', first_name, last_name))
where display_name is null or trim(display_name) = '';
