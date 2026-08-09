import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { requireAdminProfile } from "@/lib/admin-guard";
import { awardDevotion, DEVOTION_REWARD_REVIEW_TASK } from "@/lib/devotion";
import { syncThroneMilestoneTitles } from "@/lib/admin-pet-task-logs";
import { PM_TO_COIN_RATE } from "@/lib/principessa-money";
import {
  getPetThroneRewardBreakdown,
  PET_THRONE_TASK_ID,
} from "@/lib/pet-throne";
import { createUserNotification } from "@/lib/user-notifications";
import { PET_TASK_COIN_REWARD } from "@/lib/server-game-rules";

async function listPetTasks(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await supabase
    .from("user_pet_tasks")
    .select("id, user_id, task_id, completed_at, reward_score, status, reviewed_at, created_at, metadata")
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

  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as {
    action?: "approve" | "reject";
    taskId?: string;
  };
  const supabase = admin.supabase;

  if (!body.action) {
    return Response.json({ tasks: await listPetTasks(supabase) });
  }

  if (!body.taskId) {
    return Response.json({ error: "Missing task id." }, { status: 400 });
  }

  const { data: task, error: taskError } = await supabase
    .from("user_pet_tasks")
    .select("id, user_id, task_id, reward_score, status, metadata")
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

    try {
      await createUserNotification(supabase, {
        body: `Your pet task "${task.task_id}" was rejected during review.`,
        kind: "pet_task_rejected",
        metadata: {
          taskId: task.id,
          taskKey: task.task_id,
        },
        title: "Pet Task Rejected",
        userId: task.user_id,
      });
    } catch (notificationError) {
      console.error("Admin pet task reject notification failed", notificationError);
    }

    return Response.json({
      message: "Pet task rejected.",
      tasks: await listPetTasks(supabase),
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, coins, pet_score, principessa_money")
    .eq("id", task.user_id)
    .maybeSingle();

  if (profileError || !profile) {
    console.error("Admin pet task approve profile lookup failed", profileError);
    return Response.json(
      { error: profileError?.message ?? "Profile not found." },
      { status: profileError ? 500 : 404 },
    );
  }

  const previousCoins = Number(profile.coins ?? 0);
  const taskMetadata = (task.metadata ?? {}) as Record<string, unknown>;
  const isThroneTask = task.task_id === PET_THRONE_TASK_ID;
  const petScoreDelta = isThroneTask ? 0 : Number(task.reward_score ?? 0);
  const throneAmount = typeof taskMetadata.throneAmount === "number" ? taskMetadata.throneAmount : 0;
  const throneBreakdown = getPetThroneRewardBreakdown(throneAmount);
  const throneBaseCoinAmount =
    typeof taskMetadata.throneBaseCoinAmount === "number"
      ? Math.max(0, Math.floor(taskMetadata.throneBaseCoinAmount))
      : throneBreakdown.baseCoinAmount;
  const throneGiveBonusAmount =
    typeof taskMetadata.throneGiveBonusAmount === "number"
      ? Math.max(0, Math.floor(taskMetadata.throneGiveBonusAmount))
      : throneBreakdown.giveBonusAmount;
  const throneTaskBonusAmount =
    typeof taskMetadata.throneTaskBonusAmount === "number"
      ? Math.max(0, Math.floor(taskMetadata.throneTaskBonusAmount))
      : throneBreakdown.taskBonusAmount;
  const throneTotalCoinAmount =
    typeof taskMetadata.throneTotalCoinAmount === "number"
      ? Math.max(0, Math.floor(taskMetadata.throneTotalCoinAmount))
      : throneBaseCoinAmount + throneGiveBonusAmount + throneTaskBonusAmount;
  const coinRewardAmount = isThroneTask ? 0 : PET_TASK_COIN_REWARD;
  const nextCoins = previousCoins + coinRewardAmount;
  const nextPetScore = Number(profile.pet_score ?? 0) + petScoreDelta;
  // Throne now pays Principessa Money at 1 USD = 1 PM, credited immediately.
  // The Companion App two-step approval was removed with it: the payout is no
  // longer a free-form coin grant an admin types, it is a fixed function of the
  // amount already recorded on the task, so there is nothing for a second
  // device to sanity-check. The user still gets a notification when it lands.
  const previousMoney = Math.max(0, Math.floor(Number(profile.principessa_money) || 0));
  const throneMoneyAmount = throneBreakdown.moneyAmount;
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

  if (isThroneTask && throneBaseCoinAmount <= 0) {
    return Response.json({ error: "Invalid Throne reward payload." }, { status: 422 });
  }

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update(profilePatch)
    .eq("id", profile.id);

  if (profileUpdateError) {
    console.error("Admin pet score update failed", profileUpdateError);
    return Response.json({ error: profileUpdateError.message }, { status: 500 });
  }

  let transactionIds: string[] = [];
  const pendingActionId: string | null = null;
  let approvalMessage = `Pet task approved. +${petScoreDelta} Pet Score, +${PET_TASK_COIN_REWARD} coins.`;

  if (isThroneTask) {
    const nextMoney = previousMoney + throneMoneyAmount;
    const { error: throneMoneyError } = await supabase
      .from("profiles")
      .update({ principessa_money: nextMoney, updated_at: now })
      .eq("id", profile.id)
      .eq("principessa_money", previousMoney);

    if (throneMoneyError) {
      console.error("Admin pet throne money payout update failed", throneMoneyError);
      await supabase
        .from("profiles")
        .update({ coins: previousCoins, pet_score: Number(profile.pet_score ?? 0), updated_at: now })
        .eq("id", profile.id)
        .eq("coins", nextCoins)
        .eq("pet_score", nextPetScore);
      return Response.json({ error: "Throne payout profile update failed." }, { status: 500 });
    }

    const { error: moneyLedgerError } = await supabase.from("money_transactions").insert({
      amount: throneMoneyAmount,
      balance_after: nextMoney,
      balance_before: previousMoney,
      metadata: {
        adminUserId: admin.adminUser.id,
        coinEquivalent: throneBaseCoinAmount,
        petTaskId: task.id,
        source: "pet_task_admin_approval",
        throneAmount,
        usernameSnapshot: profile.username,
      },
      reason: "throne_tribute",
      // One credit per reviewed task row: re-approving the same submission
      // cannot mint a second payout.
      source_key: `pet-throne:${task.id}`,
      user_id: profile.id,
    });

    if (moneyLedgerError) {
      const isDuplicate = moneyLedgerError.code === "23505";
      await supabase
        .from("profiles")
        .update({ coins: previousCoins, principessa_money: previousMoney, pet_score: Number(profile.pet_score ?? 0), updated_at: now })
        .eq("id", profile.id)
        .eq("principessa_money", nextMoney);
      console.error("Admin pet throne money ledger insert failed", moneyLedgerError);
      return Response.json(
        { error: isDuplicate ? "This Throne submission was already paid out." : "Throne payout logging failed." },
        { status: isDuplicate ? 409 : 500 },
      );
    }

    try {
      await awardDevotion(supabase, {
        amount: Math.floor(throneBaseCoinAmount * 0.01),
        metadata: { coinEquivalent: throneBaseCoinAmount, petTaskId: task.id, throneAmount },
        source: "admin_give",
        sourceKey: `pet-throne-devotion:${task.id}`,
        userId: profile.id,
      });
    } catch (devotionError) {
      console.error("Admin pet throne devotion award failed", devotionError);
    }

    // Milestone titles are keyed on a coin-denominated lifetime gift total.
    // Historical tributes still live in coin_transactions, new ones in
    // money_transactions, so both are counted - PM at its base coin rate.
    const [{ data: giftRows, error: giftTotalError }, { data: moneyGiftRows, error: moneyGiftError }] = await Promise.all([
      supabase.from("coin_transactions").select("amount").eq("user_id", profile.id).in("reason", ["throne_tribute", "live_gift"]),
      supabase.from("money_transactions").select("amount").eq("user_id", profile.id).eq("reason", "throne_tribute"),
    ]);

    if (giftTotalError || moneyGiftError) {
      console.error("Admin pet throne title milestone lookup failed", giftTotalError ?? moneyGiftError);
    } else {
      const coinGiftTotal = (giftRows ?? []).reduce((sum, row) => sum + Math.max(0, Number(row.amount ?? 0)), 0);
      const moneyGiftTotal = (moneyGiftRows ?? []).reduce((sum, row) => sum + Math.max(0, Number(row.amount ?? 0)), 0);
      await syncThroneMilestoneTitles(supabase, profile.id, coinGiftTotal + moneyGiftTotal * PM_TO_COIN_RATE);
    }

    try {
      await createUserNotification(supabase, {
        body: `${throneMoneyAmount.toLocaleString()} Principessa Money landed in your balance. Convert it to coins whenever you want.`,
        kind: "throne_money_credited",
        metadata: { moneyAmount: throneMoneyAmount, petTaskId: task.id, throneAmount },
        title: "Throne tribute credited",
        userId: profile.id,
      });
    } catch (notificationError) {
      console.error("Admin pet throne notification failed", notificationError);
    }

    approvalMessage = `Throne payout added: ${throneMoneyAmount.toLocaleString()} Principessa Money (= ${throneBaseCoinAmount.toLocaleString()} coins at base rate).`;
  } else {
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

    if (transaction?.id) {
      transactionIds = [transaction.id];
    }
  }

  try {
    await createUserNotification(supabase, {
      body: isThroneTask
        ? "Your Throne-related pet task was approved."
        : `Your pet task "${task.task_id}" was approved. You received +${petScoreDelta} Pet Score and +${PET_TASK_COIN_REWARD} coins.`,
      kind: "pet_task_approved",
      metadata: {
        coinRewardAmount,
        petScoreDelta,
        taskId: task.id,
        taskKey: task.task_id,
        throneTotalCoinAmount: isThroneTask ? throneTotalCoinAmount : 0,
      },
      title: "Pet Task Approved",
      userId: task.user_id,
    });
  } catch (notificationError) {
    console.error("Admin pet task approval notification failed", notificationError);
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
    if (transactionIds.length > 0) {
      const { error: txCleanupError } = await supabase
        .from("coin_transactions")
        .delete()
        .in("id", transactionIds);

      if (txCleanupError) {
        console.error("Admin pet task transaction cleanup failed", txCleanupError);
      }
    }

    if (pendingActionId) {
      const { error: pendingCleanupError } = await supabase
        .from("pending_admin_actions")
        .delete()
        .eq("id", pendingActionId);

      if (pendingCleanupError) {
        console.error("Admin pet task pending action cleanup failed", pendingCleanupError);
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
    if (transactionIds.length > 0) {
      const { error: txCleanupError } = await supabase
        .from("coin_transactions")
        .delete()
        .in("id", transactionIds);

      if (txCleanupError) {
        console.error("Admin pet task transaction cleanup after duplicate failed", txCleanupError);
      }
    }

    if (pendingActionId) {
      const { error: pendingCleanupError } = await supabase
        .from("pending_admin_actions")
        .delete()
        .eq("id", pendingActionId);

      if (pendingCleanupError) {
        console.error("Admin pet task duplicate pending action cleanup failed", pendingCleanupError);
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

  try {
    if (!isThroneTask) {
      await awardDevotion(supabase, {
        amount: DEVOTION_REWARD_REVIEW_TASK,
        metadata: {
          reviewTaskId: task.id,
          taskId: task.task_id,
        },
        source: "pet_review_approval",
        sourceKey: `pet-review:${task.id}`,
        userId: profile.id,
      });
    }
  } catch (devotionError) {
    console.error("Admin pet task devotion award failed", devotionError);
  }

  if (isThroneTask) {
    const logStatus = pendingActionId ? "queued" : "executed";
    const devotionDelta = pendingActionId ? 0 : Math.floor(throneBaseCoinAmount * 0.01);
    const { data: createdLog, error: logError } = await supabase
      .from("admin_pet_task_logs")
      .insert({
        coin_total_delta: pendingActionId ? throneTotalCoinAmount : throneTotalCoinAmount,
        devotion_delta: devotionDelta,
        metadata: {
          proofImagePresent: Boolean(taskMetadata.proofImage),
        },
        pending_action_id: pendingActionId,
        reviewed_at: now,
        reviewed_by_user_id: admin.adminUser.id,
        reward_score_delta: 0,
        status: logStatus,
        task_id: task.task_id,
        task_row_id: task.id,
        throne_base_coin_amount: throneBaseCoinAmount,
        throne_give_bonus_amount: throneGiveBonusAmount,
        throne_task_bonus_amount: throneTaskBonusAmount,
        transaction_ids: transactionIds,
        updated_at: now,
        user_id: profile.id,
        username_snapshot: profile.username,
      })
      .select("id")
      .maybeSingle();

    if (logError) {
      console.error("Admin pet throne log insert failed", logError);
    } else if (pendingActionId && createdLog?.id) {
      const { data: pendingActionRow } = await supabase
        .from("pending_admin_actions")
        .select("metadata")
        .eq("id", pendingActionId)
        .maybeSingle();

      await supabase
        .from("pending_admin_actions")
        .update({
          metadata: {
            ...((pendingActionRow?.metadata as Record<string, unknown> | null) ?? {}),
            adminPetTaskLogId: createdLog.id,
          },
        })
        .eq("id", pendingActionId);
    }
  }

  return Response.json({
    message: approvalMessage,
    tasks: await listPetTasks(supabase),
  });
}
