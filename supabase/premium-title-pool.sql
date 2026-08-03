-- Auto-rotating premium title pool. Run after supabase/premium-title-rotation.sql.
-- Fixes the previous rotation, which froze forever once its offer expired
-- unless an admin had manually typed in a "next" title via the admin panel.
-- Now: when the current offer expires and no manual "next" is queued, the
-- system automatically advances to the next enabled pool entry (in
-- sort_order, wrapping around) instead of sitting stuck. The manual "next"
-- fields on premium_title_config still work as a one-off override when set -
-- they take priority over the pool for that single rotation.

create table if not exists public.premium_title_pool (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null default 0,
  name text not null,
  description text not null,
  price integer not null default 50000 check (price >= 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.premium_title_pool enable row level security;
revoke all on public.premium_title_pool from public, anon, authenticated;

-- Seed with whatever's currently configured, so nothing visibly changes
-- until an admin actually edits the pool. Only runs once (pool starts empty).
insert into public.premium_title_pool (sort_order, name, description, price)
select 0, c.current_name, c.current_description, c.current_price
from public.premium_title_config c
where c.id = true
  and not exists (select 1 from public.premium_title_pool);

-- Tracks which pool entry the rotation last landed on, so auto-advance knows
-- where to resume from (next entry after this one, in sort_order, wrapping).
alter table public.premium_title_config
  add column if not exists current_pool_id uuid references public.premium_title_pool(id) on delete set null;
