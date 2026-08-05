import { profileSelect } from "@/lib/server-game-rules";
import { DRAIN_SESSION_MAX_RATE, DRAIN_SESSION_MIN_RATE } from "@/lib/drain-session";
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

// All-time "Most Drained Subs" leaderboard.
export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authResult = await getAuthedUserId();
  if (authResult.error) return authResult.error;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("get_drain_session_leaderboard", { p_limit: 3 });

  if (error) {
    return jsonError(error.message, 500);
  }

  return Response.json({ leaderboard: data ?? [] });
}

// Periodic settlement call from an active Drain Session - deducts the coins
// that ticked away client-side since the last sync. Pure sink: no devotion,
// no pet score, nothing awarded back.
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authResult = await getAuthedUserId();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId!;

  const body = (await request.json().catch(() => null)) as { amount?: number } | null;
  const amount = Math.floor(Number(body?.amount));

  if (!Number.isFinite(amount) || amount < DRAIN_SESSION_MIN_RATE || amount > DRAIN_SESSION_MAX_RATE * 60) {
    return jsonError("Invalid drain amount.", 422);
  }

  const supabase = createSupabaseAdminClient();
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", userId)
    .single();

  if (profileError || !profileData) {
    return jsonError(profileError?.message ?? "Profile not found.", 404);
  }

  const coins = (profileData as { coins: number }).coins;
  const spendAmount = Math.min(amount, coins);

  if (spendAmount <= 0) {
    return jsonError("Not enough coins to drain.", 402);
  }

  const now = new Date().toISOString();
  const nextCoins = coins - spendAmount;

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({ coins: nextCoins, updated_at: now })
    .eq("id", userId)
    .eq("coins", coins)
    .select(profileSelect)
    .maybeSingle();

  if (updateError || !updatedProfile) {
    return jsonError(updateError?.message ?? "Drain sync was stale.", updateError ? 500 : 409);
  }

  const { error: transactionError } = await supabase.from("coin_transactions").insert({
    amount: -spendAmount,
    balance_after: nextCoins,
    balance_before: coins,
    reason: "drain:session",
    user_id: userId,
  });

  if (transactionError) {
    await supabase.from("profiles").update({ coins, updated_at: now }).eq("id", userId).eq("coins", nextCoins);
    return jsonError("Drain logging failed.", 500);
  }

  return Response.json({ profile: updatedProfile, drained: spendAmount });
}
