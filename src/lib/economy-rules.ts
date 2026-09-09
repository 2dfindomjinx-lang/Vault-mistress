// Shared product rules; the server calculates every reward again.
export const COIN_TRIBUTE_AFFECTION: Readonly<Record<number, number>> = {
  250: 1,
  1000: 5,
  5000: 30,
};
export function getCoinTributeAffection(amount: number, multiplier = 1) {
  const base = COIN_TRIBUTE_AFFECTION[amount];
  if (base === undefined) return null;
  return Math.max(
    base,
    Math.ceil(
      base * (Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1),
    ),
  );
}
export const DEDICATED_TASK_IDS = new Set([
  "high-low",
  "number-pick",
  "case-opening",
  "timeout-risk",
  "vertical-motion",
  "principessa-says",
  "crown-match",
  "royal-guard",
]);
export const GENERIC_CLAIM_TASK_IDS = new Set([
  "daily-login",
  "typing-accuracy",
  "affection",
  "affection-80",
  "streak-bonus-1",
  "streak-bonus-3",
  "streak-bonus-7",
  "streak-bonus-15",
  "streak-bonus-30",
]);
