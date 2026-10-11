import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendAdminMobilePush } from "@/lib/admin-mobile-push";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isRecord, PET_REVIEW_TASKS, PET_REWARD_TASKS, validPetWriting } from "@/lib/pet-action-validation";

const error = (message: string, status = 422) => Response.json({ error: message }, { status });
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) return error("Service unavailable.", 503);
  const auth = await createClient();
  const { data, error: authError } = await auth.auth.getUser();
  if (authError || !data.user) return error("Authentication required.", 401);
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.task_id !== "string" || typeof body.status !== "string") return error("Invalid Pet task.");
  const taskId = body.task_id, status = body.status;
  if (!PET_REVIEW_TASKS.has(taskId) && !PET_REWARD_TASKS.has(taskId) && taskId !== "pet-weekly-throne-tax") return error("Use this task's own action.");
  if (!["available", "pending", "approved", "failed"].includes(status)) return error("Invalid task status.");
  const db = createSupabaseAdminClient();
  const limit = await checkRateLimit(db, `pet-progress:${data.user.id}:${taskId}`, taskId === "pet-false-hope" ? 300 : 90, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);
  const supplied = isRecord(body.metadata) ? body.metadata : {};
  let metadata: Record<string, unknown> = {};
  if (status === "available" && ["pet-confession-dm", "pet-ownership-oath"].includes(taskId)) {
    if (!Number.isInteger(supplied.count) || Number(supplied.count) < 1 || Number(supplied.count) > 24) return error("Invalid writing progress.");
    const { data: profile, error: readError } = await db.from("profiles").select("address_term").eq("id", data.user.id).single();
    if (readError || !profile) return error("Profile unavailable.", 503);
    if (!validPetWriting(taskId, supplied.text, profile.address_term)) return error("The words do not match today's sentence.");
    metadata = { count: supplied.count };
  } else if (taskId === "pet-false-hope" && status === "available") {
    if (supplied.key !== "a" && supplied.key !== "d") return error("Invalid sequence key.");
    if (!Number.isInteger(supplied.expectedProgress) || Number(supplied.expectedProgress) < 0 || Number(supplied.expectedProgress) > 99 || ![1, 2].includes(Number(supplied.expectedStage))) return error("Invalid sequence progress.");
    metadata = { key: supplied.key, expectedProgress: supplied.expectedProgress, expectedStage: supplied.expectedStage };
  } else if (PET_REVIEW_TASKS.has(taskId) && status === "pending") {
    for (const key of ["proofImage", "proofText", "proofUrl", "throneAmount", "note"]) if (typeof supplied[key] === "string" || typeof supplied[key] === "number") metadata[key] = supplied[key];
    if (JSON.stringify(metadata).length > 2_000_000) return error("Proof is too large.");
    if (taskId === "pet-throne-tribute" && (typeof metadata.throneAmount !== "number" || !Number.isFinite(metadata.throneAmount) || metadata.throneAmount <= 0 || metadata.throneAmount > 10000)) return error("Invalid tribute amount.");
  }
  const { data: result, error: rpcError } = await db.rpc("save_pet_task_progress", { p_user_id: data.user.id, p_task_id: taskId, p_status: status, p_metadata: metadata });
  if (rpcError || !result) { console.error("[pet-progress] transaction failed", rpcError); return error("Pet task could not be saved.", 503); }
  if (result.error) return error("This task cannot be changed in its current state.", 409);
  if (result.submitted) void sendAdminMobilePush({ title: "New pet task", body: taskId + " is waiting for approval.", type: "pet_task", important: true }).catch(e => console.error("[pet-progress] notification failed", e));
  return Response.json({ task: result.task }, { headers: { "Cache-Control": "private, no-store" } });
}
