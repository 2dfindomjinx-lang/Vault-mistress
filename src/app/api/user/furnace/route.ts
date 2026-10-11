import { executeWalletAction, validWalletRequestId } from "@/lib/wallet-action";
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

  const body = (await request.json().catch(() => null)) as { amount?: number; requestId?: string } | null;
  const amount = Number(body?.amount);
  if (!validWalletRequestId(body?.requestId)) return jsonError("Refresh before using the furnace.", 422);
  if (!isValidBurnAmount(amount)) {
    return jsonError(`Burn between ${FURNACE_MIN_BURN} and ${FURNACE_MAX_BURN} Principessa Money.`);
  }

  const supabase = createSupabaseAdminClient();

  // Tighter than the conversion limit. Converting is reversible in effect - you
  // still hold the value as coins. This is not.
  const limit = await checkRateLimit(supabase, `furnace-burn:${userId}`, 6, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const action = await executeWalletAction(supabase, userId, body.requestId, "furnace", amount);
  if (action.response) return action.response;
  return Response.json({ ...action.result, profile: action.profile }, { headers: { "Cache-Control": "private, no-store" } });
}
