import type { SupabaseClient } from "@supabase/supabase-js";
import { IRL_TASK_APPROVAL_AFFECTION_GAIN } from "@/lib/irl-task-wheel";

const INTENTIONAL_FAIL_TASK_LABEL = "Intentional Fail";
const INTENTIONAL_FAIL_REQUIRED_FAILURES = 4;
const INTENTIONAL_FAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

type AutoApproveInput = {
  failedAtIso: string;
  failedTaskId: string;
  failedTaskLabel?: string | null;
  userId: string;
};

export async function recordIrlFailureAndAutoApproveIntentionalFail(
  supabase: SupabaseClient,
  input: AutoApproveInput,
) {
  const { error: failEventError } = await supabase.from("irl_task_fail_events").insert({
    failed_at: input.failedAtIso,
    task_id: input.failedTaskId,
    task_label: input.failedTaskLabel ?? null,
    user_id: input.userId,
  });

  if (failEventError) {
    console.error("IRL fail event insert failed", failEventError);
    return { autoApproved: false, failCount: 0 };
  }

  const { data: intentionalTask, error: intentionalTaskError } = await supabase
    .from("user_irl_tasks")
    .select("id, assigned_at")
    .eq("user_id", input.userId)
    .eq("task_label", INTENTIONAL_FAIL_TASK_LABEL)
    .eq("status", "assigned")
    .order("assigned_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (intentionalTaskError) {
    console.error("Intentional Fail active task lookup failed", intentionalTaskError);
    return { autoApproved: false, failCount: 0 };
  }

  if (!intentionalTask?.assigned_at) {
    return { autoApproved: false, failCount: 0 };
  }

  const assignedAt = new Date(String(intentionalTask.assigned_at));
  const failedAt = new Date(input.failedAtIso);
  const deadlineAt = new Date(assignedAt.getTime() + INTENTIONAL_FAIL_WINDOW_MS);

  if (failedAt < assignedAt || failedAt > deadlineAt) {
    return { autoApproved: false, failCount: 0 };
  }

  const { count: failCount, error: failCountError } = await supabase
    .from("irl_task_fail_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .gte("failed_at", assignedAt.toISOString())
    .lte("failed_at", deadlineAt.toISOString());

  if (failCountError) {
    console.error("Intentional Fail count lookup failed", failCountError);
    return { autoApproved: false, failCount: 0 };
  }

  const countedFailures = failCount ?? 0;

  if (countedFailures < INTENTIONAL_FAIL_REQUIRED_FAILURES) {
    return { autoApproved: false, failCount: countedFailures };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, affection")
    .eq("id", input.userId)
    .maybeSingle();

  if (profileError || !profile) {
    console.error("Intentional Fail auto-approve profile lookup failed", profileError);
    return { autoApproved: false, failCount: countedFailures };
  }

  const previousAffection = Number(profile.affection ?? 0);
  const nextAffection = Math.min(100, previousAffection + IRL_TASK_APPROVAL_AFFECTION_GAIN);
  const now = new Date().toISOString();
  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({ affection: nextAffection, updated_at: now })
    .eq("id", input.userId);

  if (profileUpdateError) {
    console.error("Intentional Fail auto-approve affection update failed", profileUpdateError);
    return { autoApproved: false, failCount: countedFailures };
  }

  const { data: approvedTask, error: taskDeleteError } = await supabase
    .from("user_irl_tasks")
    .delete()
    .eq("id", intentionalTask.id)
    .eq("status", "assigned")
    .select("id")
    .maybeSingle();

  if (taskDeleteError || !approvedTask) {
    console.error("Intentional Fail auto-approve task delete failed", taskDeleteError);
    const { error: rollbackError } = await supabase
      .from("profiles")
      .update({ affection: previousAffection, updated_at: now })
      .eq("id", input.userId)
      .eq("affection", nextAffection);

    if (rollbackError) {
      console.error("Intentional Fail auto-approve affection rollback failed", rollbackError);
    }

    return { autoApproved: false, failCount: countedFailures };
  }

  return {
    autoApproved: true,
    failCount: countedFailures,
    message: `Intentional Fail auto-approved for ${profile.username}. +${IRL_TASK_APPROVAL_AFFECTION_GAIN} affection.`,
  };
}
