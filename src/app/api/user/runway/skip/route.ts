import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

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

  const userId = authData.user.id;
  const supabase = createSupabaseAdminClient();

  const rateLimit = await checkRateLimit(supabase, `runway-skip:${userId}`, 60, 60);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const avatarId = typeof body?.avatarId === "string" ? body.avatarId : null;
  const tokenId = typeof body?.tokenId === "string" ? body.tokenId : null;
  const idempotencyKey = typeof body?.idempotencyKey === "string" && body.idempotencyKey.length > 0 ? body.idempotencyKey : null;

  if (!avatarId || !tokenId || !idempotencyKey) {
    return jsonError("avatarId, tokenId, and idempotencyKey are required.", 400);
  }

  const { data, error } = await supabase.rpc("skip_avatar_vote", {
    p_voter_id: userId,
    p_avatar_id: avatarId,
    p_token_id: tokenId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error("[runway] skip_avatar_vote failed", error);
    return jsonError(error.message, 500);
  }

  const result = data as { error?: string } | null;
  if (result?.error) {
    const status = result.error === "idempotency_key_reused_with_different_payload" ? 409 : 400;
    return Response.json(result, { status });
  }

  return Response.json(result);
}
