-- Read-only preview for the inactive-account cleanup policy.
with paid_protected as (
  select distinct ct.user_id
  from public.coin_transactions ct
  where public.is_real_money_coin_purchase(ct.reason, ct.amount, ct.metadata)
    and not exists (
      select 1
      from public.admin_pet_task_logs task_log
      where task_log.pending_action_id::text = ct.metadata ->> 'pendingActionId'
         or task_log.transaction_ids @> jsonb_build_array(ct.id::text)
    )
), summary as (
  select
    count(*) as total_profiles,
    count(*) filter (where coalesce(p.is_admin, false)) as admin_profiles,
    count(*) filter (
      where not coalesce(p.is_admin, false)
        and coalesce(p.last_login_at, p.created_at) < now() -
          case when coalesce(p.tribute_total, 0) >= 5000 then interval '90 days' else interval '30 days' end
    ) as inactive_by_age,
    count(*) filter (where paid_protected.user_id is not null) as paid_purchase_protected,
    count(*) filter (where public.is_inactive_user_deletion_eligible(p.id)) as deletion_eligible
  from public.profiles p
  left join paid_protected on paid_protected.user_id = p.id
), oldest_candidates as (
  select user_id, username, tribute_total, inactive_since
  from public.get_inactive_user_deletion_batch(20)
)
select jsonb_build_object(
  'summary', (select to_jsonb(summary) from summary),
  'oldestCandidates', coalesce((select jsonb_agg(to_jsonb(oldest_candidates)) from oldest_candidates), '[]'::jsonb)
) as retention_dry_run;
