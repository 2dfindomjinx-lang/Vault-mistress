import { SAMPLE_CRATE_ITEMS, getCrateItemImageUrl } from "@/lib/crates";

export type AvatarSlot =
  | "tattoo"
  | "ears"
  | "mouth"
  | "blindfold"
  | "collar"
  | "hands"
  | "top"
  | "bottom"
  | "leggings"
  | "thighhighs"
  | "shoes"
  | "fullLegs"
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
  ["latex_whip", "toy"],
  ["cat_o_nine_tails", "toy"],
  ["pink_paddle", "toy"],
  ["pink_feather_tickler", "toy"],
  ["ruler", "toy"],
  // --- New wardrobe batch (2026-07) ---
  // Tops
  ["black_strappy_harness_top", "top"],
  ["black_v_neck_crop_top", "top"],
  ["fireworks_crop_top", "top"],
  ["gyaru_shirt", "top"],
  ["leather_jacket", "top"],
  ["pink_bandeau_top", "top"],
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

  // --- New wardrobe batch (2026-07, round 2) ---
  ["ruined_makeup", "blindfold"],
  ["black_lips", "mouth"],
  ["red_lips", "mouth"],
  ["cat_panties", "bottom"],
  ["cute_short_shorts", "bottom"],
  ["fishnet_panties", "bottom"],
  ["red_fishnet_shorts", "bottom"],
  ["latex_panties", "bottom"],
  ["red_office_skirt", "bottom"],
  ["cute_choker", "collar"],
  ["cute_dress", "fullBody"],
  ["classic_gloves", "hands"],
  ["latex_gloves", "hands"],
  ["pink_gloves", "hands"],
  ["cute_sneakers", "shoes"],
  ["dominatrix_boots", "shoes"],
  ["pink_highheels", "shoes"],
  ["cat-bra", "top"],
  ["cute_bra", "top"],
  ["latex_bra", "top"],
  ["red_fishnet_croptop", "top"],

  // --- New wardrobe batch (2026-07, round 3) ---
  ["cat_ears", "ears"],
  ["cat_collar", "collar"],
  ["principessas-pet", "collar"],
  ["fishnet_choker", "collar"],
  ["spiked_collar", "collar"],
  ["latex_tape", "mouth"],
  ["pink_lips", "mouth"],
  ["cute_gloves", "hands"],
  ["cat_short_shorts", "bottom"],
  ["pink_panties", "bottom"],
  ["cat_thighhighs", "thighhighs"],
  ["pink_thighhighs", "thighhighs"],
  ["cat_sneakers", "shoes"],
  ["cat_croptop", "top"],
  ["pink_camisole", "top"],

  // --- New wardrobe batch (2026-07, round 5) ---
  ["sharp_eyes", "blindfold"],
  ["blacked_panties", "bottom"],
  ["blacked_bra", "top"],
  ["blacked_leggings", "leggings"],
  ["bimbo_collar", "collar"],
  // Moved out of `mouth` when the tattoo slot was added; the matching data
  // migration is supabase/couture-case-and-tattoo-slot.sql.
  ["qos_tattoo", "tattoo"],
  ["slingshot_swimsuit", "fullBody"],
  ["white_fingerless_sports_gloves", "hands"],
  ["white_sneakers", "shoes"],
  ["white_sports_bra", "top"],
  ["white_sport_pants", "leggings"],
  ["pink_yoga_pants", "leggings"],
  ["ripped_jeans", "leggings"],
  ["latex_leggings", "leggings"],
  ["black_garter_stockings", "leggings"],
  ["pink_garter_stockings", "leggings"],
  ["red_garter_stockings", "leggings"],
  ["white_garter_stockings", "leggings"],
  ["jeans_with_red_thong", "leggings"],

  // --- New wardrobe batch (2026-08) ---
  ["maid_headband", "ears"],
  ["pearl_drop_earrings", "ears"],
  ["cow_ears", "ears"],
  ["bat_hairpins", "ears"],
  ["smokey_eyes", "blindfold"],
  ["ahegao_eyes", "blindfold"],
  ["beach_bangles", "hands"],
  ["black_nails", "hands"],
  ["lace_gloves", "hands"],
  ["black_platform_boots", "shoes"],
  ["strappy_sandals", "shoes"],
  ["ballet_heels", "shoes"],
  ["barcode_tattoo", "tattoo"],
  ["owned_tattoo", "tattoo"],
  ["qos_leg_tattoo", "tattoo"],
  ["womb_tattoo", "tattoo"],
  ["bbc_owned_tshirt", "top"],
  ["black_lace_bra", "top"],
  ["cute_crop_camisole", "top"],
  ["gold_bra", "top"],
  ["pink_satin_bra", "top"],
  ["summer_tie_bikini_top", "top"],
  ["white_lace_bra", "top"],
  ["cow_print_bra", "top"],
  ["nipple_pasties", "top"],
  ["shredded_fishnet_top", "top"],
  ["black_lace_panties", "bottom"],
  ["cute_high_waist_skirt", "bottom"],
  ["gold_micro_thong", "bottom"],
  ["black_mini_skirt", "bottom"],
  ["cow_print_panties", "bottom"],
  ["green_sarong", "bottom"],
  ["summer_tie_side_panties", "bottom"],
  ["crotch_pasties", "bottom"],
  ["white_lace_panties", "bottom"],
  ["ripped_denim_thong", "bottom"],
  ["cow_bell_collar", "collar"],
  ["fangs", "mouth"],
  ["wine_lipstick", "mouth"],
  ["tongue_out", "mouth"],
  ["shibari_harness_with_black_bikini", "fullBody"],
  ["gothic_lolita_dress", "fullBody"],
  ["cow_legs", "fullLegs"],
  ["victorian_boots", "fullLegs"],
];

AVATAR_SLOT_ASSIGNMENTS.forEach(([itemId, slot]) => {
  ITEM_SLOT_MAP[itemId] = slot;
});


export type EquippedAvatarSlots = Partial<Record<AvatarSlot, string>>;

export type AvatarPreset = {
  name: string;
  equippedAvatarSlots: EquippedAvatarSlots;
  equippedFullSetId: string | null;
} | null;

export const MAX_AVATAR_PRESET_SLOTS = 3;
export const AVATAR_PRESET_SLOT_UNLOCK_COST = 10000;

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
  "tattoo",
  "ears",
  "blindfold",
  "mouth",
  "collar",
  "fullBody",
  "top",
  "hands",
  "leggings",
  "bottom",
  "thighhighs",
  "shoes",
  "fullLegs",
  "toy",
];

export const SLOT_LABELS: Record<AvatarSlot, string> = {
  tattoo: "Tattoo",
  ears: "Ears",
  blindfold: "Eye",
  mouth: "Mouth",
  collar: "Neck",
  fullBody: "Full Body",
  top: "Top",
  hands: "Hands",
  bottom: "Bottom",
  leggings: "Leggings",
  thighhighs: "Thighhighs",
  shoes: "Shoes",
  fullLegs: "Legs & Feet",
  toy: "Toy",
};

// First entry renders first, so it sits at the BOTTOM of the stack.
//
// `tattoo` therefore leads: ink is on the skin, not on top of clothing, so it
// has to go straight onto the base model before anything can cover it. It is
// the only slot that conflicts with nothing - everything else layers over it.
//
// `fullLegs` sits with the other legwear (below `bottom`, so a skirt still
// covers its top edge). It never coexists with shoes/thighhighs/leggings, so
// its exact position among them is only about what a future overlap would do.
const RENDER_LAYER_ORDER: Array<Exclude<AvatarSlot, "toy">> = [
  "tattoo",
  "thighhighs",
  "leggings",
  "shoes",
  "fullLegs",
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
  fullLegs: "fulllegs",
  hands: "hands",
  leggings: "leggings",
  mouth: "mouth",
  shoes: "shoes",
  tattoo: "tattoo",
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

// Layer assets are .webp by convention; entries here override the filename
// for items whose art file doesn't literally match their item id (e.g. a
// hyphen/underscore mismatch).
const AVATAR_LAYER_FILE_OVERRIDES: Partial<Record<string, string>> = {
  "fishnet-croptop": "fishnet_croptop.webp",
};

export function resolveAvatarLayer(itemId: string): string | null {
  const slot = getItemAvatarSlot(itemId);

  if (!slot || slot === "toy") {
    return null;
  }

  const fileName = AVATAR_LAYER_FILE_OVERRIDES[itemId] ?? `${itemId}.webp`;
  return `/avatar/${SLOT_FOLDER_MAP[slot]}/${fileName}`;
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

  if (normalized.leggings) {
    delete normalized.bottom;
    delete normalized.thighhighs;
  }

  // `fullLegs` is one piece covering legs AND feet - thigh boots, hooves, a
  // fin. It cannot share the body with anything that dresses either part.
  //
  // It deliberately does NOT clear `bottom`: a skirt over thigh-high boots is
  // a normal outfit, which is exactly what separates this from `leggings`.
  if (normalized.fullLegs) {
    delete normalized.thighhighs;
    delete normalized.leggings;
    delete normalized.shoes;
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

  if (slot === "leggings") {
    delete next.bottom;
    delete next.thighhighs;
  }

  if (slot === "bottom" || slot === "thighhighs") {
    delete next.leggings;
  }

  // Both directions, or the exclusion only holds when equipped in one order.
  if (slot === "fullLegs") {
    delete next.thighhighs;
    delete next.leggings;
    delete next.shoes;
  }

  if (slot === "thighhighs" || slot === "leggings" || slot === "shoes") {
    delete next.fullLegs;
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
  "asuka_cosplay",
  "asuna_cosplay",
  "chunli_cosplay",
  "frieren_cosplay",
  "jinx_cosplay",
  "lara_croft_cosplay",
  "megumin_cosplay",
  "misa_amane_cosplay",
  "mona_cosplay",
  "raiden_shogun_cosplay",
  "ryuko_matoi_cosplay",
  "tifa_lockhart_cosplay",

  // Original (non-licensed-character) full sets - epic, not legendary.
  "angel",
  "bimbo_set",
  "grunge_girl",
  "ponyplay",
  "succubus",

  // --- 2026-08 batch ---
  "sexy_officer_cosplay",
  "witch_cosplay",
  "jiangshi_cosplay",
  "nezuko_cosplay",
  "spider_man_cosplay",
  "venom_cosplay",
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
  const hasBottom = !!normalized.bottom || !!normalized.leggings;

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
