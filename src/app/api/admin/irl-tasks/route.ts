import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { IRL_TASK_APPROVAL_AFFECTION_GAIN } from "@/lib/irl-task-wheel";

export async function POST(request: Request) {
  const configErrors = [
    ...getSupabaseAdminConfigErrors(),
    !process.env.ADMIN_PASSWORD ? "ADMIN_PASSWORD is missing" : "",
  ].filter(Boolean);

  if (!isSupabaseAdminConfigured || !process.env.ADMIN_PASSWORD) {
    console.error("Admin IRL task route is not configured", configErrors);
    return Response.json(
      { error: `Admin environment is not configured: ${configErrors.join(", ")}` },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    adminPassword?: string;
    action?: "approve" | "excuse";
    taskId?: string;
  };

  if (body.adminPassword !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Invalid admin password." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  if (body.action) {
    if (!body.taskId) {
      return Response.json({ error: "Missing task id." }, { status: 400 });
    }

    const { data: task, error: taskError } = await supabase
      .from("user_irl_tasks")
      .select("id, user_id, status")
      .eq("id", body.taskId)
      .maybeSingle();

    if (taskError) {
      console.error("Admin IRL task lookup failed", taskError);
      return Response.json({ error: taskError.message }, { status: 500 });
    }

    if (!task) {
      return Response.json({ error: "IRL task not found." }, { status: 404 });
    }

    if (task.status !== "assigned") {
      return Response.json(
        { error: "This IRL task has already been reviewed." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    if (body.action === "approve") {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, affection")
        .eq("id", task.user_id)
        .maybeSingle();

      if (profileError) {
        console.error("Admin IRL approve profile lookup failed", profileError);
        return Response.json({ error: profileError.message }, { status: 500 });
      }

      if (!profile) {
        return Response.json({ error: "Profile not found." }, { status: 404 });
      }

      const nextAffection = Math.min(
        100,
        Number(profile.affection ?? 0) + IRL_TASK_APPROVAL_AFFECTION_GAIN,
      );
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ affection: nextAffection, updated_at: now })
        .eq("id", profile.id);

      if (profileUpdateError) {
        console.error("Admin IRL approve affection update failed", profileUpdateError);
        return Response.json({ error: profileUpdateError.message }, { status: 500 });
      }

      const { error: taskUpdateError } = await supabase
        .from("user_irl_tasks")
        .update({ completed_at: now, reviewed_at: now, status: "approved" })
        .eq("id", task.id);

      if (taskUpdateError) {
        console.error("Admin IRL approve task update failed", taskUpdateError);
        return Response.json({ error: taskUpdateError.message }, { status: 500 });
      }

      return Response.json({
        message: `Approved ${profile.username}. +${IRL_TASK_APPROVAL_AFFECTION_GAIN} affection.`,
      });
    }

    const { error: excuseError } = await supabase
      .from("user_irl_tasks")
      .update({ completed_at: now, reviewed_at: now, status: "excused_throne" })
      .eq("id", task.id);

    if (excuseError) {
      console.error("Admin IRL Throne excuse update failed", excuseError);
      return Response.json({ error: excuseError.message }, { status: 500 });
    }

    return Response.json({
      message: "Task cleared via Throne support. No affection added.",
    });
  }

  const { data, error } = await supabase
    .from("user_irl_tasks")
    .select("id, user_id, task_label, task_description, wheel_index, cost_coins, status, due_at, penalty_timeout_minutes, completed_at, reviewed_at, shamed_at, assigned_at")
    .order("assigned_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Admin IRL task list failed", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const userIds = Array.from(new Set((data ?? []).map((entry) => entry.user_id)));
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, timeout_until")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  if (profileError) {
    console.error("Admin IRL task profile lookup failed", profileError);
  }

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  return Response.json({
    tasks: (data ?? []).map((entry) => {
      const profile = profileMap.get(entry.user_id);

      return {
        ...entry,
        timeout_until: profile?.timeout_until ?? null,
        username: profile?.username ?? "@unknown",
      };
    }),
  });
}
