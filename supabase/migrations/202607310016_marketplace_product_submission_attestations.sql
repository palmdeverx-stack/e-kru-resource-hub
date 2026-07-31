alter table public.marketplace_products
  add column if not exists submission_acceptance_snapshot jsonb not null default '{}'::jsonb;

alter table public.marketplace_product_review_submissions
  add column if not exists acceptance_version text,
  add column if not exists seller_attestations jsonb not null default '{}'::jsonb,
  add column if not exists legal_document_versions jsonb not null default '{}'::jsonb,
  add column if not exists accepted_by uuid,
  add column if not exists accepted_at timestamptz;

create or replace function public.capture_marketplace_product_review_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_submission_number integer;
  submitting_user_id uuid;
begin
  if new.submitted_at is distinct from old.submitted_at and new.submitted_at is not null then
    perform pg_advisory_xact_lock(hashtextextended(new.id::text, 0));

    select owner_id into submitting_user_id
      from public.marketplace_sellers
      where id = new.seller_id;

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
      acceptance_version,
      seller_attestations,
      legal_document_versions,
      accepted_by,
      accepted_at,
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
      nullif(new.submission_acceptance_snapshot ->> 'version', ''),
      coalesce(new.submission_acceptance_snapshot -> 'attestations', '{}'::jsonb),
      coalesce(new.submission_acceptance_snapshot -> 'legal_documents', '{}'::jsonb),
      submitting_user_id,
      new.submitted_at,
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
