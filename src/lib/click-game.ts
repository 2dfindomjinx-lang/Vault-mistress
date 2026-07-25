export const CLICK_GAME_COST_PER_CLICK = 10;
export const CLICK_GAME_IDLE_GRACE_MS = 5_000;
export const CLICK_GAME_DECAY_INTERVAL_MS = 250;
export const CLICK_GAME_DECAY_PER_TICK = 1;
export const CLICK_GAME_DAILY_REDUCTION = 150;

// 10 ascending thresholds. Reaching stage 10 from scratch costs 20,000 net
// clicks (200,000 coins) minimum even with zero decay - idle-drain and the
// daily reduction push the real total well above that for anyone who isn't
// consistently attentive.
export const CLICK_GAME_THRESHOLDS = [50, 150, 350, 700, 1300, 2300, 4000, 7000, 12000, 20000] as const;

export const CLICK_GAME_CHAMPION_TITLE_ID = "click-game-weekly-champion";
export const CLICK_GAME_IMAGE_DIR = "/click-game"; // stage-1.webp … stage-10.webp

export const CLICK_GAME_CLICK_RATE_LIMIT_MAX = 5;
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

export function getClickGameStageImagePath(stage: number): string | null {
  if (stage <= 0) {
    return null;
  }
  return `${CLICK_GAME_IMAGE_DIR}/stage-${stage}.webp`;
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
  if (!isActive || lastClickAtMs === null) {
    return Math.max(0, progress);
  }

  const decayStart = Math.max(lastClickAtMs + Math.max(idleGraceMs, 0), lastSettledAtMs);
  if (nowMs <= decayStart) {
    return Math.max(0, progress);
  }

  const ticks = Math.floor((nowMs - decayStart) / Math.max(decayIntervalMs, 1));
  return Math.max(0, progress - ticks * Math.max(decayPerTick, 0));
}

export type ClickGameStatus = {
  progress: number;
  stage: number;
  stageImagePath: string | null;
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
    stageImagePath: getClickGameStageImagePath(stage),
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
