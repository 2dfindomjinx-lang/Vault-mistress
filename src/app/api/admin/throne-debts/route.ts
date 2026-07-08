import { requireAdminProfile } from "@/lib/admin-guard";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  calculateThroneDebtRedemptionAmount,
  getThroneDebtDueDateIso,
  getThroneDebtTimeoutReason,
  type ThroneDebtContract,
  type ThroneDebtStatus,
} from "@/lib/throne-debt";
import { createUserNotification } from "@/lib/user-notifications";

const CONTRACT_SELECT = `
  *,
  installments:throne_debt_installments(*),
  payment_reviews:throne_debt_payment_reviews(*)
`;

type AdminThroneDebt = ThroneDebtContract & {
  username?: string;
};

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function sortContract(contract: AdminThroneDebt) {
  return {
    ...contract,
    installments: [...(contract.installments ?? [])].sort((a, b) => a.installment_number - b.installment_number),
    payment_reviews: [...(contract.payment_reviews ?? [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ),
  };
}

async function listThroneDebts(supabase: SupabaseAdminClient) {
  const { data, error } = await supabase
    .from("throne_debts")
    .select(CONTRACT_SELECT)
    .order("created_at", { ascending: false })
    .limit(150);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as AdminThroneDebt[];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const profilesResult = userIds.length > 0
    ? await supabase.from("profiles").select("id, username").in("id", userIds)
    : { data: [], error: null };

  if (profilesResult.error) {
    console.error("Throne debt profile hydration failed", profilesResult.error);
  }

  const usernameMap = new Map(
    ((profilesResult.data ?? []) as Array<{ id: string; username: string }>).map((profile) => [profile.id, profile.username]),
  );

  return rows.map((contract) => sortContract({
    ...contract,
    username: usernameMap.get(contract.user_id) ?? "@unknown",
  }));
}

async function notifyUser(
  supabase: SupabaseAdminClient,
  payload: {
    body: string;
    contractId: string;
    kind:
      | "throne_debt_approved"
      | "throne_debt_changes_requested"
      | "throne_debt_payment_approved"
      | "throne_debt_payment_rejected"
      | "throne_debt_rejected"
      | "throne_debt_timeout_applied";
    title: string;
    userId: string;
  },
) {
  try {
    await createUserNotification(supabase, {
      body: payload.body,
      kind: payload.kind,
      metadata: { contractId: payload.contractId },
      title: payload.title,
      userId: payload.userId,
    });
  } catch (error) {
    console.error("Throne Debt notification failed", error);
  }
}

export async function POST(request: Request) {
  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return jsonError(admin.error ?? "Admin access required.", admin.status ?? 403);
  }

  const body = (await request.json().catch(() => null)) as {
    action?:
      | "approve_contract"
      | "approve_installment_payment"
      | "apply_throne_debt_timeout"
      | "cancel_contract"
      | "lift_timeout"
      | "list"
      | "mark_completed"
      | "mark_defaulted"
      | "pause_contract"
      | "reject_contract"
      | "reject_installment_payment"
      | "request_contract_changes"
      | "resume_contract";
    adminNote?: string;
    contractId?: string;
    installmentId?: string;
    rejectionReason?: string;
    reviewId?: string;
  } | null;

  if (!body?.action || body.action === "list") {
    return Response.json({ contracts: await listThroneDebts(admin.supabase) });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const longTimeoutUntil = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString();

  if (body.action === "approve_contract") {
    const contractId = String(body.contractId ?? "").trim();

    if (!contractId) {
      return jsonError("Missing contract id.");
    }

    const { data: contract, error } = await admin.supabase
      .from("throne_debts")
      .select("*")
      .eq("id", contractId)
      .eq("status", "pending_review")
      .maybeSingle();

    if (error || !contract) {
      return jsonError(error?.message ?? "Pending Throne Debt contract not found.", error ? 500 : 404);
    }

    const installments = Array.from({ length: Number(contract.installment_count ?? 0) }, (_, index) => ({
      amount_usd: Number(contract.installment_amount_usd ?? 0),
      debt_id: contract.id,
      due_date: getThroneDebtDueDateIso(now, contract.repayment_frequency, index + 1),
      installment_number: index + 1,
      status: "pending",
    }));

    const { error: updateError } = await admin.supabase
      .from("throne_debts")
      .update({
        admin_note: String(body.adminNote ?? "").trim() || null,
        approved_at: nowIso,
        approved_by_admin_id: admin.adminUser.id,
        status: "active",
        updated_at: nowIso,
      })
      .eq("id", contract.id)
      .eq("status", "pending_review");

    if (updateError) {
      return jsonError(updateError.message, 500);
    }

    const { error: installmentError } = await admin.supabase
      .from("throne_debt_installments")
      .insert(installments);

    if (installmentError) {
      await admin.supabase
        .from("throne_debts")
        .update({
          admin_note: contract.admin_note,
          approved_at: null,
          approved_by_admin_id: null,
          status: "pending_review",
          updated_at: nowIso,
        })
        .eq("id", contract.id);
      return jsonError(installmentError.message, 500);
    }

    await notifyUser(admin.supabase, {
      body: "Your Throne Debt request was approved. Installments are now scheduled for manual review.",
      contractId: contract.id,
      kind: "throne_debt_approved",
      title: "Throne Debt Approved",
      userId: contract.user_id,
    });
  }

  if (body.action === "reject_contract" || body.action === "request_contract_changes") {
    const contractId = String(body.contractId ?? "").trim();
    const adminNote = String(body.adminNote ?? body.rejectionReason ?? "").trim();

    if (!contractId) {
      return jsonError("Missing contract id.");
    }

    const nextStatus: ThroneDebtStatus = "rejected";
    const { data: contract, error } = await admin.supabase
      .from("throne_debts")
      .update({
        admin_note: adminNote || null,
        rejected_at: nowIso,
        rejected_by_admin_id: admin.adminUser.id,
        status: nextStatus,
        updated_at: nowIso,
      })
      .eq("id", contractId)
      .eq("status", "pending_review")
      .select("id, user_id")
      .maybeSingle();

    if (error || !contract) {
      return jsonError(error?.message ?? "Pending Throne Debt contract not found.", error ? 500 : 404);
    }

    await notifyUser(admin.supabase, {
      body: body.action === "request_contract_changes"
        ? "Your Throne Debt request needs changes. Check the admin note."
        : "Your Throne Debt request was rejected.",
      contractId: contract.id,
      kind: body.action === "request_contract_changes" ? "throne_debt_changes_requested" : "throne_debt_rejected",
      title: body.action === "request_contract_changes" ? "Throne Debt Changes Requested" : "Throne Debt Rejected",
      userId: contract.user_id,
    });
  }

  if (body.action === "apply_throne_debt_timeout") {
    const contractId = String(body.contractId ?? "").trim();

    if (!contractId) {
      return jsonError("Missing contract id.");
    }

    const { data: contract, error: contractError } = await admin.supabase
      .from("throne_debts")
      .select("id, user_id, status")
      .eq("id", contractId)
      .in("status", ["active", "overdue"])
      .maybeSingle();

    if (contractError || !contract) {
      return jsonError(contractError?.message ?? "Active or overdue Throne Debt contract not found.", contractError ? 500 : 404);
    }

    const { data: overdueInstallments, error: installmentsError } = await admin.supabase
      .from("throne_debt_installments")
      .select("id, amount_usd, due_date, status")
      .eq("debt_id", contract.id)
      .neq("status", "approved_paid")
      .lte("due_date", nowIso);

    if (installmentsError) {
      return jsonError(installmentsError.message, 500);
    }

    const targetInstallments = overdueInstallments ?? [];
    const overdueAmountUsd = Math.round(
      targetInstallments.reduce((sum, installment) => sum + Number(installment.amount_usd ?? 0), 0) * 100,
    ) / 100;

    if (targetInstallments.length === 0 || overdueAmountUsd <= 0) {
      return jsonError("No overdue unpaid Throne installments found for timeout.", 409);
    }

    const timeoutReason = getThroneDebtTimeoutReason(contract.id);
    const redemptionAmountUsd = calculateThroneDebtRedemptionAmount(overdueAmountUsd);

    const { error: profileError } = await admin.supabase
      .from("profiles")
      .update({
        timeout_reason: timeoutReason,
        timeout_until: longTimeoutUntil,
        updated_at: nowIso,
      })
      .eq("id", contract.user_id);

    if (profileError) {
      return jsonError(profileError.message, 500);
    }

    const { error: installmentUpdateError } = await admin.supabase
      .from("throne_debt_installments")
      .update({
        status: "timeout_redemption_required",
        updated_at: nowIso,
      })
      .in("id", targetInstallments.map((installment) => installment.id));

    if (installmentUpdateError) {
      return jsonError(installmentUpdateError.message, 500);
    }

    const { error: contractUpdateError } = await admin.supabase
      .from("throne_debts")
      .update({
        admin_note: String(body.adminNote ?? "").trim() || null,
        status: "timeout",
        timeout_applied_at: nowIso,
        timeout_applied_by_admin_id: admin.adminUser.id,
        timeout_overdue_amount_usd: overdueAmountUsd,
        timeout_reason: timeoutReason,
        timeout_redemption_amount_usd: redemptionAmountUsd,
        timeout_redemption_multiplier: 1.3,
        updated_at: nowIso,
      })
      .eq("id", contract.id);

    if (contractUpdateError) {
      return jsonError(contractUpdateError.message, 500);
    }

    await notifyUser(admin.supabase, {
      body: `Your account is in Throne Debt Timeout. Redemption amount: $${redemptionAmountUsd.toFixed(2)}.`,
      contractId: contract.id,
      kind: "throne_debt_timeout_applied",
      title: "Throne Debt Timeout",
      userId: contract.user_id,
    });
  }

  if (body.action === "lift_timeout") {
    const contractId = String(body.contractId ?? "").trim();
    const liftNote = String(body.adminNote ?? "").trim();

    if (!contractId) {
      return jsonError("Missing contract id.");
    }

    const { data: contract, error: contractError } = await admin.supabase
      .from("throne_debts")
      .select("id, user_id, timeout_reason")
      .eq("id", contractId)
      .in("status", ["timeout", "redeemed"])
      .maybeSingle();

    if (contractError || !contract) {
      return jsonError(contractError?.message ?? "Throne Debt timeout contract not found.", contractError ? 500 : 404);
    }

    const { error: profileError } = await admin.supabase
      .from("profiles")
      .update({
        timeout_reason: null,
        timeout_until: null,
        updated_at: nowIso,
      })
      .eq("id", contract.user_id)
      .eq("timeout_reason", contract.timeout_reason ?? getThroneDebtTimeoutReason(contract.id));

    if (profileError) {
      return jsonError(profileError.message, 500);
    }

    const { error: contractUpdateError } = await admin.supabase
      .from("throne_debts")
      .update({
        status: "redeemed",
        timeout_lift_note: liftNote || null,
        timeout_lifted_at: nowIso,
        timeout_lifted_by_admin_id: admin.adminUser.id,
        updated_at: nowIso,
      })
      .eq("id", contract.id);

    if (contractUpdateError) {
      return jsonError(contractUpdateError.message, 500);
    }
  }

  if (["pause_contract", "resume_contract", "cancel_contract", "mark_defaulted", "mark_completed"].includes(body.action)) {
    const contractId = String(body.contractId ?? "").trim();
    const statusMap: Record<string, ThroneDebtStatus> = {
      cancel_contract: "cancelled",
      mark_completed: "completed",
      mark_defaulted: "defaulted",
      pause_contract: "paused",
      resume_contract: "active",
    };

    if (!contractId) {
      return jsonError("Missing contract id.");
    }

    const { error } = await admin.supabase
      .from("throne_debts")
      .update({
        admin_note: String(body.adminNote ?? "").trim() || null,
        status: statusMap[body.action],
        ...(body.action === "mark_defaulted" ? { timeout_lift_note: String(body.adminNote ?? "").trim() || null } : {}),
        updated_at: nowIso,
      })
      .eq("id", contractId);

    if (error) {
      return jsonError(error.message, 500);
    }
  }

  if (body.action === "approve_installment_payment" || body.action === "reject_installment_payment") {
    const reviewId = String(body.reviewId ?? "").trim();
    const installmentId = String(body.installmentId ?? "").trim();
    const adminNote = String(body.adminNote ?? body.rejectionReason ?? "").trim();

    if (!reviewId || !installmentId) {
      return jsonError("Missing payment review or installment id.");
    }

    const approved = body.action === "approve_installment_payment";
    const { data: review, error: reviewError } = await admin.supabase
      .from("throne_debt_payment_reviews")
      .select("id, debt_id, installment_id, user_id, status, debt:throne_debts(id, status, timeout_reason)")
      .eq("id", reviewId)
      .eq("installment_id", installmentId)
      .eq("status", "pending")
      .maybeSingle();

    if (reviewError || !review) {
      return jsonError(reviewError?.message ?? "Pending payment review not found.", reviewError ? 500 : 404);
    }

    const { error: reviewUpdateError } = await admin.supabase
      .from("throne_debt_payment_reviews")
      .update({
        admin_note: adminNote || null,
        reviewed_at: nowIso,
        reviewed_by_admin_id: admin.adminUser.id,
        status: approved ? "approved" : "rejected",
        updated_at: nowIso,
      })
      .eq("id", review.id)
      .eq("status", "pending");

    if (reviewUpdateError) {
      return jsonError(reviewUpdateError.message, 500);
    }

    const debt = Array.isArray(review.debt) ? review.debt[0] : review.debt;
    const isTimeoutReview = debt?.status === "timeout";
    const isRedemptionReview = approved && isTimeoutReview;

    const { error: installmentUpdateError } = await admin.supabase
      .from("throne_debt_installments")
      .update({
        paid_at: approved ? nowIso : null,
        rejection_reason: approved ? null : adminNote || "Payment review rejected.",
        reviewed_at: nowIso,
        reviewed_by_admin_id: admin.adminUser.id,
        status: approved ? "approved_paid" : isTimeoutReview ? "timeout_redemption_required" : "rejected",
        updated_at: nowIso,
      })
      .eq("id", review.installment_id)
      .eq("status", "submitted_for_review");

    if (installmentUpdateError) {
      return jsonError(installmentUpdateError.message, 500);
    }

    if (isRedemptionReview && debt) {
      const { error: profileError } = await admin.supabase
        .from("profiles")
        .update({
          timeout_reason: null,
          timeout_until: null,
          updated_at: nowIso,
        })
        .eq("id", review.user_id)
        .eq("timeout_reason", debt.timeout_reason ?? getThroneDebtTimeoutReason(debt.id));

      if (profileError) {
        return jsonError(profileError.message, 500);
      }

      const { error: contractRedeemError } = await admin.supabase
        .from("throne_debts")
        .update({
          status: "redeemed",
          timeout_lift_note: adminNote || "Redemption payment approved.",
          timeout_lifted_at: nowIso,
          timeout_lifted_by_admin_id: admin.adminUser.id,
          updated_at: nowIso,
        })
        .eq("id", review.debt_id)
        .eq("status", "timeout");

      if (contractRedeemError) {
        return jsonError(contractRedeemError.message, 500);
      }
    }

    const { data: openInstallments } = await admin.supabase
      .from("throne_debt_installments")
      .select("id")
      .eq("debt_id", review.debt_id)
      .neq("status", "approved_paid")
      .limit(1);

    if (approved && !isRedemptionReview && (openInstallments ?? []).length === 0) {
      await admin.supabase
        .from("throne_debts")
        .update({ status: "completed", updated_at: nowIso })
        .eq("id", review.debt_id)
        .eq("status", "active");
    }

    await notifyUser(admin.supabase, {
      body: approved
        ? "Your Throne payment was approved."
        : "Your Throne payment review was rejected. You can submit it again.",
      contractId: review.debt_id,
      kind: approved ? "throne_debt_payment_approved" : "throne_debt_payment_rejected",
      title: approved ? "Throne Payment Approved" : "Throne Payment Rejected",
      userId: review.user_id,
    });
  }

  return Response.json({ contracts: await listThroneDebts(admin.supabase) });
}
