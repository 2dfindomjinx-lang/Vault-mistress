import { SAMPLE_CRATE_ITEMS, getCrateItemImageUrl } from "@/lib/crates";

export type AvatarSlot =
  | "ears"
  | "mouth"
  | "blindfold"
  | "collar"
  | "hands"
  | "top"
  | "bottom"
  | "thighhighs"
  | "shoes"
  | "fullBody"
  | "toy";

export const ITEM_SLOT_MAP: Partial<Record<string, AvatarSlot>> = {};

// Populate slot mappings for all crate items that should render as visual layers on top of base-model.webp.
// This powers the Profile → Avatar Wardrobe customization.
const AVATAR_SLOT_ASSIGNMENTS: Array<[string, AvatarSlot]> = [
  // Ears
  ["classic-ears", "ears"],
  ["pink-ears", "ears"],
  // Blindfold
  ["classic-blindfold", "blindfold"],
  ["pink-blindfold", "blindfold"],
  // Collar
  ["classic-collar", "collar"],
  ["pink-collar", "collar"],
  // Tops / upper body
  ["classic-bra", "top"],
  ["pink-bra", "top"],
  ["gorgeous-bra", "top"],
  ["shiny-bra", "top"],
  ["cat-croptop", "top"],
  ["fishnet-croptop", "top"],
  // Bottoms / lower body
  ["boxer", "bottom"],
  ["cute-panties", "bottom"],
  ["gorgeous-panties", "bottom"],
  ["shiny-panties", "bottom"],
  ["classic-thong", "bottom"],
  ["pink-thong", "bottom"],
  ["gorgeous-thong", "bottom"],
  ["shiny-thong", "bottom"],
  ["cute-miniskirt", "bottom"],
  ["classic-skirt", "bottom"],
  ["latex-skirt", "bottom"],
  ["shiny-skirt", "bottom"],
  // Thighhighs / stockings
  ["classic-thighhighs", "thighhighs"],
  ["cute-thighhighs", "thighhighs"],
  ["latex-thighhighs", "thighhighs"],
  ["gorgeous-thighhighs", "thighhighs"],
  ["shiny-thighhighs", "thighhighs"],
  ["fishnet-stockings", "thighhighs"],
  // Shoes
  ["classic-highheels", "shoes"],
  ["gorgeous-highheels", "shoes"],
  ["shiny-highheels", "shoes"],
  ["sneakers", "shoes"],
  // Full body outfits (override top + bottom)
  ["classic", "fullBody"],
  ["classic-maid-outfit", "fullBody"],
  ["pink-maid-outfit", "fullBody"],
  ["latex-maid-outfit", "fullBody"],
  ["shiny-maid-outfit", "fullBody"],
  ["classic-bunnysuit", "fullBody"],
  ["pink-bunnysuit", "fullBody"],
  ["gorgeous-bunnysuit", "fullBody"],
  ["shiny-bunnysuit", "fullBody"],
  ["classic-corset", "fullBody"],
  ["pink-corset", "fullBody"],
  ["gorgeous-corset", "fullBody"],
  ["shiny-corset", "fullBody"],
  ["pink-sheer-bikini", "fullBody"],
  ["gorgeous-sheer-bikini", "fullBody"],
  ["fishnet-leotard", "fullBody"],
  // Mouth (new category - facial accessories)
  ["ballgag", "mouth"],
  // Hands (new category - mitts/gloves)
  ["white-pawmitts", "hands"],
  ["classic-pawmitts", "hands"],
  ["gorgeous-pawmitts", "hands"],
  ["shiny_pawmitts", "hands"],
  // Toys (equippable in slots but intentionally not rendered visually on the avatar)
  // (ballgag moved to mouth)
  ["classic-buttplug", "toy"],
  ["classic-dildo", "toy"],
  ["pink-small-vibrator", "toy"],
  ["vibrator", "toy"],
  ["ultra-vibrator", "toy"],
  ["remote-control-vibrator", "toy"],
  ["rabbit-small-vibrator", "toy"],
  ["black-dildo", "toy"],
  ["classic-anal-beads", "toy"],
  // --- New wardrobe batch (2026-07) ---
  // Tops
  ["black_strappy_harness_top", "top"],
  ["black_v_neck_crop_top", "top"],
  ["fireworks_crop_top", "top"],
  ["leather_jacket", "top"],
  ["pink_off_shoulder_sweater", "top"],
  ["purple_crop_sweater", "top"],
  ["red_off_shoulder_crop_top", "top"],
  ["red_satin_halter_bra", "top"],
  ["white_off_shoulder_crop_top", "top"],
  ["white_tie_front_shirt", "top"],
  // Bottoms
  ["black_dolphin_shorts", "bottom"],
  ["blue_tartan_pleated_skirt", "bottom"],
  ["denim_shorts", "bottom"],
  ["pink_dolphin_shorts", "bottom"],
  ["red_tartan_pleated_skirt", "bottom"],
  ["silver_vinyl_shorts", "bottom"],
  ["white_distressed_denim_shorts", "bottom"],
  // Thighhighs
  ["black_bow_thighhighs", "thighhighs"],
  ["knee_high_socks", "thighhighs"],
  ["white_thighhighs", "thighhighs"],
  // Collar
  ["red_collar", "collar"],
];

AVATAR_SLOT_ASSIGNMENTS.forEach(([itemId, slot]) => {
  ITEM_SLOT_MAP[itemId] = slot;
});


export type EquippedAvatarSlots = Partial<Record<AvatarSlot, string>>;

export type RenderedAvatarLayer = {
  itemId: string;
  slot: Exclude<AvatarSlot, "toy">;
  src: string;
};

export const BASE_AVATAR_MODEL_PATH = "/avatar/base/base-model.webp";
export const BASE_MODEL_FULL_CENSORED = "/avatar/base/base-model-full-censored.webp";
export const BASE_MODEL_BOTTOM_CENSORED = "/avatar/base/base-model-bottom-censored.webp";
export const BASE_MODEL_TOP_CENSORED = "/avatar/base/base-model-top-censored.webp";
export const UNCENSORED_AVATAR_COST = 10000;

export const AVATAR_IMAGE_WIDTH = 512;
export const AVATAR_IMAGE_HEIGHT = 1536;

export const AVATAR_SLOT_ORDER: AvatarSlot[] = [
  "ears",
  "blindfold",
  "mouth",
  "collar",
  "fullBody",
  "top",
  "hands",
  "bottom",
  "thighhighs",
  "shoes",
  "toy",
];

export const SLOT_LABELS: Record<AvatarSlot, string> = {
  ears: "Ears",
  blindfold: "Blindfold",
  mouth: "Mouth",
  collar: "Collar",
  fullBody: "Full Body",
  top: "Top",
  hands: "Hands",
  bottom: "Bottom",
  thighhighs: "Thighhighs",
  shoes: "Shoes",
  toy: "Toy",
};

const RENDER_LAYER_ORDER: Array<Exclude<AvatarSlot, "toy">> = [
  "thighhighs",
  "shoes",
  "bottom",
  "top",
  "fullBody",
  "collar",
  "hands",
  "mouth",
  "blindfold",
  "ears",
];

const SLOT_FOLDER_MAP: Record<Exclude<AvatarSlot, "toy">, string> = {
  blindfold: "blindfold",
  bottom: "bottoms",
  collar: "collar",
  ears: "ears",
  fullBody: "fullbody",
  hands: "hands",
  mouth: "mouth",
  shoes: "shoes",
  thighhighs: "thighhighs",
  top: "tops",
};

export function getItemAvatarSlot(itemId: string): AvatarSlot | null {
  return ITEM_SLOT_MAP[itemId] ?? null;
}

export function isAvatarEquippableItem(itemId: string): boolean {
  return getItemAvatarSlot(itemId) !== null;
}

export function resolveAvatarItemIconPath(itemId: string): string | null {
  const item = SAMPLE_CRATE_ITEMS[itemId];

  if (!item) {
    return null;
  }

  return getCrateItemImageUrl(itemId, item.image_url ?? null);
}

export function resolveAvatarLayer(itemId: string): string | null {
  const slot = getItemAvatarSlot(itemId);

  if (!slot || slot === "toy") {
    return null;
  }

  return `/avatar/${SLOT_FOLDER_MAP[slot]}/${itemId}.webp`;
}

export function normalizeEquipment(equipped: EquippedAvatarSlots): EquippedAvatarSlots {
  const normalized: EquippedAvatarSlots = {};

  for (const slot of AVATAR_SLOT_ORDER) {
    const itemId = equipped[slot];
    if (typeof itemId === "string" && itemId.length > 0) {
      normalized[slot] = itemId;
    }
  }

  if (normalized.fullBody) {
    delete normalized.top;
    delete normalized.bottom;
  }

  return normalized;
}

export function equipAvatarItem(
  equipped: EquippedAvatarSlots,
  itemId: string,
): EquippedAvatarSlots {
  const slot = getItemAvatarSlot(itemId);

  if (!slot) {
    return normalizeEquipment(equipped);
  }

  const next: EquippedAvatarSlots = {
    ...normalizeEquipment(equipped),
    [slot]: itemId,
  };

  if (slot === "fullBody") {
    delete next.top;
    delete next.bottom;
  }

  if (slot === "top" || slot === "bottom") {
    delete next.fullBody;
  }

  return normalizeEquipment(next);
}

export function unequipAvatarSlot(
  equipped: EquippedAvatarSlots,
  slot: AvatarSlot,
): EquippedAvatarSlots {
  const next = { ...equipped };
  delete next[slot];
  return normalizeEquipment(next);
}

export function getRenderedAvatarLayers(
  equipped: EquippedAvatarSlots,
): RenderedAvatarLayer[] {
  const normalized = normalizeEquipment(equipped);

  return RENDER_LAYER_ORDER.flatMap((slot) => {
    const itemId = normalized[slot];
    if (!itemId) {
      return [];
    }

    const src = resolveAvatarLayer(itemId);
    if (!src) {
      return [];
    }

    return [{ itemId, slot, src }];
  });
}

// "Full Set" items are single pre-rendered whole-character illustrations that
// replace the base model + every layer entirely. They are intentionally kept
// out of AvatarSlot/AVATAR_SLOT_ORDER - equipping one means "render only this
// image", not "layer this on top of the base model" (unlike the "fullBody"
// slot above, which is really just a top+bottom-replacing outfit).
// Add item ids here as full-set art gets produced.
export const FULL_SET_ITEM_IDS: string[] = [
  "2b_cosplay",
  "ada_wong_cosplay",
  "astolfo_cosplay",
  "chunli_cosplay",
  "jinx_cosplay",
  "lara_croft_cosplay",
  "ryuko_matoi_cosplay",
  "tifa_lockhart_cosplay",
];

export function isFullSetItem(itemId: string): boolean {
  return FULL_SET_ITEM_IDS.includes(itemId);
}

export function resolveFullSetImagePath(itemId: string): string {
  return `/avatar/fullset/${itemId}.webp`;
}

export function getAvatarBaseModelPath(
  equipped: EquippedAvatarSlots,
  hasUncensored: boolean,
): string {
  if (hasUncensored) {
    return BASE_AVATAR_MODEL_PATH;
  }

  const normalized = normalizeEquipment(equipped);
  const hasFullBody = !!normalized.fullBody;
  const hasTop = !!normalized.top;
  const hasBottom = !!normalized.bottom;

  if (hasFullBody) {
    return BASE_AVATAR_MODEL_PATH;
  }

  if (!hasTop && !hasBottom) {
    return BASE_MODEL_FULL_CENSORED;
  }

  if (hasTop && !hasBottom) {
    return BASE_MODEL_BOTTOM_CENSORED;
  }

  if (!hasTop && hasBottom) {
    return BASE_MODEL_TOP_CENSORED;
  }

  return BASE_AVATAR_MODEL_PATH;
}
