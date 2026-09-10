-- Run after 202609100001_court_gameplay.sql. Safe to re-run.
-- Existing Furnace and Gamble Hall tables are required. No balances are changed.
begin;

create or replace function public.gamble_mines_multiplier(p_mine_count integer, p_safe_picks integer)
returns numeric language plpgsql immutable set search_path = public as $$
declare
  v_multiplier numeric := 1;
  v_pick integer;
  v_profit_picks integer := case p_mine_count when 7 then 3 when 10 then 2 else 1 end;
begin
  if p_mine_count not in (7,10,15) or p_safe_picks is null
    or p_safe_picks < 0 or p_safe_picks > 25 - p_mine_count then return null; end if;
  if p_safe_picks = 0 then return 1; end if;
  for v_pick in 0..p_safe_picks - 1 loop
    v_multiplier := v_multiplier * (25 - v_pick)::numeric / (25 - v_pick - p_mine_count);
  end loop;
  return least(case when p_safe_picks < v_profit_picks then 1 else 250 end,
    floor(v_multiplier * 0.82 * 100) / 100);
end;
$$;

create or replace function public.get_furnace_leaderboard(p_limit integer default 20)
returns table (username text, display_name text, burned integer, rank bigint)
language sql stable security definer set search_path = public as $$
  select p.username, p.display_name, p.pm_burned_total,
    row_number() over (order by p.pm_burned_total desc, p.username)
  from public.profiles p
  where p.pm_burned_total > 0
    and not coalesce(p.is_admin, false)
    and not coalesce(p.hide_from_leaderboard, false)
  order by p.pm_burned_total desc, p.username
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

create index if not exists gamble_rounds_analytics_created_idx
  on public.gamble_rounds (created_at) where wager > 0;

-- Group by round start. Final payouts already include the Double result;
-- do not count the initial credit and the Double credit a second time.
-- Open rounds and free Crawl previews cannot inflate wins, losses or RTP.
create or replace function public.get_admin_gamble_analytics(p_start timestamptz, p_end timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  with scoped as materialized (
    select r.user_id, r.game, r.wager, r.payout, r.status,
      to_char(r.created_at at time zone 'Etc/GMT-3', 'YYYY-MM-DD') as day
    from public.gamble_rounds r
    join public.profiles p on p.id = r.user_id
    where r.wager > 0 and not coalesce(p.is_admin, false)
      and r.created_at >= p_start and r.created_at < p_end
  ), summary as (
    select jsonb_build_object(
    'rounds', count(*), 'players', count(distinct user_id),
    'wagered', coalesce(sum(wager), 0),
    'settledRounds', count(*) filter (where status <> 'open'),
    'openRounds', count(*) filter (where status = 'open'),
    'settledWager', coalesce(sum(wager) filter (where status <> 'open'), 0),
    'payout', coalesce(sum(payout) filter (where status <> 'open'), 0),
    'profitableRounds', count(*) filter (where status <> 'open' and payout > wager),
    'doubleWins', count(*) filter (where status = 'doubled'),
    'doubleLosses', count(*) filter (where status = 'lost_double')
  ) as metrics from scoped
  ), games as (
    select game, jsonb_build_object(
    'rounds', count(*), 'players', count(distinct user_id),
    'wagered', coalesce(sum(wager), 0),
    'settledRounds', count(*) filter (where status <> 'open'),
    'openRounds', count(*) filter (where status = 'open'),
    'settledWager', coalesce(sum(wager) filter (where status <> 'open'), 0),
    'payout', coalesce(sum(payout) filter (where status <> 'open'), 0),
    'profitableRounds', count(*) filter (where status <> 'open' and payout > wager),
    'doubleWins', count(*) filter (where status = 'doubled'),
    'doubleLosses', count(*) filter (where status = 'lost_double')
  ) as metrics from scoped group by game
  ), days as (
    select day, jsonb_build_object(
    'rounds', count(*), 'players', count(distinct user_id),
    'wagered', coalesce(sum(wager), 0),
    'settledRounds', count(*) filter (where status <> 'open'),
    'openRounds', count(*) filter (where status = 'open'),
    'settledWager', coalesce(sum(wager) filter (where status <> 'open'), 0),
    'payout', coalesce(sum(payout) filter (where status <> 'open'), 0),
    'profitableRounds', count(*) filter (where status <> 'open' and payout > wager),
    'doubleWins', count(*) filter (where status = 'doubled'),
    'doubleLosses', count(*) filter (where status = 'lost_double')
  ) as metrics from scoped group by day
  )
  select jsonb_build_object(
    'summary', (select metrics from summary),
    'games', coalesce((select jsonb_agg(metrics || jsonb_build_object('game', game) order by game) from games), '[]'::jsonb),
    'byDay', coalesce((select jsonb_agg(metrics || jsonb_build_object('day', day) order by day) from days), '[]'::jsonb)
  );
$$;

revoke all on function public.gamble_mines_multiplier(integer, integer) from public, anon, authenticated;
revoke all on function public.get_furnace_leaderboard(integer) from public, anon, authenticated;
revoke all on function public.get_admin_gamble_analytics(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.get_furnace_leaderboard(integer) to service_role;
grant execute on function public.get_admin_gamble_analytics(timestamptz, timestamptz) to service_role;
commit;
