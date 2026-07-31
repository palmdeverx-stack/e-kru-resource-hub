alter table public.marketplace_products
  add column if not exists license_target_system text;

update public.marketplace_products
set license_target_system = case
  when exists (
    select 1
    from unnest(coalesce(grants_feature_keys, array[]::text[])) as feature_key
    where feature_key ~ '^(admin|teacher|student|academic)\.'
  ) or grants_plan_code is not null then 'ekru'
  else 'marketplace'
end
where resource_type = 'feature_unlock';

update public.marketplace_products
set license_target_system = null
where resource_type <> 'feature_unlock';

alter table public.marketplace_products
  drop constraint if exists marketplace_products_license_target_system_check;

alter table public.marketplace_products
  add constraint marketplace_products_license_target_system_check check (
    (resource_type = 'feature_unlock' and license_target_system in ('marketplace', 'ekru'))
    or (resource_type <> 'feature_unlock' and license_target_system is null)
  );

-- LINE notifications for parents are an E-KRU school feature. Keep seller
-- payment notifications (marketplace.seller_line_*) in Marketplace.
update public.marketplace_products
set
  license_scope = 'school',
  license_seat_count = 1,
  external_links = jsonb_build_array(
    jsonb_build_object(
      'label',
      'เปิดใช้งานใน E-KRU',
      'url',
      'https://e-kru.com/admin/line-notifications/?source=marketplace'
    )
  ),
  updated_at = now()
where
  resource_type = 'feature_unlock'
  and (
    grants_feature_key = 'admin.line_notifications'
    or grants_feature_keys @> array['admin.line_notifications']::text[]
  );
