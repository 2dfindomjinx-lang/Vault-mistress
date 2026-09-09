import { randomInt } from "node:crypto";
import { CASE_OPEN_REWARD_WEIGHTS } from "@/lib/server-task-actions";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  if (!isSupabaseAdminConfigured) return Response.json({ error: "Case Opening is unavailable." }, { status: 503 });
  const auth = await createClient();
  const { data, error: authError } = await auth.auth.getUser();
  if (authError || !data.user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const supabase = createSupabaseAdminClient();
  const limit = await checkRateLimit(supabase, `case-opening:${data.user.id}`, 6, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);
  let roll = randomInt(CASE_OPEN_REWARD_WEIGHTS.reduce((total, entry) => total + entry.weight, 0));
  const reward = CASE_OPEN_REWARD_WEIGHTS.find((entry) => { roll -= entry.weight; return roll < 0; })!.value;
  const { data: result, error } = await supabase.rpc("open_daily_game_case", { p_user_id: data.user.id, p_reward: reward });
  if (error) {
    console.error("[case-opening] atomic open failed", error);
    return Response.json({ error: "Case Opening could not be saved. Please try again." }, { status: 503 });
  }
  if (result?.error) {
    const messages: Record<string, string> = { cooldown: "Case Opening is on cooldown until the daily reset.", timeout_active: "Timeout is active.", profile_not_found: "Profile not found." };
    return Response.json({ error: messages[result.error] ?? "Case Opening failed.", cooldownUntil: result.cooldownUntil }, { status: result.error === "cooldown" ? 429 : 409 });
  }
  return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
