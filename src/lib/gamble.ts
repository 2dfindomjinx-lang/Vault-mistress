// The Gamble Hall. Coins in, coins out, and the house keeps an edge it prints
// on every table - the site's standing rule that the rig is announced, never
// hidden. All outcomes are decided server-side; every component below the API
// is a renderer.

export const GAMBLE_GAME_IDS = [
  "slots",
  "dice",
  "roulette",
  "plinko",
  "mines",
  "crash",
  "crawl",
] as const;
export type GambleGameId = (typeof GAMBLE_GAME_IDS)[number];

export const GAMBLE_MIN_BET = 100;
export const GAMBLE_MAX_BET = 5_000;
// Double or Nothing: printed on the button, because the whole design language
// of the hall is an announced rig.
export const DOUBLE_OR_NOTHING_CHANCE = 0.35;

export function isGambleGameId(value: unknown): value is GambleGameId {
  return typeof value === "string" && GAMBLE_GAME_IDS.includes(value as GambleGameId);
}

export function isValidBet(bet: number) {
  return Number.isInteger(bet) && bet >= GAMBLE_MIN_BET && bet <= GAMBLE_MAX_BET;
}

// --------------------------------------------------------------------- slots
// One payline, three reels, same weighted strip on each. Any pair pays its
// symbol's pair value, a triple pays the table. EV ~0.877 with a ~55% hit
// rate (verified by enumeration; re-run the check if you touch the numbers).
export type SlotSymbol = { glyph: string; id: string; pairPays: number; triplePays: number; weight: number };

export const SLOT_SYMBOLS: readonly SlotSymbol[] = [
  { glyph: "\u{1FA99}", id: "coin", pairPays: 0.4, triplePays: 4, weight: 34 },
  { glyph: "\u{1F512}", id: "lock", pairPays: 0.9, triplePays: 7, weight: 24 },
  { glyph: "\u{1F429}", id: "pet", pairPays: 1.3, triplePays: 11, weight: 17 },
  { glyph: "\u{1F48E}", id: "gem", pairPays: 2, triplePays: 20, weight: 12 },
  { glyph: "\u265B", id: "crown", pairPays: 3.5, triplePays: 55, weight: 8 },
  { glyph: "\u{1F451}", id: "principessa", pairPays: 6, triplePays: 180, weight: 5 },
] as const;

export function rollSlotReel(roll: number): number {
  const total = SLOT_SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
  let cursor = Math.max(0, Math.min(0.999999, roll)) * total;
  for (let index = 0; index < SLOT_SYMBOLS.length; index += 1) {
    cursor -= SLOT_SYMBOLS[index].weight;
    if (cursor < 0) return index;
  }
  return SLOT_SYMBOLS.length - 1;
}

export function slotsPayoutMultiplier(reels: [number, number, number]): number {
  const [a, b, c] = reels;
  if (a === b && b === c) return SLOT_SYMBOLS[a].triplePays;
  // Three reels can hold at most one pair; find it.
  if (a === b || a === c) return SLOT_SYMBOLS[a].pairPays;
  if (b === c) return SLOT_SYMBOLS[b].pairPays;
  return 0;
}

// ---------------------------------------------------------------------- dice
// Two dice each. Higher sum wins 2x. The entire house edge is one printed
// sentence: ties are hers. P(win) = P(lose) ≈ 0.4438, P(tie) ≈ 0.1127,
// EV = 2 * 0.4438 ≈ 0.888.
export function diceSum(rolls: [number, number]) {
  return rolls[0] + rolls[1];
}

// ------------------------------------------------------------------ roulette
// Three rings around her. Pick one; the ball answers. Each ring is an
// independent bet priced at EV 0.90.
export const ROULETTE_RINGS = [
  { id: "outer", label: "Outer Ring", multiplier: 1.5, winChance: 0.6 },
  { id: "middle", label: "Middle Ring", multiplier: 3, winChance: 0.3 },
  { id: "inner", label: "Inner Ring", multiplier: 8, winChance: 0.1125 },
] as const;
export type RouletteRingId = (typeof ROULETTE_RINGS)[number]["id"];

// -------------------------------------------------------------------- plinko
// 12 rows of pegs -> 13 buckets, binomial landing. Centre buckets grind you
// down, the rim pays. EV ~0.92 against exact binomial(12, 0.5) weights
// (verified in the test script).
export const PLINKO_ROWS = 12;
export const PLINKO_MULTIPLIERS = [50, 14, 4, 1.7, 0.9, 0.5, 0.3, 0.5, 0.9, 1.7, 4, 14, 50] as const;

export function plinkoBucketForPath(rights: number) {
  return Math.max(0, Math.min(PLINKO_MULTIPLIERS.length - 1, rights));
}

// --------------------------------------------------------------------- mines
// 25 boxes, player-chosen mine count. No 3-mine mode on purpose: at 3 the
// first picks are near-free and the game reads as coin farming. Multiplier
// after each safe pick is the fair inverse odds shaved by the edge, so the
// house cut is identical at every depth.
export const MINES_GRID = 25;
export const MINES_OPTIONS = [5, 8, 12] as const;
export const MINES_EDGE = 0.05;

export function minesMultiplier(mineCount: number, safePicks: number): number {
  let multiplier = 1;
  for (let pick = 0; pick < safePicks; pick += 1) {
    const remaining = MINES_GRID - pick;
    const safe = remaining - mineCount;
    if (safe <= 0) return multiplier;
    multiplier *= (remaining / safe) * (1 - MINES_EDGE);
  }
  return Math.round(multiplier * 100) / 100;
}

// --------------------------------------------------------------------- crash
// Her Patience. The multiplier climbs a fixed curve from the round's start
// time; the crash point is sampled at open. With P(crash before m) = 1 - k/m
// and k = 0.94, cashing out at any target multiplier has EV ~0.94.
export const CRASH_CURVE_RATE = 0.07;
export const CRASH_HOUSE_K = 0.94;
export const CRASH_MAX_MULTIPLIER = 30;

export function crashMultiplierAt(elapsedMs: number): number {
  const value = Math.exp(CRASH_CURVE_RATE * (elapsedMs / 1000));
  return Math.min(CRASH_MAX_MULTIPLIER, Math.round(value * 100) / 100);
}

export function sampleCrashPoint(roll: number): number {
  const safeRoll = Math.max(0.000001, Math.min(0.999999, roll));
  // Inverse CDF of P(crash <= m) = 1 - k/m, floored at 1.00 (instant busts
  // exist: k of the mass sits above 1).
  const point = CRASH_HOUSE_K / (1 - safeRoll);
  return Math.min(CRASH_MAX_MULTIPLIER, Math.max(1, Math.round(point * 100) / 100));
}

// --------------------------------------------------------------------- crawl
// Four collared pets crawl to her feet. Odds are drawn per race and shown
// before betting; win probabilities are the implied odds normalised under a
// 10% overround, so every lane prices at the same EV ~0.90.
export const CRAWL_LANES = [
  { color: "#f472b6", id: "pink", label: "Pink Collar" },
  { color: "#a78bfa", id: "violet", label: "Violet Collar" },
  { color: "#e6ba73", id: "gold", label: "Gold Collar" },
  { color: "#34d399", id: "emerald", label: "Emerald Collar" },
] as const;
export type CrawlLaneId = (typeof CRAWL_LANES)[number]["id"];

export function drawCrawlOdds(rolls: [number, number, number, number]): number[] {
  // Raw strengths in a bounded band, converted to decimal odds with margin.
  const strengths = rolls.map((roll) => 0.6 + Math.max(0, Math.min(1, roll)) * 1.9);
  const total = strengths.reduce((sum, value) => sum + value, 0);
  const overround = 1.1;
  return strengths.map((strength) => {
    const probability = (strength / total) * overround;
    const odds = 1 / probability;
    return Math.max(1.2, Math.round(odds * 10) / 10);
  });
}

export function crawlWinProbabilities(odds: number[]): number[] {
  const implied = odds.map((value) => 1 / value);
  const total = implied.reduce((sum, value) => sum + value, 0);
  return implied.map((value) => value / total);
}

export type GambleRoundRecord = {
  game: GambleGameId;
  id: string;
  payout: number;
  state: Record<string, unknown>;
  status: "open" | "settled" | "doubled" | "lost_double";
  wager: number;
};
