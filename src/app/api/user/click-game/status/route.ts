import {
  buildClickGameStatus,
  CLICK_GAME_DECAY_INTERVAL_MS,
  CLICK_GAME_DECAY_PER_TICK,
  CLICK_GAME_IDLE_GRACE_MS,
} from "@/lib/click-game";
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

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authResult = await getAuthedUserId();
  if (authResult.error) return authResult.error;

  const supabase = createSupabaseAdminClient();
  const userId = authResult.userId!;

  const { data, error } = await supabase.rpc("click_game_status", {
    p_user_id: userId,
    p_idle_grace_ms: CLICK_GAME_IDLE_GRACE_MS,
    p_decay_interval_ms: CLICK_GAME_DECAY_INTERVAL_MS,
    p_decay_per_tick: CLICK_GAME_DECAY_PER_TICK,
  });

  if (error) {
    console.error("[click-game] status failed", error);
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
