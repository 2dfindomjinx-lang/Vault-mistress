-- Crate Duels: two subs each pay for the same lineup of N crates (one or more
-- crate types, one crate per round), each open them, and whoever's total
-- value is higher takes the entire haul.
-- Structured like Tribute Duels (open challenge -> async accept -> reveal)
-- specifically to solve the same problem: very few people are ever online at
-- the same moment, so nothing here requires two players to act
-- simultaneously.
--
-- The challenger's crates are opened the instant the challenge is created -
-- not when someone accepts - and every result is sealed inside this table,
-- unseen even by the challenger, until an opponent's own open reveals both
-- sides at once. This is what makes "wait for a stranger, whenever they show
-- up" safe: the challenger already has a genuine, already-paid-for haul
-- sitting in escrow, so there is nothing to fake and nothing to wait on
-- except someone else's click. The client replays the reveal round by round
-- for whoever is looking at it - the challenger sees the same dramatized
-- reveal later that the opponent sees immediately, from stored data, not a
-- live feed neither of them is guaranteed to be online for.
--
-- Deliberately decoupled from the main crate-open pricing/pity system in
-- crates.ts: a duel is priced at the crate's plain listed cost and rolled
-- against its plain listed drop table, with no event discounts, free-open
-- grants, or the Principessa Case pity counter involved. Both sides need to
-- be facing the exact same odds for a duel to be fair, and event modifiers
-- are strictly per-account and per-moment.
--
-- Safe to re-run.

create table if not exists public.crate_duels (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid references public.profiles(id) on delete cascade,
  crate_type text not null,
  crate_cost integer not null check (crate_cost > 0),
  quantity integer not null default 1 check (quantity between 1 and 10),
  -- Each array holds `quantity` objects shaped {"itemId","variant","sellValue"},
  -- in roll order - the order the reveal animation replays them in.
  challenger_items jsonb not null default '[]'::jsonb,
  challenger_total_value integer not null,
  opponent_items jsonb,
  opponent_total_value integer,
  status text not null default 'open' check (status in ('open', 'revealed', 'cancelled')),
  winner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz not null,
  -- When each side watched the reveal. Kept on the account (not in the
  -- browser) so a duel watched on one device is not offered again on another.
  challenger_seen_at timestamptz,
  opponent_seen_at timestamptz
);

-- Mixed-crate lineups. `crates` is the ordered list of crate types (one per
-- round); `total_cost` is what each side pays. Older duels (one crate type x
-- quantity) leave both null and fall back to crate_type / crate_cost * quantity.
alter table public.crate_duels add column if not exists crates jsonb;
alter table public.crate_duels add column if not exists total_cost integer;

-- A table created by an earlier version of this file has no seen columns.
-- Add them once, and mark every duel that is already revealed as seen: those
-- were all offered to their players by the previous (per-browser) mechanism,
-- and re-offering them all at once would just be noise. The check keeps a
-- later re-run from marking genuinely unwatched duels as seen.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crate_duels' and column_name = 'challenger_seen_at'
  ) then
    alter table public.crate_duels
      add column challenger_seen_at timestamptz,
      add column opponent_seen_at timestamptz;
    update public.crate_duels
    set challenger_seen_at = accepted_at, opponent_seen_at = accepted_at
    where status = 'revealed';
  end if;
end;
$$;

-- `create table if not exists` leaves an existing table's constraints alone,
-- so a database that ran an earlier version of this file keeps its old
-- quantity cap (it was 5) and rejects any bigger duel. Re-state the cap here
-- so re-running this file always lands on the current one.
alter table public.crate_duels drop constraint if exists crate_duels_quantity_check;
alter table public.crate_duels add constraint crate_duels_quantity_check check (quantity between 1 and 10);

create index if not exists crate_duels_status_idx on public.crate_duels (status, created_at desc);
create index if not exists crate_duels_challenger_idx on public.crate_duels (challenger_id);
create index if not exists crate_duels_opponent_idx on public.crate_duels (opponent_id);
create index if not exists crate_duels_expiry_idx on public.crate_duels (expires_at) where status = 'open';

alter table public.crate_duels enable row level security;
revoke all on public.crate_duels from public, anon, authenticated;

-- One item, one quantity, always an upsert against the real
-- unique(user_id, item_id, variant) constraint.
create or replace function public.grant_crate_duel_item(p_user_id uuid, p_item_id text, p_variant text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_crate_inventory (user_id, item_id, variant, quantity)
  values (p_user_id, p_item_id, p_variant, 1)
  on conflict (user_id, item_id, variant)
  do update set quantity = public.user_crate_inventory.quantity + 1;
$$;

-- Grants every item in a sealed items array - shared by accept (paying out
-- the winner, or each side on a tie), cancel and expiry.
create or replace function public.grant_crate_duel_items(p_user_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    perform public.grant_crate_duel_item(
      p_user_id,
      v_item ->> 'itemId',
      coalesce(v_item ->> 'variant', 'normal')
    );
  end loop;
end;
$$;

-- Sums the sellValue of every item in a sealed items array. Used to derive
-- the authoritative total from the array itself rather than trusting a
-- separately-passed number, so the array is always the single source of
-- truth for what a side's haul is worth.
create or replace function public.sum_crate_duel_items_value(p_items jsonb)
returns integer
language sql
immutable
as $$
  select coalesce(sum((elem ->> 'sellValue')::integer), 0)::integer
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) elem;
$$;

-- -------------------------------------------------------------------- create
-- The items have already been rolled in the API route (it needs the real
-- crate drop tables, which live in TypeScript, not here) - this function's
-- job is just the atomic part: charge N crates' worth and seal the haul away.
-- The signature changed when lineups were added; drop the single-crate one so
-- two overloads never coexist.
drop function if exists public.create_crate_duel(uuid, text, integer, integer, jsonb, integer);

create or replace function public.create_crate_duel(
  p_user_id uuid,
  p_crates jsonb,
  p_total_cost integer,
  p_items jsonb,
  p_expires_hours integer default 48
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins integer;
  v_duel_id uuid;
  v_quantity integer;
  v_total integer;
begin
  if p_crates is null or jsonb_typeof(p_crates) <> 'array' then
    return jsonb_build_object('error', 'invalid_crates');
  end if;
  v_quantity := jsonb_array_length(p_crates);
  if v_quantity < 1 or v_quantity > 10 then
    return jsonb_build_object('error', 'invalid_crates');
  end if;
  if p_total_cost is null or p_total_cost <= 0 then
    return jsonb_build_object('error', 'invalid_cost');
  end if;
  if p_items is null or jsonb_array_length(p_items) <> v_quantity then
    return jsonb_build_object('error', 'invalid_items');
  end if;

  select coins into v_coins from public.profiles where id = p_user_id for update;
  if v_coins is null then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  if exists (
    select 1 from public.crate_duels
    where challenger_id = p_user_id and status = 'open' and expires_at > now()
  ) then
    return jsonb_build_object('error', 'already_in_duel');
  end if;

  if v_coins < p_total_cost then
    return jsonb_build_object('error', 'insufficient_coins', 'coins', v_coins);
  end if;

  v_total := public.sum_crate_duel_items_value(p_items);

  update public.profiles set coins = v_coins - p_total_cost, updated_at = now() where id = p_user_id;

  insert into public.coin_transactions (user_id, amount, balance_before, balance_after, reason, metadata)
  values (
    p_user_id, -p_total_cost, v_coins, v_coins - p_total_cost, 'spend:crate-duel',
    jsonb_build_object('crates', p_crates, 'quantity', v_quantity)
  );

  insert into public.crate_duels (
    challenger_id, crate_type, crate_cost, crates, total_cost, quantity, challenger_items,
    challenger_total_value, expires_at
  ) values (
    p_user_id, p_crates ->> 0, greatest(1, p_total_cost / v_quantity), p_crates, p_total_cost, v_quantity, p_items, v_total,
    now() + make_interval(hours => greatest(1, least(168, coalesce(p_expires_hours, 48))))
  )
  returning id into v_duel_id;

  return jsonb_build_object('duelId', v_duel_id, 'coins', v_coins - p_total_cost);
end;
$$;

-- -------------------------------------------------------------------- accept
-- Accepting IS the reveal: the opponent's items have already been rolled by
-- the caller, in the same quantity as the duel, against the same crate's
-- baseline drops. This function compares the two totals the moment it
-- charges the fee.
create or replace function public.accept_crate_duel(
  p_user_id uuid,
  p_duel_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel record;
  v_coins integer;
  v_winner uuid;
  v_opponent_total integer;
  v_charge integer;
begin
  select * into v_duel from public.crate_duels where id = p_duel_id for update;
  if v_duel is null then
    return jsonb_build_object('error', 'duel_not_found');
  end if;
  if v_duel.status <> 'open' or v_duel.expires_at <= now() then
    return jsonb_build_object('error', 'duel_not_open');
  end if;
  if v_duel.challenger_id = p_user_id then
    return jsonb_build_object('error', 'own_duel');
  end if;
  if p_items is null or jsonb_array_length(p_items) <> v_duel.quantity then
    return jsonb_build_object('error', 'invalid_items');
  end if;

  select coins into v_coins from public.profiles where id = p_user_id for update;
  if v_coins is null then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  v_charge := coalesce(v_duel.total_cost, v_duel.crate_cost * v_duel.quantity);
  if v_coins < v_charge then
    return jsonb_build_object('error', 'insufficient_coins', 'coins', v_coins);
  end if;

  update public.profiles set coins = v_coins - v_charge, updated_at = now() where id = p_user_id;
  insert into public.coin_transactions (user_id, amount, balance_before, balance_after, reason, metadata)
  values (
    p_user_id, -v_charge, v_coins, v_coins - v_charge, 'spend:crate-duel',
    jsonb_build_object('crates', coalesce(v_duel.crates, to_jsonb(array_fill(v_duel.crate_type, array[v_duel.quantity]))), 'quantity', v_duel.quantity)
  );

  v_opponent_total := public.sum_crate_duel_items_value(p_items);

  -- Higher total takes the entire haul, both sides' items. An exact tie
  -- means each side simply keeps what they rolled - the same outcome as if
  -- they had each opened solo, so a tie costs neither of them anything
  -- beyond the entry price.
  if v_opponent_total > v_duel.challenger_total_value then
    v_winner := p_user_id;
  elsif v_duel.challenger_total_value > v_opponent_total then
    v_winner := v_duel.challenger_id;
  else
    v_winner := null;
  end if;

  if v_winner is null then
    perform public.grant_crate_duel_items(v_duel.challenger_id, v_duel.challenger_items);
    perform public.grant_crate_duel_items(p_user_id, p_items);
  else
    perform public.grant_crate_duel_items(v_winner, v_duel.challenger_items);
    perform public.grant_crate_duel_items(v_winner, p_items);
  end if;

  update public.crate_duels
  set opponent_id = p_user_id,
      opponent_items = p_items,
      opponent_total_value = v_opponent_total,
      winner_id = v_winner,
      status = 'revealed',
      accepted_at = now()
  where id = p_duel_id;

  return jsonb_build_object(
    'revealed', true,
    'winnerId', v_winner,
    'challengerItems', v_duel.challenger_items,
    'challengerTotal', v_duel.challenger_total_value,
    'opponentItems', p_items,
    'opponentTotal', v_opponent_total
  );
end;
$$;

-- -------------------------------------------------------------------- cancel
-- Only the challenger, and only before anyone accepts. Cancelling releases
-- the haul they already, genuinely won into their own inventory - refunding
-- the coins as well would pay them twice for crates that really opened.
create or replace function public.cancel_crate_duel(
  p_user_id uuid,
  p_duel_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel record;
begin
  select * into v_duel from public.crate_duels where id = p_duel_id for update;
  if v_duel is null or v_duel.challenger_id <> p_user_id then
    return jsonb_build_object('error', 'duel_not_found');
  end if;
  if v_duel.status <> 'open' then
    return jsonb_build_object('error', 'duel_not_open');
  end if;

  perform public.grant_crate_duel_items(p_user_id, v_duel.challenger_items);
  update public.crate_duels set status = 'cancelled' where id = p_duel_id;

  return jsonb_build_object('cancelled', true);
end;
$$;

-- ------------------------------------------------------------- lazy expiry
-- Called from the list route on every read, exactly like Tribute Duels'
-- lazy finalize: no cron job, whoever reads next sweeps whatever has gone
-- stale. Expiry is just an unaccepted challenge going unaccepted - the
-- challenger gets the haul they already rolled, same as a manual cancel.
create or replace function public.expire_stale_crate_duels(p_limit integer default 10)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select id, challenger_id, challenger_items
    from public.crate_duels
    where status = 'open' and expires_at <= now()
    order by expires_at asc
    limit greatest(1, least(coalesce(p_limit, 10), 50))
    for update
  loop
    perform public.grant_crate_duel_items(v_row.challenger_id, v_row.challenger_items);
    update public.crate_duels set status = 'cancelled' where id = v_row.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.grant_crate_duel_item(uuid, text, text) from public, anon, authenticated;
revoke all on function public.grant_crate_duel_items(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.sum_crate_duel_items_value(jsonb) from public, anon, authenticated;
revoke all on function public.create_crate_duel(uuid, jsonb, integer, jsonb, integer) from public, anon, authenticated;
revoke all on function public.accept_crate_duel(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.cancel_crate_duel(uuid, uuid) from public, anon, authenticated;
revoke all on function public.expire_stale_crate_duels(integer) from public, anon, authenticated;
grant execute on function public.grant_crate_duel_item(uuid, text, text) to service_role;
grant execute on function public.grant_crate_duel_items(uuid, jsonb) to service_role;
grant execute on function public.sum_crate_duel_items_value(jsonb) to service_role;
grant execute on function public.create_crate_duel(uuid, jsonb, integer, jsonb, integer) to service_role;
grant execute on function public.accept_crate_duel(uuid, uuid, jsonb) to service_role;
grant execute on function public.cancel_crate_duel(uuid, uuid) to service_role;
grant execute on function public.expire_stale_crate_duels(integer) to service_role;
