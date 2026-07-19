begin;

-- Activation identities are unique inside an app, not across unrelated apps.
alter table public.app_activation_codes
  drop constraint if exists app_activation_codes_owner_name_key;

create unique index if not exists app_activation_codes_app_key_owner_name_idx
  on public.app_activation_codes(app_key, owner_name)
  where owner_name is not null;

create table if not exists public.wallpaper_assignments (
  id uuid primary key default gen_random_uuid(),
  app_key text not null,
  activation_id uuid references public.app_activation_codes(id) on delete cascade,
  scope text not null check (scope in ('global', 'device')),
  object_key text not null,
  wallpaper_url text not null,
  version text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  check (
    (scope = 'global' and activation_id is null)
    or
    (scope = 'device' and activation_id is not null)
  )
);

create unique index if not exists wallpaper_assignments_one_active_global_idx
  on public.wallpaper_assignments(app_key)
  where active and scope = 'global';

create unique index if not exists wallpaper_assignments_one_active_device_idx
  on public.wallpaper_assignments(app_key, activation_id)
  where active and scope = 'device';

create index if not exists wallpaper_assignments_created_idx
  on public.wallpaper_assignments(app_key, created_at desc);

alter table public.wallpaper_assignments enable row level security;

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
    select 1
    from public.app_activation_codes
    where id = p_activation_id
      and app_key = p_app_key
      and status = 'active'
      and bound_installation_id is not null
  ) then
    raise exception 'Wallpaper target device was not found';
  end if;

  update public.wallpaper_assignments
  set active = false
  where app_key = p_app_key
    and active
    and (
      (p_activation_id is null and scope = 'global')
      or
      (p_activation_id is not null and activation_id = p_activation_id)
    );

  insert into public.wallpaper_assignments (
    app_key,
    activation_id,
    scope,
    object_key,
    wallpaper_url,
    version,
    created_by
  )
  values (
    p_app_key,
    p_activation_id,
    v_scope,
    p_object_key,
    p_wallpaper_url,
    p_version,
    p_created_by
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.assign_wallpaper(text, uuid, text, text, text, uuid) from public;
revoke all on function public.assign_wallpaper(text, uuid, text, text, text, uuid) from anon;
revoke all on function public.assign_wallpaper(text, uuid, text, text, text, uuid) from authenticated;
grant execute on function public.assign_wallpaper(text, uuid, text, text, text, uuid) to service_role;

commit;
