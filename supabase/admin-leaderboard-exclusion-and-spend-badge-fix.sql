-- Run once in the Supabase SQL editor.
-- It repairs Shrine spending in historical badge totals and keeps admin accounts
-- out of every leaderboard that respects hide_from_leaderboard.

create or replace function public.apply_lifetime_spent_coins_from_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.amount >= 0 or new.reason not in (
    'jackpot_contribution',
    'spend:cosmetic',
    'spend:gallery-unlock',
    'spend:irl-task-wheel',
    'spend:rights',
    'spend:title',
    'spend:pet-weekly-tax',
    'spend:timeout-clear',
    'crate:open',
    'tribute:coin-offer',
    'tribute:shrine',
    'tribute:sacrifice',
    'tribute:support',
    'tribute:debt-contract',
    'tribute:debt-contract:auto',
    'tribute:debt-contract:missed'
  ) then
    return new;
  end if;

  update public.profiles
  set lifetime_spent_coins = least(2147483647, greatest(0, coalesce(lifetime_spent_coins, 0) + abs(new.amount))),
      updated_at = now()
  where id = new.user_id;

  return new;
end;
$$;

drop trigger if exists apply_lifetime_spent_coins_from_transaction_trigger on public.coin_transactions;
create trigger apply_lifetime_spent_coins_from_transaction_trigger
  after insert on public.coin_transactions
  for each row execute function public.apply_lifetime_spent_coins_from_transaction();

-- Rebuild the historical total so earned badges immediately reflect Shrine spend.
update public.profiles profile
set lifetime_spent_coins = least(
      2147483647,
      coalesce((
        select sum(abs(tx.amount))::bigint
        from public.coin_transactions tx
        where tx.user_id = profile.id
          and tx.amount < 0
          and tx.reason in (
            'jackpot_contribution', 'spend:cosmetic', 'spend:gallery-unlock',
            'spend:irl-task-wheel', 'spend:rights', 'spend:title',
            'spend:pet-weekly-tax', 'spend:timeout-clear', 'crate:open',
            'tribute:coin-offer', 'tribute:shrine', 'tribute:sacrifice',
            'tribute:support', 'tribute:debt-contract',
            'tribute:debt-contract:auto', 'tribute:debt-contract:missed'
          )
      ), 0)
    ),
    updated_at = now();

create or replace function public.force_admin_leaderboard_hide()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_admin, false) then
    new.hide_from_leaderboard := true;
  end if;
  return new;
end;
$$;

drop trigger if exists force_admin_leaderboard_hide_trigger on public.profiles;
create trigger force_admin_leaderboard_hide_trigger
  before insert or update on public.profiles
  for each row execute function public.force_admin_leaderboard_hide();

update public.profiles
set hide_from_leaderboard = true,
    updated_at = now()
where coalesce(is_admin, false) = true
  and hide_from_leaderboard = false;

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
    and p.last_loyalty_at >= (now() - interval '48 hours')
    and coalesce(p.is_admin, false) = false
    and not (p.id = any(coalesce(p_excluded_user_ids, array[]::uuid[])));
$$;

grant execute on function public.get_jackpot_eligible_count(uuid[]) to anon, authenticated;

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
  select ct.user_id, sum(ct.amount)::bigint, max(ct.created_at)
  from public.coin_transactions ct
  join public.profiles p on p.id = ct.user_id
  where ct.amount > 0
    and public.is_public_throne_tribute_transaction(ct.reason, ct.metadata)
    and coalesce(p.hide_from_leaderboard, false) = false
    and coalesce(p.is_admin, false) = false
  group by ct.user_id
  order by sum(ct.amount) desc, max(ct.created_at) desc
  limit greatest(1, least(coalesce(p_limit, 3), 10));
$$;

grant execute on function public.get_public_top_tributors(integer) to anon, authenticated;
