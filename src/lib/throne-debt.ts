export const THRONE_DEBT_FREQUENCIES = ["weekly", "bi_weekly", "monthly"] as const;
export const THRONE_DEBT_LENGTH_OPTIONS = [4, 8, 12, 24] as const;
export const THRONE_DEBT_MIN_WEEKLY_USD = 10;
export const THRONE_DEBT_TIMEOUT_REASON_PREFIX = "throne_debt_timeout:";
export const THRONE_DEBT_TIMEOUT_REDEMPTION_MULTIPLIER = 1.3;

export type ThroneDebtFrequency = (typeof THRONE_DEBT_FREQUENCIES)[number];

export type ThroneDebtStatus =
  | "pending_review"
  | "active"
  | "overdue"
  | "timeout"
  | "redeemed"
  | "rejected"
  | "completed"
  | "cancelled"
  | "defaulted"
  | "paused";

export type ThroneDebtInstallmentStatus =
  | "pending"
  | "submitted_for_review"
  | "approved_paid"
  | "rejected"
  | "missed"
  | "overdue"
  | "timeout_redemption_required";

export type ThroneDebtPaymentReviewStatus = "pending" | "approved" | "rejected";

export type ThroneDebtInstallment = {
  amount_usd: number;
  created_at: string;
  debt_id: string;
  due_date: string;
  id: string;
  installment_number: number;
  paid_at: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by_admin_id: string | null;
  status: ThroneDebtInstallmentStatus;
  submitted_note?: string | null;
  submitted_throne_link?: string | null;
  updated_at?: string | null;
};

export type ThroneDebtPaymentReview = {
  admin_note: string | null;
  created_at: string;
  debt_id: string;
  id: string;
  installment_id: string;
  reviewed_at: string | null;
  reviewed_by_admin_id: string | null;
  screenshot_url: string | null;
  status: ThroneDebtPaymentReviewStatus;
  throne_order_link: string;
  updated_at: string | null;
  user_id: string;
  user_note: string | null;
};

export type ThroneDebtContract = {
  admin_note: string | null;
  approved_at: string | null;
  approved_by_admin_id: string | null;
  contract_length_weeks: number;
  created_at: string;
  id: string;
  installment_amount_usd: number;
  installment_count: number;
  installments?: ThroneDebtInstallment[];
  payment_reviews?: ThroneDebtPaymentReview[];
  rejected_at: string | null;
  rejected_by_admin_id: string | null;
  repayment_frequency: ThroneDebtFrequency;
  status: ThroneDebtStatus;
  timeout_applied_at?: string | null;
  timeout_applied_by_admin_id?: string | null;
  timeout_lift_note?: string | null;
  timeout_lifted_at?: string | null;
  timeout_lifted_by_admin_id?: string | null;
  timeout_overdue_amount_usd?: number | null;
  timeout_reason?: string | null;
  timeout_redemption_amount_usd?: number | null;
  timeout_redemption_multiplier?: number | null;
  total_amount_usd: number;
  updated_at: string | null;
  user_id: string;
  user_note: string | null;
  username?: string;
};

export function normalizeThroneDebtFrequency(value: unknown): ThroneDebtFrequency | null {
  return THRONE_DEBT_FREQUENCIES.includes(value as ThroneDebtFrequency)
    ? value as ThroneDebtFrequency
    : null;
}

export function getThroneDebtTimeoutReason(contractId: string) {
  return `${THRONE_DEBT_TIMEOUT_REASON_PREFIX}${contractId}`;
}

export function isThroneDebtTimeoutReason(reason: string | null | undefined) {
  return typeof reason === "string" && reason.startsWith(THRONE_DEBT_TIMEOUT_REASON_PREFIX);
}

export function calculateThroneDebtRedemptionAmount(overdueAmountUsd: number) {
  return Math.round(Number(overdueAmountUsd) * THRONE_DEBT_TIMEOUT_REDEMPTION_MULTIPLIER * 100) / 100;
}

export function getThroneDebtFrequencyWeeks(frequency: ThroneDebtFrequency) {
  if (frequency === "weekly") {
    return 1;
  }

  if (frequency === "bi_weekly") {
    return 2;
  }

  return 4;
}

export function getThroneDebtMinimumInstallmentUsd(frequency: ThroneDebtFrequency) {
  return THRONE_DEBT_MIN_WEEKLY_USD * getThroneDebtFrequencyWeeks(frequency);
}

export function getThroneDebtInstallmentCount(
  frequency: ThroneDebtFrequency,
  contractLengthWeeks: number,
) {
  const frequencyWeeks = getThroneDebtFrequencyWeeks(frequency);
  return Math.max(1, Math.ceil(contractLengthWeeks / frequencyWeeks));
}

export function calculateThroneDebtPlan(input: {
  contractLengthWeeks: number;
  repaymentFrequency: ThroneDebtFrequency;
  totalAmountUsd: number;
}) {
  const contractLengthWeeks = Math.floor(Number(input.contractLengthWeeks));
  const totalAmountUsd = Math.round(Number(input.totalAmountUsd) * 100) / 100;
  const installmentCount = getThroneDebtInstallmentCount(input.repaymentFrequency, contractLengthWeeks);
  const installmentAmountUsd = Math.round((totalAmountUsd / installmentCount) * 100) / 100;
  const minimumInstallmentUsd = getThroneDebtMinimumInstallmentUsd(input.repaymentFrequency);
  const minimumTotalUsd = minimumInstallmentUsd * installmentCount;

  return {
    contractLengthWeeks,
    installmentAmountUsd,
    installmentCount,
    minimumInstallmentUsd,
    minimumTotalUsd,
    totalAmountUsd,
  };
}

export function validateThroneDebtRequest(input: {
  contractLengthWeeks: number;
  repaymentFrequency: ThroneDebtFrequency | null;
  totalAmountUsd: number;
}) {
  if (!input.repaymentFrequency) {
    return { error: "Invalid repayment frequency.", plan: null };
  }

  if (!Number.isFinite(input.totalAmountUsd) || input.totalAmountUsd <= 0) {
    return { error: "Total amount must be greater than 0.", plan: null };
  }

  if (!Number.isInteger(input.contractLengthWeeks) || input.contractLengthWeeks < 4 || input.contractLengthWeeks > 104) {
    return { error: "Contract length must be between 4 and 104 weeks.", plan: null };
  }

  const plan = calculateThroneDebtPlan({
    contractLengthWeeks: input.contractLengthWeeks,
    repaymentFrequency: input.repaymentFrequency,
    totalAmountUsd: input.totalAmountUsd,
  });

  if (plan.installmentAmountUsd < plan.minimumInstallmentUsd) {
    return {
      error: `Minimum installment is $${plan.minimumInstallmentUsd.toFixed(2)} for this frequency.`,
      plan,
    };
  }

  return { error: null, plan };
}

export function getThroneDebtDueDateIso(
  approvedAt: Date,
  frequency: ThroneDebtFrequency,
  installmentNumber: number,
) {
  const weeks = getThroneDebtFrequencyWeeks(frequency) * installmentNumber;
  const dueDate = new Date(approvedAt);
  dueDate.setUTCDate(dueDate.getUTCDate() + weeks * 7);
  return dueDate.toISOString();
}

export function getThroneDebtPaidTotal(contract: Pick<ThroneDebtContract, "installments">) {
  return (contract.installments ?? [])
    .filter((installment) => installment.status === "approved_paid")
    .reduce((sum, installment) => sum + Number(installment.amount_usd ?? 0), 0);
}
