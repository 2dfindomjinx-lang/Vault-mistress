// Builds outfits for the Runway feed to fall back on.
//
// With a small user base the pool of real submissions runs dry long before a
// voter has used their five rewarded votes for the day, and the feed starts
// re-serving avatars they already rated (which earn nothing). These generated
// outfits fill that gap so the daily five is always completable.
//
// Two flavours, mixed 4:1 by the caller:
//   * "smart"  - anchored on one collection, filled out with a compatible
//                palette. Meant to look like something a person would wear.
//   * "random" - one item per slot, no coherence at all. Deliberately absurd;
//                the contrast is the joke.

import {
  ITEM_SLOT_MAP,
  normalizeEquipment,
  type AvatarSlot,
  type EquippedAvatarSlots,
} from "@/lib/avatar-slots";
import { SAMPLE_CRATE_ITEMS } from "@/lib/crates";

export type GeneratedOutfitKind = "smart" | "random";

export type GeneratedOutfit = {
  kind: GeneratedOutfitKind;
  equippedAvatarSlots: EquippedAvatarSlots;
  /** Collection the smart outfit was anchored on; null for random ones. */
  theme: string | null;
};

// Full sets are a single item that replaces the whole avatar, so there is no
// outfit to assemble - they are left out of both generators on purpose.
const CORE_SLOTS: AvatarSlot[] = ["top", "bottom"];
const LEG_SLOTS: AvatarSlot[] = ["shoes", "thighhighs", "leggings"];
const ACCESSORY_SLOTS: AvatarSlot[] = ["ears", "hands", "mouth", "blindfold", "collar", "tattoo"];

// Which collections read as belonging together. Anything not listed is treated
// as neutral and allowed to pair with any anchor - "classic" and "makeup" carry
// no theme of their own, so excluding them would leave most outfits bare.
const PALETTES: Record<string, string[]> = {
  cute: ["pink", "cute", "bunny", "maid", "dairy"],
  dark: ["gothic", "grunge", "latex", "ink", "blacked", "fishnet"],
  elegant: ["lace", "gorgeous", "shiny", "garter", "cosplay-wardrobe"],
  playful: ["summer", "sport", "cat", "dairy", "cute"],
};
const NEUTRAL_COLLECTIONS = new Set(["classic", "makeup", "pasties", "office"]);

type SlotPool = Partial<Record<AvatarSlot, string[]>>;

function buildPools() {
  const bySlot: SlotPool = {};
  const byCollection: Record<string, SlotPool> = {};

  for (const [itemId, slot] of Object.entries(ITEM_SLOT_MAP)) {
    if (!slot || slot === "toy") continue;
    const item = SAMPLE_CRATE_ITEMS[itemId];
    if (!item) continue;

    (bySlot[slot] ??= []).push(itemId);
    const collection = item.collection || "classic";
    ((byCollection[collection] ??= {})[slot] ??= []).push(itemId);
  }

  return { bySlot, byCollection };
}

const { bySlot: SLOT_POOL, byCollection: COLLECTION_POOL } = buildPools();

/** Collections rich enough to anchor an outfit: they can dress the core. */
const ANCHOR_COLLECTIONS = Object.entries(COLLECTION_POOL)
  .filter(([, pools]) => (pools.top?.length ?? 0) > 0 && (pools.bottom?.length ?? 0) > 0)
  .map(([collection]) => collection);

function pick<T>(list: readonly T[], rng: () => number): T | null {
  if (list.length === 0) return null;
  return list[Math.floor(rng() * list.length)] ?? null;
}

function compatibleCollections(anchor: string): Set<string> {
  const allowed = new Set<string>([anchor, ...NEUTRAL_COLLECTIONS]);
  for (const group of Object.values(PALETTES)) {
    if (group.includes(anchor)) group.forEach((entry) => allowed.add(entry));
  }
  return allowed;
}

function poolFor(slot: AvatarSlot, allowed: Set<string> | null): string[] {
  const all = SLOT_POOL[slot] ?? [];
  if (!allowed) return all;
  return all.filter((itemId) => allowed.has(SAMPLE_CRATE_ITEMS[itemId]?.collection || "classic"));
}

// Legs are an either/or: the fullLegs slot covers foot and leg in one piece and
// is mutually exclusive with shoes/thighhighs/leggings. normalizeEquipment would
// resolve a conflict anyway, but picking coherently here avoids spending a slot
// choice that is about to be discarded.
function dressLegs(target: EquippedAvatarSlots, allowed: Set<string> | null, rng: () => number) {
  const fullLegs = poolFor("fullLegs", allowed);
  if (fullLegs.length > 0 && rng() < 0.25) {
    const chosen = pick(fullLegs, rng);
    if (chosen) {
      target.fullLegs = chosen;
      return;
    }
  }

  const shoes = pick(poolFor("shoes", allowed), rng);
  if (shoes) target.shoes = shoes;

  // At most one of thighhighs/leggings, and not always.
  if (rng() < 0.55) {
    const legSlot = rng() < 0.5 ? "thighhighs" : "leggings";
    const chosen = pick(poolFor(legSlot as AvatarSlot, allowed), rng);
    if (chosen) target[legSlot as "thighhighs" | "leggings"] = chosen;
  }
}

export function generateSmartOutfit(rng: () => number = Math.random): GeneratedOutfit {
  const anchor = pick(ANCHOR_COLLECTIONS, rng);
  const allowed = anchor ? compatibleCollections(anchor) : null;
  const slots: EquippedAvatarSlots = {};

  // Core first, and preferring the anchor itself so the outfit reads as themed
  // rather than as a pile of compatible pieces.
  for (const slot of CORE_SLOTS) {
    const anchored = anchor ? COLLECTION_POOL[anchor]?.[slot] ?? [] : [];
    const chosen = pick(anchored.length > 0 ? anchored : poolFor(slot, allowed), rng);
    if (chosen) slots[slot] = chosen;
  }

  dressLegs(slots, allowed, rng);

  // Accessories are optional: filling every slot every time makes each outfit
  // look like the last one.
  for (const slot of ACCESSORY_SLOTS) {
    if (rng() > 0.45) continue;
    const chosen = pick(poolFor(slot, allowed), rng);
    if (chosen) slots[slot] = chosen;
  }

  return { kind: "smart", equippedAvatarSlots: normalizeEquipment(slots), theme: anchor };
}

export function generateRandomOutfit(rng: () => number = Math.random): GeneratedOutfit {
  const slots: EquippedAvatarSlots = {};

  for (const slot of [...CORE_SLOTS, ...LEG_SLOTS, ...ACCESSORY_SLOTS, "fullLegs" as AvatarSlot]) {
    if (rng() > 0.6) continue;
    const chosen = pick(poolFor(slot, null), rng);
    if (chosen) slots[slot] = chosen;
  }

  // Never hand back an empty avatar, however the dice fell.
  if (Object.keys(slots).length === 0) {
    const chosen = pick(poolFor("fullBody", null), rng);
    if (chosen) slots.fullBody = chosen;
  }

  return { kind: "random", equippedAvatarSlots: normalizeEquipment(slots), theme: null };
}

/**
 * A batch in the ratio the feed serves them: four themed outfits per absurd one.
 */
export function generateOutfitBatch(count: number, rng: () => number = Math.random): GeneratedOutfit[] {
  const out: GeneratedOutfit[] = [];
  for (let index = 0; index < Math.max(0, count); index += 1) {
    out.push(index % 5 === 4 ? generateRandomOutfit(rng) : generateSmartOutfit(rng));
  }
  return out;
}
