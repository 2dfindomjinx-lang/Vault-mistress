import type { SupabaseClient } from "@supabase/supabase-js";
import { profileSelect } from "@/lib/server-game-rules";
export type EconomyTask = {
  task_id: string;
  completed_at: string | null;
  claimed_at: string | null;
  reward_coins: number | null;
  metadata: Record<string, unknown> | null;
};
type Command = {
  userId: string;
  operationKey: string;
  reason: string;
  expectedProfile: Record<string, unknown>;
  patch: { coins?: number; affection?: number; tribute_total?: number };
  taskId?: string;
  expectedTask?: Partial<EconomyTask> | null;
  taskPatch?: EconomyTask | null;
  metadata?: Record<string, unknown>;
  devotion?: number;
};
type EconomyResult =
  | { error: string; status: number }
  | {
      profile: Record<string, unknown>;
      task: EconomyTask | null;
      rewardCoins: number;
      duplicate: boolean;
    };
export async function commitEconomyAction(
  supabase: SupabaseClient,
  command: Command,
): Promise<EconomyResult> {
  const { data, error } = await supabase.rpc("commit_economy_action", {
    p_user_id: command.userId,
    p_operation_key: command.operationKey,
    p_expected_profile: command.expectedProfile,
    p_profile_patch: command.patch,
    p_task_id: command.taskId ?? null,
    p_expected_task: command.expectedTask ?? null,
    p_task_patch: command.taskPatch ?? null,
    p_reason: command.reason,
    p_metadata: command.metadata ?? {},
    p_devotion: command.devotion ?? 0,
  });
  if (error || data?.error || !data) {
    const code = error?.code ?? data?.error ?? "empty_response";
    if (error) {
      console.error("[economy-command]", {
        operationKey: command.operationKey,
        code,
      });
      await supabase
        .from("economy_failures")
        .insert({
          user_id: command.userId,
          operation_key: command.operationKey,
          reason: command.reason,
          error_code: code,
        });
    }
    return {
      error:
        code === "timeout_active"
          ? "This action is locked during your timeout."
          : "The action was not completed. Refresh your balance and try again.",
      status: error ? 503 : 409,
    } as const;
  }
  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", command.userId)
    .single();
  if (readError || !profile)
    return {
      error: "Your action was recorded. Refresh to see the updated balance.",
      status: 503,
    } as const;
  return {
    profile,
    task: data.task as EconomyTask | null,
    rewardCoins: Number(data.rewardCoins),
    duplicate: Boolean(data.duplicate),
  } as const;
}
