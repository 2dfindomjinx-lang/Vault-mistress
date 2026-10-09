-- Apply after 202609100001_court_gameplay.sql. No balances or historical rounds are changed.
-- Receipt timestamps come exclusively from the authenticated server route.
begin;
create or replace function public.gamble_crash_resolve_v2(
  p_user_id uuid, p_round_id uuid, p_requested_multiplier numeric, p_cashout boolean, p_received_at timestamptz
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_round record;
  v_now timestamptz := clock_timestamp();
  v_received timestamptz := coalesce(p_received_at, statement_timestamp());
  v_manual_actual numeric;
  v_start timestamptz;
  v_crash numeric;
  v_actual numeric;
  v_target numeric;
  v_multiplier numeric;
  v_won boolean;
  v_payout integer;
  v_result jsonb;
begin
  if v_received > v_now + interval '1 second' or v_received < v_now - interval '15 seconds' then
    return jsonb_build_object('error', 'invalid_receipt_time');
  end if;
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
  -- Auth, database transit and row-lock waits cannot turn an on-time request into a loss.
  v_now := greatest(v_start, v_received - case when p_cashout then interval '350 milliseconds' else interval '0 milliseconds' end);
  if v_received < v_start then
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
    -- Leave a bounded window for a cashout already in flight; do not finalize it in a poll.
    v_manual_actual := public.gamble_crash_multiplier(v_start, greatest(v_start, v_received - interval '1 second'));
    if not p_cashout and v_manual_actual < v_crash then
      return jsonb_build_object('settled', false, 'crashed', false, 'startsAtMs', extract(epoch from v_start) * 1000);
    end if;
    v_won := false;
    v_multiplier := v_crash;
  elsif p_cashout then
    v_won := true;
    -- The transport allowance protects timing; it must not subtract from the displayed payout.
    v_multiplier := least(public.gamble_crash_multiplier(v_start, v_received),
      greatest(1, round(coalesce(p_requested_multiplier, v_actual), 2)), v_crash - 0.01);
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


create or replace function public.gamble_crash_resolve(p_user_id uuid,p_round_id uuid,p_requested_multiplier numeric,p_cashout boolean)
returns jsonb language sql security definer set search_path=public as $$
 select public.gamble_crash_resolve_v2(p_user_id,p_round_id,p_requested_multiplier,p_cashout,statement_timestamp());
$$;
create or replace function public.gamble_crash_cashout_at(p_user_id uuid,p_round_id uuid,p_requested_multiplier numeric,p_received_at timestamptz)
returns jsonb language sql security definer set search_path=public as $$
 select public.gamble_crash_resolve_v2(p_user_id,p_round_id,p_requested_multiplier,true,p_received_at);
$$;
revoke all on function public.gamble_crash_resolve_v2(uuid,uuid,numeric,boolean,timestamptz) from public,anon,authenticated;
revoke all on function public.gamble_crash_cashout_at(uuid,uuid,numeric,timestamptz) from public,anon,authenticated;
grant execute on function public.gamble_crash_resolve_v2(uuid,uuid,numeric,boolean,timestamptz) to service_role;
grant execute on function public.gamble_crash_cashout_at(uuid,uuid,numeric,timestamptz) to service_role;
notify pgrst, 'reload schema';
commit;
