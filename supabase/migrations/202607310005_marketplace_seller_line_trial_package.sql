alter table public.marketplace_line_settings
  add column if not exists seller_trial_description text not null
    default 'ทดลองใช้ LINE แจ้งเตือนผ่าน OA ของระบบ E-KRU ฟรี 7 วัน';
alter table public.marketplace_line_settings
  add column if not exists seller_trial_days integer not null default 7
    check (seller_trial_days > 0);
alter table public.marketplace_line_settings
  add column if not exists seller_trial_quota integer not null default 10
    check (seller_trial_quota > 0);

alter table public.marketplace_seller_line_settings
  add column if not exists line_display_name text;
alter table public.marketplace_seller_line_settings
  add column if not exists line_linked_at timestamptz;

create table if not exists public.marketplace_seller_line_link_tokens (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null unique references public.marketplace_sellers(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

alter table public.marketplace_seller_line_link_tokens enable row level security;
