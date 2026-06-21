create table if not exists public.site_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  active boolean not null default true,
  starts_at timestamp with time zone not null default now(),
  ends_at timestamp with time zone not null default (now() + interval '3 days'),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone
);

create index if not exists site_announcements_active_ends_idx
  on public.site_announcements(active, ends_at desc, created_at desc);

alter table public.site_announcements enable row level security;

drop policy if exists "Anyone can read active site announcements" on public.site_announcements;
create policy "Anyone can read active site announcements"
  on public.site_announcements for select
  using (active = true and starts_at <= now() and ends_at > now());

insert into public.site_announcements (title, body, active, starts_at, ends_at)
select
  'Announcement',
  'Higher or Lower and Case Opening have swapped places. Please check the new task positions before playing. This announcement will remain visible for 3 days.',
  true,
  now(),
  now() + interval '3 days'
where not exists (
  select 1
  from public.site_announcements
  where active = true
    and starts_at <= now()
    and ends_at > now()
);
