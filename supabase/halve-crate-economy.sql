-- Halve all crate entry costs and item sell values while preserving drop odds.
-- Run once in Supabase. A marker makes accidental re-runs a no-op.
create table if not exists public.economy_migrations (
  migration_key text primary key,
  applied_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from public.economy_migrations where migration_key = 'halve-crate-economy-2026-07'
  ) then
    update public.crate_types
    set cost = greatest(1, round(cost * 0.5)::integer);

    update public.crate_items
    set sell_value = greatest(0, round(sell_value * 0.5)::integer);

    insert into public.economy_migrations (migration_key)
    values ('halve-crate-economy-2026-07');
  end if;
end $$;
