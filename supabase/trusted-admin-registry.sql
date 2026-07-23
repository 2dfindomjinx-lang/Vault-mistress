-- Run before deploying the trusted_admin_accounts code path.
-- Only the service-role client can write this table. The application syncs it
-- from ADMIN_USER_IDS; profiles.is_admin is deliberately not consulted.

create table if not exists public.trusted_admin_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.trusted_admin_accounts enable row level security;

create or replace function public.apply_admin_coin_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  commission_total integer := 0;
  recipient_count integer := 0;
  base_share integer := 0;
  remainder integer := 0;
  recipient_index integer := 0;
  share integer := 0;
  recipient record;
begin
  if tg_op = 'INSERT' then
    if new.amount >= 0 or coalesce(new.reason, '') = 'admin_commission' then
      return new;
    end if;

    if exists (select 1 from public.trusted_admin_accounts where user_id = new.user_id) then
      return new;
    end if;

    commission_total := floor(abs(new.amount) * 0.10)::integer;
    if commission_total <= 0 then
      return new;
    end if;

    select count(*) into recipient_count
    from public.trusted_admin_accounts
    where user_id <> new.user_id;

    if recipient_count <= 0 then
      return new;
    end if;

    base_share := commission_total / recipient_count;
    remainder := commission_total % recipient_count;

    for recipient in
      select account.user_id as id, profile.coins
      from public.trusted_admin_accounts account
      join public.profiles profile on profile.id = account.user_id
      where account.user_id <> new.user_id
      order by account.user_id
    loop
      recipient_index := recipient_index + 1;
      share := base_share + case when recipient_index <= remainder then 1 else 0 end;
      if share <= 0 then continue; end if;

      update public.profiles
      set coins = coalesce(coins, 0) + share, updated_at = now()
      where id = recipient.id;

      insert into public.coin_transactions (
        user_id, admin_user_id, amount, reason, balance_before, balance_after, metadata
      ) values (
        recipient.id, recipient.id, share, 'admin_commission', recipient.coins, recipient.coins + share,
        jsonb_build_object(
          'sourceTransactionId', new.id,
          'sourceUserId', new.user_id,
          'sourceReason', coalesce(new.reason, ''),
          'commissionTotal', commission_total,
          'commissionShare', share,
          'recipientCount', recipient_count
        )
      );
    end loop;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.amount >= 0 or coalesce(old.reason, '') = 'admin_commission' then return old; end if;
    with commission_totals as (
      select user_id, sum(amount)::integer as total_amount
      from public.coin_transactions
      where reason = 'admin_commission' and coalesce(metadata->>'sourceTransactionId', '') = old.id::text
      group by user_id
    )
    update public.profiles profile
    set coins = coalesce(profile.coins, 0) - commission_totals.total_amount, updated_at = now()
    from commission_totals where profile.id = commission_totals.user_id;

    delete from public.coin_transactions
    where reason = 'admin_commission' and coalesce(metadata->>'sourceTransactionId', '') = old.id::text;
    return old;
  end if;

  return null;
end;
$$;
