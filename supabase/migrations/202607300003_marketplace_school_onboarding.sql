create table if not exists public.marketplace_school_onboardings (
  id uuid primary key default gen_random_uuid(),
  payment_session_id uuid not null unique
    references public.marketplace_payment_sessions(id) on delete cascade,
  buyer_id uuid not null,
  email text not null,
  token_hash text not null unique,
  token_ciphertext text not null,
  email_sent_at timestamptz,
  expires_at timestamptz not null,
  completed_at timestamptz,
  school_id uuid references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_school_onboardings_buyer_idx
  on public.marketplace_school_onboardings (buyer_id, created_at desc);

alter table public.marketplace_school_onboardings enable row level security;
