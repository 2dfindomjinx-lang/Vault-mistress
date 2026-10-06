-- Apply once to the SHARED database before deploying either website.
-- Requires principessa-money.sql, inventory variants and wheel-chastity-hours.sql.
-- Old wheel RPC remains available for clients during deployment.
begin;
create table if not exists public.paid_operation_receipts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  operation text not null check (operation in ('money-shop', 'wheel')),
  request_id uuid not null,
  input jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation, request_id)
);
alter table public.paid_operation_receipts enable row level security;
revoke all on public.paid_operation_receipts from public, anon, authenticated;
grant select, insert on public.paid_operation_receipts to service_role;

create or replace function public.execute_money_shop(
  p_user_id uuid, p_request_id uuid, p_action text, p_item_id text,
  p_price_pm integer, p_refund_pm integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_money integer;
  v_quantity integer;
  v_pm_quantity integer;
  v_delta integer;
  v_receipt public.paid_operation_receipts%rowtype;
  v_input jsonb := jsonb_build_object('action', p_action, 'itemId', p_item_id);
  v_result jsonb;
begin
  if p_request_id is null or p_action is null or p_action not in ('buy','sell')
    or p_item_id is null or p_price_pm is null or p_price_pm < 1
    or p_refund_pm is null or p_refund_pm < 0 or p_refund_pm > p_price_pm then
    return jsonb_build_object('error','invalid_request');
  end if;
  -- Same lock order as crate opens/upgrades: profile, then inventory.
  select principessa_money into v_money from public.profiles where id=p_user_id for update;
  if not found then return jsonb_build_object('error','profile_not_found'); end if;
  select * into v_receipt from public.paid_operation_receipts
    where user_id=p_user_id and operation='money-shop' and request_id=p_request_id;
  if found then
    if v_receipt.input <> v_input then return jsonb_build_object('error','request_mismatch'); end if;
    return v_receipt.result || jsonb_build_object('replayed',true);
  end if;
  -- Prices come only from the authenticated server catalogue, never the browser.
  -- Keep the legendary-only boundary used by bulk coin sales.
  if not exists (select 1 from public.crate_items where item_id=p_item_id and rarity='legendary') then
    return jsonb_build_object('error','invalid_item');
  end if;
  select quantity, pm_quantity into v_quantity,v_pm_quantity from public.user_crate_inventory
    where user_id=p_user_id and item_id=p_item_id and variant='normal' for update;
  v_quantity := coalesce(v_quantity,0); v_pm_quantity := coalesce(v_pm_quantity,0);
  if p_action='buy' then
    if v_money < p_price_pm then return jsonb_build_object('error','insufficient_money'); end if;
    v_delta := -p_price_pm;
    insert into public.user_crate_inventory(user_id,item_id,variant,quantity,pm_quantity)
      values(p_user_id,p_item_id,'normal',1,1)
      on conflict(user_id,item_id,variant) do update set
        quantity=user_crate_inventory.quantity+1, pm_quantity=user_crate_inventory.pm_quantity+1;
  else
    if v_pm_quantity < 1 or v_quantity < 1 then return jsonb_build_object('error','no_shop_copy'); end if;
    v_delta := p_refund_pm;
    if v_quantity=1 then
      delete from public.user_crate_inventory where user_id=p_user_id and item_id=p_item_id and variant='normal';
    else
      update public.user_crate_inventory set quantity=quantity-1, pm_quantity=pm_quantity-1
        where user_id=p_user_id and item_id=p_item_id and variant='normal';
    end if;
  end if;
  update public.profiles set principessa_money=v_money+v_delta, updated_at=now() where id=p_user_id;
  insert into public.money_transactions(user_id,amount,balance_before,balance_after,reason,metadata)
    values(p_user_id,v_delta,v_money,v_money+v_delta,
      case when p_action='buy' then 'money-shop:purchase' else 'money-shop:buyback' end,
      jsonb_build_object('itemId',p_item_id,'pricePm',p_price_pm,'requestId',p_request_id));
  v_result := jsonb_build_object('success',true,'pricePm',p_price_pm,'refundPm',p_refund_pm);
  insert into public.paid_operation_receipts(user_id,operation,request_id,input,result)
    values(p_user_id,'money-shop',p_request_id,v_input,v_result);
  return v_result;
end; $$;
revoke all on function public.execute_money_shop(uuid,uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.execute_money_shop(uuid,uuid,text,text,integer,integer) to service_role;

create or replace function public.spin_findom_wheel_once(
  p_user_id uuid, p_request_id uuid, p_wheel_id text, p_kind text,
  p_cost_pm integer, p_amount numeric, p_label text, p_segment_index integer,
  p_throne_url text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_money integer;
  v_receipt public.paid_operation_receipts%rowtype;
  v_input jsonb := jsonb_build_object('wheelId',p_wheel_id,'kind',p_kind);
  v_result jsonb;
  v_legacy_debt boolean;
begin
  if p_request_id is null or p_segment_index is null or p_segment_index < 0 then
    return jsonb_build_object('error','invalid_request');
  end if;
  select principessa_money into v_money from public.profiles where id=p_user_id for update;
  if not found then return jsonb_build_object('error','profile_not_found'); end if;
  select * into v_receipt from public.paid_operation_receipts
    where user_id=p_user_id and operation='wheel' and request_id=p_request_id;
  -- Replay BEFORE debt checks; the first successful spin may have created a debt.
  if found then
    if v_receipt.input <> v_input then return jsonb_build_object('error','request_mismatch'); end if;
    return v_receipt.result || jsonb_build_object('replayed',true,'money',v_money);
  end if;
  if to_regclass('public.court_wheel_debts') is not null then
    execute 'select exists(select 1 from public.court_wheel_debts where user_id=$1 and status=''unpaid'')'
      into v_legacy_debt using p_user_id;
    if v_legacy_debt then return jsonb_build_object('error','unpaid_spin'); end if;
  end if;
  v_result := public.spin_findom_wheel(p_user_id,p_wheel_id,p_kind,p_cost_pm,p_amount,p_label);
  if v_result ? 'error' then return v_result; end if;
  v_result := v_result || jsonb_build_object('segmentIndex',p_segment_index,
    'segment',jsonb_build_object('amount',p_amount,'label',p_label,'throneUrl',p_throne_url));
  insert into public.paid_operation_receipts(user_id,operation,request_id,input,result)
    values(p_user_id,'wheel',p_request_id,v_input,v_result);
  return v_result;
end; $$;
revoke all on function public.spin_findom_wheel_once(uuid,uuid,text,text,integer,numeric,text,integer,text) from public,anon,authenticated;
grant execute on function public.spin_findom_wheel_once(uuid,uuid,text,text,integer,numeric,text,integer,text) to service_role;
-- Harden the legacy entry point too; new/old server clients use service_role.
revoke all on function public.spin_findom_wheel(uuid,text,text,integer,numeric,text) from public,anon,authenticated;
grant execute on function public.spin_findom_wheel(uuid,text,text,integer,numeric,text) to service_role;
notify pgrst, 'reload schema';
commit;
