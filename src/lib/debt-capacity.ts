import type { SupabaseClient } from "@supabase/supabase-js";

const DAY_MS = 24 * 60 * 60 * 1000;
const BALANCE_WEIGHT = 0.75;
const INCOME_WEIGHT = 0.3;
const PURCHASE_PLEDGE_MULTIPLIER = 1.25;
const EXCLUDED_INFLOW_REASONS = new Set([
  "admin_commission",
  "admin_debt_refund",
  "give_bonus",
]);

type DebtPeriodType = "monthly" | "weekly";

type CoinTransactionRow = {
  amount: number;
  created_at: string;
  reason: string | null;
};

export type DebtCapacitySnapshot = {
  balanceCoins: number;
  balanceComponent: number;
  baseTotalLimit: number;
  checkedAt: string;
  durationPeriods: number;
  incomeComponent: number;
  periodType: DebtPeriodType;
  purchasePledge: boolean;
  purchasePledgeBoost: number;
  reliablePeriodIncome: number;
  totalLimit: number;
  transactionWindowDays: number;
};

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Math.floor(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
  }

  return Math.floor(sorted[middle] ?? 0);
}

function isReliableInflow(transaction: CoinTransactionRow) {
  const amount = Math.floor(Number(transaction.amount ?? 0));
  const reason = String(transaction.reason ?? "").trim();

  if (amount <= 0 || EXCLUDED_INFLOW_REASONS.has(reason)) {
    return false;
  }

  return !reason.includes("refund") && !reason.includes("rollback");
}

export async function calculateDebtCapacity(
  supabase: SupabaseClient,
  input: {
    durationPeriods: number;
    periodType: DebtPeriodType;
    purchasePledge: boolean;
    userId: string;
  },
): Promise<DebtCapacitySnapshot> {
  const durationPeriods = Math.max(1, Math.floor(Number(input.durationPeriods)));
  const bucketDays = input.periodType === "weekly" ? 7 : 30;
  const bucketCount = input.periodType === "weekly" ? 8 : 3;
  const transactionWindowDays = bucketDays * bucketCount;
  const checkedAt = new Date();
  const windowStart = new Date(checkedAt.getTime() - transactionWindowDays * DAY_MS).toISOString();

  const [profileResult, transactionsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("coins")
      .eq("id", input.userId)
      .single(),
    supabase
      .from("coin_transactions")
      .select("amount, created_at, reason")
      .eq("user_id", input.userId)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false }),
  ]);

  if (profileResult.error || !profileResult.data) {
    throw profileResult.error ?? new Error("Debt capacity profile not found.");
  }

  if (transactionsResult.error) {
    throw transactionsResult.error;
  }

  const balanceCoins = Math.max(0, Math.floor(Number(profileResult.data.coins ?? 0)));
  const periodInflows = Array.from({ length: bucketCount }, () => 0);

  for (const transaction of (transactionsResult.data ?? []) as CoinTransactionRow[]) {
    if (!isReliableInflow(transaction)) {
      continue;
    }

    const createdAtMs = new Date(transaction.created_at).getTime();
    const ageDays = (checkedAt.getTime() - createdAtMs) / DAY_MS;
    const bucketIndex = Math.floor(ageDays / bucketDays);

    if (bucketIndex >= 0 && bucketIndex < periodInflows.length) {
      periodInflows[bucketIndex] += Math.floor(Number(transaction.amount ?? 0));
    }
  }

  const reliablePeriodIncome = median(periodInflows);
  const balanceComponent = Math.floor(balanceCoins * BALANCE_WEIGHT);
  const incomeComponent = Math.floor(reliablePeriodIncome * durationPeriods * INCOME_WEIGHT);
  const baseTotalLimit = Math.max(0, balanceComponent + incomeComponent);
  const totalLimit = input.purchasePledge
    ? Math.floor(baseTotalLimit * PURCHASE_PLEDGE_MULTIPLIER)
    : baseTotalLimit;

  return {
    balanceCoins,
    balanceComponent,
    baseTotalLimit,
    checkedAt: checkedAt.toISOString(),
    durationPeriods,
    incomeComponent,
    periodType: input.periodType,
    purchasePledge: input.purchasePledge,
    purchasePledgeBoost: totalLimit - baseTotalLimit,
    reliablePeriodIncome,
    totalLimit,
    transactionWindowDays,
  };
}

