-- Premium title schema catch-up for the current application.
-- Standalone replacement for the rotation/pool/duration setup sequence.
-- Preserves existing rows, prices, durations, expiry and legacy next_* columns.
-- New/missing duration values default to 720 hours (30 days).
-- No purchases, balances or equipped titles are modified.
begin;

create table if not exists public.premium_title_pool (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null default 0,
  name text not null default 'Principessa''s Leaking Toy',
  description text not null default 'A premium title bought from the cosmetic shop.',
  price integer not null default 50000 check (price >= 0),
  enabled boolean not null default true,
  duration_hours integer not null default 720 check (duration_hours between 1 and 8760),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.premium_title_pool
  add column if not exists id uuid unique default gen_random_uuid(),
  add column if not exists sort_order integer not null default 0,
  add column if not exists name text not null default 'Principessa''s Leaking Toy',
  add column if not exists description text not null default 'A premium title bought from the cosmetic shop.',
  add column if not exists price integer not null default 50000 check (price >= 0),
  add column if not exists enabled boolean not null default true,
  add column if not exists duration_hours integer not null default 720 check (duration_hours between 1 and 8760),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.premium_title_config (
  id boolean primary key default true check (id),
  current_name text not null default 'Principessa''s Leaking Toy',
  current_description text not null default 'A premium title bought from the cosmetic shop.',
  current_price integer not null default 50000 check (current_price >= 0),
  current_expires_at timestamptz not null default (now() + interval '30 days'),
  current_pool_id uuid references public.premium_title_pool(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.premium_title_config
  add column if not exists id boolean unique default true check (id),
  add column if not exists current_name text not null default 'Principessa''s Leaking Toy',
  add column if not exists current_description text not null default 'A premium title bought from the cosmetic shop.',
  add column if not exists current_price integer not null default 50000 check (current_price >= 0),
  add column if not exists current_expires_at timestamptz not null default (now() + interval '30 days'),
  add column if not exists current_pool_id uuid references public.premium_title_pool(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

-- Only seed an absent active offer or an empty queue. Never reset existing data.
insert into public.premium_title_config(id,current_name,current_description,current_price,current_expires_at)
values(true,'Principessa''s Leaking Toy','A premium title bought from the cosmetic shop.',50000,now()+interval '30 days')
on conflict(id) do nothing;
insert into public.premium_title_pool(sort_order,name,description,price)
select 0,current_name,current_description,current_price from public.premium_title_config
where id=true and not exists(select 1 from public.premium_title_pool);

alter table public.premium_title_pool enable row level security;
alter table public.premium_title_config enable row level security;
revoke all on public.premium_title_pool, public.premium_title_config from public,anon,authenticated;
grant all on public.premium_title_pool, public.premium_title_config to service_role;

notify pgrst, 'reload schema';
commit;

-- Read-only dependency report. Shared economy tables are NOT recreated or changed.
-- An empty result ("Success. No rows returned") means all required columns exist.
-- If rows appear, send this result: it lists every missing shared dependency.
with required(table_name,column_name) as (values
  ('premium_title_pool','id'),
  ('premium_title_pool','sort_order'),
  ('premium_title_pool','name'),
  ('premium_title_pool','description'),
  ('premium_title_pool','price'),
  ('premium_title_pool','enabled'),
  ('premium_title_pool','duration_hours'),
  ('premium_title_pool','created_at'),
  ('premium_title_pool','updated_at'),
  ('premium_title_config','id'),
  ('premium_title_config','current_name'),
  ('premium_title_config','current_description'),
  ('premium_title_config','current_price'),
  ('premium_title_config','current_expires_at'),
  ('premium_title_config','current_pool_id'),
  ('premium_title_config','updated_at'),
  ('profiles','id'),
  ('profiles','username'),
  ('profiles','twitter_handle'),
  ('profiles','display_name'),
  ('profiles','avatar_url'),
  ('profiles','equipped_avatar_slots'),
  ('profiles','equipped_full_set_id'),
  ('profiles','has_uncensored_avatar'),
  ('profiles','avatar_presets'),
  ('profiles','unlocked_avatar_preset_slots'),
  ('profiles','coins'),
  ('profiles','principessa_money'),
  ('profiles','pm_burned_total'),
  ('profiles','affection'),
  ('profiles','tribute_total'),
  ('profiles','total_devotion'),
  ('profiles','lifetime_spent_coins'),
  ('profiles','shame_count'),
  ('profiles','is_admin'),
  ('profiles','loyalty_streak'),
  ('profiles','streak_freezes'),
  ('profiles','last_loyalty_at'),
  ('profiles','last_login_at'),
  ('profiles','timeout_until'),
  ('profiles','timeout_reason'),
  ('profiles','pet_score'),
  ('profiles','owner_likeness'),
  ('profiles','user_level'),
  ('profiles','user_xp'),
  ('profiles','stored_rights'),
  ('profiles','right_expirations'),
  ('profiles','daily_purchase_count'),
  ('profiles','right_purchase_date'),
  ('profiles','pet_unlocked_at'),
  ('profiles','last_pet_decay_at'),
  ('profiles','last_owner_likeness_at'),
  ('profiles','last_pet_tax_at'),
  ('profiles','address_term'),
  ('profiles','created_at'),
  ('profiles','updated_at'),
  ('user_titles','user_id'),
  ('user_titles','title_id'),
  ('user_titles','source'),
  ('user_titles','equipped'),
  ('coin_transactions','id'),
  ('coin_transactions','user_id'),
  ('coin_transactions','amount'),
  ('coin_transactions','balance_before'),
  ('coin_transactions','balance_after'),
  ('coin_transactions','metadata'),
  ('coin_transactions','reason')
)
select r.table_name, r.column_name, 'MISSING' as status
from required r
where not exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=r.table_name and c.column_name=r.column_name)
order by r.table_name,r.column_name;
