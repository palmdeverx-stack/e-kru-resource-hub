-- Supabase Safe Update rejects UPDATE statements without an explicit filter.
-- Every legal document intentionally receives the current platform provider snapshot.
create or replace function public.sync_marketplace_provider_to_legal_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.marketplace_legal_documents
  set
    provider_type = new.provider_type,
    provider_name = case
      when new.provider_type = 'company' then nullif(trim(new.company_name), '')
      else nullif(trim(concat_ws(' ', new.first_name, new.last_name)), '')
    end,
    provider_registration_no = case
      when new.provider_type = 'company' then nullif(trim(new.company_registration_no), '')
      else null
    end,
    provider_tax_id = nullif(trim(new.tax_id), ''),
    provider_address = nullif(trim(new.address), ''),
    contact_email = nullif(trim(new.contact_email), ''),
    provider_phone = nullif(trim(new.contact_phone), ''),
    updated_at = now()
  where id is not null;

  return new;
end;
$$;
