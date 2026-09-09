-- Apply before deploying the matching application changes.
begin;

create index if not exists live_chat_messages_history_idx
  on public.live_chat_messages(created_at desc, id desc);
create index if not exists live_chat_messages_moderation_idx
  on public.live_chat_messages(deleted_at, id) where is_deleted = true;

-- Remove only the chat sweep from the installed maintenance function.
-- Preserve the deployed job's other retention rules, grants and audit fields.
do $$
declare
  definition text;
  updated_definition text;
begin
  if to_regprocedure('public.run_data_retention()') is not null then
    select pg_get_functiondef('public.run_data_retention()'::regprocedure) into definition;
    updated_definition := regexp_replace(definition,
      'delete\s+from\s+public\.live_chat_messages\s+where\s+created_at\s*<\s*now\(\)\s*-\s*interval\s+''7 days'';\s*get diagnostics live_chat_count = row_count;',
      'live_chat_count := 0; -- Chat history is retained for cursor pagination.', 'i');
    if updated_definition = definition and definition ~* 'delete\s+from\s+public\.live_chat_messages' then
      raise exception 'Unexpected chat retention definition; review run_data_retention before applying.';
    end if;
    execute updated_definition;
  end if;
end;
$$;

-- One transaction owns the balance, daily cooldown and reward ledger.
-- Only the trusted server route can invoke this function with its sampled reward.
create or replace function public.open_daily_game_case(p_user_id uuid, p_reward integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  player public.profiles%rowtype;
  task public.user_tasks%rowtype;
  opened_at timestamptz;
  cooldown_until timestamptz;
begin
  if not (p_reward = any(array[100,125,150,175,200,250,300,350,400,450,500,600,700,750,900,1000])) or p_reward is null then
    raise exception 'Invalid Case Opening reward';
  end if;
  select * into player from public.profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('error', 'profile_not_found'); end if;
  opened_at := clock_timestamp();
  if player.timeout_until > opened_at then return jsonb_build_object('error', 'timeout_active'); end if;
  select * into task from public.user_tasks where user_id = p_user_id and task_id = 'case-opening';
  if task.claimed_at is not null then
    cooldown_until := (date_trunc('day', task.claimed_at at time zone 'Europe/Istanbul') + interval '1 day') at time zone 'Europe/Istanbul';
    if cooldown_until > opened_at then
      return jsonb_build_object('error', 'cooldown', 'cooldownUntil', cooldown_until);
    end if;
  end if;
  update public.profiles set coins = coins + p_reward, updated_at = opened_at where id = p_user_id;
  insert into public.coin_transactions(user_id, amount, balance_before, balance_after, reason, metadata)
    values (p_user_id, p_reward, player.coins, player.coins + p_reward, 'reward:case-opening', jsonb_build_object('taskId', 'case-opening', 'reward', p_reward));
  insert into public.user_tasks(user_id, task_id, completed_at, claimed_at, reward_coins, metadata)
    values (p_user_id, 'case-opening', opened_at, opened_at, p_reward, jsonb_build_object('reward', p_reward))
    on conflict (user_id, task_id) do update set completed_at = excluded.completed_at,
      claimed_at = excluded.claimed_at, reward_coins = excluded.reward_coins, metadata = excluded.metadata;
  cooldown_until := (date_trunc('day', opened_at at time zone 'Europe/Istanbul') + interval '1 day') at time zone 'Europe/Istanbul';
  return jsonb_build_object('reward', p_reward, 'coins', player.coins + p_reward, 'openedAt', opened_at, 'cooldownUntil', cooldown_until);
end;
$$;

revoke all on function public.open_daily_game_case(uuid, integer) from public, anon, authenticated;
grant execute on function public.open_daily_game_case(uuid, integer) to service_role;
notify pgrst, 'reload schema';
commit;
