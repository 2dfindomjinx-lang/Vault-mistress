import {
  buildClickGameStatus,
  CLICK_GAME_BATCH_MAX_CLICKS,
  CLICK_GAME_CLICK_RATE_LIMIT_MAX,
  CLICK_GAME_CLICK_RATE_LIMIT_WINDOW_SECONDS,
  CLICK_GAME_COST_PER_CLICK,
  CLICK_GAME_DECAY_INTERVAL_MS,
  CLICK_GAME_DECAY_PER_TICK,
  CLICK_GAME_IDLE_GRACE_MS,
  DEFAULT_CLICK_GAME_CATEGORY,
  isClickGameCategoryId,
} from "@/lib/click-game";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  clicks?: number;
  category?: string;
};

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

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authResult = await getAuthedUserId();
  if (authResult.error) return authResult.error;

  const supabase = createSupabaseAdminClient();
  const userId = authResult.userId!;

  const rateLimit = await checkRateLimit(
    supabase,
    `click-game-click:${userId}`,
    CLICK_GAME_CLICK_RATE_LIMIT_MAX,
    CLICK_GAME_CLICK_RATE_LIMIT_WINDOW_SECONDS,
  );
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const clicks = Math.max(1, Math.min(CLICK_GAME_BATCH_MAX_CLICKS, Math.floor(Number(body?.clicks) || 1)));
  const category = isClickGameCategoryId(body?.category) ? body.category : DEFAULT_CLICK_GAME_CATEGORY;

  const { data, error } = await supabase.rpc("click_game_category_click", {
    p_user_id: userId,
    p_category_id: category,
    p_cost: CLICK_GAME_COST_PER_CLICK,
    p_clicks: clicks,
    p_idle_grace_ms: CLICK_GAME_IDLE_GRACE_MS,
    p_decay_interval_ms: CLICK_GAME_DECAY_INTERVAL_MS,
    p_decay_per_tick: CLICK_GAME_DECAY_PER_TICK,
  });

  if (error) {
    console.error("[click-game] click failed", error);
    return jsonError(error.message, 500);
  }

  if (data?.error === "not_active") {
    return jsonError("Start the game before clicking.", 409);
  }
  if (data?.error === "insufficient_coins") {
    return jsonError("Not enough coins for another click.", 402);
  }
  if (data?.error === "profile_not_found") {
    return jsonError("Profile not found.", 404);
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
    profile: { coins: data.coins },
    acceptedClicks: data.acceptedClicks,
    requestedClicks: data.requestedClicks,
  });
}
