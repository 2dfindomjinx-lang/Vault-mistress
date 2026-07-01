import { userDebtContractSelect } from "@/lib/debt-contract-select";
import { awardDevotion } from "@/lib/devotion";
import { profileSelect } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const EVIL_DEBT_UNDERAGE_TIMEOUT_MS = 3650 * DAY_MS;
const DEBT_OVERDUE_TIMEOUT_MS = 10 * 365 * DAY_MS;
const DEBT_OVERDUE_TIMEOUT_REASON = "debt_contract_overdue";
const EVIL_DEBT_UNDERAGE_MESSAGE =
  "This Evil Debt Contract submission triggered a special timeout. If the age entry was a joke or mistake, DM @VMPrincipessa with proof.";
const EVIL_CONSENT_PRIMARY_TEXT =
  "I confirm that these images belong to me and I am sharing them with my own consent.";
const EVIL_CONSENT_SECONDARY_TEXT =
  "I consent that Principessa may use these images and I accept the consequences.";
const EVIL_DEBT_TIMEZONE_OPTIONS = new Set(
  Array.from({ length: 25 }, (_, index) => {
    const offset = index - 12;
    return `UTC${offset >= 0 ? "+" : ""}${offset}`;
  }),
);

type ContractRow = {
  current_installment_remaining: number;
  debt_amount: number;
  duration_periods: number;
  id: string;
  missed_periods: number;
  next_due_at: string;
  paid_periods: number;
  period_type: "weekly" | "monthly";
  status: string;
  user_id: string;
};

type ProfileRow = {
  coins: number;
  debt_tribute_pending: number;
  id: string;
  timeout_reason: string | null;
  timeout_until: string | null;
  tribute_total: number;
};

type Body =
  | {
      action?: "sign";
      consentPrimary?: boolean;
      consentPrimaryText?: string;
      consentSecondary?: boolean;
      consentSecondaryText?: string;
      contractType?: "normal" | "evil";
      debtAmount?: number;
      durationPeriods?: number;
      age?: number | string;
      fullName?: string;
      customNote?: string;
      imageUrls?: string[];
      periodType?: "weekly" | "monthly";
      petName?: string;
      randomGenerated?: boolean;
      timezone?: string;
    }
  | {
      action?: "pay" | "autoCollect";
      autoPayEnabled?: boolean;
      contractId?: string;
    };

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function getDebtPeriodMs(periodType: "weekly" | "monthly") {
  return periodType === "weekly" ? WEEK_MS : 30 * DAY_MS;
}

function getFirstDebtDueAtIso(
  periodType: "weekly" | "monthly",
  startMs: number,
) {
  return new Date(startMs + getDebtPeriodMs(periodType)).toISOString();
}

function getCurrentInstallmentRemaining(contract: Pick<ContractRow, "current_installment_remaining" | "debt_amount">) {
  const currentInstallmentRemaining = Math.floor(Number(contract.current_installment_remaining ?? 0));

  if (Number.isInteger(currentInstallmentRemaining) && currentInstallmentRemaining > 0) {
    return currentInstallmentRemaining;
  }

  return Math.max(0, Math.floor(Number(contract.debt_amount ?? 0)));
}

function isValidEvilDebtImage(value: unknown) {
  return (
    typeof value === "string" &&
    /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value) &&
    value.length <= 1_500_000
  );
}

function getDueDebtPaymentPlan(contract: ContractRow, autoPayEnabled: boolean) {
  if (contract.status !== "active") {
    return null;
  }

  const now = Date.now();
  const nextDueMs = new Date(contract.next_due_at).getTime();

  if (!Number.isFinite(nextDueMs) || nextDueMs > now) {
    return null;
  }

  const currentInstallmentRemaining = getCurrentInstallmentRemaining(contract);

  if (currentInstallmentRemaining <= 0) {
    return null;
  }

  const overdue = nextDueMs <= now;

  return {
    amount: currentInstallmentRemaining,
    autoPayEnabled,
    duePeriods: 1,
    missedPeriods: overdue && !autoPayEnabled ? 1 : 0,
  };
}

async function getCurrentUser() {
  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return { error: authError?.message ?? "Authentication required.", userId: null };
  }

  return { error: null, userId: authData.user.id };
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const { error: authError, userId } = await getCurrentUser();

  if (authError || !userId) {
    return jsonError(authError ?? "Authentication required.", 401);
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const supabase = createSupabaseAdminClient();

  if (body?.action === "sign") {
    const periodType = body.periodType;
    const contractType = body.contractType === "evil" ? "evil" : "normal";
    const cleanAmount = Math.floor(Number(body.debtAmount));
    const cleanDuration = Math.floor(Number(body.durationPeriods));
    const cleanPetName = String(body.petName ?? "").trim();
    const baseMinimum = periodType === "weekly" ? 20000 : 100000;
    const minimum = contractType === "evil" ? (periodType === "weekly" ? 40000 : 80000) : baseMinimum;
    const amountStep = contractType === "evil" ? 5000 : periodType === "weekly" ? 5000 : 10000;
    const baseDurationLimit = periodType === "weekly" ? { max: 52, min: 1 } : { max: 24, min: 1 };
    const durationLimit = {
      ...baseDurationLimit,
      min: contractType === "evil" ? Math.ceil(baseDurationLimit.min * 2.5) : baseDurationLimit.min,
    };
    const cleanFullName = String(body.fullName ?? "").trim();
    const cleanCustomNote = String(body.customNote ?? "").trim();
    const cleanTimezone = String(body.timezone ?? "").trim();
    const cleanAge = Math.floor(Number(body.age));
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter(isValidEvilDebtImage) : [];

    if (periodType !== "weekly" && periodType !== "monthly") {
      return jsonError("Invalid debt period type.");
    }

    if (cleanPetName.length < 2) {
      return jsonError("Invalid Pet name.");
    }

    if (contractType === "evil") {
      if (cleanFullName.length < 2) {
        return jsonError("Full name is required for Evil Debt Contract.");
      }

      if (!Number.isInteger(cleanAge) || cleanAge < 1 || cleanAge > 120) {
        return jsonError("A valid age is required for Evil Debt Contract.", 422);
      }

      if (cleanAge < 18) {
        const { data: profileTimeout, error: profileTimeoutError } = await supabase
          .from("profiles")
          .select("timeout_until")
          .eq("id", userId)
          .maybeSingle();

        if (profileTimeoutError) {
          console.error("Evil Debt underage timeout profile lookup failed", profileTimeoutError);
          return jsonError("Evil Debt Contract safety check failed.", 500);
        }

        const existingTimeoutMs = new Date(String(profileTimeout?.timeout_until ?? 0)).getTime();
        const timeoutUntil = new Date(
          Math.max(
            Date.now() + EVIL_DEBT_UNDERAGE_TIMEOUT_MS,
            Number.isFinite(existingTimeoutMs) ? existingTimeoutMs : 0,
          ),
        ).toISOString();

        const { error: timeoutError } = await supabase
          .from("profiles")
          .update({
            timeout_reason: "evil_debt_underage",
            timeout_until: timeoutUntil,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (timeoutError) {
          console.error("Evil Debt underage timeout update failed", timeoutError);
          return jsonError("Evil Debt Contract safety timeout failed.", 500);
        }

        return Response.json(
          {
            error: "evil_debt_timeout",
            message: EVIL_DEBT_UNDERAGE_MESSAGE,
            timeoutUntil,
          },
          { status: 403 },
        );
      }

      if (cleanCustomNote.length > 240) {
        return jsonError("Custom note must be 240 characters or fewer.", 422);
      }

      if (!EVIL_DEBT_TIMEZONE_OPTIONS.has(cleanTimezone)) {
        return jsonError("Timezone must be selected from UTC-12 to UTC+12.");
      }

      if (
        String(body.consentPrimaryText ?? "").trim() !== EVIL_CONSENT_PRIMARY_TEXT ||
        String(body.consentSecondaryText ?? "").trim() !== EVIL_CONSENT_SECONDARY_TEXT
      ) {
        return jsonError("Both Evil Debt Contract consent confirmations must match the required text exactly.");
      }

      if (imageUrls.length < 1 || imageUrls.length > 8 || imageUrls.length !== (body.imageUrls?.length ?? 0)) {
        return jsonError("Evil Debt Contract requires 1-8 valid image uploads.", 422);
      }
    }

    if (!Number.isInteger(cleanAmount) || cleanAmount < minimum || cleanAmount % amountStep !== 0) {
      return jsonError("Invalid debt amount.", 422);
    }

    if (!Number.isInteger(cleanDuration) || cleanDuration < durationLimit.min || cleanDuration > durationLimit.max) {
      return jsonError("Invalid debt duration.", 422);
    }

    const { data: existingContract, error: existingError } = await supabase
      .from("pet_debt_contracts")
      .select("id, contract_type, status")
      .eq("user_id", userId)
      .in("status", ["active", "pending"])
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return jsonError(existingError.message, 500);
    }

    if (existingContract) {
      const existingType = existingContract.contract_type === "evil" ? "evil" : "normal";
      const message =
        existingType === "evil"
          ? contractType === "evil"
            ? "An Evil Debt Contract is already active or pending."
            : "Normal Debt Contract cannot be created while an Evil Debt Contract is active or pending."
          : contractType === "evil"
            ? "Evil Debt Contract cannot be created while a Normal Debt Contract is active or pending."
            : "A Normal Debt Contract is already active or pending.";
      return jsonError(message, 409);
    }

    const nowMs = Date.now();
    const periodMs = getDebtPeriodMs(periodType);
    const startedAt = contractType === "evil" ? null : new Date(nowMs).toISOString();
    const firstDueAt = getFirstDebtDueAtIso(periodType, nowMs);
    const { data, error } = await supabase
      .from("pet_debt_contracts")
      .insert({
        debt_amount: cleanAmount,
        contract_type: contractType,
        consent_primary: contractType === "evil" ? true : false,
        consent_secondary: contractType === "evil" ? true : false,
        current_installment_remaining: cleanAmount,
        declared_age: contractType === "evil" ? cleanAge : null,
        duration_periods: cleanDuration,
        ends_at: new Date(nowMs + periodMs * cleanDuration).toISOString(),
        full_name: contractType === "evil" ? cleanFullName : null,
        custom_note: contractType === "evil" ? cleanCustomNote : null,
        image_urls: [],
        next_due_at: firstDueAt,
        period_type: periodType,
        pet_name: cleanPetName,
        random_generated: Boolean(body.randomGenerated),
        started_at: startedAt,
        status: contractType === "evil" ? "pending" : "active",
        timezone: contractType === "evil" ? cleanTimezone : null,
        user_id: userId,
      })
      .select(userDebtContractSelect)
      .single();

    if (error || !data) {
      return jsonError(error?.message ?? "Debt contract creation failed.", 500);
    }

    if (contractType === "evil") {
      const { error: imageInsertError } = await supabase.from("evil_debt_contract_images").insert(
        imageUrls.map((imageUrl) => ({
          contract_id: data.id,
          image_url: imageUrl,
          user_id: userId,
        })),
      );

      if (imageInsertError) {
        console.error("Evil Debt Contract image insert failed", imageInsertError);
        await supabase.from("pet_debt_contracts").delete().eq("id", data.id).eq("user_id", userId);
        return jsonError("Evil Debt Contract image save failed.", 500);
      }
    }

    return Response.json({ contract: data });
  }

  if (body?.action === "pay" || body?.action === "autoCollect") {
    const contractId = String(body.contractId ?? "").trim();

    if (!contractId) {
      return jsonError("Missing debt contract id.");
    }

    const { data: contractData, error: contractError } = await supabase
      .from("pet_debt_contracts")
      .select(userDebtContractSelect)
      .eq("id", contractId)
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (contractError || !contractData) {
      return jsonError(contractError?.message ?? "Debt contract not found.", 404);
    }

    const contract = contractData as ContractRow;
    const nowMs = Date.now();
    const dueAtMs = new Date(contract.next_due_at).getTime();
    const manualPaymentDue = Number.isFinite(dueAtMs) && dueAtMs <= nowMs;
    const plan = body.action === "pay"
      ? getDueDebtPaymentPlan(contract, false)
      : getDueDebtPaymentPlan(contract, Boolean(body.autoPayEnabled));

    if (!plan || (body.action === "pay" && !manualPaymentDue)) {
      return jsonError("Debt payment is not due.", 409);
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, coins, tribute_total, debt_tribute_pending, timeout_until, timeout_reason")
      .eq("id", userId)
      .single();

    if (profileError || !profileData) {
      return jsonError(profileError?.message ?? "Profile not found.", 404);
    }

    const profile = profileData as ProfileRow;
    const collectedAt = new Date().toISOString();
    const currentInstallmentRemaining = getCurrentInstallmentRemaining(contract);
    const paidAmount = Math.min(Math.max(0, profile.coins), currentInstallmentRemaining);
    const remainingInstallment = Math.max(0, currentInstallmentRemaining - paidAmount);
    const installmentCompleted = remainingInstallment === 0;
    const overdue = Number.isFinite(dueAtMs) && dueAtMs <= nowMs;
    const nextPaidPeriods = installmentCompleted ? contract.paid_periods + 1 : contract.paid_periods;
    const contractCompleted = installmentCompleted && nextPaidPeriods >= contract.duration_periods;
    const periodMs = getDebtPeriodMs(contract.period_type);
    const nextDueAt = contractCompleted
      ? contract.next_due_at
      : installmentCompleted
        ? new Date(dueAtMs + periodMs).toISOString()
        : contract.next_due_at;
    const nextInstallmentRemaining = contractCompleted
      ? 0
      : installmentCompleted
        ? contract.debt_amount
        : remainingInstallment;
    const missedThisPayment = installmentCompleted && overdue && !plan.autoPayEnabled;
    const nextMissedPeriods = contract.missed_periods + (missedThisPayment ? 1 : 0);
    const nextCoins = profile.coins - paidAmount;
    const immediateTribute = paidAmount;
    const deferredTribute = 0;
    const nextTributeTotal = (profile.tribute_total ?? 0) + immediateTribute;
    const nextDebtTributePending = profile.debt_tribute_pending ?? 0;
    const shouldKeepDebtTimeout = overdue && !contractCompleted && nextInstallmentRemaining > 0;
    const nextTimeoutUntil = shouldKeepDebtTimeout
      ? new Date(
          Math.max(
            nowMs + DEBT_OVERDUE_TIMEOUT_MS,
            new Date(profile.timeout_until ?? 0).getTime(),
          ),
        ).toISOString()
      : profile.timeout_reason === DEBT_OVERDUE_TIMEOUT_REASON
        ? null
        : profile.timeout_until;
    const nextTimeoutReason = shouldKeepDebtTimeout
      ? DEBT_OVERDUE_TIMEOUT_REASON
      : profile.timeout_reason === DEBT_OVERDUE_TIMEOUT_REASON
        ? null
        : profile.timeout_reason;

    const { data: updatedProfile, error: updateProfileError } = await supabase
      .from("profiles")
      .update({
        coins: nextCoins,
        debt_tribute_pending: nextDebtTributePending,
        timeout_reason: nextTimeoutReason,
        timeout_until: nextTimeoutUntil,
        tribute_total: nextTributeTotal,
        updated_at: collectedAt,
      })
      .eq("id", userId)
      .eq("coins", profile.coins)
      .eq("debt_tribute_pending", profile.debt_tribute_pending ?? 0)
      .eq("tribute_total", profile.tribute_total)
      .select(profileSelect)
      .maybeSingle();

    if (updateProfileError || !updatedProfile) {
      return jsonError(updateProfileError?.message ?? "Debt payment was stale or duplicated.", updateProfileError ? 500 : 409);
    }

    const { data: updatedContract, error: updateContractError } = await supabase
      .from("pet_debt_contracts")
      .update({
        current_installment_remaining: nextInstallmentRemaining,
        missed_periods: nextMissedPeriods,
        next_due_at: nextDueAt,
        paid_periods: nextPaidPeriods,
        status: contractCompleted ? "completed" : "active",
        updated_at: collectedAt,
      })
      .eq("id", contract.id)
      .eq("current_installment_remaining", contract.current_installment_remaining)
      .eq("missed_periods", contract.missed_periods)
      .eq("paid_periods", contract.paid_periods)
      .eq("next_due_at", contract.next_due_at)
      .eq("status", contract.status)
      .select(userDebtContractSelect)
      .maybeSingle();

    if (updateContractError || !updatedContract) {
      return jsonError(updateContractError?.message ?? "Debt contract update was stale or duplicated.", updateContractError ? 500 : 409);
    }

    let transaction: { id: string } | null = null;

    if (paidAmount > 0) {
      const { data: insertedTransaction, error: transactionError } = await supabase.from("coin_transactions").insert({
        amount: nextCoins - profile.coins,
        balance_after: nextCoins,
        balance_before: profile.coins,
        metadata: {
          autoCollected: body.action === "autoCollect",
          contractId: contract.id,
          currentInstallmentRemaining: nextInstallmentRemaining,
          debtTributeDeferredAmount: deferredTribute,
          debtTributeImmediateAmount: immediateTribute,
          duePeriods: plan.duePeriods,
          installmentCompleted,
          missedPeriods: missedThisPayment ? 1 : 0,
          paidAmount,
          partialPayment: !installmentCompleted,
          spendAmount: paidAmount,
          tributeTotalChanged: immediateTribute > 0,
        },
        reason: body.action === "autoCollect" && missedThisPayment
          ? "tribute:debt-contract:missed"
          : body.action === "autoCollect"
            ? "tribute:debt-contract:auto"
            : "tribute:debt-contract",
        user_id: userId,
      }).select("id").single();

      if (transactionError) {
        console.error("Debt contract transaction insert failed", transactionError);
        const { error: rollbackProfileError } = await supabase
          .from("profiles")
          .update({
            coins: profile.coins,
            debt_tribute_pending: profile.debt_tribute_pending ?? 0,
            timeout_reason: profile.timeout_reason,
            timeout_until: profile.timeout_until,
            tribute_total: profile.tribute_total,
            updated_at: collectedAt,
          })
          .eq("id", userId)
          .eq("coins", nextCoins)
          .eq("debt_tribute_pending", nextDebtTributePending)
          .eq("tribute_total", nextTributeTotal);

        if (rollbackProfileError) {
          console.error("Debt contract profile rollback failed", rollbackProfileError);
        }

        const { error: rollbackContractError } = await supabase
          .from("pet_debt_contracts")
          .update({
            current_installment_remaining: contract.current_installment_remaining,
            missed_periods: contract.missed_periods,
            next_due_at: contract.next_due_at,
            paid_periods: contract.paid_periods,
            status: contract.status,
            updated_at: collectedAt,
          })
          .eq("id", contract.id)
          .eq("current_installment_remaining", nextInstallmentRemaining)
          .eq("missed_periods", nextMissedPeriods)
          .eq("paid_periods", nextPaidPeriods)
          .eq("next_due_at", nextDueAt)
          .eq("status", contractCompleted ? "completed" : "active");

        if (rollbackContractError) {
          console.error("Debt contract contract rollback failed", rollbackContractError);
        }

        return jsonError("Debt payment coin logging failed.", 500);
      }

      transaction = insertedTransaction;
    }
    if (body.action === "pay" && installmentCompleted && paidAmount > 0) {
      const { data: existingTask, error: existingTaskError } = await supabase
        .from("user_pet_tasks")
        .select("task_id, completed_at, reward_score, status, reviewed_at, metadata")
        .eq("user_id", userId)
        .eq("task_id", "pet-debt-contract")
        .maybeSingle();

      if (existingTaskError) {
        return jsonError(existingTaskError.message, 500);
      }

      if (!existingTask?.reviewed_at) {
        const { error: taskError } = await supabase.from("user_pet_tasks").upsert(
          {
            completed_at: collectedAt,
            metadata: {
              contractId: contract.id,
              paidPeriods: nextPaidPeriods,
            },
            reviewed_at: collectedAt,
            reward_score: 10,
            status: "approved",
            task_id: "pet-debt-contract",
            user_id: userId,
          },
          { onConflict: "user_id,task_id" },
        );

        if (taskError) {
          console.error("Debt contract task marker failed", taskError);
          if (transaction?.id) {
            const { error: txCleanupError } = await supabase
              .from("coin_transactions")
              .delete()
              .eq("id", transaction.id);

            if (txCleanupError) {
              console.error("Debt contract transaction cleanup failed", txCleanupError);
            }
          }

          const { error: rollbackProfileError } = await supabase
            .from("profiles")
            .update({
              coins: profile.coins,
              debt_tribute_pending: profile.debt_tribute_pending ?? 0,
              timeout_reason: profile.timeout_reason,
              timeout_until: profile.timeout_until,
              tribute_total: profile.tribute_total,
              updated_at: collectedAt,
            })
            .eq("id", userId)
            .eq("coins", nextCoins)
            .eq("debt_tribute_pending", nextDebtTributePending)
            .eq("tribute_total", nextTributeTotal);

          if (rollbackProfileError) {
            console.error("Debt contract profile rollback after task failure failed", rollbackProfileError);
          }

          const { error: rollbackContractError } = await supabase
            .from("pet_debt_contracts")
            .update({
              current_installment_remaining: contract.current_installment_remaining,
              missed_periods: contract.missed_periods,
              next_due_at: contract.next_due_at,
              paid_periods: contract.paid_periods,
              status: contract.status,
              updated_at: collectedAt,
            })
            .eq("id", contract.id)
            .eq("current_installment_remaining", nextInstallmentRemaining)
            .eq("missed_periods", nextMissedPeriods)
            .eq("paid_periods", nextPaidPeriods)
            .eq("next_due_at", nextDueAt)
            .eq("status", contractCompleted ? "completed" : "active");

          if (rollbackContractError) {
            console.error("Debt contract contract rollback after task failure failed", rollbackContractError);
          }

          return jsonError("Debt contract task logging failed.", 500);
        }
      }
    }

    if (paidAmount > 0) {
      try {
        await awardDevotion(supabase, {
          amount: Math.floor(paidAmount / 100),
          metadata: {
            contractId: contract.id,
            installmentCompleted,
            paidAmount,
            remainingInstallment: nextInstallmentRemaining,
          },
          source: "debt_contract_payment",
          sourceKey: [
            contract.id,
            contract.paid_periods,
            currentInstallmentRemaining,
            paidAmount,
            installmentCompleted ? "full" : "partial",
          ].join(":"),
          userId,
        });
      } catch (devotionError) {
        console.error("Debt contract devotion award failed", devotionError);
      }
    }

    return Response.json({
      autoPaySkipped: paidAmount === 0,
      contract: contractCompleted ? null : updatedContract,
      paidAmount,
      plan: {
        ...plan,
        amount: currentInstallmentRemaining,
        completed: contractCompleted,
        currentInstallmentRemaining: nextInstallmentRemaining,
        installmentCompleted,
        nextPaidPeriods,
      },
      profile: updatedProfile,
      reason: paidAmount === 0 ? "insufficient_coins" : undefined,
    });
  }

  return jsonError("Unsupported debt contract action.");
}
