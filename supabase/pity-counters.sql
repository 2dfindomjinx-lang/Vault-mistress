-- ============================================================
-- PITY COUNTERS FOR CRATE SYSTEMS (server-authoritative only)
-- ============================================================
-- These columns track bad-luck / pity protection for the two crate types.
-- They MUST be updated ONLY by backend API routes (using the Supabase admin/service_role client).
-- Clients must never write directly to them (they are protected similarly to hide_from_leaderboard, coins, etc.).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS principessa_case_bad_luck_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blessing_case_legendary_pity_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.principessa_case_bad_luck_count IS
  'Consecutive Common/Uncommon opens on Principessa Case. When >=9 the next open is forced Epic (bad-luck protection). Reset on Rare+ or after guarantee.';

COMMENT ON COLUMN public.profiles.blessing_case_legendary_pity_count IS
  'Number of 0.6% Blessing Case opens since the last Legendary (natural or guaranteed). When >=149 the next open is forced Legendary. Reset on any Legendary.';

-- Optional but recommended: extend the existing client-mutation protection trigger
-- so that regular authenticated users cannot touch these fields.
-- (The existing block_client_owned_table_mutations / protect_profile_admin_fields already block most sensitive fields;
--  we only need to add explicit checks if the generic trigger does not cover new columns.)

-- If you want explicit protection (recommended for clarity), run the following after the ALTER:
--
-- CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- SET search_path = public
-- AS $$
-- BEGIN
--   IF public.is_privileged_db_context() THEN
--     RETURN NEW;
--   END IF;
--
--   -- ... existing checks ...
--
--   -- New pity counters (server-only)
--   IF NEW.principessa_case_bad_luck_count IS DISTINCT FROM OLD.principessa_case_bad_luck_count THEN
--     RAISE EXCEPTION 'principessa_case_bad_luck_count cannot be changed from the client';
--   END IF;
--
--   IF NEW.blessing_case_legendary_pity_count IS DISTINCT FROM OLD.blessing_case_legendary_pity_count THEN
--     RAISE EXCEPTION 'blessing_case_legendary_pity_count cannot be changed from the client';
--   END IF;
--
--   RETURN NEW;
-- END;
-- $$;

-- (If you already have a similar trigger, just add the two IF blocks above inside it.)

-- After applying this file, restart your backend or re-deploy so the new columns are visible
-- to the admin client used in /api/user/crates/route.ts.

-- Initial data (safe – new columns default to 0):
-- UPDATE public.profiles SET principessa_case_bad_luck_count = 0, blessing_case_legendary_pity_count = 0 WHERE principessa_case_bad_luck_count IS NULL;
-- (Not needed if you used DEFAULT 0 on the ALTER.)