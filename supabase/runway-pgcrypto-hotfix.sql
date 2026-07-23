-- Run this once on an existing project where Runway returns
-- "function digest(text, unknown) does not exist".
--
-- The Runway RPCs use pgcrypto's digest() to make idempotency receipts safe.
-- Supabase installs extensions in the `extensions` schema, while these
-- security-definer functions intentionally restrict their search path.

create extension if not exists pgcrypto with schema extensions;

alter function public.submit_voting_avatar(uuid, jsonb, text, boolean, text, boolean)
  set search_path = public, extensions;

alter function public.cast_avatar_vote(uuid, uuid, smallint, uuid, text, integer, integer, date)
  set search_path = public, extensions;

alter function public.skip_avatar_vote(uuid, uuid, uuid, text)
  set search_path = public, extensions;
