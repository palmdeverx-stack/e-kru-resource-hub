alter table public.marketplace_provider_settings
  add column if not exists clamav_host text,
  add column if not exists clamav_port integer not null default 3310;

alter table public.marketplace_provider_settings
  drop constraint if exists marketplace_provider_settings_clamav_port_check;

alter table public.marketplace_provider_settings
  add constraint marketplace_provider_settings_clamav_port_check
  check (clamav_port between 1 and 65535);

comment on column public.marketplace_provider_settings.clamav_host is
  'Hostname or IP address of the ClamAV clamd service. No URL protocol.';

comment on column public.marketplace_provider_settings.clamav_port is
  'TCP port of the ClamAV clamd service.';
