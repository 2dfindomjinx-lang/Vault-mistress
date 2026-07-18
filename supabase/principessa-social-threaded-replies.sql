alter table public.principessa_post_comments
  add column if not exists parent_comment_id uuid references public.principessa_post_comments(id) on delete cascade;

create index if not exists principessa_post_comments_parent_idx
  on public.principessa_post_comments(parent_comment_id, created_at)
  where parent_comment_id is not null;
