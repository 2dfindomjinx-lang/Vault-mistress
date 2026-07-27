export const CLICK_GAME_COST_PER_CLICK = 1;
export const CLICK_GAME_IDLE_GRACE_MS = 5_000;
export const CLICK_GAME_DECAY_INTERVAL_MS = 250;
export const CLICK_GAME_DECAY_PER_TICK = 1;
export const CLICK_GAME_DAILY_REDUCTION = 150;

// 10 ascending thresholds. Reaching stage 10 from scratch costs 20,000 net
// clicks (20,000 coins) and therefore 20,000 coins minimum from zero. Each
// category tracks that progress independently.
export const CLICK_GAME_THRESHOLDS = [50, 150, 350, 700, 1300, 2300, 4000, 7000, 12000, 20000] as const;

export const CLICK_GAME_CHAMPION_TITLE_ID = "click-game-weekly-champion";
export const CLICK_GAME_IMAGE_DIR = "/click-game";

// Each category is its own /public/click-game/<id>/stage-1..10.webp folder.
// ("feet" is excluded - the folder only has one oddly-named file, not a real
// stage-1..10 set yet.)
export const CLICK_GAME_CATEGORIES = [
  { id: "classic", label: "Classic", extension: "webp" },
  { id: "censored", label: "Censored", extension: "webp" },
  { id: "pixel", label: "Pixel", extension: "webp" },
  { id: "huge_breasts", label: "Huge Breasts", extension: "webp" },
  { id: "huge_ass", label: "Huge Ass", extension: "webp" },
] as const;

export type ClickGameCategoryId = (typeof CLICK_GAME_CATEGORIES)[number]["id"];
export const DEFAULT_CLICK_GAME_CATEGORY: ClickGameCategoryId = "classic";
export const CLICK_GAME_CATEGORY_STORAGE_KEY = "click-game-category";

export function isClickGameCategoryId(value: unknown): value is ClickGameCategoryId {
  return CLICK_GAME_CATEGORIES.some((category) => category.id === value);
}

// Batching: rapid taps are accumulated client-side and flushed as one
// request instead of firing a network call per tap. The flush is debounced -
// it fires CLICK_GAME_BATCH_DEBOUNCE_MS after the user stops tapping, not on
// a fixed interval during continuous spam - so a single request covers a
// whole burst. BUT a pure idle-debounce only batches taps that land closer
// together than CLICK_GAME_BATCH_DEBOUNCE_MS apart - a normal person clicking
// at a steady, deliberate pace (e.g. every 200-400ms) never goes quiet long
// enough to trigger it, so every tap would flush on its own and defeat
// batching entirely. CLICK_GAME_BATCH_MAX_WAIT_MS bounds that: once a batch
// has been open this long, it flushes regardless of whether taps are still
// arriving, so sustained-but-not-frantic clicking still gets grouped.
// CLICK_GAME_BATCH_FORCE_FLUSH_SIZE is a separate safety net for genuinely
// fast spam, so a session isn't silently building an unbounded unsent batch.
export const CLICK_GAME_BATCH_DEBOUNCE_MS = 250;
export const CLICK_GAME_BATCH_MAX_WAIT_MS = 600;
export const CLICK_GAME_BATCH_FORCE_FLUSH_SIZE = 40;
export const CLICK_GAME_BATCH_MAX_CLICKS = 300;

export const CLICK_GAME_CLICK_RATE_LIMIT_MAX = 8;
export const CLICK_GAME_CLICK_RATE_LIMIT_WINDOW_SECONDS = 1;
export const CLICK_GAME_TOGGLE_RATE_LIMIT_MAX = 5;
export const CLICK_GAME_TOGGLE_RATE_LIMIT_WINDOW_SECONDS = 10;

export function getClickGameStage(progress: number, thresholds: readonly number[] = CLICK_GAME_THRESHOLDS): number {
  let stage = 0;
  for (const threshold of thresholds) {
    if (progress >= threshold) {
      stage += 1;
    } else {
      break;
    }
  }
  return stage;
}

export function getClickGameStageImagePath(
  stage: number,
  categoryId: ClickGameCategoryId = DEFAULT_CLICK_GAME_CATEGORY,
): string | null {
  if (stage <= 0) {
    return null;
  }
  const category = CLICK_GAME_CATEGORIES.find((entry) => entry.id === categoryId) ?? CLICK_GAME_CATEGORIES[0];
  return `${CLICK_GAME_IMAGE_DIR}/${category.id}/stage-${stage}.${category.extension}`;
}

export function getClickGameNextThreshold(progress: number, thresholds: readonly number[] = CLICK_GAME_THRESHOLDS): number | null {
  return thresholds.find((threshold) => threshold > progress) ?? null;
}

/**
 * Pure mirror of the SQL settle formula in supabase/click-game.sql
 * (click_game_settle_decay) - used ONLY for client-side visual prediction of
 * the decay countdown between server round-trips. The server response is
 * always the source of truth that this gets reconciled against.
 */
export function computeIdleDecay(
  progress: number,
  isActive: boolean,
  lastClickAtMs: number | null,
  lastSettledAtMs: number,
  nowMs: number,
  idleGraceMs: number = CLICK_GAME_IDLE_GRACE_MS,
  decayIntervalMs: number = CLICK_GAME_DECAY_INTERVAL_MS,
  decayPerTick: number = CLICK_GAME_DECAY_PER_TICK,
): number {
  // Compatibility helper retained for older callers. Decay is disabled;
  // progress changes only through accepted clicks or an explicit reset.
  return Math.max(0, progress);
}

export type ClickGameStatus = {
  progress: number;
  stage: number;
  isActive: boolean;
  lastClickAt: string | null;
  weeklyClicks: number;
  lifetimeClicks: number;
  costPerClick: number;
  thresholds: readonly number[];
  nextThreshold: number | null;
  serverNowIso: string;
};

export type ClickGameLeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  weeklyClicks: number;
};

export type ClickGameWinHistoryEntry = {
  userId: string;
  username: string;
  displayName: string | null;
  winCount: number;
  lastWonWeekStart: string;
};

export function buildClickGameStatus(raw: {
  progress: number;
  isActive: boolean;
  lastClickAt: string | null;
  weeklyClicks: number;
  lifetimeClicks: number;
  serverNowIso: string;
}): ClickGameStatus {
  const progress = Math.max(0, Math.floor(raw.progress));
  const stage = getClickGameStage(progress);

  return {
    progress,
    stage,
    isActive: raw.isActive,
    lastClickAt: raw.lastClickAt,
    weeklyClicks: Math.max(0, Math.floor(raw.weeklyClicks)),
    lifetimeClicks: Math.max(0, Math.floor(raw.lifetimeClicks)),
    costPerClick: CLICK_GAME_COST_PER_CLICK,
    thresholds: CLICK_GAME_THRESHOLDS,
    nextThreshold: getClickGameNextThreshold(progress),
    serverNowIso: raw.serverNowIso,
  };
}
