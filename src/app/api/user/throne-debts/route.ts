import {
  normalizeThroneDebtFrequency,
  type ThroneDebtContract,
  validateThroneDebtRequest,
} from "@/lib/throne-debt";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

const CONTRACT_SELECT = `
  *,
  installments:throne_debt_installments(*),
  payment_reviews:throne_debt_payment_reviews(*)
`;

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function getCurrentUserId() {
  const authSupabase = await createSupabaseServerClient();
  const { data, error } = await authSupabase.auth.getUser();

  if (error || !data.user) {
    return { error: error?.message ?? "Authentication required.", userId: null };
  }

  return { error: null, userId: data.user.id };
}

function sortContract(contract: ThroneDebtContract) {
  return {
    ...contract,
    installments: [...(contract.installments ?? [])].sort((a, b) => a.installment_number - b.installment_number),
    payment_reviews: [...(contract.payment_reviews ?? [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ),
  };
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const { error, userId } = await getCurrentUserId();

  if (error || !userId) {
    return jsonError(error ?? "Authentication required.", 401);
  }

  const supabase = createSupabaseAdminClient();

  const { data, error: readError } = await supabase
    .from("throne_debts")
    .select(CONTRACT_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (readError) {
    return jsonError(readError.message, 500);
  }

  const contracts = ((data ?? []) as ThroneDebtContract[]).map(sortContract);

  return Response.json({
    activeContract: contracts.find((contract) =>
      ["pending_review", "active", "overdue", "timeout", "paused"].includes(contract.status),
    ) ?? null,
    contracts,
  });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const { error, userId } = await getCurrentUserId();

  if (error || !userId) {
    return jsonError(error ?? "Authentication required.", 401);
  }

  const body = (await request.json().catch(() => null)) as {
    action?: "create" | "submit_payment";
    contractLengthWeeks?: number;
    installmentId?: string;
    optionalNote?: string;
    repaymentFrequency?: string;
    screenshotUrl?: string;
    throneOrderLink?: string;
    totalAmountUsd?: number;
    userNote?: string;
  } | null;
  const supabase = createSupabaseAdminClient();

  if (body?.action === "create") {
    const repaymentFrequency = normalizeThroneDebtFrequency(body.repaymentFrequency);
    const cleanNote = String(body.optionalNote ?? body.userNote ?? "").trim().slice(0, 500);
    const validation = validateThroneDebtRequest({
      contractLengthWeeks: Math.floor(Number(body.contractLengthWeeks)),
      repaymentFrequency,
      totalAmountUsd: Number(body.totalAmountUsd),
    });

    if (validation.error || !validation.plan || !repaymentFrequency) {
      return jsonError(validation.error ?? "Invalid Throne Debt request.", 422);
    }

    const { data: existing, error: existingError } = await supabase
      .from("throne_debts")
      .select("id, status")
      .eq("user_id", userId)
      .in("status", ["pending_review", "active", "overdue", "timeout", "paused"])
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return jsonError(existingError.message, 500);
    }

    if (existing) {
      return jsonError("You already have an open Throne Debt request or contract.", 409);
    }

    const { data: contract, error: insertError } = await supabase
      .from("throne_debts")
      .insert({
        contract_length_weeks: validation.plan.contractLengthWeeks,
        installment_amount_usd: validation.plan.installmentAmountUsd,
        installment_count: validation.plan.installmentCount,
        repayment_frequency: repaymentFrequency,
        status: "pending_review",
        total_amount_usd: validation.plan.totalAmountUsd,
        user_id: userId,
        user_note: cleanNote || null,
      })
      .select(CONTRACT_SELECT)
      .single();

    if (insertError || !contract) {
      return jsonError(insertError?.message ?? "Throne Debt request failed.", 500);
    }

    return Response.json({ contract: sortContract(contract as ThroneDebtContract) });
  }

  if (body?.action === "submit_payment") {
    const installmentId = String(body.installmentId ?? "").trim();
    const throneOrderLink = String(body.throneOrderLink ?? "").trim();
    const userNote = String(body.userNote ?? "").trim().slice(0, 500);
    const screenshotUrl = String(body.screenshotUrl ?? "").trim();

    if (!installmentId) {
      return jsonError("Missing installment id.");
    }

    if (!/^https?:\/\/.+/i.test(throneOrderLink)) {
      return jsonError("A valid Throne order link is required.", 422);
    }

    const { data: installment, error: installmentError } = await supabase
      .from("throne_debt_installments")
      .select("*, debt:throne_debts(id, user_id, status)")
      .eq("id", installmentId)
      .maybeSingle();

    if (installmentError || !installment) {
      return jsonError(installmentError?.message ?? "Installment not found.", installmentError ? 500 : 404);
    }

    const debt = Array.isArray(installment.debt) ? installment.debt[0] : installment.debt;

    if (!debt || debt.user_id !== userId || !["active", "timeout"].includes(debt.status)) {
      return jsonError("Active Throne Debt installment not found.", 404);
    }

    const allowedInstallmentStatuses =
      debt.status === "timeout"
        ? ["timeout_redemption_required"]
        : ["pending", "rejected", "overdue"];

    if (!allowedInstallmentStatuses.includes(String(installment.status))) {
      return jsonError("This installment cannot be submitted for review right now.", 409);
    }

    const now = new Date().toISOString();
    const { data: review, error: reviewError } = await supabase
      .from("throne_debt_payment_reviews")
      .insert({
        debt_id: debt.id,
        installment_id: installmentId,
        screenshot_url: screenshotUrl || null,
        status: "pending",
        throne_order_link: throneOrderLink,
        user_id: userId,
        user_note: userNote || null,
      })
      .select("*")
      .single();

    if (reviewError || !review) {
      return jsonError(reviewError?.message ?? "Payment review submission failed.", 500);
    }

    const { error: updateError } = await supabase
      .from("throne_debt_installments")
      .update({
        status: "submitted_for_review",
        submitted_note: userNote || null,
        submitted_throne_link: throneOrderLink,
        updated_at: now,
      })
      .eq("id", installmentId)
      .in("status", allowedInstallmentStatuses);

    if (updateError) {
      await supabase.from("throne_debt_payment_reviews").delete().eq("id", review.id);
      return jsonError(updateError.message, 500);
    }

    const { data: contracts } = await supabase
      .from("throne_debts")
      .select(CONTRACT_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    return Response.json({
      contracts: ((contracts ?? []) as ThroneDebtContract[]).map(sortContract),
      review,
    });
  }

  return jsonError("Unsupported Throne Debt action.");
}
