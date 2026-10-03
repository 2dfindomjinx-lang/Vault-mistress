-- Audit log for the crate item Upgrade gamble: one row per attempt, win or
-- lose. Mirrors crate_opens in shape and intent. Nothing here moves coins -
-- only an inventory item is consumed and, on a win, another is granted.
-- After this base setup, run 2026-10-03-crate-safety.sql for the atomic
-- inventory mutation RPC and retry receipts used by the API.
--
-- Safe to re-run.

create table if not exists public.crate_item_upgrades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_item_id text not null,
  from_variant text not null default 'normal',
  from_sell_value integer not null,
  to_crate_type text not null,
  to_rarity text not null,
  win_chance_percent numeric(6, 3) not null,
  won boolean not null,
  to_item_id text,
  to_variant text,
  created_at timestamptz not null default now()
);

create index if not exists crate_item_upgrades_user_idx on public.crate_item_upgrades(user_id, created_at desc);

alter table public.crate_item_upgrades enable row level security;
revoke all on public.crate_item_upgrades from public, anon, authenticated;
