-- The Gamble Hall engine. One round table and server-only RPCs carry all seven games:
-- single-call games (slots, dice, roulette, plinko, crawl) open and settle in
-- one server action; stateful games (mines, crash) open a round whose secret
-- (mine layout, crash point) lives in the row's state and is settled later.
--
-- House rules enforced here, not in the client:
--   * Bets are clamped 100..5000 per round.
--   * Double or Nothing risks an already-settled payout exactly once.
--
-- Safe to re-run.

create table if not exists public.gamble_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null,
  wager integer not null check (wager >= 0),
  payout integer not null default 0 check (payout >= 0),
  status text not null default 'open' check (status in ('open', 'settled', 'doubled', 'lost_double')),
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists gamble_rounds_user_idx on public.gamble_rounds (user_id, created_at desc);
create index if not exists gamble_rounds_open_idx on public.gamble_rounds (user_id, game) where status = 'open';

-- Net result per player per day, retained for analytics and tuning.
create table if not exists public.gamble_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day_key text not null,
  net integer not null default 0,
  wagered integer not null default 0,
  primary key (user_id, day_key)
);

alter table public.gamble_rounds enable row level security;
alter table public.gamble_days enable row level security;
revoke all on public.gamble_rounds from public, anon, authenticated;
revoke all on public.gamble_days from public, anon, authenticated;

create or replace function public.gamble_day_key(p_at timestamptz default now())
returns text
language sql
stable
as $$
  select to_char(p_at at time zone 'Etc/GMT-3', 'YYYY-MM-DD');
$$;

-- ---------------------------------------------------------------- open round
-- Deducts the wager and stores the round's secret state. p_loss_cap remains
-- in the signature for deployed-client compatibility but is intentionally
-- ignored: the hall no longer has a daily loss ceiling.
create or replace function public.gamble_open_round(
  p_user_id uuid,
  p_game text,
  p_wager integer,
  p_state jsonb,
  p_loss_cap integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins integer;
  v_round_id uuid;
  v_stale record;
begin
  -- Zero is a real wager here: The Crawl opens a costless race-sheet round to
  -- pin its odds server-side before any bet exists. Everything positive obeys
  -- the table limits.
  if p_wager is null or p_wager < 0 or (p_wager > 0 and p_wager < 100) or p_wager > 5000 then
    return jsonb_build_object('error', 'invalid_bet');
  end if;

  select coins into v_coins from public.profiles where id = p_user_id for update;
  if v_coins is null then
    return jsonb_build_object('error', 'profile_not_found');
  end if;
  if v_coins < p_wager then
    return jsonb_build_object('error', 'insufficient_coins', 'coins', v_coins);
  end if;

  -- An abandoned stateful round is a forfeit, settled the moment its game is
  -- opened again: walking away from live mines must not be a free retry.
  for v_stale in
    select id from public.gamble_rounds
    where user_id = p_user_id and game = p_game and status = 'open'
    for update
  loop
    update public.gamble_rounds
    set status = 'settled', payout = 0, settled_at = now(),
        state = state || jsonb_build_object('abandoned', true)
    where id = v_stale.id;
  end loop;

  update public.profiles set coins = v_coins - p_wager, updated_at = now() where id = p_user_id;
  insert into public.coin_transactions (user_id, amount, balance_before, balance_after, reason, metadata)
  values (p_user_id, -p_wager, v_coins, v_coins - p_wager, 'spend:gamble:' || p_game, '{}'::jsonb);

  insert into public.gamble_days as d (user_id, day_key, net, wagered)
  values (p_user_id, public.gamble_day_key(), -p_wager, p_wager)
  on conflict (user_id, day_key)
  do update set net = d.net - p_wager, wagered = d.wagered + p_wager;

  insert into public.gamble_rounds (user_id, game, wager, state)
  values (p_user_id, p_game, p_wager, coalesce(p_state, '{}'::jsonb))
  returning id into v_round_id;

  return jsonb_build_object('roundId', v_round_id, 'coins', v_coins - p_wager);
end;
$$;

-- ---------------------------------------------------------- instant round
-- Stateless games debit and settle inside one transaction. p_source_round_id
-- is only used by The Crawl, whose published race sheet is consumed exactly
-- once under the same profile lock as the wager.
create or replace function public.gamble_play_round(
  p_user_id uuid,
  p_game text,
  p_wager integer,
  p_state jsonb,
  p_payout integer,
  p_source_round_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins integer;
  v_round_id uuid := gen_random_uuid();
  v_source record;
  v_stale record;
begin
  if p_game not in ('slots', 'dice', 'roulette', 'plinko', 'crawl') then
    return jsonb_build_object('error', 'invalid_game');
  end if;
  if p_wager is null or p_wager < 100 or p_wager > 5000 then
    return jsonb_build_object('error', 'invalid_bet');
  end if;
  if p_payout is null or p_payout < 0 or p_payout > p_wager * 250 then
    return jsonb_build_object('error', 'invalid_payout');
  end if;

  select coins into v_coins
  from public.profiles
  where id = p_user_id
  for update;

  if v_coins is null then
    return jsonb_build_object('error', 'profile_not_found');
  end if;
  if v_coins < p_wager then
    return jsonb_build_object('error', 'insufficient_coins', 'coins', v_coins);
  end if;

  if p_game = 'crawl' then
    select * into v_source
    from public.gamble_rounds
    where id = p_source_round_id
      and user_id = p_user_id
      and game = 'crawl'
    for update;

    if v_source is null
       or v_source.status <> 'open'
       or v_source.wager <> 0
       or not (v_source.state ? 'odds')
       or coalesce((v_source.state ->> 'bet')::boolean, false) then
      return jsonb_build_object('error', 'race_closed');
    end if;

    update public.gamble_rounds
    set status = 'settled', payout = 0, settled_at = now(),
        state = state || jsonb_build_object('bet', true)
    where id = v_source.id;
  elsif p_source_round_id is not null then
    return jsonb_build_object('error', 'invalid_source_round');
  end if;

  -- Clean up any legacy instant round left open by an interrupted pre-atomic
  -- request. The selected Crawl source was settled just above.
  for v_stale in
    select id from public.gamble_rounds
    where user_id = p_user_id and game = p_game and status = 'open'
    for update
  loop
    update public.gamble_rounds
    set status = 'settled', payout = 0, settled_at = now(),
        state = state || jsonb_build_object('abandoned', true)
    where id = v_stale.id;
  end loop;

  update public.profiles
  set coins = v_coins - p_wager + p_payout,
      updated_at = now()
  where id = p_user_id;

  insert into public.coin_transactions (user_id, amount, balance_before, balance_after, reason, metadata)
  values (
    p_user_id, -p_wager, v_coins, v_coins - p_wager, 'spend:gamble:' || p_game,
    jsonb_build_object('roundId', v_round_id)
  );

  if p_payout > 0 then
    insert into public.coin_transactions (user_id, amount, balance_before, balance_after, reason, metadata)
    values (
      p_user_id, p_payout, v_coins - p_wager, v_coins - p_wager + p_payout,
      'reward:gamble:' || p_game, jsonb_build_object('roundId', v_round_id)
    );
  end if;

  insert into public.gamble_days as d (user_id, day_key, net, wagered)
  values (p_user_id, public.gamble_day_key(), p_payout - p_wager, p_wager)
  on conflict (user_id, day_key)
  do update set net = d.net + p_payout - p_wager,
                wagered = d.wagered + p_wager;

  insert into public.gamble_rounds
    (id, user_id, game, wager, payout, status, state, settled_at)
  values (
    v_round_id, p_user_id, p_game, p_wager, p_payout, 'settled',
    coalesce(p_state, '{}'::jsonb), now()
  );

  return jsonb_build_object(
    'settled', true,
    'roundId', v_round_id,
    'payout', p_payout,
    'coins', v_coins - p_wager + p_payout
  );
end;
$$;

-- -------------------------------------------------------------- settle round
create or replace function public.gamble_settle_round(
  p_user_id uuid,
  p_round_id uuid,
  p_payout integer,
  p_state_patch jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round record;
  v_coins integer;
begin
  select * into v_round from public.gamble_rounds
  where id = p_round_id and user_id = p_user_id
  for update;

  if v_round is null then
    return jsonb_build_object('error', 'round_not_found');
  end if;
  if v_round.status <> 'open' then
    return jsonb_build_object('error', 'round_closed');
  end if;
  if p_payout is null or p_payout < 0 or p_payout > v_round.wager * 250 then
    return jsonb_build_object('error', 'invalid_payout');
  end if;

  select coins into v_coins from public.profiles where id = p_user_id for update;

  if p_payout > 0 then
    update public.profiles set coins = v_coins + p_payout, updated_at = now() where id = p_user_id;
    insert into public.coin_transactions (user_id, amount, balance_before, balance_after, reason, metadata)
    values (p_user_id, p_payout, v_coins, v_coins + p_payout, 'reward:gamble:' || v_round.game,
            jsonb_build_object('roundId', v_round.id));
  end if;

  insert into public.gamble_days as d (user_id, day_key, net, wagered)
  values (p_user_id, public.gamble_day_key(), p_payout, 0)
  on conflict (user_id, day_key)
  do update set net = d.net + p_payout;

  update public.gamble_rounds
  set status = 'settled', payout = p_payout, settled_at = now(),
      state = state || coalesce(p_state_patch, '{}'::jsonb)
  where id = v_round.id;

  return jsonb_build_object('settled', true, 'payout', p_payout, 'coins', v_coins + p_payout);
end;
$$;

-- --------------------------------------------------------- double or nothing
-- Risks a settled payout once. The chance is decided by the caller (server
-- route) and passed as the outcome; this function only moves the coins.
create or replace function public.gamble_double_round(
  p_user_id uuid,
  p_round_id uuid,
  p_won boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round record;
  v_coins integer;
begin
  select * into v_round from public.gamble_rounds
  where id = p_round_id and user_id = p_user_id
  for update;

  if v_round is null then
    return jsonb_build_object('error', 'round_not_found');
  end if;
  if v_round.status <> 'settled' or v_round.payout <= 0 then
    return jsonb_build_object('error', 'not_doublable');
  end if;

  select coins into v_coins from public.profiles where id = p_user_id for update;

  -- A Double risks the full credited payout. If it has already been spent,
  -- the option is gone; another balance or a purchased item cannot shield the
  -- stake from a losing flip.
  if v_coins < v_round.payout then
    return jsonb_build_object('error', 'payout_unavailable', 'required', v_round.payout, 'coins', v_coins);
  end if;

  if p_won then
    update public.profiles set coins = v_coins + v_round.payout, updated_at = now() where id = p_user_id;
    insert into public.coin_transactions (user_id, amount, balance_before, balance_after, reason, metadata)
    values (p_user_id, v_round.payout, v_coins, v_coins + v_round.payout, 'reward:gamble:double',
            jsonb_build_object('roundId', v_round.id));
    insert into public.gamble_days as d (user_id, day_key, net, wagered)
    values (p_user_id, public.gamble_day_key(), v_round.payout, 0)
    on conflict (user_id, day_key) do update set net = d.net + v_round.payout;
    update public.gamble_rounds set status = 'doubled', payout = payout * 2 where id = v_round.id;
    return jsonb_build_object('won', true, 'payout', v_round.payout * 2, 'coins', v_coins + v_round.payout);
  end if;

  -- The full payout is still available, so a loss removes the exact stake.
  update public.profiles
  set coins = v_coins - v_round.payout, updated_at = now()
  where id = p_user_id;
  insert into public.coin_transactions (user_id, amount, balance_before, balance_after, reason, metadata)
  values (p_user_id, -v_round.payout, v_coins, v_coins - v_round.payout,
          'spend:gamble:double', jsonb_build_object('roundId', v_round.id));
  insert into public.gamble_days as d (user_id, day_key, net, wagered)
  values (p_user_id, public.gamble_day_key(), -v_round.payout, 0)
  on conflict (user_id, day_key) do update set net = d.net - v_round.payout;
  update public.gamble_rounds set status = 'lost_double', payout = 0 where id = v_round.id;
  return jsonb_build_object('won', false, 'payout', 0, 'coins', v_coins - v_round.payout);
end;
$$;

-- ------------------------------------------------------------- update state
-- Mines needs to record picks between open and settle without touching money.
create or replace function public.gamble_patch_round(
  p_user_id uuid,
  p_round_id uuid,
  p_state_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round record;
begin
  select * into v_round from public.gamble_rounds
  where id = p_round_id and user_id = p_user_id
  for update;
  if v_round is null or v_round.status <> 'open' then
    return jsonb_build_object('error', 'round_closed');
  end if;
  update public.gamble_rounds set state = state || coalesce(p_state_patch, '{}'::jsonb) where id = v_round.id;
  return jsonb_build_object('patched', true);
end;
$$;

-- ------------------------------------------------------- stateful helpers
create or replace function public.gamble_mines_multiplier(p_mine_count integer, p_safe_picks integer)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_multiplier numeric := 1;
  v_pick integer;
  v_remaining integer;
  v_safe integer;
begin
  if p_mine_count not in (7, 10, 15) or p_safe_picks is null or p_safe_picks < 0 then
    return null;
  end if;
  if p_safe_picks = 0 then
    return 1;
  end if;
  for v_pick in 0..p_safe_picks - 1 loop
    v_remaining := 25 - v_pick;
    v_safe := v_remaining - p_mine_count;
    if v_safe <= 0 then
      exit;
    end if;
    v_multiplier := v_multiplier * (v_remaining::numeric / v_safe::numeric);
  end loop;
  -- One 18% house cut for the round. Applying it again on every safe pick
  -- would make deeper play progressively worse than the advertised 82% RTP.
  return floor(v_multiplier * 0.82 * 100) / 100;
end;
$$;

create or replace function public.gamble_mines_pick(
  p_user_id uuid,
  p_round_id uuid,
  p_cell integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round record;
  v_mines jsonb;
  v_picks jsonb;
  v_next_picks jsonb;
  v_mine_count integer;
  v_multiplier numeric;
  v_settle jsonb;
begin
  if p_cell is null or p_cell < 0 or p_cell >= 25 then
    return jsonb_build_object('error', 'invalid_cell');
  end if;

  select * into v_round
  from public.gamble_rounds
  where id = p_round_id and user_id = p_user_id and game = 'mines'
  for update;

  if v_round is null or v_round.status <> 'open' then
    return jsonb_build_object('error', 'round_closed');
  end if;

  v_mines := coalesce(v_round.state -> 'mines', '[]'::jsonb);
  v_picks := coalesce(v_round.state -> 'picks', '[]'::jsonb);
  v_mine_count := coalesce((v_round.state ->> 'mineCount')::integer, 7);

  if v_picks @> jsonb_build_array(p_cell) then
    return jsonb_build_object('error', 'already_opened');
  end if;

  if v_mines @> jsonb_build_array(p_cell) then
    select public.gamble_settle_round(
      p_user_id,
      p_round_id,
      0,
      jsonb_build_object('bust', p_cell, 'picks', v_picks)
    ) into v_settle;
    if v_settle ? 'error' then
      return v_settle;
    end if;
    return jsonb_build_object('bust', true, 'mines', v_mines, 'payout', 0);
  end if;

  v_next_picks := v_picks || jsonb_build_array(p_cell);
  v_multiplier := public.gamble_mines_multiplier(v_mine_count, jsonb_array_length(v_next_picks));
  update public.gamble_rounds
  set state = state || jsonb_build_object('picks', v_next_picks)
  where id = p_round_id;

  return jsonb_build_object(
    'bust', false,
    'multiplier', v_multiplier,
    'picks', v_next_picks
  );
end;
$$;

create or replace function public.gamble_mines_cashout(
  p_user_id uuid,
  p_round_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round record;
  v_pick_count integer;
  v_mine_count integer;
  v_multiplier numeric;
  v_payout integer;
  v_settle jsonb;
begin
  select * into v_round
  from public.gamble_rounds
  where id = p_round_id and user_id = p_user_id and game = 'mines'
  for update;

  if v_round is null or v_round.status <> 'open' then
    return jsonb_build_object('error', 'round_closed');
  end if;

  v_pick_count := jsonb_array_length(coalesce(v_round.state -> 'picks', '[]'::jsonb));
  if v_pick_count = 0 then
    return jsonb_build_object('error', 'no_picks');
  end if;

  v_mine_count := coalesce((v_round.state ->> 'mineCount')::integer, 7);
  v_multiplier := public.gamble_mines_multiplier(v_mine_count, v_pick_count);
  v_payout := floor(v_round.wager * v_multiplier)::integer;
  select public.gamble_settle_round(
    p_user_id,
    p_round_id,
    v_payout,
    jsonb_build_object('cashedOut', true)
  ) into v_settle;
  if v_settle ? 'error' then
    return v_settle;
  end if;

  return jsonb_build_object(
    'coins', (v_settle ->> 'coins')::integer,
    'multiplier', v_multiplier,
    'payout', v_payout,
    'roundId', p_round_id
  );
end;
$$;

create or replace function public.gamble_crash_multiplier(
  p_created_at timestamptz,
  p_at timestamptz
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select least(
    30::numeric,
    round(exp(0.07 * greatest(0, extract(epoch from (p_at - p_created_at))))::numeric, 2)
  );
$$;

create or replace function public.gamble_crash_status(
  p_user_id uuid,
  p_round_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round record;
  v_now timestamptz := clock_timestamp();
  v_starts_at timestamptz;
  v_crash_point numeric;
  v_multiplier numeric;
  v_elapsed_ms bigint;
  v_settle jsonb;
begin
  select * into v_round
  from public.gamble_rounds
  where id = p_round_id and user_id = p_user_id and game = 'crash'
  for update;

  if v_round is null or not (v_round.state ? 'crashPoint') then
    return jsonb_build_object('error', 'round_not_found');
  end if;

  v_crash_point := (v_round.state ->> 'crashPoint')::numeric;
  v_starts_at := coalesce((v_round.state ->> 'startsAt')::timestamptz, v_round.created_at);
  if v_round.status <> 'open' then
    return jsonb_build_object(
      'crashed', coalesce((v_round.state ->> 'busted')::boolean, false),
      'crashPoint', v_crash_point,
      'settled', true
    );
  end if;

  v_elapsed_ms := greatest(0, floor(extract(epoch from (v_now - v_starts_at)) * 1000)::bigint);
  v_multiplier := public.gamble_crash_multiplier(v_starts_at, v_now);
  if v_multiplier >= v_crash_point then
    select public.gamble_settle_round(
      p_user_id,
      p_round_id,
      0,
      jsonb_build_object('busted', true)
    ) into v_settle;
    if v_settle ? 'error' then
      return v_settle;
    end if;
    return jsonb_build_object('crashed', true, 'crashPoint', v_crash_point, 'settled', true);
  end if;

  return jsonb_build_object('crashed', false, 'elapsedMs', v_elapsed_ms, 'settled', false);
end;
$$;

drop function if exists public.gamble_crash_cashout(uuid, uuid);

create or replace function public.gamble_crash_cashout(
  p_user_id uuid,
  p_round_id uuid,
  p_requested_multiplier numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round record;
  v_now timestamptz := clock_timestamp();
  v_starts_at timestamptz;
  v_crash_point numeric;
  v_actual_multiplier numeric;
  v_multiplier numeric;
  v_survived boolean;
  v_payout integer;
  v_settle jsonb;
begin
  select * into v_round
  from public.gamble_rounds
  where id = p_round_id and user_id = p_user_id and game = 'crash'
  for update;

  if v_round is null or not (v_round.state ? 'crashPoint') then
    return jsonb_build_object('error', 'round_not_found');
  end if;

  v_crash_point := (v_round.state ->> 'crashPoint')::numeric;
  v_starts_at := coalesce((v_round.state ->> 'startsAt')::timestamptz, v_round.created_at);
  if v_round.status <> 'open' then
    if coalesce((v_round.state ->> 'busted')::boolean, false) then
      return jsonb_build_object(
        'crashPoint', v_crash_point,
        'multiplier', v_crash_point,
        'payout', 0,
        'survived', false
      );
    end if;
    return jsonb_build_object('error', 'round_closed');
  end if;

  v_actual_multiplier := public.gamble_crash_multiplier(v_starts_at, v_now);
  -- Never let response latency increase the multiplier after the player has
  -- pressed cash out. The server still decides whether the request arrived
  -- before the crash; the client can only ask for less than the live value.
  v_multiplier := least(
    v_actual_multiplier,
    greatest(1::numeric, round(coalesce(p_requested_multiplier, v_actual_multiplier), 2))
  );
  v_survived := v_actual_multiplier < v_crash_point;
  v_payout := case when v_survived then floor(v_round.wager * v_multiplier)::integer else 0 end;
  select public.gamble_settle_round(
    p_user_id,
    p_round_id,
    v_payout,
    case
      when v_survived then jsonb_build_object('atCashout', v_multiplier, 'serverMultiplier', v_actual_multiplier, 'survived', true)
      else jsonb_build_object('atCashout', v_multiplier, 'serverMultiplier', v_actual_multiplier, 'survived', false, 'busted', true)
    end
  ) into v_settle;
  if v_settle ? 'error' then
    return v_settle;
  end if;

  return jsonb_build_object(
    'coins', (v_settle ->> 'coins')::integer,
    'crashPoint', v_crash_point,
    'multiplier', v_multiplier,
    'payout', v_payout,
    'survived', v_survived
  );
end;
$$;

revoke all on function public.gamble_day_key(timestamptz) from public, anon, authenticated;
revoke all on function public.gamble_play_round(uuid, text, integer, jsonb, integer, uuid) from public, anon, authenticated;
revoke all on function public.gamble_open_round(uuid, text, integer, jsonb, integer) from public, anon, authenticated;
revoke all on function public.gamble_settle_round(uuid, uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.gamble_double_round(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.gamble_patch_round(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.gamble_mines_multiplier(integer, integer) from public, anon, authenticated;
revoke all on function public.gamble_mines_pick(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.gamble_mines_cashout(uuid, uuid) from public, anon, authenticated;
revoke all on function public.gamble_crash_multiplier(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.gamble_crash_status(uuid, uuid) from public, anon, authenticated;
revoke all on function public.gamble_crash_cashout(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.gamble_day_key(timestamptz) to service_role;
grant execute on function public.gamble_play_round(uuid, text, integer, jsonb, integer, uuid) to service_role;
grant execute on function public.gamble_open_round(uuid, text, integer, jsonb, integer) to service_role;
grant execute on function public.gamble_settle_round(uuid, uuid, integer, jsonb) to service_role;
grant execute on function public.gamble_double_round(uuid, uuid, boolean) to service_role;
grant execute on function public.gamble_patch_round(uuid, uuid, jsonb) to service_role;
grant execute on function public.gamble_mines_pick(uuid, uuid, integer) to service_role;
grant execute on function public.gamble_mines_cashout(uuid, uuid) to service_role;
grant execute on function public.gamble_crash_status(uuid, uuid) to service_role;
grant execute on function public.gamble_crash_cashout(uuid, uuid, numeric) to service_role;
