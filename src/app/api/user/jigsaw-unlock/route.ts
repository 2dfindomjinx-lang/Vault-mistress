import { profileSelect } from "@/lib/server-game-rules";
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

// Pays coins to reveal one random external jigsaw link. There is deliberately
// no attempt row, no completion proof and no reward: the spend IS the whole
// transaction, so there is nothing to farm and nothing for an admin to review.
export async function POST() {
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

  const limit = await checkRateLimit(supabase, `jigsaw-unlock:${userId}`, 20, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const { data: links, error: linksError } = await supabase
    .from("jigsaw_links")
    .select("id, label, url, coin_cost")
    .eq("enabled", true);

  if (linksError) return jsonError(linksError.message, 500);
  if (!links || links.length === 0) {
    return jsonError("No jigsaws are available right now.", 404);
  }

  // Picked server-side so the client cannot steer which link it pays for.
  const link = links[Math.floor(Math.random() * links.length)];
  const cost = Math.max(0, Math.floor(Number(link.coin_cost)));

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", userId)
    .single();

  if (profileError || !profileData) {
    return jsonError(profileError?.message ?? "Profile not found.", 404);
  }

  const coins = (profileData as { coins: number }).coins;
  if (coins < cost) {
    return jsonError(`This jigsaw costs ${cost.toLocaleString()} coins.`, 402);
  }

  const now = new Date().toISOString();
  const nextCoins = coins - cost;

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({ coins: nextCoins, updated_at: now })
    .eq("id", userId)
    .eq("coins", coins)
    .select(profileSelect)
    .maybeSingle();

  if (updateError || !updatedProfile) {
    // Null result means the balance moved under us - nothing was charged.
    return jsonError(updateError?.message ?? "Balance changed, try again.", updateError ? 500 : 409);
  }

  const { error: transactionError } = await supabase.from("coin_transactions").insert({
    amount: -cost,
    balance_after: nextCoins,
    balance_before: coins,
    metadata: { jigsawLinkId: link.id, label: link.label, spendAmount: cost },
    reason: "spend:jigsaw-unlock",
    user_id: userId,
  });

  if (transactionError) {
    await supabase
      .from("profiles")
      .update({ coins, updated_at: now })
      .eq("id", userId)
      .eq("coins", nextCoins);
    return jsonError("Jigsaw unlock logging failed.", 500);
  }

  return Response.json({ label: link.label, profile: updatedProfile, url: link.url });
}
