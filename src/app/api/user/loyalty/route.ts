import { profileSelect } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

const DAY_MS = 24 * 60 * 60 * 1000;

type ProfileRow = {
  id: string;
  last_loyalty_at: string | null;
  loyalty_streak: number | null;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function isWithinLast24Hours(value: string | null) {
  if (!value) {
    return false;
  }

  return Date.now() - new Date(value).getTime() < DAY_MS;
}

export async function POST() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const supabase = createSupabaseAdminClient();
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profileData) {
    return jsonError(profileError?.message ?? "Profile not found.", 404);
  }

  const profile = profileData as ProfileRow;

  if (isWithinLast24Hours(profile.last_loyalty_at)) {
    return Response.json({ profile: profileData });
  }

  const lastLoyaltyTime = profile.last_loyalty_at ? new Date(profile.last_loyalty_at).getTime() : 0;
  const streakExpired = !lastLoyaltyTime || Date.now() - lastLoyaltyTime > 48 * 60 * 60 * 1000;
  const nextLoyaltyAt = new Date().toISOString();
  const nextLoyaltyStreak = streakExpired ? 1 : Math.max(1, (profile.loyalty_streak ?? 0) + 1);

  let updateQuery = supabase
    .from("profiles")
    .update({
      last_loyalty_at: nextLoyaltyAt,
      loyalty_streak: nextLoyaltyStreak,
      updated_at: nextLoyaltyAt,
    })
    .eq("id", authData.user.id);

  updateQuery = typeof profile.loyalty_streak === "number"
    ? updateQuery.eq("loyalty_streak", profile.loyalty_streak)
    : updateQuery.is("loyalty_streak", null);

  updateQuery = profile.last_loyalty_at
    ? updateQuery.eq("last_loyalty_at", profile.last_loyalty_at)
    : updateQuery.is("last_loyalty_at", null);

  const { data: updatedProfile, error: updateError } = await updateQuery
    .select(profileSelect)
    .maybeSingle();

  if (updateError || !updatedProfile) {
    return jsonError(updateError?.message ?? "Loyalty update was stale or duplicated.", updateError ? 500 : 409);
  }

  return Response.json({ profile: updatedProfile });
}
