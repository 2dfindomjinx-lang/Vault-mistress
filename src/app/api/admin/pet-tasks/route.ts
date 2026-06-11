import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { isTrustedAdminUsername } from "@/lib/admin-identity";

const PET_TASK_COIN_REWARD = 500;

async function isAdminRequest() {
  const authSupabase = await createSupabaseServerClient();
  const { data } = await authSupabase.auth.getUser();

  if (!data.user) {
    return false;
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username, is_admin")
    .eq("id", data.user.id)
    .maybeSingle();

  if (error) {
    console.error("Admin pet task auth profile lookup failed", error);
    return false;
  }

  return isTrustedAdminUsername(profile?.username);
}

async function listPetTasks(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await supabase
    .from("user_pet_tasks")
    .select("id, user_id, task_id, completed_at, reward_score, status, reviewed_at, created_at")
    .neq("task_id", "pet-affection-claim")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Admin pet task list failed", error);
    throw error;
  }

  const userIds = Array.from(new Set((data ?? []).map((entry) => entry.user_id)));
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, pet_score")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  if (profileError) {
    console.error("Admin pet task profile lookup failed", profileError);
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return (data ?? []).map((task) => {
    const profile = profileMap.get(task.user_id);

    return {
      ...task,
      username: profile?.username ?? "@unknown",
      pet_score: profile?.pet_score ?? 0,
    };
  });
}

export async function POST(request: Request) {
  const configErrors = getSupabaseAdminConfigErrors();

  if (!isSupabaseAdminConfigured) {
    console.error("Admin pet task route is not configured", configErrors);
    return Response.json(
      { error: `Admin environment is not configured: ${configErrors.join(", ")}` },
      { status: 500 },
    );
  }

  if (!(await isAdminRequest())) {
    return Response.json({ error: "Admin access required." }, { status: 401 });
  }

  const body = (await request.json()) as {
    action?: "approve" | "reject";
    taskId?: string;
  };
  const supabase = createSupabaseAdminClient();

  if (!body.action) {
    return Response.json({ tasks: await listPetTasks(supabase) });
  }

  if (!body.taskId) {
    return Response.json({ error: "Missing task id." }, { status: 400 });
  }

  const { data: task, error: taskError } = await supabase
    .from("user_pet_tasks")
    .select("id, user_id, task_id, reward_score, status")
    .eq("id", body.taskId)
    .maybeSingle();

  if (taskError) {
    console.error("Admin pet task lookup failed", taskError);
    return Response.json({ error: taskError.message }, { status: 500 });
  }

  if (!task) {
    return Response.json({ error: "Pet task not found." }, { status: 404 });
  }

  if (task.status !== "pending") {
    return Response.json({ error: "Pet task is not pending review." }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (body.action === "reject") {
    const { error } = await supabase
      .from("user_pet_tasks")
      .update({ status: "rejected", reviewed_at: now })
      .eq("id", task.id);

    if (error) {
      console.error("Admin pet task reject failed", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      message: "Pet task rejected.",
      tasks: await listPetTasks(supabase),
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, coins, pet_score")
    .eq("id", task.user_id)
    .maybeSingle();

  if (profileError || !profile) {
    console.error("Admin pet task approve profile lookup failed", profileError);
    return Response.json(
      { error: profileError?.message ?? "Profile not found." },
      { status: profileError ? 500 : 404 },
    );
  }

  const nextPetScore = Math.min(1000, Number(profile.pet_score ?? 0) + Number(task.reward_score ?? 0));
  const previousCoins = Number(profile.coins ?? 0);
  const nextCoins = previousCoins + PET_TASK_COIN_REWARD;
  const profilePatch: {
    coins: number;
    pet_score: number;
    updated_at: string;
    last_pet_tax_at?: string;
  } = {
    coins: nextCoins,
    pet_score: nextPetScore,
    updated_at: now,
  };

  if (task.task_id === "pet-weekly-throne-tax") {
    profilePatch.last_pet_tax_at = now;
  }

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update(profilePatch)
    .eq("id", profile.id);

  if (profileUpdateError) {
    console.error("Admin pet score update failed", profileUpdateError);
    return Response.json({ error: profileUpdateError.message }, { status: 500 });
  }

  const { data: transaction, error: transactionError } = await supabase.from("coin_transactions").insert({
    user_id: profile.id,
    amount: PET_TASK_COIN_REWARD,
    reason: "pet_task_admin_approval",
    balance_before: previousCoins,
    balance_after: nextCoins,
    metadata: {
      taskId: task.task_id,
    },
  }).select("id").single();

  if (transactionError) {
    console.error("Admin pet task coin transaction insert failed", transactionError);
    const { error: rollbackProfileError } = await supabase
      .from("profiles")
      .update({
        coins: previousCoins,
        pet_score: Number(profile.pet_score ?? 0),
        updated_at: now,
      })
      .eq("id", profile.id)
      .eq("coins", nextCoins)
      .eq("pet_score", nextPetScore);

    if (rollbackProfileError) {
      console.error("Admin pet task profile rollback failed", rollbackProfileError);
    }

    return Response.json({ error: "Pet task approval logging failed." }, { status: 500 });
  }

  const { data: approvedTask, error: taskUpdateError } = await supabase
    .from("user_pet_tasks")
    .update({ status: "approved", reviewed_at: now })
    .eq("id", task.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (taskUpdateError) {
    console.error("Admin pet task approve failed", taskUpdateError);
    if (transaction?.id) {
      const { error: txCleanupError } = await supabase
        .from("coin_transactions")
        .delete()
        .eq("id", transaction.id);

      if (txCleanupError) {
        console.error("Admin pet task transaction cleanup failed", txCleanupError);
      }
    }

    const { error: rollbackProfileError } = await supabase
      .from("profiles")
      .update({
        coins: previousCoins,
        pet_score: Number(profile.pet_score ?? 0),
        updated_at: now,
      })
      .eq("id", profile.id)
      .eq("coins", nextCoins)
      .eq("pet_score", nextPetScore);

    if (rollbackProfileError) {
      console.error("Admin pet task profile rollback after task failure failed", rollbackProfileError);
    }

    return Response.json({ error: taskUpdateError.message }, { status: 500 });
  }

  if (!approvedTask) {
    console.error("Admin pet task approve skipped because task was no longer pending", { taskId: task.id });
    if (transaction?.id) {
      const { error: txCleanupError } = await supabase
        .from("coin_transactions")
        .delete()
        .eq("id", transaction.id);

      if (txCleanupError) {
        console.error("Admin pet task transaction cleanup after duplicate failed", txCleanupError);
      }
    }

    const { error: rollbackProfileError } = await supabase
      .from("profiles")
      .update({
        coins: previousCoins,
        pet_score: Number(profile.pet_score ?? 0),
        updated_at: now,
      })
      .eq("id", profile.id)
      .eq("coins", nextCoins)
      .eq("pet_score", nextPetScore);

    if (rollbackProfileError) {
      console.error("Admin pet task profile rollback after duplicate failed", rollbackProfileError);
    }

    return Response.json({ error: "Pet task is no longer pending review." }, { status: 409 });
  }

  return Response.json({
    message: `Pet task approved. +${task.reward_score ?? 0} Pet Score, +${PET_TASK_COIN_REWARD} coins.`,
    tasks: await listPetTasks(supabase),
  });
}
