-- Pet rewards, eligibility, progress and tax are one transaction, under a profile lock.
-- Apply before deploying the matching routes. No balances/history are rewritten.
begin;

create or replace function public.save_pet_task_progress(p_user_id uuid, p_task_id text, p_status text, p_metadata jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.profiles%rowtype; t public.user_pet_tasks%rowtype;
  d text := to_char(now() at time zone 'Europe/Istanbul','YYYY-MM-DD');
  m jsonb := '{}'; s text := p_status; n integer; stage integer; progress integer; wrong integer; expected text;
  reviewed boolean := p_task_id in ('pet-daily-report','pet-twitter-post','pet-voice-proof','pet-throne-tribute');
  submitted boolean := false;
begin
  select * into p from public.profiles where id=p_user_id for update;
  if not found then return jsonb_build_object('error','profile_missing'); end if;
  if p.pet_unlocked_at is null then return jsonb_build_object('error','pet_locked'); end if;
  if p.timeout_until > now() then return jsonb_build_object('error','timeout_active'); end if;
  if p_task_id not in ('pet-daily-report','pet-twitter-post','pet-voice-proof','pet-throne-tribute','pet-confession-dm','pet-ownership-oath','pet-perfect-writing','pet-evil-wait','pet-false-hope','pet-favor-roulette','pet-affection-claim','pet-weekly-throne-tax')
    then return jsonb_build_object('error','invalid_task'); end if;
  select * into t from public.user_pet_tasks where user_id=p_user_id and task_id=p_task_id for update;
  -- An acknowledgement after settlement is harmless; clients cannot approve tasks.
  if p_status='approved' then
    if t.status='approved' and to_char(coalesce(t.reviewed_at,t.completed_at) at time zone 'Europe/Istanbul','YYYY-MM-DD')=d
      then return jsonb_build_object('task',to_jsonb(t)); end if;
    return jsonb_build_object('error','review_required');
  end if;
  if t.status in ('approved','failed') and to_char(coalesce(t.reviewed_at,t.completed_at) at time zone 'Europe/Istanbul','YYYY-MM-DD')=d
    then return jsonb_build_object('task',to_jsonb(t)); end if;
  if t.metadata->>'date'=d then m:=t.metadata; end if;
  if reviewed then
    if p_status='pending' then
      if t.status='pending' then return jsonb_build_object('task',to_jsonb(t)); end if;
      m:=p_metadata; submitted:=true;
    elsif p_status='available' then m:='{}';
    else return jsonb_build_object('error','invalid_transition'); end if;
  elsif p_status='failed' and p_task_id in ('pet-perfect-writing','pet-evil-wait','pet-false-hope') then
    null; -- Failure closes today's attempt, never awards anything.
  elsif p_status='available' and p_task_id in ('pet-confession-dm','pet-ownership-oath') then
    n:=coalesce((m->>'count')::integer,0);
    if (p_metadata->>'count') is null or (p_metadata->>'count') !~ '^[0-9]{1,2}$' then return jsonb_build_object('error','invalid_progress'); end if;
    if (p_metadata->>'count')::integer=n and t.id is not null then return jsonb_build_object('task',to_jsonb(t)); end if;
    if (p_metadata->>'count')::integer<>n+1 or n+1>=(case when p_task_id='pet-confession-dm' then 5 else 25 end) then return jsonb_build_object('error','invalid_progress'); end if;
    m:=jsonb_build_object('count',n+1);
  elsif p_status='available' and p_task_id='pet-evil-wait' then
    if m ? 'waitEndsAt' then return jsonb_build_object('task',to_jsonb(t)); end if;
    m:=jsonb_build_object('countdownEndsAt',now()+interval '3 seconds','waitEndsAt',now()+interval '123 seconds','status','countdown');
  elsif p_status='available' and p_task_id='pet-false-hope' then
    progress:=coalesce((m->>'progress')::integer,0); stage:=coalesce((m->>'stage')::integer,1);
    wrong:=coalesce((m->>'wrongInputs')::integer,0); expected:=coalesce(m->>'expectedKey','a');
    if p_metadata->>'key' not in ('a','d') or p_metadata->>'key' is null
      or (p_metadata->>'expectedProgress')::integer is distinct from progress
      or (p_metadata->>'expectedStage')::integer is distinct from stage then return jsonb_build_object('error','invalid_progress'); end if;
    if p_metadata->>'key'=expected then progress:=progress+1; else progress:=greatest(0,progress-5); wrong:=wrong+1; end if;
    if stage=1 and progress>=99 then progress:=0; stage:=2; end if;
    if wrong>=5 then s:='failed'; end if;
    -- The last key is consumed by apply_pet_action, alongside its reward.
    if stage=2 and progress>=100 then return jsonb_build_object('error','use_reward_action'); end if;
    m:=jsonb_build_object('progress',progress,'stage',stage,'wrongInputs',wrong,'expectedKey',case when expected='a' then 'd' else 'a' end);
  else return jsonb_build_object('error','invalid_transition'); end if;
  m:=m||jsonb_build_object('date',d);
  insert into public.user_pet_tasks(user_id,task_id,status,reward_score,completed_at,reviewed_at,metadata)
    values(p_user_id,p_task_id,s,10,case when s in ('failed','pending') then now() else null end,case when s='failed' then now() else null end,m)
    on conflict(user_id,task_id) do update set status=excluded.status,reward_score=excluded.reward_score,
      completed_at=excluded.completed_at,reviewed_at=excluded.reviewed_at,metadata=excluded.metadata returning * into t;
  return jsonb_build_object('task',to_jsonb(t),'submitted',submitted);
end $$;

create or replace function public.apply_pet_action(p_user_id uuid, p_action text, p_coin_reward integer default 0, p_proof jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.profiles%rowtype; t public.user_pet_tasks%rowtype;
  d text := to_char(now() at time zone 'Europe/Istanbul','YYYY-MM-DD');
  task text:=replace(p_action,'reward:',''); m jsonb:='{}';
  score integer:=10; reward integer:=p_coin_reward; count_today integer; likeness integer; cost integer;
  due timestamptz; s text:='approved';
begin
  select * into p from public.profiles where id=p_user_id for update;
  if not found then return jsonb_build_object('error','profile_missing'); end if;
  if p_action in ('pet:maintenance','pet:unlock') then
    if p.pet_unlocked_at is null and p.affection>=100 then
      update public.profiles set pet_unlocked_at=now(),last_owner_likeness_at=now(),last_pet_tax_at=coalesce(last_pet_tax_at,now()),owner_likeness=100,updated_at=now() where id=p_user_id;
    elsif p.pet_unlocked_at is not null then
      if lower(ltrim(coalesce(p.username,''),'@'))='vmprincipessa' then
        update public.profiles set owner_likeness=100,last_owner_likeness_at=now(),updated_at=now() where id=p_user_id;
      elsif to_char(coalesce(p.last_owner_likeness_at,p.pet_unlocked_at) at time zone 'Europe/Istanbul','YYYY-MM-DD')<>d then
        select count(*) into count_today from public.user_pet_tasks where user_id=p_user_id and status='approved'
          and to_char(coalesce(reviewed_at,completed_at) at time zone 'Europe/Istanbul','YYYY-MM-DD')=d;
        likeness:=greatest(0,least(100,coalesce(p.owner_likeness,100)+case when count_today>=5 then 10 else -25 end));
        update public.profiles set owner_likeness=case when likeness=0 then 100 else likeness end,
          affection=case when likeness=0 then greatest(0,affection-30) else affection end,last_owner_likeness_at=now(),updated_at=now() where id=p_user_id;
      end if;
    end if;
    return jsonb_build_object('success',true);
  end if;
  if p.pet_unlocked_at is null then return jsonb_build_object('error','pet_locked'); end if;
  if p_action='spend:pet-weekly-tax' then
    due:=coalesce(p.last_pet_tax_at,p.pet_unlocked_at)+interval '7 days';
    if due>now() then return jsonb_build_object('collected',false,'reason','not_due','nextDueAt',due); end if;
    cost:=least(greatest(p.coins,0),least(10000,greatest(2500,floor(p.coins*0.2)::integer)));
    if cost<=0 then return jsonb_build_object('collected',false,'reason','insufficient_coins','nextDueAt',due); end if;
    update public.profiles set coins=coins-cost,pet_score=coalesce(pet_score,0)+20,last_pet_tax_at=now(),updated_at=now() where id=p_user_id;
    insert into public.coin_transactions(user_id,amount,balance_before,balance_after,reason,metadata)
      values(p_user_id,-cost,p.coins,p.coins-cost,p_action,jsonb_build_object('autoCollected',true,'spendAmount',cost));
    insert into public.user_pet_tasks(user_id,task_id,status,reward_score,completed_at,reviewed_at,metadata)
      values(p_user_id,'pet-weekly-throne-tax','approved',20,now(),now(),jsonb_build_object('cost',cost,'autoCollected',true,'date',d))
      on conflict(user_id,task_id) do update set status=excluded.status,reward_score=excluded.reward_score,completed_at=excluded.completed_at,reviewed_at=excluded.reviewed_at,metadata=excluded.metadata returning * into t;
    return jsonb_build_object('collected',true,'completedAt',now(),'cost',cost,'nextDueAt',now()+interval '7 days','task',to_jsonb(t));
  end if;
  if p.timeout_until>now() then return jsonb_build_object('error','timeout_active'); end if;
  if p_action not like 'reward:%' or task not in ('pet-confession-dm','pet-ownership-oath','pet-perfect-writing','pet-evil-wait','pet-false-hope','pet-favor-roulette','pet-affection-claim')
    then return jsonb_build_object('error','invalid_action'); end if;
  if reward is null or reward<0 or reward>(case when task='pet-favor-roulette' then 1000 else 400 end) then return jsonb_build_object('error','invalid_reward'); end if;
  select * into t from public.user_pet_tasks where user_id=p_user_id and task_id=task for update;
  if t.status in ('approved','failed') and to_char(coalesce(t.reviewed_at,t.completed_at) at time zone 'Europe/Istanbul','YYYY-MM-DD')=d then
    if t.status='approved' or t.metadata->>'rewardRecorded'='true' then return jsonb_build_object('task',to_jsonb(t),'replayed',true); end if;
    return jsonb_build_object('error','task_closed');
  end if;
  if t.status='pending' then return jsonb_build_object('error','review_pending'); end if;
  if t.metadata->>'date'=d then m:=t.metadata; end if;
  if task in ('pet-confession-dm','pet-ownership-oath') then
    if coalesce((m->>'count')::integer,0)<>(case when task='pet-confession-dm' then 4 else 24 end) then return jsonb_build_object('error','task_not_ready'); end if;
    m:=m||jsonb_build_object('count',case when task='pet-confession-dm' then 5 else 25 end);
  elsif task='pet-evil-wait' then
    if not(m ? 'waitEndsAt') or (m->>'waitEndsAt')::timestamptz>now() then return jsonb_build_object('error','task_not_ready'); end if;
    m:=m||jsonb_build_object('status','success');
  elsif task='pet-false-hope' then
    if coalesce((m->>'stage')::integer,1)<>2 or coalesce((m->>'progress')::integer,0)<>99
      or coalesce((m->>'wrongInputs')::integer,0)>=5 or (p_proof->>'key') is distinct from (m->>'expectedKey') then return jsonb_build_object('error','task_not_ready'); end if;
    m:=m||jsonb_build_object('progress',100);
  elsif task='pet-favor-roulette' then
    if p_proof->>'result' is null or p_proof->>'result' not in ('win','loss','empty-day') then return jsonb_build_object('error','invalid_roll'); end if;
    m:=p_proof;
    if p_proof->>'result'<>'win' then reward:=0; score:=0; s:='failed'; end if;
  elsif task='pet-affection-claim' then
    select count(*) into count_today from public.user_pet_tasks where user_id=p_user_id and status='approved' and task_id<>task
      and to_char(coalesce(reviewed_at,completed_at) at time zone 'Europe/Istanbul','YYYY-MM-DD')=d;
    if count_today<5 then return jsonb_build_object('error','task_not_ready'); end if;
    reward:=0;
  end if;
  update public.profiles set coins=coins+reward,pet_score=coalesce(pet_score,0)+score,updated_at=now() where id=p_user_id;
  if reward>0 then
    insert into public.coin_transactions(user_id,amount,balance_before,balance_after,reason,metadata)
      values(p_user_id,reward,p.coins,p.coins+reward,p_action,jsonb_build_object('taskId',task,'date',d));
  end if;
  if score>0 and task<>'pet-affection-claim' then
    -- The existing devotion trigger updates total_devotion in this transaction.
    insert into public.devotion_events(user_id,amount,source,source_key,metadata)
      values(p_user_id,2,'pet_task','pet-task:'||task||':'||d,jsonb_build_object('taskId',task)) on conflict(user_id,source_key) do nothing;
  end if;
  insert into public.user_pet_tasks(user_id,task_id,status,reward_score,completed_at,reviewed_at,metadata)
    values(p_user_id,task,s,10,now(),now(),m||jsonb_build_object('date',d,'rewardRecorded',true))
    on conflict(user_id,task_id) do update set status=excluded.status,reward_score=excluded.reward_score,completed_at=excluded.completed_at,reviewed_at=excluded.reviewed_at,metadata=excluded.metadata returning * into t;
  return jsonb_build_object('task',to_jsonb(t),'success',true);
end $$;

revoke all on function public.save_pet_task_progress(uuid,text,text,jsonb), public.apply_pet_action(uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_pet_task_progress(uuid,text,text,jsonb), public.apply_pet_action(uuid,text,integer,jsonb) to service_role;
revoke insert,update,delete on public.user_pet_tasks from anon,authenticated;
notify pgrst,'reload schema';
commit;
