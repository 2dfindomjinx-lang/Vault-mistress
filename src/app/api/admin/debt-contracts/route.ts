import { getDebtPeriodMs, getFirstDebtDueAtIso, listAdminDebtContracts } from "@/lib/admin-debt-contracts";
import { requireAdminProfile } from "@/lib/admin-guard";

const DEBT_TRANSACTION_REASONS = [
  "tribute:debt-contract",
  "tribute:debt-contract:auto",
  "tribute:debt-contract:missed",
] as const;

export async function POST(request: Request) {
  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as {
    action?: "approveEvil" | "expireOverdue" | "list" | "remove";
    contractId?: string;
  };

  if (body.action === "remove") {
    const contractId = body.contractId?.trim();

    if (!contractId) {
      return Response.json({ error: "Missing debt contract id." }, { status: 400 });
    }

    const { data: contract, error: contractError } = await admin.supabase
      .from("pet_debt_contracts")
      .select("id, debt_amount, user_id")
      .eq("id", contractId);

    if (contractError) {
      console.error("Admin debt contract lookup failed", contractError);
      return Response.json({ error: contractError.message }, { status: 500 });
    }

    const activeContract = contract?.[0];

    if (!activeContract) {
      return Response.json({ error: "Debt contract not found." }, { status: 404 });
    }

    const { data: lastDebtTransaction, error: lastDebtTransactionError } = await admin.supabase
      .from("coin_transactions")
      .select("id, amount, balance_after, balance_before, metadata")
      .eq("user_id", activeContract.user_id)
      .in("reason", [...DEBT_TRANSACTION_REASONS])
      .contains("metadata", { contractId: activeContract.id })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastDebtTransactionError) {
      console.error("Admin debt refund lookup failed", lastDebtTransactionError);
      return Response.json({ error: lastDebtTransactionError.message }, { status: 500 });
    }

    let refundTransactionId: string | null = null;
    let refundedInstallmentAmount = 0;
    let refundProfileRollback:
      | {
          coins: number;
          debt_tribute_pending: number;
          tribute_total: number;
          user_id: string;
        }
      | null = null;

    if (lastDebtTransaction) {
      const transactionMetadata =
        lastDebtTransaction.metadata && typeof lastDebtTransaction.metadata === "object"
          ? (lastDebtTransaction.metadata as Record<string, unknown>)
          : {};
      const spendAmount = Number(transactionMetadata.spendAmount ?? Math.abs(Number(lastDebtTransaction.amount ?? 0)));
      refundedInstallmentAmount = Math.max(
        0,
        Math.min(
          Number(activeContract.debt_amount ?? 0),
          Number.isFinite(spendAmount) ? spendAmount : Math.abs(Number(lastDebtTransaction.amount ?? 0)),
        ),
      );

      if (refundedInstallmentAmount > 0) {
        const { data: profile, error: profileError } = await admin.supabase
          .from("profiles")
          .select("coins, debt_tribute_pending, tribute_total")
          .eq("id", activeContract.user_id)
          .maybeSingle();

        if (profileError || !profile) {
          console.error("Admin debt refund profile lookup failed", profileError);
          return Response.json({ error: profileError?.message ?? "Debt refund profile not found." }, { status: 500 });
        }

        const pendingRefundAmount = Math.min(
          refundedInstallmentAmount,
          Math.max(0, Number(profile.debt_tribute_pending ?? 0)),
        );
        const tributeRefundAmount = Math.min(
          refundedInstallmentAmount - pendingRefundAmount,
          Math.max(0, Number(profile.tribute_total ?? 0)),
        );
        const nextCoins = Number(profile.coins ?? 0) + refundedInstallmentAmount;
        const nextDebtTributePending = Math.max(
          0,
          Number(profile.debt_tribute_pending ?? 0) - pendingRefundAmount,
        );
        const nextTributeTotal = Math.max(
          0,
          Number(profile.tribute_total ?? 0) - tributeRefundAmount,
        );
        const refundedAt = new Date().toISOString();

        const { error: profileUpdateError } = await admin.supabase
          .from("profiles")
          .update({
            coins: nextCoins,
            debt_tribute_pending: nextDebtTributePending,
            tribute_total: nextTributeTotal,
            updated_at: refundedAt,
          })
          .eq("id", activeContract.user_id)
          .eq("coins", Number(profile.coins ?? 0))
          .eq("debt_tribute_pending", Number(profile.debt_tribute_pending ?? 0))
          .eq("tribute_total", Number(profile.tribute_total ?? 0));

        if (profileUpdateError) {
          console.error("Admin debt refund profile update failed", profileUpdateError);
          return Response.json({ error: profileUpdateError.message }, { status: 500 });
        }

        refundProfileRollback = {
          coins: Number(profile.coins ?? 0),
          debt_tribute_pending: Number(profile.debt_tribute_pending ?? 0),
          tribute_total: Number(profile.tribute_total ?? 0),
          user_id: activeContract.user_id,
        };

        const { data: refundTransaction, error: refundTransactionError } = await admin.supabase
          .from("coin_transactions")
          .insert({
            user_id: activeContract.user_id,
            admin_user_id: admin.adminUser.id,
            amount: refundedInstallmentAmount,
            reason: "admin_debt_refund",
            balance_before: Number(profile.coins ?? 0),
            balance_after: nextCoins,
            metadata: {
              contractId: activeContract.id,
              kind: "debt_contract_last_installment_refund",
              refundedDebtTributePendingAmount: pendingRefundAmount,
              refundedInstallmentAmount,
              refundedTributeTotalAmount: tributeRefundAmount,
              refundedTransactionId: lastDebtTransaction.id,
              refundedTransactionReason: "debt_contract_remove",
              tributeTotalChanged: tributeRefundAmount > 0,
              verifiedAdminUserId: admin.adminUser.id,
            },
          })
          .select("id")
          .single();

        if (refundTransactionError || !refundTransaction) {
          console.error("Admin debt refund transaction insert failed", refundTransactionError);
          await admin.supabase
            .from("profiles")
            .update({
              coins: Number(profile.coins ?? 0),
              debt_tribute_pending: Number(profile.debt_tribute_pending ?? 0),
              tribute_total: Number(profile.tribute_total ?? 0),
              updated_at: refundedAt,
            })
            .eq("id", activeContract.user_id)
            .eq("coins", nextCoins)
            .eq("debt_tribute_pending", nextDebtTributePending)
            .eq("tribute_total", nextTributeTotal);
          return Response.json({ error: "Debt refund logging failed." }, { status: 500 });
        }

        refundTransactionId = refundTransaction.id;
      }
    }

    const { error } = await admin.supabase
      .from("pet_debt_contracts")
      .delete()
      .eq("id", contractId);

    if (error) {
      console.error("Admin debt contract removal failed", error);
      if (refundProfileRollback) {
        await admin.supabase
          .from("profiles")
          .update({
            coins: refundProfileRollback.coins,
            debt_tribute_pending: refundProfileRollback.debt_tribute_pending,
            tribute_total: refundProfileRollback.tribute_total,
            updated_at: new Date().toISOString(),
          })
          .eq("id", refundProfileRollback.user_id);
      }

      if (refundTransactionId) {
        await admin.supabase.from("coin_transactions").delete().eq("id", refundTransactionId);
      }

      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      contracts: await listAdminDebtContracts(admin.supabase, { projectOverdueMissedPeriods: true }),
      refundedInstallmentAmount,
    });
  }

  if (body.action === "approveEvil") {
    const contractId = body.contractId?.trim();

    if (!contractId) {
      return Response.json({ error: "Missing debt contract id." }, { status: 400 });
    }

    const { data: contract, error: readError } = await admin.supabase
      .from("pet_debt_contracts")
      .select("id, contract_type, duration_periods, period_type, status")
      .eq("id", contractId)
      .eq("contract_type", "evil")
      .eq("status", "pending")
      .maybeSingle();

    if (readError) {
      console.error("Admin evil debt approval lookup failed", readError);
      return Response.json({ error: readError.message }, { status: 500 });
    }

    if (!contract) {
      return Response.json({ error: "Pending Evil Debt Contract not found." }, { status: 404 });
    }

    const now = new Date();
    const periodMs = getDebtPeriodMs(contract.period_type as "weekly" | "monthly");
    const { error } = await admin.supabase
      .from("pet_debt_contracts")
      .update({
        ends_at: new Date(now.getTime() + periodMs * Number(contract.duration_periods ?? 0)).toISOString(),
        next_due_at: getFirstDebtDueAtIso(contract.period_type as "weekly" | "monthly", now),
        started_at: now.toISOString(),
        status: "active",
        updated_at: now.toISOString(),
      })
      .eq("id", contract.id)
      .eq("status", "pending");

    if (error) {
      console.error("Admin evil debt approval failed", error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  if (body.action === "expireOverdue") {
    const now = new Date().toISOString();
    const { error } = await admin.supabase
      .from("pet_debt_contracts")
      .update({ status: "expired", updated_at: now })
      .lt("ends_at", now)
      .eq("status", "active");

    if (error) {
      console.error("Admin debt expiry update failed", error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  return Response.json({
    contracts: await listAdminDebtContracts(admin.supabase, { projectOverdueMissedPeriods: true }),
  });
}
