create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  email text,
  coins integer not null default 100,
  affection integer not null default 0,
  tribute_total integer not null default 0,
  shame_count integer not null default 0,
  is_admin boolean not null default false,
  hide_from_leaderboard boolean not null default false,
  pet_score integer not null default 0,
  owner_likeness integer not null default 100,
  pet_unlocked_at timestamp with time zone,
  last_pet_decay_at timestamp with time zone,
  last_owner_likeness_at timestamp with time zone,
  last_pet_tax_at timestamp with time zone,
  loyalty_streak integer not null default 0,
  last_loyalty_at timestamp with time zone,
  last_login_at timestamp with time zone,
  timeout_until timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists email text,
  add column if not exists tribute_total integer not null default 0,
  add column if not exists shame_count integer not null default 0,
  add column if not exists is_admin boolean not null default false,
  add column if not exists hide_from_leaderboard boolean not null default false,
  add column if not exists pet_score integer not null default 0,
  add column if not exists owner_likeness integer not null default 100,
  add column if not exists pet_unlocked_at timestamp with time zone,
  add column if not exists last_pet_decay_at timestamp with time zone,
  add column if not exists last_owner_likeness_at timestamp with time zone,
  add column if not exists last_pet_tax_at timestamp with time zone,
  add column if not exists loyalty_streak integer not null default 0,
  add column if not exists last_loyalty_at timestamp with time zone,
  add column if not exists last_login_at timestamp with time zone,
  add column if not exists timeout_until timestamp with time zone,
  add column if not exists updated_at timestamp with time zone not null default now();

create table if not exists public.user_irl_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_label text not null,
  task_description text,
  wheel_index integer not null,
  cost_coins integer not null default 1000,
  status text not null default 'assigned',
  due_at timestamp with time zone,
  penalty_timeout_minutes integer not null default 30,
  completed_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  shamed_at timestamp with time zone,
  assigned_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now()
);

alter table public.user_irl_tasks
  add column if not exists task_description text,
  add column if not exists due_at timestamp with time zone,
  add column if not exists penalty_timeout_minutes integer not null default 30,
  add column if not exists completed_at timestamp with time zone,
  add column if not exists reviewed_at timestamp with time zone,
  add column if not exists shamed_at timestamp with time zone;

create table if not exists public.unlocked_gallery_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  unlocked_at timestamp with time zone not null default now(),
  unique (user_id, item_id)
);

create table if not exists public.user_gallery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  unlocked_at timestamp with time zone not null default now(),
  unique (user_id, item_id)
);

create table if not exists public.user_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null,
  completed_at timestamp with time zone,
  claimed_at timestamp with time zone,
  reward_coins integer default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  unique(user_id, task_id)
);

alter table public.user_tasks
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.user_pet_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null,
  completed_at timestamp with time zone,
  reward_score integer default 0,
  status text not null default 'pending',
  reviewed_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  unique(user_id, task_id)
);

create table if not exists public.user_pet_gallery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  unlocked_at timestamp with time zone not null default now(),
  unique(user_id, item_id)
);

create table if not exists public.pet_debt_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_name text not null,
  period_type text not null check (period_type in ('weekly', 'monthly')),
  debt_amount integer not null,
  duration_periods integer not null,
  paid_periods integer not null default 0,
  missed_periods integer not null default 0,
  status text not null default 'active',
  started_at timestamp with time zone not null default now(),
  next_due_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.pet_debt_contracts
  add column if not exists missed_periods integer not null default 0,
  add column if not exists updated_at timestamp with time zone not null default now();

alter table public.user_pet_tasks
  add column if not exists status text not null default 'pending',
  add column if not exists reviewed_at timestamp with time zone,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  admin_user_id uuid references auth.users(id) on delete set null,
  amount integer not null,
  reason text,
  balance_before integer,
  balance_after integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

alter table public.coin_transactions
  add column if not exists admin_user_id uuid references auth.users(id) on delete set null,
  add column if not exists balance_before integer,
  add column if not exists balance_after integer,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.profiles enable row level security;
alter table public.unlocked_gallery_items enable row level security;
alter table public.user_gallery enable row level security;
alter table public.user_tasks enable row level security;
alter table public.user_pet_tasks enable row level security;
alter table public.user_pet_gallery enable row level security;
alter table public.pet_debt_contracts enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.user_irl_tasks enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can create own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read own gallery unlocks"
  on public.unlocked_gallery_items for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create own gallery unlocks"
  on public.unlocked_gallery_items for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own gallery unlocks"
  on public.unlocked_gallery_items for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read own coin transactions"
  on public.coin_transactions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create own coin transactions"
  on public.coin_transactions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can read own gallery"
  on public.user_gallery for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own gallery"
  on public.user_gallery for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own gallery"
  on public.user_gallery for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read own tasks"
  on public.user_tasks for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own tasks"
  on public.user_tasks for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own tasks"
  on public.user_tasks for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read own pet tasks"
  on public.user_pet_tasks for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own pet tasks"
  on public.user_pet_tasks for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own pet tasks"
  on public.user_pet_tasks for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read own pet gallery"
  on public.user_pet_gallery for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own pet gallery"
  on public.user_pet_gallery for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can read own debt contracts"
  on public.pet_debt_contracts for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own debt contracts"
  on public.pet_debt_contracts for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own debt contracts"
  on public.pet_debt_contracts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read own irl tasks"
  on public.user_irl_tasks for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own irl tasks"
  on public.user_irl_tasks for insert
  to authenticated
  with check (auth.uid() = user_id);
