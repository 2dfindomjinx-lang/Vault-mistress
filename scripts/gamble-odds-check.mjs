import assert from "node:assert/strict";
import {
  CRASH_HOUSE_K,
  DICE_PAYOUT_MULTIPLIER,
  drawCrawlOdds,
  EUROPEAN_ROULETTE_ORDER,
  GAMBLE_MAX_RTP,
  MINES_OPTIONS,
  minesMultiplier,
  PLINKO_MULTIPLIERS,
  PLINKO_ROWS,
  ROULETTE_BETS,
  rouletteBetWins,
  SLOT_SYMBOLS,
  slotsPayoutMultiplier,
  crawlWinProbabilities,
} from "../src/lib/gamble.ts";

const EPSILON = 1e-9;

function choose(n, k) {
  let result = 1;
  for (let index = 1; index <= k; index += 1) result = (result * (n - k + index)) / index;
  return result;
}

function assertRtp(name, value) {
  assert.ok(value <= GAMBLE_MAX_RTP + EPSILON, `${name} RTP ${(value * 100).toFixed(3)}% exceeds 82%`);
  console.log(`${name}: ${(value * 100).toFixed(3)}%`);
}

const slotWeight = SLOT_SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
let slotsRtp = 0;
for (let a = 0; a < SLOT_SYMBOLS.length; a += 1) {
  for (let b = 0; b < SLOT_SYMBOLS.length; b += 1) {
    for (let c = 0; c < SLOT_SYMBOLS.length; c += 1) {
      const probability = (SLOT_SYMBOLS[a].weight * SLOT_SYMBOLS[b].weight * SLOT_SYMBOLS[c].weight) / slotWeight ** 3;
      slotsRtp += probability * slotsPayoutMultiplier([a, b, c]);
    }
  }
}
assertRtp("Her Reels", slotsRtp);

assertRtp("Her Dice", (575 / 1296) * DICE_PAYOUT_MULTIPLIER);

for (const bet of ROULETTE_BETS) {
  const winningNumbers = EUROPEAN_ROULETTE_ORDER.filter((number) => rouletteBetWins(bet.id, number)).length;
  assert.equal(winningNumbers, 18, `${bet.label} should cover 18 numbers`);
  assertRtp(`Court Roulette / ${bet.label}`, (winningNumbers / 37) * bet.multiplier);
}

const plinkoRtp = PLINKO_MULTIPLIERS.reduce(
  (sum, multiplier, bucket) => sum + (choose(PLINKO_ROWS, bucket) / 2 ** PLINKO_ROWS) * multiplier,
  0,
);
assertRtp("Royal Plinko", plinkoRtp);

for (const mines of MINES_OPTIONS) {
  for (let picks = 1; picks <= 25 - mines; picks += 1) {
    const survivalChance = choose(25 - mines, picks) / choose(25, picks);
    assertRtp(`Jewelry Box / ${mines} mines / ${picks} picks`, survivalChance * minesMultiplier(mines, picks));
  }
}

assertRtp("Her Patience", CRASH_HOUSE_K);

const samples = [0, 0.25, 0.5, 0.75, 1];
for (const a of samples) {
  for (const b of samples) {
    for (const c of samples) {
      for (const d of samples) {
        const odds = drawCrawlOdds([a, b, c, d]);
        const probabilities = crawlWinProbabilities(odds);
        odds.forEach((multiplier, index) => assert.ok(probabilities[index] * multiplier <= GAMBLE_MAX_RTP + EPSILON));
      }
    }
  }
}
console.log("The Crawl: <= 82.000% across sampled race sheets");

