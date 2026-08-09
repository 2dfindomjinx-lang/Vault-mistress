export const PET_THRONE_TASK_ID = "pet-throne-tribute";

export const PET_THRONE_AMOUNTS = [1, 5, 10, 15, 25, 50, 75, 100, 250, 500] as const;

export const PET_THRONE_URL =
  process.env.NEXT_PUBLIC_PET_THRONE_URL?.trim() || "https://throne.com/principessa2dfd";

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
 * A Throne tribute now pays Principessa Money at a flat 1 USD = 1 PM. The
 * give/task bonuses that used to be stacked here moved onto the PM -> Coin
 * conversion (see getMoneyConversionBonusPercent in src/lib/principessa-money.ts)
 * so the payout rate stays exactly 1:1 and the published rate stays true.
 */
export function getPetThroneMoneyAmount(amount: number) {
  return Math.max(0, Math.floor(amount));
}

export function getPetThroneRewardBreakdown(amount: number) {
  // Still reported in coins for the ledger, the milestone-title thresholds and
  // the admin logs, all of which are coin-denominated historically. Bonuses are
  // zero now; the coin equivalent is what the money converts down to at base rate.
  const baseCoinAmount = getPetThroneBaseCoinAmount(amount);

  return {
    baseCoinAmount,
    giveBonusAmount: 0,
    giveBonusPercent: 0,
    moneyAmount: getPetThroneMoneyAmount(amount),
    taskBonusAmount: 0,
    totalCoinAmount: baseCoinAmount,
  };
}

export function getPetThroneReceiveAmount(amount: number) {
  return getPetThroneMoneyAmount(amount);
}

export function formatPetThroneAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
