-- Financial state changes are service-role-only transactions. No bank transfer is made here.
alter table public.marketplace_payouts alter column account_number_snapshot drop not null;
alter table public.marketplace_ledger_entries
  add column if not exists refund_event_key text not null default '';
-- Keep the old 3-column index while the old application is serving requests.
-- Remove it with migration 006 only AFTER deploying the 4-column conflict targets.
create unique index if not exists marketplace_ledger_order_scope_type_refund_key
  on public.marketplace_ledger_entries(order_id, account_scope, entry_type, refund_event_key);
create unique index if not exists marketplace_payout_reference_normalized_key
  on public.marketplace_payouts(upper(btrim(transfer_reference)))
  where transfer_reference is not null;

create table if not exists public.marketplace_stripe_refund_totals (
  stripe_charge_id text primary key,
  payment_session_id uuid not null references public.marketplace_payment_sessions(id),
  charge_amount bigint not null check(charge_amount > 0),
  refunded_amount bigint not null default 0 check(refunded_amount >= 0 and refunded_amount <= charge_amount),
  updated_at timestamptz not null default now()
);
alter table public.marketplace_stripe_refund_totals enable row level security;
revoke all on public.marketplace_stripe_refund_totals from anon, authenticated;
grant all on public.marketplace_stripe_refund_totals to service_role;

create or replace function public.create_marketplace_seller_payout(
  p_seller_id uuid, p_bank_code text, p_bank_name text,
  p_account_name text, p_account_number_encrypted text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_amount numeric; v_minimum numeric; v_currency text; v_currencies integer;
  v_ids uuid[]; v_payout public.marketplace_payouts;
begin
  perform pg_advisory_xact_lock(hashtextextended('seller-payout:' || p_seller_id::text, 0));
  if nullif(btrim(p_bank_code),'') is null or nullif(btrim(p_bank_name),'') is null
     or length(btrim(p_account_name)) < 2 or p_account_number_encrypted not like 'fin-v1.%'
     or p_account_number_encrypted is null then
    raise exception 'PAYOUT_INVALID_BANK' using errcode = '22023';
  end if;
  select coalesce(minimum_payout,100) into v_minimum
    from public.marketplace_finance_settings where id = 'default';
  select array_agg(id), round(sum(amount),2), min(currency), count(distinct currency)
    into v_ids,v_amount,v_currency,v_currencies
    from (select id,amount,currency from public.marketplace_ledger_entries
      where seller_id=p_seller_id and account_scope='seller' and payout_id is null
        and (available_at <= now() or amount < 0)
      order by id for update) eligible;
  if v_amount is null or v_amount <= 0 or v_amount < coalesce(v_minimum,100) then
    raise exception 'PAYOUT_BELOW_MINIMUM' using errcode='22023';
  end if;
  if v_currencies <> 1 then raise exception 'PAYOUT_CURRENCY_MISMATCH' using errcode='22023'; end if;
  insert into public.marketplace_payouts(seller_id,amount,currency,bank_code_snapshot,
    bank_name_snapshot,account_name_snapshot,account_number_snapshot,account_number_snapshot_encrypted)
  values(p_seller_id,v_amount,v_currency,p_bank_code,p_bank_name,p_account_name,null,p_account_number_encrypted)
  returning * into v_payout;
  update public.marketplace_ledger_entries set payout_id=v_payout.id where id=any(v_ids);
  return to_jsonb(v_payout);
end;
$$;

create or replace function public.finish_marketplace_seller_payout(
  p_payout_id uuid, p_status text, p_reference text, p_reason text, p_processed_by uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_seller_id uuid; v_owner uuid; v_payout public.marketplace_payouts;
  v_reference text := upper(btrim(coalesce(p_reference,'')));
  v_reason text := btrim(coalesce(p_reason,'')); v_reserved numeric;
begin
  if p_status not in ('processing','paid','failed') or p_status is null then
    raise exception 'PAYOUT_INVALID_STATUS' using errcode='22023'; end if;
  if p_status='paid' and (length(v_reference)<4 or length(v_reference)>100) then
    raise exception 'PAYOUT_INVALID_REFERENCE' using errcode='22023'; end if;
  if p_status='failed' and length(v_reason)<3 then
    raise exception 'PAYOUT_INVALID_REASON' using errcode='22023'; end if;
  select seller_id into v_seller_id from public.marketplace_payouts where id=p_payout_id;
  if not found then raise exception 'PAYOUT_NOT_FOUND' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended('seller-payout:' || v_seller_id::text,0));
  select * into v_payout from public.marketplace_payouts where id=p_payout_id for update;
  select owner_id into v_owner from public.marketplace_sellers where id=v_seller_id;
  if v_payout.status=p_status and
      (p_status='processing' or (p_status='paid' and v_payout.transfer_reference=v_reference)
       or (p_status='failed' and v_payout.failure_reason=v_reason)) then
    return jsonb_build_object('payout',to_jsonb(v_payout),'owner_id',v_owner,'already_processed',true);
  end if;
  if v_payout.status not in ('pending','processing') then
    raise exception 'PAYOUT_ALREADY_PROCESSED'; end if;
  if p_status='paid' and v_payout.status<>'processing' then
    raise exception 'PAYOUT_NOT_STARTED'; end if;
  if p_status in ('processing','paid') then
    select round(sum(amount),2) into v_reserved from public.marketplace_ledger_entries where payout_id=p_payout_id;
    if v_reserved is distinct from v_payout.amount then raise exception 'PAYOUT_RESERVATION_MISMATCH'; end if;
  end if;
  if p_status='paid' then
    perform pg_advisory_xact_lock(hashtextextended('payout-reference:' || v_reference,0));
    if exists(select 1 from public.marketplace_payouts
      where upper(btrim(transfer_reference))=v_reference and id<>p_payout_id) then
      raise exception 'PAYOUT_DUPLICATE_REFERENCE' using errcode='23505'; end if;
  end if;
  update public.marketplace_payouts set status=p_status,
    transfer_reference=case when p_status='paid' then v_reference else null end,
    failure_reason=case when p_status='failed' then v_reason else null end,
    processed_at=case when p_status='processing' then null else now() end,
    processed_by=p_processed_by,updated_at=now()
    where id=p_payout_id returning * into v_payout;
  if p_status='failed' then
    update public.marketplace_ledger_entries set payout_id=null where payout_id=p_payout_id;
  end if;
  return jsonb_build_object('payout',to_jsonb(v_payout),'owner_id',v_owner,'already_processed',false);
end;
$$;

create or replace function public.reconcile_marketplace_stripe_refund(
  p_session_id uuid, p_charge_id text, p_charge_amount bigint, p_refunded_amount bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_previous bigint; v_charge_amount bigint; v_seller uuid; v_order record; v_sale record;
  v_payout record; v_shipment record; v_delta numeric; v_key text; v_currency text;
begin
  if p_charge_amount is null or p_refunded_amount is null or p_charge_amount<=0
    or p_refunded_amount<0 or p_refunded_amount>p_charge_amount or nullif(p_charge_id,'') is null then
    raise exception 'REFUND_INVALID_AMOUNT' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payment-refund:'||p_session_id::text,0));
  select currency into v_currency from public.marketplace_payment_sessions
    where id=p_session_id and payment_method='stripe' and status in ('verified','disputed')
      and round(amount*100)=p_charge_amount;
  if not found then raise exception 'REFUND_SESSION_MISMATCH' using errcode='22023'; end if;
  insert into public.marketplace_stripe_refund_totals(stripe_charge_id,payment_session_id,charge_amount)
    values(p_charge_id,p_session_id,p_charge_amount) on conflict do nothing;
  select refunded_amount,charge_amount into v_previous,v_charge_amount
    from public.marketplace_stripe_refund_totals
    where stripe_charge_id=p_charge_id and payment_session_id=p_session_id for update;
  if not found or v_charge_amount<>p_charge_amount then raise exception 'REFUND_CHARGE_MISMATCH'; end if;
  if p_refunded_amount<=v_previous then
    return jsonb_build_object('already_processed',true,'full_refund',v_previous=p_charge_amount);
  end if;
  for v_seller in select distinct seller_id from public.marketplace_orders
      where payment_session_id=p_session_id order by seller_id loop
    perform pg_advisory_xact_lock(hashtextextended('seller-payout:'||v_seller::text,0));
  end loop;
  -- A pending transfer has not been exported/started. Invalidate its old amount.
  -- Processing/paid transfers retain their history; the debit offsets the next payout.
  for v_payout in select distinct p.id from public.marketplace_payouts p
    join public.marketplace_ledger_entries l on l.payout_id=p.id
    join public.marketplace_orders o on o.id=l.order_id
    where o.payment_session_id=p_session_id and p.status='pending' order by p.id loop
    update public.marketplace_payouts set status='cancelled',
      failure_reason='คืนเงินลูกค้า กรุณาสร้างรายการใหม่จากยอดปัจจุบัน',updated_at=now()
      where id=v_payout.id;
    update public.marketplace_ledger_entries set payout_id=null where payout_id=v_payout.id;
  end loop;
  v_key := p_charge_id||':'||p_refunded_amount::text;
  for v_order in select id,seller_id from public.marketplace_orders where payment_session_id=p_session_id loop
    if not exists(select 1 from public.marketplace_ledger_entries
      where order_id=v_order.id and account_scope='seller' and entry_type='sale') then
      raise exception 'REFUND_LEDGER_NOT_READY';
    end if;
    for v_sale in select account_scope,amount from public.marketplace_ledger_entries
      where order_id=v_order.id and entry_type in ('sale','commission') and refund_event_key='' loop
      v_delta := round(v_sale.amount*p_refunded_amount/p_charge_amount,2)
                 - round(v_sale.amount*v_previous/p_charge_amount,2);
      if v_delta<>0 then
        insert into public.marketplace_ledger_entries(order_id,seller_id,account_scope,entry_type,
          amount,currency,available_at,description,refund_event_key)
        values(v_order.id,v_order.seller_id,v_sale.account_scope,'refund',-v_delta,v_currency,now(),
          'Stripe refund '||p_charge_id,v_key);
      end if;
    end loop;
  end loop;
  for v_shipment in select s.* from public.marketplace_shipments s
    join public.marketplace_orders o on o.id=s.order_id where o.payment_session_id=p_session_id
    order by s.id for update of s loop
    v_delta := greatest(0,round(v_shipment.shipping_fee*p_refunded_amount/p_charge_amount,2)
      - coalesce(v_shipment.refunded_amount,0));
    if v_delta>0 then
      insert into public.marketplace_shipping_ledger_entries(shipment_id,order_id,entry_type,amount,
        currency,reference,idempotency_key)
      values(v_shipment.id,v_shipment.order_id,'customer_refund',-v_delta,v_currency,p_charge_id,
        'shipping-refund:'||v_key||':'||v_shipment.id::text);
      update public.marketplace_shipments
        set refunded_amount=coalesce(refunded_amount,0)+v_delta,
          reconciliation_status=case when p_refunded_amount=p_charge_amount then 'refunded' else reconciliation_status end,
          status=case when p_refunded_amount=p_charge_amount and status in ('pending','ready') then 'cancelled' else status end,
          updated_at=now() where id=v_shipment.id;
    end if;
  end loop;
  update public.marketplace_stripe_refund_totals set refunded_amount=p_refunded_amount,updated_at=now()
    where stripe_charge_id=p_charge_id;
  return jsonb_build_object('already_processed',false,'full_refund',p_refunded_amount=p_charge_amount);
end;
$$;

revoke all on function public.create_marketplace_seller_payout(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.finish_marketplace_seller_payout(uuid,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.reconcile_marketplace_stripe_refund(uuid,text,bigint,bigint) from public,anon,authenticated;
grant execute on function public.create_marketplace_seller_payout(uuid,text,text,text,text) to service_role;
grant execute on function public.finish_marketplace_seller_payout(uuid,text,text,text,uuid) to service_role;
grant execute on function public.reconcile_marketplace_stripe_refund(uuid,text,bigint,bigint) to service_role;
