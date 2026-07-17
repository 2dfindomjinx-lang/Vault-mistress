-- Free, user-changeable preference: sub / femsub / neutral.
-- Used for short UI copy ("Good boy" / "Good girl" / "Good pet"), speech-bubble
-- genderization, pet task copy, IRL task wheel pools, and audience-locked cosmetics.
alter table public.profiles
  add column if not exists address_term text not null default 'sub';

-- Migrate legacy values if the column already existed as boy/girl.
update public.profiles set address_term = 'sub' where address_term = 'boy';
update public.profiles set address_term = 'femsub' where address_term = 'girl';
update public.profiles set address_term = 'sub' where address_term is null or address_term = '';

alter table public.profiles
  alter column address_term set default 'sub';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_address_term_valid'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_address_term_valid;
  END IF;

  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_address_term_valid
    CHECK (address_term IN ('sub', 'femsub', 'neutral'));
END $$;
