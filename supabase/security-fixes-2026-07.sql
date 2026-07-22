-- Security audit fixes (2026-07):
--   1. Gallery / pet-gallery / sacrifice unlocks are now atomic, idempotent,
--      and reject the whole request with zero side effects on insufficient
--      funds (previously these routes granted unlocks without any coin or
--      eligibility check at all).
--   2. Jackpot contribution is now a single atomic RPC (coin deduction +
--      contribution row + ledger entry all-or-nothing), replacing four
--      separate Supabase calls with a manual best-effort rollback.
--   3. A generic rate-limit bucket table + check function, used by the API
--      routes that spend coins, gamble, or hit sensitive admin actions.
--
-- Run after schema.sql, retention-maintenance.sql and
-- vercel-performance-optimizations.sql. All functions are security definer,
-- owned by a role only the service key can assume, and grants to
-- anon/authenticated are explicitly revoked (execute is explicitly granted
-- only to service_role) - matching the existing RPCs in this project. Every
-- function takes p_user_id as a parameter but is NEVER reachable by the
-- `authenticated` Postgres role (execute revoked), so a user's own JWT can
-- never invoke these directly to act on someone else's id - only the
-- server's service-role client can call them, and it always sources
-- p_user_id from the caller's verified session (auth.getUser()), never from
-- request-body input. See scripts/security-integration-tests.mjs for a test
-- that a signed-in user's own session cannot call these RPCs directly.

-- ---------------------------------------------------------------------------
-- Gallery unlocks: charge (if any) + idempotent unlock in one transaction.
-- p_common_items: jsonb array of {"item_id": text, "cost": integer} - the
--   caller's best-effort filtered list of coin-gated items to unlock. This
--   function does NOT trust that filtering for charging purposes: it
--   re-checks ownership itself, inside the row lock below, and only charges
--   for items that are genuinely not-yet-owned AT THAT INSTANT. This is what
--   makes concurrent/duplicate requests for the same item safe - the
--   caller's pre-check (done before this RPC was even invoked) can be stale
--   by the time this function actually runs.
-- p_free_items: item ids that are free to unlock (mood-gated items whose
--   threshold the caller has already verified against the profile row).
-- Returns {"coins": int, "chargedTotal": int} on success, or
-- {"error": "insufficient_funds"|"profile_not_found", ...} with NO writes.
create or replace function public.unlock_gallery_items_atomic(
  p_user_id uuid,
  p_common_items jsonb,
  p_free_items text[],
  p_reason text default 'spend:gallery-unlock'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins integer;
  v_total_cost integer := 0;
  v_new_coins integer;
  v_already_common text[];
  v_new_common jsonb;
  v_new_common_ids jsonb;
begin
  -- Locks the profile row so concurrent calls for the SAME user serialize:
  -- a second call only proceeds after the first has fully committed, at
  -- which point the ownership re-check below sees the first call's writes.
  select coins into v_coins from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  -- Re-check ownership INSIDE the lock - authoritative at this instant.
  select coalesce(array_agg(item_id), array[]::text[])
  into v_already_common
  from public.user_gallery
  where user_id = p_user_id
    and item_id in (
      select elem->>'item_id' from jsonb_array_elements(coalesce(p_common_items, '[]'::jsonb)) elem
    );

  -- Only the genuinely-not-yet-owned entries are charged and inserted below.
  -- A mixed request containing both already-owned and new items therefore
  -- only ever charges for the new ones.
  select coalesce(jsonb_agg(elem), '[]'::jsonb)
  into v_new_common
  from jsonb_array_elements(coalesce(p_common_items, '[]'::jsonb)) elem
  where not (elem->>'item_id' = any(v_already_common));

  select coalesce(sum((elem->>'cost')::integer), 0)
  into v_total_cost
  from jsonb_array_elements(v_new_common) elem;

  if v_total_cost > 0 and v_coins < v_total_cost then
    return jsonb_build_object('error', 'insufficient_funds', 'coins', v_coins, 'required', v_total_cost);
  end if;

  v_new_coins := v_coins - v_total_cost;

  if v_total_cost > 0 then
    update public.profiles set coins = v_new_coins, updated_at = now() where id = p_user_id;

    select coalesce(jsonb_agg(elem->>'item_id'), '[]'::jsonb)
    into v_new_common_ids
    from jsonb_array_elements(v_new_common) elem;

    insert into public.coin_transactions (user_id, amount, balance_before, balance_after, reason, metadata)
    values (
      p_user_id,
      -v_total_cost,
      v_coins,
      v_new_coins,
      p_reason,
      jsonb_build_object('spendAmount', v_total_cost, 'itemIds', v_new_common_ids)
    );
  end if;

  -- Always insert from v_new_common (the re-checked set), never the raw
  -- caller-supplied p_common_items - `on conflict do nothing` is redundant
  -- defense-in-depth here, not the primary correctness mechanism.
  insert into public.user_gallery (user_id, item_id)
  select p_user_id, elem->>'item_id' from jsonb_array_elements(v_new_common) elem
  on conflict (user_id, item_id) do nothing;

  insert into public.unlocked_gallery_items (user_id, item_id)
  select p_user_id, elem->>'item_id' from jsonb_array_elements(v_new_common) elem
  on conflict (user_id, item_id) do nothing;

  if p_free_items is not null and array_length(p_free_items, 1) is not null then
    insert into public.user_gallery (user_id, item_id)
    select p_user_id, x from unnest(p_free_items) as x
    on conflict (user_id, item_id) do nothing;

    insert into public.unlocked_gallery_items (user_id, item_id)
    select p_user_id, x from unnest(p_free_items) as x
    on conflict (user_id, item_id) do nothing;
  end if;

  return jsonb_build_object('coins', v_new_coins, 'chargedTotal', v_total_cost);
end;
$$;

revoke all on function public.unlock_gallery_items_atomic(uuid, jsonb, text[], text) from public, anon, authenticated;
grant execute on function public.unlock_gallery_items_atomic(uuid, jsonb, text[], text) to service_role;

-- ---------------------------------------------------------------------------
-- Pet gallery unlocks: free, pet_score-threshold gated. `on conflict do
-- nothing` is sufficient here on its own (unlike the paid gallery above) -
-- there is no coin charge or other side effect tied to this write, so a
-- harmless duplicate insert attempt has nothing to double-spend.
create or replace function public.unlock_pet_gallery_items_atomic(
  p_user_id uuid,
  p_item_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = p_user_id) then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  if p_item_ids is not null and array_length(p_item_ids, 1) is not null then
    insert into public.user_pet_gallery (user_id, item_id)
    select p_user_id, x from unnest(p_item_ids) as x
    on conflict (user_id, item_id) do nothing;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.unlock_pet_gallery_items_atomic(uuid, text[]) from public, anon, authenticated;
grant execute on function public.unlock_pet_gallery_items_atomic(uuid, text[]) to service_role;

-- ---------------------------------------------------------------------------
-- Sacrifice mechanic: the coin charge, the random roll, and the resulting
-- unlock must all happen server-side in one transaction - previously the
-- client rolled its own dice and simply told the server which item it
-- "won", with no server-side verification of the roll, the cost, or even
-- that a roll happened at all.
--
-- Race safety: the profile row lock (for update) serializes concurrent
-- calls for the SAME user; v_already/v_remaining are computed from a FRESH
-- read of user_gallery taken after acquiring that lock, so a second call
-- unblocked after a first call's commit correctly sees the first call's
-- newly-unlocked item and will never pick/charge for it again.
--
-- Returns {"won": bool, "itemId": text|null, "coins": int} or
-- {"completed": true, "coins": int} once every candidate id is unlocked, or
-- {"error": "insufficient_funds"|"profile_not_found", ...} with NO writes.
create or replace function public.roll_sacrifice_unlock(
  p_user_id uuid,
  p_cost integer,
  p_chance numeric,
  p_candidate_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins integer;
  v_tribute_total integer;
  v_new_coins integer;
  v_already text[];
  v_remaining text[];
  v_won boolean;
  v_chosen text;
begin
  select coins, coalesce(tribute_total, 0) into v_coins, v_tribute_total
  from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  select coalesce(array_agg(item_id), array[]::text[])
  into v_already
  from public.user_gallery
  where user_id = p_user_id and item_id = any(p_candidate_ids);

  select coalesce(array_agg(x), array[]::text[])
  into v_remaining
  from unnest(p_candidate_ids) as x
  where x <> all(v_already);

  if array_length(v_remaining, 1) is null then
    return jsonb_build_object('completed', true, 'coins', v_coins);
  end if;

  if v_coins < p_cost then
    return jsonb_build_object('error', 'insufficient_funds', 'coins', v_coins, 'required', p_cost);
  end if;

  v_new_coins := v_coins - p_cost;

  update public.profiles
  set coins = v_new_coins, tribute_total = v_tribute_total + p_cost, updated_at = now()
  where id = p_user_id;

  insert into public.coin_transactions (user_id, amount, balance_before, balance_after, reason, metadata)
  values (
    p_user_id,
    -p_cost,
    v_coins,
    v_new_coins,
    'tribute:sacrifice',
    jsonb_build_object('spendAmount', p_cost, 'prestigeSource', 'sacrifice')
  );

  v_won := random() < p_chance;

  if v_won then
    v_chosen := v_remaining[1 + floor(random() * array_length(v_remaining, 1))::int];

    insert into public.user_gallery (user_id, item_id) values (p_user_id, v_chosen)
    on conflict (user_id, item_id) do nothing;

    insert into public.unlocked_gallery_items (user_id, item_id) values (p_user_id, v_chosen)
    on conflict (user_id, item_id) do nothing;
  end if;

  return jsonb_build_object('won', v_won, 'itemId', v_chosen, 'coins', v_new_coins);
end;
$$;

revoke all on function public.roll_sacrifice_unlock(uuid, integer, numeric, text[]) from public, anon, authenticated;
grant execute on function public.roll_sacrifice_unlock(uuid, integer, numeric, text[]) to service_role;

-- ---------------------------------------------------------------------------
-- Jackpot contribution: coin deduction + contribution row + ledger entry in
-- one atomic transaction. Previously these were four separate Supabase
-- calls (read, CAS update, insert, insert) with a manual best-effort
-- rollback if a later step failed - which cannot protect against the
-- process crashing or timing out between steps, so a committed coin
-- deduction with no matching contribution/ledger row was possible. Wrapping
-- all of it in a single plpgsql function makes it one transaction: any
-- failure anywhere inside rolls back everything the function did, so a
-- coin deduction can never commit without its contribution + ledger row,
-- and vice versa.
create or replace function public.contribute_to_jackpot_atomic(
  p_user_id uuid,
  p_jackpot_id uuid,
  p_cycle_key text,
  p_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins integer;
  v_is_admin boolean;
  v_username text;
  v_new_coins integer;
begin
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('error', 'invalid_amount');
  end if;

  select coins, coalesce(is_admin, false), username
  into v_coins, v_is_admin, v_username
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  if v_is_admin then
    return jsonb_build_object('error', 'admin_not_allowed');
  end if;

  if v_coins < p_amount then
    return jsonb_build_object('error', 'insufficient_funds', 'coins', v_coins, 'required', p_amount);
  end if;

  v_new_coins := v_coins - p_amount;

  update public.profiles set coins = v_new_coins, updated_at = now() where id = p_user_id;

  insert into public.loyalty_jackpot_contributions (jackpot_id, user_id, username, amount)
  values (p_jackpot_id, p_user_id, v_username, p_amount);

  insert into public.coin_transactions (user_id, amount, balance_before, balance_after, reason, metadata)
  values (
    p_user_id,
    -p_amount,
    v_coins,
    v_new_coins,
    'jackpot_contribution',
    jsonb_build_object('jackpotId', p_jackpot_id, 'cycleKey', p_cycle_key, 'tributeTotalChanged', false)
  );

  return jsonb_build_object('coins', v_new_coins);
end;
$$;

revoke all on function public.contribute_to_jackpot_atomic(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.contribute_to_jackpot_atomic(uuid, uuid, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Generic rate limiting. Fixed-window counter keyed by an arbitrary caller
-- string (e.g. "gallery-unlock:<userId>"); atomic via row-level locking
-- (the upsert's implicit per-row lock) so concurrent requests from the same
-- key serialize instead of racing past the limit. bucket_key is the primary
-- key, which is both the uniqueness constraint and the lookup index.
create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0
);

alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from anon, authenticated;

create or replace function public.check_rate_limit(
  p_key text,
  p_max_count integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_started_at timestamptz;
  v_count integer;
  v_retry_after integer;
begin
  insert into public.rate_limit_buckets (bucket_key, window_started_at, request_count)
  values (p_key, v_now, 1)
  on conflict (bucket_key) do update
    set request_count = case
          when public.rate_limit_buckets.window_started_at <= v_now - make_interval(secs => p_window_seconds)
            then 1
          else public.rate_limit_buckets.request_count + 1
        end,
        window_started_at = case
          when public.rate_limit_buckets.window_started_at <= v_now - make_interval(secs => p_window_seconds)
            then v_now
          else public.rate_limit_buckets.window_started_at
        end
  returning request_count, window_started_at into v_count, v_window_started_at;

  if v_count > p_max_count then
    v_retry_after := greatest(1, p_window_seconds - extract(epoch from (v_now - v_window_started_at))::integer);
    return jsonb_build_object('allowed', false, 'retryAfterSeconds', v_retry_after, 'count', v_count);
  end if;

  return jsonb_build_object('allowed', true, 'retryAfterSeconds', 0, 'count', v_count);
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- Periodic cleanup so the bucket table doesn't grow unbounded; called from
-- the existing data-retention cron (src/app/api/cron/data-retention/route.ts).
create or replace function public.prune_rate_limit_buckets()
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.rate_limit_buckets
    where window_started_at < now() - interval '1 day'
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public.prune_rate_limit_buckets() from public, anon, authenticated;
grant execute on function public.prune_rate_limit_buckets() to service_role;
