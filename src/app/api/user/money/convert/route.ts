import { executeWalletAction, validWalletRequestId } from "@/lib/wallet-action";
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

// Principessa Money -> Coins. There is deliberately no inverse route: coins are
// farmable and must never become paid currency.
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
  if (!validWalletRequestId(body?.requestId)) return jsonError("Refresh before converting.", 422);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return jsonError("Enter how much Principessa Money to convert.");
  }

  const supabase = createSupabaseAdminClient();

  const limit = await checkRateLimit(supabase, `money-convert:${userId}`, 10, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const action = await executeWalletAction(supabase, userId, body.requestId, "money-convert", amount);
  if (action.response) return action.response;
  return Response.json({ ...action.result, profile: action.profile }, { headers: { "Cache-Control": "private, no-store" } });
}
