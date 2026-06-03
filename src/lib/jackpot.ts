export const JACKPOT_BASE_POOL = 5000;
export const JACKPOT_CYCLE_DAYS = 3;
export const JACKPOT_CONTRIBUTION_DAYS = 2;
export const JACKPOT_DAY_MS = 24 * 60 * 60 * 1000;

export type LoyaltyJackpotPhase = "contribution" | "winner" | "preparing";

export type LoyaltyJackpotContributor = {
  username: string;
  amount: number;
  createdAt: string;
};

export type LoyaltyJackpotWinner = {
  username: string;
  amount: number;
  selectedAt: string;
};

export type LoyaltyJackpotState = {
  id: string;
  cycleKey: string;
  phase: LoyaltyJackpotPhase;
  phaseEndsAt: string;
  startsAt: string;
  contributionEndsAt: string;
  endsAt: string;
  basePool: number;
  pool: number;
  eligibleCount: number;
  participantCount: number;
  userContributionTotal: number;
  userEligible: boolean;
  userProtected: boolean;
  recentContributors: LoyaltyJackpotContributor[];
  currentWinner: LoyaltyJackpotWinner | null;
  previousWinner: LoyaltyJackpotWinner | null;
};

export function getJackpotCycle(now = new Date()) {
  const epoch = Date.UTC(2026, 0, 1, 0, 0, 0, 0);
  const cycleMs = JACKPOT_CYCLE_DAYS * JACKPOT_DAY_MS;
  const nowMs = now.getTime();
  const cycleIndex = Math.max(0, Math.floor((nowMs - epoch) / cycleMs));
  const startsAtMs = epoch + cycleIndex * cycleMs;
  const contributionEndsAtMs = startsAtMs + JACKPOT_CONTRIBUTION_DAYS * JACKPOT_DAY_MS;
  const endsAtMs = startsAtMs + cycleMs;

  return {
    cycleKey: `jackpot-${cycleIndex}`,
    startsAt: new Date(startsAtMs).toISOString(),
    contributionEndsAt: new Date(contributionEndsAtMs).toISOString(),
    endsAt: new Date(endsAtMs).toISOString(),
    phase: nowMs < contributionEndsAtMs ? "contribution" : "winner",
  } as const;
}
