// How a Crate Duel rolls its haul. Pure: the caller passes the randomness, so
// the API route can use crypto rolls and a test can use anything.
//
// Every crate is rolled at its plain listed drop table - no event discounts,
// free-open grants or per-account state, because both sides of a duel must
// face the same odds. The one exception is the Principessa Case, whose
// normal opens run Bad Luck Protection. Ignoring that would make a duel
// Principessa Case a measurably worse crate than the same case opened
// normally (~72% return instead of ~89%), so duels reproduce it rather than
// approximate it:
//
//   Each side enters with a hidden pity counter drawn from the protection's
//   own long-run distribution - as if that player had been opening
//   Principessa Cases all along - and then every crate in the haul is rolled
//   with the real rule, in order. A run of bad opens inside a duel really is
//   followed by a guaranteed epic, exactly like a normal open.
//
// Starting a Markov chain from its stationary distribution keeps every
// crate's odds equal to the long-run pity-on odds, so the duel's expected
// value matches a normal Principessa Case open exactly, not approximately.
// Both sides draw their starting counter from the same distribution, so the
// contest stays fair; neither player's real counter is read or changed.

import {
  CRATE_TYPES,
  PRINCIPESSA_PITY_CRATE,
  PRINCIPESSA_PITY_THRESHOLD,
  SAMPLE_CRATE_ITEMS,
  isPityResettingRarity,
} from "@/lib/crates";

export type DuelSealedItem = { itemId: string; sellValue: number; variant: string };

type WeightedDrop = { item_id: string; variant?: string; weight: number };

function pick(drops: readonly WeightedDrop[], random: () => number): WeightedDrop | null {
  const total = drops.reduce((sum, drop) => sum + drop.weight, 0);
  if (total <= 0 || drops.length === 0) return null;
  let cursor = Math.max(0, Math.min(0.999999, random())) * total;
  for (const drop of drops) {
    cursor -= drop.weight;
    if (cursor < 0) return drop;
  }
  return drops[drops.length - 1];
}

function toSealed(drop: WeightedDrop): DuelSealedItem | null {
  const def = SAMPLE_CRATE_ITEMS[drop.item_id];
  if (!def) return null;
  return { itemId: drop.item_id, sellValue: def.sell_value, variant: drop.variant ?? "normal" };
}

// Long-run distribution of the pity counter: from any counter below the
// threshold a non-resetting open moves it up one, anything else resets it,
// and the protected open always resets it. That chain's stationary weights
// are p^k for k = 0..threshold, where p is the chance an open does not reset.
function stationaryCounterWeights(drops: readonly WeightedDrop[]) {
  const total = drops.reduce((sum, drop) => sum + drop.weight, 0);
  const nonResetting =
    drops
      .filter((drop) => !isPityResettingRarity(SAMPLE_CRATE_ITEMS[drop.item_id]?.rarity))
      .reduce((sum, drop) => sum + drop.weight, 0) / total;
  return Array.from({ length: PRINCIPESSA_PITY_THRESHOLD + 1 }, (_, counter) => Math.pow(nonResetting, counter));
}

function sampleStartingCounter(drops: readonly WeightedDrop[], random: () => number) {
  const weights = stationaryCounterWeights(drops);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = random() * total;
  for (let counter = 0; counter < weights.length; counter += 1) {
    cursor -= weights[counter];
    if (cursor < 0) return counter;
  }
  return weights.length - 1;
}

export function rollDuelHaul(crateType: string, quantity: number, random: () => number): DuelSealedItem[] | null {
  const crate = CRATE_TYPES[crateType];
  if (!crate) return null;
  const drops = crate.drops as readonly WeightedDrop[];
  const usesPity = crateType === PRINCIPESSA_PITY_CRATE;
  const epicDrops = drops.filter((drop) => SAMPLE_CRATE_ITEMS[drop.item_id]?.rarity === "epic");
  let counter = usesPity ? sampleStartingCounter(drops, random) : 0;

  const haul: DuelSealedItem[] = [];
  for (let index = 0; index < quantity; index += 1) {
    let drop = pick(drops, random);
    if (!drop) return null;
    // The same protected open a normal Principessa Case uses: a natural
    // legendary is kept, anything else becomes an epic.
    if (usesPity && counter >= PRINCIPESSA_PITY_THRESHOLD && SAMPLE_CRATE_ITEMS[drop.item_id]?.rarity !== "legendary") {
      drop = pick(epicDrops.length ? epicDrops : drops, random) ?? drop;
    }
    const sealed = toSealed(drop);
    if (!sealed) return null;
    haul.push(sealed);
    if (usesPity) {
      counter = isPityResettingRarity(SAMPLE_CRATE_ITEMS[drop.item_id]?.rarity) ? 0 : counter + 1;
    }
  }
  return haul;
}
