-- Run after the existing Crate Duels setup. Safe to run again.
-- Atomic, retry-safe upgrades and publication of unsealed duel openings.

create table if not exists public.crate_item_upgrades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_item_id text not null,
  from_variant text not null default 'normal',
  from_sell_value integer not null,
  to_crate_type text not null,
  to_rarity text not null,
  win_chance_percent numeric(6, 3) not null,
  won boolean not null,
  to_item_id text,
  to_variant text,
  created_at timestamptz not null default now()
);
alter table public.crate_item_upgrades
  add column if not exists request_id uuid,
  add column if not exists target_item_id text,
  add column if not exists target_variant text,
  add column if not exists target_sell_value integer,
  add column if not exists roll_fraction numeric;
-- Very small chances must remain representable after removing the chance floor.
alter table public.crate_item_upgrades alter column win_chance_percent type numeric;
create unique index if not exists crate_item_upgrades_request_idx
  on public.crate_item_upgrades(user_id, request_id) where request_id is not null;
create index if not exists crate_item_upgrades_user_idx
  on public.crate_item_upgrades(user_id, created_at desc);
alter table public.crate_item_upgrades enable row level security;
revoke all on public.crate_item_upgrades from public, anon, authenticated;

create or replace function public.execute_crate_upgrade(
  p_user_id uuid, p_request_id uuid,
  p_from_item_id text, p_from_variant text, p_from_value integer,
  p_target_item_id text, p_target_variant text, p_target_value integer,
  p_target_crate text, p_target_rarity text, p_roll numeric
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_quantity integer;
  v_previous public.crate_item_upgrades%rowtype;
  v_chance numeric;
  v_won boolean;
begin
  if p_request_id is null or p_from_item_id is null or p_target_item_id is null
    or p_from_variant is null or p_target_variant is null
    or p_from_value is null or p_from_value <= 0
    or p_target_value is null or p_target_value <= p_from_value
    or p_roll is null or p_roll < 0 or p_roll >= 1 then
    return jsonb_build_object('error', 'invalid_upgrade');
  end if;

  -- Serialize this user's upgrades before checking the retry receipt.
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('error', 'profile_not_found'); end if;
  select * into v_previous from public.crate_item_upgrades
    where user_id = p_user_id and request_id = p_request_id;
  if found then
    if v_previous.from_item_id <> p_from_item_id or v_previous.from_variant <> p_from_variant
      or v_previous.target_item_id <> p_target_item_id or v_previous.target_variant <> p_target_variant then
      return jsonb_build_object('error', 'request_mismatch');
    end if;
    return jsonb_build_object('success', true, 'won', v_previous.won,
      'chancePercent', v_previous.win_chance_percent, 'rollFraction', v_previous.roll_fraction,
      'rewardItemId', v_previous.to_item_id, 'rewardVariant', v_previous.to_variant);
  end if;

  select quantity into v_quantity from public.user_crate_inventory
    where user_id = p_user_id and item_id = p_from_item_id and variant = p_from_variant for update;
  if not found or v_quantity < 1 then return jsonb_build_object('error', 'not_owned'); end if;

  v_chance := least(0.8::numeric, 0.9::numeric * p_from_value / p_target_value);
  v_won := p_roll < v_chance;
  if v_quantity = 1 then
    delete from public.user_crate_inventory
      where user_id = p_user_id and item_id = p_from_item_id and variant = p_from_variant;
  else
    update public.user_crate_inventory set quantity = quantity - 1
      where user_id = p_user_id and item_id = p_from_item_id and variant = p_from_variant;
  end if;
  if v_won then
    insert into public.user_crate_inventory(user_id, item_id, variant, quantity)
      values(p_user_id, p_target_item_id, p_target_variant, 1)
      on conflict(user_id, item_id, variant)
      do update set quantity = public.user_crate_inventory.quantity + 1;
  end if;
  -- A failure anywhere, including the receipt, rolls back the entire attempt.
  insert into public.crate_item_upgrades(user_id, request_id, from_item_id, from_variant,
    from_sell_value, to_crate_type, to_rarity, target_item_id, target_variant, target_sell_value,
    win_chance_percent, roll_fraction, won, to_item_id, to_variant)
  values(p_user_id, p_request_id, p_from_item_id, p_from_variant, p_from_value,
    p_target_crate, p_target_rarity, p_target_item_id, p_target_variant, p_target_value,
    v_chance * 100, p_roll, v_won,
    case when v_won then p_target_item_id end, case when v_won then p_target_variant end);
  return jsonb_build_object('success', true, 'won', v_won, 'chancePercent', v_chance * 100,
    'rollFraction', p_roll, 'rewardItemId', case when v_won then p_target_item_id end,
    'rewardVariant', case when v_won then p_target_variant end);
end;
$$;
revoke all on function public.execute_crate_upgrade(uuid, uuid, text, text, integer, text, text, integer, text, text, numeric)
  from public, anon, authenticated;
grant execute on function public.execute_crate_upgrade(uuid, uuid, text, text, integer, text, text, integer, text, text, numeric)
  to service_role;

-- Normal opens share this inventory with Duels and Upgrade. Absolute quantity
-- snapshots must not overwrite a payout made by another flow while opening.
create or replace function public.commit_crate_open(
  p_user_id uuid, p_crate_type text, p_expected_coins integer,
  p_expected_pity integer, p_next_pity integer, p_cost integer, p_items jsonb, p_metadata jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_coins integer; v_pity integer; v_item jsonb; v_round integer := 0;
  v_free_count integer; v_paid_count integer; v_day timestamptz;
begin
  if p_cost is null or p_cost < 0 or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 5
    or p_next_pity is null or p_next_pity < 0 then
    return jsonb_build_object('error', 'invalid_open');
  end if;
  select coins, coalesce(principessa_case_bad_luck_count, 0) into v_coins, v_pity
    from public.profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('error', 'profile_not_found'); end if;
  if v_coins is distinct from p_expected_coins or v_pity is distinct from p_expected_pity then
    return jsonb_build_object('error', 'stale_profile');
  end if;
  if v_coins < p_cost then return jsonb_build_object('error', 'insufficient_coins'); end if;
  v_day := date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul';
  if coalesce((p_metadata ->> 'free_open_applied')::boolean, false) and exists(
    select 1 from public.crate_opens where user_id = p_user_id and crate_type = p_crate_type
      and cost = 0 and opened_at >= v_day and opened_at < v_day + interval '1 day'
  ) then return jsonb_build_object('error', 'free_open_used'); end if;
  v_free_count := coalesce((p_metadata ->> 'community_goal_keys_used')::integer, 0)
    + case when coalesce((p_metadata ->> 'free_open_applied')::boolean, false) then 1 else 0 end;
  v_paid_count := jsonb_array_length(p_items) - v_free_count;
  if v_free_count < 0 or v_paid_count < 0 or (v_paid_count = 0 and p_cost <> 0) then
    return jsonb_build_object('error', 'invalid_open');
  end if;

  update public.profiles set coins = v_coins - p_cost,
    principessa_case_bad_luck_count = p_next_pity, updated_at = now() where id = p_user_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_round := v_round + 1;
    insert into public.user_crate_inventory(user_id, item_id, variant, quantity)
      values(p_user_id, v_item ->> 'itemId', coalesce(v_item ->> 'variant', 'normal'), 1)
      on conflict(user_id, item_id, variant) do update set quantity =
        case when excluded.item_id = 'classic' then 1 else public.user_crate_inventory.quantity + 1 end;
    insert into public.crate_opens(user_id, crate_type, item_id, variant, cost, received_sell_value)
      values(p_user_id, p_crate_type, v_item ->> 'itemId', coalesce(v_item ->> 'variant', 'normal'),
        case when v_round <= v_free_count then 0 else p_cost / greatest(1, v_paid_count) end,
        (v_item ->> 'sellValue')::integer);
  end loop;
  insert into public.coin_transactions(user_id, amount, balance_before, balance_after, reason, metadata)
    values(p_user_id, -p_cost, v_coins, v_coins - p_cost, 'crate:open', p_metadata);
  return jsonb_build_object('success', true, 'coins', v_coins - p_cost);
end;
$$;
revoke all on function public.commit_crate_open(uuid, text, integer, integer, integer, integer, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_crate_open(uuid, text, integer, integer, integer, integer, jsonb, jsonb)
  to service_role;

-- Audit each real opening under its opener, including a losing player's haul.
-- Publish at unseal time, never while a challenge remains open. The unique key
-- makes backfill and repeated trigger execution harmless.
alter table public.crate_opens
  add column if not exists source_duel_id uuid,
  add column if not exists source_duel_round integer;
create unique index if not exists crate_opens_duel_round_idx
  on public.crate_opens(source_duel_id, user_id, source_duel_round)
  where source_duel_id is not null;

create or replace function public.publish_crate_duel_openings(p_duel_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.crate_opens(user_id, crate_type, item_id, variant, cost,
    received_sell_value, opened_at, source_duel_id, source_duel_round)
  select s.user_id, coalesce(d.crates ->> (x.n::integer - 1), d.crate_type),
    x.item ->> 'itemId', coalesce(x.item ->> 'variant', 'normal'), ct.cost,
    (x.item ->> 'sellValue')::integer, coalesce(d.accepted_at, d.created_at), d.id, x.n::integer
  from public.crate_duels d
  cross join lateral (values(d.challenger_id, d.challenger_items), (d.opponent_id, d.opponent_items)) s(user_id, items)
  cross join lateral jsonb_array_elements(coalesce(s.items, '[]'::jsonb)) with ordinality x(item, n)
  left join public.crate_types ct on ct.crate_type = coalesce(d.crates ->> (x.n::integer - 1), d.crate_type)
  where d.id = p_duel_id and d.status in ('revealed', 'cancelled') and s.user_id is not null
  on conflict(source_duel_id, user_id, source_duel_round) where source_duel_id is not null do nothing;
$$;
create or replace function public.on_crate_duel_unsealed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.publish_crate_duel_openings(new.id);
  return new;
end;
$$;
drop trigger if exists crate_duel_publish_openings on public.crate_duels;
create trigger crate_duel_publish_openings after update of status on public.crate_duels
  for each row when (old.status is distinct from new.status and new.status in ('revealed', 'cancelled'))
  execute function public.on_crate_duel_unsealed();
revoke all on function public.publish_crate_duel_openings(uuid) from public, anon, authenticated;
revoke all on function public.on_crate_duel_unsealed() from public, anon, authenticated;
grant execute on function public.publish_crate_duel_openings(uuid) to service_role;

-- Include previously completed duels without changing balances or inventory.
do $$ declare v_id uuid; begin
  for v_id in select id from public.crate_duels where status in ('revealed', 'cancelled') loop
    perform public.publish_crate_duel_openings(v_id);
  end loop;
end; $$;

-- One bounded lobby read, with separate quotas for discovery, public history,
-- and the caller's own open/unwatched duels (which must not disappear behind
-- unrelated activity). Open rows never transport their sealed items/totals.
create or replace function public.expire_stale_crate_duels(p_limit integer default 10)
returns integer language plpgsql security definer set search_path = public as $$
declare v_row record; v_count integer := 0;
begin
  for v_row in select id, challenger_id, challenger_items from public.crate_duels
    where status = 'open' and expires_at <= now() order by expires_at
    limit greatest(1, least(coalesce(p_limit, 10), 50)) for update skip locked
  loop
    perform public.grant_crate_duel_items(v_row.challenger_id, v_row.challenger_items);
    update public.crate_duels set status = 'cancelled' where id = v_row.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.expire_stale_crate_duels(integer) from public, anon, authenticated;
grant execute on function public.expire_stale_crate_duels(integer) to service_role;

create or replace function public.get_crate_duel_lobby(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  if exists(select 1 from public.crate_duels where status = 'open' and expires_at <= now()) then
    perform public.expire_stale_crate_duels(20);
  end if;
  with selected as (
    (select id from public.crate_duels where status = 'open' and expires_at > now()
      order by created_at desc limit 30)
    union
    (select id from public.crate_duels where status = 'revealed'
      order by accepted_at desc nulls last limit 6)
    union
    (select id from public.crate_duels where status = 'open' and challenger_id = p_user_id
      and expires_at > now() order by created_at desc limit 1)
    union
    (select id from public.crate_duels where status = 'revealed' and
      ((challenger_id = p_user_id and challenger_seen_at is null)
      or (opponent_id = p_user_id and opponent_seen_at is null))
      order by accepted_at desc limit 20)
  )
  select coalesce(jsonb_agg(case when d.status = 'open' then
      to_jsonb(d) - 'challenger_items' - 'opponent_items' - 'challenger_total_value' - 'opponent_total_value'
    else to_jsonb(d) end order by coalesce(d.accepted_at, d.created_at) desc), '[]'::jsonb)
    into v_result from public.crate_duels d join selected s on s.id = d.id;
  return v_result;
end;
$$;
revoke all on function public.get_crate_duel_lobby(uuid) from public, anon, authenticated;
grant execute on function public.get_crate_duel_lobby(uuid) to service_role;
create index if not exists crate_duels_revealed_idx on public.crate_duels(accepted_at desc) where status = 'revealed';
create index if not exists crate_duels_unwatched_challenger_idx on public.crate_duels(challenger_id, accepted_at desc)
  where status = 'revealed' and challenger_seen_at is null;
create index if not exists crate_duels_unwatched_opponent_idx on public.crate_duels(opponent_id, accepted_at desc)
  where status = 'revealed' and opponent_seen_at is null;

notify pgrst, 'reload schema';
