import { requireMobileAdmin } from "@/lib/mobile-admin";
import { IRL_TASK_APPROVAL_AFFECTION_GAIN } from "@/lib/irl-task-wheel";
import { recordIrlFailureAndAutoApproveIntentionalFail } from "@/lib/server-irl-task-auto-approval";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function listIrlTasks(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("user_irl_tasks")
    .select("id, user_id, task_label, task_description, cost_coins, status, due_at, penalty_timeout_minutes, completed_at, reviewed_at, assigned_at")
    .eq("status", "assigned")
    .order("assigned_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown> & { user_id: string }>;
  const userIds = Array.from(new Set(rows.map((entry) => entry.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, timeout_until")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const profileRows = (profiles ?? []) as Array<{ id: string; timeout_until: string | null; username: string }>;
  const profileMap = new Map(profileRows.map((profile) => [profile.id, profile]));

  return rows.map((task) => {
    const profile = profileMap.get(task.user_id);
    return { ...task, username: profile?.username ?? "@unknown", timeout_until: profile?.timeout_until ?? null };
  });
}

export async function POST(request: Request) {
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as {
    action?: "approve" | "cancelShame" | "excuse" | "removeTimeout" | "list";
    taskId?: string;
    userId?: string;
  };

  if (!body.action || body.action === "list") return Response.json({ tasks: await listIrlTasks(admin.supabase) });

  if (body.action === "removeTimeout") {
    const userId = body.userId?.trim();
    if (!userId) return Response.json({ error: "Missing user id." }, { status: 400 });
    const { error } = await admin.supabase.from("profiles").update({ timeout_until: null, updated_at: new Date().toISOString() }).eq("id", userId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ message: "Timeout removed.", tasks: await listIrlTasks(admin.supabase) });
  }

  if (!body.taskId) return Response.json({ error: "Missing task id." }, { status: 400 });
  const { data: task, error: taskError } = await admin.supabase
    .from("user_irl_tasks")
    .select("id, user_id, task_label, status, penalty_timeout_minutes")
    .eq("id", body.taskId)
    .maybeSingle();
  if (taskError) return Response.json({ error: taskError.message }, { status: 500 });
  if (!task) return Response.json({ error: "IRL task not found." }, { status: 404 });
  if (task.status !== "assigned") return Response.json({ error: "Task has already been reviewed." }, { status: 400 });

  const now = new Date().toISOString();
  if (body.action === "approve") {
    const { data: profile, error: profileError } = await admin.supabase
      .from("profiles")
      .select("id, username, affection")
      .eq("id", task.user_id)
      .maybeSingle();
    if (profileError || !profile) return Response.json({ error: profileError?.message ?? "Profile not found." }, { status: profileError ? 500 : 404 });
    const nextAffection = Math.min(100, Number(profile.affection ?? 0) + IRL_TASK_APPROVAL_AFFECTION_GAIN);
    const { error: profileUpdateError } = await admin.supabase
      .from("profiles")
      .update({ affection: nextAffection, updated_at: now })
      .eq("id", profile.id);
    if (profileUpdateError) return Response.json({ error: profileUpdateError.message }, { status: 500 });

    const { data: approvedTask, error } = await admin.supabase
      .from("user_irl_tasks")
      .delete()
      .eq("id", task.id)
      .eq("status", "assigned")
      .select("id")
      .maybeSingle();
    if (error || !approvedTask) {
      await admin.supabase
        .from("profiles")
        .update({ affection: Number(profile.affection ?? 0), updated_at: now })
        .eq("id", profile.id)
        .eq("affection", nextAffection);
      return Response.json(
        { error: error?.message ?? "Task has already been reviewed." },
        { status: error ? 500 : 409 },
      );
    }
    return Response.json({ message: "IRL task approved.", tasks: await listIrlTasks(admin.supabase) });
  }

  if (body.action === "cancelShame") {
    const penaltyMinutes = Number(task.penalty_timeout_minutes ?? 0);
    const timeoutUntil = penaltyMinutes > 0 ? new Date(Date.now() + penaltyMinutes * 60 * 1000).toISOString() : null;
    const { data: profile, error: profileError } = await admin.supabase
      .from("profiles")
      .select("id, shame_count, timeout_until")
      .eq("id", task.user_id)
      .maybeSingle();
    if (profileError || !profile) return Response.json({ error: profileError?.message ?? "Profile not found." }, { status: profileError ? 500 : 404 });

    const nextShameCount = Number(profile.shame_count ?? 0) + 1;
    const { error: profileUpdateError } = await admin.supabase
      .from("profiles")
      .update({ shame_count: nextShameCount, timeout_until: timeoutUntil, updated_at: now })
      .eq("id", task.user_id);
    if (profileUpdateError) return Response.json({ error: profileUpdateError.message }, { status: 500 });

    const { data: failedTask, error } = await admin.supabase
      .from("user_irl_tasks")
      .delete()
      .eq("id", task.id)
      .eq("status", "assigned")
      .select("id")
      .maybeSingle();
    if (error || !failedTask) {
      await admin.supabase
        .from("profiles")
        .update({ shame_count: Number(profile.shame_count ?? 0), timeout_until: profile.timeout_until ?? null, updated_at: now })
        .eq("id", task.user_id)
        .eq("shame_count", nextShameCount);
      return Response.json(
        { error: error?.message ?? "Task has already been reviewed." },
        { status: error ? 500 : 409 },
      );
    }
    const intentionalFailResult = await recordIrlFailureAndAutoApproveIntentionalFail(admin.supabase, {
      failedAtIso: now,
      failedTaskId: task.id,
      failedTaskLabel: task.task_label,
      userId: task.user_id,
    });
    return Response.json({
      message: intentionalFailResult.autoApproved
        ? `IRL task failed and shame added. ${intentionalFailResult.message}`
        : "IRL task failed and shame added.",
      tasks: await listIrlTasks(admin.supabase),
    });
  }

  const { data: excusedTask, error } = await admin.supabase
    .from("user_irl_tasks")
    .delete()
    .eq("id", task.id)
    .eq("status", "assigned")
    .select("id")
    .maybeSingle();
  if (error || !excusedTask) {
    return Response.json(
      { error: error?.message ?? "Task has already been reviewed." },
      { status: error ? 500 : 409 },
    );
  }
  return Response.json({ message: "IRL task excused.", tasks: await listIrlTasks(admin.supabase) });
}
