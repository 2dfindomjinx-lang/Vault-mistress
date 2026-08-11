import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isTrustedAdminUserId } from "@/lib/admin-identity";
import { getGmt3DateKey } from "@/lib/time";
import { RUNWAY_DAILY_REWARDED_VOTE_LIMIT } from "@/lib/server-game-rules";
import { generateOutfitBatch } from "@/lib/runway-outfit-generator";

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

  // House outfits exist to make the daily rewarded votes completable when the
  // real pool has run dry - not to pad the feed indefinitely. So they are only
  // offered while the viewer still has rewarded votes left today.
  const { data: voterProfile } = await supabase
    .from("profiles")
    .select("runway_rewarded_votes_today, runway_rewarded_votes_date")
    .eq("id", userId)
    .maybeSingle();

  const todayKey = getGmt3DateKey();
  const rewardedToday = voterProfile?.runway_rewarded_votes_date === todayKey
    ? Number(voterProfile?.runway_rewarded_votes_today ?? 0)
    : 0;
  const rewardedVotesLeft = Math.max(0, RUNWAY_DAILY_REWARDED_VOTE_LIMIT - rewardedToday);
  const allowGenerated = rewardedVotesLeft > 0;

  if (allowGenerated) {
    const { data: poolState } = await supabase.rpc("runway_candidate_pool_state", { p_viewer_id: userId });
    const pool = (poolState ?? {}) as { unratedReal?: number; unratedGenerated?: number };
    const unratedReal = Number(pool.unratedReal ?? 0);
    const unratedGenerated = Number(pool.unratedGenerated ?? 0);

    // Only top up once the real submissions are exhausted, so a healthy pool
    // never accumulates house outfits it does not need.
    if (unratedReal === 0 && unratedGenerated < rewardedVotesLeft) {
      const outfits = generateOutfitBatch(rewardedVotesLeft - unratedGenerated).map((outfit) => ({
        kind: outfit.kind,
        theme: outfit.theme,
        equippedAvatarSlots: outfit.equippedAvatarSlots,
      }));

      const { error: seedError } = await supabase.rpc("insert_generated_runway_outfits", { p_outfits: outfits });
      // A failure here only means the viewer sees a familiar avatar instead of
      // a fresh one; it must not fail the request.
      if (seedError) console.warn("[runway] generated outfit top-up failed", seedError);
    }
  }

  const { data, error } = await supabase.rpc("get_runway_candidate", {
    p_viewer_id: userId,
    p_allow_generated: allowGenerated,
  });

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
    .select("id, owner_user_id, equipped_avatar_slots, equipped_full_set_id, has_uncensored_avatar, total_points, rating_count, super_vote_count, created_at, is_generated, generated_kind, generated_theme")
    .eq("id", result.avatarId)
    .maybeSingle();

  if (avatarError || !avatar) {
    return Response.json({ candidate: null });
  }

  const isGenerated = Boolean(avatar.is_generated);

  // A generated outfit has no owner row to look up, and querying profiles with
  // a null id would match nothing anyway.
  const { data: owner } = isGenerated
    ? { data: null }
    : await supabase
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
      username: isGenerated
        ? "The House"
        : owner?.username
          ? `@${String(owner.username).replace(/^@/, "")}`
          : "@unknown",
      displayName: owner?.display_name ?? null,
      isGenerated,
      generatedKind: (avatar.generated_kind as "smart" | "random" | null) ?? null,
      generatedTheme: (avatar.generated_theme as string | null) ?? null,
      equippedAvatarSlots: avatar.equipped_avatar_slots ?? {},
      equippedFullSetId: avatar.equipped_full_set_id ?? null,
      hasUncensoredAvatar: Boolean(avatar.has_uncensored_avatar),
      totalPoints: Number(avatar.total_points ?? 0),
      ratingCount: Number(avatar.rating_count ?? 0),
      superVoteCount: Number(avatar.super_vote_count ?? 0),
      // Nobody to pay, so the server rejects it - do not offer the button.
      canReceiveSuperVote: !isGenerated && !isTrustedAdminUserId(String(avatar.owner_user_id)),
      superVotesUsedToday: Number(superVotesUsedToday ?? 0),
      submittedAt: avatar.created_at,
      existingRating: result.existingRating ?? null,
    },
  });
}
