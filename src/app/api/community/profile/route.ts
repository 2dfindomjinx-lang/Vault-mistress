import { loadCommunityProfiles } from "@/lib/prestige-server";
import { getFastUser } from "@/lib/supabase/fast-auth";
import { getGmt3MonthStart } from "@/lib/prestige";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(
      `Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`,
      500,
    );
  }

  const authSupabase = await createSupabaseServerClient();
  // Read-only: skip the Auth server round trip (see fast-auth.ts).
  const fastUser = await getFastUser(authSupabase);
  const authData = { user: fastUser };
  const authError = fastUser ? null : new Error("Authentication required.");

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim();

  if (!userId) {
    return jsonError("A userId is required.", 422);
  }

  const supabase = createSupabaseAdminClient();
  const profiles = await loadCommunityProfiles(supabase, [userId]);
  const profile = profiles.get(userId);

  if (!profile) {
    return jsonError("Profile not found.", 404);
  }

  const [caseMonthResult, caseAllTimeResult] = await Promise.all([
    supabase
      .from("crate_opens")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("opened_at", new Date(getGmt3MonthStart()).toISOString()),
    supabase
      .from("crate_opens")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  if (caseMonthResult.error) {
    return jsonError(caseMonthResult.error.message, 500);
  }

  if (caseAllTimeResult.error) {
    return jsonError(caseAllTimeResult.error.message, 500);
  }

  return Response.json({
    badges: profile.badges,
    profile: {
      addressTerm: profile.addressTerm,
      badgeImagePath: profile.badgeImagePath,
      badges: profile.badges,
      backgroundItemId: profile.backgroundItemId,
      displayName: profile.displayName,
      equippedAvatarSlots: profile.equippedAvatarSlots,
      equippedFullSetId: profile.equippedFullSetId,
      frameColor: profile.frameColor,
      frameItemId: profile.frameItemId,
      frameVariant: profile.frameVariant,
      hasUncensoredAvatar: profile.hasUncensoredAvatar,
      loyaltyStreak: profile.loyaltyStreak,
      titleName: profile.titleName,
      totalDevotion: profile.totalDevotion,
      tributeTotal: profile.tributeTotal,
      userId: profile.userId,
      username: profile.username,
      usernameStyle: profile.usernameStyle,
    },
    stats: [
      { label: "Tribute Total", value: profile.tributeTotal.toLocaleString() },
      { label: "Total Devotion", value: profile.totalDevotion.toLocaleString() },
      { label: "Login Streak", value: `${profile.loyaltyStreak.toLocaleString()} days` },
      { label: "Cases This Month", value: (caseMonthResult.count ?? 0).toLocaleString() },
      { label: "Cases All Time", value: (caseAllTimeResult.count ?? 0).toLocaleString() },
    ],
  });
}
