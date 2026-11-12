-- Run AFTER deploying the application that uses the four-column conflict target.
-- Migration 005 alone remains compatible with the old application's upserts.
do $$ begin
  if to_regclass('public.marketplace_ledger_order_scope_type_refund_key') is null then
    raise exception 'Apply migration 202611120005 first';
  end if;
end $$;
drop index if exists public.marketplace_ledger_order_scope_type_key;
