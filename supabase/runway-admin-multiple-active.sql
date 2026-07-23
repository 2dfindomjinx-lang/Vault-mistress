-- Run once after supabase/runway-voting.sql.
-- The API route only passes p_allow_multiple_active after verifying the
-- caller against ADMIN_USER_IDS. Regular users keep the one-active-avatar and
-- seven-day cooldown rules.

drop index if exists public.idx_voting_avatars_one_active_per_owner;
create index if not exists idx_voting_avatars_one_active_per_owner
  on public.voting_avatars (owner_user_id) where is_active = true;

drop function if exists public.submit_voting_avatar(uuid, jsonb, text, boolean, text);

create or replace function public.submit_voting_avatar(
  p_user_id uuid,
  p_equipped_avatar_slots jsonb,
  p_equipped_full_set_id text,
  p_has_uncensored boolean,
  p_idempotency_key text,
  p_allow_multiple_active boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_hash text;
  v_existing_hash text;
  v_existing_status text;
  v_existing_response jsonb;
  v_result jsonb;
  v_last_activated_at timestamptz;
  v_new_avatar_id uuid;
begin
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  v_request_hash := encode(digest(jsonb_build_object(
    'slots', coalesce(p_equipped_avatar_slots, '{}'::jsonb),
    'fullSet', p_equipped_full_set_id,
    'uncensored', coalesce(p_has_uncensored, false),
    'allowMultipleActive', coalesce(p_allow_multiple_active, false)
  )::text, 'sha256'), 'hex');

  begin
    insert into public.runway_action_receipts (actor_user_id, action_type, idempotency_key, request_hash, status)
    values (p_user_id, 'submit', p_idempotency_key, v_request_hash, 'processing');
  exception when unique_violation then
    select request_hash, status, response into v_existing_hash, v_existing_status, v_existing_response
    from public.runway_action_receipts
    where actor_user_id = p_user_id and action_type = 'submit' and idempotency_key = p_idempotency_key
    for update;

    if v_existing_hash <> v_request_hash then
      return jsonb_build_object('error', 'idempotency_key_reused_with_different_payload');
    end if;
    if v_existing_status = 'completed' then
      return v_existing_response;
    end if;
    return jsonb_build_object('error', 'request_already_processing');
  end;

  select activated_at into v_last_activated_at
  from public.voting_avatars
  where owner_user_id = p_user_id
  order by activated_at desc
  limit 1;

  if not coalesce(p_allow_multiple_active, false)
    and v_last_activated_at is not null
    and now() < v_last_activated_at + interval '7 days' then
    v_result := jsonb_build_object(
      'error', 'cooldown_active',
      'next_eligible_at', v_last_activated_at + interval '7 days'
    );
  else
    if not coalesce(p_allow_multiple_active, false) then
      update public.voting_avatars
      set is_active = false, deactivated_at = now(), updated_at = now()
      where owner_user_id = p_user_id and is_active = true;
    end if;

    insert into public.voting_avatars (
      owner_user_id, equipped_avatar_slots, equipped_full_set_id, has_uncensored_avatar
    ) values (
      p_user_id, coalesce(p_equipped_avatar_slots, '{}'::jsonb), p_equipped_full_set_id, coalesce(p_has_uncensored, false)
    )
    returning id into v_new_avatar_id;

    v_result := jsonb_build_object(
      'success', true,
      'avatarId', v_new_avatar_id,
      'nextEligibleAt', now() + interval '7 days'
    );
  end if;

  update public.runway_action_receipts
  set status = 'completed', response = v_result, completed_at = now()
  where actor_user_id = p_user_id and action_type = 'submit' and idempotency_key = p_idempotency_key;

  return v_result;
end;
$$;

revoke all on function public.submit_voting_avatar(uuid, jsonb, text, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.submit_voting_avatar(uuid, jsonb, text, boolean, text, boolean) to service_role;
