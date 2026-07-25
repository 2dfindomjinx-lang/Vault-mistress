-- Click Game ("Milk the Wallet") - Shrine of Principessa addition.
-- Run once in the Supabase SQL editor. All write RPCs are security definer,
-- owned by a role only the service key can invoke, mirroring
-- supabase/runway-voting.sql.

create table if not exists public.click_game_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress integer not null default 0 check (progress >= 0),
  is_active boolean not null default false,
  last_click_at timestamptz,
  last_decay_settled_at timestamptz not null default now(),
  weekly_clicks bigint not null default 0 check (weekly_clicks >= 0),
  lifetime_clicks bigint not null default 0 check (lifetime_clicks >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.click_game_win_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  weekly_clicks bigint not null,
  title_newly_granted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);
create index if not exists idx_click_game_win_history_user on public.click_game_win_history (user_id, week_start desc);

-- Idempotency guard so a cron double-fire on the same calendar day can't
-- double-apply the daily decay (the win_history unique constraint already
-- covers the weekly job; this table closes the same gap for the daily one).
create table if not exists public.click_game_daily_decay_log (
  decay_date date primary key,
  applied_at timestamptz not null default now()
);

alter table public.click_game_state enable row level security;
alter table public.click_game_win_history enable row level security;
alter table public.click_game_daily_decay_log enable row level security;

-- No client select/insert/update policies anywhere: every read (including
-- the leaderboard) goes through service-role API routes, matching the
-- voting_avatars/avatar_votes posture.
revoke all on public.click_game_state from public, anon, authenticated;
revoke all on public.click_game_win_history from public, anon, authenticated;
revoke all on public.click_game_daily_decay_log from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Shared decay-settlement formula. Pure/no table I/O, so it's safe to call
-- from any of the definer functions below without its own elevated grants
-- mattering much - still locked down for consistency with the rest of this
-- file. last_click_at is "when did a real click last land" (drives the 5s
-- idle-grace check); last_settled_at is "how far has decay already been
-- consumed" (prevents double-counting the same elapsed window across
-- repeated calls). Collapsing the two into one column would make a lazy
-- status-read incorrectly reset the 5s grace clock.
create or replace function public.click_game_settle_decay(
  p_progress integer,
  p_is_active boolean,
  p_last_click_at timestamptz,
  p_last_settled_at timestamptz,
  p_now timestamptz,
  p_idle_grace_ms integer,
  p_decay_interval_ms integer,
  p_decay_per_tick integer
)
returns integer
language plpgsql
immutable
as $$
declare
  v_decay_start timestamptz;
  v_ticks bigint;
begin
  if not p_is_active or p_last_click_at is null then
    return greatest(0, p_progress);
  end if;

  v_decay_start := greatest(
    p_last_click_at + make_interval(secs => greatest(p_idle_grace_ms, 0) / 1000.0),
    p_last_settled_at
  );

  if p_now <= v_decay_start then
    return greatest(0, p_progress);
  end if;

  v_ticks := floor(extract(epoch from (p_now - v_decay_start)) * 1000 / greatest(p_decay_interval_ms, 1));

  return greatest(0, p_progress - (v_ticks * greatest(p_decay_per_tick, 0)));
end;
$$;

revoke all on function public.click_game_settle_decay(integer, boolean, timestamptz, timestamptz, timestamptz, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.click_game_settle_decay(integer, boolean, timestamptz, timestamptz, timestamptz, integer, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- click_game_start: upserts the row if missing, settles decay, then (if not
-- already active) flips is_active on and gives a fresh 5s idle-grace window.
create or replace function public.click_game_start(
  p_user_id uuid,
  p_idle_grace_ms integer default 5000,
  p_decay_interval_ms integer default 250,
  p_decay_per_tick integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.click_game_state;
  v_now timestamptz := now();
begin
  insert into public.click_game_state (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_row from public.click_game_state where user_id = p_user_id for update;

  v_row.progress := public.click_game_settle_decay(
    v_row.progress, v_row.is_active, v_row.last_click_at, v_row.last_decay_settled_at,
    v_now, p_idle_grace_ms, p_decay_interval_ms, p_decay_per_tick
  );

  if not v_row.is_active then
    update public.click_game_state
    set progress = v_row.progress,
        is_active = true,
        last_click_at = v_now,
        last_decay_settled_at = v_now,
        updated_at = v_now
    where user_id = p_user_id
    returning * into v_row;
  else
    update public.click_game_state
    set progress = v_row.progress, last_decay_settled_at = v_now, updated_at = v_now
    where user_id = p_user_id
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'progress', v_row.progress, 'isActive', v_row.is_active, 'lastClickAt', v_row.last_click_at,
    'weeklyClicks', v_row.weekly_clicks, 'lifetimeClicks', v_row.lifetime_clicks, 'serverNowIso', v_now
  );
end;
$$;

revoke all on function public.click_game_start(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.click_game_start(uuid, integer, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- click_game_stop: final settle, then freezes progress by flipping is_active
-- off (the settle formula always short-circuits on `not is_active`, so
-- progress simply sits frozen from here on regardless of elapsed time).
create or replace function public.click_game_stop(
  p_user_id uuid,
  p_idle_grace_ms integer default 5000,
  p_decay_interval_ms integer default 250,
  p_decay_per_tick integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.click_game_state;
  v_now timestamptz := now();
begin
  insert into public.click_game_state (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_row from public.click_game_state where user_id = p_user_id for update;

  v_row.progress := public.click_game_settle_decay(
    v_row.progress, v_row.is_active, v_row.last_click_at, v_row.last_decay_settled_at,
    v_now, p_idle_grace_ms, p_decay_interval_ms, p_decay_per_tick
  );

  update public.click_game_state
  set progress = v_row.progress, is_active = false, last_decay_settled_at = v_now, updated_at = v_now
  where user_id = p_user_id
  returning * into v_row;

  return jsonb_build_object(
    'progress', v_row.progress, 'isActive', v_row.is_active, 'lastClickAt', v_row.last_click_at,
    'weeklyClicks', v_row.weekly_clicks, 'lifetimeClicks', v_row.lifetime_clicks, 'serverNowIso', v_now
  );
end;
$$;

revoke all on function public.click_game_stop(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.click_game_stop(uuid, integer, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- click_game_reset: zeroes the visual climb only. weekly_clicks/lifetime_clicks
-- and is_active are untouched - the whole point is letting someone replay the
-- 10-stage climb repeatedly within a week for a higher weekly_clicks total.
create or replace function public.click_game_reset(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.click_game_state;
  v_now timestamptz := now();
begin
  insert into public.click_game_state (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.click_game_state
  set progress = 0, last_click_at = null, last_decay_settled_at = v_now, updated_at = v_now
  where user_id = p_user_id
  returning * into v_row;

  return jsonb_build_object(
    'progress', v_row.progress, 'isActive', v_row.is_active, 'lastClickAt', v_row.last_click_at,
    'weeklyClicks', v_row.weekly_clicks, 'lifetimeClicks', v_row.lifetime_clicks, 'serverNowIso', v_now
  );
end;
$$;

revoke all on function public.click_game_reset(uuid) from public, anon, authenticated;
grant execute on function public.click_game_reset(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- click_game_click: the atomic money+progress step. Lock order profiles ->
-- click_game_state, matching the documented "acting user's profile first"
-- convention. Settles decay BEFORE adding the click (so the click "catches"
-- the drain at its currently-decayed value, then adds 1 on top - matches the
-- spec's "progress starts draining... continuing until they click again").
create or replace function public.click_game_click(
  p_user_id uuid,
  p_cost integer,
  p_idle_grace_ms integer default 5000,
  p_decay_interval_ms integer default 250,
  p_decay_per_tick integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_cost integer := greatest(1, least(coalesce(p_cost, 0), 10000));
  v_profile record;
  v_row public.click_game_state;
  v_now timestamptz := now();
  v_next_coins integer;
begin
  select id, coins into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  insert into public.click_game_state (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_row from public.click_game_state where user_id = p_user_id for update;

  if not v_row.is_active then
    return jsonb_build_object('error', 'not_active');
  end if;

  if v_profile.coins < v_cost then
    return jsonb_build_object('error', 'insufficient_coins');
  end if;

  v_row.progress := public.click_game_settle_decay(
    v_row.progress, v_row.is_active, v_row.last_click_at, v_row.last_decay_settled_at,
    v_now, p_idle_grace_ms, p_decay_interval_ms, p_decay_per_tick
  );

  v_next_coins := v_profile.coins - v_cost;

  update public.profiles set coins = v_next_coins, updated_at = v_now where id = p_user_id;

  insert into public.coin_transactions (user_id, amount, balance_before, balance_after, reason, metadata)
  values (
    p_user_id, -v_cost, v_profile.coins, v_next_coins, 'click_game:click',
    jsonb_build_object('progressAfter', v_row.progress + 1, 'spendAmount', v_cost)
  );

  update public.click_game_state
  set progress = v_row.progress + 1,
      last_click_at = v_now,
      last_decay_settled_at = v_now,
      weekly_clicks = weekly_clicks + 1,
      lifetime_clicks = lifetime_clicks + 1,
      updated_at = v_now
  where user_id = p_user_id
  returning * into v_row;

  return jsonb_build_object(
    'progress', v_row.progress, 'isActive', v_row.is_active, 'lastClickAt', v_row.last_click_at,
    'weeklyClicks', v_row.weekly_clicks, 'lifetimeClicks', v_row.lifetime_clicks,
    'coins', v_next_coins, 'serverNowIso', v_now
  );
end;
$$;

revoke all on function public.click_game_click(uuid, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.click_game_click(uuid, integer, integer, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- click_game_status: lazy read that also settles+persists pending decay, so
-- progress is always correct whenever anyone asks, without a live server
-- ticker. Never touches is_active/last_click_at.
create or replace function public.click_game_status(
  p_user_id uuid,
  p_idle_grace_ms integer default 5000,
  p_decay_interval_ms integer default 250,
  p_decay_per_tick integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.click_game_state;
  v_now timestamptz := now();
begin
  insert into public.click_game_state (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_row from public.click_game_state where user_id = p_user_id for update;

  v_row.progress := public.click_game_settle_decay(
    v_row.progress, v_row.is_active, v_row.last_click_at, v_row.last_decay_settled_at,
    v_now, p_idle_grace_ms, p_decay_interval_ms, p_decay_per_tick
  );

  update public.click_game_state
  set progress = v_row.progress, last_decay_settled_at = v_now, updated_at = v_now
  where user_id = p_user_id
  returning * into v_row;

  return jsonb_build_object(
    'progress', v_row.progress, 'isActive', v_row.is_active, 'lastClickAt', v_row.last_click_at,
    'weeklyClicks', v_row.weekly_clicks, 'lifetimeClicks', v_row.lifetime_clicks, 'serverNowIso', v_now
  );
end;
$$;

revoke all on function public.click_game_status(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.click_game_status(uuid, integer, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- click_game_leaderboard: one round trip returns the current week's top list
-- + the viewer's own row (row_type 'top'/'viewer', mirroring
-- get_devotion_leaderboard/get_runway_leaderboard), plus the all-time
-- win-history table grouped per user.
create or replace function public.click_game_leaderboard(
  p_limit integer default 20,
  p_viewer_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
  v_leaders jsonb;
  v_viewer jsonb;
  v_win_history jsonb;
begin
  with ranked as (
    select user_id, weekly_clicks,
      row_number() over (order by weekly_clicks desc, user_id asc) as rnk
    from public.click_game_state
    where weekly_clicks > 0
  )
  select
    (select jsonb_agg(jsonb_build_object('rank', rnk, 'userId', user_id, 'weeklyClicks', weekly_clicks) order by rnk)
      from ranked where rnk <= v_limit),
    (select jsonb_build_object('rank', rnk, 'userId', user_id, 'weeklyClicks', weekly_clicks)
      from ranked where p_viewer_id is not null and user_id = p_viewer_id
      order by rnk limit 1)
  into v_leaders, v_viewer;

  select jsonb_agg(jsonb_build_object(
    'userId', user_id, 'winCount', win_count, 'lastWonWeekStart', last_won
  ) order by win_count desc, last_won desc)
  into v_win_history
  from (
    select user_id, count(*) as win_count, max(week_start) as last_won
    from public.click_game_win_history
    group by user_id
    order by count(*) desc, max(week_start) desc
    limit 20
  ) w;

  return jsonb_build_object(
    'leaders', coalesce(v_leaders, '[]'::jsonb),
    'viewer', v_viewer,
    'winHistory', coalesce(v_win_history, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.click_game_leaderboard(integer, uuid) from public, anon, authenticated;
grant execute on function public.click_game_leaderboard(integer, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Daily cron: flat reduction for every user regardless of activity, guarded
-- against a same-day double-fire. Advancing last_decay_settled_at here keeps
-- this mechanism additive with (rather than double-counting against) the
-- idle-drain mechanism in a later settle.
create or replace function public.run_click_game_daily_decay(p_reduction integer, p_decay_date date)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_reduction integer := greatest(0, least(coalesce(p_reduction, 0), 100000));
  v_updated integer;
begin
  begin
    insert into public.click_game_daily_decay_log (decay_date) values (p_decay_date);
  exception when unique_violation then
    return jsonb_build_object('skipped', true, 'reason', 'already_applied_today');
  end;

  update public.click_game_state
  set progress = greatest(0, progress - v_reduction), last_decay_settled_at = now(), updated_at = now()
  where progress > 0;
  get diagnostics v_updated = row_count;

  return jsonb_build_object('usersReduced', v_updated, 'reduction', v_reduction);
end;
$$;

revoke all on function public.run_click_game_daily_decay(integer, date) from public, anon, authenticated;
grant execute on function public.run_click_game_daily_decay(integer, date) to service_role;

-- ---------------------------------------------------------------------------
-- Weekly cron: records the week's #1 by weekly_clicks (if anyone played),
-- grants the champion title only the first time that user ever wins, then
-- resets everyone's weekly_clicks for the new week. Idempotent against a
-- same-week double-fire via the (user_id, week_start) unique constraint.
create or replace function public.run_click_game_weekly_reset(p_week_start date, p_title_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_winner record;
  v_already_won boolean;
  v_title_newly_granted boolean := false;
begin
  select user_id, weekly_clicks into v_winner
  from public.click_game_state
  where weekly_clicks > 0
  order by weekly_clicks desc, user_id asc
  limit 1
  for update;

  if found then
    select exists(
      select 1 from public.user_titles where user_id = v_winner.user_id and title_id = p_title_id
    ) into v_already_won;

    v_title_newly_granted := not v_already_won;

    if v_title_newly_granted then
      insert into public.user_titles (user_id, title_id, source, equipped)
      values (v_winner.user_id, p_title_id, 'click_game', false)
      on conflict (user_id, title_id) do nothing;
    end if;

    insert into public.click_game_win_history (user_id, week_start, weekly_clicks, title_newly_granted)
    values (v_winner.user_id, p_week_start, v_winner.weekly_clicks, v_title_newly_granted)
    on conflict (user_id, week_start) do nothing;
  end if;

  update public.click_game_state set weekly_clicks = 0, updated_at = now() where weekly_clicks > 0;

  return jsonb_build_object(
    'winnerUserId', case when found then v_winner.user_id else null end,
    'weeklyClicks', case when found then v_winner.weekly_clicks else 0 end,
    'titleNewlyGranted', v_title_newly_granted
  );
end;
$$;

revoke all on function public.run_click_game_weekly_reset(date, text) from public, anon, authenticated;
grant execute on function public.run_click_game_weekly_reset(date, text) to service_role;
