create table if not exists public.marketplace_product_review_submissions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  submission_number integer not null check (submission_number > 0),
  product_title_snapshot text not null,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'published', 'rejected')),
  submitted_at timestamptz not null,
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, submission_number)
);

create index if not exists marketplace_product_review_submissions_product_idx
  on public.marketplace_product_review_submissions (product_id, submission_number desc);

alter table public.marketplace_product_review_submissions enable row level security;
revoke all on table public.marketplace_product_review_submissions from anon, authenticated;

create or replace function public.capture_marketplace_product_review_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_submission_number integer;
begin
  if new.submitted_at is distinct from old.submitted_at and new.submitted_at is not null then
    perform pg_advisory_xact_lock(hashtextextended(new.id::text, 0));

    select coalesce(max(submission_number), 0) + 1
      into next_submission_number
      from public.marketplace_product_review_submissions
      where product_id = new.id;

    insert into public.marketplace_product_review_submissions (
      product_id,
      submission_number,
      product_title_snapshot,
      status,
      submitted_at,
      reviewed_at,
      reviewed_by,
      rejection_reason,
      updated_at
    )
    values (
      new.id,
      next_submission_number,
      new.title,
      case
        when new.status in ('pending_review', 'published', 'rejected') then new.status
        else 'pending_review'
      end,
      new.submitted_at,
      new.reviewed_at,
      new.reviewed_by,
      new.rejection_reason,
      now()
    );
  elsif (
    new.status is distinct from old.status
    or new.reviewed_at is distinct from old.reviewed_at
    or new.rejection_reason is distinct from old.rejection_reason
  ) and new.status in ('published', 'rejected') then
    update public.marketplace_product_review_submissions
    set
      status = new.status,
      reviewed_at = new.reviewed_at,
      reviewed_by = new.reviewed_by,
      rejection_reason = new.rejection_reason,
      updated_at = now()
    where id = (
      select id
      from public.marketplace_product_review_submissions
      where product_id = new.id
      order by submission_number desc
      limit 1
    );
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_products_capture_review_history
  on public.marketplace_products;
create trigger marketplace_products_capture_review_history
after update of submitted_at, status, reviewed_at, rejection_reason
on public.marketplace_products
for each row
execute function public.capture_marketplace_product_review_history();

insert into public.marketplace_product_review_submissions (
  product_id,
  submission_number,
  product_title_snapshot,
  status,
  submitted_at,
  reviewed_at,
  reviewed_by,
  rejection_reason,
  created_at,
  updated_at
)
select
  id,
  1,
  title,
  status,
  submitted_at,
  reviewed_at,
  reviewed_by,
  rejection_reason,
  submitted_at,
  coalesce(reviewed_at, submitted_at)
from public.marketplace_products
where submitted_at is not null
  and status in ('pending_review', 'published', 'rejected')
on conflict (product_id, submission_number) do nothing;
