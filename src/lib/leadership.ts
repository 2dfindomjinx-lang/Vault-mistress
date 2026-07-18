import type { AddressTerm } from "@/lib/address-term";

export const LEADERSHIP_RANKS = [
  { min: 0, title: "Worthless Worm" },
  { min: 1000, title: "Useless Loser" },
  { min: 2500, title: "Broke Beta" },
  { min: 5000, title: "Desperate Drainer" },
  { min: 7500, title: "Pathetic Paypig" },
  { min: 10000, title: "Elite Pet" },
  { min: 12000, title: "Principessa's Property" },
] as const;

export type LeadershipEntry = {
  username: string;
  rawUsername?: string;
  displayName?: string | null;
  display_name?: string | null;
  tributeTotal: number;
  rankTitle: string;
  addressTerm: AddressTerm;
  usernameStyle?: {
    color?: string;
    textShadow?: string;
  };
};

export type ShameEntry = {
  username: string;
  rawUsername?: string;
  displayName?: string | null;
  display_name?: string | null;
  shameCount: number;
  usernameStyle?: {
    color?: string;
    textShadow?: string;
  };
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
