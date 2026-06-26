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

export function getPetThroneRewardBreakdown(amount: number) {
  const baseCoinAmount = getPetThroneBaseCoinAmount(amount);
  const giveBonusPercent = getPetThroneGiveBonusPercent(baseCoinAmount);
  const giveBonusAmount = Math.floor(baseCoinAmount * giveBonusPercent);
  const taskBonusAmount = Math.floor(baseCoinAmount * 0.25);
  const totalCoinAmount = baseCoinAmount + giveBonusAmount + taskBonusAmount;

  return {
    baseCoinAmount,
    giveBonusAmount,
    giveBonusPercent,
    taskBonusAmount,
    totalCoinAmount,
  };
}

export function getPetThroneReceiveAmount(amount: number) {
  return getPetThroneRewardBreakdown(amount).totalCoinAmount;
}

export function formatPetThroneAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
