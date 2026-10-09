-- Apply before deploying the corresponding application changes.
-- Existing game RPCs (including receipt-time cashout) remain authoritative.
begin;

-- Return one value instead of downloading the user's transaction history.
-- No caller-supplied user ID; RLS and auth.uid() both constrain the read.
create or replace function public.my_throne_coin_total()
returns bigint
language sql stable security invoker
set search_path = public
as $$
  select coalesce(sum(greatest(amount, 0)), 0)::bigint
  from public.coin_transactions
  where user_id = auth.uid()
    and (reason = 'throne_tribute'
      or (reason = 'live_gift' and (
        metadata->>'command' = 'give'
        or metadata->>'kind' = 'manual_coin_purchase'
        or metadata->>'source' = 'throne'
      )));
$$;
revoke all on function public.my_throne_coin_total() from public, anon;
grant execute on function public.my_throne_coin_total() to authenticated;

-- One network round trip: rate limit, existing atomic game operation, profile.
-- Only the trusted API can call this; outcomes are still rolled using crypto
-- on the server. This is deliberately an explicit allowlist, not dynamic SQL.
create or replace function public.gamble_request(p_user_id uuid, p_operation text, p_args jsonb)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_limit jsonb;
  v_result jsonb;
  v_profile jsonb;
  v_status boolean := p_operation = 'gamble_crash_status';
begin
  if p_user_id is null or p_operation is null or p_operation not in (
    'gamble_open_round', 'gamble_play_round', 'gamble_mines_pick',
    'gamble_mines_cashout', 'gamble_crash_open', 'gamble_crash_status',
    'gamble_crash_cashout_at', 'gamble_double_round'
  ) then return jsonb_build_object('error', 'invalid_operation'); end if;

  v_limit := public.check_rate_limit(
    (case when v_status then 'gamble-status:' else 'gamble:' end) || p_user_id::text,
    case when v_status then 150 else 30 end, 60
  );
  if (v_limit->>'allowed')::boolean is distinct from true then
    return jsonb_build_object('error', 'rate_limited', 'retryAfterSeconds', coalesce((v_limit->>'retryAfterSeconds')::integer, 5));
  end if;

  -- Catch malformed arguments inside a subtransaction: preserve the limiter,
  -- roll back ALL game writes, and never retry a possibly committed mutation.
  begin
    case p_operation
      when 'gamble_open_round' then
        v_result := public.gamble_open_round(p_user_id, p_args->>'p_game', (p_args->>'p_wager')::integer, p_args->'p_state', 0);
      when 'gamble_play_round' then
        v_result := public.gamble_play_round(p_user_id, p_args->>'p_game', (p_args->>'p_wager')::integer, p_args->'p_state', (p_args->>'p_payout')::integer, (p_args->>'p_source_round_id')::uuid);
      when 'gamble_mines_pick' then
        v_result := public.gamble_mines_pick(p_user_id, (p_args->>'p_round_id')::uuid, (p_args->>'p_cell')::integer);
      when 'gamble_mines_cashout' then
        v_result := public.gamble_mines_cashout(p_user_id, (p_args->>'p_round_id')::uuid);
      when 'gamble_crash_open' then
        v_result := public.gamble_crash_open(p_user_id, (p_args->>'p_wager')::integer, (p_args->>'p_crash_point')::numeric, (p_args->>'p_auto_cashout')::numeric);
      when 'gamble_crash_status' then
        v_result := public.gamble_crash_status(p_user_id, (p_args->>'p_round_id')::uuid);
      when 'gamble_crash_cashout_at' then
        v_result := public.gamble_crash_cashout_at(p_user_id, (p_args->>'p_round_id')::uuid, (p_args->>'p_requested_multiplier')::numeric, (p_args->>'p_received_at')::timestamptz);
      when 'gamble_double_round' then
        v_result := public.gamble_double_round(p_user_id, (p_args->>'p_round_id')::uuid, (p_args->>'p_won')::boolean);
    end case;

    if not (v_result ? 'error')
      and (not v_status or coalesce((v_result->>'settled')::boolean, false))
      and (p_operation <> 'gamble_mines_pick' or coalesce((v_result->>'bust')::boolean, false)) then
      -- API applies its public column allowlist before sending the profile.
      select to_jsonb(p) into v_profile from public.profiles p where p.id = p_user_id;
    end if;
  exception when others then
    raise log 'gamble_request failed: %', sqlstate;
    return jsonb_build_object('error', 'operation_failed');
  end;
  return jsonb_build_object('result', v_result, 'profile', v_profile);
end;
$$;
revoke all on function public.gamble_request(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.gamble_request(uuid, text, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
