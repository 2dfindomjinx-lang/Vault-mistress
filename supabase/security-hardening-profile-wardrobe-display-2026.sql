-- Standalone security hardening migration for profile, wardrobe, display name, username, cosmetics.
-- Run this separately after previous schema.
-- Enforces backend as source of truth, protects fields, adds constraints for username/display/coins.

-- 1. Add new protected columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipped_avatar_slots jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS has_uncensored_avatar boolean NOT NULL DEFAULT false;

-- 2. Add/enforce constraints
-- IMPORTANT: Coins CAN go negative in this system (e.g. debt contract payments when user pays manually,
-- certain admin drains, evil contracts etc.). Do NOT add coins >= 0 check.
-- The trigger below only blocks *client* from changing coins (using service_role bypasses it).
-- Business logic in server routes decides when negative is allowed.

-- Display name constraints (length 2-24, trim, no control chars)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_display_name_valid;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_valid CHECK (
    display_name IS NULL OR (
      length(btrim(display_name)) >= 2 AND
      length(btrim(display_name)) <= 24 AND
      display_name !~ '[\x00-\x1F\x7F\n\r]' AND
      btrim(display_name) <> ''
    )
  );

-- Case-insensitive unique username (in addition to existing unique)
-- Detect duplicates first (case variants like "foo" and "Foo")
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.profiles
    GROUP BY lower(username)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create case-insensitive unique index on username: existing duplicate usernames detected (case variants). Please resolve manually before running this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_ci_unique 
  ON public.profiles (lower(username));

-- 3. Extend protect trigger for new fields and username/twitter
CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_privileged_db_context() THEN
    RETURN new;
  END IF;

  IF tg_op = 'INSERT' THEN
    new.coins := 100;
    new.affection := 0;
    new.tribute_total := 0;
    new.shame_count := 0;
    new.is_admin := false;
    new.hide_from_leaderboard := false;
    new.pet_score := 0;
    new.owner_likeness := 100;
    new.has_uncensored_avatar := false;
    new.equipped_avatar_slots := '{}'::jsonb;
    -- username set by bootstrap route
    RETURN new;
  END IF;

  -- Block client changes to protected fields
  IF new.is_admin IS DISTINCT FROM old.is_admin THEN
    RAISE EXCEPTION 'is_admin cannot be changed from the client';
  END IF;

  IF new.hide_from_leaderboard IS DISTINCT FROM old.hide_from_leaderboard THEN
    RAISE EXCEPTION 'hide_from_leaderboard cannot be changed from the client';
  END IF;

  IF new.coins IS DISTINCT FROM old.coins THEN
    RAISE EXCEPTION 'coins cannot be changed from the client';
  END IF;

  IF new.affection IS DISTINCT FROM old.affection THEN
    RAISE EXCEPTION 'affection cannot be changed from the client';
  END IF;

  IF new.tribute_total IS DISTINCT FROM old.tribute_total THEN
    RAISE EXCEPTION 'tribute_total cannot be changed from the client';
  END IF;

  IF new.shame_count IS DISTINCT FROM old.shame_count THEN
    RAISE EXCEPTION 'shame_count cannot be changed from the client';
  END IF;

  IF new.pet_score IS DISTINCT FROM old.pet_score THEN
    RAISE EXCEPTION 'pet_score cannot be changed from the client';
  END IF;

  IF new.owner_likeness IS DISTINCT FROM old.owner_likeness THEN
    RAISE EXCEPTION 'owner_likeness cannot be changed from the client';
  END IF;

  IF new.username IS DISTINCT FROM old.username THEN
    RAISE EXCEPTION 'username cannot be changed from the client';
  END IF;

  IF new.twitter_handle IS DISTINCT FROM old.twitter_handle THEN
    RAISE EXCEPTION 'twitter_handle cannot be changed from the client';
  END IF;

  IF new.has_uncensored_avatar IS DISTINCT FROM old.has_uncensored_avatar THEN
    RAISE EXCEPTION 'has_uncensored_avatar cannot be changed from the client';
  END IF;

  IF new.equipped_avatar_slots IS DISTINCT FROM old.equipped_avatar_slots THEN
    RAISE EXCEPTION 'equipped_avatar_slots cannot be changed from the client';
  END IF;

  RETURN new;
END;
$$;

-- Re-attach trigger (drop/create)
DROP TRIGGER IF EXISTS protect_profile_admin_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_admin_fields_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_admin_fields();

-- 4. Block direct client mutations on wardrobe related if needed, but use existing block for crate inventory.
-- Ensure block_client for new if table added, but we use profile jsonb.

-- 5. RLS updates - ensure policies prevent client writes to protected.
-- Re-create key policies to be explicit. Users can only update safe fields via allowed paths.
-- (Existing RLS in schema/public-read-access already limit, but harden here)

-- Profiles: allow update only on safe fields (but trigger blocks anyway)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Note: trigger will raise on protected field changes. For RLS, allow but DB enforces.
-- To be stricter, could use column level, but Postgres RLS column is limited; use trigger.

-- For user_crate_inventory, ensure no direct equip (already blocked by trigger in hardening)
-- Add explicit if needed.

-- 6. Add index for performance on username lower, and for equipped queries if needed.
CREATE INDEX IF NOT EXISTS profiles_equipped_avatar_slots_gin ON public.profiles USING GIN (equipped_avatar_slots);

-- 7. For uncensored and wardrobe, ownership validated in routes using user_crate_inventory and profile.

COMMENT ON COLUMN public.profiles.username IS 'Stable unique site @username. Source of truth in backend. Never changed client-side. Use for admin/display alias only.';
COMMENT ON COLUMN public.profiles.display_name IS 'Cosmetic only. Can duplicate. Validated server-side. Never used for auth/lookup.';
COMMENT ON COLUMN public.profiles.twitter_handle IS 'OAuth metadata reference only. May update on login. Not identity.';
COMMENT ON COLUMN public.profiles.equipped_avatar_slots IS 'Server-validated equipped wardrobe. Protected from direct client write.';
COMMENT ON COLUMN public.profiles.has_uncensored_avatar IS 'Server-controlled uncensored unlock state.';

-- Ensure RLS enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_crate_inventory ENABLE ROW LEVEL SECURITY; -- already

-- Backfill for existing profiles
UPDATE public.profiles SET equipped_avatar_slots = '{}'::jsonb WHERE equipped_avatar_slots IS NULL;
UPDATE public.profiles SET has_uncensored_avatar = false WHERE has_uncensored_avatar IS NULL;

-- Example additional RLS for safety (read own)
-- (Keep existing from public-read-access.sql and hardening)

-- End migration. Run with service role or in supabase migration.

-- MANUAL / TEST CHECKS (run after deploy):
-- 1. First display_name setup via bootstrap: free, only if missing. Second change requires 1000 coin deduction + tx.
-- 2. Changing display name with <1000 coins fails with 402.
-- 3. Duplicate display_names allowed (multiple profiles same display_name).
-- 4. Admin command /give @username resolves only by site username, not display_name. Audit tx has target_username_snapshot.
-- 5. Same Twitter handle on new signup: @name or @name2 etc, no rename existing user.
-- 6. Change Twitter handle on existing: twitter_handle updates, site username stable.
-- 7. Equip item not in user_crate_inventory: 403.
-- 8. Client spoof itemId/price/rarity ignored; server validates ownership and applies normalize rules.
-- 9. Double purchase display change right or uncensored: no double spend (atomic .eq coins or right consume).
-- 10. Direct client update to profiles.coins / username / equipped_avatar_slots / has_uncensored_avatar blocked by trigger.
-- 11. RLS: user can only select own; mutations on protected raise or blocked.
-- 12. Wardrobe equip/unequip/uncensored via /api/user/wardrobe only; returns authoritative state.