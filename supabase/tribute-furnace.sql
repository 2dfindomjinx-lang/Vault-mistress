-- The Tribute Furnace: burn Principessa Money for nothing.
--
-- Every other Money sink returns something - coins, an item, a candle. This one
-- returns a number and a place in a queue, and that is the entire point. The
-- moment it pays out it becomes a purchase, and a purchase is not tribute.
--
-- Burned Money is tracked separately from tribute_total on purpose. That ladder
-- measures what someone SENT; this one measures what they gave up without
-- taking anything back. Someone who converts every dollar into coins and someone
-- who burns it should not stand in the same place.
--
-- Safe to re-run.

alter table public.profiles
  add column if not exists pm_burned_total integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_pm_burned_total_nonneg;
alter table public.profiles
  add constraint profiles_pm_burned_total_nonneg check (pm_burned_total >= 0);

-- Partial: the leaderboard only ever reads rows that have burned something.
create index if not exists profiles_pm_burned_total_idx
  on public.profiles (pm_burned_total desc)
  where pm_burned_total > 0;

-- One function rather than the read-then-compare-and-swap dance used by
-- /api/user/money/convert: burning touches two columns that must move together,
-- and a row lock is both simpler and impossible to interleave.
create or replace function public.burn_tribute_money(
  p_user_id uuid,
  p_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_money integer;
  v_burned integer;
  v_next_money integer;
  v_next_burned integer;
begin
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('error', 'invalid_amount');
  end if;

  select principessa_money, pm_burned_total
    into v_money, v_burned
  from public.profiles
  where id = p_user_id
  for update;

  if v_money is null then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  if v_money < p_amount then
    return jsonb_build_object('error', 'insufficient_money', 'money', v_money);
  end if;

  v_next_money := v_money - p_amount;
  v_next_burned := v_burned + p_amount;

  update public.profiles
  set principessa_money = v_next_money,
      pm_burned_total = v_next_burned,
      updated_at = now()
  where id = p_user_id;

  -- Recorded in the same ledger as every other Money movement so reporting does
  -- not have to know the furnace exists.
  insert into public.money_transactions
    (user_id, amount, balance_before, balance_after, reason, metadata)
  values (
    p_user_id, -p_amount, v_money, v_next_money, 'burn:tribute-furnace',
    jsonb_build_object('burnedTotal', v_next_burned)
  );

  return jsonb_build_object(
    'money', v_next_money,
    'burned', p_amount,
    'burnedTotal', v_next_burned
  );
end;
$$;

revoke all on function public.burn_tribute_money(uuid, integer) from public, anon, authenticated;
grant execute on function public.burn_tribute_money(uuid, integer) to service_role;

-- Public board. Handles only - no balances, no Money totals beyond what was
-- burned, which is the one number the furnace is about.
create or replace function public.get_furnace_leaderboard(p_limit integer default 20)
returns table (
  username text,
  display_name text,
  burned integer,
  rank bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select p.username, p.display_name, p.pm_burned_total,
         row_number() over (order by p.pm_burned_total desc, p.username)
  from public.profiles p
  where p.pm_burned_total > 0
  order by p.pm_burned_total desc, p.username
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.get_furnace_leaderboard(integer) from public, anon, authenticated;
grant execute on function public.get_furnace_leaderboard(integer) to service_role;
