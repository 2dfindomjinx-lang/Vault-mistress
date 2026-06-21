create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  twitter_handle text,
  display_name text,
  avatar_url text,
  email text,
  coins integer not null default 100,
  affection integer not null default 0,
  tribute_total integer not null default 0,
  lifetime_spent_coins integer not null default 0,
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
  timeout_reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.profiles
  add column if not exists twitter_handle text,
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists email text,
  add column if not exists tribute_total integer not null default 0,
  add column if not exists lifetime_spent_coins integer not null default 0,
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
  add column if not exists timeout_reason text,
  add column if not exists updated_at timestamp with time zone not null default now();

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

create table if not exists public.irl_task_fail_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null unique,
  task_label text,
  failed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now()
);

create index if not exists irl_task_fail_events_user_failed_at_idx
  on public.irl_task_fail_events(user_id, failed_at);

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

create table if not exists public.user_cosmetics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  item_type text not null,
  equipped boolean not null default false,
  purchased_at timestamp with time zone not null default now(),
  unique(user_id, item_id)
);

create table if not exists public.user_titles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id text not null,
  source text not null default 'progression',
  equipped boolean not null default false,
  unlocked_at timestamp with time zone not null default now(),
  unique(user_id, title_id)
);

create table if not exists public.pet_debt_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_name text not null,
  contract_type text not null default 'normal' check (contract_type in ('normal', 'evil')),
  period_type text not null check (period_type in ('weekly', 'monthly')),
  debt_amount integer not null,
  duration_periods integer not null,
  paid_periods integer not null default 0,
  missed_periods integer not null default 0,
  random_generated boolean not null default false,
  status text not null default 'active',
  started_at timestamp with time zone not null default now(),
  next_due_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  declared_age integer,
  full_name text,
  timezone text,
  custom_note text,
  consent_primary boolean not null default false,
  consent_secondary boolean not null default false,
  image_urls jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.evil_debt_contract_images (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.pet_debt_contracts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  image_url text not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.random_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  active boolean not null default false,
  effect jsonb not null default '{}'::jsonb,
  automatic_key text unique,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.loyalty_jackpots (
  id uuid primary key default gen_random_uuid(),
  cycle_key text unique not null,
  starts_at timestamp with time zone not null,
  contribution_ends_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  base_pool integer not null default 5000,
  winner_user_id uuid references auth.users(id) on delete set null,
  winner_username text,
  winner_amount integer,
  winner_selected_at timestamp with time zone,
  skipped_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.loyalty_jackpot_contributions (
  id uuid primary key default gen_random_uuid(),
  jackpot_id uuid not null references public.loyalty_jackpots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  amount integer not null check (amount > 0),
  created_at timestamp with time zone not null default now()
);

create index if not exists loyalty_jackpot_contributions_jackpot_id_idx
  on public.loyalty_jackpot_contributions(jackpot_id);

create index if not exists loyalty_jackpot_contributions_user_id_idx
  on public.loyalty_jackpot_contributions(user_id);
create index if not exists evil_debt_contract_images_contract_id_idx
  on public.evil_debt_contract_images(contract_id);

alter table public.pet_debt_contracts
  add column if not exists missed_periods integer not null default 0,
  add column if not exists random_generated boolean not null default false,
  add column if not exists contract_type text not null default 'normal',
  add column if not exists declared_age integer,
  add column if not exists full_name text,
  add column if not exists timezone text,
  add column if not exists custom_note text,
  add column if not exists consent_primary boolean not null default false,
  add column if not exists consent_secondary boolean not null default false,
  add column if not exists image_urls jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamp with time zone not null default now();

alter table public.pet_debt_contracts
  drop constraint if exists pet_debt_contracts_contract_type_check;
alter table public.pet_debt_contracts
  add constraint pet_debt_contracts_contract_type_check
  check (contract_type in ('normal', 'evil'));

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

create table if not exists public.pending_admin_actions (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  requested_by_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  target_username_snapshot text,
  amount integer not null,
  reason text,
  command text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone not null default (now() + interval '5 minutes'),
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamp with time zone
);

alter table public.coin_transactions
  add column if not exists admin_user_id uuid references auth.users(id) on delete set null,
  add column if not exists balance_before integer,
  add column if not exists balance_after integer,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.profiles enable row level security;
alter table public.x_rebrand_tokens enable row level security;
alter table public.unlocked_gallery_items enable row level security;
alter table public.user_gallery enable row level security;
alter table public.user_tasks enable row level security;
alter table public.user_pet_tasks enable row level security;
alter table public.user_pet_gallery enable row level security;
alter table public.user_cosmetics enable row level security;
alter table public.user_titles enable row level security;
alter table public.pet_debt_contracts enable row level security;
alter table public.evil_debt_contract_images enable row level security;
alter table public.random_events enable row level security;
alter table public.loyalty_jackpots enable row level security;
alter table public.loyalty_jackpot_contributions enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.user_irl_tasks enable row level security;
alter table public.irl_task_fail_events enable row level security;
alter table public.pending_admin_actions enable row level security;

create or replace function public.is_privileged_db_context()
returns boolean
language sql
stable
as $$
  select
    current_user in ('postgres', 'service_role', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_privileged_db_context() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.coins := 100;
    new.affection := 0;
    new.tribute_total := 0;
    new.lifetime_spent_coins := 0;
    new.shame_count := 0;
    new.is_admin := false;
    new.hide_from_leaderboard := false;
    new.pet_score := 0;
    new.owner_likeness := 100;
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin then
    raise exception 'is_admin cannot be changed from the client';
  end if;

  if new.hide_from_leaderboard is distinct from old.hide_from_leaderboard then
    raise exception 'hide_from_leaderboard cannot be changed from the client';
  end if;

  if new.coins is distinct from old.coins then
    raise exception 'coins cannot be changed from the client';
  end if;

  if new.affection is distinct from old.affection then
    raise exception 'affection cannot be changed from the client';
  end if;

  if new.tribute_total is distinct from old.tribute_total then
    raise exception 'tribute_total cannot be changed from the client';
  end if;

  if new.lifetime_spent_coins is distinct from old.lifetime_spent_coins then
    raise exception 'lifetime_spent_coins cannot be changed from the client';
  end if;

  if new.shame_count is distinct from old.shame_count then
    raise exception 'shame_count cannot be changed from the client';
  end if;

  if new.pet_score is distinct from old.pet_score then
    raise exception 'pet_score cannot be changed from the client';
  end if;

  if new.owner_likeness is distinct from old.owner_likeness then
    raise exception 'owner_likeness cannot be changed from the client';
  end if;

  return new;
end;
$$;

create or replace function public.block_client_owned_table_mutations()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_privileged_db_context() then
    return coalesce(new, old);
  end if;

  raise exception '% mutations must go through backend API routes', tg_table_name;
end;
$$;

drop trigger if exists protect_profile_sensitive_fields_trigger on public.profiles;
drop function if exists public.protect_profile_sensitive_fields();
drop trigger if exists validate_user_task_reward_trigger on public.user_tasks;
drop function if exists public.validate_user_task_reward();

drop trigger if exists protect_profile_admin_fields_trigger on public.profiles;
create trigger protect_profile_admin_fields_trigger
  before insert or update on public.profiles
  for each row
  execute function public.protect_profile_admin_fields();

drop trigger if exists block_client_user_tasks_mutations_trigger on public.user_tasks;
create trigger block_client_user_tasks_mutations_trigger
  before insert or update or delete on public.user_tasks
  for each row
  execute function public.block_client_owned_table_mutations();

drop trigger if exists block_client_user_gallery_mutations_trigger on public.user_gallery;
create trigger block_client_user_gallery_mutations_trigger
  before insert or update or delete on public.user_gallery
  for each row
  execute function public.block_client_owned_table_mutations();

drop trigger if exists block_client_unlocked_gallery_items_mutations_trigger on public.unlocked_gallery_items;
create trigger block_client_unlocked_gallery_items_mutations_trigger
  before insert or update or delete on public.unlocked_gallery_items
  for each row
  execute function public.block_client_owned_table_mutations();

drop trigger if exists block_client_user_pet_gallery_mutations_trigger on public.user_pet_gallery;
create trigger block_client_user_pet_gallery_mutations_trigger
  before insert or update or delete on public.user_pet_gallery
  for each row
  execute function public.block_client_owned_table_mutations();

drop trigger if exists block_client_coin_transactions_mutations_trigger on public.coin_transactions;
create trigger block_client_coin_transactions_mutations_trigger
  before insert or update or delete on public.coin_transactions
  for each row
  execute function public.block_client_owned_table_mutations();

create or replace function public.apply_lifetime_spent_coins_from_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.amount >= 0 then
    return new;
  end if;

  if new.reason not in (
    'jackpot_contribution',
    'spend:cosmetic',
    'spend:gallery-unlock',
    'spend:irl-task-wheel',
    'spend:rights',
    'spend:title',
    'spend:pet-weekly-tax',
    'spend:timeout-clear',
    'crate:open',
    'tribute:coin-offer',
    'tribute:sacrifice',
    'tribute:support',
    'tribute:debt-contract',
    'tribute:debt-contract:auto',
    'tribute:debt-contract:missed'
  ) then
    return new;
  end if;

  update public.profiles
  set
    lifetime_spent_coins = least(
      2147483647,
      greatest(0, coalesce(lifetime_spent_coins, 0) + abs(new.amount))
    ),
    updated_at = now()
  where id = new.user_id;

  return new;
end;
$$;

drop trigger if exists apply_lifetime_spent_coins_from_transaction_trigger on public.coin_transactions;
create trigger apply_lifetime_spent_coins_from_transaction_trigger
  after insert on public.coin_transactions
  for each row
  execute function public.apply_lifetime_spent_coins_from_transaction();

-- One-time backfill for existing profiles so badges reflect historical spending.
update public.profiles profile
set
  lifetime_spent_coins = least(
    2147483647,
    greatest(
      0,
      coalesce((
        select sum(abs(tx.amount))::bigint
        from public.coin_transactions tx
        where tx.user_id = profile.id
          and tx.amount < 0
          and tx.reason in (
            'jackpot_contribution',
            'spend:cosmetic',
            'spend:gallery-unlock',
            'spend:irl-task-wheel',
            'spend:rights',
            'spend:title',
            'spend:pet-weekly-tax',
            'spend:timeout-clear',
            'crate:open',
            'tribute:coin-offer',
            'tribute:sacrifice',
            'tribute:support',
            'tribute:debt-contract',
            'tribute:debt-contract:auto',
            'tribute:debt-contract:missed'
          )
      ), 0)
    )
  ),
  updated_at = now()
where exists (
  select 1
  from public.coin_transactions tx
  where tx.user_id = profile.id
    and tx.amount < 0
    and tx.reason in (
      'jackpot_contribution',
      'spend:cosmetic',
      'spend:gallery-unlock',
      'spend:irl-task-wheel',
      'spend:rights',
      'spend:title',
      'spend:pet-weekly-tax',
      'spend:timeout-clear',
      'crate:open',
      'tribute:coin-offer',
      'tribute:sacrifice',
      'tribute:support',
      'tribute:debt-contract',
      'tribute:debt-contract:auto',
      'tribute:debt-contract:missed'
    )
);

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can create own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can create own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can read own gallery unlocks" on public.unlocked_gallery_items;
create policy "Users can read own gallery unlocks"
  on public.unlocked_gallery_items for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create own gallery unlocks" on public.unlocked_gallery_items;
drop policy if exists "Users can update own gallery unlocks" on public.unlocked_gallery_items;
create policy "Users can create own gallery unlocks"
  on public.unlocked_gallery_items for insert
  to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update own gallery unlocks"
  on public.unlocked_gallery_items for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own coin transactions" on public.coin_transactions;
create policy "Users can read own coin transactions"
  on public.coin_transactions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read own gallery" on public.user_gallery;
create policy "Users can read own gallery"
  on public.user_gallery for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own gallery" on public.user_gallery;
drop policy if exists "Users can update own gallery" on public.user_gallery;
create policy "Users can insert own gallery"
  on public.user_gallery for insert
  to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update own gallery"
  on public.user_gallery for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own tasks" on public.user_tasks;
create policy "Users can read own tasks"
  on public.user_tasks for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own tasks" on public.user_tasks;
drop policy if exists "Users can update own tasks" on public.user_tasks;
create policy "Users can insert own tasks"
  on public.user_tasks for insert
  to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update own tasks"
  on public.user_tasks for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own pet tasks" on public.user_pet_tasks;
create policy "Users can read own pet tasks"
  on public.user_pet_tasks for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own pet tasks" on public.user_pet_tasks;
drop policy if exists "Users can update own pet tasks" on public.user_pet_tasks;
create policy "Users can insert own pet tasks"
  on public.user_pet_tasks for insert
  to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update own pet tasks"
  on public.user_pet_tasks for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Independent user levels, monthly Global Principessa progress, and stored rights.
alter table public.profiles
  add column if not exists user_level integer not null default 1,
  add column if not exists user_xp integer not null default 0,
  add column if not exists user_xp_migration_applied boolean not null default false,
  add column if not exists stored_rights integer not null default 0,
  add column if not exists right_expirations jsonb not null default '[]'::jsonb,
  add column if not exists daily_purchase_count integer not null default 0,
  add column if not exists right_purchase_date text;

-- Display name constraints (cosmetic, non-unique, public-facing only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_display_name_valid'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_display_name_valid
      CHECK (
        display_name IS NULL
        OR (
          length(btrim(display_name)) >= 2
          AND length(btrim(display_name)) <= 24
          AND display_name !~ '[\x00-\x1F\x7F\n\r]'
          AND btrim(display_name) <> ''
        )
      );
  END IF;
END $$;

update public.profiles
set right_expirations = (
  select coalesce(jsonb_agg(to_jsonb((now() + interval '3 days')::text)), '[]'::jsonb)
  from generate_series(1, greatest(0, stored_rights))
)
where stored_rights > 0
  and right_expirations = '[]'::jsonb;

create or replace function public.active_right_expirations(raw_expirations jsonb)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(to_jsonb(expires_at::text) order by expires_at), '[]'::jsonb)
  from (
    select value::timestamptz as expires_at
    from jsonb_array_elements_text(coalesce(raw_expirations, '[]'::jsonb)) as entry(value)
    where value::timestamptz > now()
  ) active;
$$;

create or replace function public.calculate_user_level(total_xp integer)
returns integer
language plpgsql
immutable
as $$
declare
  remaining integer := greatest(0, coalesce(total_xp, 0));
  current_level integer := 1;
  requirement integer;
begin
  while current_level < 100 loop
    requirement := round(5000 + (current_level * 150) + (power(current_level::numeric, 1.2) * 25))::integer;

    exit when remaining < requirement;
    remaining := remaining - requirement;
    current_level := current_level + 1;
  end loop;

  return current_level;
end;
$$;

create or replace function public.user_level_floor_xp(target_level integer)
returns integer
language plpgsql
immutable
as $$
declare
  current_level integer := 1;
  total integer := 0;
  safe_level integer := least(100, greatest(1, coalesce(target_level, 1)));
begin
  while current_level < safe_level loop
    total := total + round(5000 + (current_level * 150) + (power(current_level::numeric, 1.2) * 25))::integer;
    current_level := current_level + 1;
  end loop;

  return total;
end;
$$;

create or replace function public.user_level_value(target_level integer)
returns integer
language sql
immutable
as $$
  select case
    when coalesce(target_level, 1) >= 76 then 25000
    when coalesce(target_level, 1) >= 51 then 15000
    when coalesce(target_level, 1) >= 31 then 10000
    else 5000
  end;
$$;

create or replace function public.add_user_xp(target_user_id uuid, xp_delta integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_xp integer;
begin
  if coalesce(xp_delta, 0) <= 0 then
    return;
  end if;

  update public.profiles
  set
    user_xp = least(2147483647, greatest(0, user_xp + xp_delta)),
    user_level = public.calculate_user_level(least(2147483647, greatest(0, user_xp + xp_delta))),
    updated_at = now()
  where id = target_user_id
  returning user_xp into next_xp;
end;
$$;

create or replace function public.apply_coin_transaction_user_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  xp_delta integer := 0;
begin
  if new.amount < 0 and coalesce(new.reason, '') <> 'admin_drain' then
    xp_delta := abs(new.amount) * 2;
  elsif new.amount > 0 and new.reason in ('throne_tribute', 'live_gift') then
    xp_delta := floor(new.amount * 0.05);
  end if;

  if xp_delta > 0 then
    perform public.add_user_xp(new.user_id, xp_delta);
  end if;

  return new;
end;
$$;

drop trigger if exists apply_coin_transaction_user_xp_trigger on public.coin_transactions;
create trigger apply_coin_transaction_user_xp_trigger
  after insert on public.coin_transactions
  for each row
  execute function public.apply_coin_transaction_user_xp();

create or replace function public.apply_admin_coin_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  commission_total integer := 0;
  recipient_count integer := 0;
  base_share integer := 0;
  remainder integer := 0;
  recipient_index integer := 0;
  share integer := 0;
  recipient record;
begin
  if tg_op = 'INSERT' then
    if new.amount >= 0 or coalesce(new.reason, '') = 'admin_commission' then
      return new;
    end if;

    if exists (
      select 1
      from public.profiles
      where id = new.user_id
        and coalesce(is_admin, false) = true
    ) then
      return new;
    end if;

    commission_total := floor(abs(new.amount) * 0.10)::integer;

    if commission_total <= 0 then
      return new;
    end if;

    select count(*)
    into recipient_count
    from public.profiles
    where coalesce(is_admin, false) = true
      and id <> new.user_id;

    if recipient_count <= 0 then
      return new;
    end if;

    base_share := commission_total / recipient_count;
    remainder := commission_total % recipient_count;

    for recipient in
      select id, coins
      from public.profiles
      where coalesce(is_admin, false) = true
        and id <> new.user_id
      order by id
    loop
      recipient_index := recipient_index + 1;
      share := base_share + case when recipient_index <= remainder then 1 else 0 end;

      if share <= 0 then
        continue;
      end if;

      update public.profiles
      set
        coins = coalesce(coins, 0) + share,
        updated_at = now()
      where id = recipient.id;

      insert into public.coin_transactions (
        user_id,
        admin_user_id,
        amount,
        reason,
        balance_before,
        balance_after,
        metadata
      ) values (
        recipient.id,
        recipient.id,
        share,
        'admin_commission',
        recipient.coins,
        recipient.coins + share,
        jsonb_build_object(
          'sourceTransactionId', new.id,
          'sourceUserId', new.user_id,
          'sourceReason', coalesce(new.reason, ''),
          'commissionTotal', commission_total,
          'commissionShare', share,
          'recipientCount', recipient_count
        )
      );
    end loop;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.amount >= 0 or coalesce(old.reason, '') = 'admin_commission' then
      return old;
    end if;

    with commission_totals as (
      select
        user_id,
        sum(amount)::integer as total_amount
      from public.coin_transactions
      where reason = 'admin_commission'
        and coalesce(metadata->>'sourceTransactionId', '') = old.id::text
      group by user_id
    )
    update public.profiles profile
    set
      coins = coalesce(profile.coins, 0) - commission_totals.total_amount,
      updated_at = now()
    from commission_totals
    where profile.id = commission_totals.user_id;

    delete from public.coin_transactions
    where reason = 'admin_commission'
      and coalesce(metadata->>'sourceTransactionId', '') = old.id::text;

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists apply_admin_coin_commission_trigger on public.coin_transactions;
create trigger apply_admin_coin_commission_trigger
  after insert or delete on public.coin_transactions
  for each row
  execute function public.apply_admin_coin_commission();

update public.profiles
set
  user_xp = least(2147483647, greatest(0, coalesce(user_xp, 0) + greatest(0, coalesce(tribute_total, 0) * 10))),
  user_level = public.calculate_user_level(
    least(2147483647, greatest(0, coalesce(user_xp, 0) + greatest(0, coalesce(tribute_total, 0) * 10)))
  ),
  user_xp_migration_applied = true,
  updated_at = now()
where coalesce(user_xp_migration_applied, false) = false;

create table if not exists public.global_principessa_progress (
  id smallint primary key default 1 check (id = 1),
  month integer not null,
  year integer not null,
  level integer not null default 1,
  xp integer not null default 0,
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.global_principessa_level_history (
  id uuid primary key default gen_random_uuid(),
  month integer not null,
  year integer not null,
  highest_level integer not null default 1,
  finalized_at timestamp with time zone not null default now(),
  unique (year, month)
);

create table if not exists public.global_principessa_xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  xp_amount integer not null default 0,
  previous_user_level integer,
  new_user_level integer,
  previous_global_level integer,
  new_global_level integer,
  previous_global_xp integer,
  new_global_xp integer,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.user_level_season_bonus_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  year integer not null,
  month integer not null,
  awarded_levels integer not null default 5,
  previous_level integer not null,
  new_level integer not null,
  created_at timestamp with time zone not null default now(),
  unique (user_id, year, month)
);

alter table public.global_principessa_progress enable row level security;
alter table public.global_principessa_level_history enable row level security;
alter table public.global_principessa_xp_events enable row level security;
alter table public.user_level_season_bonus_awards enable row level security;

drop policy if exists "Users can read global principessa progress" on public.global_principessa_progress;
create policy "Users can read global principessa progress"
  on public.global_principessa_progress for select
  to authenticated
  using (true);

drop policy if exists "Users can read global principessa history" on public.global_principessa_level_history;
create policy "Users can read global principessa history"
  on public.global_principessa_level_history for select
  to authenticated
  using (true);

drop policy if exists "Users can read global principessa events" on public.global_principessa_xp_events;
create policy "Users can read global principessa events"
  on public.global_principessa_xp_events for select
  to authenticated
  using (true);

drop policy if exists "Users can read own level season bonus awards" on public.user_level_season_bonus_awards;
create policy "Users can read own level season bonus awards"
  on public.user_level_season_bonus_awards for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.current_gmt3_month()
returns table(month integer, year integer)
language sql
stable
as $$
  select
    extract(month from (now() at time zone 'Europe/Istanbul'))::integer,
    extract(year from (now() at time zone 'Europe/Istanbul'))::integer;
$$;

create or replace function public.global_principessa_requirement(current_level integer)
returns integer
language sql
immutable
as $$
  select case
    when coalesce(current_level, 1) >= 100 then null
    else 10000 + (greatest(1, coalesce(current_level, 1)) - 1) * 2000
  end;
$$;

create or replace function public.apply_user_level_season_bonus(p_year integer, p_month integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  awarded_count integer := 0;
begin
  if p_year is null or p_month is null or p_month < 1 or p_month > 12 then
    raise exception 'Invalid season bonus period.';
  end if;

  with eligible as (
    select
      profiles.id,
      least(100, greatest(1, coalesce(profiles.user_level, public.calculate_user_level(coalesce(profiles.user_xp, 0))))) as previous_level,
      least(100, greatest(1, coalesce(profiles.user_level, public.calculate_user_level(coalesce(profiles.user_xp, 0)))) + 5) as new_level
    from public.profiles
    where not exists (
      select 1
      from public.user_level_season_bonus_awards awards
      where awards.user_id = profiles.id
        and awards.year = p_year
        and awards.month = p_month
    )
  ),
  inserted as (
    insert into public.user_level_season_bonus_awards (
      user_id,
      year,
      month,
      awarded_levels,
      previous_level,
      new_level
    )
    select
      id,
      p_year,
      p_month,
      new_level - previous_level,
      previous_level,
      new_level
    from eligible
    on conflict (user_id, year, month) do nothing
    returning user_id, new_level
  ),
  updated as (
    update public.profiles profile
    set
      user_level = inserted.new_level,
      user_xp = greatest(coalesce(profile.user_xp, 0), public.user_level_floor_xp(inserted.new_level)),
      updated_at = now()
    from inserted
    where profile.id = inserted.user_id
    returning profile.id
  )
  select count(*) into awarded_count from updated;

  return jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'awardedUsers', awarded_count
  );
end;
$$;

create or replace function public.ensure_global_principessa_current_month()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_month integer;
  current_year integer;
  row_data public.global_principessa_progress%rowtype;
begin
  select month, year into current_month, current_year from public.current_gmt3_month();

  insert into public.global_principessa_progress (id, month, year, level, xp)
  values (1, current_month, current_year, 1, 0)
  on conflict (id) do nothing;

  select * into row_data
  from public.global_principessa_progress
  where id = 1
  for update;

  if row_data.month <> current_month or row_data.year <> current_year then
    insert into public.global_principessa_level_history (month, year, highest_level)
    values (row_data.month, row_data.year, row_data.level)
    on conflict (year, month) do update
      set highest_level = greatest(public.global_principessa_level_history.highest_level, excluded.highest_level),
          finalized_at = now();

    perform public.apply_user_level_season_bonus(row_data.year, row_data.month);

    update public.global_principessa_progress
    set month = current_month,
        year = current_year,
        level = 1,
        xp = 0,
        updated_at = now()
    where id = 1
    returning * into row_data;
  end if;

  return jsonb_build_object(
    'month', row_data.month,
    'year', row_data.year,
    'level', row_data.level,
    'xp', row_data.xp,
    'updated_at', row_data.updated_at
  );
end;
$$;

create or replace function public.perform_level_drain(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  progress_row public.global_principessa_progress%rowtype;
  previous_user_level integer;
  new_user_level integer;
  level_value integer;
  transfer_xp integer;
  previous_global_level integer;
  previous_global_xp integer;
  requirement integer;
  event_id uuid;
begin
  perform public.ensure_global_principessa_current_month();

  select * into profile_row
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  previous_user_level := public.calculate_user_level(profile_row.user_xp);

  if previous_user_level < 2 then
    raise exception 'Level Drain requires user level 2 or higher.';
  end if;

  new_user_level := previous_user_level - 1;
  -- Use the exact XP required for this level, not the coarse tier bucket.
  level_value := public.user_level_floor_xp(previous_user_level + 1) - public.user_level_floor_xp(previous_user_level);
  transfer_xp := greatest(1, floor(level_value * 0.25));

  select * into progress_row
  from public.global_principessa_progress
  where id = 1
  for update;

  previous_global_level := progress_row.level;
  previous_global_xp := progress_row.xp;
  progress_row.xp := progress_row.xp + transfer_xp;

  while progress_row.level < 100 loop
    requirement := public.global_principessa_requirement(progress_row.level);
    exit when requirement is null or progress_row.xp < requirement;
    progress_row.xp := progress_row.xp - requirement;
    progress_row.level := progress_row.level + 1;
  end loop;

  update public.profiles
  set
    user_xp = public.user_level_floor_xp(new_user_level),
    user_level = new_user_level,
    updated_at = now()
  where id = p_user_id;

  update public.global_principessa_progress
  set
    level = progress_row.level,
    xp = progress_row.xp,
    updated_at = now()
  where id = 1;

  insert into public.global_principessa_xp_events (
    user_id,
    event_type,
    xp_amount,
    previous_user_level,
    new_user_level,
    previous_global_level,
    new_global_level,
    previous_global_xp,
    new_global_xp
  )
  values (
    p_user_id,
    'level_drain',
    transfer_xp,
    previous_user_level,
    new_user_level,
    previous_global_level,
    progress_row.level,
    previous_global_xp,
    progress_row.xp
  )
  returning id into event_id;

  if progress_row.level > previous_global_level then
    insert into public.global_principessa_xp_events (
      user_id,
      event_type,
      xp_amount,
      previous_global_level,
      new_global_level,
      previous_global_xp,
      new_global_xp
    )
    values (
      p_user_id,
      'level_up',
      transfer_xp,
      previous_global_level,
      progress_row.level,
      previous_global_xp,
      progress_row.xp
    );
  end if;

  return jsonb_build_object(
    'eventId', event_id,
    'transferredXp', transfer_xp,
    'previousUserLevel', previous_user_level,
    'newUserLevel', new_user_level,
    'userXp', public.user_level_floor_xp(new_user_level),
    'previousGlobalLevel', previous_global_level,
    'globalLevel', progress_row.level,
    'globalXp', progress_row.xp,
    'globalLevelUp', progress_row.level > previous_global_level
  );
end;
$$;

create or replace function public.perform_rights_action(p_user_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  today_key text := to_char((now() at time zone 'Europe/Istanbul')::date, 'YYYY-MM-DD');
  active_rights jsonb;
  active_right_count integer;
  daily_count integer;
  price integer;
  next_coins integer;
  next_right_count integer;
  next_right_expirations jsonb;
begin
  select * into profile_row
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  daily_count := case
    when profile_row.right_purchase_date = today_key then profile_row.daily_purchase_count
    else 0
  end;
  active_rights := public.active_right_expirations(profile_row.right_expirations);
  active_right_count := jsonb_array_length(active_rights);

  if profile_row.stored_rights <> active_right_count or profile_row.right_expirations <> active_rights then
    update public.profiles
    set
      stored_rights = active_right_count,
      right_expirations = active_rights,
      daily_purchase_count = daily_count,
      right_purchase_date = today_key,
      updated_at = now()
    where id = p_user_id;

    profile_row.stored_rights := active_right_count;
    profile_row.right_expirations := active_rights;
    profile_row.daily_purchase_count := daily_count;
    profile_row.right_purchase_date := today_key;
  end if;

  if p_action = 'buy' then
    if daily_count >= 5 then
      raise exception 'Daily right purchase maximum reached.';
    end if;

    price := case
      when daily_count = 0 then 1500
      when daily_count = 1 then 2500
      when daily_count = 2 then 5000
      when daily_count = 3 then 7500
      else 10000
    end;

    if profile_row.coins < price then
      raise exception 'Not enough coins to buy a right.';
    end if;

    next_coins := profile_row.coins - price;
    next_right_expirations := active_rights || jsonb_build_array(((now() + interval '3 days')::timestamptz)::text);
    next_right_count := jsonb_array_length(next_right_expirations);

    update public.profiles
    set
      coins = next_coins,
      stored_rights = next_right_count,
      right_expirations = next_right_expirations,
      daily_purchase_count = daily_count + 1,
      right_purchase_date = today_key,
      updated_at = now()
    where id = p_user_id;

    insert into public.coin_transactions (
      user_id,
      amount,
      reason,
      balance_before,
      balance_after,
      metadata
    )
    values (
      p_user_id,
      -price,
      'rights_purchase',
      profile_row.coins,
      next_coins,
      jsonb_build_object('source', 'rights_task', 'dailyPurchaseNumber', daily_count + 1)
    );

    return jsonb_build_object(
      'action', 'buy',
      'coins', next_coins,
      'dailyPurchaseCount', daily_count + 1,
      'price', price,
      'rightExpirations', next_right_expirations,
      'storedRights', next_right_count
    );
  elsif p_action = 'use' then
    if active_right_count <= 0 then
      raise exception 'No stored rights available.';
    end if;

    select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb)
    into next_right_expirations
    from jsonb_array_elements(active_rights) with ordinality as entry(value, ordinality)
    where ordinality > 1;

    next_right_count := jsonb_array_length(next_right_expirations);

    update public.profiles
    set
      stored_rights = next_right_count,
      right_expirations = next_right_expirations,
      daily_purchase_count = daily_count,
      right_purchase_date = today_key,
      updated_at = now()
    where id = p_user_id;

    return jsonb_build_object(
      'action', 'use',
      'coins', profile_row.coins,
      'dailyPurchaseCount', daily_count,
      'rightExpirations', next_right_expirations,
      'storedRights', next_right_count
    );
  end if;

  raise exception 'Invalid rights action.';
end;
$$;

drop policy if exists "Users can read own pet gallery" on public.user_pet_gallery;
create policy "Users can read own pet gallery"
  on public.user_pet_gallery for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own pet gallery" on public.user_pet_gallery;
drop policy if exists "Users can update own pet gallery" on public.user_pet_gallery;

drop policy if exists "Users can read own cosmetics" on public.user_cosmetics;
create policy "Users can read own cosmetics"
  on public.user_cosmetics for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own cosmetics" on public.user_cosmetics;
drop policy if exists "Users can update own cosmetics" on public.user_cosmetics;

drop policy if exists "Users can read own titles" on public.user_titles;
create policy "Users can read own titles"
  on public.user_titles for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own titles" on public.user_titles;
drop policy if exists "Users can update own titles" on public.user_titles;

drop policy if exists "Users can read own debt contracts" on public.pet_debt_contracts;
create policy "Users can read own debt contracts"
  on public.pet_debt_contracts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own debt contracts" on public.pet_debt_contracts;
drop policy if exists "Users can update own debt contracts" on public.pet_debt_contracts;
drop policy if exists "Users can read own evil debt images" on public.evil_debt_contract_images;
drop policy if exists "Users can insert own evil debt images" on public.evil_debt_contract_images;
drop policy if exists "Users can update own evil debt images" on public.evil_debt_contract_images;
drop policy if exists "Users can delete own evil debt images" on public.evil_debt_contract_images;

drop policy if exists "Users can read jackpot cycles" on public.loyalty_jackpots;
create policy "Users can read jackpot cycles"
  on public.loyalty_jackpots for select
  to authenticated
  using (true);

drop policy if exists "Users can read jackpot contributions" on public.loyalty_jackpot_contributions;
create policy "Users can read jackpot contributions"
  on public.loyalty_jackpot_contributions for select
  to authenticated
  using (true);

drop policy if exists "Users can insert own jackpot contributions" on public.loyalty_jackpot_contributions;

drop policy if exists "Users can read own irl tasks" on public.user_irl_tasks;

-- ============================================================
-- VAULT MISTRESS CRATE SYSTEM (V1)
-- Collectibles only. No equip, no bonuses, no trading.
-- Crates act as a coin sink.
-- ============================================================

-- Crate types (the things you buy and open, e.g. "Basic Crate")
create table if not exists public.crate_types (
  crate_type text primary key,
  name text not null,
  description text,
  cost integer not null check (cost > 0),
  enabled boolean not null default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Collectible item definitions (generic, future-proof)
create table if not exists public.crate_items (
  item_id text primary key,
  name text not null,
  description text,
  image_url text,
  rarity text not null,           -- e.g. common, uncommon, rare, epic, legendary
  collection text,                -- e.g. "base-set", "throne-memories"
  sell_value integer not null default 0,
  enabled boolean not null default true,
  metadata jsonb default '{}'::jsonb,  -- for variant info, tags etc. in future
  created_at timestamptz default now()
);

-- Drop weights per crate (server uses this for weighted random)
create table if not exists public.crate_drop_weights (
  id uuid primary key default gen_random_uuid(),
  crate_type text not null references public.crate_types(crate_type) on delete cascade,
  item_id text not null references public.crate_items(item_id) on delete cascade,
  weight integer not null default 100 check (weight > 0),
  variant text not null default 'normal',
  unique (crate_type, item_id, variant)
);

-- User inventory for collectibles (stacked by item + variant)
create table if not exists public.user_crate_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.crate_items(item_id) on delete cascade,
  variant text not null default 'normal',
  quantity integer not null default 1 check (quantity > 0),
  acquired_at timestamptz not null default now(),
  unique(user_id, item_id, variant)
);

-- Audit / history of opens (useful for future features, admin tools)
create table if not exists public.crate_opens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  crate_type text not null,
  item_id text,
  variant text,
  cost integer,
  received_sell_value integer,
  opened_at timestamptz default now()
);

-- Enable RLS
alter table public.crate_types enable row level security;
alter table public.crate_items enable row level security;
alter table public.crate_drop_weights enable row level security;
alter table public.user_crate_inventory enable row level security;
alter table public.crate_opens enable row level security;

-- Public read for crate definitions (so client can show shop)
drop policy if exists "Authenticated can read enabled crate types" on public.crate_types;
create policy "Authenticated can read enabled crate types"
  on public.crate_types for select
  to authenticated
  using (enabled = true);

drop policy if exists "Authenticated can read enabled crate items" on public.crate_items;
create policy "Authenticated can read enabled crate items"
  on public.crate_items for select
  to authenticated
  using (enabled = true);

drop policy if exists "Authenticated can read crate drop weights" on public.crate_drop_weights;
create policy "Authenticated can read crate drop weights"
  on public.crate_drop_weights for select
  to authenticated
  using (true);

-- Users can only see their own inventory
drop policy if exists "Users can read own crate inventory" on public.user_crate_inventory;
create policy "Users can read own crate inventory"
  on public.user_crate_inventory for select
  to authenticated
  using (auth.uid() = user_id);

-- Only service_role (admin client) can modify inventory and history (server authoritative)
-- No user insert/update/delete policies on purpose.
-- Additional protection via block_client_owned_table_mutations trigger (see security-hardening.sql).

drop policy if exists "Users can read own crate history" on public.crate_opens;
create policy "Users can read own crate history"
  on public.crate_opens for select
  to authenticated
  using (auth.uid() = user_id);

-- Note: All writes to these tables must go through server routes using the admin client.
-- Existing is_privileged_db_context trigger (from security-hardening) will protect against direct client writes.
drop policy if exists "Users can read own irl tasks"
on public.user_irl_tasks;

create policy "Users can read own irl tasks"
  on public.user_irl_tasks
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own irl tasks" on public.user_irl_tasks;
drop policy if exists "Users can update own irl tasks" on public.user_irl_tasks;

drop policy if exists "Users can read own irl fail events" on public.irl_task_fail_events;
create policy "Users can read own irl fail events"
  on public.irl_task_fail_events for select
  to authenticated
  using (auth.uid() = user_id);
