// The Upgrader. One owned item goes in; the player names one specific item
// worth more as the target; a single roll decides whether they walk away with
// exactly that item or nothing. Same house-edge philosophy as the Gamble
// Hall: the chance is a pure function of the two values, printed before the
// player commits. Client and server both import this file so the number shown
// is exactly the number used.

import { CRATE_TYPES, SAMPLE_CRATE_ITEMS, getCrateItemImageUrl, type CrateRarity } from "@/lib/crates";

// Every upgrade pays out at this expected value. 0.90 matches the generous
// end of the Gamble Hall (Roulette, The Crawl).
export const CRATE_UPGRADE_TARGET_EV = 0.9;

// Floor and ceiling keep every upgrade a real roll with a real number on it,
// never "basically guaranteed" and never a discouraging 0.0%. The ceiling only
// binds when the target is worth less than EV/ceiling = 1.125x the input;
// those near-swaps get the capped chance and so a worse EV than 0.90 - a
// deliberate tax on using the Upgrader as a low-risk item exchange.
export const CRATE_UPGRADE_MIN_CHANCE = 0.005;
export const CRATE_UPGRADE_MAX_CHANCE = 0.8;

// Quick-pick buttons: "find me something worth about N times my item".
export const CRATE_UPGRADE_MULTIPLIERS = [1.5, 2, 3, 5, 10, 20] as const;

export type CrateUpgradeTargetItem = {
  crateName: string;
  crateType: string;
  imageUrl: string | null;
  itemId: string;
  name: string;
  rarity: CrateRarity;
  sellValue: number;
  variant: string;
};

// Built once from the live crate drop tables - the only source of what an
// upgrade can pay out. An item deliberately kept out of every crate (the
// birthday plush) can therefore never be a target, by construction.
const TARGET_ITEMS: CrateUpgradeTargetItem[] = (() => {
  const seen = new Set<string>();
  const items: CrateUpgradeTargetItem[] = [];
  for (const [crateType, crate] of Object.entries(CRATE_TYPES)) {
    if (!crate.enabled) continue;
    for (const drop of crate.drops) {
      const def = SAMPLE_CRATE_ITEMS[drop.item_id];
      if (!def || def.sell_value <= 0) continue;
      const variant = drop.variant ?? "normal";
      const key = `${drop.item_id}:${variant}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        crateName: crate.name,
        crateType,
        imageUrl: getCrateItemImageUrl(drop.item_id, def.image_url ?? null),
        itemId: drop.item_id,
        name: def.name,
        rarity: def.rarity,
        sellValue: def.sell_value,
        variant,
      });
    }
  }
  return items.sort((a, b) => a.sellValue - b.sellValue);
})();

export function listCrateUpgradeTargetItems(): readonly CrateUpgradeTargetItem[] {
  return TARGET_ITEMS;
}

export function findCrateUpgradeTargetItem(itemId: string, variant = "normal"): CrateUpgradeTargetItem | null {
  return TARGET_ITEMS.find((item) => item.itemId === itemId && item.variant === variant) ?? null;
}

// Risk something worth `inputSellValue` for one item worth
// `targetSellValue`, at exactly the printed EV. Null when the target is not
// worth more than the input - a downgrade is not an upgrade.
export function computeCrateUpgradeChance(inputSellValue: number, targetSellValue: number): number | null {
  if (!(inputSellValue > 0) || !(targetSellValue > inputSellValue)) return null;
  const raw = (CRATE_UPGRADE_TARGET_EV * inputSellValue) / targetSellValue;
  return Math.min(CRATE_UPGRADE_MAX_CHANCE, Math.max(CRATE_UPGRADE_MIN_CHANCE, raw));
}

// The target whose value is closest (on a ratio scale) to input x multiplier,
// among items actually worth more than the input.
export function pickTargetForMultiplier(
  inputSellValue: number,
  multiplier: number,
  candidates: readonly CrateUpgradeTargetItem[] = TARGET_ITEMS,
): CrateUpgradeTargetItem | null {
  const goal = inputSellValue * multiplier;
  let best: CrateUpgradeTargetItem | null = null;
  let bestDistance = Infinity;
  for (const item of candidates) {
    if (item.sellValue <= inputSellValue) continue;
    const distance = Math.abs(Math.log(item.sellValue / goal));
    if (distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return best;
}
