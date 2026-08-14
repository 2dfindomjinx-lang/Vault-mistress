export const PET_THRONE_TASK_ID = "pet-throne-tribute";

export const PET_THRONE_AMOUNTS = [1, 5, 10, 15, 25, 50, 75, 100, 250, 500] as const;

export const PET_THRONE_URL =
  process.env.NEXT_PUBLIC_PET_THRONE_URL?.trim() || "https://throne.com/principessa2dfd";

// Pet Score recorded on the Throne tribute task row. A paid tribute is worth
// more than a free daily task, but the old flat 250 was 25x the daily reward
// and bore no relation to what was actually sent. Base plus a tenth of the
// dollar figure, rounded up so a $5 tribute still clears the base.
//
// Mirrored in supabase/throne-webhook-money.sql, which is what actually writes
// the row - keep the two in step.
export const PET_THRONE_TASK_SCORE_BASE = 10;
export const PET_THRONE_TASK_SCORE_PERCENT = 0.1;

export function getPetThroneTaskScore(amountUsd: number) {
  const amount = Math.max(0, Number(amountUsd) || 0);
  return Math.ceil(PET_THRONE_TASK_SCORE_BASE + amount * PET_THRONE_TASK_SCORE_PERCENT);
}

export function getPetThroneBaseCoinAmount(amount: number) {
  return Math.max(0, Math.round(amount * 1000));
}

export function getPetThroneGiveBonusPercent(baseCoinAmount: number) {
  if (baseCoinAmount >= 100000) {
    return 0.25;
  }

  if (baseCoinAmount >= 50000) {
    return 0.2;
  }

  if (baseCoinAmount >= 20000) {
    return 0.15;
  }

  if (baseCoinAmount >= 10000) {
    return 0.1;
  }

  return 0;
}

/**
 * The Throne (pet) bonus. Restored from the pre-Money formula, where it was
 * `taskBonusAmount = floor(base * 0.25)` stacked on top of the base coin
 * amount - a flat 25%, unchanged since the very first version of this file
 * (`Math.round(amount * 125) / 100`).
 *
 * The OTHER bonus that used to stack here - the tiered /give ladder
 * (10/15/20/25% by size) - did not come back. It lives on the PM -> Coin
 * conversion now (getMoneyConversionBonusPercent in src/lib/principessa-money.ts)
 * and paying it at both ends would double it.
 */
export const PET_THRONE_TASK_BONUS_PERCENT = 0.25;

/**
 * Principessa Money for a Throne tribute.
 *
 * Non-pet: 1 USD = 1 PM, floored - the published rate, unchanged.
 * Pet: base + 25%, then rounded UP to a whole PM. Rounding up rather than
 * flooring is deliberate: PM is an integer currency, and a bonus that gets
 * floored away ($1 -> 1.25 -> 1) would read as no bonus at all on exactly the
 * small tributes where the gesture matters most.
 */
export function getPetThroneMoneyAmount(amount: number, isPetBonus = false) {
  const safeAmount = Math.max(0, Number(amount) || 0);
  if (!isPetBonus) return Math.floor(safeAmount);
  return Math.ceil(safeAmount * (1 + PET_THRONE_TASK_BONUS_PERCENT));
}

export function getPetThroneRewardBreakdown(amount: number, isPetBonus = false) {
  // Coin figures are still reported for the ledger, the milestone-title
  // thresholds and the admin logs, all of which are coin-denominated
  // historically. The bonus is paid in Money, so the coin equivalent stays at
  // base: tribute_total should reflect what was actually paid, not the reward.
  const baseCoinAmount = getPetThroneBaseCoinAmount(amount);
  const moneyAmount = getPetThroneMoneyAmount(amount, isPetBonus);
  const baseMoneyAmount = getPetThroneMoneyAmount(amount, false);

  return {
    baseCoinAmount,
    giveBonusAmount: 0,
    giveBonusPercent: 0,
    moneyAmount,
    // What the pet actually gained over the plain flow, rounding included.
    moneyBonusAmount: Math.max(0, moneyAmount - baseMoneyAmount),
    taskBonusAmount: 0,
    taskBonusPercent: isPetBonus ? PET_THRONE_TASK_BONUS_PERCENT : 0,
    totalCoinAmount: baseCoinAmount,
  };
}

export function getPetThroneReceiveAmount(amount: number, isPetBonus = false) {
  return getPetThroneMoneyAmount(amount, isPetBonus);
}

export function formatPetThroneAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
