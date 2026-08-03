-- Category-specific Click Game progress. Run after supabase/click-game.sql.
-- Existing progress is preserved under the classic category; every other
-- category starts at stage 0 with its own active/progress/click counters.

-- Keep the original helper signature for compatibility, but disable decay:
-- progress must not depend on when a batched request reaches the API.
create or replace function public.click_game_settle_decay(
  p_progress integer, p_is_active boolean, p_last_click_at timestamptz,
  p_last_settled_at timestamptz, p_now timestamptz, p_idle_grace_ms integer,
  p_decay_interval_ms integer, p_decay_per_tick integer
) returns integer language plpgsql immutable as $$
begin
  return greatest(0, p_progress);
end;
$$;

create table if not exists public.click_game_category_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null check (category_id in ('classic', 'censored', 'pixel', 'huge_breasts', 'huge_ass')),
  progress integer not null default 0 check (progress >= 0),
  is_active boolean not null default false,
  last_click_at timestamptz,
  last_decay_settled_at timestamptz not null default now(),
  weekly_clicks bigint not null default 0 check (weekly_clicks >= 0),
  lifetime_clicks bigint not null default 0 check (lifetime_clicks >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, category_id)
);

insert into public.click_game_category_state
  (user_id, category_id, progress, is_active, last_click_at, last_decay_settled_at, weekly_clicks, lifetime_clicks, updated_at)
select user_id, 'classic', progress, is_active, last_click_at, last_decay_settled_at, weekly_clicks, lifetime_clicks, updated_at
from public.click_game_state
on conflict (user_id, category_id) do nothing;

alter table public.click_game_category_state enable row level security;
revoke all on public.click_game_category_state from public, anon, authenticated;

create or replace function public.click_game_category_status(
  p_user_id uuid, p_category_id text, p_idle_grace_ms integer default 5000,
  p_decay_interval_ms integer default 250, p_decay_per_tick integer default 1
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_row public.click_game_category_state; v_now timestamptz := now();
begin
  if p_category_id not in ('classic', 'censored', 'pixel', 'huge_breasts', 'huge_ass') then return jsonb_build_object('error','invalid_category'); end if;
  insert into public.click_game_category_state (user_id, category_id) values (p_user_id, p_category_id) on conflict do nothing;
  select * into v_row from public.click_game_category_state where user_id=p_user_id and category_id=p_category_id for update;
  v_row.progress := public.click_game_settle_decay(v_row.progress,v_row.is_active,v_row.last_click_at,v_row.last_decay_settled_at,v_now,p_idle_grace_ms,p_decay_interval_ms,p_decay_per_tick);
  update public.click_game_category_state set progress=v_row.progress,last_decay_settled_at=v_now,updated_at=v_now where user_id=p_user_id and category_id=p_category_id returning * into v_row;
  return jsonb_build_object('progress',v_row.progress,'isActive',v_row.is_active,'lastClickAt',v_row.last_click_at,'weeklyClicks',v_row.weekly_clicks,'lifetimeClicks',v_row.lifetime_clicks,'serverNowIso',v_now);
end; $$;

create or replace function public.click_game_category_start(p_user_id uuid,p_category_id text,p_idle_grace_ms integer default 5000,p_decay_interval_ms integer default 250,p_decay_per_tick integer default 1) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_row public.click_game_category_state; v_now timestamptz:=now();
begin
  if p_category_id not in ('classic','censored','pixel','huge_breasts','huge_ass') then return jsonb_build_object('error','invalid_category'); end if;
  insert into public.click_game_category_state(user_id,category_id) values(p_user_id,p_category_id) on conflict do nothing;
  select * into v_row from public.click_game_category_state where user_id=p_user_id and category_id=p_category_id for update;
  v_row.progress:=public.click_game_settle_decay(v_row.progress,v_row.is_active,v_row.last_click_at,v_row.last_decay_settled_at,v_now,p_idle_grace_ms,p_decay_interval_ms,p_decay_per_tick);
  update public.click_game_category_state set progress=v_row.progress,is_active=true,last_click_at=v_now,last_decay_settled_at=v_now,updated_at=v_now where user_id=p_user_id and category_id=p_category_id returning * into v_row;
  return jsonb_build_object('progress',v_row.progress,'isActive',v_row.is_active,'lastClickAt',v_row.last_click_at,'weeklyClicks',v_row.weekly_clicks,'lifetimeClicks',v_row.lifetime_clicks,'serverNowIso',v_now);
end; $$;

create or replace function public.click_game_category_stop(p_user_id uuid,p_category_id text,p_idle_grace_ms integer default 5000,p_decay_interval_ms integer default 250,p_decay_per_tick integer default 1) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_row public.click_game_category_state; v_now timestamptz:=now();
begin
  if p_category_id not in ('classic','censored','pixel','huge_breasts','huge_ass') then return jsonb_build_object('error','invalid_category'); end if;
  insert into public.click_game_category_state(user_id,category_id) values(p_user_id,p_category_id) on conflict do nothing;
  select * into v_row from public.click_game_category_state where user_id=p_user_id and category_id=p_category_id for update;
  v_row.progress:=public.click_game_settle_decay(v_row.progress,v_row.is_active,v_row.last_click_at,v_row.last_decay_settled_at,v_now,p_idle_grace_ms,p_decay_interval_ms,p_decay_per_tick);
  update public.click_game_category_state set progress=v_row.progress,is_active=false,last_decay_settled_at=v_now,updated_at=v_now where user_id=p_user_id and category_id=p_category_id returning * into v_row;
  return jsonb_build_object('progress',v_row.progress,'isActive',v_row.is_active,'lastClickAt',v_row.last_click_at,'weeklyClicks',v_row.weekly_clicks,'lifetimeClicks',v_row.lifetime_clicks,'serverNowIso',v_now);
end; $$;

create or replace function public.click_game_category_reset(p_user_id uuid,p_category_id text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_row public.click_game_category_state; v_now timestamptz:=now();
begin
  if p_category_id not in ('classic','censored','pixel','huge_breasts','huge_ass') then return jsonb_build_object('error','invalid_category'); end if;
  insert into public.click_game_category_state(user_id,category_id) values(p_user_id,p_category_id) on conflict do nothing;
  update public.click_game_category_state set progress=0,last_click_at=null,last_decay_settled_at=v_now,updated_at=v_now where user_id=p_user_id and category_id=p_category_id returning * into v_row;
  return jsonb_build_object('progress',v_row.progress,'isActive',v_row.is_active,'lastClickAt',v_row.last_click_at,'weeklyClicks',v_row.weekly_clicks,'lifetimeClicks',v_row.lifetime_clicks,'serverNowIso',v_now);
end; $$;

create or replace function public.click_game_category_click(p_user_id uuid,p_category_id text,p_cost integer,p_clicks integer default 1,p_idle_grace_ms integer default 5000,p_decay_interval_ms integer default 250,p_decay_per_tick integer default 1) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_profile record; v_row public.click_game_category_state; v_now timestamptz:=now(); v_requested integer:=greatest(1,least(p_clicks,300)); v_accepted integer; v_total integer; v_next integer;
begin
  if p_category_id not in ('classic','censored','pixel','huge_breasts','huge_ass') then return jsonb_build_object('error','invalid_category'); end if;
  select id,coins into v_profile from public.profiles where id=p_user_id for update;
  if not found then return jsonb_build_object('error','profile_not_found'); end if;
  insert into public.click_game_category_state(user_id,category_id) values(p_user_id,p_category_id) on conflict do nothing;
  select * into v_row from public.click_game_category_state where user_id=p_user_id and category_id=p_category_id for update;
  if not v_row.is_active then return jsonb_build_object('error','not_active'); end if;
  v_accepted:=least(v_requested,floor(v_profile.coins::numeric/greatest(p_cost,1))::integer);
  if v_accepted<=0 then return jsonb_build_object('error','insufficient_coins'); end if;
  v_row.progress:=public.click_game_settle_decay(v_row.progress,v_row.is_active,v_row.last_click_at,v_row.last_decay_settled_at,v_now,p_idle_grace_ms,p_decay_interval_ms,p_decay_per_tick);
  v_total:=v_accepted*p_cost; v_next:=v_profile.coins-v_total;
  update public.profiles set coins=v_next,updated_at=v_now where id=p_user_id;
  insert into public.coin_transactions(user_id,amount,balance_before,balance_after,reason,metadata) values(p_user_id,-v_total,v_profile.coins,v_next,'click_game:click',jsonb_build_object('categoryId',p_category_id,'clicks',v_accepted));
  update public.click_game_category_state set progress=v_row.progress+v_accepted,last_click_at=v_now,last_decay_settled_at=v_now,weekly_clicks=weekly_clicks+v_accepted,lifetime_clicks=lifetime_clicks+v_accepted,updated_at=v_now where user_id=p_user_id and category_id=p_category_id returning * into v_row;
  return jsonb_build_object('progress',v_row.progress,'isActive',v_row.is_active,'lastClickAt',v_row.last_click_at,'weeklyClicks',v_row.weekly_clicks,'lifetimeClicks',v_row.lifetime_clicks,'coins',v_next,'serverNowIso',v_now,'acceptedClicks',v_accepted,'requestedClicks',v_requested);
end; $$;

-- Admin accounts are excluded from the ranked list entirely (same posture as
-- every other leaderboard in this project - shrine top worshippers,
-- jackpot, pet-score, devotion). If the viewer themself is an admin, their
-- own row is omitted too, not just hidden from other players.
create or replace function public.click_game_category_leaderboard(p_category_id text,p_limit integer default 20,p_viewer_id uuid default null) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_leaders jsonb; v_viewer jsonb; v_limit integer:=greatest(1,least(p_limit,100));
begin
  if p_category_id not in ('classic','censored','pixel','huge_breasts','huge_ass') then return jsonb_build_object('error','invalid_category'); end if;
  with ranked as (
    select s.user_id, s.weekly_clicks, row_number() over (order by s.weekly_clicks desc, s.user_id asc) rnk
    from public.click_game_category_state s
    join public.profiles p on p.id = s.user_id
    where s.category_id = p_category_id and s.weekly_clicks > 0 and not coalesce(p.is_admin, false)
  )
  select
    (select jsonb_agg(jsonb_build_object('rank',rnk,'userId',user_id,'weeklyClicks',weekly_clicks) order by rnk) from ranked where rnk<=v_limit),
    (select jsonb_build_object('rank',rnk,'userId',user_id,'weeklyClicks',weekly_clicks) from ranked where user_id=p_viewer_id order by rnk limit 1)
  into v_leaders,v_viewer;
  return jsonb_build_object('leaders',coalesce(v_leaders,'[]'::jsonb),'viewer',v_viewer,'winHistory','[]'::jsonb);
end; $$;

revoke all on function public.click_game_category_status(uuid,text,integer,integer,integer),public.click_game_category_start(uuid,text,integer,integer,integer),public.click_game_category_stop(uuid,text,integer,integer,integer),public.click_game_category_reset(uuid,text),public.click_game_category_click(uuid,text,integer,integer,integer,integer,integer),public.click_game_category_leaderboard(text,integer,uuid) from public,anon,authenticated;
grant execute on function public.click_game_category_status(uuid,text,integer,integer,integer),public.click_game_category_start(uuid,text,integer,integer,integer),public.click_game_category_stop(uuid,text,integer,integer,integer),public.click_game_category_reset(uuid,text),public.click_game_category_click(uuid,text,integer,integer,integer,integer,integer),public.click_game_category_leaderboard(text,integer,uuid) to service_role;

-- Single combined leaderboard: a user's clicks across ALL 5 categories are
-- summed into one weekly_clicks total and ranked together, instead of each
-- category having its own separate ranking. Admin accounts excluded, same
-- posture as click_game_category_leaderboard above.
create or replace function public.click_game_combined_leaderboard(p_limit integer default 20, p_viewer_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_leaders jsonb; v_viewer jsonb; v_limit integer := greatest(1, least(p_limit, 100));
begin
  with totals as (
    select s.user_id, sum(s.weekly_clicks) as weekly_clicks
    from public.click_game_category_state s
    join public.profiles p on p.id = s.user_id
    where not coalesce(p.is_admin, false)
    group by s.user_id
    having sum(s.weekly_clicks) > 0
  ), ranked as (
    select user_id, weekly_clicks, row_number() over (order by weekly_clicks desc, user_id asc) rnk
    from totals
  )
  select
    (select jsonb_agg(jsonb_build_object('rank',rnk,'userId',user_id,'weeklyClicks',weekly_clicks) order by rnk) from ranked where rnk<=v_limit),
    (select jsonb_build_object('rank',rnk,'userId',user_id,'weeklyClicks',weekly_clicks) from ranked where user_id=p_viewer_id order by rnk limit 1)
  into v_leaders, v_viewer;
  return jsonb_build_object('leaders', coalesce(v_leaders,'[]'::jsonb), 'viewer', v_viewer, 'winHistory', '[]'::jsonb);
end; $$;

revoke all on function public.click_game_combined_leaderboard(integer, uuid) from public, anon, authenticated;
grant execute on function public.click_game_combined_leaderboard(integer, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- run_click_game_category_weekly_reset: replaces run_click_game_weekly_reset
-- (supabase/click-game.sql), which still operates on the old, no-longer-
-- written-to click_game_state table - so it never found a winner and never
-- reset the real (per-category) weekly_clicks. This version sums weekly_clicks
-- across all 5 categories per user (same aggregation as
-- click_game_combined_leaderboard), excludes admins, grants the champion
-- title only the first time a user wins, and resets weekly_clicks to 0 across
-- every category row. Idempotent against a same-week double-fire via the
-- (user_id, week_start) unique constraint on click_game_win_history.
create or replace function public.run_click_game_category_weekly_reset(p_week_start date, p_title_id text)
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
  from (
    select s.user_id, sum(s.weekly_clicks) as weekly_clicks
    from public.click_game_category_state s
    join public.profiles p on p.id = s.user_id
    where not coalesce(p.is_admin, false)
    group by s.user_id
    having sum(s.weekly_clicks) > 0
  ) totals
  order by weekly_clicks desc, user_id asc
  limit 1;

  if found then
    perform 1 from public.click_game_category_state where user_id = v_winner.user_id for update;

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

  update public.click_game_category_state set weekly_clicks = 0, updated_at = now() where weekly_clicks > 0;

  return jsonb_build_object(
    'winnerUserId', case when found then v_winner.user_id else null end,
    'weeklyClicks', case when found then v_winner.weekly_clicks else 0 end,
    'titleNewlyGranted', v_title_newly_granted
  );
end;
$$;

revoke all on function public.run_click_game_category_weekly_reset(date, text) from public, anon, authenticated;
grant execute on function public.run_click_game_category_weekly_reset(date, text) to service_role;

-- ---------------------------------------------------------------------------
-- run_click_game_category_daily_decay: replaces run_click_game_daily_decay
-- (supabase/click-game.sql) for the same reason - that one only touches the
-- old click_game_state table. This applies the daily flat reduction across
-- every category row, guarded against a same-day double-fire the same way.
create or replace function public.run_click_game_category_daily_decay(p_reduction integer, p_decay_date date)
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

  update public.click_game_category_state
  set progress = greatest(0, progress - v_reduction), last_decay_settled_at = now(), updated_at = now()
  where progress > 0;
  get diagnostics v_updated = row_count;

  return jsonb_build_object('usersReduced', v_updated, 'reduction', v_reduction);
end;
$$;

revoke all on function public.run_click_game_category_daily_decay(integer, date) from public, anon, authenticated;
grant execute on function public.run_click_game_category_daily_decay(integer, date) to service_role;
