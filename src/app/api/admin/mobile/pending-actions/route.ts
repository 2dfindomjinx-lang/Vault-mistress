import { requireMobileAdmin } from "@/lib/mobile-admin";
import { syncThroneMilestoneTitles } from "@/lib/admin-pet-task-logs";
import { awardDevotion } from "@/lib/devotion";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendAdminMobilePush } from "@/lib/admin-mobile-push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PENDING_EXPIRY_MINUTES = 5;

type PendingActionRow = {
  id: string;
  action_type: string;
  command: string | null;
  requested_by_user_id: string;
  target_user_id: string;
  target_username_snapshot: string | null;
  amount: number;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  status: string;
  created_at: string;
  expires_at: string;
  approved_by_user_id: string | null;
  approved_at: string | null;
};

function getGiveBonusPercent(giveAmount: number) {
  if (giveAmount >= 100000) return 0.25;
  if (giveAmount >= 50000) return 0.2;
  if (giveAmount >= 20000) return 0.15;
  if (giveAmount >= 10000) return 0.1;
  return 0;
}

function getGiveDevotionAmount(baseAmount: number) {
  return Math.floor(baseAmount * 0.01);
}

export async function GET(request: Request) {
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const supabase = admin.supabase;

  // Optionally mark expired ones
  const nowIso = new Date().toISOString();
  await supabase
    .from("pending_admin_actions")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", nowIso);

  const { data, error } = await supabase
    .from("pending_admin_actions")
    .select("id, action_type, command, requested_by_user_id, target_user_id, target_username_snapshot, amount, reason, metadata, status, created_at, expires_at, approved_by_user_id, approved_at")
    .in("status", ["pending", "approved", "rejected", "expired"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("List pending admin actions failed", error);
    return Response.json({ error: "Failed to load pending actions" }, { status: 500 });
  }

  return Response.json({ actions: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    decision?: "approve" | "reject";
  };

  const actionId = body.id?.trim();
  const decision = body.decision;

  if (!actionId || (decision !== "approve" && decision !== "reject")) {
    return Response.json({ error: "id and decision (approve|reject) required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient(); // fresh privileged
  const approverId = admin.adminUser.id;

  // Load fresh
  const { data: pending, error: loadErr } = await supabase
    .from("pending_admin_actions")
    .select("*")
    .eq("id", actionId)
    .maybeSingle<PendingActionRow>();

  if (loadErr || !pending) {
    return Response.json({ error: "Action not found" }, { status: 404 });
  }

  if (pending.status !== "pending") {
    return Response.json({ error: `Action already ${pending.status}` }, { status: 409 });
  }

  const expiresAt = new Date(pending.expires_at);
  if (expiresAt < new Date()) {
    await supabase
      .from("pending_admin_actions")
      .update({ status: "expired" })
      .eq("id", actionId);
    return Response.json({ error: "Action expired" }, { status: 410 });
  }

  const nowIso = new Date().toISOString();

  if (decision === "reject") {
    const { error: rejErr } = await supabase
      .from("pending_admin_actions")
      .update({ status: "rejected", approved_by_user_id: approverId, approved_at: nowIso })
      .eq("id", actionId)
      .eq("status", "pending");

    if (rejErr) {
      console.error("Reject pending failed", rejErr);
      return Response.json({ error: "Failed to reject" }, { status: 500 });
    }

    return Response.json({ ok: true, status: "rejected", id: actionId });
  }

  // Approve: atomic claim
  const { data: claimed, error: claimErr } = await supabase
    .from("pending_admin_actions")
    .update({
      status: "approved",
      approved_by_user_id: approverId,
      approved_at: nowIso,
    })
    .eq("id", actionId)
    .eq("status", "pending")
    .select()
    .single<PendingActionRow>();

  if (claimErr || !claimed) {
    return Response.json({ error: "Action already processed or expired" }, { status: 409 });
  }

  // Now execute the approved action (only add/give supported)
  const cmd = (claimed.command || "").toLowerCase();
  const amount = Number(claimed.amount);
  const targetId = claimed.target_user_id;
  const claimedMetadata = (claimed.metadata ?? {}) as Record<string, unknown>;
  const claimedSource = typeof claimedMetadata.source === "string" ? claimedMetadata.source : "";
  const isPetTaskReward = Boolean(
    claimedMetadata.petTaskId
    || claimedMetadata.adminPetTaskLogId
    || claimedSource === "pet_throne_task",
  );
  const extraAddAmount = Math.max(
    0,
    Number(claimedMetadata.extraAddAmount ?? 0),
  );
  const targetSnap = claimed.target_username_snapshot || "unknown";

  if (!["add", "give"].includes(cmd) || !amount || amount <= 0) {
    // non-coin or bad, just mark done
    return Response.json({ ok: true, executed: false, note: "non-coin or invalid payload" });
  }

  try {
    // Fresh lookup for current balance (at execution time)
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("id, username, coins")
      .eq("id", targetId)
      .maybeSingle();

    if (profErr || !profile) {
      throw new Error("Target profile not found at execution time");
    }

    const previousCoins = Number(profile.coins ?? 0);
    const isGive = cmd === "give";
    const coinDelta = amount; // always positive grant for add/give
    const nextCoins = previousCoins + coinDelta;
    const giveBonusPercent = isGive ? getGiveBonusPercent(amount) : 0;
    const giveBonusAmount = Math.floor(amount * giveBonusPercent);

    // Main update
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ coins: nextCoins, updated_at: nowIso })
      .eq("id", targetId);

    if (updateErr) throw updateErr;

    const txReason = isGive ? "throne_tribute" : "admin_add";
    const { data: transaction, error: txErr } = await supabase
      .from("coin_transactions")
      .insert({
        user_id: targetId,
        admin_user_id: approverId, // the approver, or original requester? use approver as the verified
        amount: coinDelta,
        reason: txReason,
        balance_before: previousCoins,
        balance_after: nextCoins,
        metadata: {
          command: cmd,
          kind: isGive ? "manual_coin_purchase" : "admin_adjustment",
          purchaseType: isGive ? (isPetTaskReward ? "reward" : "real_money") : "admin_adjustment",
          source: "approved_admin_action",
          pendingActionId: claimed.id,
          verifiedAdminUserId: approverId,
          requestedAmount: amount,
          tributeTotalChanged: false,
          target_username_snapshot: profile.username,
          approved: true,
        },
      })
      .select("id")
      .single();

    if (txErr) {
      // rollback coins
      await supabase.from("profiles").update({ coins: previousCoins }).eq("id", targetId);
      throw txErr;
    }

    let finalCoins = nextCoins;
    let bonusTransaction: any = null;
    const giveDevotionAmount = isGive ? getGiveDevotionAmount(amount) : 0;

    if (isGive && giveBonusAmount > 0) {
      const bonusAfter = nextCoins + giveBonusAmount;
      const { error: bErr } = await supabase
        .from("profiles")
        .update({ coins: bonusAfter, updated_at: nowIso })
        .eq("id", targetId);
      if (bErr) {
        // cleanup main tx
        if (transaction?.id) await supabase.from("coin_transactions").delete().eq("id", transaction.id);
        await supabase.from("profiles").update({ coins: previousCoins }).eq("id", targetId);
        throw new Error("bonus update failed");
      }
      finalCoins = bonusAfter;

      const { data: bTx } = await supabase
        .from("coin_transactions")
        .insert({
          user_id: targetId,
          admin_user_id: approverId,
          amount: giveBonusAmount,
          reason: "give_bonus",
          balance_before: nextCoins,
          balance_after: bonusAfter,
          metadata: {
            command: "give",
            kind: "admin_give_bonus",
            source: "approved_admin_action",
            pendingActionId: claimed.id,
            baseAmount: amount,
            bonusPercent: giveBonusPercent,
          },
        })
        .select("id")
        .single();
      bonusTransaction = bTx;
    }

    let extraAddTransaction: { id?: string | null } | null = null;

    if (extraAddAmount > 0) {
      const addBefore = finalCoins;
      const addAfter = finalCoins + extraAddAmount;
      const { error: addUpdateError } = await supabase
        .from("profiles")
        .update({ coins: addAfter, updated_at: nowIso })
        .eq("id", targetId);

      if (addUpdateError) {
        throw new Error("task bonus update failed");
      }

      const { data: addTx, error: addTransactionError } = await supabase
        .from("coin_transactions")
        .insert({
          user_id: targetId,
          admin_user_id: approverId,
          amount: extraAddAmount,
          reason: "admin_add",
          balance_before: addBefore,
          balance_after: addAfter,
          metadata: {
            command: "add",
            kind: "pet_throne_task_bonus",
            source: "approved_admin_action",
            pendingActionId: claimed.id,
            petTaskId: (claimed.metadata as Record<string, unknown> | null)?.petTaskId ?? null,
            target_username_snapshot: profile.username,
            verifiedAdminUserId: approverId,
          },
        })
        .select("id")
        .single();

      if (addTransactionError) {
        await supabase
          .from("profiles")
          .update({ coins: addBefore, updated_at: nowIso })
          .eq("id", targetId)
          .eq("coins", addAfter);
        throw new Error("task bonus logging failed");
      }

      extraAddTransaction = addTx;
      finalCoins = addAfter;
    }

    if (isGive && transaction?.id && giveDevotionAmount > 0) {
      try {
        await awardDevotion(supabase, {
          amount: giveDevotionAmount,
          metadata: {
            baseAmount: amount,
            command: "give",
            pendingActionId: claimed.id,
            transactionId: transaction.id,
          },
          source: "admin_give",
          sourceKey: `admin-give:${transaction.id}`,
          userId: targetId,
        });
      } catch (devotionError) {
        console.error("Approved admin give devotion award failed", devotionError);
      }
    }

    // Throne milestones for give (same as direct path)
    if (isGive) {
      const { data: giftRows } = await supabase
        .from("coin_transactions")
        .select("amount")
        .eq("user_id", targetId)
        .in("reason", ["throne_tribute", "live_gift"]);
      const giftTotal = (giftRows ?? []).reduce((s, r) => s + Math.max(0, Number(r.amount ?? 0)), 0);
      await syncThroneMilestoneTitles(supabase, targetId, giftTotal);
    }

    // Log execution in the pending row metadata
    await supabase
      .from("pending_admin_actions")
      .update({
        metadata: {
          ...(claimed.metadata || {}),
          executedAt: nowIso,
          finalCoins,
          bonusTransactionId: bonusTransaction?.id ?? null,
          extraAddAmount,
          extraAddTransactionId: extraAddTransaction?.id ?? null,
          transactionId: transaction?.id || null,
        },
      })
      .eq("id", actionId);

    const adminPetTaskLogId = String(
      ((claimed.metadata as Record<string, unknown> | null)?.adminPetTaskLogId ?? ""),
    ).trim();

    if (adminPetTaskLogId) {
      const { data: currentLog } = await supabase
        .from("admin_pet_task_logs")
        .select("devotion_delta, metadata")
        .eq("id", adminPetTaskLogId)
        .maybeSingle();

      await supabase
        .from("admin_pet_task_logs")
        .update({
          coin_total_delta: amount + giveBonusAmount + extraAddAmount,
          devotion_delta: giveDevotionAmount,
          metadata: {
            ...((currentLog?.metadata as Record<string, unknown> | null) ?? {}),
            executedByAdminUserId: approverId,
            executedFromPendingActionId: claimed.id,
          },
          reviewed_at: nowIso,
          reviewed_by_user_id: approverId,
          status: "executed",
          transaction_ids: [
            transaction?.id ?? null,
            bonusTransaction?.id ?? null,
            extraAddTransaction?.id ?? null,
          ].filter(Boolean),
          updated_at: nowIso,
        })
        .eq("id", adminPetTaskLogId);
    }

    return Response.json({
      ok: true,
      status: "approved",
      id: actionId,
      executed: true,
      message: isGive
        ? `Approved: granted ${amount}${giveBonusAmount ? ` + ${giveBonusAmount} give bonus` : ""}${extraAddAmount ? ` + ${extraAddAmount} task bonus` : ""} to ${profile.username}`
        : `Approved: added ${amount} to ${profile.username}`,
      coins: finalCoins,
    });
  } catch (execErr: any) {
    console.error("Execution of approved pending action failed", execErr);
    // Mark as failed? Keep approved but note error. For safety leave as approved but don't retry.
    await supabase
      .from("pending_admin_actions")
      .update({
        metadata: {
          ...(claimed.metadata || {}),
          executionError: String(execErr?.message || execErr),
        },
      })
      .eq("id", actionId);
    return Response.json({ error: "Approval recorded but execution failed. Check logs.", id: actionId }, { status: 500 });
  }
}
