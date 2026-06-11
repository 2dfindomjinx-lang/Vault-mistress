import {
  getRandomIrlTaskDurationMinutes,
  getRandomIrlTaskPenaltyMinutes,
  IRL_TASK_WHEEL_COST,
  irlTaskWheelSegments,
} from "@/lib/irl-task-wheel";
import { profileSelect } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { sendAdminMobilePush } from "@/lib/admin-mobile-push";

type IrlWheelBody = {
  wheelIndex?: number;
};

type ProfileRow = {
  affection: number;
  coins: number;
  id: string;
  timeout_until: string | null;
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

  const body = (await request.json().catch(() => null)) as IrlWheelBody | null;
  const wheelIndex = body?.wheelIndex;
  const assignedTask = typeof wheelIndex === "number" && Number.isInteger(wheelIndex)
    ? irlTaskWheelSegments[wheelIndex]
    : null;

  if (!assignedTask || typeof wheelIndex !== "number") {
    return jsonError("Invalid IRL wheel segment.", 422);
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile) {
    console.error("[irl-task-wheel] profile lookup failed", {
      code: profileError?.code,
      message: profileError?.message,
      userId: authData.user.id,
    });
    return jsonError(profileError?.message ?? "Profile not found.", 404);
  }

  const currentProfile = profile as ProfileRow;
  const timeoutUntil = currentProfile.timeout_until ? new Date(currentProfile.timeout_until).getTime() : 0;

  if (timeoutUntil > Date.now()) {
    return jsonError("Timeout is active. The wheel is not available yet.", 423);
  }

  if (currentProfile.coins < IRL_TASK_WHEEL_COST) {
    return jsonError(`The wheel costs ${IRL_TASK_WHEEL_COST} coins. Come back richer.`, 402);
  }

  const { data: activeAssignment, error: activeAssignmentError } = await supabase
    .from("user_irl_tasks")
    .select("id")
    .eq("user_id", authData.user.id)
    .eq("status", "assigned")
    .limit(1)
    .maybeSingle();

  if (activeAssignmentError) {
    console.error("[irl-task-wheel] active assignment lookup failed", {
      code: activeAssignmentError.code,
      message: activeAssignmentError.message,
      userId: authData.user.id,
    });
    return jsonError("IRL task assignment check failed.", 500);
  }

  if (activeAssignment) {
    return jsonError("Finish your assigned task first. The wheel is locked until admin review.", 409);
  }

  const durationMinutes = getRandomIrlTaskDurationMinutes();
  const penaltyMinutes = getRandomIrlTaskPenaltyMinutes();
  const dueAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
  const nextCoins = currentProfile.coins - IRL_TASK_WHEEL_COST;

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({
      coins: nextCoins,
      updated_at: new Date().toISOString(),
    })
    .eq("id", authData.user.id)
    .eq("coins", currentProfile.coins)
    .select(profileSelect)
    .maybeSingle();

  if (updateError || !updatedProfile) {
    console.error("[irl-task-wheel] profile coin update failed", {
      code: updateError?.code,
      message: updateError?.message,
      userId: authData.user.id,
    });
    return jsonError(updateError?.message ?? "IRL wheel coin update was stale or duplicated.", updateError ? 500 : 409);
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("user_irl_tasks")
    .insert({
      cost_coins: IRL_TASK_WHEEL_COST,
      due_at: dueAt,
      penalty_timeout_minutes: penaltyMinutes,
      status: "assigned",
      task_description: assignedTask.description,
      task_label: assignedTask.title,
      user_id: authData.user.id,
      wheel_index: wheelIndex,
    })
    .select("id, task_label, task_description, wheel_index, status, due_at, penalty_timeout_minutes")
    .single();

  if (assignmentError || !assignment) {
    console.error("[irl-task-wheel] assignment insert failed", {
      code: assignmentError?.code,
      message: assignmentError?.message,
      userId: authData.user.id,
      wheelIndex,
    });

    const { error: rollbackError } = await supabase
      .from("profiles")
      .update({
        coins: currentProfile.coins,
        updated_at: new Date().toISOString(),
      })
      .eq("id", authData.user.id)
      .eq("coins", nextCoins);

    if (rollbackError) {
      console.error("[irl-task-wheel] coin rollback failed", {
        code: rollbackError.code,
        message: rollbackError.message,
        userId: authData.user.id,
      });
    }

    return jsonError(assignmentError?.message ?? "IRL task assignment failed.", 500);
  }

  const { error: transactionError } = await supabase.from("coin_transactions").insert({
    amount: -IRL_TASK_WHEEL_COST,
    balance_after: nextCoins,
    balance_before: currentProfile.coins,
    metadata: {
      dueAt,
      penaltyMinutes,
      taskLabel: assignedTask.title,
      wheelIndex,
    },
    reason: "spend:irl-task-wheel",
    user_id: authData.user.id,
  });

  if (transactionError) {
    console.error("[irl-task-wheel] transaction insert failed", {
      code: transactionError.code,
      message: transactionError.message,
      userId: authData.user.id,
    });

    if (assignment?.id) {
      const { error: assignmentCleanupError } = await supabase
        .from("user_irl_tasks")
        .delete()
        .eq("id", assignment.id);

      if (assignmentCleanupError) {
        console.error("[irl-task-wheel] assignment cleanup failed", {
          code: assignmentCleanupError.code,
          message: assignmentCleanupError.message,
          userId: authData.user.id,
        });
      }
    }

    const { error: rollbackError } = await supabase
      .from("profiles")
      .update({
        coins: currentProfile.coins,
        updated_at: new Date().toISOString(),
      })
      .eq("id", authData.user.id)
      .eq("coins", nextCoins);

    if (rollbackError) {
      console.error("[irl-task-wheel] coin rollback after logging failure failed", {
        code: rollbackError.code,
        message: rollbackError.message,
        userId: authData.user.id,
      });
    }

    return jsonError("IRL wheel coin logging failed.", 500);
  }

  sendAdminMobilePush({
    title: "New IRL task",
    body: `${assignedTask.title} is waiting for approval.`,
    type: "irl_task",
    important: true,
  }).catch((pushError) => {
    console.error("[irl-task-wheel] admin mobile push failed", pushError);
  });

  return Response.json({
    assignment,
    profile: updatedProfile,
  });
}
