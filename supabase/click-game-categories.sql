-- Category-specific Click Game progress. Run after supabase/click-game.sql.
-- Existing progress is preserved under the classic category; every other
-- category starts at stage 0 with its own active/progress/click counters.

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
declare v_profile record; v_row public.click_game_category_state; v_now timestamptz:=now(); v_requested integer:=greatest(1,least(p_clicks,100)); v_accepted integer; v_total integer; v_next integer;
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

create or replace function public.click_game_category_leaderboard(p_category_id text,p_limit integer default 20,p_viewer_id uuid default null) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_leaders jsonb; v_viewer jsonb; v_limit integer:=greatest(1,least(p_limit,100));
begin
  if p_category_id not in ('classic','censored','pixel','huge_breasts','huge_ass') then return jsonb_build_object('error','invalid_category'); end if;
  with ranked as (select user_id,weekly_clicks,row_number() over(order by weekly_clicks desc,user_id asc) rnk from public.click_game_category_state where category_id=p_category_id and weekly_clicks>0)
  select (select jsonb_agg(jsonb_build_object('rank',rnk,'userId',user_id,'weeklyClicks',weekly_clicks) order by rnk) from ranked where rnk<=v_limit),(select jsonb_build_object('rank',rnk,'userId',user_id,'weeklyClicks',weekly_clicks) from ranked where user_id=p_viewer_id order by rnk limit 1) into v_leaders,v_viewer;
  return jsonb_build_object('leaders',coalesce(v_leaders,'[]'::jsonb),'viewer',v_viewer,'winHistory','[]'::jsonb);
end; $$;

revoke all on function public.click_game_category_status(uuid,text,integer,integer,integer),public.click_game_category_start(uuid,text,integer,integer,integer),public.click_game_category_stop(uuid,text,integer,integer,integer),public.click_game_category_reset(uuid,text),public.click_game_category_click(uuid,text,integer,integer,integer,integer,integer),public.click_game_category_leaderboard(text,integer,uuid) from public,anon,authenticated;
grant execute on function public.click_game_category_status(uuid,text,integer,integer,integer),public.click_game_category_start(uuid,text,integer,integer,integer),public.click_game_category_stop(uuid,text,integer,integer,integer),public.click_game_category_reset(uuid,text),public.click_game_category_click(uuid,text,integer,integer,integer,integer,integer),public.click_game_category_leaderboard(text,integer,uuid) to service_role;
