-- Apply before deploying the API changes. Service-role only; no client writes.
begin;
create table if not exists public.economy_receipts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  operation_key text not null, reason text not null, amount integer not null,
  created_at timestamptz not null default now(), result jsonb not null,
  primary key(user_id, operation_key)
);
create table if not exists public.economy_failures (
  id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete set null,
  operation_key text not null, reason text not null, error_code text not null,
  created_at timestamptz not null default now(), resolved_at timestamptz
);
alter table public.economy_receipts enable row level security;
alter table public.economy_failures enable row level security;
revoke all on public.economy_receipts, public.economy_failures from anon, authenticated;
grant all on public.economy_receipts, public.economy_failures to service_role;
create index if not exists economy_failures_pending_idx on public.economy_failures(created_at desc) where resolved_at is null;
create or replace function public.commit_economy_action(
  p_user_id uuid, p_operation_key text, p_expected_profile jsonb, p_profile_patch jsonb,
  p_task_id text, p_expected_task jsonb, p_task_patch jsonb,
  p_reason text, p_metadata jsonb, p_devotion integer default 0
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles%rowtype; v_task public.user_tasks%rowtype;
  v_receipt jsonb; v_result jsonb; v_before integer; v_after integer; v_task_found boolean;
begin
  if p_operation_key is null or length(p_operation_key) not between 1 and 200
     or p_reason is null or length(p_reason) > 120 then raise exception 'invalid_operation'; end if;
  if jsonb_typeof(p_expected_profile) <> 'object' or jsonb_typeof(p_profile_patch) <> 'object'
     or p_expected_profile is null or p_profile_patch is null then raise exception 'invalid_profile'; end if;
  if exists(select 1 from jsonb_object_keys(p_profile_patch) k where k not in ('coins','affection','tribute_total')) then raise exception 'unsupported_profile_field'; end if;
  select * into v_profile from public.profiles where id=p_user_id for update;
  if not found then return jsonb_build_object('error','profile_missing'); end if;
  select result into v_receipt from public.economy_receipts where user_id=p_user_id and operation_key=p_operation_key;
  if found then return v_receipt || jsonb_build_object('duplicate',true); end if;
  if not (to_jsonb(v_profile) @> p_expected_profile) then return jsonb_build_object('error','stale_profile'); end if;
  if p_task_id is not null then
    select * into v_task from public.user_tasks where user_id=p_user_id and task_id=p_task_id for update;
    v_task_found := found;
    if (p_expected_task is null and v_task_found) or
       (p_expected_task is not null and (not v_task_found or not (to_jsonb(v_task) @> p_expected_task))) then
      return jsonb_build_object('error','stale_task');
    end if;
  end if;
  v_before := v_profile.coins;
  v_after := coalesce((p_profile_patch->>'coins')::integer, v_before);
  if v_after < 0 and v_after < v_before then return jsonb_build_object('error','insufficient_funds'); end if;
  if v_after > v_before and v_profile.timeout_until > now() then return jsonb_build_object('error','timeout_active'); end if;
  if coalesce((p_profile_patch->>'affection')::integer,v_profile.affection) not between 0 and 100 then raise exception 'invalid_affection'; end if;
  update public.profiles set coins=v_after,
    affection=coalesce((p_profile_patch->>'affection')::integer,affection),
    tribute_total=coalesce((p_profile_patch->>'tribute_total')::integer,tribute_total), updated_at=now()
    where id=p_user_id;
  if v_after <> v_before then
    insert into public.coin_transactions(user_id,amount,balance_before,balance_after,reason,metadata)
      values(p_user_id,v_after-v_before,v_before,v_after,p_reason,coalesce(p_metadata,'{}') || jsonb_build_object('operationKey',p_operation_key));
  end if;
  if p_task_id is not null and p_task_patch is not null then
    insert into public.user_tasks(user_id,task_id,completed_at,claimed_at,reward_coins,metadata)
      values(p_user_id,p_task_id,(p_task_patch->>'completed_at')::timestamptz,(p_task_patch->>'claimed_at')::timestamptz,
             coalesce((p_task_patch->>'reward_coins')::integer,0),coalesce(p_task_patch->'metadata','{}'))
      on conflict(user_id,task_id) do update set completed_at=excluded.completed_at, claimed_at=excluded.claimed_at,
        reward_coins=excluded.reward_coins, metadata=excluded.metadata returning * into v_task;
  end if;
  if p_devotion <> 0 then
    insert into public.devotion_events(user_id,amount,source,source_key,metadata)
      values(p_user_id,p_devotion,'economy_action',p_operation_key,coalesce(p_metadata,'{}'))
      on conflict(user_id,source_key) do nothing;
  end if;
  v_result := jsonb_build_object('coins',v_after,'rewardCoins',v_after-v_before,'task',case when p_task_id is null then null else to_jsonb(v_task)-'user_id' end);
  insert into public.economy_receipts(user_id,operation_key,reason,amount,result) values(p_user_id,p_operation_key,p_reason,v_after-v_before,v_result);
  update public.economy_failures set resolved_at=now() where user_id=p_user_id and operation_key=p_operation_key and resolved_at is null;
  return v_result;
end $$;
revoke all on function public.commit_economy_action(uuid,text,jsonb,jsonb,text,jsonb,jsonb,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.commit_economy_action(uuid,text,jsonb,jsonb,text,jsonb,jsonb,text,jsonb,integer) to service_role;
create or replace function public.check_economy_readiness() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('atomicEconomy',to_regprocedure('public.commit_economy_action(uuid,text,jsonb,jsonb,text,jsonb,jsonb,text,jsonb,integer)') is not null,
 'rateLimiter',to_regprocedure('public.check_rate_limit(text,integer,integer)') is not null,
 'productMilestones',to_regprocedure('public.get_product_milestone_counts()') is not null);
$$;
revoke all on function public.check_economy_readiness() from public,anon,authenticated;
grant execute on function public.check_economy_readiness() to service_role;
commit;
