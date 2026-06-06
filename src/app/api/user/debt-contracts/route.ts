import { profileSelect } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

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
  id: string;
  tribute_total: number;
};

type Body =
  | {
      action?: "sign";
      debtAmount?: number;
      durationPeriods?: number;
      periodType?: "weekly" | "monthly";
      petName?: string;
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
    const cleanAmount = Math.floor(Number(body.debtAmount));
    const cleanDuration = Math.floor(Number(body.durationPeriods));
    const cleanPetName = String(body.petName ?? "").trim();
    const minimum = periodType === "weekly" ? 10000 : 50000;
    const amountStep = periodType === "weekly" ? 5000 : 10000;
    const durationLimit = periodType === "weekly" ? { max: 52, min: 1 } : { max: 24, min: 1 };

    if (periodType !== "weekly" && periodType !== "monthly") {
      return jsonError("Invalid debt period type.");
    }

    if (cleanPetName.length < 2) {
      return jsonError("Invalid Pet name.");
    }

    if (!Number.isInteger(cleanAmount) || cleanAmount < minimum || cleanAmount % amountStep !== 0) {
      return jsonError("Invalid debt amount.", 422);
    }

    if (!Number.isInteger(cleanDuration) || cleanDuration < durationLimit.min || cleanDuration > durationLimit.max) {
      return jsonError("Invalid debt duration.", 422);
    }

    const { data: existingContract, error: existingError } = await supabase
      .from("pet_debt_contracts")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return jsonError(existingError.message, 500);
    }

    if (existingContract) {
      return jsonError("An active debt contract already exists.", 409);
    }

    const nowMs = Date.now();
    const periodMs = getDebtPeriodMs(periodType);
    const { data, error } = await supabase
      .from("pet_debt_contracts")
      .insert({
        debt_amount: cleanAmount,
        duration_periods: cleanDuration,
        ends_at: new Date(nowMs + periodMs * cleanDuration).toISOString(),
        next_due_at: new Date(nowMs).toISOString(),
        period_type: periodType,
        pet_name: cleanPetName,
        status: "active",
        user_id: userId,
      })
      .select("*")
      .single();

    if (error || !data) {
      return jsonError(error?.message ?? "Debt contract creation failed.", 500);
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
      .select("*")
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
      .select("id, coins, tribute_total")
      .eq("id", userId)
      .single();

    if (profileError || !profileData) {
      return jsonError(profileError?.message ?? "Profile not found.", 404);
    }

    const profile = profileData as ProfileRow;
    const collectedAt = new Date().toISOString();
    const nextCoins = profile.coins - plan.amount;
    const nextTributeTotal = (profile.tribute_total ?? 0) + plan.amount;

    const { data: updatedProfile, error: updateProfileError } = await supabase
      .from("profiles")
      .update({
        coins: nextCoins,
        tribute_total: nextTributeTotal,
        updated_at: collectedAt,
      })
      .eq("id", userId)
      .eq("coins", profile.coins)
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
      .select("*")
      .maybeSingle();

    if (updateContractError || !updatedContract) {
      return jsonError(updateContractError?.message ?? "Debt contract update was stale or duplicated.", updateContractError ? 500 : 409);
    }

    const { error: transactionError } = await supabase.from("coin_transactions").insert({
      amount: nextCoins - profile.coins,
      balance_after: nextCoins,
      balance_before: profile.coins,
      metadata: {
        autoCollected: body.action === "autoCollect",
        contractId: contract.id,
        duePeriods: plan.duePeriods,
        missedPeriods: plan.missedPeriods,
        spendAmount: plan.amount,
        tributeTotalChanged: true,
      },
      reason: body.action === "autoCollect" && plan.missedPeriods > 0
        ? "tribute:debt-contract:missed"
        : body.action === "autoCollect"
          ? "tribute:debt-contract:auto"
          : "tribute:debt-contract",
      user_id: userId,
    });

    if (transactionError) {
      console.error("Debt contract transaction insert failed", transactionError);
    }

    if (body.action === "pay") {
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
