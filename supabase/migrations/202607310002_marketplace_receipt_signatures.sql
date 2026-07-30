-- Private electronic-signature assets used by receipt issuers.

alter table public.marketplace_seller_documents
  drop constraint if exists marketplace_seller_documents_document_type_check;

alter table public.marketplace_seller_documents
  add constraint marketplace_seller_documents_document_type_check
  check (
    document_type in (
      'store_logo',
      'store_cover',
      'identity_card',
      'bank_book',
      'company_certificate',
      'vat_certificate',
      'receipt_signature'
    )
  );

alter table public.marketplace_receipts
  add column if not exists provider_signature_bucket text,
  add column if not exists provider_signature_path text,
  add column if not exists provider_signature_mime_type text;

comment on column public.marketplace_receipts.provider_signature_bucket is
  'Private storage bucket snapshot for the issuer signature used on this receipt.';
comment on column public.marketplace_receipts.provider_signature_path is
  'Immutable storage path snapshot for the issuer signature used on this receipt.';
comment on column public.marketplace_receipts.provider_signature_mime_type is
  'MIME type of the issuer signature snapshot.';
