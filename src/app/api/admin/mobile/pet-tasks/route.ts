import { requireMobileAdmin } from "@/lib/mobile-admin";
import { isDirectCoinAdminUserId } from "@/lib/admin-identity";
import { syncThroneMilestoneTitles } from "@/lib/admin-pet-task-logs";
import { awardDevotion, DEVOTION_REWARD_REVIEW_TASK } from "@/lib/devotion";
import { createPendingCoinAction } from "@/lib/pending-admin-actions";
import {
  getPetThroneRewardBreakdown,
  PET_THRONE_TASK_ID,
} from "@/lib/pet-throne";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PET_TASK_COIN_REWARD = 250;
const LARGE_THRONE_PENDING_AMOUNT = Number(process.env.ADMIN_SECURITY_LARGE_COIN_AMOUNT ?? 50000);

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
    .select("id, username, coins, pet_score")
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
  const directThronePayoutCoins = previousCoins + throneTotalCoinAmount;
  const nextPetScore = Number(profile.pet_score ?? 0) + petScoreDelta;
  const requiresThronePendingApproval =
    isThroneTask &&
    (
      !isDirectCoinAdminUserId(admin.adminUser.id) ||
      throneBaseCoinAmount >= LARGE_THRONE_PENDING_AMOUNT
    );
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
  let pendingActionId: string | null = null;
  let approvalMessage = "Pet task approved.";

  if (requiresThronePendingApproval) {
    try {
      const pendingAction = await createPendingCoinAction({
        requestedByUserId: admin.adminUser.id,
        command: "give",
        targetUserId: profile.id,
        targetUsername: profile.username ?? "@unknown",
        amount: throneBaseCoinAmount,
        originalCommand: `/give ${throneBaseCoinAmount} @${profile.username} + /add ${throneTaskBonusAmount} @${profile.username}`,
        reason: "throne_tribute",
        metadata: {
          extraAddAmount: throneTaskBonusAmount,
          giveBonusAmount: throneGiveBonusAmount,
          petTaskId: task.id,
          petTaskKind: task.task_id,
          source: "pet_throne_task",
          throneAmount,
          throneBaseCoinAmount,
          throneTaskBonusAmount,
          throneTotalCoinAmount,
        },
      });
      pendingActionId = pendingAction.id;
      approvalMessage = `Throne payout queued: ${throneBaseCoinAmount.toLocaleString()} base + ${throneGiveBonusAmount.toLocaleString()} give bonus + ${throneTaskBonusAmount.toLocaleString()} task bonus = ${throneTotalCoinAmount.toLocaleString()} coins.`;
    } catch (pendingError) {
      console.error("Mobile admin pet throne approval queue failed", pendingError);
      await admin.supabase
        .from("profiles")
        .update({ coins: previousCoins, pet_score: Number(profile.pet_score ?? 0), updated_at: now })
        .eq("id", profile.id)
        .eq("coins", nextCoins)
        .eq("pet_score", nextPetScore);
      return Response.json({ error: "Failed to queue Throne payout approval." }, { status: 500 });
    }
  } else if (isThroneTask) {
    const finalCoins = previousCoins + throneTotalCoinAmount;
    const { error: throneProfileUpdateError } = await admin.supabase
      .from("profiles")
      .update({ coins: finalCoins, updated_at: now })
      .eq("id", profile.id)
      .eq("coins", previousCoins);

    if (throneProfileUpdateError) {
      await admin.supabase
        .from("profiles")
        .update({ coins: previousCoins, pet_score: Number(profile.pet_score ?? 0), updated_at: now })
        .eq("id", profile.id)
        .eq("coins", nextCoins)
        .eq("pet_score", nextPetScore);
      return Response.json({ error: "Throne payout profile update failed." }, { status: 500 });
    }

    const txRows = [
      {
        user_id: profile.id,
        admin_user_id: admin.adminUser.id,
        amount: throneBaseCoinAmount,
        reason: "throne_tribute",
        balance_before: previousCoins,
        balance_after: previousCoins + throneBaseCoinAmount,
        metadata: {
          command: "give",
          kind: "manual_coin_purchase",
          petTaskId: task.id,
          purchaseType: "reward",
          requestedAmount: throneBaseCoinAmount,
          source: "mobile_pet_task_admin_approval",
          target_username_snapshot: profile.username,
          tributeTotalChanged: false,
          verifiedAdminUserId: admin.adminUser.id,
        },
      },
      ...(throneGiveBonusAmount > 0
        ? [{
            user_id: profile.id,
            admin_user_id: admin.adminUser.id,
            amount: throneGiveBonusAmount,
            reason: "give_bonus",
            balance_before: previousCoins + throneBaseCoinAmount,
            balance_after: previousCoins + throneBaseCoinAmount + throneGiveBonusAmount,
            metadata: {
              baseAmount: throneBaseCoinAmount,
              bonusPercent: throneBaseCoinAmount > 0 ? throneGiveBonusAmount / throneBaseCoinAmount : 0,
              command: "give",
              kind: "admin_give_bonus",
              petTaskId: task.id,
              source: "mobile_pet_task_admin_approval",
              verifiedAdminUserId: admin.adminUser.id,
            },
          }]
        : []),
      ...(throneTaskBonusAmount > 0
        ? [{
            user_id: profile.id,
            admin_user_id: admin.adminUser.id,
            amount: throneTaskBonusAmount,
            reason: "admin_add",
            balance_before: previousCoins + throneBaseCoinAmount + throneGiveBonusAmount,
            balance_after: finalCoins,
            metadata: {
              baseAmount: throneBaseCoinAmount,
              command: "add",
              kind: "pet_throne_task_bonus",
              petTaskId: task.id,
              source: "mobile_pet_task_admin_approval",
              target_username_snapshot: profile.username,
              verifiedAdminUserId: admin.adminUser.id,
            },
          }]
        : []),
    ];

    const { data: insertedTransactions, error: throneTransactionError } = await admin.supabase
      .from("coin_transactions")
      .insert(txRows)
      .select("id");

    if (throneTransactionError) {
      console.error("Mobile admin throne pet task transaction insert failed", throneTransactionError);
      await admin.supabase
        .from("profiles")
        .update({ coins: previousCoins, pet_score: Number(profile.pet_score ?? 0), updated_at: now })
        .eq("id", profile.id)
        .eq("coins", directThronePayoutCoins)
        .eq("pet_score", nextPetScore);
      return Response.json({ error: "Throne payout logging failed." }, { status: 500 });
    }

    transactionIds = (insertedTransactions ?? []).map((entry) => String(entry.id));

    try {
      if (transactionIds[0]) {
        await awardDevotion(admin.supabase, {
          amount: Math.floor(throneBaseCoinAmount * 0.01),
          metadata: {
            baseAmount: throneBaseCoinAmount,
            command: "give",
            petTaskId: task.id,
            transactionId: transactionIds[0],
          },
          source: "admin_give",
          sourceKey: `admin-give:${transactionIds[0]}`,
          userId: profile.id,
        });
      }
    } catch (devotionError) {
      console.error("Mobile admin pet throne devotion award failed", devotionError);
    }

    const { data: giftRows } = await admin.supabase
      .from("coin_transactions")
      .select("amount")
      .eq("user_id", profile.id)
      .in("reason", ["throne_tribute", "live_gift"]);
    const giftTotal = (giftRows ?? []).reduce((sum, row) => sum + Math.max(0, Number(row.amount ?? 0)), 0);
    await syncThroneMilestoneTitles(admin.supabase, profile.id, giftTotal);

    approvalMessage = `Throne payout added: ${throneBaseCoinAmount.toLocaleString()} base + ${throneGiveBonusAmount.toLocaleString()} give bonus + ${throneTaskBonusAmount.toLocaleString()} task bonus = ${throneTotalCoinAmount.toLocaleString()} coins.`;
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
      .eq("coins", isThroneTask && transactionIds.length > 0 ? directThronePayoutCoins : nextCoins)
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
