-- All-time "Most Drained Subs" leaderboard for the Drain Session feature.
-- Sums every drain:session coin_transactions row per user (already the
-- authoritative spend ledger written by /api/user/drain-session), excludes
-- admins, same posture as every other leaderboard in this project.

-- Without this, the aggregate below scans the whole coin_transactions ledger.
-- The existing coin_transactions_user_reason_idx is (user_id, reason), which
-- cannot serve a "where reason = X group by user_id" lookup efficiently. This
-- partial index covers exactly the rows this leaderboard reads and stays tiny
-- regardless of how large the rest of the ledger grows.
create index if not exists coin_transactions_drain_session_idx
  on public.coin_transactions (user_id)
  include (amount)
  where reason = 'drain:session';

create or replace function public.get_drain_session_leaderboard(p_limit integer default 3)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_leaders jsonb;
  v_limit integer := greatest(1, least(coalesce(p_limit, 3), 50));
begin
  with totals as (
    select ct.user_id, sum(-ct.amount) as drained
    from public.coin_transactions ct
    join public.profiles p on p.id = ct.user_id
    where ct.reason = 'drain:session' and not coalesce(p.is_admin, false)
    group by ct.user_id
  ),
  ranked as (
    select
      t.user_id,
      t.drained,
      p.username,
      p.display_name,
      row_number() over (order by t.drained desc, t.user_id asc) as rnk
    from totals t
    join public.profiles p on p.id = t.user_id
  )
  select jsonb_agg(
    jsonb_build_object(
      'rank', rnk,
      'userId', user_id,
      'username', username,
      'displayName', display_name,
      'drained', drained
    ) order by rnk
  )
  from ranked
  where rnk <= v_limit
  into v_leaders;

  return coalesce(v_leaders, '[]'::jsonb);
end;
$$;

revoke all on function public.get_drain_session_leaderboard(integer) from public, anon, authenticated;
grant execute on function public.get_drain_session_leaderboard(integer) to service_role;
