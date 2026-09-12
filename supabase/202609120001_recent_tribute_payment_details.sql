-- Run on the shared Supabase project before deploying the Recent Tributes UI.
-- Requires the existing recent-tributes-money.sql functions and money ledger.
-- Read-only presentation change: no balance, attribution, ranking or goal edits.
begin;

-- Keep the original public feed contract for existing consumers. Its amount
-- is the bonus-free payment base, not the spendable PM a user keeps. Enrich
-- only those already-public rows with the completed No PM reclaim status.
create or replace function public.get_public_recent_tribute_payments(p_limit integer default 10)
returns table (
  id uuid,
  user_id uuid,
  amount integer,
  created_at timestamptz,
  no_pm boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    tribute.id,
    tribute.user_id,
    tribute.amount,
    tribute.created_at,
    exists (
      select 1
      from public.money_transactions credit
      join public.money_transactions reclaim
        on reclaim.user_id = credit.user_id
       and reclaim.source_key = 'throne-reclaim:' || substr(credit.source_key, 8)
       and reclaim.reason = 'adjust:tribute-no-money'
       and reclaim.amount = -credit.amount
      where credit.id = tribute.id
        and credit.user_id = tribute.user_id
        and credit.reason = 'throne_tribute'
        and credit.amount > 0
        and credit.source_key like 'throne:%'
    ) as no_pm
  from public.get_public_recent_tribute_transactions(p_limit) tribute
  order by tribute.created_at desc;
$$;

revoke all on function public.get_public_recent_tribute_payments(integer) from public;
grant execute on function public.get_public_recent_tribute_payments(integer) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
commit;
