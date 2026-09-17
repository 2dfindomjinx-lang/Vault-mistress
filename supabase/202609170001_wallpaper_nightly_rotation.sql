begin;

-- Existing rows came from the admin panel. New automatic rows need a distinct
-- origin so a retry cannot mistake yesterday's automatic choice for a manual one.
alter table public.wallpaper_assignments
  add column if not exists assignment_source text not null default 'manual';

alter table public.wallpaper_assignments
  drop constraint if exists wallpaper_assignments_source_check;
alter table public.wallpaper_assignments
  add constraint wallpaper_assignments_source_check
  check (assignment_source in ('manual', 'automatic'));

create index if not exists wallpaper_assignments_manual_global_day_idx
  on public.wallpaper_assignments (app_key, created_at desc)
  where scope = 'global' and assignment_source = 'manual';

-- A global manual assignment and the nightly choice share the same transaction
-- lock. Whichever arrives first finishes before the other checks today's state.
create or replace function public.assign_wallpaper(
  p_app_key text,
  p_activation_id uuid,
  p_object_key text,
  p_wallpaper_url text,
  p_version text,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text := case when p_activation_id is null then 'global' else 'device' end;
  v_id uuid;
begin
  if p_app_key <> 'principessa-wallpaper-control' then
    raise exception 'Unsupported wallpaper app key';
  end if;

  if p_activation_id is not null and not exists (
    select 1 from public.app_activation_codes
    where id = p_activation_id
      and app_key = p_app_key
      and status = 'active'
      and bound_installation_id is not null
  ) then
    raise exception 'Wallpaper target device was not found';
  end if;

  if p_activation_id is null then
    perform pg_advisory_xact_lock(2147483000, hashtext('wallpaper-global:' || p_app_key));
  end if;

  update public.wallpaper_assignments
  set active = false
  where app_key = p_app_key
    and active
    and (
      (p_activation_id is null and scope = 'global')
      or (p_activation_id is not null and activation_id = p_activation_id)
    );

  insert into public.wallpaper_assignments (
    app_key, activation_id, scope, object_key, wallpaper_url,
    version, created_by, assignment_source
  ) values (
    p_app_key, p_activation_id, v_scope, p_object_key, p_wallpaper_url,
    p_version, p_created_by, 'manual'
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.assign_wallpaper(text, uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.assign_wallpaper(text, uuid, text, text, text, uuid) to service_role;

-- Image Library is the set of distinct object keys in assignment history.
-- That same history supplies first-seen and last-use dates, without a
-- second library table or a potentially stale usage counter.
create or replace function public.rotate_wallpaper_if_no_manual_assignment(
  p_now timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app_key constant text := 'principessa-wallpaper-control';
  v_now timestamptz;
  v_day_start timestamptz;
  v_next_day timestamptz;
  v_current_key text;
  v_object_key text;
  v_wallpaper_url text;
  v_version text;
begin
  perform pg_advisory_xact_lock(2147483000, hashtext('wallpaper-global:' || v_app_key));
  -- Re-read the clock after acquiring the lock. A manual assignment may have
  -- completed while this invocation waited, and must count in the last 24h.
  v_now := coalesce(p_now, clock_timestamp());

  -- The schedule is 02:00 Turkey time. This guard also prevents an accidental
  -- daytime request from becoming a new daily assignment.
  if extract(hour from v_now at time zone 'Asia/Istanbul') not in (2, 3) then
    return jsonb_build_object('status', 'outside_night_window');
  end if;

  v_day_start := ((v_now at time zone 'Asia/Istanbul')::date::timestamp
    at time zone 'Asia/Istanbul');
  v_next_day := (((v_now at time zone 'Asia/Istanbul')::date + 1)::timestamp
    at time zone 'Asia/Istanbul');

  -- Manual ALL assignments in the rolling 24-hour window win, including
  -- yesterday's post-midnight assignments and superseded manual rows.
  if exists (
    select 1 from public.wallpaper_assignments
    where app_key = v_app_key and scope = 'global'
      and assignment_source = 'manual'
      and created_at >= v_now - interval '24 hours' and created_at <= v_now
  ) then
    return jsonb_build_object('status', 'skipped_manual');
  end if;

  if exists (
    select 1 from public.wallpaper_assignments
    where app_key = v_app_key and scope = 'global'
      and assignment_source = 'automatic'
      and created_at >= v_day_start and created_at < v_next_day
  ) then
    return jsonb_build_object('status', 'already_rotated');
  end if;

  select object_key into v_current_key
  from public.wallpaper_assignments
  where app_key = v_app_key and scope = 'global' and active
  limit 1;

  with library as (
    select object_key,
      (array_agg(wallpaper_url order by created_at desc))[1] as wallpaper_url,
      min(created_at) as first_seen,
      max(created_at) as last_use
    from public.wallpaper_assignments
    where app_key = v_app_key and object_key <> '' and wallpaper_url <> ''
      and created_at <= v_now
    group by object_key
  ), weighted as (
    select object_key, wallpaper_url,
      1
      + least(6, floor(extract(epoch from (v_now - first_seen)) / 604800))
      + least(4, floor(extract(epoch from (v_now - last_use)) / 604800))
      as weight
    from library
    where object_key is distinct from v_current_key
  )
  select object_key, wallpaper_url into v_object_key, v_wallpaper_url
  from weighted
  order by -ln(greatest(random(), 0.000000000001)) / greatest(weight, 1)
  limit 1;

  if v_object_key is null then
    return jsonb_build_object('status', 'no_alternative_image');
  end if;

  v_version := gen_random_uuid()::text;

  update public.wallpaper_assignments
  set active = false
  where app_key = v_app_key and scope = 'global' and active;

  insert into public.wallpaper_assignments (
    app_key, activation_id, scope, object_key, wallpaper_url,
    version, created_by, assignment_source, created_at
  ) values (
    v_app_key, null, 'global', v_object_key, v_wallpaper_url,
    v_version, null, 'automatic', v_now
  );

  return jsonb_build_object('status', 'assigned', 'version', v_version);
end;
$$;

revoke all on function public.rotate_wallpaper_if_no_manual_assignment(timestamptz)
  from public, anon, authenticated;
grant execute on function public.rotate_wallpaper_if_no_manual_assignment(timestamptz)
  to service_role;

commit;
