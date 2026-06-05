create table if not exists public.x_rebrand_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  x_user_id text,
  screen_name text,
  access_token text not null,
  access_secret text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.x_rebrand_tokens
  add column if not exists x_user_id text,
  add column if not exists screen_name text,
  add column if not exists access_token text,
  add column if not exists access_secret text,
  add column if not exists created_at timestamp with time zone not null default now(),
  add column if not exists updated_at timestamp with time zone not null default now();

alter table public.x_rebrand_tokens
  alter column access_token set not null,
  alter column access_secret set not null;

alter table public.x_rebrand_tokens enable row level security;
