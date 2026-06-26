import type { SupabaseClient } from "@supabase/supabase-js";

export const ADMIN_PET_TASK_LOG_RETENTION_HOURS = 24;
export const THRONE_TITLE_MILESTONES = [
  { min: 10000, titleId: "throne-10000" },
  { min: 25000, titleId: "throne-25000" },
  { min: 100000, titleId: "throne-100000" },
] as const;

export type AdminPetTaskLogStatus = "queued" | "executed" | "reverted" | "cleared";

export type AdminPetTaskLogRow = {
  id: string;
  task_row_id: string | null;
  user_id: string;
  username_snapshot: string | null;
  task_id: string;
  status: AdminPetTaskLogStatus;
  reward_score_delta: number;
  coin_total_delta: number;
  throne_base_coin_amount: number;
  throne_give_bonus_amount: number;
  throne_task_bonus_amount: number;
  devotion_delta: number;
  pending_action_id: string | null;
  transaction_ids: string[] | null;
  metadata: Record<string, unknown> | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export function getAdminPetTaskLogCutoffIso(now = Date.now()) {
  return new Date(now - ADMIN_PET_TASK_LOG_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
}

export async function cleanupExpiredAdminPetTaskLogs(supabase: SupabaseClient, now = Date.now()) {
  const cutoffIso = getAdminPetTaskLogCutoffIso(now);
  const { error } = await supabase
    .from("admin_pet_task_logs")
    .delete()
    .lt("created_at", cutoffIso);

  if (error) {
    console.error("Admin pet task log cleanup failed", error);
  }
}

export async function listRecentAdminPetTaskLogs(supabase: SupabaseClient) {
  await cleanupExpiredAdminPetTaskLogs(supabase);
  const cutoffIso = getAdminPetTaskLogCutoffIso();
  const { data, error } = await supabase
    .from("admin_pet_task_logs")
    .select("*")
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Admin pet task log list failed", error);
    throw error;
  }

  return ((data ?? []) as AdminPetTaskLogRow[]).map((row) => ({
    ...row,
    transaction_ids: Array.isArray(row.transaction_ids) ? row.transaction_ids : [],
  }));
}

export async function syncThroneMilestoneTitles(
  supabase: SupabaseClient,
  userId: string,
  rawGiftTotal: number,
) {
  const { data: revertedLogs, error: revertedError } = await supabase
    .from("admin_pet_task_logs")
    .select("throne_base_coin_amount")
    .eq("user_id", userId)
    .eq("task_id", "pet-throne-tribute")
    .eq("status", "reverted");

  if (revertedError) {
    console.error("Admin pet task reverted throne log lookup failed", revertedError);
  }

  const revertedBaseTotal = (revertedLogs ?? []).reduce(
    (sum, row) => sum + Math.max(0, Number(row.throne_base_coin_amount ?? 0)),
    0,
  );
  const effectiveGiftTotal = Math.max(0, rawGiftTotal - revertedBaseTotal);
  const eligibleTitles = THRONE_TITLE_MILESTONES
    .filter((milestone) => effectiveGiftTotal >= milestone.min)
    .map((milestone) => milestone.titleId);

  const allTitleIds = THRONE_TITLE_MILESTONES.map((milestone) => milestone.titleId);
  const titlesToRemove = allTitleIds.filter((titleId) => !eligibleTitles.includes(titleId));

  if (titlesToRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from("user_titles")
      .delete()
      .eq("user_id", userId)
      .in("title_id", titlesToRemove);

    if (deleteError) {
      console.error("Admin pet task throne title removal failed", deleteError);
    }
  }

  if (eligibleTitles.length > 0) {
    const { error: upsertError } = await supabase.from("user_titles").upsert(
      eligibleTitles.map((titleId) => ({
        user_id: userId,
        title_id: titleId,
        source: "throne",
        equipped: false,
      })),
      { onConflict: "user_id,title_id" },
    );

    if (upsertError) {
      console.error("Admin pet task throne title upsert failed", upsertError);
    }
  }

  return effectiveGiftTotal;
}
