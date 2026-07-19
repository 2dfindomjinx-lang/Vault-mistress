create table if not exists public.wallpaper_device_events (
  id uuid primary key default gen_random_uuid(),
  app_key text not null,
  activation_id uuid not null references public.app_activation_codes(id) on delete cascade,
  event_type text not null check (event_type in ('wallpaper_changed')),
  changed_scopes text[] not null default '{}',
  system_wallpaper_id bigint,
  lock_wallpaper_id bigint,
  created_at timestamptz not null default now()
);

create index if not exists wallpaper_device_events_activation_created_idx
  on public.wallpaper_device_events(app_key, activation_id, created_at desc);

alter table public.wallpaper_device_events enable row level security;

create table if not exists public.wallpaper_live_messages (
  id uuid primary key default gen_random_uuid(),
  app_key text not null,
  activation_id uuid references public.app_activation_codes(id) on delete cascade,
  scope text not null check (scope in ('global', 'device')),
  message text not null check (char_length(message) between 1 and 240),
  version text not null,
  sender_role text not null default 'admin' check (sender_role in ('admin', 'sub')),
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (
    (scope = 'global' and activation_id is null) or
    (scope = 'device' and activation_id is not null)
  )
);

create unique index if not exists wallpaper_live_messages_one_active_global_idx
  on public.wallpaper_live_messages(app_key)
  where active and scope = 'global';

create unique index if not exists wallpaper_live_messages_one_active_device_idx
  on public.wallpaper_live_messages(app_key, activation_id)
  where active and scope = 'device';

create index if not exists wallpaper_live_messages_created_idx
  on public.wallpaper_live_messages(app_key, created_at desc);

create index if not exists wallpaper_live_messages_conversation_idx
  on public.wallpaper_live_messages(app_key, activation_id, created_at desc);

alter table public.wallpaper_live_messages enable row level security;

create table if not exists public.wallpaper_device_push_registrations (
  id uuid primary key default gen_random_uuid(),
  app_key text not null,
  activation_id uuid not null references public.app_activation_codes(id) on delete cascade,
  installation_id text not null,
  firebase_installation_id text not null unique,
  platform text not null default 'android',
  device_label text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists wallpaper_device_push_registrations_active_idx
  on public.wallpaper_device_push_registrations(app_key, activation_id)
  where revoked_at is null;

create index if not exists wallpaper_device_push_registrations_installation_idx
  on public.wallpaper_device_push_registrations(app_key, activation_id, installation_id);

alter table public.wallpaper_device_push_registrations enable row level security;
