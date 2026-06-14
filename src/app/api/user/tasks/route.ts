import { getAllowedTaskRewards } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type TaskBody = {
  task?: {
    claimed_at?: string | null;
    completed_at?: string | null;
    metadata?: Record<string, unknown>;
    reward_coins?: number | null;
    task_id?: string;
  };
};

const REWARD_COOLDOWN_TASKS = new Set([
  "daily-login",
  "typing-accuracy",
  "beg",
  "sacrifice",
  "support",
  "timeout-risk",
  "streak-bonus-1",
  "streak-bonus-3",
  "streak-bonus-7",
  "streak-bonus-15",
  "streak-bonus-30",
  "wait-obediently",
  "affection",
  "affection-80",
]);

const DANGEROUS_METADATA_KEYS = [
  "failedAt",
  "lastBegAt",
  "resetAt",
  "lastClaimAt",
  "lastUsedAt",
  "date",
];

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function isRewardAllowed(taskId: string, reward: number) {
  if (taskId === "sacrifice") {
    return reward === 0 || reward === 1;
  }

  if (taskId === "support") {
    return reward === -1000;
  }

  if (taskId === "irl-task-wheel") {
    return reward === 0;
  }

  return getAllowedTaskRewards(taskId).includes(reward);
}

function sanitizeMetadata(taskId: string, incomingMetadata: Record<string, unknown>) {
  const meta = { ...incomingMetadata };

  if (REWARD_COOLDOWN_TASKS.has(taskId)) {
    for (const key of DANGEROUS_METADATA_KEYS) {
      if (key in meta) {
        // Force server time. Client cannot backdate cooldown eligibility.
        meta[key] = new Date().toISOString();
      }
    }
  }

  return meta;
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

  const body = (await request.json().catch(() => null)) as TaskBody | null;
  const task = body?.task;
  const taskId = task?.task_id;
  const incomingReward = task?.reward_coins ?? 0;

  if (!taskId || typeof taskId !== "string" || !Number.isInteger(incomingReward)) {
    return jsonError("Invalid task payload.");
  }

  if (taskId === "high-low" || taskId === "number-pick") {
    return jsonError("This task must use its dedicated action endpoint.", 409);
  }

  if (taskId === "daily-login") {
    return jsonError("Daily login reward can only be claimed via the dedicated task claim endpoint.", 409);
  }

  // Validate reward_coins if provided (prevent arbitrary inflation via generic sync).
  // For REWARD_COOLDOWN tasks we still allow recording their state (completed_at, claimed_at for cooldowns, metadata),
  // but cap reward_coins to allowed values or 0.
  let effectiveRewardCoins = incomingReward;
  if (!isRewardAllowed(taskId, incomingReward)) {
    console.warn(`[user-tasks] client sent invalid reward_coins=${incomingReward} for ${taskId}; forcing 0`);
    effectiveRewardCoins = 0;
  }

  const safeMetadata = sanitizeMetadata(taskId, task?.metadata ?? {});
  const safeTask = {
    user_id: authData.user.id,
    task_id: taskId,
    // completed_at and claimed_at are used by many tasks for their own state/cooldown tracking; allow through generic sync
    // (actual reward grants/claims are enforced in dedicated routes like task-claim or profile-progress).
    completed_at: task?.completed_at ?? null,
    claimed_at: task?.claimed_at ?? null,
    reward_coins: effectiveRewardCoins,
    metadata: safeMetadata,
  };

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_tasks")
    .upsert(safeTask, { onConflict: "user_id,task_id" })
    .select("task_id, completed_at, claimed_at, reward_coins, metadata")
    .single();

  if (error || !data) {
    console.error("[user-tasks] Supabase error upserting task state", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      taskId,
      userId: authData.user.id,
      attemptedTask: task,
    });
    return jsonError(error?.message ?? "Task update failed.", 500);
  }

  return Response.json({ task: data });
}
