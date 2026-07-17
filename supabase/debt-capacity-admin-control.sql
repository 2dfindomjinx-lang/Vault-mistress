-- Debt affordability, manual-review, and one-time amnesty support.
-- Apply this migration before deploying the matching application code.

alter table public.pet_debt_contracts
  add column if not exists purchase_pledge boolean not null default false,
  add column if not exists capacity_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists admin_review_required boolean not null default false,
  add column if not exists overdue_since timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists close_reason text,
  add column if not exists closed_by_admin_id uuid references auth.users(id) on delete set null;

create index if not exists pet_debt_contracts_admin_review_idx
  on public.pet_debt_contracts (admin_review_required, created_at desc)
  where admin_review_required = true;

create table if not exists public.debt_admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  contract_id uuid,
  debt_kind text not null check (debt_kind in ('pet', 'throne', 'all')),
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists debt_admin_actions_created_at_idx
  on public.debt_admin_actions (created_at desc);

create unique index if not exists debt_admin_actions_single_amnesty_idx
  on public.debt_admin_actions (action)
  where action = 'amnesty_all';

alter table public.debt_admin_actions enable row level security;

revoke all on public.debt_admin_actions from anon, authenticated;
grant all on public.debt_admin_actions to service_role;

create or replace function public.admin_forgive_all_debts(
  p_admin_user_id uuid,
  p_reason text default '2026 debt amnesty'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pet_count integer := 0;
  throne_count integer := 0;
  timeout_count integer := 0;
  now_value timestamptz := now();
begin
  if exists (
    select 1
    from public.debt_admin_actions
    where action = 'amnesty_all'
  ) then
    raise exception 'Debt Amnesty has already been completed.'
      using errcode = 'P0001';
  end if;

  delete from public.evil_debt_contract_images
  where contract_id in (
    select id
    from public.pet_debt_contracts
    where status in ('active', 'pending', 'expired')
  );

  update public.pet_debt_contracts
  set
    admin_review_required = false,
    closed_at = now_value,
    closed_by_admin_id = p_admin_user_id,
    close_reason = coalesce(nullif(trim(p_reason), ''), '2026 debt amnesty'),
    current_installment_remaining = 0,
    status = 'forgiven',
    updated_at = now_value
  where status in ('active', 'pending', 'expired');
  get diagnostics pet_count = row_count;

  update public.throne_debt_payment_reviews
  set
    admin_note = coalesce(nullif(trim(p_reason), ''), '2026 debt amnesty'),
    reviewed_at = now_value,
    reviewed_by_admin_id = p_admin_user_id,
    status = 'rejected',
    updated_at = now_value
  where status = 'pending'
    and debt_id in (
      select id
      from public.throne_debts
      where status in ('pending_review', 'active', 'overdue', 'timeout', 'paused', 'defaulted')
    );

  update public.throne_debts
  set
    admin_note = concat_ws(
      E'\n',
      nullif(admin_note, ''),
      coalesce(nullif(trim(p_reason), ''), '2026 debt amnesty') || ' - closed without refund or penalty.'
    ),
    status = 'cancelled',
    updated_at = now_value
  where status in ('pending_review', 'active', 'overdue', 'timeout', 'paused', 'defaulted');
  get diagnostics throne_count = row_count;

  update public.profiles
  set
    timeout_reason = null,
    timeout_until = null,
    updated_at = now_value
  where timeout_reason = 'debt_contract_overdue'
    or timeout_reason = 'evil_debt_underage'
    or timeout_reason like 'throne_debt_timeout:%';
  get diagnostics timeout_count = row_count;

  insert into public.debt_admin_actions (
    admin_user_id,
    debt_kind,
    action,
    reason,
    metadata
  )
  values (
    p_admin_user_id,
    'all',
    'amnesty_all',
    coalesce(nullif(trim(p_reason), ''), '2026 debt amnesty'),
    jsonb_build_object(
      'petContractsClosed', pet_count,
      'throneContractsClosed', throne_count,
      'debtTimeoutsCleared', timeout_count,
      'refundApplied', false
    )
  );

  return jsonb_build_object(
    'petContractsClosed', pet_count,
    'throneContractsClosed', throne_count,
    'debtTimeoutsCleared', timeout_count
  );
end;
$$;

revoke all on function public.admin_forgive_all_debts(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_forgive_all_debts(uuid, text) to service_role;
