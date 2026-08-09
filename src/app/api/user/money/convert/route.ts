import { profileSelect } from "@/lib/server-game-rules";
import { getMoneyConversionBreakdown } from "@/lib/principessa-money";
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

  const body = (await request.json().catch(() => null)) as { amount?: number } | null;
  const amount = Math.floor(Number(body?.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonError("Enter how much Principessa Money to convert.");
  }

  const supabase = createSupabaseAdminClient();

  const limit = await checkRateLimit(supabase, `money-convert:${userId}`, 10, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", userId)
    .single();

  if (profileError || !profileData) {
    return jsonError(profileError?.message ?? "Profile not found.", 404);
  }

  const profile = profileData as unknown as { coins: number; principessa_money: number };
  const money = Math.max(0, Math.floor(Number(profile.principessa_money) || 0));
  if (money < amount) {
    return jsonError(`You only have ${money.toLocaleString()} Principessa Money.`, 402);
  }

  // The bonus ladder lives on this route (not on the Throne payout) so the
  // payout can stay exactly 1 USD = 1 PM.
  const breakdown = getMoneyConversionBreakdown(amount);
  const now = new Date().toISOString();
  const nextMoney = money - amount;
  const nextCoins = profile.coins + breakdown.totalCoins;

  // Compare-and-swap on BOTH balances: a concurrent conversion and a concurrent
  // coin spend must not be able to interleave into a free grant.
  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({ coins: nextCoins, principessa_money: nextMoney, updated_at: now })
    .eq("id", userId)
    .eq("coins", profile.coins)
    .eq("principessa_money", money)
    .select(profileSelect)
    .maybeSingle();

  if (updateError || !updatedProfile) {
    // Null result means a balance moved under us - nothing was converted.
    return jsonError(updateError?.message ?? "Balance changed, try again.", updateError ? 500 : 409);
  }

  const { error: moneyLedgerError } = await supabase.from("money_transactions").insert({
    amount: -amount,
    balance_after: nextMoney,
    balance_before: money,
    metadata: { bonusCoins: breakdown.bonusCoins, bonusPercent: breakdown.bonusPercent, totalCoins: breakdown.totalCoins },
    reason: "convert:money-to-coins",
    user_id: userId,
  });

  if (moneyLedgerError) {
    await supabase
      .from("profiles")
      .update({ coins: profile.coins, principessa_money: money, updated_at: now })
      .eq("id", userId)
      .eq("coins", nextCoins)
      .eq("principessa_money", nextMoney);
    return jsonError("Conversion logging failed.", 500);
  }

  // Best-effort: the coin ledger mirroring this conversion is useful for
  // reporting but must not roll back a completed conversion if it fails.
  const { error: coinLedgerError } = await supabase.from("coin_transactions").insert({
    amount: breakdown.totalCoins,
    balance_after: nextCoins,
    balance_before: profile.coins,
    metadata: { bonusPercent: breakdown.bonusPercent, pmAmount: amount },
    reason: "convert:money-to-coins",
    user_id: userId,
  });

  if (coinLedgerError) {
    console.warn("[money-convert] coin ledger insert failed", coinLedgerError);
  }

  return Response.json({ breakdown, profile: updatedProfile });
}
