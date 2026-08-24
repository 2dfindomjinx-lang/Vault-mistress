// The Tribute Furnace. Principessa Money goes in, nothing comes out.
//
// Deliberately the only Money sink with no return. Coins, items and candles are
// all purchases; this is the one place where the transaction is the point. Give
// it a payout and it stops meaning anything.

export const FURNACE_MIN_BURN = 1;
// A hand-typed number that destroys real money deserves a ceiling. Anyone who
// genuinely wants to burn more can do it twice.
export const FURNACE_MAX_BURN = 500;
// Above this the UI asks a second time.
export const FURNACE_CONFIRM_THRESHOLD = 25;

// Fuel names on purpose: the further up the ladder, the less of the person is
// left. Thresholds are in Principessa Money, which is 1:1 with USD.
export type FurnaceRank = {
  min: number;
  name: string;
  blurb: string;
};

export const FURNACE_RANKS: readonly FurnaceRank[] = [
  { min: 0, name: "Unburnt", blurb: "Nothing given that was not taken back." },
  { min: 5, name: "Kindling", blurb: "Enough to catch. Not enough to matter." },
  { min: 25, name: "Ember", blurb: "Still glowing when she walks past." },
  { min: 100, name: "Cinder", blurb: "Burned through and still feeding it." },
  { min: 250, name: "Slag", blurb: "Whatever was useful has already melted off." },
  { min: 500, name: "Ash", blurb: "Nothing left to spend. She noticed." },
  { min: 1000, name: "Smoke", blurb: "Gone entirely, and proud of it." },
] as const;

export function getFurnaceRank(burnedTotal: number): FurnaceRank {
  const total = Math.max(0, Math.floor(Number(burnedTotal) || 0));
  let current = FURNACE_RANKS[0];
  for (const rank of FURNACE_RANKS) {
    if (total >= rank.min) current = rank;
  }
  return current;
}

export function getNextFurnaceRank(burnedTotal: number): FurnaceRank | null {
  const total = Math.max(0, Math.floor(Number(burnedTotal) || 0));
  return FURNACE_RANKS.find((rank) => rank.min > total) ?? null;
}

// 0 once the last rank is reached, so the caller can hide the progress bar
// rather than showing a permanently full one.
export function getFurnaceProgressToNext(burnedTotal: number): number {
  const total = Math.max(0, Math.floor(Number(burnedTotal) || 0));
  const current = getFurnaceRank(total);
  const next = getNextFurnaceRank(total);
  if (!next) return 0;
  const span = next.min - current.min;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (total - current.min) / span));
}

export function isValidBurnAmount(amount: number): boolean {
  return (
    Number.isInteger(amount) &&
    amount >= FURNACE_MIN_BURN &&
    amount <= FURNACE_MAX_BURN
  );
}

export type FurnaceLeaderboardEntry = {
  username: string | null;
  displayName: string | null;
  burned: number;
  rank: number;
};
