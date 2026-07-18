alter table public.user_prestige_badges
  add column if not exists equipped boolean not null default false;

alter table public.user_prestige_badges
  alter column equipped set default false;
