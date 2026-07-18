-- Allows a community goal to grant crates without creating a prestige badge.
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
  with raw_goal_rows as (
    select tx.user_id, coalesce(profile.is_admin, false) as is_admin, abs(tx.amount)::bigint as amount
    from public.coin_transactions tx join public.profiles profile on profile.id = tx.user_id
    where tx.created_at >= p_goal_start and tx.created_at < p_goal_end
      and (tx.reason = any(p_goal_reasons) or tx.reason like 'spend:%' or tx.reason like 'tribute:%' or tx.reason in ('cosmetic:display_name_change', 'throne_tribute'))
      and tx.amount <> 0
      and ((tx.amount < 0 and (tx.reason like 'spend:%' or tx.reason like 'tribute:%' or tx.reason in ('crate:open', 'cosmetic:display_name_change', 'jackpot_contribution', 'throne_tribute')))
        or (tx.amount > 0 and tx.reason in ('tribute:support', 'tribute:sacrifice', 'tribute:coin-offer')))
  ), goal_rows as (
    select user_id, is_admin, case when is_admin then floor(sum(amount) * 0.20)::bigint else sum(amount)::bigint end as amount
    from raw_goal_rows group by user_id, is_admin
  ) select coalesce(sum(amount), 0) into progress_coins from goal_rows;

  if progress_coins < p_target_coins then
    return jsonb_build_object('completed', false, 'progressCoins', progress_coins, 'badgeAwards', 0, 'crateAwards', 0);
  end if;

  if p_badge_id is not null then
    with raw_goal_rows as (
      select tx.user_id, coalesce(profile.is_admin, false) as is_admin, abs(tx.amount)::bigint as amount
      from public.coin_transactions tx join public.profiles profile on profile.id = tx.user_id
      where tx.created_at >= p_goal_start and tx.created_at < p_goal_end
        and (tx.reason = any(p_goal_reasons) or tx.reason like 'spend:%' or tx.reason like 'tribute:%' or tx.reason in ('cosmetic:display_name_change', 'throne_tribute'))
        and tx.amount <> 0
        and ((tx.amount < 0 and (tx.reason like 'spend:%' or tx.reason like 'tribute:%' or tx.reason in ('crate:open', 'cosmetic:display_name_change', 'jackpot_contribution', 'throne_tribute')))
          or (tx.amount > 0 and tx.reason in ('tribute:support', 'tribute:sacrifice', 'tribute:coin-offer')))
    ), participants as (
      select user_id from raw_goal_rows group by user_id, is_admin having is_admin = false and sum(amount) > 0
    ), inserted_badges as (
      insert into public.user_prestige_badges (user_id, badge_id, source, metadata)
      select user_id, p_badge_id, 'community_goal', jsonb_build_object('goalId', p_goal_id) from participants
      on conflict (user_id, badge_id) do nothing returning id
    ) select count(*) into badge_awards from inserted_badges;
  end if;

  if p_crate_type is not null and p_free_opens > 0 then
    with raw_goal_rows as (
      select tx.user_id, coalesce(profile.is_admin, false) as is_admin, abs(tx.amount)::bigint as amount
      from public.coin_transactions tx join public.profiles profile on profile.id = tx.user_id
      where tx.created_at >= p_goal_start and tx.created_at < p_goal_end
        and (tx.reason = any(p_goal_reasons) or tx.reason like 'spend:%' or tx.reason like 'tribute:%' or tx.reason in ('cosmetic:display_name_change', 'throne_tribute'))
        and tx.amount <> 0
        and ((tx.amount < 0 and (tx.reason like 'spend:%' or tx.reason like 'tribute:%' or tx.reason in ('crate:open', 'cosmetic:display_name_change', 'jackpot_contribution', 'throne_tribute')))
          or (tx.amount > 0 and tx.reason in ('tribute:support', 'tribute:sacrifice', 'tribute:coin-offer')))
    ), participants as (
      select user_id from raw_goal_rows group by user_id, is_admin having is_admin = false and sum(amount) > 0
    ), inserted_grants as (
      insert into public.user_crate_open_grants (user_id, crate_type, goal_id, source, total_opens, remaining_opens)
      select user_id, p_crate_type, p_goal_id, 'community_goal', p_free_opens, p_free_opens from participants
      on conflict (user_id, goal_id, crate_type) do nothing returning id
    ) select count(*) into crate_awards from inserted_grants;
  end if;

  return jsonb_build_object('completed', true, 'progressCoins', progress_coins, 'badgeAwards', badge_awards, 'crateAwards', crate_awards);
end;
$$;

revoke all on function public.grant_community_goal_rewards(text, text, text, integer, bigint, timestamptz, timestamptz, text[]) from public, anon, authenticated;
grant execute on function public.grant_community_goal_rewards(text, text, text, integer, bigint, timestamptz, timestamptz, text[]) to service_role;
