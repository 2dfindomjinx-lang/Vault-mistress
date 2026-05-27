export const LEADERSHIP_RANKS = [
  { min: 0, title: "Worthless Worm" },
  { min: 100, title: "Useless Loser" },
  { min: 250, title: "Broke Beta" },
  { min: 500, title: "Desperate Drainer" },
  { min: 1500, title: "Pathetic Paypig" },
  { min: 2000, title: "Elite Pet" },
  { min: 3000, title: "Principessa’s Property" },
] as const;

export type LeadershipEntry = {
  username: string;
  tributeTotal: number;
  rankTitle: string;
};

export type ShameEntry = {
  username: string;
  shameCount: number;
};

export function getLeadershipRank(tributeTotal: number) {
  const currentRank =
    [...LEADERSHIP_RANKS]
      .reverse()
      .find((rank) => tributeTotal >= rank.min) ?? LEADERSHIP_RANKS[0];
  const nextRank = LEADERSHIP_RANKS.find((rank) => rank.min > tributeTotal) ?? null;
  const previousMin = currentRank.min;
  const nextMin = nextRank?.min ?? currentRank.min;
  const progress =
    nextRank === null
      ? 100
      : Math.min(
          100,
          Math.max(0, ((tributeTotal - previousMin) / (nextMin - previousMin)) * 100),
        );

  return {
    currentRank,
    nextRank,
    progress,
    remaining: nextRank ? Math.max(0, nextRank.min - tributeTotal) : 0,
  };
}
