-- Behavior-preserving database aggregates used by high-traffic Vercel routes.
-- Run after supabase/schema.sql and supabase/retention-maintenance.sql.

create index if not exists crate_opens_opened_at_idx
  on public.crate_opens(opened_at desc);

create index if not exists admin_pet_task_logs_transaction_ids_gin_idx
  on public.admin_pet_task_logs using gin(transaction_ids jsonb_path_ops);

create or replace function public.get_public_recent_tribute_transactions(p_limit integer default 10)
returns table (
  id uuid,
  user_id uuid,
  amount integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select tx.id, tx.user_id, tx.amount, tx.created_at
  from public.coin_transactions as tx
  where tx.reason in ('tribute', 'live_gift', 'throne_tribute', 'admin_grant', 'admin:/give')
    and tx.amount > 0
    and not exists (
      select 1
      from public.admin_pet_task_logs as log
      where log.status = 'reverted'
        and log.transaction_ids @> jsonb_build_array(tx.id::text)
    )
  order by tx.created_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

create or replace function public.get_community_status_aggregates(
  p_user_id uuid,
  p_day_start timestamptz,
  p_week_start timestamptz,
  p_month_start timestamptz,
  p_now timestamptz,
  p_goal_start timestamptz,
  p_goal_end timestamptz,
  p_goal_reasons text[]
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with support_rows as (
    select
      tx.user_id,
      tx.created_at,
      abs(tx.amount)::bigint as amount
    from public.coin_transactions as tx
    join public.profiles as profile on profile.id = tx.user_id
    where tx.created_at >= p_month_start
      and coalesce(profile.hide_from_leaderboard, false) = false
      and (
        tx.reason in ('throne_tribute', 'tribute:coin-offer', 'tribute:sacrifice', 'tribute:support')
        or (
          tx.reason = 'live_gift'
          and (
            tx.metadata ->> 'command' = 'give'
            or tx.metadata ->> 'kind' = 'manual_coin_purchase'
            or tx.metadata ->> 'source' = 'throne'
          )
        )
      )
  ),
  support_totals as (
    select
      support_rows.user_id,
      coalesce(sum(support_rows.amount) filter (where support_rows.created_at >= p_day_start), 0)::bigint as today,
      coalesce(sum(support_rows.amount) filter (where support_rows.created_at >= p_week_start), 0)::bigint as week,
      coalesce(sum(support_rows.amount), 0)::bigint as month
    from support_rows
    group by support_rows.user_id
  ),
  devotion_totals as (
    select
      event.user_id,
      coalesce(sum(event.amount) filter (where event.created_at >= p_day_start), 0)::bigint as today,
      coalesce(sum(event.amount), 0)::bigint as month
    from public.devotion_events as event
    join public.profiles as profile on profile.id = event.user_id
    where event.created_at >= p_month_start
      and coalesce(profile.hide_from_leaderboard, false) = false
    group by event.user_id
  ),
  goal_rows as (
    select
      tx.user_id,
      abs(tx.amount)::bigint as amount
    from public.coin_transactions as tx
    where tx.created_at >= p_goal_start
      and tx.created_at < p_goal_end
      -- Keep the database aggregate aligned with isCommunityGoalContribution.
      -- p_goal_reasons preserves explicitly configured and historical reasons,
      -- while the prefixes prevent newly-added spend/tribute routes from being
      -- omitted until this function is redeployed.
      and (
        tx.reason = any(p_goal_reasons)
        or tx.reason like 'spend:%'
        or tx.reason like 'tribute:%'
        or tx.reason = 'cosmetic:display_name_change'
        or tx.reason = 'throne_tribute'
      )
      and tx.amount <> 0
      and (
        (tx.amount < 0 and (
          tx.reason like 'spend:%'
          or tx.reason like 'tribute:%'
          or tx.reason in ('crate:open', 'cosmetic:display_name_change', 'jackpot_contribution', 'throne_tribute')
        ))
        or (tx.amount > 0 and tx.reason in ('tribute:support', 'tribute:sacrifice', 'tribute:coin-offer'))
      )
  )
  select jsonb_build_object(
    'supporterTodayUserId', (select user_id from support_totals order by today desc, user_id asc limit 1),
    'supporterTodayValue', coalesce((select today from support_totals order by today desc, user_id asc limit 1), 0),
    'supporterWeekUserId', (select user_id from support_totals order by week desc, user_id asc limit 1),
    'supporterWeekValue', coalesce((select week from support_totals order by week desc, user_id asc limit 1), 0),
    'supporterMonthUserId', (select user_id from support_totals order by month desc, user_id asc limit 1),
    'supporterMonthValue', coalesce((select month from support_totals order by month desc, user_id asc limit 1), 0),
    'devotionTodayUserId', (select user_id from devotion_totals order by today desc, user_id asc limit 1),
    'devotionTodayValue', coalesce((select today from devotion_totals order by today desc, user_id asc limit 1), 0),
    'devotionMonthUserId', (select user_id from devotion_totals order by month desc, user_id asc limit 1),
    'devotionMonthValue', coalesce((select month from devotion_totals order by month desc, user_id asc limit 1), 0),
    'longestStreakUserId', (
      select profile.id
      from public.profiles as profile
      where coalesce(profile.hide_from_leaderboard, false) = false
      order by coalesce(profile.loyalty_streak, 0) desc, profile.id asc
      limit 1
    ),
    'longestStreakValue', coalesce((
      select profile.loyalty_streak
      from public.profiles as profile
      where coalesce(profile.hide_from_leaderboard, false) = false
      order by coalesce(profile.loyalty_streak, 0) desc, profile.id asc
      limit 1
    ), 0),
    'goalProgressCoins', coalesce((select sum(amount) from goal_rows), 0),
    'goalParticipantCount', (select count(distinct user_id) from goal_rows where amount > 0),
    'currentUserContributionCoins', coalesce((select sum(amount) from goal_rows where user_id = p_user_id), 0),
    'currentUserParticipating', exists(select 1 from goal_rows where user_id = p_user_id and amount > 0)
  );
$$;

create or replace function public.grant_community_goal_rewards(
  p_goal_id text,
  p_badge_id text,
  p_crate_type text,
  p_free_opens integer,
  p_target_coins bigint,
  p_goal_start timestamptz,
  p_goal_end timestamptz,
  p_goal_reasons text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  badge_awards integer := 0;
  crate_awards integer := 0;
  progress_coins bigint := 0;
begin
  with goal_rows as (
    select tx.user_id, abs(tx.amount)::bigint as amount
    from public.coin_transactions tx
    where tx.created_at >= p_goal_start
      and tx.created_at < p_goal_end
      and (
        tx.reason = any(p_goal_reasons)
        or tx.reason like 'spend:%'
        or tx.reason like 'tribute:%'
        or tx.reason in ('cosmetic:display_name_change', 'throne_tribute')
      )
      and tx.amount <> 0
      and (
        (tx.amount < 0 and (
          tx.reason like 'spend:%'
          or tx.reason like 'tribute:%'
          or tx.reason in ('crate:open', 'cosmetic:display_name_change', 'jackpot_contribution', 'throne_tribute')
        ))
        or (tx.amount > 0 and tx.reason in ('tribute:support', 'tribute:sacrifice', 'tribute:coin-offer'))
      )
  )
  select coalesce(sum(amount), 0) into progress_coins from goal_rows;

  if progress_coins < p_target_coins then
    return jsonb_build_object('completed', false, 'progressCoins', progress_coins, 'badgeAwards', 0, 'crateAwards', 0);
  end if;

  with participants as (
    select distinct tx.user_id
    from public.coin_transactions tx
    where tx.created_at >= p_goal_start
      and tx.created_at < p_goal_end
      and (
        tx.reason = any(p_goal_reasons)
        or tx.reason like 'spend:%'
        or tx.reason like 'tribute:%'
        or tx.reason in ('cosmetic:display_name_change', 'throne_tribute')
      )
      and tx.amount <> 0
      and (
        (tx.amount < 0 and (
          tx.reason like 'spend:%'
          or tx.reason like 'tribute:%'
          or tx.reason in ('crate:open', 'cosmetic:display_name_change', 'jackpot_contribution', 'throne_tribute')
        ))
        or (tx.amount > 0 and tx.reason in ('tribute:support', 'tribute:sacrifice', 'tribute:coin-offer'))
      )
  ), inserted_badges as (
    insert into public.user_prestige_badges (user_id, badge_id, source, metadata)
    select user_id, p_badge_id, 'community_goal', jsonb_build_object('goalId', p_goal_id)
    from participants
    on conflict (user_id, badge_id) do nothing
    returning id
  )
  select count(*) into badge_awards from inserted_badges;

  if p_crate_type is not null and p_free_opens > 0 then
    with participants as (
      select distinct badge.user_id
      from public.user_prestige_badges badge
      where badge.badge_id = p_badge_id
        and badge.source = 'community_goal'
    ), inserted_grants as (
      insert into public.user_crate_open_grants (
        user_id, crate_type, goal_id, source, total_opens, remaining_opens
      )
      select user_id, p_crate_type, p_goal_id, 'community_goal', p_free_opens, p_free_opens
      from participants
      on conflict (user_id, goal_id, crate_type) do nothing
      returning id
    )
    select count(*) into crate_awards from inserted_grants;
  end if;

  return jsonb_build_object(
    'completed', true,
    'progressCoins', progress_coins,
    'badgeAwards', badge_awards,
    'crateAwards', crate_awards
  );
end;
$$;

create or replace function public.get_jackpot_contribution_summary(
  p_jackpot_id uuid,
  p_user_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'contributionTotal', coalesce(sum(contribution.amount), 0),
    'participantCount', count(distinct contribution.user_id),
    'userContributionTotal', coalesce(sum(contribution.amount) filter (where contribution.user_id = p_user_id), 0)
  )
  from public.loyalty_jackpot_contributions as contribution
  where contribution.jackpot_id = p_jackpot_id;
$$;

revoke all on function public.get_community_status_aggregates(uuid, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, text[]) from public, anon, authenticated;
revoke all on function public.grant_community_goal_rewards(text, text, text, integer, bigint, timestamptz, timestamptz, text[]) from public, anon, authenticated;
revoke all on function public.get_jackpot_contribution_summary(uuid, uuid) from public, anon, authenticated;
revoke all on function public.ensure_global_principessa_current_month() from public;
grant execute on function public.get_community_status_aggregates(uuid, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, text[]) to service_role;
grant execute on function public.grant_community_goal_rewards(text, text, text, integer, bigint, timestamptz, timestamptz, text[]) to service_role;
grant execute on function public.get_jackpot_contribution_summary(uuid, uuid) to service_role;
grant execute on function public.ensure_global_principessa_current_month() to anon, authenticated, service_role;
grant execute on function public.get_public_recent_tribute_transactions(integer) to anon, authenticated;
