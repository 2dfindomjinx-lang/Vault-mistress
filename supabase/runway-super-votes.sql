-- Runway Super Vote (2026-07)
-- Run this after supabase/runway-voting.sql. A Super Vote costs the voter
-- 2,500 coins, gives the non-admin avatar owner 1,000 coins, and adds ten
-- leaderboard points. All of it happens in one idempotent RPC transaction.

alter table public.voting_avatars
  add column if not exists super_vote_count integer not null default 0
  check (super_vote_count >= 0);

create table if not exists public.runway_super_votes (
  id uuid primary key default gen_random_uuid(),
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  avatar_id uuid not null references public.voting_avatars(id) on delete cascade,
  coin_cost integer not null default 2500 check (coin_cost = 2500),
  owner_coin_reward integer not null default 1000 check (owner_coin_reward = 1000),
  points_awarded integer not null default 10 check (points_awarded = 10),
  created_at timestamptz not null default now()
);

create index if not exists idx_runway_super_votes_voter_created
  on public.runway_super_votes (voter_user_id, created_at desc);
create index if not exists idx_runway_super_votes_avatar
  on public.runway_super_votes (avatar_id, created_at desc);

alter table public.runway_super_votes enable row level security;

-- Super Vote reuses candidate tokens and the action receipt table.
alter table public.runway_candidate_tokens
  drop constraint if exists runway_candidate_tokens_consumed_as_check;
alter table public.runway_candidate_tokens
  add constraint runway_candidate_tokens_consumed_as_check
  check (consumed_as is null or consumed_as in ('vote', 'skip', 'super_vote'));

alter table public.runway_action_receipts
  drop constraint if exists runway_action_receipts_action_type_check;
alter table public.runway_action_receipts
  add constraint runway_action_receipts_action_type_check
  check (action_type in ('vote', 'skip', 'submit', 'super_vote'));

create or replace function public.cast_runway_super_vote(
  p_voter_id uuid,
  p_avatar_id uuid,
  p_token_id uuid,
  p_idempotency_key text,
  p_today_key date
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_request_hash text;
  v_existing_hash text;
  v_existing_status text;
  v_existing_response jsonb;
  v_result jsonb;
  v_token record;
  v_avatar record;
  v_profile record;
  v_voter_coins integer;
  v_owner_coins integer;
  v_day_start timestamptz;
  v_next_day_start timestamptz;
  v_used_today integer;
  v_cost constant integer := 2500;
  v_owner_reward constant integer := 1000;
  v_points constant integer := 10;
  v_daily_limit constant integer := 2;
begin
  if p_today_key is null then
    return jsonb_build_object('error', 'invalid_day');
  end if;

  v_request_hash := encode(digest(jsonb_build_object(
    'avatarId', p_avatar_id, 'tokenId', p_token_id
  )::text, 'sha256'), 'hex');

  begin
    insert into public.runway_action_receipts (actor_user_id, action_type, idempotency_key, request_hash, status)
    values (p_voter_id, 'super_vote', p_idempotency_key, v_request_hash, 'processing');
  exception when unique_violation then
    select request_hash, status, response
    into v_existing_hash, v_existing_status, v_existing_response
    from public.runway_action_receipts
    where actor_user_id = p_voter_id
      and action_type = 'super_vote'
      and idempotency_key = p_idempotency_key
    for update;

    if v_existing_hash <> v_request_hash then
      return jsonb_build_object('error', 'idempotency_key_reused_with_different_payload');
    end if;
    if v_existing_status = 'completed' then
      return v_existing_response;
    end if;
    return jsonb_build_object('error', 'request_already_processing');
  end;

  select * into v_token
  from public.runway_candidate_tokens
  where id = p_token_id
    and viewer_user_id = p_voter_id
    and avatar_id = p_avatar_id
  for update;

  if not found or v_token.consumed_at is not null or v_token.expires_at <= now() then
    v_result := jsonb_build_object('error', 'invalid_or_expired_candidate');
  else
    select * into v_avatar
    from public.voting_avatars
    where id = p_avatar_id
    for update;

    if not found or v_avatar.is_active is not true then
      v_result := jsonb_build_object('error', 'avatar_not_active');
    elsif v_avatar.owner_user_id = p_voter_id then
      v_result := jsonb_build_object('error', 'cannot_vote_own_avatar');
    else
      -- Lock both coin balances in a stable UUID order. This prevents an
      -- A<->B cross-vote deadlock and makes the balance transfer atomic.
      for v_profile in
        select id, coins
        from public.profiles
        where id in (p_voter_id, v_avatar.owner_user_id)
        order by id
        for update
      loop
        if v_profile.id = p_voter_id then
          v_voter_coins := v_profile.coins;
        elsif v_profile.id = v_avatar.owner_user_id then
          v_owner_coins := v_profile.coins;
        end if;
      end loop;

      if v_voter_coins is null or v_owner_coins is null then
        v_result := jsonb_build_object('error', 'profile_not_found');
      elsif v_voter_coins < v_cost then
        v_result := jsonb_build_object('error', 'insufficient_coins');
      else
        v_day_start := p_today_key::timestamp at time zone 'Europe/Istanbul';
        v_next_day_start := (p_today_key + 1)::timestamp at time zone 'Europe/Istanbul';
        select count(*) into v_used_today
        from public.runway_super_votes
        where voter_user_id = p_voter_id
          and created_at >= v_day_start
          and created_at < v_next_day_start;

        if v_used_today >= v_daily_limit then
          v_result := jsonb_build_object('error', 'daily_super_vote_limit_reached');
        else
          update public.runway_candidate_tokens
          set consumed_at = now(), consumed_as = 'super_vote'
          where id = p_token_id;

          update public.profiles
          set coins = v_voter_coins - v_cost,
              updated_at = now()
          where id = p_voter_id;

          update public.profiles
          set coins = v_owner_coins + v_owner_reward,
              updated_at = now()
          where id = v_avatar.owner_user_id;

          insert into public.runway_super_votes (voter_user_id, avatar_id)
          values (p_voter_id, p_avatar_id);

          update public.voting_avatars
          set total_points = total_points + v_points,
              super_vote_count = super_vote_count + 1,
              last_rated_at = now(),
              updated_at = now()
          where id = p_avatar_id;

          insert into public.coin_transactions (user_id, amount, balance_before, balance_after, reason, metadata)
          values
            (p_voter_id, -v_cost, v_voter_coins, v_voter_coins - v_cost, 'runway_super_vote_spend',
              jsonb_build_object('avatarId', p_avatar_id, 'ownerUserId', v_avatar.owner_user_id)),
            (v_avatar.owner_user_id, v_owner_reward, v_owner_coins, v_owner_coins + v_owner_reward, 'runway_super_vote_reward',
              jsonb_build_object('avatarId', p_avatar_id, 'voterUserId', p_voter_id));

          v_result := jsonb_build_object(
            'success', true,
            'pointsDelta', v_points,
            'coinCost', v_cost,
            'ownerCoinReward', v_owner_reward,
            'newCoinBalance', v_voter_coins - v_cost,
            'superVotesUsedToday', v_used_today + 1,
            'superVotesRemainingToday', v_daily_limit - v_used_today - 1
          );
        end if;
      end if;
    end if;
  end if;

  update public.runway_action_receipts
  set status = 'completed', response = v_result, completed_at = now()
  where actor_user_id = p_voter_id
    and action_type = 'super_vote'
    and idempotency_key = p_idempotency_key;

  return v_result;
end;
$$;

revoke all on function public.cast_runway_super_vote(uuid, uuid, uuid, text, date) from public, anon, authenticated;
grant execute on function public.cast_runway_super_vote(uuid, uuid, uuid, text, date) to service_role;

-- Super Votes count toward cumulative leaderboard points but must not inflate
-- a star average. This replaces the original leaderboard RPC accordingly.
create or replace function public.get_runway_leaderboard(
  p_section text default 'top',
  p_limit integer default 20,
  p_viewer_id uuid default null,
  p_min_votes integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_section text := case when lower(coalesce(p_section, 'top')) in ('highest_rated', 'new') then lower(p_section) else 'top' end;
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
  v_min_votes integer := greatest(0, coalesce(p_min_votes, 5));
  v_leaders jsonb;
  v_viewer jsonb;
begin
  if v_section = 'top' then
    with ranked as (
      select id, owner_user_id, total_points, rating_count, super_vote_count, created_at,
        row_number() over (
          order by total_points desc,
                   ((total_points - super_vote_count * 10)::numeric / nullif(rating_count, 0)) desc nulls last,
                   rating_count desc, created_at asc
        ) as rnk
      from public.voting_avatars where is_active = true
    )
    select
      (select jsonb_agg(jsonb_build_object(
        'rank', rnk, 'avatarId', id, 'ownerUserId', owner_user_id,
        'totalPoints', total_points, 'ratingCount', rating_count, 'superVoteCount', super_vote_count, 'createdAt', created_at
      ) order by rnk) from ranked where rnk <= v_limit),
      (select jsonb_build_object(
        'rank', rnk, 'avatarId', id, 'ownerUserId', owner_user_id,
        'totalPoints', total_points, 'ratingCount', rating_count, 'superVoteCount', super_vote_count, 'createdAt', created_at
      ) from ranked where p_viewer_id is not null and owner_user_id = p_viewer_id order by rnk limit 1)
    into v_leaders, v_viewer;
  elsif v_section = 'highest_rated' then
    with ranked as (
      select id, owner_user_id, total_points, rating_count, super_vote_count, created_at,
        row_number() over (
          order by ((total_points - super_vote_count * 10)::numeric / nullif(rating_count, 0)) desc nulls last,
                   rating_count desc
        ) as rnk
      from public.voting_avatars where is_active = true and rating_count >= v_min_votes
    )
    select jsonb_agg(jsonb_build_object(
      'rank', rnk, 'avatarId', id, 'ownerUserId', owner_user_id,
      'totalPoints', total_points, 'ratingCount', rating_count, 'superVoteCount', super_vote_count, 'createdAt', created_at
    ) order by rnk) into v_leaders from ranked where rnk <= v_limit;
  else
    with ranked as (
      select id, owner_user_id, total_points, rating_count, super_vote_count, created_at,
        row_number() over (order by created_at desc) as rnk
      from public.voting_avatars where is_active = true
    )
    select jsonb_agg(jsonb_build_object(
      'rank', rnk, 'avatarId', id, 'ownerUserId', owner_user_id,
      'totalPoints', total_points, 'ratingCount', rating_count, 'superVoteCount', super_vote_count, 'createdAt', created_at
    ) order by rnk) into v_leaders from ranked where rnk <= v_limit;
  end if;

  return jsonb_build_object('section', v_section, 'leaders', coalesce(v_leaders, '[]'::jsonb), 'viewer', v_viewer);
end;
$$;

revoke all on function public.get_runway_leaderboard(text, integer, uuid, integer) from public, anon, authenticated;
grant execute on function public.get_runway_leaderboard(text, integer, uuid, integer) to service_role;
