import { getDebtPeriodMs, getFirstDebtDueAtIso, listAdminDebtContracts } from "@/lib/admin-debt-contracts";
import { requireAdminProfile } from "@/lib/admin-guard";
import { createUserNotification } from "@/lib/user-notifications";

const DEBT_TIMEOUT_REASON = "debt_contract_overdue";
const DEBT_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;

type AdminDebtAction =
  | "applyTimeout"
  | "approveEvil"
  | "clearTimeout"
  | "closeNoRefund"
  | "expireOverdue"
  | "list"
  | "remove";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: AdminDebtAction;
    contractId?: string;
    reason?: string;
  } | null;
  const action = body?.action ?? "list";
  const now = new Date();
  const nowIso = now.toISOString();

  if (action === "closeNoRefund" || action === "remove") {
    const contractId = String(body?.contractId ?? "").trim();
    const reason = String(body?.reason ?? "").trim() || "Closed by admin without refund or penalty.";

    if (!contractId) {
      return jsonError("Missing debt contract id.");
    }

    const { data: contract, error: contractError } = await admin.supabase
      .from("pet_debt_contracts")
      .select("id, user_id, status")
      .eq("id", contractId)
      .maybeSingle();

    if (contractError || !contract) {
      return jsonError(contractError?.message ?? "Debt contract not found.", contractError ? 500 : 404);
    }

    const { error: updateError } = await admin.supabase
      .from("pet_debt_contracts")
      .update({
        admin_review_required: false,
        closed_at: nowIso,
        closed_by_admin_id: admin.adminUser.id,
        close_reason: reason,
        current_installment_remaining: 0,
        overdue_since: null,
        status: "forgiven",
        updated_at: nowIso,
      })
      .eq("id", contract.id);

    if (updateError) {
      return jsonError(updateError.message, 500);
    }

    await admin.supabase
      .from("evil_debt_contract_images")
      .delete()
      .eq("contract_id", contract.id);

    await admin.supabase
      .from("profiles")
      .update({
        timeout_reason: null,
        timeout_until: null,
        updated_at: nowIso,
      })
      .eq("id", contract.user_id)
      .eq("timeout_reason", DEBT_TIMEOUT_REASON);

    await admin.supabase.from("debt_admin_actions").insert({
      action: "close_no_refund",
      admin_user_id: admin.adminUser.id,
      contract_id: contract.id,
      debt_kind: "pet",
      metadata: {
        previousStatus: contract.status,
        refundApplied: false,
      },
      reason,
      user_id: contract.user_id,
    });

    try {
      await createUserNotification(admin.supabase, {
        body: "Your Debt Contract was closed by admin without a refund or penalty.",
        kind: "debt_closed_by_admin",
        metadata: { contractId: contract.id, reason },
        title: "Debt Contract Closed",
        userId: contract.user_id,
      });
    } catch (notificationError) {
      console.error("Debt closure notification failed", notificationError);
    }
  }

  if (action === "applyTimeout") {
    const contractId = String(body?.contractId ?? "").trim();
    const reason = String(body?.reason ?? "").trim() || "Purchase pledge was not fulfilled after the grace period.";

    if (!contractId) {
      return jsonError("Missing debt contract id.");
    }

    const { data: contract, error: contractError } = await admin.supabase
      .from("pet_debt_contracts")
      .select("id, user_id, status, purchase_pledge, admin_review_required, next_due_at, current_installment_remaining")
      .eq("id", contractId)
      .eq("status", "active")
      .maybeSingle();

    if (contractError || !contract) {
      return jsonError(contractError?.message ?? "Active debt contract not found.", contractError ? 500 : 404);
    }

    const dueAtMs = new Date(String(contract.next_due_at ?? "")).getTime();
    const graceExpired =
      Number.isFinite(dueAtMs) &&
      dueAtMs + 48 * 60 * 60 * 1000 <= now.getTime() &&
      Number(contract.current_installment_remaining ?? 0) > 0;

    if (!contract.purchase_pledge || (!contract.admin_review_required && !graceExpired)) {
      return jsonError("A 7-day timeout requires both a purchase pledge and an overdue admin-review state.", 409);
    }

    const { data: profile, error: profileError } = await admin.supabase
      .from("profiles")
      .select("timeout_reason, timeout_until")
      .eq("id", contract.user_id)
      .single();

    if (profileError || !profile) {
      return jsonError(profileError?.message ?? "Debt user profile not found.", 500);
    }

    const existingTimeoutActive = new Date(String(profile.timeout_until ?? 0)).getTime() > now.getTime();

    if (existingTimeoutActive && profile.timeout_reason && profile.timeout_reason !== DEBT_TIMEOUT_REASON) {
      return jsonError("The user already has a non-debt timeout. Resolve it before applying a debt timeout.", 409);
    }

    const timeoutUntil = new Date(now.getTime() + DEBT_TIMEOUT_MS).toISOString();
    const { error: timeoutError } = await admin.supabase
      .from("profiles")
      .update({
        timeout_reason: DEBT_TIMEOUT_REASON,
        timeout_until: timeoutUntil,
        updated_at: nowIso,
      })
      .eq("id", contract.user_id);

    if (timeoutError) {
      return jsonError(timeoutError.message, 500);
    }

    await admin.supabase
      .from("pet_debt_contracts")
      .update({
        admin_review_required: true,
        overdue_since: contract.next_due_at,
        updated_at: nowIso,
      })
      .eq("id", contract.id);

    await admin.supabase.from("debt_admin_actions").insert({
      action: "apply_7_day_timeout",
      admin_user_id: admin.adminUser.id,
      contract_id: contract.id,
      debt_kind: "pet",
      metadata: { timeoutUntil },
      reason,
      user_id: contract.user_id,
    });

    try {
      await createUserNotification(admin.supabase, {
        body: `Admin applied a 7-day Debt Timeout after reviewing your missed payment and purchase pledge.`,
        kind: "debt_timeout_applied",
        metadata: { contractId: contract.id, timeoutUntil },
        title: "Debt Timeout Applied",
        userId: contract.user_id,
      });
    } catch (notificationError) {
      console.error("Debt timeout notification failed", notificationError);
    }
  }

  if (action === "clearTimeout") {
    const contractId = String(body?.contractId ?? "").trim();
    const reason = String(body?.reason ?? "").trim() || "Debt timeout cleared by admin.";

    if (!contractId) {
      return jsonError("Missing debt contract id.");
    }

    const { data: contract, error: contractError } = await admin.supabase
      .from("pet_debt_contracts")
      .select("id, user_id")
      .eq("id", contractId)
      .maybeSingle();

    if (contractError || !contract) {
      return jsonError(contractError?.message ?? "Debt contract not found.", contractError ? 500 : 404);
    }

    const { error: clearError } = await admin.supabase
      .from("profiles")
      .update({
        timeout_reason: null,
        timeout_until: null,
        updated_at: nowIso,
      })
      .eq("id", contract.user_id)
      .eq("timeout_reason", DEBT_TIMEOUT_REASON);

    if (clearError) {
      return jsonError(clearError.message, 500);
    }

    await admin.supabase.from("debt_admin_actions").insert({
      action: "clear_debt_timeout",
      admin_user_id: admin.adminUser.id,
      contract_id: contract.id,
      debt_kind: "pet",
      reason,
      user_id: contract.user_id,
    });
  }

  if (action === "approveEvil") {
    const contractId = String(body?.contractId ?? "").trim();

    if (!contractId) {
      return jsonError("Missing debt contract id.");
    }

    const { data: contract, error: readError } = await admin.supabase
      .from("pet_debt_contracts")
      .select("id, contract_type, duration_periods, period_type, status, user_id")
      .eq("id", contractId)
      .eq("contract_type", "evil")
      .eq("status", "pending")
      .maybeSingle();

    if (readError || !contract) {
      return jsonError(readError?.message ?? "Pending Evil Debt Contract not found.", readError ? 500 : 404);
    }

    const periodMs = getDebtPeriodMs(contract.period_type as "weekly" | "monthly");
    const { error } = await admin.supabase
      .from("pet_debt_contracts")
      .update({
        ends_at: new Date(now.getTime() + periodMs * Number(contract.duration_periods ?? 0)).toISOString(),
        next_due_at: getFirstDebtDueAtIso(contract.period_type as "weekly" | "monthly", now),
        started_at: nowIso,
        status: "active",
        updated_at: nowIso,
      })
      .eq("id", contract.id)
      .eq("status", "pending");

    if (error) {
      return jsonError(error.message, 500);
    }

    try {
      await createUserNotification(admin.supabase, {
        body: "Your Evil Debt Contract was approved and is now active.",
        kind: "debt_evil_approved",
        metadata: { contractId: contract.id },
        title: "Evil Debt Approved",
        userId: contract.user_id,
      });
    } catch (notificationError) {
      console.error("Admin evil debt approval notification failed", notificationError);
    }
  }

  if (action === "expireOverdue") {
    const { error } = await admin.supabase
      .from("pet_debt_contracts")
      .update({ status: "expired", updated_at: nowIso })
      .lt("ends_at", nowIso)
      .eq("status", "active");

    if (error) {
      return jsonError(error.message, 500);
    }
  }

  return Response.json({
    contracts: await listAdminDebtContracts(admin.supabase, { projectOverdueMissedPeriods: true }),
  });
}
