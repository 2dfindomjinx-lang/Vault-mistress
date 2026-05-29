import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

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

  return (
    Boolean(profile?.is_admin) ||
    String(profile?.username ?? "").toLowerCase() === "@principessa2dfd"
  );
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
    .select("id, pet_score")
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
  const profilePatch: { pet_score: number; updated_at: string; last_pet_tax_at?: string } = {
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

  const { error: taskUpdateError } = await supabase
    .from("user_pet_tasks")
    .update({ status: "approved", reviewed_at: now })
    .eq("id", task.id);

  if (taskUpdateError) {
    console.error("Admin pet task approve failed", taskUpdateError);
    return Response.json({ error: taskUpdateError.message }, { status: 500 });
  }

  return Response.json({
    message: `Pet task approved. +${task.reward_score ?? 0} Pet Score.`,
    tasks: await listPetTasks(supabase),
  });
}
