-- Apply once in Supabase before deploying the puzzle hint update.
alter table public.puzzle_attempts
  add column if not exists hint_count integer not null default 0;
