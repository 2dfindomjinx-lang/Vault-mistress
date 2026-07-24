import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { isTrustedAdminUserId } from "@/lib/admin-identity";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getGmt3DateKey } from "@/lib/time";

type Body = {
  avatarId?: string;
  tokenId?: string;
  idempotencyKey?: string;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();
  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const avatarId = typeof body?.avatarId === "string" ? body.avatarId : null;
  const tokenId = typeof body?.tokenId === "string" ? body.tokenId : null;
  const idempotencyKey = typeof body?.idempotencyKey === "string" && body.idempotencyKey.length > 0 ? body.idempotencyKey : null;
  if (!avatarId || !tokenId || !idempotencyKey) {
    return jsonError("avatarId, tokenId, and idempotencyKey are required.");
  }

  const userId = authData.user.id;
  const supabase = createSupabaseAdminClient();
  const rateLimit = await checkRateLimit(supabase, `runway-super-vote:${userId}`, 10, 60);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  // Keep the server-side exclusion in addition to the hidden client control.
  const { data: avatar, error: avatarError } = await supabase
    .from("voting_avatars")
    .select("owner_user_id")
    .eq("id", avatarId)
    .maybeSingle();
  if (avatarError) return jsonError(avatarError.message, 500);
  if (!avatar) return jsonError("Voting avatar not found.", 404);
  if (isTrustedAdminUserId(String(avatar.owner_user_id))) {
    return jsonError("Super Votes are unavailable for admin avatars.", 403);
  }

  const { data, error } = await supabase.rpc("cast_runway_super_vote", {
    p_voter_id: userId,
    p_avatar_id: avatarId,
    p_token_id: tokenId,
    p_idempotency_key: idempotencyKey,
    p_today_key: getGmt3DateKey(),
  });
  if (error) {
    console.error("[runway] cast_runway_super_vote failed", error);
    return jsonError(error.message, 500);
  }

  const result = data as { error?: string } | null;
  if (result?.error) {
    return Response.json(result, {
      status: result.error === "idempotency_key_reused_with_different_payload" ? 409 : 400,
    });
  }

  return Response.json(result);
}
