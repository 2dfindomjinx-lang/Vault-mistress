-- Run once in Supabase. The application keeps the stable premium title id
-- (premium-vault-royalty) while its public offer rotates from this row.
create table if not exists public.premium_title_config (
  id boolean primary key default true check (id),
  current_name text not null,
  current_description text not null,
  current_price integer not null default 50000 check (current_price >= 0),
  current_expires_at timestamptz not null,
  next_name text,
  next_description text,
  next_price integer check (next_price is null or next_price >= 0),
  next_starts_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.premium_title_config (
  id, current_name, current_description, current_price, current_expires_at
)
values (
  true,
  'Principessa''s Leaking Toy',
  'A premium title bought from the cosmetic shop.',
  50000,
  now() + interval '30 days'
)
on conflict (id) do nothing;

alter table public.premium_title_config enable row level security;
revoke all on public.premium_title_config from public, anon, authenticated;
