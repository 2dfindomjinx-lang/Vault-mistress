// The Upgrade table. One owned item goes in as fodder; the player names any
// crate + rarity above it as the target; a single coin flip decides win or
// loss. This is the Gamble Hall's house-edge philosophy applied to inventory
// instead of coins: the chance is a pure function of value, printed before
// the player commits, never hidden. Client and server both import this file
// so the number shown before pulling the trigger is exactly the number used
// to pull it.

import { CRATE_TYPES, SAMPLE_CRATE_ITEMS, type CrateRarity } from "@/lib/crates";

// Every upgrade pays out at this expected value, the same way every Gamble
// Hall table prints its edge. 0.90 matches the generous end of that family
// (Roulette, The Crawl) - this is framed as insurance against bad luck, not a
// pure gamble-for-profit table, so it earns the gentler cut.
export const CRATE_UPGRADE_TARGET_EV = 0.9;

// A jump priced below this would round up to "basically guaranteed"; one
// priced above this would round down to "basically impossible" and print a
// discouraging 0.0%. Both clamps keep every upgrade a real coin flip with a
// real number on it, never a foregone conclusion in either direction.
export const CRATE_UPGRADE_MIN_CHANCE = 0.005;
export const CRATE_UPGRADE_MAX_CHANCE = 0.9;

// "ultimate" is deliberately excluded. Nothing in any crate's drop table
// carries that rarity (see the birthday plush note in crates.ts, kept out of
// every drop table on purpose) - so it can never appear as a target, and the
// reward pool below is built strictly from real crate drops, never the flat
// item catalogue, which is what keeps that exclusion airtight here too.
export const CRATE_UPGRADE_RARITY_ORDER: readonly CrateRarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

export type CrateUpgradeTarget = {
  crateType: string;
  crateName: string;
  rarity: CrateRarity;
  avgSellValue: number;
  itemCount: number;
};

type RarityPool = {
  weightSum: number;
  valueWeighted: number;
  drops: Array<{ item_id: string; weight: number; variant?: string }>;
};

// Built once at module load from the real, live crate tables - the only
// source of truth for what an upgrade can pay out.
const CRATE_RARITY_POOLS: Record<string, Partial<Record<CrateRarity, RarityPool>>> = (() => {
  const pools: Record<string, Partial<Record<CrateRarity, RarityPool>>> = {};
  for (const [crateType, crate] of Object.entries(CRATE_TYPES)) {
    if (!crate.enabled) continue;
    const byRarity: Partial<Record<CrateRarity, RarityPool>> = {};
    for (const drop of crate.drops) {
      const item = SAMPLE_CRATE_ITEMS[drop.item_id];
      if (!item) continue;
      const bucket = (byRarity[item.rarity] ??= { weightSum: 0, valueWeighted: 0, drops: [] });
      bucket.weightSum += drop.weight;
      bucket.valueWeighted += drop.weight * item.sell_value;
      bucket.drops.push(drop);
    }
    pools[crateType] = byRarity;
  }
  return pools;
})();

// Every crate+rarity combination that can legally be an upgrade target, for
// the picker UI.
export function listCrateUpgradeTargets(): CrateUpgradeTarget[] {
  const targets: CrateUpgradeTarget[] = [];
  for (const [crateType, crate] of Object.entries(CRATE_TYPES)) {
    if (!crate.enabled) continue;
    const pools = CRATE_RARITY_POOLS[crateType];
    if (!pools) continue;
    for (const rarity of CRATE_UPGRADE_RARITY_ORDER) {
      const bucket = pools[rarity];
      if (!bucket || bucket.weightSum <= 0) continue;
      targets.push({
        crateType,
        crateName: crate.name,
        rarity,
        avgSellValue: bucket.valueWeighted / bucket.weightSum,
        itemCount: bucket.drops.length,
      });
    }
  }
  return targets;
}

export function getCrateRarityAvgSellValue(crateType: string, rarity: CrateRarity): number | null {
  const bucket = CRATE_RARITY_POOLS[crateType]?.[rarity];
  if (!bucket || bucket.weightSum <= 0) return null;
  return bucket.valueWeighted / bucket.weightSum;
}

// The whole mechanic in one formula: risk something worth `inputSellValue`
// for a target worth `targetAvgSellValue` on average, at exactly the printed
// EV. Returns null when the target is not actually worth more than the
// fodder - a downgrade is not an upgrade, and the UI should never offer one.
export function computeCrateUpgradeChance(inputSellValue: number, targetAvgSellValue: number): number | null {
  if (!(inputSellValue > 0) || !(targetAvgSellValue > inputSellValue)) return null;
  const raw = (CRATE_UPGRADE_TARGET_EV * inputSellValue) / targetAvgSellValue;
  return Math.min(CRATE_UPGRADE_MAX_CHANCE, Math.max(CRATE_UPGRADE_MIN_CHANCE, raw));
}

// Draws the reward from the target crate+rarity's REAL weighted drop table.
// `roll` must come from the server's own crypto randomness - see
// src/app/api/user/crate-upgrade/route.ts.
export function pickCrateUpgradeReward(
  crateType: string,
  rarity: CrateRarity,
  roll: number,
): { item_id: string; variant: string } | null {
  const bucket = CRATE_RARITY_POOLS[crateType]?.[rarity];
  if (!bucket || bucket.weightSum <= 0) return null;
  let cursor = Math.max(0, Math.min(0.999999, roll)) * bucket.weightSum;
  for (const drop of bucket.drops) {
    cursor -= drop.weight;
    if (cursor < 0) return { item_id: drop.item_id, variant: drop.variant ?? "normal" };
  }
  const last = bucket.drops[bucket.drops.length - 1];
  return last ? { item_id: last.item_id, variant: last.variant ?? "normal" } : null;
}
