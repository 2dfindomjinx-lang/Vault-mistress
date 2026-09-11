-- Run after 202609110003_throne_debt_auto_payments.sql. No PM is minted here.
begin;
alter table public.throne_debts add column if not exists rounding_waived_usd numeric(10,2) not null default 0;
alter table public.throne_debts add column if not exists schedule_adjusted_at timestamptz;
alter table public.throne_debts add column if not exists whole_dollar_migrated_at timestamptz;
alter table public.throne_debts alter column whole_dollar_migrated_at set default now();
alter table public.throne_debt_installments add column if not exists original_amount_usd numeric(10,2);
alter table public.throne_debt_installments add column if not exists pm_paid_usd numeric(10,2) not null default 0 check(pm_paid_usd>=0);
-- The minimum applies when a contract is requested, not to a residual balance.
alter table public.throne_debt_installments drop constraint if exists throne_debt_installments_amount_usd_check;
alter table public.throne_debt_installments add constraint throne_debt_installments_amount_usd_check check(amount_usd>=0);

-- One-time amendment: retain closed installments and all existing credits.
-- Distribute the remaining whole dollars, keeping every due date unchanged.
do $$
declare d record; i record; balance numeric; n integer; pos integer; due numeric;
begin
 for d in select * from public.throne_debts where status in ('active','overdue','paused') and whole_dollar_migrated_at is null for update loop
  perform id from public.throne_debt_installments where debt_id=d.id for update;
  select coalesce(sum(amount_usd-webhook_paid_usd-pm_paid_usd),0),count(*) into balance,n
    from public.throne_debt_installments where debt_id=d.id and status<>'approved_paid';
  if n>0 and exists(select 1 from public.throne_debt_installments where debt_id=d.id and status<>'approved_paid' and mod(amount_usd-webhook_paid_usd-pm_paid_usd,1)<>0) then
   pos:=0;
   for i in select * from public.throne_debt_installments where debt_id=d.id and status<>'approved_paid' order by installment_number loop
    due:=floor(floor(balance)/n)+case when pos<mod(floor(balance),n) then 1 else 0 end;
    update public.throne_debt_installments set original_amount_usd=coalesce(original_amount_usd,amount_usd),
      amount_usd=webhook_paid_usd+pm_paid_usd+due,
      status=case when due=0 then 'approved_paid' else status end, updated_at=now() where id=i.id;
    pos:=pos+1;
   end loop;
   update public.throne_debts set rounding_waived_usd=balance-floor(balance),schedule_adjusted_at=now(),updated_at=now() where id=d.id;
   if floor(balance)=0 then update public.throne_debts set status='completed' where id=d.id; end if;
  end if;
 end loop;
 update public.throne_debts set whole_dollar_migrated_at=now() where whole_dollar_migrated_at is null;
end $$;

create table if not exists public.throne_debt_pm_payments (
 id uuid primary key,
 debt_id uuid not null references public.throne_debts(id),
 user_id uuid not null references public.profiles(id),
 amount_pm integer not null check(amount_pm>0),
 through_installment integer not null,
 balance_after integer not null,
 allocations jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.throne_debt_pm_payments enable row level security;
revoke all on public.throne_debt_pm_payments from public,anon,authenticated;
grant select on public.throne_debt_pm_payments to authenticated;
grant all on public.throne_debt_pm_payments to service_role;
drop policy if exists "Read own PM debt payments" on public.throne_debt_pm_payments;
create policy "Read own PM debt payments" on public.throne_debt_pm_payments for select to authenticated using(user_id=auth.uid());

create or replace function public.pay_throne_debt_pm(p_user_id uuid,p_debt_id uuid,p_request_id uuid,p_through_installment integer,p_expected_amount integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.throne_debts%rowtype; i record; receipt public.throne_debt_pm_payments%rowtype;
 balance integer; cost numeric; portion numeric; allocations jsonb:='[]'::jsonb;
begin
 -- All debt payment paths lock the contract before its installments.
 select * into d from public.throne_debts where id=p_debt_id and user_id=p_user_id for update;
 if not found then return jsonb_build_object('error','Contract not found.'); end if;
 select * into receipt from public.throne_debt_pm_payments where id=p_request_id;
 if found then
  if receipt.user_id<>p_user_id or receipt.debt_id<>p_debt_id or receipt.through_installment<>p_through_installment or receipt.amount_pm<>p_expected_amount then
   return jsonb_build_object('error','This payment reference has already been used.');
  end if;
  select principessa_money into balance from public.profiles where id=p_user_id;
  return jsonb_build_object('duplicate',true,'money',balance,'spent',receipt.amount_pm);
 end if;
 if d.status not in ('active','overdue') then return jsonb_build_object('error','This contract is not accepting PM payments right now.'); end if;
 if p_request_id is null or p_through_installment is null or p_expected_amount is null or p_expected_amount<=0 then return jsonb_build_object('error','Invalid payment.'); end if;
 if not exists(select 1 from public.throne_debt_installments where debt_id=d.id and installment_number=p_through_installment) then return jsonb_build_object('error','Installment not found.'); end if;
 if exists(select 1 from public.throne_debt_payment_reviews where debt_id=d.id and status='pending') then return jsonb_build_object('error','Wait for your submitted payment to be reviewed before paying again.'); end if;
 perform id from public.throne_debt_installments where debt_id=d.id order by installment_number for update;
 select coalesce(sum(amount_usd-webhook_paid_usd-pm_paid_usd),0) into cost from public.throne_debt_installments
   where debt_id=d.id and installment_number<=p_through_installment and status<>'approved_paid';
 if cost<>p_expected_amount or cost<>floor(cost) then return jsonb_build_object('error','Your balance changed. Refresh the contract before paying.'); end if;
 select principessa_money into balance from public.profiles where id=p_user_id for update;
 if not found or balance<cost then return jsonb_build_object('error','Not enough PM.'); end if;
 for i in select * from public.throne_debt_installments where debt_id=d.id and installment_number<=p_through_installment and status<>'approved_paid' order by installment_number loop
  portion:=i.amount_usd-i.webhook_paid_usd-i.pm_paid_usd;
  if portion<=0 then continue; end if;
  update public.throne_debt_installments set pm_paid_usd=pm_paid_usd+portion,status='approved_paid',paid_at=now(),reviewed_at=now(),rejection_reason=null,updated_at=now() where id=i.id;
  allocations:=allocations||jsonb_build_array(jsonb_build_object('installment',i.installment_number,'amount',portion));
 end loop;
 update public.profiles set principessa_money=balance-cost where id=p_user_id;
 insert into public.money_transactions(user_id,amount,balance_before,balance_after,reason,source_key,metadata)
 values(p_user_id,-cost,balance,balance-cost,'spend:throne-debt','throne-debt-pm:'||p_request_id,
   jsonb_build_object('debt_id',d.id,'debt_code',d.debt_code,'allocations',allocations));
 insert into public.throne_debt_pm_payments(id,debt_id,user_id,amount_pm,through_installment,balance_after,allocations)
 values(p_request_id,d.id,p_user_id,cost,p_through_installment,balance-cost,allocations);
 if not exists(select 1 from public.throne_debt_installments where debt_id=d.id and status<>'approved_paid') then
  update public.throne_debts set status='completed',updated_at=now() where id=d.id;
 elsif d.status='overdue' and not exists(select 1 from public.throne_debt_installments where debt_id=d.id and status<>'approved_paid' and due_date<=now()) then
  update public.throne_debts set status='active',updated_at=now() where id=d.id;
 end if;
 return jsonb_build_object('money',balance-cost,'spent',cost);
end $$;
revoke all on function public.pay_throne_debt_pm(uuid,uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.pay_throne_debt_pm(uuid,uuid,uuid,integer,integer) to service_role;

-- Serialize proof submission against PM/webhook settlement, even though the
-- existing admin review flow spans multiple HTTP requests.
create or replace function public.guard_throne_debt_review() returns trigger language plpgsql set search_path=public as $$
begin
 perform id from public.throne_debts where id=new.debt_id for update;
 if new.status='pending' and not exists(select 1 from public.throne_debt_installments where id=new.installment_id and debt_id=new.debt_id and status<>'approved_paid') then
  raise exception 'This installment is already settled.';
 end if;
 return new;
end $$;
drop trigger if exists guard_throne_debt_review on public.throne_debt_payment_reviews;
create trigger guard_throne_debt_review before insert on public.throne_debt_payment_reviews for each row execute function public.guard_throne_debt_review();

-- Include PM credits when allocating subsequent TD receipts.
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
      portion := least(available, installment.amount_usd-installment.webhook_paid_usd-installment.pm_paid_usd);
      if portion<=0 then continue; end if;
      insert into public.throne_debt_payment_allocations(event_id,installment_id,amount_usd)
      values(p_event_id,installment.id,portion);
      update public.throne_debt_installments set
        webhook_paid_usd=webhook_paid_usd+portion,
        status=case when webhook_paid_usd+pm_paid_usd+portion>=amount_usd then 'approved_paid' else status end,
        paid_at=case when webhook_paid_usd+pm_paid_usd+portion>=amount_usd then now() else paid_at end,
        reviewed_at=case when webhook_paid_usd+pm_paid_usd+portion>=amount_usd then now() else reviewed_at end,
        rejection_reason=case when webhook_paid_usd+pm_paid_usd+portion>=amount_usd then null else rejection_reason end,
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
  select coalesce(sum(amount_usd-webhook_paid_usd-pm_paid_usd),0) into remaining
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
