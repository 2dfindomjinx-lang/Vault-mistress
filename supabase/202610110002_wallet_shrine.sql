-- Requires 202610060001_paid_operation_receipts.sql and the existing Furnace.
begin;
alter table public.paid_operation_receipts drop constraint if exists paid_operation_receipts_operation_check;
alter table public.paid_operation_receipts add constraint paid_operation_receipts_operation_check
  check(operation in ('money-shop','wheel','money-convert','furnace','shrine'));
create index if not exists coin_transactions_shrine_user_idx on public.coin_transactions(user_id) include(amount,metadata) where reason='tribute:shrine';

create or replace function public.shrine_spend_value(p_amount integer,p_metadata jsonb)
returns numeric language sql immutable set search_path=public as $$
  select greatest(0,floor(case when jsonb_typeof(p_metadata->'spendAmount')='number'
    then (p_metadata->>'spendAmount')::numeric else abs(coalesce(p_amount,0)::numeric) end));
$$;
create or replace function public.get_shrine_summary(p_user_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  with totals as (
    select user_id,sum(public.shrine_spend_value(amount,metadata)) as spent from public.coin_transactions
    where reason='tribute:shrine' group by user_id
  ), leaders as (
    select p.id,p.username,p.display_name,t.spent from totals t join public.profiles p on p.id=t.user_id
    where not coalesce(p.is_admin,false) and not coalesce(p.hide_from_leaderboard,false)
    order by t.spent desc,p.id limit 3
  ) select jsonb_build_object(
    'totalSpent',coalesce((select spent from totals where user_id=p_user_id),0),
    'addressTerm',(select address_term from public.profiles where id=p_user_id),
    'topWorshippers',coalesce((select jsonb_agg(jsonb_build_object('userId',id,'username',username,'displayName',display_name,'totalSpent',spent) order by spent desc,id) from leaders),'[]'::jsonb));
$$;

create or replace function public.execute_wallet_action(p_user_id uuid,p_request_id uuid,p_operation text,p_amount integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p public.profiles%rowtype; receipt public.paid_operation_receipts%rowtype;
  input jsonb:=jsonb_build_object('amount',p_amount); result jsonb;
  bonus numeric; base bigint; bonus_coins bigint; total bigint; spent numeric; tx uuid;
begin
  if p_request_id is null or p_amount is null or p_amount<=0 or p_operation is null or p_operation not in ('money-convert','furnace','shrine') then return jsonb_build_object('error','invalid_request'); end if;
  -- Same lock order as shop, wheels, debt and all other wallet operations.
  select * into p from public.profiles where id=p_user_id for update;
  if not found then return jsonb_build_object('error','profile_missing'); end if;
  select * into receipt from public.paid_operation_receipts where user_id=p_user_id and operation=p_operation and request_id=p_request_id;
  if found then
    if receipt.input<>input then return jsonb_build_object('error','request_mismatch'); end if;
    return receipt.result||jsonb_build_object('replayed',true);
  end if;
  if p_operation='money-convert' then
    if p.principessa_money<p_amount then return jsonb_build_object('error','insufficient_money'); end if;
    bonus:=case when p_amount>=100 then .25 when p_amount>=50 then .20 when p_amount>=20 then .15 when p_amount>=10 then .10 else 0 end;
    base:=p_amount::bigint*1000; bonus_coins:=floor(base*bonus); total:=base+bonus_coins;
    if p.coins::bigint+total>2147483647 then return jsonb_build_object('error','balance_limit'); end if;
    result:=jsonb_build_object('breakdown',jsonb_build_object('baseCoins',base,'bonusCoins',bonus_coins,'bonusPercent',bonus,'pmAmount',p_amount,'totalCoins',total));
    update public.profiles set coins=coins+total,principessa_money=principessa_money-p_amount,updated_at=now() where id=p_user_id;
    insert into public.money_transactions(user_id,amount,balance_before,balance_after,reason,metadata)
      values(p_user_id,-p_amount,p.principessa_money,p.principessa_money-p_amount,'convert:money-to-coins',result->'breakdown');
    insert into public.coin_transactions(user_id,amount,balance_before,balance_after,reason,metadata)
      values(p_user_id,total,p.coins,p.coins+total,'convert:money-to-coins',jsonb_build_object('bonusPercent',bonus,'pmAmount',p_amount));
  elsif p_operation='furnace' then
    if p_amount>500 then return jsonb_build_object('error','invalid_amount'); end if;
    result:=public.burn_tribute_money(p_user_id,p_amount);
    if result ? 'error' then return result; end if;
  else
    if p_amount not in (5000,10000,25000) then return jsonb_build_object('error','invalid_amount'); end if;
    if p.affection<100 then return jsonb_build_object('error','shrine_locked'); end if;
    if p.coins<p_amount then return jsonb_build_object('error','insufficient_coins'); end if;
    select coalesce(sum(public.shrine_spend_value(amount,metadata)),0) into spent from public.coin_transactions where user_id=p_user_id and reason='tribute:shrine';
    update public.profiles set coins=coins-p_amount,tribute_total=coalesce(tribute_total,0)+p_amount,updated_at=now() where id=p_user_id;
    insert into public.coin_transactions(user_id,amount,balance_before,balance_after,reason,metadata)
      values(p_user_id,-p_amount,p.coins,p.coins-p_amount,'tribute:shrine',jsonb_build_object('spendAmount',p_amount,'devotionAmount',p_amount/5000,'prestigeSource','shrine','shrineTotalSpentAfter',spent+p_amount,'shrineImageUnlocked',floor((spent+p_amount)/10000)>floor(spent/10000))) returning id into tx;
    insert into public.devotion_events(user_id,amount,source,source_key,metadata)
      values(p_user_id,p_amount/5000,'shrine_purchase','shrine:'||p_user_id::text||':'||tx::text,jsonb_build_object('spendAmount',p_amount,'shrineTotalSpentAfter',spent+p_amount));
    result:=jsonb_build_object('success',true,'totalSpent',spent+p_amount);
  end if;
  insert into public.paid_operation_receipts(user_id,operation,request_id,input,result) values(p_user_id,p_operation,p_request_id,input,result);
  return result;
end $$;
revoke all on function public.shrine_spend_value(integer,jsonb),public.get_shrine_summary(uuid),public.execute_wallet_action(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.shrine_spend_value(integer,jsonb),public.get_shrine_summary(uuid),public.execute_wallet_action(uuid,uuid,text,integer) to service_role;
notify pgrst,'reload schema';
commit;
