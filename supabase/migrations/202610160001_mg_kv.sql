-- Marketing Genius server-side key/value storage for the existing API.
-- Run in the Supabase SQL Editor for the connected project.
create table if not exists public.mg_kv (
  key text primary key,
  value text not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists mg_kv_expires_at_idx on public.mg_kv (expires_at)
  where expires_at is not null;

alter table public.mg_kv enable row level security;

-- Intentionally create no anon/authenticated policies. Only the Edge Function's
-- server-side service-role client should access this table.
