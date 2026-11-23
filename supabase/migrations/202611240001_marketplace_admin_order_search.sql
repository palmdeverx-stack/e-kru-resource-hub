create or replace function public.search_marketplace_admin_orders(
  p_search text,
  p_status text,
  p_order_id uuid,
  p_offset integer
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with search_term as (
    select lower(btrim(p_search)) as name,
           lower(regexp_replace(btrim(p_search), '^(#|ORD-)', '', 'i')) as reference
  ),
  matching as materialized (
    select orders.id, orders.created_at
    from public.marketplace_orders as orders
    left join public.marketplace_users as members on members.id = orders.buyer_id
    left join public.app_users as app_users on app_users.id = orders.buyer_id
    cross join search_term as term
    where (p_status is null or orders.status = p_status)
      and (p_order_id is null or orders.id = p_order_id)
      and char_length(term.name) between 1 and 100
      and (
        (term.reference ~ '^[0-9a-f]{8}([0-9a-f-]{0,28})$'
          and starts_with(orders.id::text, term.reference))
        or strpos(lower(coalesce(members.display_name, '')), term.name) > 0
        or strpos(lower(concat_ws(' ', members.first_name, members.last_name)), term.name) > 0
        or strpos(lower(coalesce(members.username, '')), term.name) > 0
        or strpos(lower(concat_ws(' ', app_users.first_name, app_users.last_name)), term.name) > 0
        or strpos(lower(coalesce(app_users.username, '')), term.name) > 0
      )
  ),
  page as (
    select id, created_at from matching
    order by created_at desc, id desc
    limit 25 offset greatest(p_offset, 0)
  )
  select jsonb_build_object(
    'ids', coalesce((select jsonb_agg(id order by created_at desc, id desc) from page), '[]'::jsonb),
    'total', (select count(*) from matching)
  );
$$;

revoke all on function public.search_marketplace_admin_orders(text, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.search_marketplace_admin_orders(text, text, uuid, integer)
  to service_role;
