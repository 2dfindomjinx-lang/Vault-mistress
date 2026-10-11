-- Requires 2026-10-03-crate-safety.sql and existing community-goal crate grants.
-- New name: old deployments which consume keys separately keep their old RPC.
begin;
create or replace function public.commit_crate_open_with_keys(
  p_user_id uuid,p_crate_type text,p_expected_coins integer,p_expected_pity integer,
  p_next_pity integer,p_cost integer,p_items jsonb,p_metadata jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  needed integer:=coalesce((p_metadata->>'community_goal_keys_used')::integer,0);
  available integer:=0; used integer; g record; grants jsonb:='[]'; result jsonb;
begin
  if needed<0 or needed>5 then return jsonb_build_object('error','invalid_keys'); end if;
  perform 1 from public.profiles where id=p_user_id for update;
  if not found then return jsonb_build_object('error','profile_not_found'); end if;
  if needed>0 then
    for g in select id,remaining_opens from public.user_crate_open_grants where user_id=p_user_id and crate_type=p_crate_type and remaining_opens>0 order by granted_at,id for update loop
      available:=available+g.remaining_opens;
      grants:=grants||jsonb_build_array(jsonb_build_object('id',g.id,'remaining',g.remaining_opens));
      exit when available>=needed;
    end loop;
    if available<needed then return jsonb_build_object('error','keys_changed'); end if;
  end if;
  result:=public.commit_crate_open(p_user_id,p_crate_type,p_expected_coins,p_expected_pity,p_next_pity,p_cost,p_items,p_metadata);
  if not coalesce((result->>'success')::boolean,false) then return result; end if;
  for g in select value from jsonb_array_elements(grants) loop
    used:=least(needed,(g.value->>'remaining')::integer);
    update public.user_crate_open_grants set remaining_opens=remaining_opens-used,updated_at=now() where id=(g.value->>'id')::uuid;
    needed:=needed-used;
  end loop;
  return result;
end $$;
revoke all on function public.commit_crate_open_with_keys(uuid,text,integer,integer,integer,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_crate_open_with_keys(uuid,text,integer,integer,integer,integer,jsonb,jsonb) to service_role;

-- A sale must never credit Coins before its inventory removal is durable.
create or replace function public.commit_crate_sale(p_user_id uuid,p_expected_coins integer,p_items jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_coins integer; item jsonb; owned integer; paid integer; v_quantity integer; total bigint:=0;
begin
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 2000
    or p_reason is null or p_reason not in ('crate:sell','crate:sell_all','crate:sell_many','crate:sell_duplicates') then return jsonb_build_object('error','invalid_sale'); end if;
  if exists(select 1 from jsonb_array_elements(p_items) x group by x->>'item_id',x->>'variant' having count(*)>1) then return jsonb_build_object('error','duplicate_item'); end if;
  select p.coins into v_coins from public.profiles p where id=p_user_id for update;
  if not found then return jsonb_build_object('error','profile_missing'); end if;
  if v_coins is distinct from p_expected_coins then return jsonb_build_object('error','stale_profile'); end if;
  for item in select value from jsonb_array_elements(p_items) order by value->>'item_id',value->>'variant' loop
    if item->>'item_id'='classic' or coalesce(item->>'quantity','') !~ '^[1-9][0-9]{0,8}$'
      or coalesce(item->>'value','') !~ '^[1-9][0-9]{0,9}$' then return jsonb_build_object('error','invalid_item'); end if;
    v_quantity:=(item->>'quantity')::integer;
    select i.quantity,coalesce(i.pm_quantity,0) into owned,paid from public.user_crate_inventory i
      where i.user_id=p_user_id and i.item_id=item->>'item_id' and i.variant=item->>'variant' for update;
    if not found or owned is distinct from (item->>'expectedQuantity')::integer or owned-paid<v_quantity
      then return jsonb_build_object('error','inventory_changed'); end if;
    total:=total+(item->>'value')::bigint;
  end loop;
  if v_coins::bigint+total>2147483647 then return jsonb_build_object('error','balance_limit'); end if;
  for item in select value from jsonb_array_elements(p_items) loop
    v_quantity:=(item->>'quantity')::integer;
    -- Avoid a transient zero quantity because the inventory enforces quantity>0.
    delete from public.user_crate_inventory i where i.user_id=p_user_id and i.item_id=item->>'item_id' and i.variant=item->>'variant' and i.quantity=v_quantity;
    if not found then update public.user_crate_inventory i set quantity=i.quantity-v_quantity
      where i.user_id=p_user_id and i.item_id=item->>'item_id' and i.variant=item->>'variant'; end if;
    insert into public.crate_opens(user_id,crate_type,item_id,variant,cost,received_sell_value)
      values(p_user_id,replace(p_reason,'crate:',''),item->>'item_id',item->>'variant',0,(item->>'value')::integer);
  end loop;
  update public.profiles set coins=p_expected_coins+total,updated_at=now() where id=p_user_id;
  insert into public.coin_transactions(user_id,amount,balance_before,balance_after,reason,metadata)
    values(p_user_id,total,p_expected_coins,p_expected_coins+total,p_reason,
      case when p_reason='crate:sell' then (p_items->0)-'expectedQuantity'-'value'
        else jsonb_build_object('items',p_items,'item_count',jsonb_array_length(p_items)) end);
  return jsonb_build_object('success',true,'coins',p_expected_coins+total);
end $$;
revoke all on function public.commit_crate_sale(uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.commit_crate_sale(uuid,integer,jsonb,text) to service_role;
notify pgrst,'reload schema';
commit;
