-- Tracks which specific worship images a user has already paid to unlock,
-- so downloading is a one-time purchase per image - if the same image comes
-- back around in the daily rotation later, it stays unlocked for free.
create table if not exists public.user_worship_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  image_key text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, image_key)
);

alter table public.user_worship_unlocks enable row level security;
revoke all on public.user_worship_unlocks from public, anon, authenticated;
