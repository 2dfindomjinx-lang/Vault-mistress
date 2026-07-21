-- "Full Set" avatar category: a single pre-rendered whole-character
-- illustration that replaces the base model + every layer entirely when
-- equipped. Independent of equipped_avatar_slots (no layering interaction).
alter table public.profiles
  add column if not exists equipped_full_set_id text;
