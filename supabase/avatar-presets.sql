-- Avatar Presets: up to 3 saved avatar loadouts (equipped_avatar_slots +
-- equipped_full_set_id combinations) the user can switch between instantly.
-- Slot 1 is free by default; slots 2 and 3 must be unlocked with coins.
alter table public.profiles
  add column if not exists avatar_presets jsonb not null default '[]'::jsonb,
  add column if not exists unlocked_avatar_preset_slots smallint not null default 1;
