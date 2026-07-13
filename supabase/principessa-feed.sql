create table if not exists public.principessa_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete restrict,
  channel text not null default 'principessa' check (channel in ('principessa', 'sub')),
  status text not null default 'published' check (status in ('pending', 'published', 'rejected')),
  title text not null check (char_length(title) between 2 and 120),
  description text not null check (char_length(description) between 1 and 4000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.principessa_posts
  add column if not exists channel text not null default 'principessa',
  add column if not exists status text not null default 'published',
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamp with time zone;

create index if not exists principessa_posts_channel_status_created_idx
  on public.principessa_posts(channel, status, created_at desc);

create table if not exists public.principessa_post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.principessa_posts(id) on delete cascade,
  image_url text not null,
  storage_path text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamp with time zone not null default now(),
  unique (post_id, sort_order)
);

create table if not exists public.principessa_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.principessa_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.principessa_feed_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  avatar_path text,
  header_path text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists principessa_posts_created_at_idx
  on public.principessa_posts(created_at desc);

create index if not exists principessa_post_images_post_id_idx
  on public.principessa_post_images(post_id, sort_order);

create index if not exists principessa_post_comments_post_id_idx
  on public.principessa_post_comments(post_id, created_at);

create index if not exists principessa_post_comments_user_created_idx
  on public.principessa_post_comments(user_id, created_at desc);

alter table public.principessa_posts enable row level security;
alter table public.principessa_post_images enable row level security;
alter table public.principessa_post_comments enable row level security;
alter table public.principessa_feed_profiles enable row level security;

revoke all on public.principessa_posts from anon, authenticated;
revoke all on public.principessa_post_images from anon, authenticated;
revoke all on public.principessa_post_comments from anon, authenticated;
revoke all on public.principessa_feed_profiles from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'principessa-feed',
  'principessa-feed',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
