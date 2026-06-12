import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { isTrustedAdminUsername } from "@/lib/admin-identity";
import { IRL_TASK_APPROVAL_AFFECTION_GAIN } from "@/lib/irl-task-wheel";
import { recordIrlFailureAndAutoApproveIntentionalFail } from "@/lib/server-irl-task-auto-approval";

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
    console.error("Admin auth profile lookup failed", error);
    return false;
  }

  return isTrustedAdminUsername(profile?.username);
}

export async function POST(request: Request) {
  const configErrors = getSupabaseAdminConfigErrors();

  if (!isSupabaseAdminConfigured) {
    console.error("Admin IRL task route is not configured", configErrors);
    return Response.json(
      { error: `Admin environment is not configured: ${configErrors.join(", ")}` },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    action?: "approve" | "cancelShame" | "countPending" | "excuse" | "removeTimeout";
    taskId?: string;
    userId?: string;
  };

  if (!(await isAdminRequest())) {
    return Response.json({ error: "Admin access required." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  if (body.action === "countPending") {
    const { count, error } = await supabase
      .from("user_irl_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "assigned");

    if (error) {
      console.error("Admin IRL pending count failed", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ count: count ?? 0 });
  }

  if (body.action === "removeTimeout") {
    let userId = body.userId;

    if (!userId && body.taskId) {
      const { data: task, error: taskError } = await supabase
        .from("user_irl_tasks")
        .select("user_id")
        .eq("id", body.taskId)
        .maybeSingle();

      if (taskError) {
        console.error("Admin timeout removal task lookup failed", taskError);
        return Response.json({ error: taskError.message }, { status: 500 });
      }

      userId = task?.user_id;
    }

    if (!userId) {
      return Response.json({ error: "Missing user id." }, { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ timeout_until: null, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) {
      console.error("Admin timeout removal failed", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ message: "Timeout removed." });
  }

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

      const { data: approvedTask, error: taskUpdateError } = await supabase
        .from("user_irl_tasks")
        .delete()
        .eq("id", task.id)
        .eq("status", "assigned")
        .select("id")
        .maybeSingle();

      if (taskUpdateError || !approvedTask) {
        console.error("Admin IRL approve task delete failed", taskUpdateError);
        const { error: rollbackError } = await supabase
          .from("profiles")
          .update({ affection: Number(profile.affection ?? 0), updated_at: now })
          .eq("id", profile.id)
          .eq("affection", nextAffection);

        if (rollbackError) {
          console.error("Admin IRL approve affection rollback failed", rollbackError);
        }

        return Response.json(
          { error: taskUpdateError?.message ?? "This IRL task has already been reviewed." },
          { status: taskUpdateError ? 500 : 409 },
        );
      }

      return Response.json({
        message: `Approved ${profile.username}. +${IRL_TASK_APPROVAL_AFFECTION_GAIN} affection.`,
      });
    }

    if (body.action === "cancelShame") {
      const { data: taskDetails, error: detailError } = await supabase
        .from("user_irl_tasks")
        .select("id, user_id, task_label, penalty_timeout_minutes")
        .eq("id", task.id)
        .maybeSingle();

      if (detailError) {
        console.error("Admin IRL cancel/fail lookup failed", detailError);
        return Response.json({ error: detailError.message }, { status: 500 });
      }

      if (!taskDetails) {
        return Response.json({ error: "IRL task not found." }, { status: 404 });
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, shame_count, timeout_until")
        .eq("id", taskDetails.user_id)
        .maybeSingle();

      if (profileError) {
        console.error("Admin IRL cancel/fail profile lookup failed", profileError);
        return Response.json({ error: profileError.message }, { status: 500 });
      }

      if (!profile) {
        return Response.json({ error: "Profile not found." }, { status: 404 });
      }

      const penaltyMinutes = Number(taskDetails.penalty_timeout_minutes ?? 0);
      const timeoutUntil =
        penaltyMinutes > 0
          ? new Date(Date.now() + penaltyMinutes * 60 * 1000).toISOString()
          : null;
      const profilePatch: {
        shame_count: number;
        timeout_until?: string;
        updated_at: string;
      } = {
        shame_count: Number(profile.shame_count ?? 0) + 1,
        updated_at: now,
      };

      if (timeoutUntil) {
        profilePatch.timeout_until = timeoutUntil;
      }

      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update(profilePatch)
        .eq("id", profile.id);

      if (profileUpdateError) {
        console.error("Admin IRL cancel/fail profile update failed", profileUpdateError);
        return Response.json({ error: profileUpdateError.message }, { status: 500 });
      }

      const { data: failedTask, error: taskUpdateError } = await supabase
        .from("user_irl_tasks")
        .delete()
        .eq("id", task.id)
        .eq("status", "assigned")
        .select("id")
        .maybeSingle();

      if (taskUpdateError || !failedTask) {
        console.error("Admin IRL cancel/fail task delete failed", taskUpdateError);
        const rollbackPatch: {
          shame_count: number;
          timeout_until?: string | null;
          updated_at: string;
        } = {
          shame_count: Number(profile.shame_count ?? 0),
          updated_at: now,
        };

        if (timeoutUntil) {
          rollbackPatch.timeout_until = profile.timeout_until ?? null;
        }

        const { error: rollbackError } = await supabase
          .from("profiles")
          .update(rollbackPatch)
          .eq("id", profile.id)
          .eq("shame_count", Number(profile.shame_count ?? 0) + 1);

        if (rollbackError) {
          console.error("Admin IRL cancel/fail rollback failed", rollbackError);
        }

        return Response.json(
          { error: taskUpdateError?.message ?? "This IRL task has already been reviewed." },
          { status: taskUpdateError ? 500 : 409 },
        );
      }

      const intentionalFailResult = await recordIrlFailureAndAutoApproveIntentionalFail(supabase, {
        failedAtIso: now,
        failedTaskId: taskDetails.id,
        failedTaskLabel: taskDetails.task_label,
        userId: taskDetails.user_id,
      });

      return Response.json({
        message: intentionalFailResult.autoApproved
          ? `Cancelled task and added +1 fail to ${profile.username}. ${intentionalFailResult.message}`
          : `Cancelled task and added +1 fail to ${profile.username}.`,
      });
    }

    const { data: excusedTask, error: excuseError } = await supabase
      .from("user_irl_tasks")
      .delete()
      .eq("id", task.id)
      .eq("status", "assigned")
      .select("id")
      .maybeSingle();

    if (excuseError || !excusedTask) {
      console.error("Admin IRL Throne excuse update failed", excuseError);
      return Response.json(
        { error: excuseError?.message ?? "This IRL task has already been reviewed." },
        { status: excuseError ? 500 : 409 },
      );
    }

    return Response.json({
      message: "Task cleared via Throne support. No affection added and no timeout applied.",
    });
  }

  const { error: cleanupError } = await supabase
    .from("user_irl_tasks")
    .delete()
    .not("reviewed_at", "is", null);

  if (cleanupError) {
    console.error("Admin IRL reviewed task cleanup failed", cleanupError);
  }

  const { data, error } = await supabase
    .from("user_irl_tasks")
    .select("id, user_id, task_label, task_description, wheel_index, cost_coins, status, due_at, penalty_timeout_minutes, completed_at, reviewed_at, shamed_at, assigned_at")
    .eq("status", "assigned")
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
