create table if not exists public.admin_mobile_device_tokens (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  fcm_token text not null unique,
  platform text not null default 'android',
  notifications_enabled boolean not null default true,
  important_only boolean not null default false,
  chat_notification_pending boolean not null default false,
  chat_last_read_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.admin_mobile_device_tokens
  add column if not exists chat_notification_pending boolean not null default false,
  add column if not exists chat_last_read_at timestamptz;

create index if not exists admin_mobile_device_tokens_admin_user_id_idx
  on public.admin_mobile_device_tokens(admin_user_id);

create index if not exists admin_mobile_device_tokens_active_idx
  on public.admin_mobile_device_tokens(platform, notifications_enabled)
  where revoked_at is null;

alter table public.admin_mobile_device_tokens enable row level security;

drop policy if exists "No direct client access to admin mobile tokens" on public.admin_mobile_device_tokens;
create policy "No direct client access to admin mobile tokens"
  on public.admin_mobile_device_tokens
  for all
  using (false)
  with check (false);
