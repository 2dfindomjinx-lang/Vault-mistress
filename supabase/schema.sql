create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  coins integer not null default 100,
  affection integer not null default 0,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.unlocked_gallery_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  unlocked_at timestamp with time zone not null default now(),
  unique (user_id, item_id)
);

create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  reason text,
  created_at timestamp with time zone not null default now()
);

alter table public.profiles enable row level security;
alter table public.unlocked_gallery_items enable row level security;
alter table public.coin_transactions enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can create own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read own gallery unlocks"
  on public.unlocked_gallery_items for select
  using (auth.uid() = user_id);

create policy "Users can create own gallery unlocks"
  on public.unlocked_gallery_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update own gallery unlocks"
  on public.unlocked_gallery_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read own coin transactions"
  on public.coin_transactions for select
  using (auth.uid() = user_id);

create policy "Users can create own coin transactions"
  on public.coin_transactions for insert
  with check (auth.uid() = user_id);
