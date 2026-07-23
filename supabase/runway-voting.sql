-- Runway: persistent avatar-voting pool (2026-07).
--
-- Continuously-open pool where each user maintains one snapshot "Voting
-- Avatar" (independent of their live profile look), rated 1-5 stars by other
-- users. Score is a simple running sum of stars (no averaging/Elo/Bayesian
-- normalization for the main ranking - longevity is an intentional
-- advantage). Coins reward only the first N *new* (not updated) votes a
-- user casts per day.
--
-- All write RPCs are security definer, owned by a role only the service key
-- can assume, with execute revoked from anon/authenticated and granted only
-- to service_role - matching every other RPC in this project. They are
-- NEVER reachable by a user's own JWT; only the server's service-role client
-- calls them, and it always sources the acting user's id from the verified
-- session (auth.getUser()), never from request-body input.
--
-- Lock order (identical in every RPC, to avoid deadlocks):
--   profiles (acting user) -> runway_candidate_tokens -> voting_avatars -> avatar_votes
-- submit_voting_avatar only ever touches profiles -> voting_avatars (no
-- tokens or votes are involved in submission at all).

create extension if not exists pgcrypto;

create table if not exists public.voting_avatars (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  equipped_avatar_slots jsonb not null default '{}'::jsonb,
  equipped_full_set_id text,
  has_uncensored_avatar boolean not null default false,
  -- Sole cumulative-stars column. average = total_points / rating_count.
  -- (No separate rating_sum: in this design they are always the same
  -- number, so keeping both independently mutable would just be a second
  -- place for them to drift out of sync.)
  total_points integer not null default 0 check (total_points >= 0),
  rating_count integer not null default 0 check (rating_count >= 0),
  times_shown integer not null default 0,
  skip_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  activated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  last_rated_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_voting_avatars_one_active_per_owner
  on public.voting_avatars (owner_user_id) where is_active = true;
create index if not exists idx_voting_avatars_active_points
  on public.voting_avatars (is_active, total_points desc);
create index if not exists idx_voting_avatars_owner_activated
  on public.voting_avatars (owner_user_id, activated_at desc);

create table if not exists public.avatar_votes (
  id uuid primary key default gen_random_uuid(),
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  avatar_id uuid not null references public.voting_avatars(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  reward_granted boolean not null default false,
  coin_reward integer not null default 0,
  first_rated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (voter_user_id, avatar_id)
);
create index if not exists idx_avatar_votes_avatar on public.avatar_votes (avatar_id);

create table if not exists public.avatar_feed_skips (
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  avatar_id uuid not null references public.voting_avatars(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_avatar_feed_skips_voter_avatar_created
  on public.avatar_feed_skips (voter_user_id, avatar_id, created_at desc);

-- One-time, short-lived proof that a candidate was actually issued to a
-- viewer. Vote/Skip must consume the token GET candidate handed out;
-- arbitrary avatarId voting (bypassing the feed) is rejected.
create table if not exists public.runway_candidate_tokens (
  id uuid primary key default gen_random_uuid(),
  viewer_user_id uuid not null references auth.users(id) on delete cascade,
  avatar_id uuid not null references public.voting_avatars(id) on delete cascade,
  nonce text not null default encode(gen_random_bytes(16), 'hex'),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_as text check (consumed_as in ('vote', 'skip'))
);
-- At most one *pending* (unconsumed) token per viewer at a time.
create unique index if not exists idx_runway_candidate_tokens_pending_per_viewer
  on public.runway_candidate_tokens (viewer_user_id) where consumed_at is null;
create index if not exists idx_runway_candidate_tokens_viewer_avatar
  on public.runway_candidate_tokens (viewer_user_id, avatar_id);

-- Atomic claim-first idempotency cache, shared by submit/vote/skip.
create table if not exists public.runway_action_receipts (
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in ('vote', 'skip', 'submit')),
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'processing' check (status in ('processing', 'completed')),
  response jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (actor_user_id, action_type, idempotency_key)
);

alter table public.profiles
  add column if not exists runway_rewarded_votes_today integer not null default 0,
  add column if not exists runway_rewarded_votes_date date;

alter table public.voting_avatars enable row level security;
alter table public.avatar_votes enable row level security;
alter table public.avatar_feed_skips enable row level security;
alter table public.runway_candidate_tokens enable row level security;
alter table public.runway_action_receipts enable row level security;

drop policy if exists "Users can read own voting avatars" on public.voting_avatars;
create policy "Users can read own voting avatars"
  on public.voting_avatars for select
  to authenticated
  using (auth.uid() = owner_user_id);

drop policy if exists "Users can read own votes given" on public.avatar_votes;
create policy "Users can read own votes given"
  on public.avatar_votes for select
  to authenticated
  using (auth.uid() = voter_user_id);
-- No client insert/update policies anywhere on any of these tables - every
-- write goes through the service-role RPCs below.

-- ---------------------------------------------------------------------------
-- submit_voting_avatar: replace the caller's Voting Avatar with a new,
-- already-validated snapshot (ownership/slot/full-set validation happens in
-- the calling API route - this function trusts its own DB only). The route
-- passes p_allow_multiple_active only after checking ADMIN_USER_IDS; regular
-- users retain one active row and the 7-day cooldown.
create or replace function public.submit_voting_avatar(
  p_user_id uuid,
  p_equipped_avatar_slots jsonb,
  p_equipped_full_set_id text,
  p_has_uncensored boolean,
  p_idempotency_key text,
  p_allow_multiple_active boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_hash text;
  v_existing_hash text;
  v_existing_status text;
  v_existing_response jsonb;
  v_result jsonb;
  v_last_activated_at timestamptz;
  v_new_avatar_id uuid;
begin
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  v_request_hash := encode(digest(jsonb_build_object(
    'slots', coalesce(p_equipped_avatar_slots, '{}'::jsonb),
    'fullSet', p_equipped_full_set_id,
    'uncensored', coalesce(p_has_uncensored, false),
    'allowMultipleActive', coalesce(p_allow_multiple_active, false)
  )::text, 'sha256'), 'hex');

  begin
    insert into public.runway_action_receipts (actor_user_id, action_type, idempotency_key, request_hash, status)
    values (p_user_id, 'submit', p_idempotency_key, v_request_hash, 'processing');
  exception when unique_violation then
    select request_hash, status, response into v_existing_hash, v_existing_status, v_existing_response
    from public.runway_action_receipts
    where actor_user_id = p_user_id and action_type = 'submit' and idempotency_key = p_idempotency_key
    for update;

    if v_existing_hash <> v_request_hash then
      return jsonb_build_object('error', 'idempotency_key_reused_with_different_payload');
    end if;
    if v_existing_status = 'completed' then
      return v_existing_response;
    end if;
    return jsonb_build_object('error', 'request_already_processing');
  end;

  select activated_at into v_last_activated_at
  from public.voting_avatars
  where owner_user_id = p_user_id
  order by activated_at desc
  limit 1;

  if not coalesce(p_allow_multiple_active, false)
    and v_last_activated_at is not null
    and now() < v_last_activated_at + interval '7 days' then
    v_result := jsonb_build_object(
      'error', 'cooldown_active',
      'next_eligible_at', v_last_activated_at + interval '7 days'
    );
  else
    if not coalesce(p_allow_multiple_active, false) then
      update public.voting_avatars
      set is_active = false, deactivated_at = now(), updated_at = now()
      where owner_user_id = p_user_id and is_active = true;
    end if;

    insert into public.voting_avatars (
      owner_user_id, equipped_avatar_slots, equipped_full_set_id, has_uncensored_avatar
    ) values (
      p_user_id, coalesce(p_equipped_avatar_slots, '{}'::jsonb), p_equipped_full_set_id, coalesce(p_has_uncensored, false)
    )
    returning id into v_new_avatar_id;

    v_result := jsonb_build_object(
      'success', true,
      'avatarId', v_new_avatar_id,
      'nextEligibleAt', now() + interval '7 days'
    );
  end if;

  update public.runway_action_receipts
  set status = 'completed', response = v_result, completed_at = now()
  where actor_user_id = p_user_id and action_type = 'submit' and idempotency_key = p_idempotency_key;

  return v_result;
end;
$$;

revoke all on function public.submit_voting_avatar(uuid, jsonb, text, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.submit_voting_avatar(uuid, jsonb, text, boolean, text, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- get_runway_candidate: issue (or re-issue) a one-time candidate token for
-- this viewer. Re-fetching while a token is still pending and unexpired
-- returns that SAME token/avatar and does not touch times_shown - this is
-- what makes rapid refreshing harmless. times_shown is incremented exactly
-- once, only when a genuinely new token is issued.
create or replace function public.get_runway_candidate(
  p_viewer_id uuid,
  p_ttl_seconds integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ttl integer := greatest(30, least(coalesce(p_ttl_seconds, 120), 600));
  v_pending record;
  v_chosen record;
  v_token_id uuid;
  v_existing_rating smallint;
begin
  perform 1 from public.profiles where id = p_viewer_id for update;
  if not found then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  select * into v_pending
  from public.runway_candidate_tokens
  where viewer_user_id = p_viewer_id and consumed_at is null
  for update;

  if found then
    if v_pending.expires_at > now() then
      select rating into v_existing_rating from public.avatar_votes
      where voter_user_id = p_viewer_id and avatar_id = v_pending.avatar_id;

      return jsonb_build_object(
        'tokenId', v_pending.id,
        'avatarId', v_pending.avatar_id,
        'existingRating', v_existing_rating
      );
    end if;

    delete from public.runway_candidate_tokens where id = v_pending.id;
  end if;

  select va.* into v_chosen
  from public.voting_avatars va
  where va.is_active = true
    and va.owner_user_id <> p_viewer_id
    and not exists (
      select 1 from public.avatar_feed_skips s
      where s.voter_user_id = p_viewer_id
        and s.avatar_id = va.id
        and s.created_at > now() - interval '30 minutes'
    )
  order by
    (exists (
      select 1 from public.avatar_votes v
      where v.voter_user_id = p_viewer_id and v.avatar_id = va.id
    )) asc,
    va.times_shown asc,
    random()
  limit 1
  for update of va;

  if not found then
    return jsonb_build_object('empty', true);
  end if;

  insert into public.runway_candidate_tokens (viewer_user_id, avatar_id, expires_at)
  values (p_viewer_id, v_chosen.id, now() + make_interval(secs => v_ttl))
  returning id into v_token_id;

  update public.voting_avatars set times_shown = times_shown + 1 where id = v_chosen.id;

  select rating into v_existing_rating from public.avatar_votes
  where voter_user_id = p_viewer_id and avatar_id = v_chosen.id;

  return jsonb_build_object(
    'tokenId', v_token_id,
    'avatarId', v_chosen.id,
    'existingRating', v_existing_rating
  );
end;
$$;

revoke all on function public.get_runway_candidate(uuid, integer) from public, anon, authenticated;
grant execute on function public.get_runway_candidate(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- cast_avatar_vote: consumes a candidate token, applies a star rating.
-- p_coin_reward/p_daily_limit are passed in by the trusted service-role
-- route (from src/lib/server-game-rules.ts - a plpgsql function cannot
-- import a TS module) and are still clamped here as defense-in-depth.
-- p_today_key is the GMT+3 date computed by the route via the project's
-- existing getGmt3DateKey() - no day-boundary math is reimplemented in SQL.
create or replace function public.cast_avatar_vote(
  p_voter_id uuid,
  p_avatar_id uuid,
  p_rating smallint,
  p_token_id uuid,
  p_idempotency_key text,
  p_coin_reward integer,
  p_daily_limit integer,
  p_today_key date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coin_reward integer := greatest(0, least(coalesce(p_coin_reward, 0), 100000));
  v_daily_limit integer := greatest(1, least(coalesce(p_daily_limit, 5), 100));
  v_request_hash text;
  v_existing_hash text;
  v_existing_status text;
  v_existing_response jsonb;
  v_result jsonb;
  v_coins integer;
  v_rewarded_today integer;
  v_rewarded_date date;
  v_token record;
  v_avatar record;
  v_existing_vote record;
  v_point_delta integer;
  v_new_total_points integer;
  v_new_rating_count integer;
  v_reward_granted boolean := false;
  v_coin_reward_given integer := 0;
  v_new_coins integer;
  v_previous_rating smallint := null;
begin
  select coins, runway_rewarded_votes_today, runway_rewarded_votes_date
  into v_coins, v_rewarded_today, v_rewarded_date
  from public.profiles where id = p_voter_id for update;
  if not found then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  v_request_hash := encode(digest(jsonb_build_object(
    'avatarId', p_avatar_id, 'rating', p_rating, 'tokenId', p_token_id
  )::text, 'sha256'), 'hex');

  begin
    insert into public.runway_action_receipts (actor_user_id, action_type, idempotency_key, request_hash, status)
    values (p_voter_id, 'vote', p_idempotency_key, v_request_hash, 'processing');
  exception when unique_violation then
    select request_hash, status, response into v_existing_hash, v_existing_status, v_existing_response
    from public.runway_action_receipts
    where actor_user_id = p_voter_id and action_type = 'vote' and idempotency_key = p_idempotency_key
    for update;

    if v_existing_hash <> v_request_hash then
      return jsonb_build_object('error', 'idempotency_key_reused_with_different_payload');
    end if;
    if v_existing_status = 'completed' then
      return v_existing_response;
    end if;
    return jsonb_build_object('error', 'request_already_processing');
  end;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    v_result := jsonb_build_object('error', 'invalid_rating');
  else
    select * into v_token from public.runway_candidate_tokens
    where id = p_token_id and viewer_user_id = p_voter_id and avatar_id = p_avatar_id
    for update;

    if not found or v_token.consumed_at is not null or v_token.expires_at <= now() then
      v_result := jsonb_build_object('error', 'invalid_or_expired_candidate');
    else
      update public.runway_candidate_tokens set consumed_at = now(), consumed_as = 'vote' where id = p_token_id;

      select * into v_avatar from public.voting_avatars where id = p_avatar_id for update;

      if not found or v_avatar.is_active is not true then
        v_result := jsonb_build_object('error', 'avatar_not_active');
      elsif v_avatar.owner_user_id = p_voter_id then
        v_result := jsonb_build_object('error', 'cannot_vote_own_avatar');
      else
        select * into v_existing_vote from public.avatar_votes
        where voter_user_id = p_voter_id and avatar_id = p_avatar_id
        for update;

        if not found then
          v_point_delta := p_rating;
          v_new_rating_count := v_avatar.rating_count + 1;
          v_new_total_points := greatest(0, v_avatar.total_points + v_point_delta);
          v_new_coins := v_coins;

          if v_rewarded_date is distinct from p_today_key then
            v_rewarded_today := 0;
          end if;

          if v_rewarded_today < v_daily_limit then
            v_reward_granted := true;
            v_coin_reward_given := v_coin_reward;
            v_new_coins := v_coins + v_coin_reward;

            update public.profiles
            set coins = v_new_coins,
                runway_rewarded_votes_today = v_rewarded_today + 1,
                runway_rewarded_votes_date = p_today_key,
                updated_at = now()
            where id = p_voter_id;

            insert into public.coin_transactions (user_id, amount, balance_before, balance_after, reason, metadata)
            values (
              p_voter_id, v_coin_reward, v_coins, v_new_coins, 'runway_vote_reward',
              jsonb_build_object('avatarId', p_avatar_id)
            );
          end if;

          insert into public.avatar_votes (
            voter_user_id, avatar_id, rating, reward_granted, coin_reward, first_rated_at, updated_at
          ) values (
            p_voter_id, p_avatar_id, p_rating, v_reward_granted, v_coin_reward_given, now(), now()
          );
        else
          v_previous_rating := v_existing_vote.rating;
          v_point_delta := p_rating - v_existing_vote.rating;
          v_new_rating_count := v_avatar.rating_count;
          v_new_total_points := greatest(0, v_avatar.total_points + v_point_delta);
          v_new_coins := v_coins;

          update public.avatar_votes
          set rating = p_rating, updated_at = now()
          where id = v_existing_vote.id;
        end if;

        update public.voting_avatars
        set total_points = v_new_total_points,
            rating_count = v_new_rating_count,
            last_rated_at = now(),
            updated_at = now()
        where id = p_avatar_id;

        v_result := jsonb_build_object(
          'success', true,
          'newRating', p_rating,
          'previousRating', v_previous_rating,
          'pointsDelta', v_point_delta,
          'rewardGranted', v_reward_granted,
          'coinReward', v_coin_reward_given,
          'newCoinBalance', v_new_coins
        );
      end if;
    end if;
  end if;

  update public.runway_action_receipts
  set status = 'completed', response = v_result, completed_at = now()
  where actor_user_id = p_voter_id and action_type = 'vote' and idempotency_key = p_idempotency_key;

  return v_result;
end;
$$;

revoke all on function public.cast_avatar_vote(uuid, uuid, smallint, uuid, text, integer, integer, date) from public, anon, authenticated;
grant execute on function public.cast_avatar_vote(uuid, uuid, smallint, uuid, text, integer, integer, date) to service_role;

-- ---------------------------------------------------------------------------
-- skip_avatar_vote: consumes a candidate token as a skip. Grants nothing;
-- exactly-once per token (not per raw avatar id) is what prevents repeated
-- skips from inflating skip_count/times_shown.
create or replace function public.skip_avatar_vote(
  p_voter_id uuid,
  p_avatar_id uuid,
  p_token_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_hash text;
  v_existing_hash text;
  v_existing_status text;
  v_existing_response jsonb;
  v_result jsonb;
  v_token record;
  v_avatar record;
begin
  perform 1 from public.profiles where id = p_voter_id for update;
  if not found then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  v_request_hash := encode(digest(jsonb_build_object(
    'avatarId', p_avatar_id, 'tokenId', p_token_id
  )::text, 'sha256'), 'hex');

  begin
    insert into public.runway_action_receipts (actor_user_id, action_type, idempotency_key, request_hash, status)
    values (p_voter_id, 'skip', p_idempotency_key, v_request_hash, 'processing');
  exception when unique_violation then
    select request_hash, status, response into v_existing_hash, v_existing_status, v_existing_response
    from public.runway_action_receipts
    where actor_user_id = p_voter_id and action_type = 'skip' and idempotency_key = p_idempotency_key
    for update;

    if v_existing_hash <> v_request_hash then
      return jsonb_build_object('error', 'idempotency_key_reused_with_different_payload');
    end if;
    if v_existing_status = 'completed' then
      return v_existing_response;
    end if;
    return jsonb_build_object('error', 'request_already_processing');
  end;

  select * into v_token from public.runway_candidate_tokens
  where id = p_token_id and viewer_user_id = p_voter_id and avatar_id = p_avatar_id
  for update;

  if not found or v_token.consumed_at is not null or v_token.expires_at <= now() then
    v_result := jsonb_build_object('error', 'invalid_or_expired_candidate');
  else
    update public.runway_candidate_tokens set consumed_at = now(), consumed_as = 'skip' where id = p_token_id;

    select * into v_avatar from public.voting_avatars where id = p_avatar_id for update;

    if not found or v_avatar.is_active is not true then
      v_result := jsonb_build_object('error', 'avatar_not_active');
    elsif v_avatar.owner_user_id = p_voter_id then
      v_result := jsonb_build_object('error', 'cannot_skip_own_avatar');
    else
      insert into public.avatar_feed_skips (voter_user_id, avatar_id) values (p_voter_id, p_avatar_id);
      update public.voting_avatars set skip_count = skip_count + 1, updated_at = now() where id = p_avatar_id;
      v_result := jsonb_build_object('success', true);
    end if;
  end if;

  update public.runway_action_receipts
  set status = 'completed', response = v_result, completed_at = now()
  where actor_user_id = p_voter_id and action_type = 'skip' and idempotency_key = p_idempotency_key;

  return v_result;
end;
$$;

revoke all on function public.skip_avatar_vote(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.skip_avatar_vote(uuid, uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- get_runway_leaderboard: read-only, but kept service-role-only for
-- consistency with every other leaderboard RPC in this project.
create or replace function public.get_runway_leaderboard(
  p_section text default 'top',
  p_limit integer default 20,
  p_viewer_id uuid default null,
  p_min_votes integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
      select id, owner_user_id, total_points, rating_count, created_at,
        row_number() over (
          order by total_points desc,
                   (total_points::numeric / nullif(rating_count, 0)) desc nulls last,
                   rating_count desc,
                   created_at asc
        ) as rnk
      from public.voting_avatars
      where is_active = true
    )
    select
      (select jsonb_agg(jsonb_build_object(
        'rank', rnk, 'avatarId', id, 'ownerUserId', owner_user_id,
        'totalPoints', total_points, 'ratingCount', rating_count, 'createdAt', created_at
      ) order by rnk) from ranked where rnk <= v_limit),
      (select jsonb_build_object(
        'rank', rnk, 'avatarId', id, 'ownerUserId', owner_user_id,
        'totalPoints', total_points, 'ratingCount', rating_count, 'createdAt', created_at
      ) from ranked
        where p_viewer_id is not null and owner_user_id = p_viewer_id
        order by rnk
        limit 1)
    into v_leaders, v_viewer;

  elsif v_section = 'highest_rated' then
    with ranked as (
      select id, owner_user_id, total_points, rating_count, created_at,
        row_number() over (
          order by (total_points::numeric / nullif(rating_count, 0)) desc nulls last, rating_count desc
        ) as rnk
      from public.voting_avatars
      where is_active = true and rating_count >= v_min_votes
    )
    select jsonb_agg(jsonb_build_object(
      'rank', rnk, 'avatarId', id, 'ownerUserId', owner_user_id,
      'totalPoints', total_points, 'ratingCount', rating_count, 'createdAt', created_at
    ) order by rnk)
    into v_leaders
    from ranked where rnk <= v_limit;

  else -- 'new'
    with ranked as (
      select id, owner_user_id, total_points, rating_count, created_at,
        row_number() over (order by created_at desc) as rnk
      from public.voting_avatars
      where is_active = true
    )
    select jsonb_agg(jsonb_build_object(
      'rank', rnk, 'avatarId', id, 'ownerUserId', owner_user_id,
      'totalPoints', total_points, 'ratingCount', rating_count, 'createdAt', created_at
    ) order by rnk)
    into v_leaders
    from ranked where rnk <= v_limit;
  end if;

  return jsonb_build_object('section', v_section, 'leaders', coalesce(v_leaders, '[]'::jsonb), 'viewer', v_viewer);
end;
$$;

revoke all on function public.get_runway_leaderboard(text, integer, uuid, integer) from public, anon, authenticated;
grant execute on function public.get_runway_leaderboard(text, integer, uuid, integer) to service_role;
