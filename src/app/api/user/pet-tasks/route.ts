import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

const PET_TASK_REWARD = 10;
const allowedTaskIds = new Set([
  "pet-confession-dm",
  "pet-daily-report",
  "pet-twitter-post",
  "pet-weekly-throne-tax",
  "pet-voice-proof",
  "pet-perfect-writing",
  "pet-case-opening",
  "pet-evil-wait",
  "pet-randomized-rules",
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

  if (!Number.isInteger(rewardScore) || rewardScore !== PET_TASK_REWARD) {
    return jsonError("Invalid Pet task reward.", 422);
  }

  const payload = body;

  const supabase = createSupabaseAdminClient();
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

  return Response.json({ task: data });
}
