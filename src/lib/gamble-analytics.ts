import type { GambleGameId } from "./gamble";

export type GambleMetrics = {
  rounds: number;
  players: number;
  wagered: number;
  settledRounds: number;
  openRounds: number;
  settledWager: number;
  payout: number;
  profitableRounds: number;
  doubleWins: number;
  doubleLosses: number;
};

export type GambleAnalytics = {
  summary: GambleMetrics;
  games: Array<GambleMetrics & { game: GambleGameId }>;
  byDay: Array<GambleMetrics & { day: string }>;
};

export const GAMBLE_LABELS: Record<GambleGameId, string> = {
  slots: "Her Reels",
  dice: "Her Dice",
  roulette: "Court Roulette",
  plinko: "Royal Plinko",
  mines: "The Jewelry Box",
  crash: "Her Patience",
  crawl: "The Crawl",
};

export function gambleHouseNet(metrics: GambleMetrics) {
  return metrics.settledWager - metrics.payout;
}

export function gambleObservedRtp(metrics: GambleMetrics) {
  return metrics.settledWager > 0
    ? (metrics.payout / metrics.settledWager) * 100
    : null;
}
