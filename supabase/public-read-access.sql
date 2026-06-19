-- Public read access for anon/authenticated clients.
-- Apply after schema.sql and security-hardening.sql.
-- Sensitive columns stay behind security definer RPCs.

drop policy if exists "Public can read active random events" on public.random_events;
create policy "Public can read active random events"
  on public.random_events for select
  to anon, authenticated
  using (
    active = true
    and starts_at <= now()
    and ends_at > now()
  );

drop policy if exists "Anon can read global principessa progress" on public.global_principessa_progress;
create policy "Anon can read global principessa progress"
  on public.global_principessa_progress for select
  to anon
  using (true);

drop policy if exists "Anon can read global principessa events" on public.global_principessa_xp_events;
create policy "Anon can read global principessa events"
  on public.global_principessa_xp_events for select
  to anon
  using (true);

drop policy if exists "Anon can read jackpot cycles" on public.loyalty_jackpots;
create policy "Anon can read jackpot cycles"
  on public.loyalty_jackpots for select
  to anon
  using (true);

drop policy if exists "Anon can read jackpot contributions" on public.loyalty_jackpot_contributions;
create policy "Anon can read jackpot contributions"
  on public.loyalty_jackpot_contributions for select
  to anon
  using (true);

create or replace function public.get_public_leaderboard(p_limit integer default 3)
returns table (
  id uuid,
  username text,
  display_name text,
  tribute_total integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.tribute_total, p.created_at
  from public.profiles p
  where p.hide_from_leaderboard = false
  order by p.tribute_total desc, p.created_at asc
  limit greatest(1, least(coalesce(p_limit, 3), 10));
$$;

create or replace function public.get_public_shame_board(p_limit integer default 3)
returns table (
  id uuid,
  username text,
  display_name text,
  shame_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.shame_count
  from public.profiles p
  where p.shame_count > 0
  order by p.shame_count desc, p.created_at asc
  limit greatest(1, least(coalesce(p_limit, 3), 10));
$$;

create or replace function public.is_public_throne_tribute_transaction(p_reason text, p_metadata jsonb)
returns boolean
language sql
immutable
as $$
  select
    p_reason in ('throne_tribute', 'admin:/give')
    or (
      p_reason in ('live_gift', 'admin_grant')
      and coalesce(p_metadata ->> 'command', '') = 'give'
    );
$$;

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
  select ct.id, ct.user_id, ct.amount, ct.created_at
  from public.coin_transactions ct
  where ct.reason in ('tribute', 'live_gift', 'throne_tribute', 'admin_grant', 'admin:/give')
    and ct.amount > 0
  order by ct.created_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

create or replace function public.get_public_top_tributors(p_limit integer default 3)
returns table (
  user_id uuid,
  amount bigint,
  latest_created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ct.user_id,
    sum(ct.amount)::bigint as amount,
    max(ct.created_at) as latest_created_at
  from public.coin_transactions ct
  where ct.amount > 0
    and public.is_public_throne_tribute_transaction(ct.reason, ct.metadata)
  group by ct.user_id
  order by sum(ct.amount) desc, max(ct.created_at) desc
  limit greatest(1, least(coalesce(p_limit, 3), 10));
$$;

create or replace function public.get_public_profile_snippets(p_user_ids uuid[])
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from public.profiles p
  where cardinality(coalesce(p_user_ids, array[]::uuid[])) > 0
    and p.id = any(p_user_ids);
$$;

create or replace function public.get_public_username_cosmetics(p_user_ids uuid[])
returns table (
  user_id uuid,
  item_id text,
  item_type text,
  equipped boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select uc.user_id, uc.item_id, uc.item_type, uc.equipped
  from public.user_cosmetics uc
  where cardinality(coalesce(p_user_ids, array[]::uuid[])) > 0
    and uc.user_id = any(p_user_ids)
    and uc.equipped = true
    and uc.item_type in ('username-color', 'username-glow');
$$;

create or replace function public.get_jackpot_eligible_count(p_excluded_user_ids uuid[] default array[]::uuid[])
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.profiles p
  where p.loyalty_streak >= 3
    and not (p.id = any(coalesce(p_excluded_user_ids, array[]::uuid[])));
$$;

create or replace function public.get_jackpot_winner_display(p_jackpot_id uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  amount integer,
  reason text,
  created_at timestamptz,
  place integer
)
language sql
stable
security definer
set search_path = public
as $$
  with winners as (
    select
      ct.user_id,
      ct.amount,
      ct.reason,
      ct.created_at,
      ct.metadata,
      case ct.reason
        when 'jackpot_win_1st' then 1
        when 'jackpot_win_2nd' then 2
        when 'jackpot_win_3rd' then 3
        else 99
      end as place
    from public.coin_transactions ct
    where ct.reason in ('jackpot_win_1st', 'jackpot_win_2nd', 'jackpot_win_3rd')
      and coalesce(ct.metadata ->> 'jackpotId', '') = p_jackpot_id::text
  )
  select
    w.user_id,
    coalesce(p.username, coalesce(w.metadata ->> 'username', '@unknown')) as username,
    p.display_name,
    w.amount,
    w.reason,
    w.created_at,
    w.place
  from winners w
  left join public.profiles p on p.id = w.user_id
  order by w.place asc, w.created_at asc;
$$;

create or replace function public.get_previous_jackpot_winner_user_ids(p_current_cycle_key text)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  with previous_jackpots as (
    select lj.id, lj.winner_user_id
    from public.loyalty_jackpots lj
    where lj.cycle_key <> coalesce(p_current_cycle_key, '')
    order by lj.starts_at desc
    limit 2
  ),
  legacy_ids as (
    select array_remove(array_agg(distinct pj.winner_user_id), null) as ids
    from previous_jackpots pj
  ),
  transaction_ids as (
    select array_remove(array_agg(distinct ct.user_id), null) as ids
    from public.coin_transactions ct
    cross join previous_jackpots pj
    where ct.reason in ('jackpot_win_1st', 'jackpot_win_2nd', 'jackpot_win_3rd')
      and coalesce(ct.metadata ->> 'jackpotId', '') = pj.id::text
  )
  select coalesce(
    (
      select array(
        select distinct unnest(
          coalesce((select ids from legacy_ids), array[]::uuid[])
          || coalesce((select ids from transaction_ids), array[]::uuid[])
        )
      )
    ),
    array[]::uuid[]
  );
$$;

-- Safe public RPC for Top Valuable Inventories leaderboard.
-- Server-side value = sum(quantity * sell_value from crate_items).
-- Only returns user_id + value; API enriches with public profile data (username, avatar).
-- SECURITY DEFINER so it can aggregate across users without exposing private RLS rows.
create or replace function public.get_public_top_valuable_inventories(p_limit integer default 3)
returns table (
  user_id uuid,
  value numeric
)
language sql
stable
security definer
set search_path = public
as $$
  -- Respects hide_from_leaderboard like the other public leaderboards.
  -- Users with hide_from_leaderboard = true are excluded from Top Valuable Inventories.
  select
    uci.user_id,
    sum(uci.quantity * ci.sell_value)::numeric as value
  from public.user_crate_inventory uci
  join public.crate_items ci
    on ci.item_id = uci.item_id
   and ci.enabled = true
  join public.profiles p
    on p.id = uci.user_id
   and p.hide_from_leaderboard = false
  group by uci.user_id
  order by value desc
  limit greatest(1, least(coalesce(p_limit, 3), 10));
$$;

grant execute on function public.get_public_top_valuable_inventories(integer) to anon, authenticated;

grant execute on function public.get_public_leaderboard(integer) to anon, authenticated;
grant execute on function public.get_public_shame_board(integer) to anon, authenticated;
grant execute on function public.get_public_recent_tribute_transactions(integer) to anon, authenticated;
grant execute on function public.get_public_top_tributors(integer) to anon, authenticated;
grant execute on function public.get_public_profile_snippets(uuid[]) to anon, authenticated;
grant execute on function public.get_public_username_cosmetics(uuid[]) to anon, authenticated;
grant execute on function public.get_jackpot_eligible_count(uuid[]) to anon, authenticated;
grant execute on function public.get_jackpot_winner_display(uuid) to anon, authenticated;
grant execute on function public.get_previous_jackpot_winner_user_ids(text) to anon, authenticated;
