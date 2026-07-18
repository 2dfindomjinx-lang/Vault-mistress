-- Run once in the Supabase SQL editor.
-- 1. Permanently ban the account involved in the Global Principessa exploit.
-- 2. Remove public access to state-changing SECURITY DEFINER RPCs.
-- 3. Prevent direct client manipulation of Pet task rows.

begin;

with target as (
  select id
  from public.profiles
  where lower(regexp_replace(username, '^@+', '')) = 'pawpupprincess'
  limit 1
)
update auth.users
set banned_until = 'infinity'::timestamptz
where id in (select id from target);

update public.profiles
set hide_from_leaderboard = true,
    updated_at = now()
where lower(regexp_replace(username, '^@+', '')) = 'pawpupprincess';

revoke all on function public.add_user_xp(uuid, integer) from public, anon, authenticated;
revoke all on function public.apply_user_level_season_bonus(integer, integer) from public, anon, authenticated;
revoke all on function public.perform_level_drain(uuid) from public, anon, authenticated;
revoke all on function public.perform_rights_action(uuid, text) from public, anon, authenticated;
grant execute on function public.add_user_xp(uuid, integer) to service_role;
grant execute on function public.apply_user_level_season_bonus(integer, integer) to service_role;
grant execute on function public.perform_level_drain(uuid) to service_role;
grant execute on function public.perform_rights_action(uuid, text) to service_role;

drop trigger if exists block_client_user_pet_tasks_mutations_trigger on public.user_pet_tasks;
create trigger block_client_user_pet_tasks_mutations_trigger
  before insert or update or delete on public.user_pet_tasks
  for each row
  execute function public.block_client_owned_table_mutations();

commit;
