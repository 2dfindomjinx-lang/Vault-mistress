export const JACKPOT_BASE_POOL = 2500;
export const JACKPOT_MIN_CONTRIBUTION = 500;
export const JACKPOT_CYCLE_DAYS = 3;
export const JACKPOT_CONTRIBUTION_DAYS = 2;
export const JACKPOT_DAY_MS = 24 * 60 * 60 * 1000;

export type LoyaltyJackpotPhase = "contribution" | "winner" | "preparing";

export type LoyaltyJackpotContributor = {
  username: string;
  rawUsername?: string;
  displayName?: string | null;
  display_name?: string | null;
  amount: number;
  createdAt: string;
  usernameStyle?: {
    color?: string;
    textShadow?: string;
  };
};

export type LoyaltyJackpotWinner = {
  username: string;
  rawUsername?: string;
  displayName?: string | null;
  display_name?: string | null;
  amount: number;
  selectedAt: string;
  place?: 1 | 2 | 3;
  usernameStyle?: {
    color?: string;
    textShadow?: string;
  };
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
  currentWinners: LoyaltyJackpotWinner[];
  currentWinner: LoyaltyJackpotWinner | null;
  previousWinners: LoyaltyJackpotWinner[];
  previousWinner: LoyaltyJackpotWinner | null;
};

export function getJackpotCycle(now = new Date()) {
  const epoch = Date.UTC(2025, 11, 31, 21, 0, 0, 0);
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
