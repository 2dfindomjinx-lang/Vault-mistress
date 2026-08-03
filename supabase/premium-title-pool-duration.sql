-- Removes the legacy one-off manual "next title" override (admin panel card
-- + premium_title_config.next_* columns) now that the auto-rotating pool is
-- the only rotation mechanism, and adds per-entry duration control so each
-- pool title can define its own active window instead of a hardcoded 30 days.

alter table public.premium_title_pool
  add column if not exists duration_hours integer not null default 720 check (duration_hours between 1 and 8760);

alter table public.premium_title_config
  drop column if exists next_name,
  drop column if exists next_description,
  drop column if exists next_price,
  drop column if exists next_starts_at;
