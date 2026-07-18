-- New badges stay in the collection until their owner deliberately equips them.
alter table public.user_prestige_badges
  add column if not exists equipped boolean not null default false;

alter table public.user_prestige_badges
  alter column equipped set default false;

-- Apply the new default to legacy awards as well, so existing users start
-- with a clean profile header and choose which badges to display.
update public.user_prestige_badges
set equipped = false
where equipped is distinct from false;

-- The completed Summer community goal grants Principessa Case keys only.
delete from public.user_prestige_badges
where badge_id = 'community-goal-summer-2026';
