import { userDebtContractSelect } from "@/lib/debt-contract-select";
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

  const periodMs = getDebtPeriodMs(contract.period_type);
  const duePeriods = Math.max(1, Math.floor((now - nextDueMs) / periodMs) + 1);
  const remainingPeriods = Math.max(0, contract.duration_periods - contract.paid_periods);
  const periodsToCollect = Math.min(duePeriods, remainingPeriods);

  if (periodsToCollect <= 0) {
    return null;
  }

  const missedPeriods = autoPayEnabled ? 0 : periodsToCollect;
  const nextPaidPeriods = Math.min(contract.duration_periods, contract.paid_periods + periodsToCollect);
  const completed = nextPaidPeriods >= contract.duration_periods;
  const nextDueAt = completed
    ? contract.next_due_at
    : new Date(nextDueMs + periodMs * periodsToCollect).toISOString();

  return {
    amount: contract.debt_amount * periodsToCollect,
    completed,
    duePeriods: periodsToCollect,
    missedPeriods,
    nextDueAt,
    nextPaidPeriods,
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
    const { data, error } = await supabase
      .from("pet_debt_contracts")
      .insert({
        debt_amount: cleanAmount,
        contract_type: contractType,
        consent_primary: contractType === "evil" ? true : false,
        consent_secondary: contractType === "evil" ? true : false,
        declared_age: contractType === "evil" ? cleanAge : null,
        duration_periods: cleanDuration,
        ends_at: new Date(nowMs + periodMs * cleanDuration).toISOString(),
        full_name: contractType === "evil" ? cleanFullName : null,
        custom_note: contractType === "evil" ? cleanCustomNote : null,
        image_urls: [],
        next_due_at: new Date(nowMs).toISOString(),
        period_type: periodType,
        pet_name: cleanPetName,
        random_generated: Boolean(body.randomGenerated),
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
    const manualPaymentDue =
      contract.paid_periods === 0 ||
      new Date(contract.next_due_at).getTime() <= Date.now();
    const plan = body.action === "pay"
      ? {
          amount: contract.debt_amount,
          completed: contract.paid_periods + 1 >= contract.duration_periods,
          duePeriods: 1,
          missedPeriods: Math.max(
            0,
            Math.floor((Date.now() - new Date(contract.next_due_at).getTime()) / getDebtPeriodMs(contract.period_type)),
          ),
          nextDueAt: new Date(Date.now() + getDebtPeriodMs(contract.period_type)).toISOString(),
          nextPaidPeriods: contract.paid_periods + 1,
        }
      : getDueDebtPaymentPlan(contract, Boolean(body.autoPayEnabled));

    if (!plan || (body.action === "pay" && !manualPaymentDue)) {
      return jsonError("Debt payment is not due.", 409);
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, coins, tribute_total, debt_tribute_pending")
      .eq("id", userId)
      .single();

    if (profileError || !profileData) {
      return jsonError(profileError?.message ?? "Profile not found.", 404);
    }

    const profile = profileData as ProfileRow;
    const collectedAt = new Date().toISOString();

    if (body.action === "autoCollect" && Boolean(body.autoPayEnabled) && profile.coins < plan.amount) {
      return Response.json({
        autoPaySkipped: true,
        contract,
        plan,
        profile,
        reason: "insufficient_coins",
      });
    }

    const nextCoins = profile.coins - plan.amount;
    const immediateTribute = Math.min(plan.amount, Math.max(0, profile.coins));
    const deferredTribute = Math.max(0, plan.amount - immediateTribute);
    const nextTributeTotal = (profile.tribute_total ?? 0) + immediateTribute;
    const nextDebtTributePending = (profile.debt_tribute_pending ?? 0) + deferredTribute;

    const { data: updatedProfile, error: updateProfileError } = await supabase
      .from("profiles")
      .update({
        coins: nextCoins,
        debt_tribute_pending: nextDebtTributePending,
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
        missed_periods: contract.missed_periods + plan.missedPeriods,
        next_due_at: plan.completed ? contract.next_due_at : plan.nextDueAt,
        paid_periods: plan.nextPaidPeriods,
        status: plan.completed ? "completed" : "active",
        updated_at: collectedAt,
      })
      .eq("id", contract.id)
      .eq("paid_periods", contract.paid_periods)
      .eq("next_due_at", contract.next_due_at)
      .eq("status", contract.status)
      .select(userDebtContractSelect)
      .maybeSingle();

    if (updateContractError || !updatedContract) {
      return jsonError(updateContractError?.message ?? "Debt contract update was stale or duplicated.", updateContractError ? 500 : 409);
    }

    const { data: transaction, error: transactionError } = await supabase.from("coin_transactions").insert({
      amount: nextCoins - profile.coins,
      balance_after: nextCoins,
      balance_before: profile.coins,
      metadata: {
        autoCollected: body.action === "autoCollect",
        contractId: contract.id,
        debtTributeDeferredAmount: deferredTribute,
        debtTributeImmediateAmount: immediateTribute,
        duePeriods: plan.duePeriods,
        missedPeriods: plan.missedPeriods,
        spendAmount: plan.amount,
        tributeTotalChanged: immediateTribute > 0,
      },
      reason: body.action === "autoCollect" && plan.missedPeriods > 0
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
          missed_periods: contract.missed_periods,
          next_due_at: contract.next_due_at,
          paid_periods: contract.paid_periods,
          status: contract.status,
          updated_at: collectedAt,
        })
        .eq("id", contract.id)
        .eq("paid_periods", plan.nextPaidPeriods)
        .eq("next_due_at", plan.completed ? contract.next_due_at : plan.nextDueAt)
        .eq("status", plan.completed ? "completed" : "active");

      if (rollbackContractError) {
        console.error("Debt contract contract rollback failed", rollbackContractError);
      }

      return jsonError("Debt payment coin logging failed.", 500);
    }

    if (body.action === "pay") {
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
              paidPeriods: plan.nextPaidPeriods,
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
              missed_periods: contract.missed_periods,
              next_due_at: contract.next_due_at,
              paid_periods: contract.paid_periods,
              status: contract.status,
              updated_at: collectedAt,
            })
            .eq("id", contract.id)
            .eq("paid_periods", plan.nextPaidPeriods)
            .eq("next_due_at", plan.completed ? contract.next_due_at : plan.nextDueAt)
            .eq("status", plan.completed ? "completed" : "active");

          if (rollbackContractError) {
            console.error("Debt contract contract rollback after task failure failed", rollbackContractError);
          }

          return jsonError("Debt contract task logging failed.", 500);
        }
      }
    }

    return Response.json({
      contract: plan.completed ? null : updatedContract,
      plan,
      profile: updatedProfile,
    });
  }

  return jsonError("Unsupported debt contract action.");
}
