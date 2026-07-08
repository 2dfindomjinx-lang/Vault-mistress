create table if not exists public.throne_debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_type text not null default 'throne' check (debt_type = 'throne'),
  total_amount_usd numeric(10,2) not null check (total_amount_usd > 0),
  installment_amount_usd numeric(10,2) not null check (installment_amount_usd >= 10),
  installment_count integer not null check (installment_count > 0),
  repayment_frequency text not null check (repayment_frequency in ('weekly', 'bi_weekly', 'monthly')),
  contract_length_weeks integer not null check (contract_length_weeks between 4 and 104),
  status text not null default 'pending_review' check (
    status in ('pending_review', 'active', 'overdue', 'timeout', 'redeemed', 'rejected', 'completed', 'cancelled', 'defaulted', 'paused')
  ),
  user_note text,
  admin_note text,
  approved_by_admin_id uuid references auth.users(id),
  approved_at timestamptz,
  rejected_by_admin_id uuid references auth.users(id),
  rejected_at timestamptz,
  timeout_applied_at timestamptz,
  timeout_applied_by_admin_id uuid references auth.users(id),
  timeout_reason text,
  timeout_overdue_amount_usd numeric(10,2),
  timeout_redemption_multiplier numeric(4,2) not null default 1.3,
  timeout_redemption_amount_usd numeric(10,2),
  timeout_lifted_at timestamptz,
  timeout_lifted_by_admin_id uuid references auth.users(id),
  timeout_lift_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.throne_debts
  add column if not exists debt_type text not null default 'throne',
  add column if not exists timeout_applied_at timestamptz,
  add column if not exists timeout_applied_by_admin_id uuid references auth.users(id),
  add column if not exists timeout_reason text,
  add column if not exists timeout_overdue_amount_usd numeric(10,2),
  add column if not exists timeout_redemption_multiplier numeric(4,2) not null default 1.3,
  add column if not exists timeout_redemption_amount_usd numeric(10,2),
  add column if not exists timeout_lifted_at timestamptz,
  add column if not exists timeout_lifted_by_admin_id uuid references auth.users(id),
  add column if not exists timeout_lift_note text;

alter table public.throne_debts
  drop constraint if exists throne_debts_status_check;
alter table public.throne_debts
  add constraint throne_debts_status_check
  check (status in ('pending_review', 'active', 'overdue', 'timeout', 'redeemed', 'rejected', 'completed', 'cancelled', 'defaulted', 'paused'));

alter table public.throne_debts
  drop constraint if exists throne_debts_debt_type_check;
alter table public.throne_debts
  add constraint throne_debts_debt_type_check
  check (debt_type = 'throne');

create index if not exists idx_throne_debts_user_created_at
  on public.throne_debts (user_id, created_at desc);

create index if not exists idx_throne_debts_status_created_at
  on public.throne_debts (status, created_at desc);

drop index if exists public.idx_throne_debts_one_open_per_user;
create unique index idx_throne_debts_one_open_per_user
  on public.throne_debts (user_id)
  where status in ('pending_review', 'active', 'overdue', 'timeout', 'paused');

create table if not exists public.throne_debt_installments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.throne_debts(id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  amount_usd numeric(10,2) not null check (amount_usd >= 10),
  due_date timestamptz not null,
  status text not null default 'pending' check (
    status in ('pending', 'submitted_for_review', 'approved_paid', 'rejected', 'missed', 'overdue', 'timeout_redemption_required')
  ),
  submitted_throne_link text,
  submitted_note text,
  paid_at timestamptz,
  reviewed_by_admin_id uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (debt_id, installment_number)
);

alter table public.throne_debt_installments
  drop constraint if exists throne_debt_installments_status_check;
alter table public.throne_debt_installments
  add constraint throne_debt_installments_status_check
  check (status in ('pending', 'submitted_for_review', 'approved_paid', 'rejected', 'missed', 'overdue', 'timeout_redemption_required'));

create index if not exists idx_throne_debt_installments_debt_number
  on public.throne_debt_installments (debt_id, installment_number);

create index if not exists idx_throne_debt_installments_status_due
  on public.throne_debt_installments (status, due_date);

create table if not exists public.throne_debt_payment_reviews (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.throne_debts(id) on delete cascade,
  installment_id uuid not null references public.throne_debt_installments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  throne_order_link text not null,
  screenshot_url text,
  user_note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_by_admin_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_throne_debt_payment_reviews_status_created
  on public.throne_debt_payment_reviews (status, created_at desc);

create index if not exists idx_throne_debt_payment_reviews_debt_created
  on public.throne_debt_payment_reviews (debt_id, created_at desc);

alter table public.throne_debts enable row level security;
alter table public.throne_debt_installments enable row level security;
alter table public.throne_debt_payment_reviews enable row level security;

drop policy if exists "Users can read own throne debts" on public.throne_debts;
create policy "Users can read own throne debts"
  on public.throne_debts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own throne debt requests" on public.throne_debts;
create policy "Users can insert own throne debt requests"
  on public.throne_debts for insert
  to authenticated
  with check (auth.uid() = user_id and status = 'pending_review');

drop policy if exists "Users can read own throne debt installments" on public.throne_debt_installments;
create policy "Users can read own throne debt installments"
  on public.throne_debt_installments for select
  to authenticated
  using (
    exists (
      select 1
      from public.throne_debts debt
      where debt.id = throne_debt_installments.debt_id
        and debt.user_id = auth.uid()
    )
  );

drop policy if exists "Users can read own throne payment reviews" on public.throne_debt_payment_reviews;
create policy "Users can read own throne payment reviews"
  on public.throne_debt_payment_reviews for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own throne payment reviews" on public.throne_debt_payment_reviews;
create policy "Users can insert own throne payment reviews"
  on public.throne_debt_payment_reviews for insert
  to authenticated
  with check (auth.uid() = user_id);
