import { getAllowedTaskRewards, getBaseTaskReward } from "@/lib/server-game-rules";
import { getNextGmt3Reset } from "@/lib/time";
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

const SUPPORT_COST = 2500;

type ExistingTaskRow = {
  claimed_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
  reward_coins: number | null;
  task_id: string;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function isRewardAllowed(taskId: string, reward: number) {
  if (taskId === "sacrifice") {
    return reward === 0 || reward === 1;
  }

  if (taskId === "support") {
    return reward === -SUPPORT_COST;
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

function resolveTimeoutRiskResetAt(currentMetadata: Record<string, unknown>, nextMetadata: Record<string, unknown>) {
  const currentResetAt =
    typeof currentMetadata.resetAt === "string" ? currentMetadata.resetAt : null;
  const currentResetMs = currentResetAt ? new Date(currentResetAt).getTime() : 0;

  if (currentResetAt && currentResetMs > Date.now()) {
    return currentResetAt;
  }

  const incomingSafeWins =
    typeof nextMetadata.safeWins === "number" ? nextMetadata.safeWins : Number(nextMetadata.safeWins ?? 0);

  if (Number.isFinite(incomingSafeWins) && incomingSafeWins > 0) {
    return getNextGmt3Reset().toISOString();
  }

  return null;
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
  const baseReward = getBaseTaskReward(taskId);
  const isCaseOpeningTask = taskId === "case-opening";

  if (!isCaseOpeningTask && typeof baseReward !== "number") {
    return jsonError("Unsupported task reward.", 422);
  }

  let effectiveRewardCoins = incomingReward;
  if (!isRewardAllowed(taskId, incomingReward)) {
    console.warn(`[user-tasks] client sent invalid reward_coins=${incomingReward} for ${taskId}; forcing 0`);
    effectiveRewardCoins = 0;
  }

  const safeMetadata = sanitizeMetadata(taskId, task?.metadata ?? {});
  const supabase = createSupabaseAdminClient();
  const { data: existingTask } = await supabase
    .from("user_tasks")
    .select("task_id, completed_at, claimed_at, reward_coins, metadata")
    .eq("user_id", authData.user.id)
    .eq("task_id", taskId)
    .maybeSingle();

  const currentTask = (existingTask as ExistingTaskRow | null) ?? null;
  const currentMetadata = currentTask?.metadata ?? {};
  const mergedMetadata =
    REWARD_COOLDOWN_TASKS.has(taskId) && currentTask
      ? (() => {
          const next = { ...currentMetadata, ...safeMetadata };
          for (const key of DANGEROUS_METADATA_KEYS) {
            if (key in currentMetadata) {
              next[key] = currentMetadata[key];
            }
          }
          return next;
        })()
      : safeMetadata;

  if (taskId === "timeout-risk") {
    const resolvedResetAt = resolveTimeoutRiskResetAt(currentMetadata, mergedMetadata);
    if (resolvedResetAt) {
      mergedMetadata.resetAt = resolvedResetAt;
    } else {
      delete mergedMetadata.resetAt;
    }
  }

  const safeTask = {
    user_id: authData.user.id,
    task_id: taskId,
    // For cooldown/reward-bearing tasks, preserve server-recorded state once a row exists so
    // client sync calls cannot rewind claimed/completed timestamps or cooldown anchors.
    completed_at:
      REWARD_COOLDOWN_TASKS.has(taskId) && currentTask?.completed_at
        ? currentTask.completed_at
        : task?.completed_at ?? null,
    claimed_at:
      REWARD_COOLDOWN_TASKS.has(taskId) && currentTask?.claimed_at
        ? currentTask.claimed_at
        : task?.claimed_at ?? null,
    reward_coins:
      REWARD_COOLDOWN_TASKS.has(taskId) && currentTask?.reward_coins != null
        ? currentTask.reward_coins
        : effectiveRewardCoins,
    metadata: mergedMetadata,
  };

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
