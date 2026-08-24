import { profileSelect } from "@/lib/server-game-rules";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { FURNACE_MAX_BURN, FURNACE_MIN_BURN, isValidBurnAmount } from "@/lib/tribute-furnace";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

// Burns Principessa Money. There is no counterpart route and there never should
// be one: burned Money does not come back, which is the only reason burning it
// means anything.
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

  const body = (await request.json().catch(() => null)) as { amount?: number } | null;
  const amount = Math.floor(Number(body?.amount));
  if (!isValidBurnAmount(amount)) {
    return jsonError(`Burn between ${FURNACE_MIN_BURN} and ${FURNACE_MAX_BURN} Principessa Money.`);
  }

  const supabase = createSupabaseAdminClient();

  // Tighter than the conversion limit. Converting is reversible in effect - you
  // still hold the value as coins. This is not.
  const limit = await checkRateLimit(supabase, `furnace-burn:${userId}`, 6, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  // The RPC locks the row and moves both columns together, so there is no
  // read-then-write window for a concurrent spend to slip through.
  const { data, error } = await supabase.rpc("burn_tribute_money", {
    p_amount: amount,
    p_user_id: userId,
  });

  if (error) {
    console.error("[furnace] burn failed", error);
    return jsonError("The furnace would not take it. Try again.", 500);
  }

  const result = (data ?? {}) as { burnedTotal?: number; error?: string; money?: number };

  if (result.error === "insufficient_money") {
    return jsonError(`You only have ${(result.money ?? 0).toLocaleString()} Principessa Money.`, 402);
  }
  if (result.error) {
    return jsonError("The furnace would not take it.", 400);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", userId)
    .single();

  return Response.json({
    burned: amount,
    burnedTotal: result.burnedTotal ?? 0,
    profile,
  });
}
