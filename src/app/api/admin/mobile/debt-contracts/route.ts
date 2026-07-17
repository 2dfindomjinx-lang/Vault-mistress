import { getDebtPeriodMs, getFirstDebtDueAtIso, listAdminDebtContracts } from "@/lib/admin-debt-contracts";
import { requireMobileAdmin } from "@/lib/mobile-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as {
    action?: "approveEvil" | "expireOverdue" | "list" | "remove";
    contractId?: string;
  };

  if (body.action === "remove") {
    const contractId = body.contractId?.trim();
    if (!contractId) return Response.json({ error: "Missing debt contract id." }, { status: 400 });
    const { data: contract, error: contractError } = await admin.supabase
      .from("pet_debt_contracts")
      .select("id, user_id")
      .eq("id", contractId)
      .maybeSingle();
    if (contractError || !contract) {
      return Response.json({ error: contractError?.message ?? "Debt contract not found." }, { status: contractError ? 500 : 404 });
    }
    const now = new Date().toISOString();
    const { error } = await admin.supabase
      .from("pet_debt_contracts")
      .update({
        admin_review_required: false,
        closed_at: now,
        close_reason: "Closed from mobile admin without refund or penalty.",
        current_installment_remaining: 0,
        overdue_since: null,
        status: "forgiven",
        updated_at: now,
      })
      .eq("id", contractId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    await admin.supabase.from("evil_debt_contract_images").delete().eq("contract_id", contract.id);
    await admin.supabase
      .from("profiles")
      .update({ timeout_reason: null, timeout_until: null, updated_at: now })
      .eq("id", contract.user_id)
      .eq("timeout_reason", "debt_contract_overdue");
  }

  if (body.action === "approveEvil") {
    const contractId = body.contractId?.trim();
    if (!contractId) return Response.json({ error: "Missing debt contract id." }, { status: 400 });
    const { data: contract, error: readError } = await admin.supabase
      .from("pet_debt_contracts")
      .select("id, duration_periods, period_type")
      .eq("id", contractId)
      .eq("contract_type", "evil")
      .eq("status", "pending")
      .maybeSingle();
    if (readError) return Response.json({ error: readError.message }, { status: 500 });
    if (!contract) return Response.json({ error: "Pending Evil Debt Contract not found." }, { status: 404 });

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
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  if (body.action === "expireOverdue") {
    const now = new Date().toISOString();
    const { error } = await admin.supabase
      .from("pet_debt_contracts")
      .update({ status: "expired", updated_at: now })
      .lt("ends_at", now)
      .eq("status", "active");
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ contracts: await listAdminDebtContracts(admin.supabase) });
}
