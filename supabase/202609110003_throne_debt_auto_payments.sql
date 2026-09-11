-- Run after 202609110001_throne_attribution.sql, before deploying the app.
-- Existing installment amounts and manual approvals are preserved. Historical
-- receipts are never replayed into installments. Re-runnable.
begin;

alter table public.throne_debts
  add column if not exists auto_payments_from timestamptz not null default now();
alter table public.throne_debt_installments
  add column if not exists webhook_paid_usd numeric(10,2) not null default 0
    check (webhook_paid_usd >= 0 and webhook_paid_usd <= amount_usd);

create table if not exists public.throne_debt_payments (
  event_id text primary key references public.throne_webhook_events(event_id),
  debt_id uuid not null references public.throne_debts(id),
  user_id uuid not null references public.profiles(id),
  amount_usd numeric(12,2) not null check (amount_usd > 0),
  applied_usd numeric(12,2) not null default 0 check (applied_usd >= 0 and applied_usd <= amount_usd),
  status text not null check (status in ('applied', 'needs_review')),
  review_reason text,
  manual_review_id uuid references public.throne_debt_payment_reviews(id),
  created_at timestamptz not null default now()
);
create index if not exists throne_debt_payments_debt_idx on public.throne_debt_payments(debt_id, created_at);
create table if not exists public.throne_debt_payment_allocations (
  event_id text not null references public.throne_debt_payments(event_id),
  installment_id uuid not null references public.throne_debt_installments(id),
  amount_usd numeric(12,2) not null check (amount_usd > 0),
  primary key (event_id, installment_id)
);
alter table public.throne_debt_payments enable row level security;
alter table public.throne_debt_payment_allocations enable row level security;
revoke all on public.throne_debt_payments, public.throne_debt_payment_allocations from public, anon, authenticated;
grant select on public.throne_debt_payments to authenticated;
grant all on public.throne_debt_payments, public.throne_debt_payment_allocations to service_role;
drop policy if exists "Read own debt receipts" on public.throne_debt_payments;
create policy "Read own debt receipts" on public.throne_debt_payments for select to authenticated using (user_id = auth.uid());

create or replace function public.apply_throne_debt_payment(p_event_id text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  attributed jsonb;
  e public.throne_webhook_events%rowtype;
  d public.throne_debts%rowtype;
  receipt public.throne_debt_payments%rowtype;
  installment public.throne_debt_installments%rowtype;
  amount numeric; available numeric; applied numeric := 0; portion numeric; remaining numeric;
  reason text; manual_id uuid;
begin
  -- Attribution validates the signed, stored USD payload and locks the event.
  -- All allocation and event finalization therefore commit or roll back together.
  attributed := public.attribute_throne_debt_payment(p_event_id);
  if attributed ? 'error' then return attributed; end if;
  select * into e from public.throne_webhook_events where event_id = p_event_id;
  select * into d from public.throne_debts where upper(debt_code) = e.attribution_code for update;
  if not found or d.user_id <> e.user_id then raise exception 'Debt attribution mismatch'; end if;
  select * into receipt from public.throne_debt_payments where event_id = p_event_id;
  if found then
    return jsonb_build_object('duplicate',true,'userId',d.user_id,'code',d.debt_code,
      'status',receipt.status,'applied',receipt.applied_usd,'unallocated',receipt.amount_usd-receipt.applied_usd);
  end if;
  amount := coalesce(e.payload->'data'->>'amount',e.payload->'data'->>'price')::numeric / 100;
  available := amount;

  -- A manual review may already cover this receipt. Keep ambiguous money
  -- visible to the admin rather than accidentally paying a second installment.
  perform id from public.throne_debt_payment_reviews where debt_id=d.id order by id for update;
  if coalesce(e.occurred_at,e.created_at) < d.auto_payments_from then reason := 'historical_payment';
  elsif d.status not in ('active','overdue') then reason := 'contract_' || d.status;
  elsif not exists(select 1 from public.throne_debt_installments where debt_id=d.id) then reason := 'installments_missing';
  else
    select r.id into manual_id from public.throne_debt_payment_reviews r
    where r.debt_id=d.id and (r.status='pending' or
      (r.status='approved' and r.reviewed_at>=d.auto_payments_from and not exists
        (select 1 from public.throne_debt_payments p where p.manual_review_id=r.id)))
    order by r.created_at limit 1;
    if manual_id is not null then reason := 'manual_review_overlap'; end if;
  end if;

  insert into public.throne_debt_payments(event_id,debt_id,user_id,amount_usd,status,review_reason,manual_review_id)
  values(p_event_id,d.id,d.user_id,amount,case when reason is null then 'applied' else 'needs_review' end,reason,manual_id);

  if reason is null then
    for installment in select * from public.throne_debt_installments
      where debt_id=d.id and status<>'approved_paid' order by installment_number for update
    loop
      exit when available<=0;
      portion := least(available, installment.amount_usd-installment.webhook_paid_usd);
      if portion<=0 then continue; end if;
      insert into public.throne_debt_payment_allocations(event_id,installment_id,amount_usd)
      values(p_event_id,installment.id,portion);
      update public.throne_debt_installments set
        webhook_paid_usd=webhook_paid_usd+portion,
        status=case when webhook_paid_usd+portion>=amount_usd then 'approved_paid' else status end,
        paid_at=case when webhook_paid_usd+portion>=amount_usd then now() else paid_at end,
        reviewed_at=case when webhook_paid_usd+portion>=amount_usd then now() else reviewed_at end,
        rejection_reason=case when webhook_paid_usd+portion>=amount_usd then null else rejection_reason end,
        updated_at=now()
      where id=installment.id;
      available := available-portion;
      applied := applied+portion;
    end loop;
    update public.throne_debt_payments set applied_usd=applied where event_id=p_event_id;
    if not exists(select 1 from public.throne_debt_installments where debt_id=d.id and status<>'approved_paid') then
      update public.throne_debts set status='completed',updated_at=now() where id=d.id;
      d.status := 'completed';
    elsif d.status='overdue' and not exists(select 1 from public.throne_debt_installments where debt_id=d.id and status<>'approved_paid' and due_date<=now()) then
      update public.throne_debts set status='active',updated_at=now() where id=d.id;
      d.status := 'active';
    end if;
  end if;
  select coalesce(sum(amount_usd-webhook_paid_usd),0) into remaining
    from public.throne_debt_installments where debt_id=d.id and status<>'approved_paid';
  return jsonb_build_object('userId',d.user_id,'code',d.debt_code,'contractId',d.id,
    'status',case when reason is null then 'applied' else 'needs_review' end,
    'reviewReason',reason,'amount',amount,'applied',applied,'unallocated',available,
    'remaining',remaining,'contractStatus',d.status);
end;
$$;
revoke all on function public.apply_throne_debt_payment(text) from public, anon, authenticated;
grant execute on function public.apply_throne_debt_payment(text) to service_role;
commit;
