insert into public.marketplace_grade_levels (code, name, sort_order)
values
  ('k1', 'อ.1', 1),
  ('k2', 'อ.2', 2),
  ('k3', 'อ.3', 3)
on conflict do nothing;
