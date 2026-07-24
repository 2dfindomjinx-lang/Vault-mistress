import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isTrustedAdminUserId } from "@/lib/admin-identity";
import { getGmt3DateKey } from "@/lib/time";

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
  const supabase = createSupabaseAdminClient();

  const rateLimit = await checkRateLimit(supabase, `runway-candidate:${userId}`, 30, 60);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  const { data, error } = await supabase.rpc("get_runway_candidate", { p_viewer_id: userId });

  if (error) {
    console.error("[runway] get_runway_candidate failed", error);
    return jsonError(error.message, 500);
  }

  const result = data as {
    error?: string;
    empty?: boolean;
    tokenId?: string;
    avatarId?: string;
    existingRating?: number | null;
  } | null;

  if (result?.error) {
    return jsonError(result.error, 400);
  }

  if (!result || result.empty || !result.avatarId) {
    return Response.json({ candidate: null });
  }

  const { data: avatar, error: avatarError } = await supabase
    .from("voting_avatars")
    .select("id, owner_user_id, equipped_avatar_slots, equipped_full_set_id, has_uncensored_avatar, total_points, rating_count, super_vote_count, created_at")
    .eq("id", result.avatarId)
    .maybeSingle();

  if (avatarError || !avatar) {
    return Response.json({ candidate: null });
  }

  const { data: owner } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", avatar.owner_user_id)
    .maybeSingle();

  const todayStart = `${getGmt3DateKey()}T00:00:00+03:00`;
  const { count: superVotesUsedToday } = await supabase
    .from("runway_super_votes")
    .select("id", { count: "exact", head: true })
    .eq("voter_user_id", userId)
    .gte("created_at", todayStart);

  return Response.json({
    candidate: {
      tokenId: result.tokenId,
      avatarId: avatar.id,
      ownerUserId: avatar.owner_user_id,
      username: owner?.username ? `@${String(owner.username).replace(/^@/, "")}` : "@unknown",
      displayName: owner?.display_name ?? null,
      equippedAvatarSlots: avatar.equipped_avatar_slots ?? {},
      equippedFullSetId: avatar.equipped_full_set_id ?? null,
      hasUncensoredAvatar: Boolean(avatar.has_uncensored_avatar),
      totalPoints: Number(avatar.total_points ?? 0),
      ratingCount: Number(avatar.rating_count ?? 0),
      superVoteCount: Number(avatar.super_vote_count ?? 0),
      canReceiveSuperVote: !isTrustedAdminUserId(String(avatar.owner_user_id)),
      superVotesUsedToday: Number(superVotesUsedToday ?? 0),
      submittedAt: avatar.created_at,
      existingRating: result.existingRating ?? null,
    },
  });
}
