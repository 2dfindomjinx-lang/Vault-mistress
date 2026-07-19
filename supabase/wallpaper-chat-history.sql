alter table public.wallpaper_live_messages
  add column if not exists sender_role text not null default 'admin';

alter table public.wallpaper_live_messages
  drop constraint if exists wallpaper_live_messages_sender_role_check;

alter table public.wallpaper_live_messages
  add constraint wallpaper_live_messages_sender_role_check
  check (sender_role in ('admin', 'sub'));

create index if not exists wallpaper_live_messages_conversation_idx
  on public.wallpaper_live_messages(app_key, activation_id, created_at desc);

comment on column public.wallpaper_live_messages.sender_role is
  'Message author. Existing Live Message rows are preserved as admin history.';
