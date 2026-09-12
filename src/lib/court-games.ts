export const CROWN_MATCH_MAX_MISTAKES = 5;
export const CROWN_MATCH_PAIR_COUNT = 9;
export const CROWN_MATCH_PREVIEW_MS = 3_000;
export const CROWN_MATCH_FLIP_MS = 320;
export const COURT_GAME_IDS = [
  "principessa-says",
  "crown-match",
  "royal-guard",
] as const;

export type CourtGameId = (typeof COURT_GAME_IDS)[number];

export type CourtGameMetrics = {
  actions?: Array<{action:string;atMs:number}>;
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
    requiredRounds: CROWN_MATCH_PAIR_COUNT,
    requiredScore: CROWN_MATCH_PAIR_COUNT,
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
