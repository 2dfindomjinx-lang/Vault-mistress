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
  const rewardCoins = task?.reward_coins ?? 0;

  if (!taskId || typeof taskId !== "string" || !Number.isInteger(rewardCoins)) {
    return jsonError("Invalid task payload.");
  }

  if (taskId === "high-low" || taskId === "number-pick") {
    return jsonError("This task must use its dedicated action endpoint.", 409);
  }

  if (!isRewardAllowed(taskId, rewardCoins)) {
    return jsonError("Invalid reward_coins for task.", 422);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_tasks")
    .upsert(
      {
        user_id: authData.user.id,
        task_id: taskId,
        completed_at: task.completed_at ?? null,
        claimed_at: task.claimed_at ?? null,
        reward_coins: rewardCoins,
        metadata: task.metadata ?? {},
      },
      { onConflict: "user_id,task_id" },
    )
    .select("task_id, completed_at, claimed_at, reward_coins, metadata")
    .single();

  if (error || !data) {
    return jsonError(error?.message ?? "Task update failed.", 500);
  }

  return Response.json({ task: data });
}
