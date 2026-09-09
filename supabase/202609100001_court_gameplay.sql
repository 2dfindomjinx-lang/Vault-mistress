-- Run after gamble-hall.sql and the 20260909 scripts. Safe to re-run.
-- Patience targets are fixed before play, so a delayed poll cannot turn an
-- already-reached cashout into a loss. Secret crash points never leave an open round.
begin;

-- Match the settlement engine's existing 250x payout ceiling. Even the last
-- safe gem must remain payable, instead of overflowing/rejecting cashout.
create or replace function public.gamble_mines_multiplier(p_mine_count integer, p_safe_picks integer)
returns numeric language plpgsql immutable set search_path = public as $$
declare
  v_multiplier numeric := 1;
  v_pick integer;
begin
  if p_mine_count not in (7,10,15) or p_safe_picks is null
    or p_safe_picks < 0 or p_safe_picks > 25 - p_mine_count then return null; end if;
  if p_safe_picks = 0 then return 1; end if;
  for v_pick in 0..p_safe_picks - 1 loop
    v_multiplier := v_multiplier * (25 - v_pick)::numeric / (25 - v_pick - p_mine_count);
  end loop;
  return least(250, floor(v_multiplier * 0.82 * 100) / 100);
end;
$$;

create or replace function public.gamble_crash_resolve(
  p_user_id uuid, p_round_id uuid, p_requested_multiplier numeric, p_cashout boolean
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_round record;
  v_now timestamptz;
  v_start timestamptz;
  v_crash numeric;
  v_actual numeric;
  v_target numeric;
  v_multiplier numeric;
  v_won boolean;
  v_payout integer;
  v_result jsonb;
begin
  -- Use the same lock order as opening a round; this also serializes retries.
  perform 1 from public.profiles where id = p_user_id for update;
  select * into v_round from public.gamble_rounds
    where id = p_round_id and user_id = p_user_id and game = 'crash' for update;
  if v_round is null or not (v_round.state ? 'crashPoint') then
    return jsonb_build_object('error', 'round_not_found');
  end if;
  v_start := coalesce((v_round.state->>'startsAt')::timestamptz, v_round.created_at);
  v_crash := (v_round.state->>'crashPoint')::numeric;
  if v_round.status <> 'open' then
    -- Return the original result, even after Double or Nothing, without
    -- writing a second payout or exposing an unrelated round.
    return jsonb_build_object('settled', true,
      'survived', coalesce((v_round.state->>'survived')::boolean, false),
      'crashed', coalesce((v_round.state->>'busted')::boolean, false),
      'crashPoint', v_crash,
      'multiplier', coalesce((v_round.state->>'atCashout')::numeric, v_crash),
      'payout', coalesce((v_round.state->>'cashoutPayout')::integer, v_round.payout));
  end if;
  v_now := clock_timestamp();
  if v_now < v_start then
    if p_cashout then return jsonb_build_object('error', 'round_starting'); end if;
    return jsonb_build_object('settled', false, 'crashed', false,
      'startsAtMs', extract(epoch from v_start) * 1000);
  end if;
  v_actual := public.gamble_crash_multiplier(v_start, v_now);
  v_target := (v_round.state->>'autoCashout')::numeric;
  if v_target >= 1.10 and v_target <= 30 and v_target < v_crash and v_actual >= v_target then
    v_won := true;
    v_multiplier := v_target;
  elsif v_actual >= v_crash then
    v_won := false;
    v_multiplier := v_crash;
  elsif p_cashout then
    v_won := true;
    v_multiplier := least(v_actual, greatest(1, round(coalesce(p_requested_multiplier, v_actual), 2)));
  else
    return jsonb_build_object('settled', false, 'crashed', false,
      'startsAtMs', extract(epoch from v_start) * 1000);
  end if;
  v_payout := case when v_won then floor(v_round.wager * v_multiplier)::integer else 0 end;
  v_result := public.gamble_settle_round(p_user_id, p_round_id, v_payout,
    jsonb_build_object('survived', v_won, 'busted', not v_won,
      'atCashout', v_multiplier, 'cashoutPayout', v_payout));
  if v_result ? 'error' then return v_result; end if;
  return jsonb_build_object('settled', true, 'survived', v_won, 'crashed', not v_won,
    'crashPoint', v_crash, 'multiplier', v_multiplier, 'payout', v_payout);
end;
$$;

create or replace function public.gamble_crash_status(p_user_id uuid, p_round_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select public.gamble_crash_resolve(p_user_id, p_round_id, null, false);
$$;

create or replace function public.gamble_crash_cashout(p_user_id uuid, p_round_id uuid, p_requested_multiplier numeric)
returns jsonb language sql security definer set search_path = public as $$
  select public.gamble_crash_resolve(p_user_id, p_round_id, p_requested_multiplier, true);
$$;

create or replace function public.gamble_crash_open(
  p_user_id uuid, p_wager integer, p_crash_point numeric, p_auto_cashout numeric
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_existing record;
  v_result jsonb;
  v_start timestamptz;
begin
  if p_wager is null or p_wager < 100 or p_wager > 5000 or p_crash_point is null
    or p_crash_point < 1 or p_crash_point > 30
    or (p_auto_cashout is not null and (p_auto_cashout < 1.10 or p_auto_cashout > 30)) then
    return jsonb_build_object('error', 'invalid_bet');
  end if;
  perform 1 from public.profiles where id = p_user_id for update;
  -- A reconnect resumes a live round; reached targets settle before a new wager.
  for v_existing in select * from public.gamble_rounds
    where user_id = p_user_id and game = 'crash' and status = 'open' for update
  loop
    v_result := public.gamble_crash_resolve(p_user_id, v_existing.id, null, false);
    if v_result ? 'error' then return v_result; end if;
    if not (v_result->>'settled')::boolean then
      return v_result || jsonb_build_object('roundId', v_existing.id, 'resumed', true,
        'autoCashout', v_existing.state->'autoCashout');
    end if;
  end loop;
  v_result := public.gamble_open_round(p_user_id, 'crash', p_wager,
    jsonb_build_object('crashPoint', p_crash_point, 'autoCashout', p_auto_cashout), 0);
  if v_result ? 'error' then return v_result; end if;
  -- Start after the debit and locks complete, not before the database request.
  v_start := clock_timestamp() + interval '3 seconds';
  update public.gamble_rounds set state = state || jsonb_build_object('startsAt', v_start)
    where id = (v_result->>'roundId')::uuid;
  return v_result || jsonb_build_object('startsAtMs', extract(epoch from v_start) * 1000,
    'autoCashout', p_auto_cashout);
end;
$$;

revoke all on function public.gamble_crash_resolve(uuid,uuid,numeric,boolean) from public, anon, authenticated;
revoke all on function public.gamble_crash_open(uuid,integer,numeric,numeric) from public, anon, authenticated;
revoke all on function public.gamble_crash_status(uuid,uuid) from public, anon, authenticated;
revoke all on function public.gamble_crash_cashout(uuid,uuid,numeric) from public, anon, authenticated;
grant execute on function public.gamble_crash_resolve(uuid,uuid,numeric,boolean) to service_role;
grant execute on function public.gamble_crash_open(uuid,integer,numeric,numeric) to service_role;
grant execute on function public.gamble_crash_status(uuid,uuid) to service_role;
grant execute on function public.gamble_crash_cashout(uuid,uuid,numeric) to service_role;
commit;
