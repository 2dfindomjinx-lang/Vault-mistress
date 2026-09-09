-- Prospective first-observed milestones; no reconstructed historical funnel.
begin;
create table if not exists public.product_milestones (
 user_id uuid not null references public.profiles(id) on delete cascade,
 milestone text not null check(milestone in ('first_visit','first_game','first_equipment','next_day_return')),
 occurred_at timestamptz not null default now(), primary key(user_id,milestone)
);
alter table public.product_milestones enable row level security;
revoke all on public.product_milestones from anon,authenticated;
grant all on public.product_milestones to service_role;
create or replace function public.capture_profile_milestones() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_new jsonb:=to_jsonb(new); v_old jsonb; v_first timestamptz; v_visit timestamptz;
begin
 if tg_op='UPDATE' then v_old:=to_jsonb(old); else v_old:='{}'; end if;
 if (v_new->>'last_login_at') is not null and (v_new->>'last_login_at') is distinct from (v_old->>'last_login_at') then
  v_visit:=(v_new->>'last_login_at')::timestamptz;
  insert into public.product_milestones(user_id,milestone,occurred_at) values(new.id,'first_visit',v_visit) on conflict do nothing;
  select occurred_at into v_first from public.product_milestones where user_id=new.id and milestone='first_visit';
  if (v_visit at time zone 'Europe/Istanbul')::date=(v_first at time zone 'Europe/Istanbul')::date+1 then
   insert into public.product_milestones(user_id,milestone,occurred_at) values(new.id,'next_day_return',v_visit) on conflict do nothing;
  end if;
 end if;
 if tg_op='UPDATE' and ((v_new->'equipped_avatar_slots') is distinct from (v_old->'equipped_avatar_slots') or (v_new->>'equipped_full_set_id') is distinct from (v_old->>'equipped_full_set_id'))
 and (coalesce(v_new->>'equipped_full_set_id','')<>'' or exists(select 1 from jsonb_each_text(case when jsonb_typeof(v_new->'equipped_avatar_slots')='object' then v_new->'equipped_avatar_slots' else '{}'::jsonb end) where value not in ('','classic'))) then
  insert into public.product_milestones(user_id,milestone) values(new.id,'first_equipment') on conflict do nothing;
 end if;
 return new;
end $$;
create or replace function public.capture_game_milestone() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.amount>0 and new.reason in ('reward:game:principessa-says','reward:game:crown-match','reward:game:royal-guard') then
  insert into public.product_milestones(user_id,milestone) values(new.user_id,'first_game') on conflict do nothing;
 end if;
 return new;
end $$;
drop trigger if exists capture_profile_milestones on public.profiles;
create trigger capture_profile_milestones after insert or update on public.profiles for each row execute function public.capture_profile_milestones();
drop trigger if exists capture_game_milestone on public.coin_transactions;
create trigger capture_game_milestone after insert on public.coin_transactions for each row execute function public.capture_game_milestone();
create or replace function public.get_product_milestone_counts() returns jsonb language sql security definer set search_path=public as $$
 with cohort as (select user_id,occurred_at from public.product_milestones where milestone='first_visit' and occurred_at>=now()-interval '30 days')
 select jsonb_build_object('firstVisits',count(*),'firstGames',count(*) filter(where exists(select 1 from public.product_milestones m where m.user_id=c.user_id and milestone='first_game')),
 'firstEquipment',count(*) filter(where exists(select 1 from public.product_milestones m where m.user_id=c.user_id and milestone='first_equipment')),
 'nextDayEligible',count(*) filter(where (c.occurred_at at time zone 'Europe/Istanbul')::date<(now() at time zone 'Europe/Istanbul')::date-1),
 'nextDayReturns',count(*) filter(where (c.occurred_at at time zone 'Europe/Istanbul')::date<(now() at time zone 'Europe/Istanbul')::date-1 and exists(select 1 from public.product_milestones m where m.user_id=c.user_id and milestone='next_day_return'))) from cohort c;
$$;
revoke all on function public.capture_profile_milestones(),public.capture_game_milestone(),public.get_product_milestone_counts() from public,anon,authenticated;
grant execute on function public.get_product_milestone_counts() to service_role;
commit;
