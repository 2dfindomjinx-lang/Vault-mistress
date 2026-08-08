import { profileSelect } from "@/lib/server-game-rules";
import { createSupabaseAdminClient, getSupabaseAdminConfigErrors, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

const DAY_MS = 24 * 60 * 60 * 1000;
const RANSOM_COSTS = [50, 125, 250, 500, 1000];

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST() {
  if (!isSupabaseAdminConfigured) return jsonError(getSupabaseAdminConfigErrors().join(", "), 500);
  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();
  if (authError || !authData.user) return jsonError("Authentication required.", 401);

  const supabase = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase.from("profiles").select(profileSelect).eq("id", authData.user.id).single();
  if (profileError || !profile) return jsonError(profileError?.message ?? "Profile not found.", 404);

  const last = profile.last_loyalty_at ? new Date(profile.last_loyalty_at).getTime() : 0;
  const elapsed = last ? Date.now() - last : Number.POSITIVE_INFINITY;
  if (!last || elapsed <= 48 * 60 * 60 * 1000 || elapsed > 96 * 60 * 60 * 1000) {
    return jsonError("Your streak is not eligible for ransom recovery.", 409);
  }

  const streak = Math.max(1, Number(profile.loyalty_streak ?? 1));
  const cost = RANSOM_COSTS[Math.min(RANSOM_COSTS.length - 1, Math.floor(streak / 7))];
  const coins = Number(profile.coins ?? 0);
  if (coins < cost) return jsonError(`You need ${cost} coins to recover this streak.`, 402);

  const now = new Date().toISOString();
  const nextCoins = coins - cost;
  const { data: updatedProfile, error: updateError } = await supabase.from("profiles")
    .update({ coins: nextCoins, last_loyalty_at: now, updated_at: now })
    .eq("id", authData.user.id)
    .eq("coins", coins)
    .eq("last_loyalty_at", profile.last_loyalty_at)
    .select(profileSelect)
    .maybeSingle();
  if (updateError || !updatedProfile) return jsonError(updateError?.message ?? "Streak recovery was stale.", updateError ? 500 : 409);

  const { error: transactionError } = await supabase.from("coin_transactions").insert({
    amount: -cost,
    balance_before: coins,
    balance_after: nextCoins,
    metadata: { streak, recovery: "ransom" },
    reason: "streak_ransom",
    user_id: authData.user.id,
  });
  if (transactionError) return jsonError("Streak recovery logging failed.", 500);

  return Response.json({ cost, profile: updatedProfile });
}
