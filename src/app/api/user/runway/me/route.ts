import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { isTrustedAdminUserId } from "@/lib/admin-identity";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();
  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const userId = authData.user.id;
  const canAddMultipleAvatars = isTrustedAdminUserId(userId);
  const supabase = createSupabaseAdminClient();

  const { data: avatar, error: avatarError } = await supabase
    .from("voting_avatars")
    .select(
      "id, equipped_avatar_slots, equipped_full_set_id, has_uncensored_avatar, total_points, rating_count, times_shown, skip_count, is_active, created_at, activated_at",
    )
    .eq("owner_user_id", userId)
    .order("activated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (avatarError) {
    console.error("[runway] me lookup failed", avatarError);
    return jsonError(avatarError.message, 500);
  }

  if (!avatar) {
    return Response.json({ avatar: null });
  }

  let rank: number | null = null;
  const { data: leaderboardData, error: leaderboardError } = await supabase.rpc("get_runway_leaderboard", {
    p_section: "top",
    p_limit: 1,
    // An admin can have several active entries, while the legacy RPC returns
    // one viewer row. The editor remains usable without a single rank badge.
    p_viewer_id: canAddMultipleAvatars ? null : userId,
  });

  if (leaderboardError) {
    console.warn("[runway] rank lookup failed", leaderboardError);
  } else {
    const viewerRow = (leaderboardData as { viewer?: { rank?: number } } | null)?.viewer;
    rank = typeof viewerRow?.rank === "number" ? viewerRow.rank : null;
  }

  const activatedAtMs = new Date(avatar.activated_at as string).getTime();
  const nextEligibleAt = new Date(activatedAtMs + 7 * 24 * 60 * 60 * 1000).toISOString();

  return Response.json({
    canAddMultipleAvatars,
    avatar: {
      id: avatar.id,
      equippedAvatarSlots: avatar.equipped_avatar_slots ?? {},
      equippedFullSetId: avatar.equipped_full_set_id ?? null,
      hasUncensoredAvatar: Boolean(avatar.has_uncensored_avatar),
      totalPoints: Number(avatar.total_points ?? 0),
      ratingCount: Number(avatar.rating_count ?? 0),
      timesShown: Number(avatar.times_shown ?? 0),
      skipCount: Number(avatar.skip_count ?? 0),
      isActive: Boolean(avatar.is_active),
      createdAt: avatar.created_at,
      activatedAt: avatar.activated_at,
      rank,
      nextEligibleAt,
      canResubmit: canAddMultipleAvatars || Date.now() >= activatedAtMs + 7 * 24 * 60 * 60 * 1000,
    },
  });
}
