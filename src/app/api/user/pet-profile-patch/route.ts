import { randomInt } from "node:crypto";
import { profileSelect } from "@/lib/profile-columns";
import { PET_FAVOR_ROULETTE_COIN_REWARD, PET_TASK_COIN_REWARD, roundRewardToNearestFive } from "@/lib/server-game-rules";
import { getActiveEventMultipliers } from "@/lib/server-task-actions";
import { isRecord, PET_PROFILE_FIELDS, PET_REWARD_TASKS, rollPetFavor, validPetWriting } from "@/lib/pet-action-validation";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const error = (message: string, status = 422) => Response.json({ error: message }, { status });
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) return error("Service unavailable.", 503);
  const auth = await createClient();
  const { data, error: authError } = await auth.auth.getUser();
  if (authError || !data.user) return error("Authentication required.", 401);
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.reason !== "string" || !isRecord(body.patch) || Object.keys(body.patch).some(key => !PET_PROFILE_FIELDS.has(key))) return error("Invalid Pet action.");
  const reason = body.reason;
  const taskId = reason === "reward:pet-confession" ? "pet-confession-dm" : reason.replace(/^reward:/, "");
  if (!["pet:maintenance", "pet:unlock", "spend:pet-weekly-tax"].includes(reason) && !(reason.startsWith("reward:") && PET_REWARD_TASKS.has(taskId))) return error("Use this task's own action to complete it.");
  const db = createSupabaseAdminClient();
  const limit = await checkRateLimit(db, "pet-action:" + data.user.id, 40, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);
  const metadata = isRecord(body.metadata) ? body.metadata : {};
  let proof: Record<string, unknown> = {};
  let reward = 0;
  if (reason.startsWith("reward:")) {
    const { data: profile, error: readError } = await db.from("profiles").select("address_term").eq("id", data.user.id).single();
    if (readError || !profile) return error("Profile unavailable.", 503);
    if (!validPetWriting(taskId, metadata.text, profile.address_term)) return error("The words do not match today's sentence.");
    const multipliers = await getActiveEventMultipliers(db, ["task_reward_multiplier"]);
    const multiplier = Math.max(1, Math.min(2, multipliers.task_reward_multiplier ?? 1));
    reward = taskId === "pet-affection-claim" ? 0 : roundRewardToNearestFive((taskId === "pet-favor-roulette" ? PET_FAVOR_ROULETTE_COIN_REWARD : PET_TASK_COIN_REWARD) * multiplier);
    if (taskId === "pet-favor-roulette") {
      if (!Number.isInteger(metadata.pickedIndex) || Number(metadata.pickedIndex) < 0 || Number(metadata.pickedIndex) > 4) return error("Pick a card.");
      proof = rollPetFavor(Number(metadata.pickedIndex), max => randomInt(max));
    } else if (taskId === "pet-false-hope") {
      if (metadata.key !== "a" && metadata.key !== "d") return error("Invalid sequence key.");
      proof = { key: metadata.key };
    }
  }
  // No client profile values, timestamps or reward amounts reach SQL.
  const { data: result, error: rpcError } = await db.rpc("apply_pet_action", { p_user_id: data.user.id, p_action: reason.startsWith("reward:") ? "reward:" + taskId : reason, p_coin_reward: reward, p_proof: proof });
  if (rpcError || !result) { console.error("[pet-action] transaction failed", rpcError); return error("Pet action could not be confirmed. Refresh and try again.", 503); }
  if (result.error) return error(result.error === "task_not_ready" ? "Complete the task before claiming its reward." : result.error === "pet_locked" ? "Pet tasks unlock at 100 Affection." : result.error === "timeout_active" ? "This action is locked during your timeout." : "This task is not available yet.", 409);
  const { data: profile, error: profileError } = await db.from("profiles").select(profileSelect).eq("id", data.user.id).single();
  if (profileError || !profile) return error("Your action was recorded. Refresh to see it.", 503);
  return Response.json({ profile, task: result.task ?? null, replayed: Boolean(result.replayed) }, { headers: { "Cache-Control": "private, no-store" } });
}
