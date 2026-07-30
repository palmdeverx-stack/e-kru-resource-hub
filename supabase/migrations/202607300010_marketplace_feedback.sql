create table if not exists public.marketplace_feedback (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  reporter_username text not null,
  reporter_role text not null,
  school_id uuid,
  category text not null
    check (category in ('feature', 'improvement', 'bug', 'blocker', 'general')),
  title text not null,
  system_area text,
  current_behavior text,
  requested_change text,
  blocker_detail text,
  page_url text,
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'planned', 'resolved', 'closed')),
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_feedback_reporter_created_idx
  on public.marketplace_feedback (reporter_id, created_at desc);
create index if not exists marketplace_feedback_status_created_idx
  on public.marketplace_feedback (status, created_at desc);
