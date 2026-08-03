-- Effectively permanent timeout ("ban") for @gooner12378 - locks tribute/task/
-- click-game/etc. spend actions indefinitely via the existing timeout_until
-- mechanism (same field the admin panel's Timeout tool writes to).
-- Run once in the Supabase SQL editor.

update public.profiles
set
  timeout_until = now() + interval '100 years',
  timeout_reason = 'Banned by admin.',
  updated_at = now()
where username = 'gooner12378' or twitter_handle = 'gooner12378';
