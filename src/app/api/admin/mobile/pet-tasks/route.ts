import { requireMobileAdmin } from "@/lib/mobile-admin";
import { syncThroneMilestoneTitlesFromLedgers } from "@/lib/admin-pet-task-logs";
import { awardDevotion, DEVOTION_REWARD_REVIEW_TASK } from "@/lib/devotion";
import {
  getPetThroneRewardBreakdown,
  PET_THRONE_TASK_ID,
} from "@/lib/pet-throne";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PET_TASK_COIN_REWARD } from "@/lib/server-game-rules";
import { createUserNotification } from "@/lib/user-notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    .select("id, user_id, task_id, reward_score, status, metadata")
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
    .select("id, username, coins, pet_score, principessa_money, pet_unlocked_at")
    .eq("id", task.user_id)
    .maybeSingle();
  if (profileError || !profile) {
    return Response.json({ error: profileError?.message ?? "Profile not found." }, { status: profileError ? 500 : 404 });
  }

  const previousCoins = Number(profile.coins ?? 0);
  const taskMetadata = (task.metadata ?? {}) as Record<string, unknown>;
  const isThroneTask = task.task_id === PET_THRONE_TASK_ID;
  const petScoreDelta = isThroneTask ? 0 : Number(task.reward_score ?? 0);
  const throneAmount = typeof taskMetadata.throneAmount === "number" ? taskMetadata.throneAmount : 0;
  // Mirrors the webhook RPC and the desktop admin route: the Throne bonus is
  // Pet-track only, and approving from the phone is not a bypass.
  const earnsThroneBonus = isThroneTask && Boolean(profile.pet_unlocked_at);
  const throneBreakdown = getPetThroneRewardBreakdown(throneAmount, earnsThroneBonus);
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
  const previousMoney = Math.max(0, Math.floor(Number(profile.principessa_money) || 0));
  const throneMoneyAmount = throneBreakdown.moneyAmount;
  const profilePatch: {
    coins: number;
    pet_score: number;
    updated_at: string;
    last_pet_tax_at?: string;
  } = { coins: nextCoins, pet_score: nextPetScore, updated_at: now };

  if (task.task_id === "pet-weekly-throne-tax") {
    profilePatch.last_pet_tax_at = now;
  }

  if (isThroneTask && throneBaseCoinAmount <= 0) {
    return Response.json({ error: "Invalid Throne reward payload." }, { status: 422 });
  }

  const { error: profileUpdateError } = await admin.supabase
    .from("profiles")
    .update(profilePatch)
    .eq("id", profile.id);
  if (profileUpdateError) return Response.json({ error: profileUpdateError.message }, { status: 500 });

  let transactionIds: string[] = [];
  const pendingActionId: string | null = null;
  let approvalMessage = "Pet task approved.";

  // Mirrors src/app/api/admin/pet-tasks/route.ts: Throne pays Principessa Money
  // at 1 USD = 1 PM, credited immediately, no Companion App second step.
  if (isThroneTask) {
    const nextMoney = previousMoney + throneMoneyAmount;
    const { error: throneMoneyError } = await admin.supabase
      .from("profiles")
      .update({ principessa_money: nextMoney, updated_at: now })
      .eq("id", profile.id)
      .eq("principessa_money", previousMoney);

    if (throneMoneyError) {
      await admin.supabase
        .from("profiles")
        .update({ coins: previousCoins, pet_score: Number(profile.pet_score ?? 0), updated_at: now })
        .eq("id", profile.id)
        .eq("coins", nextCoins)
        .eq("pet_score", nextPetScore);
      return Response.json({ error: "Throne payout profile update failed." }, { status: 500 });
    }

    const { error: moneyLedgerError } = await admin.supabase.from("money_transactions").insert({
      amount: throneMoneyAmount,
      balance_after: nextMoney,
      balance_before: previousMoney,
      metadata: {
        adminUserId: admin.adminUser.id,
        coinEquivalent: throneBaseCoinAmount,
        petTaskId: task.id,
        source: "pet_task_admin_approval_mobile",
        throneAmount,
      },
      reason: "throne_tribute",
      source_key: `pet-throne:${task.id}`,
      user_id: profile.id,
    });

    if (moneyLedgerError) {
      const isDuplicate = moneyLedgerError.code === "23505";
      await admin.supabase
        .from("profiles")
        .update({ coins: previousCoins, principessa_money: previousMoney, pet_score: Number(profile.pet_score ?? 0), updated_at: now })
        .eq("id", profile.id)
        .eq("principessa_money", nextMoney);
      return Response.json(
        { error: isDuplicate ? "This Throne submission was already paid out." : "Throne payout logging failed." },
        { status: isDuplicate ? 409 : 500 },
      );
    }

    try {
      await awardDevotion(admin.supabase, {
        amount: Math.floor(throneBaseCoinAmount * 0.01),
        metadata: { coinEquivalent: throneBaseCoinAmount, petTaskId: task.id, throneAmount },
        source: "admin_give",
        sourceKey: `pet-throne-devotion:${task.id}`,
        userId: profile.id,
      });
    } catch (devotionError) {
      console.error("Mobile pet throne devotion award failed", devotionError);
    }

    // Shared with the webhook and the desktop admin route - one implementation,
    // so approving from the phone cannot produce a different lifetime total.
    await syncThroneMilestoneTitlesFromLedgers(admin.supabase, profile.id);

    try {
      await createUserNotification(admin.supabase, {
        body: `${throneMoneyAmount.toLocaleString()} Principessa Money landed in your balance. Convert it to coins whenever you want.`,
        kind: "throne_money_credited",
        metadata: { moneyAmount: throneMoneyAmount, petTaskId: task.id, throneAmount },
        title: "Throne tribute credited",
        userId: profile.id,
      });
    } catch (notificationError) {
      console.error("Mobile pet throne notification failed", notificationError);
    }

    approvalMessage = `Throne payout added: ${throneMoneyAmount.toLocaleString()} Principessa Money.`;
  } else {
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

    if (transaction?.id) {
      transactionIds = [transaction.id];
    }
    approvalMessage = `Pet task approved. +${petScoreDelta} Pet Score, +${PET_TASK_COIN_REWARD} coins.`;
  }

  const { data: approvedTask, error: taskUpdateError } = await admin.supabase
    .from("user_pet_tasks")
    .update({ status: "approved", reviewed_at: now })
    .eq("id", task.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (taskUpdateError || !approvedTask) {
    if (transactionIds.length > 0) {
      await admin.supabase.from("coin_transactions").delete().in("id", transactionIds);
    }
    if (pendingActionId) {
      await admin.supabase.from("pending_admin_actions").delete().eq("id", pendingActionId);
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

  try {
    if (!isThroneTask) {
      await awardDevotion(admin.supabase, {
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
    console.error("Mobile admin pet task devotion award failed", devotionError);
  }

  if (isThroneTask) {
    const logStatus = pendingActionId ? "queued" : "executed";
    const { data: createdLog, error: logError } = await admin.supabase
      .from("admin_pet_task_logs")
      .insert({
        coin_total_delta: throneTotalCoinAmount,
        devotion_delta: pendingActionId ? 0 : Math.floor(throneBaseCoinAmount * 0.01),
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
      console.error("Mobile admin pet throne log insert failed", logError);
    } else if (pendingActionId && createdLog?.id) {
      const { data: pendingActionRow } = await admin.supabase
        .from("pending_admin_actions")
        .select("metadata")
        .eq("id", pendingActionId)
        .maybeSingle();

      await admin.supabase
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

  return Response.json({ message: approvalMessage, tasks: await listPetTasks(admin.supabase) });
}
