export const COURT_GAME_IDS = [
  "principessa-says",
  "crown-match",
  "royal-guard",
] as const;

export type CourtGameId = (typeof COURT_GAME_IDS)[number];

export type CourtGameMetrics = {
  mistakes: number;
  roundsCompleted: number;
  score: number;
};

export const COURT_GAME_RULES: Record<
  CourtGameId,
  {
    minDurationMs: number;
    requiredRounds: number;
    requiredScore: number;
    reward: number;
    title: string;
  }
> = {
  "principessa-says": {
    minDurationMs: 7_000,
    requiredRounds: 8,
    requiredScore: 6,
    reward: 100,
    title: "Principessa Says",
  },
  "crown-match": {
    minDurationMs: 2_000,
    requiredRounds: 6,
    requiredScore: 6,
    reward: 100,
    title: "Crown Match",
  },
  "royal-guard": {
    minDurationMs: 9_000,
    requiredRounds: 18,
    requiredScore: 13,
    reward: 100,
    title: "Royal Guard",
  },
};

export function isCourtGameId(value: unknown): value is CourtGameId {
  return typeof value === "string" && COURT_GAME_IDS.includes(value as CourtGameId);
}
