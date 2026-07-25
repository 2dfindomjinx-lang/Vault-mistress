import {
  buildClickGameStatus,
  CLICK_GAME_TOGGLE_RATE_LIMIT_MAX,
  CLICK_GAME_TOGGLE_RATE_LIMIT_WINDOW_SECONDS,
} from "@/lib/click-game";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function getAuthedUserId() {
  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return { error: jsonError(authError?.message ?? "Authentication required.", 401), userId: null };
  }

  return { error: null, userId: authData.user.id };
}

export async function POST() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authResult = await getAuthedUserId();
  if (authResult.error) return authResult.error;

  const supabase = createSupabaseAdminClient();
  const userId = authResult.userId!;

  const rateLimit = await checkRateLimit(
    supabase,
    `click-game-reset:${userId}`,
    CLICK_GAME_TOGGLE_RATE_LIMIT_MAX,
    CLICK_GAME_TOGGLE_RATE_LIMIT_WINDOW_SECONDS,
  );
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  const { data, error } = await supabase.rpc("click_game_reset", { p_user_id: userId });

  if (error) {
    console.error("[click-game] reset failed", error);
    return jsonError(error.message, 500);
  }

  return Response.json({
    status: buildClickGameStatus({
      progress: data.progress,
      isActive: data.isActive,
      lastClickAt: data.lastClickAt,
      weeklyClicks: data.weeklyClicks,
      lifetimeClicks: data.lifetimeClicks,
      serverNowIso: data.serverNowIso,
    }),
  });
}
