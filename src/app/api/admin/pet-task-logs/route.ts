import { requireAdminProfile } from "@/lib/admin-guard";
import {
  ADMIN_PET_TASK_LOG_RETENTION_HOURS,
  cleanupExpiredAdminPetTaskLogs,
  listRecentAdminPetTaskLogs,
  syncThroneMilestoneTitles,
  type AdminPetTaskLogRow,
} from "@/lib/admin-pet-task-logs";
import { awardDevotion } from "@/lib/devotion";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function getLogOrError(logId: string, admin: Awaited<ReturnType<typeof requireAdminProfile>>) {
  if ("error" in admin) {
    return { error: admin.error, status: admin.status } as const;
  }

  const { data: log, error } = await admin.supabase
    .from("admin_pet_task_logs")
    .select("*")
    .eq("id", logId)
    .maybeSingle<AdminPetTaskLogRow>();

  if (error) {
    return { error: error.message, status: 500 } as const;
  }

  if (!log) {
    return { error: "Log not found.", status: 404 } as const;
  }

  return { log } as const;
}

export async function GET() {
  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return jsonError(admin.error ?? "Admin access required.", admin.status);
  }

  const logs = await listRecentAdminPetTaskLogs(admin.supabase);
  return Response.json({ logs });
}

export async function POST(request: Request) {
  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return jsonError(admin.error ?? "Admin access required.", admin.status);
  }

  await cleanupExpiredAdminPetTaskLogs(admin.supabase);

  const body = (await request.json().catch(() => null)) as {
    action?: "clear" | "revert";
    logId?: string;
  } | null;

  if (!body?.action || !body.logId) {
    return jsonError("Action and log id are required.");
  }

  const resolved = await getLogOrError(body.logId, admin);
  if ("error" in resolved) {
    return jsonError(resolved.error ?? "Log lookup failed.", resolved.status);
  }

  const log = resolved.log;
  const nowIso = new Date().toISOString();
  const expiryMs = new Date(log.created_at).getTime() + ADMIN_PET_TASK_LOG_RETENTION_HOURS * 60 * 60 * 1000;

  if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) {
    await admin.supabase.from("admin_pet_task_logs").delete().eq("id", log.id);
    return jsonError("Log expired.", 410);
  }

  if (body.action === "clear") {
    if (log.status === "cleared") {
      return jsonError("Log already cleared.", 409);
    }

    const { error } = await admin.supabase
      .from("admin_pet_task_logs")
      .update({
        metadata: {
          ...(log.metadata ?? {}),
          clearedByAdminUserId: admin.adminUser.id,
          clearedAt: nowIso,
        },
        resolved_at: nowIso,
        reviewed_by_user_id: admin.adminUser.id,
        status: "cleared",
        updated_at: nowIso,
      })
      .eq("id", log.id);

    if (error) {
      return jsonError(error.message, 500);
    }

    return Response.json({
      logs: await listRecentAdminPetTaskLogs(admin.supabase),
      message: "Marked correct.",
    });
  }

  if (log.status === "reverted") {
    return jsonError("Log already reverted.", 409);
  }

  const { data: profile, error: profileError } = await admin.supabase
    .from("profiles")
    .select("id, coins, pet_score")
    .eq("id", log.user_id)
    .maybeSingle();

  if (profileError || !profile) {
    return jsonError(profileError?.message ?? "Profile not found.", profileError ? 500 : 404);
  }

  const profileCoins = Number(profile.coins ?? 0);
  const profilePetScore = Number(profile.pet_score ?? 0);
  const coinDelta = log.status === "executed" ? Math.max(0, Number(log.coin_total_delta ?? 0)) : 0;
  const nextCoins = profileCoins - coinDelta;
  const nextPetScore = Math.max(0, profilePetScore - Math.max(0, Number(log.reward_score_delta ?? 0)));

  const { error: profileUpdateError } = await admin.supabase
    .from("profiles")
    .update({
      coins: nextCoins,
      pet_score: nextPetScore,
      updated_at: nowIso,
    })
    .eq("id", log.user_id)
    .eq("coins", profileCoins)
    .eq("pet_score", profilePetScore);

  if (profileUpdateError) {
    return jsonError(profileUpdateError.message, 500);
  }

  if (coinDelta > 0) {
    const { error: txError } = await admin.supabase
      .from("coin_transactions")
      .insert({
        admin_user_id: admin.adminUser.id,
        amount: -coinDelta,
        balance_after: nextCoins,
        balance_before: profileCoins,
        metadata: {
          adminPetTaskLogId: log.id,
          kind: "pet_task_revert",
          source: "admin_pet_task_log_revert",
          taskId: log.task_id,
        },
        reason: "admin_drain",
        user_id: log.user_id,
      });

    if (txError) {
      await admin.supabase
        .from("profiles")
        .update({
          coins: profileCoins,
          pet_score: profilePetScore,
          updated_at: nowIso,
        })
        .eq("id", log.user_id)
        .eq("coins", nextCoins)
        .eq("pet_score", nextPetScore);
      return jsonError("Revert drain logging failed.", 500);
    }
  }

  if (log.pending_action_id) {
    const { data: pendingAction } = await admin.supabase
      .from("pending_admin_actions")
      .select("id, status")
      .eq("id", log.pending_action_id)
      .maybeSingle();

    if (pendingAction?.status === "pending") {
      await admin.supabase
        .from("pending_admin_actions")
        .update({
          approved_at: nowIso,
          approved_by_user_id: admin.adminUser.id,
          status: "rejected",
        })
        .eq("id", pendingAction.id);
    }
  }

  if (log.task_row_id) {
    const { error: taskResetError } = await admin.supabase
      .from("user_pet_tasks")
      .update({
        reviewed_at: null,
        status: "pending",
      })
      .eq("id", log.task_row_id)
      .eq("user_id", log.user_id);

    if (taskResetError) {
      console.error("Admin pet task log revert task reset failed", taskResetError);
    }
  }

  const devotionDelta = Math.max(0, Number(log.devotion_delta ?? 0));
  if (devotionDelta > 0) {
    try {
      await awardDevotion(admin.supabase, {
        amount: -devotionDelta,
        metadata: {
          adminPetTaskLogId: log.id,
          taskId: log.task_id,
        },
        source: "admin_pet_task_revert",
        sourceKey: `admin-pet-task-revert:${log.id}`,
        userId: log.user_id,
      });
    } catch (devotionError) {
      console.error("Admin pet task log devotion revert failed", devotionError);
    }
  }

  if (log.task_id === "pet-throne-tribute") {
    const { data: giftRows, error: giftError } = await admin.supabase
      .from("coin_transactions")
      .select("amount")
      .eq("user_id", log.user_id)
      .in("reason", ["throne_tribute", "live_gift"]);

    if (giftError) {
      console.error("Admin pet task log throne total lookup failed", giftError);
    } else {
      const rawGiftTotal = (giftRows ?? []).reduce((sum, row) => sum + Math.max(0, Number(row.amount ?? 0)), 0);
      await syncThroneMilestoneTitles(admin.supabase, log.user_id, rawGiftTotal);
    }
  }

  const { error: logUpdateError } = await admin.supabase
    .from("admin_pet_task_logs")
    .update({
      metadata: {
        ...(log.metadata ?? {}),
        revertedByAdminUserId: admin.adminUser.id,
        revertedAt: nowIso,
      },
      resolved_at: nowIso,
      reviewed_by_user_id: admin.adminUser.id,
      status: "reverted",
      updated_at: nowIso,
    })
    .eq("id", log.id);

  if (logUpdateError) {
    return jsonError(logUpdateError.message, 500);
  }

  return Response.json({
    logs: await listRecentAdminPetTaskLogs(admin.supabase),
    message: "Action reverted.",
  });
}
