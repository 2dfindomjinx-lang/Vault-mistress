import { requireMobileAdmin } from "@/lib/mobile-admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PET_TASK_COIN_REWARD = 250;

async function listPetTasks(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("user_pet_tasks")
    .select("id, user_id, task_id, completed_at, reward_score, status, reviewed_at, created_at, metadata")
    .neq("task_id", "pet-affection-claim")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown> & { user_id: string }>;
  const userIds = Array.from(new Set(rows.map((entry) => entry.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, pet_score")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const profileRows = (profiles ?? []) as Array<{ id: string; pet_score: number; username: string }>;
  const profileMap = new Map(profileRows.map((profile) => [profile.id, profile]));

  return rows.map((task) => {
    const profile = profileMap.get(task.user_id);
    return { ...task, username: profile?.username ?? "@unknown", pet_score: profile?.pet_score ?? 0 };
  });
}

export async function POST(request: Request) {
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as { action?: "approve" | "reject"; taskId?: string };
  if (!body.action) return Response.json({ tasks: await listPetTasks(admin.supabase) });
  if (!body.taskId) return Response.json({ error: "Missing task id." }, { status: 400 });

  const { data: task, error: taskError } = await admin.supabase
    .from("user_pet_tasks")
    .select("id, user_id, task_id, reward_score, status")
    .eq("id", body.taskId)
    .maybeSingle();

  if (taskError) return Response.json({ error: taskError.message }, { status: 500 });
  if (!task) return Response.json({ error: "Pet task not found." }, { status: 404 });
  if (task.status !== "pending") return Response.json({ error: "Pet task is not pending review." }, { status: 400 });

  const now = new Date().toISOString();
  if (body.action === "reject") {
    const { error } = await admin.supabase
      .from("user_pet_tasks")
      .update({ status: "rejected", reviewed_at: now })
      .eq("id", task.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ message: "Pet task rejected.", tasks: await listPetTasks(admin.supabase) });
  }

  const { data: profile, error: profileError } = await admin.supabase
    .from("profiles")
    .select("id, coins, pet_score")
    .eq("id", task.user_id)
    .maybeSingle();
  if (profileError || !profile) {
    return Response.json({ error: profileError?.message ?? "Profile not found." }, { status: profileError ? 500 : 404 });
  }

  const previousCoins = Number(profile.coins ?? 0);
  const nextCoins = previousCoins + PET_TASK_COIN_REWARD;
  const nextPetScore = Math.min(1000, Number(profile.pet_score ?? 0) + Number(task.reward_score ?? 0));
  const profilePatch: {
    coins: number;
    pet_score: number;
    updated_at: string;
    last_pet_tax_at?: string;
  } = { coins: nextCoins, pet_score: nextPetScore, updated_at: now };

  if (task.task_id === "pet-weekly-throne-tax") {
    profilePatch.last_pet_tax_at = now;
  }

  const { error: profileUpdateError } = await admin.supabase
    .from("profiles")
    .update(profilePatch)
    .eq("id", profile.id);
  if (profileUpdateError) return Response.json({ error: profileUpdateError.message }, { status: 500 });

  const { data: transaction, error: transactionError } = await admin.supabase.from("coin_transactions").insert({
    user_id: profile.id,
    amount: PET_TASK_COIN_REWARD,
    reason: "pet_task_admin_approval",
    balance_before: previousCoins,
    balance_after: nextCoins,
    metadata: { taskId: task.task_id },
  }).select("id").single();

  if (transactionError) {
    console.error("Mobile admin pet task transaction insert failed", transactionError);
    await admin.supabase
      .from("profiles")
      .update({ coins: previousCoins, pet_score: Number(profile.pet_score ?? 0), updated_at: now })
      .eq("id", profile.id)
      .eq("coins", nextCoins)
      .eq("pet_score", nextPetScore);
    return Response.json({ error: "Pet task approval logging failed." }, { status: 500 });
  }

  const { data: approvedTask, error: taskUpdateError } = await admin.supabase
    .from("user_pet_tasks")
    .update({ status: "approved", reviewed_at: now })
    .eq("id", task.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (taskUpdateError || !approvedTask) {
    if (transaction?.id) {
      await admin.supabase.from("coin_transactions").delete().eq("id", transaction.id);
    }
    await admin.supabase
      .from("profiles")
      .update({ coins: previousCoins, pet_score: Number(profile.pet_score ?? 0), updated_at: now })
      .eq("id", profile.id)
      .eq("coins", nextCoins)
      .eq("pet_score", nextPetScore);
    return Response.json(
      { error: taskUpdateError?.message ?? "Pet task is no longer pending review." },
      { status: taskUpdateError ? 500 : 409 },
    );
  }

  return Response.json({ message: "Pet task approved.", tasks: await listPetTasks(admin.supabase) });
}
