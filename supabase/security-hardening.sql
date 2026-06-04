-- Phase 2 security hardening.
-- Client writes may still update non-sensitive profile fields such as avatar/login/timeout.
-- Sensitive economy/progression fields must be mutated through service-role API routes.

create or replace function public.is_privileged_db_context()
returns boolean
language sql
stable
as $$
  select
    current_user in ('postgres', 'service_role', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_privileged_db_context() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.coins := 100;
    new.affection := 0;
    new.tribute_total := 0;
    new.shame_count := 0;
    new.is_admin := false;
    new.hide_from_leaderboard := false;
    new.pet_score := 0;
    new.owner_likeness := 100;
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin then
    raise exception 'is_admin cannot be changed from the client';
  end if;

  if new.hide_from_leaderboard is distinct from old.hide_from_leaderboard then
    raise exception 'hide_from_leaderboard cannot be changed from the client';
  end if;

  if new.coins is distinct from old.coins then
    raise exception 'coins cannot be changed from the client';
  end if;

  if new.affection is distinct from old.affection then
    raise exception 'affection cannot be changed from the client';
  end if;

  if new.tribute_total is distinct from old.tribute_total then
    raise exception 'tribute_total cannot be changed from the client';
  end if;

  if new.shame_count is distinct from old.shame_count then
    raise exception 'shame_count cannot be changed from the client';
  end if;

  if new.pet_score is distinct from old.pet_score then
    raise exception 'pet_score cannot be changed from the client';
  end if;

  if new.owner_likeness is distinct from old.owner_likeness then
    raise exception 'owner_likeness cannot be changed from the client';
  end if;

  return new;
end;
$$;

create or replace function public.block_client_owned_table_mutations()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_privileged_db_context() then
    return coalesce(new, old);
  end if;

  raise exception '% mutations must go through backend API routes', tg_table_name;
end;
$$;

drop trigger if exists protect_profile_sensitive_fields_trigger on public.profiles;
drop function if exists public.protect_profile_sensitive_fields();

drop trigger if exists validate_user_task_reward_trigger on public.user_tasks;
drop function if exists public.validate_user_task_reward();
drop trigger if exists block_client_user_tasks_mutations_trigger on public.user_tasks;
drop trigger if exists block_client_user_gallery_mutations_trigger on public.user_gallery;
drop trigger if exists block_client_unlocked_gallery_items_mutations_trigger on public.unlocked_gallery_items;
drop trigger if exists block_client_user_pet_gallery_mutations_trigger on public.user_pet_gallery;

drop trigger if exists protect_profile_admin_fields_trigger on public.profiles;
create trigger protect_profile_admin_fields_trigger
  before insert or update on public.profiles
  for each row
  execute function public.protect_profile_admin_fields();

create trigger block_client_user_tasks_mutations_trigger
  before insert or update or delete on public.user_tasks
  for each row
  execute function public.block_client_owned_table_mutations();

create trigger block_client_user_gallery_mutations_trigger
  before insert or update or delete on public.user_gallery
  for each row
  execute function public.block_client_owned_table_mutations();

create trigger block_client_unlocked_gallery_items_mutations_trigger
  before insert or update or delete on public.unlocked_gallery_items
  for each row
  execute function public.block_client_owned_table_mutations();

create trigger block_client_user_pet_gallery_mutations_trigger
  before insert or update or delete on public.user_pet_gallery
  for each row
  execute function public.block_client_owned_table_mutations();
