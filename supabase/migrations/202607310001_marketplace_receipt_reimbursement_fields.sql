-- Snapshot reimbursement details so issued receipts remain stable over time.

alter table public.marketplace_receipts
  add column if not exists provider_phone text,
  add column if not exists paid_at timestamptz,
  add column if not exists subtotal_amount numeric(12, 2),
  add column if not exists discount_amount numeric(12, 2) not null default 0,
  add column if not exists vat_amount numeric(12, 2) not null default 0;

with payment_summary as (
  select
    payment.id as payment_session_id,
    max(coalesce(marketplace_orders.paid_at, payment.reviewed_at, payment.submitted_at))
      as paid_at,
    coalesce(
      sum(
        coalesce(marketplace_orders.gross_amount, marketplace_orders.total)
        + coalesce(marketplace_orders.discount_amount, 0)
      ),
      payment.amount
    ) as subtotal_amount,
    coalesce(sum(marketplace_orders.discount_amount), 0) as discount_amount
  from public.marketplace_payment_sessions as payment
  left join public.marketplace_orders
    on marketplace_orders.payment_session_id = payment.id
  group by payment.id
)
update public.marketplace_receipts as receipt
set
  provider_phone = coalesce(receipt.provider_phone, seller.phone),
  paid_at = coalesce(receipt.paid_at, payment_summary.paid_at, receipt.issued_at),
  subtotal_amount = coalesce(
    receipt.subtotal_amount,
    greatest(receipt.amount, payment_summary.subtotal_amount)
  ),
  discount_amount = coalesce(payment_summary.discount_amount, receipt.discount_amount, 0)
from public.marketplace_sellers as seller,
  payment_summary
where seller.owner_id = receipt.issued_by
  and payment_summary.payment_session_id = receipt.payment_session_id;

update public.marketplace_receipts
set
  paid_at = coalesce(paid_at, issued_at),
  subtotal_amount = coalesce(subtotal_amount, amount + discount_amount);

alter table public.marketplace_receipts
  alter column paid_at set not null,
  alter column subtotal_amount set not null;

alter table public.marketplace_receipts
  drop constraint if exists marketplace_receipts_subtotal_amount_check,
  drop constraint if exists marketplace_receipts_discount_amount_check,
  drop constraint if exists marketplace_receipts_vat_amount_check;

alter table public.marketplace_receipts
  add constraint marketplace_receipts_subtotal_amount_check
    check (subtotal_amount >= 0),
  add constraint marketplace_receipts_discount_amount_check
    check (discount_amount >= 0),
  add constraint marketplace_receipts_vat_amount_check
    check (vat_amount >= 0);

comment on column public.marketplace_receipts.provider_phone is
  'Issuer phone snapshot shown on reimbursement receipts.';
comment on column public.marketplace_receipts.paid_at is
  'Verified payment date snapshot.';
comment on column public.marketplace_receipts.subtotal_amount is
  'Amount before product discounts and VAT summary.';
comment on column public.marketplace_receipts.discount_amount is
  'Product discount snapshot.';
comment on column public.marketplace_receipts.vat_amount is
  'VAT shown on the receipt; zero unless explicitly recorded.';
