-- Aggressive data retention and inactive-account deletion support.
-- Run once in the Supabase SQL editor before enabling the Vercel cron route.

create table if not exists public.data_retention_audit (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.deleted_user_financial_archive (
  id uuid primary key default gen_random_uuid(),
  deleted_user_id uuid not null unique,
  username_snapshot text,
  profile_snapshot jsonb not null default '{}'::jsonb,
  coin_transactions jsonb not null default '[]'::jsonb,
  devotion_events jsonb not null default '[]'::jsonb,
  debt_contracts jsonb not null default '[]'::jsonb,
  admin_pet_task_logs jsonb not null default '[]'::jsonb,
  storage_paths jsonb not null default '[]'::jsonb,
  deletion_status text not null default 'archived',
  deletion_error text,
  archived_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.data_retention_audit enable row level security;
alter table public.deleted_user_financial_archive enable row level security;
revoke all on public.data_retention_audit from anon, authenticated;
revoke all on public.deleted_user_financial_archive from anon, authenticated;

create index if not exists coin_transactions_user_reason_idx on public.coin_transactions(user_id, reason);
create index if not exists coin_transactions_created_at_idx on public.coin_transactions(created_at desc);
create index if not exists profiles_inactive_cleanup_idx on public.profiles(last_login_at, created_at, tribute_total) where not is_admin;
create index if not exists profiles_inactive_cleanup_effective_idx
  on public.profiles ((coalesce(last_login_at, created_at)), tribute_total)
  where not coalesce(is_admin, false);
create index if not exists admin_pet_task_logs_pending_action_id_idx on public.admin_pet_task_logs(pending_action_id);
create index if not exists admin_pet_task_logs_transaction_ids_gin_idx
  on public.admin_pet_task_logs using gin(transaction_ids jsonb_path_ops);
create index if not exists pending_admin_actions_retention_idx on public.pending_admin_actions(status, expires_at, created_at);
create index if not exists puzzle_attempts_completed_retention_idx on public.puzzle_attempts(completed_at) where status = 'completed';
create index if not exists user_notifications_retention_idx on public.user_notifications(created_at) where read_at is not null or deleted_at is not null;

create or replace function public.run_data_retention()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  live_chat_count integer := 0;
  notification_count integer := 0;
  pending_action_count integer := 0;
  puzzle_count integer := 0;
  fail_event_count integer := 0;
  result jsonb;
begin
  delete from public.live_chat_messages
  where created_at < now() - interval '7 days';
  get diagnostics live_chat_count = row_count;

  delete from public.user_notifications
  where (read_at is not null or deleted_at is not null)
    and greatest(created_at, coalesce(read_at, created_at), coalesce(deleted_at, created_at)) < now() - interval '14 days';
  get diagnostics notification_count = row_count;

  delete from public.pending_admin_actions
  where (expires_at < now() - interval '30 days')
     or (status <> 'pending' and created_at < now() - interval '30 days');
  get diagnostics pending_action_count = row_count;

  delete from public.puzzle_attempts
  where status = 'completed'
    and coalesce(completed_at, created_at) < now() - interval '30 days';
  get diagnostics puzzle_count = row_count;

  delete from public.irl_task_fail_events
  where failed_at < now() - interval '30 days';
  get diagnostics fail_event_count = row_count;

  result := jsonb_build_object(
    'liveChatMessages', live_chat_count,
    'userNotifications', notification_count,
    'pendingAdminActions', pending_action_count,
    'puzzleAttempts', puzzle_count,
    'irlTaskFailEvents', fail_event_count
  );

  insert into public.data_retention_audit (run_type, details)
  values ('retention', result);
  return result;
end;
$$;

-- Explicit purchaseType metadata is authoritative for new rows. For legacy rows,
-- old positive throne grants are protected conservatively unless they carry a
-- known pet-task marker. Legacy live_gift rows must contain purchase metadata.
create or replace function public.is_real_money_coin_purchase(
  p_reason text,
  p_amount integer,
  p_metadata jsonb
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_amount, 0) > 0
    and (
      coalesce(p_metadata ->> 'purchaseType', '') = 'real_money'
      or (
        coalesce(p_metadata ->> 'purchaseType', '') <> 'reward'
        and not (coalesce(p_metadata, '{}'::jsonb) ? 'petTaskId')
        and coalesce(p_metadata ->> 'source', '') not in (
          'pet_throne_task',
          'pet_task_admin_approval',
          'mobile_pet_task_admin_approval'
        )
        and (
          p_reason = 'throne_tribute'
          or (
            p_reason = 'live_gift'
            and (
              p_metadata ->> 'command' = 'give'
              or p_metadata ->> 'kind' = 'manual_coin_purchase'
              or p_metadata ->> 'source' = 'throne'
            )
          )
        )
      )
    );
$$;

create or replace function public.get_inactive_user_deletion_batch(p_limit integer default 25)
returns table (
  user_id uuid,
  username text,
  tribute_total integer,
  inactive_since timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    coalesce(p.tribute_total, 0),
    coalesce(p.last_login_at, p.created_at)
  from public.profiles p
  where not coalesce(p.is_admin, false)
    and coalesce(p.last_login_at, p.created_at) < now() -
      case when coalesce(p.tribute_total, 0) >= 5000 then interval '90 days' else interval '30 days' end
    and not exists (
      select 1
      from public.coin_transactions ct
      where ct.user_id = p.id
        and public.is_real_money_coin_purchase(ct.reason, ct.amount, ct.metadata)
        and not exists (
          select 1
          from public.admin_pet_task_logs task_log
          where task_log.pending_action_id::text = ct.metadata ->> 'pendingActionId'
             or task_log.transaction_ids @> jsonb_build_array(ct.id::text)
        )
    )
  order by coalesce(p.last_login_at, p.created_at) asc
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

create or replace function public.is_inactive_user_deletion_eligible(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and not coalesce(p.is_admin, false)
      and coalesce(p.last_login_at, p.created_at) < now() -
        case when coalesce(p.tribute_total, 0) >= 5000 then interval '90 days' else interval '30 days' end
      and not exists (
        select 1
        from public.coin_transactions ct
        where ct.user_id = p.id
          and public.is_real_money_coin_purchase(ct.reason, ct.amount, ct.metadata)
          and not exists (
            select 1
            from public.admin_pet_task_logs task_log
            where task_log.pending_action_id::text = ct.metadata ->> 'pendingActionId'
               or task_log.transaction_ids @> jsonb_build_array(ct.id::text)
          )
      )
  );
$$;

create or replace function public.archive_inactive_user_data(p_user_id uuid, p_storage_paths jsonb default '[]'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.deleted_user_financial_archive (
    deleted_user_id,
    username_snapshot,
    profile_snapshot,
    coin_transactions,
    devotion_events,
    debt_contracts,
    admin_pet_task_logs,
    storage_paths
  )
  select
    p.id,
    p.username,
    to_jsonb(p),
    coalesce((select jsonb_agg(to_jsonb(ct) order by ct.created_at) from public.coin_transactions ct where ct.user_id = p.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(de) order by de.created_at) from public.devotion_events de where de.user_id = p.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(dc) order by dc.created_at) from public.pet_debt_contracts dc where dc.user_id = p.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(al) order by al.created_at) from public.admin_pet_task_logs al where al.user_id = p.id), '[]'::jsonb),
    coalesce(p_storage_paths, '[]'::jsonb)
  from public.profiles p
  where p.id = p_user_id
  on conflict (deleted_user_id) do update set
    username_snapshot = excluded.username_snapshot,
    profile_snapshot = excluded.profile_snapshot,
    coin_transactions = excluded.coin_transactions,
    devotion_events = excluded.devotion_events,
    debt_contracts = excluded.debt_contracts,
    admin_pet_task_logs = excluded.admin_pet_task_logs,
    storage_paths = excluded.storage_paths,
    deletion_status = 'archived',
    deletion_error = null,
    archived_at = now();
end;
$$;

create or replace function public.mark_inactive_user_deletion_result(p_user_id uuid, p_success boolean, p_error text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.deleted_user_financial_archive
  set deletion_status = case when p_success then 'deleted' else 'failed' end,
      deletion_error = p_error,
      deleted_at = case when p_success then now() else null end
  where deleted_user_id = p_user_id;
$$;

alter table public.principessa_posts drop constraint if exists principessa_posts_author_id_fkey;
alter table public.principessa_posts
  add constraint principessa_posts_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete cascade;

alter table public.live_chat_messages drop constraint if exists live_chat_messages_deleted_by_fkey;
alter table public.live_chat_messages
  add constraint live_chat_messages_deleted_by_fkey
  foreign key (deleted_by) references auth.users(id) on delete set null;
alter table public.live_chat_mutes drop constraint if exists live_chat_mutes_muted_by_fkey;
alter table public.live_chat_mutes
  add constraint live_chat_mutes_muted_by_fkey
  foreign key (muted_by) references auth.users(id) on delete set null;

create or replace function public.get_admin_analytics_rollup(p_today_start timestamptz, p_today_end timestamptz)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'totalProfiles', (select count(*) from public.profiles),
    'totalCoinsInCirculation', (select coalesce(sum(coins), 0) from public.profiles),
    'averageCoins', (select coalesce(round(avg(coins)), 0) from public.profiles),
    'ownerLikenessWarnings', (select count(*) from public.profiles where owner_likeness <= 25),
    'newToday', (select count(*) from public.profiles where created_at >= p_today_start and created_at < p_today_end),
    'activeToday', (select count(*) from public.profiles where last_login_at >= p_today_start and last_login_at < p_today_end),
    'activeDebtContracts', (select count(*) from public.pet_debt_contracts where status = 'active'),
    'missedDebtPeriods', (select coalesce(sum(missed_periods), 0) from public.pet_debt_contracts),
    'todayCoinsEarned', (select coalesce(sum(greatest(amount, 0)), 0) from public.coin_transactions where created_at >= p_today_start and created_at < p_today_end),
    'todayCoinsSpent', (select coalesce(sum(abs(least(amount, 0))), 0) from public.coin_transactions where created_at >= p_today_start and created_at < p_today_end),
    'todayTributeReceived', (select coalesce(sum(case when amount < 0 then abs(amount) else amount end), 0) from public.coin_transactions where created_at >= p_today_start and created_at < p_today_end and (reason = 'tribute' or reason like 'tribute:%')),
    'affectionBuckets', jsonb_build_array(
      jsonb_build_object('label', '0-24', 'count', (select count(*) from public.profiles where affection between 0 and 24)),
      jsonb_build_object('label', '25-49', 'count', (select count(*) from public.profiles where affection between 25 and 49)),
      jsonb_build_object('label', '50-74', 'count', (select count(*) from public.profiles where affection between 50 and 74)),
      jsonb_build_object('label', '75-99', 'count', (select count(*) from public.profiles where affection between 75 and 99)),
      jsonb_build_object('label', '100', 'count', (select count(*) from public.profiles where affection >= 100))
    )
  );
$$;

create or replace function public.get_admin_top_inventory_user_ids(p_limit integer default 20)
returns table (user_id uuid, inventory_value bigint)
language sql
security definer
set search_path = public
as $$
  select uci.user_id, sum(uci.quantity::bigint * coalesce(ci.sell_value, 0)::bigint) as inventory_value
  from public.user_crate_inventory uci
  join public.crate_items ci on ci.item_id = uci.item_id
  group by uci.user_id
  having sum(uci.quantity::bigint * coalesce(ci.sell_value, 0)::bigint) > 0
  order by inventory_value desc, uci.user_id
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

create or replace function public.get_admin_task_usage()
returns table (task_id text, usage_count bigint)
language sql
security definer
set search_path = public
as $$
  select combined.task_id, count(*)::bigint
  from (
    select ut.task_id from public.user_tasks ut where ut.completed_at is not null or ut.claimed_at is not null
    union all
    select 'pet:' || upt.task_id from public.user_pet_tasks upt where upt.completed_at is not null or upt.reviewed_at is not null
    union all
    select 'irl:' || uit.task_label from public.user_irl_tasks uit where uit.completed_at is not null or uit.reviewed_at is not null
  ) combined
  group by combined.task_id
  order by count(*) desc, combined.task_id;
$$;

create or replace function public.get_admin_gallery_counts()
returns table (item_key text, unlock_count bigint)
language sql
security definer
set search_path = public
as $$
  select ug.item_id, count(*)::bigint from public.user_gallery ug group by ug.item_id
  union all
  select 'pet:' || upg.item_id, count(*)::bigint from public.user_pet_gallery upg group by upg.item_id;
$$;

create or replace function public.get_admin_coin_daily(p_start timestamptz, p_end timestamptz)
returns table (day text, earned bigint, spent bigint, tribute bigint)
language sql
security definer
set search_path = public
as $$
  select
    ((ct.created_at + interval '3 hours')::date)::text,
    coalesce(sum(greatest(ct.amount, 0)), 0)::bigint,
    coalesce(sum(abs(least(ct.amount, 0))), 0)::bigint,
    coalesce(sum(case when ct.reason = 'tribute' or ct.reason like 'tribute:%' then case when ct.amount < 0 then abs(ct.amount) else ct.amount end else 0 end), 0)::bigint
  from public.coin_transactions ct
  where ct.created_at >= p_start and ct.created_at < p_end
  group by (ct.created_at + interval '3 hours')::date
  order by (ct.created_at + interval '3 hours')::date;
$$;

revoke all on function public.run_data_retention() from public, anon, authenticated;
revoke all on function public.is_real_money_coin_purchase(text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.get_inactive_user_deletion_batch(integer) from public, anon, authenticated;
revoke all on function public.is_inactive_user_deletion_eligible(uuid) from public, anon, authenticated;
revoke all on function public.archive_inactive_user_data(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.mark_inactive_user_deletion_result(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.get_admin_analytics_rollup(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.get_admin_top_inventory_user_ids(integer) from public, anon, authenticated;
revoke all on function public.get_admin_task_usage() from public, anon, authenticated;
revoke all on function public.get_admin_gallery_counts() from public, anon, authenticated;
revoke all on function public.get_admin_coin_daily(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.run_data_retention() to service_role;
grant execute on function public.is_real_money_coin_purchase(text, integer, jsonb) to service_role;
grant execute on function public.get_inactive_user_deletion_batch(integer) to service_role;
grant execute on function public.is_inactive_user_deletion_eligible(uuid) to service_role;
grant execute on function public.archive_inactive_user_data(uuid, jsonb) to service_role;
grant execute on function public.mark_inactive_user_deletion_result(uuid, boolean, text) to service_role;
grant execute on function public.get_admin_analytics_rollup(timestamptz, timestamptz) to service_role;
grant execute on function public.get_admin_top_inventory_user_ids(integer) to service_role;
grant execute on function public.get_admin_task_usage() to service_role;
grant execute on function public.get_admin_gallery_counts() to service_role;
grant execute on function public.get_admin_coin_daily(timestamptz, timestamptz) to service_role;
