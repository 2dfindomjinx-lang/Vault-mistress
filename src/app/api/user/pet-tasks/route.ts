import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { sendAdminMobilePush } from "@/lib/admin-mobile-push";

const DEFAULT_PET_TASK_REWARD = 10;
const PET_WEEKLY_TAX_REWARD = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const allowedTaskIds = new Set([
  "pet-confession-dm",
  "pet-daily-report",
  "pet-twitter-post",
  "pet-weekly-throne-tax",
  "pet-voice-proof",
  "pet-perfect-writing",
  "pet-case-opening",
  "pet-evil-wait",
  "pet-false-hope",
  "pet-favor-roulette",
  "pet-debt-contract",
  "pet-affection-claim",
]);
const allowedStatuses = new Set(["available", "pending", "approved", "failed"]);

type Body = {
  completed_at?: string | null;
  metadata?: Record<string, unknown>;
  reviewed_at?: string | null;
  reward_score?: number;
  status?: string;
  task_id?: string;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function getTaskCooldownMs(taskId: string) {
  if (taskId === "pet-weekly-throne-tax") {
    return WEEK_MS;
  }

  return DAY_MS;
}

function isDuplicateReviewedTask(taskId: string, completedAt: string | null, metadata: Record<string, unknown> | null) {
  if (taskId === "pet-affection-claim") {
    const date = typeof metadata?.date === "string" ? metadata.date : null;
    const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return date === today;
  }

  if (!completedAt) {
    return false;
  }

  const completedMs = new Date(completedAt).getTime();

  return Number.isFinite(completedMs) && Date.now() - completedMs < getTaskCooldownMs(taskId);
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const taskId = body?.task_id?.trim();
  const status = body?.status?.trim();
  const rewardScore = body?.reward_score;

  if (!body || !taskId || !allowedTaskIds.has(taskId) || !status || !allowedStatuses.has(status)) {
    return jsonError("Invalid Pet task payload.");
  }

  const expectedRewardScore = taskId === "pet-weekly-throne-tax"
    ? PET_WEEKLY_TAX_REWARD
    : DEFAULT_PET_TASK_REWARD;

  if (!Number.isInteger(rewardScore) || rewardScore !== expectedRewardScore) {
    return jsonError("Invalid Pet task reward.", 422);
  }

  const payload = body;

  const supabase = createSupabaseAdminClient();
  const { data: existingTask, error: existingTaskError } = await supabase
    .from("user_pet_tasks")
    .select("task_id, completed_at, reward_score, status, reviewed_at, metadata")
    .eq("user_id", authData.user.id)
    .eq("task_id", taskId)
    .maybeSingle();

  if (existingTaskError) {
    return jsonError(existingTaskError.message, 500);
  }

  if (
    existingTask?.reviewed_at &&
    isDuplicateReviewedTask(taskId, existingTask.completed_at, existingTask.metadata as Record<string, unknown> | null)
  ) {
    return Response.json({ task: existingTask });
  }

  const { data, error } = await supabase
    .from("user_pet_tasks")
    .upsert(
      {
        completed_at: payload.completed_at ?? null,
        metadata: payload.metadata ?? {},
        reviewed_at: payload.reviewed_at ?? null,
        reward_score: rewardScore,
        status,
        task_id: taskId,
        user_id: authData.user.id,
      },
      { onConflict: "user_id,task_id" },
    )
    .select("task_id, completed_at, reward_score, status, reviewed_at, metadata")
    .single();

  if (error || !data) {
    return jsonError(error?.message ?? "Pet task update failed.", 500);
  }

  if (status === "pending") {
    sendAdminMobilePush({
      title: "New pet task",
      body: `${taskId} is waiting for approval.`,
      type: "pet_task",
      important: true,
    }).catch((pushError) => {
      console.error("[pet-tasks] admin mobile push failed", pushError);
    });
  }

  return Response.json({ task: data });
}
