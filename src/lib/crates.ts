export type CrateRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export type CrateItem = {
  item_id: string;
  name: string;
  description: string;
  image_url?: string | null;
  rarity: CrateRarity;
  collection?: string | null;
  sell_value: number;
  enabled: boolean;
  metadata?: Record<string, unknown>;
  variant?: string; // 'normal' | 'shiny' etc. for future
};

export type CrateType = {
  crate_type: string;
  name: string;
  description: string;
  cost: number;
  enabled: boolean;
};

export type UserCrateInventoryItem = {
  item_id: string;
  name: string;
  description: string;
  image_url?: string | null;
  rarity: CrateRarity;
  collection?: string | null;
  sell_value: number;
  variant: string;
  quantity: number;
};

export const RARITY_COLORS: Record<CrateRarity, string> = {
  common: "border-zinc-400 text-zinc-300 bg-zinc-900/60",
  uncommon: "border-emerald-400 text-emerald-300 bg-emerald-950/60",
  rare: "border-sky-400 text-sky-300 bg-sky-950/60",
  epic: "border-violet-400 text-violet-300 bg-violet-950/60",
  legendary: "border-amber-300 text-amber-200 bg-amber-950/70",
};

export const RARITY_ORDER: CrateRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

// V1: Server-side crate definitions + weighted drops.
// These can (and should) later be moved to DB tables for full admin configurability.
// For now they live here so the system works immediately after schema is applied.

export const CRATE_TYPES: Record<string, Omit<CrateType, "crate_type"> & { drops: Array<{ item_id: string; weight: number; variant?: string }>; icon_url?: string }> = {
  principessa_case: {
    name: "Principessa Case",
    description: "An exquisite and highly exclusive case containing rare memorabilia from Principessa's personal collection. Only the most devoted are permitted to open it.",
    cost: 500,
    enabled: true,
    drops: [
      // === COMPLETE LIST OF ALL 39 ITEMS (matching your 39 images) ===
      // Weights distributed for fair but exciting drops (higher for common, low for legendary)
      // Total weight = 10000

      // Common %45
	  { item_id: "pet-tag", weight: 563 },
      { item_id: "classic-collar", weight: 563 },
      { item_id: "classic-ears", weight: 563 },
      { item_id: "classic-tail", weight: 563 },
	  { item_id: "boxer", weight: 562 },
      { item_id: "classic-blindfold", weight: 562 },
	  { item_id: "classic-bra", weight: 562 },
	  { item_id: "ballgag", weight: 562 },

      // Uncommon %25 (rebalanced 2026-07 to fold in cute/pink additions)
	  { item_id: "cute_choker", weight: 342 },
	  { item_id: "owned-tag", weight: 302 },
	  { item_id: "cute_sneakers", weight: 302 },
	  { item_id: "pink-collar", weight: 266 },
      { item_id: "pink-ears", weight: 241 },
	  { item_id: "pink-blindfold", weight: 216 },
      { item_id: "cute-panties", weight: 191 },
	  { item_id: "classic-buttplug", weight: 154 },
	  { item_id: "cute_short_shorts", weight: 154 },
	  { item_id: "pink-bra", weight: 117 },
      { item_id: "classic-highheels", weight: 92 },
      { item_id: "classic-skirt", weight: 67 },
      { item_id: "classic-thighhighs", weight: 28 },
      { item_id: "pink_thighhighs", weight: 28 },

      // Rare %17 (rebalanced 2026-07 to fold in cute_bra)
	  { item_id: "cute-thighhighs", weight: 350 },
	  { item_id: "good-boy-tag", weight: 314 },
	  { item_id: "pink-tail", weight: 279 },
      { item_id: "latex-thighhighs", weight: 243 },
	  { item_id: "latex-skirt", weight: 189 },
	  { item_id: "cute_bra", weight: 189 },
	  { item_id: "cute-miniskirt", weight: 136 },

      // Epic %12.5 (rebalanced 2026-07 to fold in pink additions; latex moved to Premium Case)
	  { item_id: "gorgeous-highheels", weight: 243 },
	  { item_id: "pink_highheels", weight: 243 },
	  { item_id: "gorgeous-panties", weight: 191 },
      { item_id: "pink_panties", weight: 191 },
      { item_id: "gorgeous-bra", weight: 153 },
      { item_id: "gorgeous-thighhighs", weight: 127 },
	  { item_id: "gorgeous-buttplug", weight: 102 },

      // Legendary %0.5
	  { item_id: "shiny-highheels", weight: 21 },
	  { item_id: "shiny-bra", weight: 12 },
      { item_id: "shiny-panties", weight: 6 },
      { item_id: "shiny-skirt", weight: 5 },
      { item_id: "shiny-thighhighs", weight: 5 },
      { item_id: "principessas-pet", weight: 1 },
    ],
  },
  
  
  premium_case: {
    name: "Premium Case",
    description: "A balanced case with reliable rewards, enhanced odds, and the chance to unlock truly valuable treasures.",
    cost: 1000,
    enabled: true,
    drops: [
      // === COMPLETE LIST OF ALL 39 ITEMS (matching your 39 images) ===
      // Weights distributed for fair but exciting drops (higher for common, low for legendary)
      // Total weight = 10000

      // Common %34 (rebalanced 2026-07 to fold in sharp_eyes/ripped_jeans)
	  { item_id: "sneakers", weight: 731 },
	  { item_id: "cat-croptop", weight: 731 },
	  { item_id: "sharp_eyes", weight: 610 },
	  { item_id: "ripped_jeans", weight: 610 },
	  { item_id: "classic-corset", weight: 457 },
      { item_id: "classic-maid-outfit", weight: 261 },
		
	  // Uncommon %28 (rebalanced 2026-07 to fold in fishnet/latex additions)
	  { item_id: "fishnet_choker", weight: 430 },
	  { item_id: "classic-anal-beads", weight: 400 },
	  { item_id: "classic-thong", weight: 371 },
	  { item_id: "latex_tape", weight: 341 },
	  { item_id: "pink-corset", weight: 311 },
	  { item_id: "classic-bunnysuit", weight: 281 },
	  { item_id: "pink-maid-outfit", weight: 252 },
	  { item_id: "pink-small-vibrator", weight: 222 },
	  { item_id: "classic-dildo", weight: 192 },
	  
	  //Rare %20
	  { item_id: "pink-thong", weight: 420 },
	  { item_id: "latex-maid-outfit", weight: 360 },
	  { item_id: "fishnet-stockings", weight: 310 },
	  { item_id: "fishnet-croptop", weight: 270 },
	  { item_id: "pink-bunnysuit", weight: 230 },
	  { item_id: "pink-sheer-bikini", weight: 180 },
	  { item_id: "remote-control-vibrator", weight: 140 },
	  { item_id: "black-dildo", weight: 90 },
	  
	  // Epic %15 (rebalanced 2026-07 to fold in grunge_girl)
	  { item_id: "gorgeous-thong", weight: 232 },
	  { item_id: "latex_panties", weight: 232 },
	  { item_id: "latex_bra", weight: 232 },
	  { item_id: "gorgeous-sheer-bikini", weight: 196 },
	  { item_id: "gorgeous-bunnysuit", weight: 169 },
	  { item_id: "gorgeous-corset", weight: 142 },
	  { item_id: "fishnet-leotard", weight: 117 },
	  { item_id: "rabbit-small-vibrator", weight: 93 },
	  { item_id: "grunge_girl", weight: 87 },
	  
      // Legendary %3
	  { item_id: "shiny-thong", weight: 120 },
	  { item_id: "shiny-bunnysuit", weight: 75 },
	  { item_id: "shiny-maid-outfit", weight: 50 },
	  { item_id: "shiny-corset", weight: 30 },
	  { item_id: "vibrator", weight: 18 },
	  { item_id: "ultra-vibrator", weight: 7 },
    ],
  },

  cosplay_case: {
    name: "Obedience Case",
    description: "A reward reserved for those who know how to obey.",
    icon_url: "/crate-icons/cosplay_case.webp",
    cost: 2500,
    enabled: true,
    drops: [
      // Common %45
	  { item_id: "red_collar", weight: 870 },
      { item_id: "knee_high_socks", weight: 830 },
	  { item_id: "denim_shorts", weight: 780 },
      { item_id: "white_thighhighs", weight: 740 },
      { item_id: "pink_paddle", weight: 690 },
      { item_id: "latex_whip", weight: 590 },

      // Uncommon %25
	  { item_id: "black_garter_stockings", weight: 460 },
	  { item_id: "fireworks_crop_top", weight: 440 },
	  { item_id: "leather_jacket", weight: 430 },
	  { item_id: "black_bow_thighhighs", weight: 410 },
      { item_id: "purple_crop_sweater", weight: 390 },
	  { item_id: "pink_off_shoulder_sweater", weight: 370 },

      // Rare %16 (band total 1600 - existing entries gave up 17 each, 19 from
      // the last, to seat gyaru_shirt at 155 without moving the advertised %)
      { item_id: "pink_garter_stockings", weight: 193 },
      { item_id: "red_garter_stockings", weight: 183 },
      { item_id: "white_off_shoulder_crop_top", weight: 168 },
      { item_id: "blue_tartan_pleated_skirt", weight: 163 },
      { item_id: "red_tartan_pleated_skirt", weight: 158 },
      { item_id: "gyaru_shirt", weight: 155 },
      { item_id: "white_distressed_denim_shorts", weight: 153 },
	  { item_id: "black_v_neck_crop_top", weight: 148 },
	  { item_id: "red_off_shoulder_crop_top", weight: 143 },
	  { item_id: "white_tie_front_shirt", weight: 136 },

      // Epic %12
	  { item_id: "white_garter_stockings", weight: 170 },
	  { item_id: "bimbo_collar", weight: 155 },
	  { item_id: "black_dolphin_shorts", weight: 140 },
	  { item_id: "pink_dolphin_shorts", weight: 135 },
      { item_id: "red_satin_halter_bra", weight: 130 },
      { item_id: "silver_vinyl_shorts", weight: 125 },
	  { item_id: "black_strappy_harness_top", weight: 120 },
	  { item_id: "bimbo_set", weight: 115 },
	  { item_id: "succubus", weight: 110 },

      // Legendary - %2
      { item_id: "ada_wong_cosplay", weight: 40 },
	  { item_id: "tifa_lockhart_cosplay", weight: 34 },
      { item_id: "lara_croft_cosplay", weight: 30 },
	  { item_id: "astolfo_cosplay", weight: 26 },
	  { item_id: "chunli_cosplay", weight: 22 },
	  { item_id: "2b_cosplay", weight: 18 },
	  { item_id: "jinx_cosplay", weight: 16 },
      { item_id: "ryuko_matoi_cosplay", weight: 14 },
    ],
  },

  // Name still TBD — items assigned. Weights follow the same convention as
  // the other cases: within a rarity tier, higher sell_value = lower weight.
  cat_case: {
    name: "Kitten Case",
    description: "A playful case mixing cat-themed wardrobe pieces, glam accessories, and a shot at rare statement pieces.",
    icon_url: "/crate-icons/cat_case.webp",
    cost: 1500,
    enabled: true,
    drops: [
      // Common 46%
      { item_id: "classic_gloves", weight: 900 },
      { item_id: "red_lips", weight: 850 },
      { item_id: "pink_lips", weight: 800 },
      { item_id: "white_sneakers", weight: 750 },
      { item_id: "ruined_makeup", weight: 700 },
      { item_id: "red_office_skirt", weight: 600 },

      // Uncommon 27%
      { item_id: "qos_tattoo", weight: 360 },
	  { item_id: "cat_collar", weight: 340 },
	  { item_id: "cat_ears", weight: 320 },
      { item_id: "white_fingerless_sports_gloves", weight: 310 },
      { item_id: "pink_gloves", weight: 300 },
      { item_id: "black_lips", weight: 290 },
	  { item_id: "cute_gloves", weight: 280 },
      { item_id: "cat_croptop", weight: 260 },
      { item_id: "pink_camisole", weight: 240 },

      // Rare 16% (band total 1600 - each existing entry gave up 15 to seat
      // pink_bandeau_top at 150, so the advertised 16% is unchanged)
	  { item_id: "latex_gloves", weight: 185 },
      { item_id: "pink_feather_tickler", weight: 175 },
      { item_id: "ruler", weight: 165 },
      { item_id: "white_sports_bra", weight: 155 },
      { item_id: "pink_bandeau_top", weight: 150 },
      { item_id: "white_sport_pants", weight: 145 },
	  { item_id: "cat_short_shorts", weight: 140 },
	  { item_id: "cat_thighhighs", weight: 135 },
      { item_id: "cat_o_nine_tails", weight: 130 },
      { item_id: "latex_leggings", weight: 120 },
	  { item_id: "cute_dress", weight: 100 },

      // Epic 9% (band total 900 - each existing entry gave up 15 to seat
      // jeans_with_red_thong at 120, so the advertised 9% is unchanged)
	  { item_id: "cat_sneakers", weight: 125 },
      { item_id: "jeans_with_red_thong", weight: 120 },
      { item_id: "spiked_collar", weight: 115 },
	  { item_id: "pink_yoga_pants", weight: 105 },
      { item_id: "blacked_leggings", weight: 100 },
      { item_id: "cat_panties", weight: 95 },
      { item_id: "fishnet_panties", weight: 90 },
	  { item_id: "cat-bra", weight: 80 },
      { item_id: "angel", weight: 70 },

      // Legendary 2%
      { item_id: "dominatrix_boots", weight: 38 },
	  { item_id: "slingshot_swimsuit", weight: 34 },
      { item_id: "blacked_panties", weight: 31 },
      { item_id: "blacked_bra", weight: 28 },
	  { item_id: "red_fishnet_shorts", weight: 26 },
      { item_id: "red_fishnet_croptop", weight: 23 },
      { item_id: "ponyplay", weight: 20 },
    ],
  },

  // Guaranteed cosplay drop — every open lands on a full-body cosplay
  // illustration, priced close to (but under) the single most expensive
  // cosplay item's sell_value (ryuko_matoi_cosplay, 60000).
  // Mixed 2026-08 wardrobe drop. Bands follow the house shape
  // (40/27/18/13/2) so the advertised odds line up with the other cases.
  couture_case: {
    name: "Couture Case",
    description: "The newest additions to her wardrobe. Lace, gold, ink and a few things she had made specially.",
    cost: 2000,
    enabled: true,
    drops: [
      // Common 44%
	  { item_id: "owned_tattoo", weight: 590 },
	  { item_id: "barcode_tattoo", weight: 550 },
	  { item_id: "qos_leg_tattoo", weight: 510 },
	  { item_id: "beach_bangles", weight: 480 },
      { item_id: "maid_headband", weight: 440 },
      { item_id: "smokey_eyes", weight: 410 },
	  { item_id: "strappy_sandals", weight: 380 },
	  { item_id: "pearl_drop_earrings", weight: 340 },
      { item_id: "black_nails", weight: 290 },
	  { item_id: "black_platform_boots", weight: 230 },
      { item_id: "bbc_owned_tshirt", weight: 180 },

      // Uncommon 24%
	  { item_id: "cute_crop_camisole", weight: 310 },
	  { item_id: "fangs", weight: 290 },
      { item_id: "cute_high_waist_skirt", weight: 270 },
      { item_id: "wine_lipstick", weight: 250 },
	  { item_id: "pink_satin_bra", weight: 230 },
	  { item_id: "cow_bell_collar", weight: 210 },
	  { item_id: "gold_micro_thong", weight: 190 },
      { item_id: "gold_bra", weight: 170 },
	  { item_id: "black_lace_bra", weight: 150 },
      { item_id: "summer_tie_bikini_top", weight: 130 },
	  { item_id: "black_lace_panties", weight: 110 },
      { item_id: "white_lace_bra", weight: 90 },

      // Rare 18%
	  { item_id: "cow_ears", weight: 280 },
      { item_id: "black_mini_skirt", weight: 260 },
      { item_id: "summer_tie_side_panties", weight: 240 },
      { item_id: "green_sarong", weight: 220 },
      { item_id: "lace_gloves", weight: 200 },
      { item_id: "cow_print_panties", weight: 180 },
	  { item_id: "cow_print_bra", weight: 160 },
	  { item_id: "tongue_out", weight: 140 },
      { item_id: "shibari_harness_with_black_bikini", weight: 120 },

      // Epic 11%
      { item_id: "cow_legs", weight: 130 },
	  { item_id: "ballet_heels", weight: 125 },
	  { item_id: "ahegao_eyes", weight: 115 },
      { item_id: "victorian_boots", weight: 110 },
      { item_id: "womb_tattoo", weight: 105 },
      { item_id: "shredded_fishnet_top", weight: 100 },
      { item_id: "sexy_officer_cosplay", weight: 95 },
	  { item_id: "white_lace_panties", weight: 90 },
      { item_id: "witch_cosplay", weight: 85 },
	  { item_id: "crotch_pasties", weight: 80 },
	  { item_id: "nipple_pasties", weight: 65 },

      // Legendary 3%
	  { item_id: "bat_hairpins", weight: 67 },
      { item_id: "ripped_denim_thong", weight: 62 },
      { item_id: "gothic_lolita_dress", weight: 56 },
      { item_id: "venom_cosplay", weight: 39 },
      { item_id: "nezuko_cosplay", weight: 32 },
	  { item_id: "spider_man_cosplay", weight: 25 },
	  { item_id: "jiangshi_cosplay", weight: 19 },
    ],
  },

  cosplay_pure_case: {
    name: "Cosplay Case",
    description: "Every open guarantees a full-body cosplay illustration. No fillers, no fluff.",
    icon_url: "/crate-icons/cosplay_pure_case.webp",
    cost: 32500,
    enabled: true,
    drops: [
      { item_id: "ada_wong_cosplay", weight: 1 },
      { item_id: "tifa_lockhart_cosplay", weight: 1 },
      { item_id: "lara_croft_cosplay", weight: 1 },
      { item_id: "astolfo_cosplay", weight: 1 },
      { item_id: "chunli_cosplay", weight: 1 },
      { item_id: "asuka_cosplay", weight: 1 },
      { item_id: "asuna_cosplay", weight: 1 },
      { item_id: "misa_amane_cosplay", weight: 1 },
      { item_id: "frieren_cosplay", weight: 1 },
      { item_id: "megumin_cosplay", weight: 1 },
      { item_id: "mona_cosplay", weight: 1 },
      { item_id: "2b_cosplay", weight: 1 },
      { item_id: "raiden_shogun_cosplay", weight: 1 },
      { item_id: "jinx_cosplay", weight: 1 },
      { item_id: "ryuko_matoi_cosplay", weight: 1 },
	  { item_id: "jiangshi_cosplay", weight: 1 },
      { item_id: "nezuko_cosplay", weight: 1 },
      { item_id: "spider_man_cosplay", weight: 1 },
      { item_id: "venom_cosplay", weight: 1 },
    ],
  },
};

// Sample item catalog (in real V1 you would INSERT these into crate_items table)
export const SAMPLE_CRATE_ITEMS: Record<string, Omit<CrateItem, "item_id" | "enabled">> = {
  // Common
  "classic-collar": {
    name: "Classic Collar",
    description: "A simple leather collar. The starting point of many journeys.",
    rarity: "common",
    collection: "classic",
    sell_value: 35,
  },
  "classic-ears": {
    name: "Classic Ears",
    description: "Soft pet ears. Basic but effective.",
    rarity: "common",
    collection: "classic",
    sell_value: 35,
  },
  "classic-tail": {
    name: "Classic Tail",
    description: "A modest tail plug. Gets the job done.",
    rarity: "common",
    collection: "classic",
    sell_value: 35,
  },
  "boxer": {
    name: "Boxer Briefs",
    description: "Plain and functional. The most pathetic starting point.",
    rarity: "common",
    collection: "basic",
    sell_value: 35,
  },
  "ballgag": {
    name: "Ball Gag",
    description: "A classic red ball gag. Silence is golden.",
    rarity: "common",
    collection: "classic",
    sell_value: 35,
  },
  "classic-bra": {
    name: "Classic Bra",
    description: "A basic bra that still manages to look desperate on you.",
    rarity: "common",
    collection: "classic",
    sell_value: 35,
  },
  "classic-blindfold": {
    name: "Classic Blindfold",
    description: "A simple blindfold. Helps you focus on other sensations.",
    rarity: "common",
    collection: "classic",
    sell_value: 35,
  },
  "pet-tag": {
    name: "Pet Tag",
    description: "A simple engraved tag. You now have a name.",
    rarity: "common",
    collection: "pet",
    sell_value: 35,
  },
  
  "classic-maid-outfit": {
    name: "Classic Maid Outfit",
    description: "Traditional black and white French maid dress complete with apron and frills. Service with a curtsy.",
    rarity: "common",
    collection: "maid",
    sell_value: 200,
  },
  "classic-corset": {
    name: "Classic Corset",
    description: "Structured black corset. Breathe less, look better.",
    rarity: "common",
    collection: "classic",
    sell_value: 125,
  },
  "cat-croptop": {
    name: "Cat Crop Top",
    description: "A simple crop top with cat design.",
    rarity: "common",
    collection: "classic",
    sell_value: 70,
  },
  "sneakers": {
    name: "Sneakers",
    description: "Comfortable casual athletic shoes with cushioned sole and breathable design for everyday wear.",
    rarity: "common",
    collection: "classic",
    sell_value: 70,
  },
  "classic": {
    name: "Classic",
    description: "The default full-body outfit. Simple and clean.",
    rarity: "common",
    collection: "classic",
    sell_value: 25,
  },

  // Uncommon
  "classic-buttplug": {
    name: "Classic Buttplug",
    description: "A solid, no-nonsense plug. The reliable workhorse.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 225,
  },
  "owned-tag": {
    name: "Owned Tag",
    description: "A heavy tag that says 'Owned'. Permanent reminder.",
    rarity: "uncommon",
    collection: "pet",
    sell_value: 175,
  },
  "cute-panties": {
    name: "Cute Panties",
    description: "Frilly and pink. Made to make you feel small.",
    rarity: "uncommon",
    collection: "cute",
    sell_value: 225,
  },
  "pink-bra": {
    name: "Pink Bra",
    description: "A bright pink bra. Loud and embarrassing.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 225,
  },
  "pink-blindfold": {
    name: "Pink Blindfold",
    description: "Soft pink blindfold. Darkness is a privilege.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 200,
  },
  "pink-collar": {
    name: "Pink Collar",
    description: "Cute pink collar for the more playful pets.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 200,
  },
  "pink-ears": {
    name: "Pink Ears",
    description: "Matching pink ears. Adorable and humiliating.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 200,
  },
  "classic-highheels": {
    name: "Classic High Heels",
    description: "Simple black heels. Walking in them is training.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 225,
  },
  "classic-thighhighs": {
    name: "Classic Thighhighs",
    description: "Elegant black thigh highs. A step up from basic.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 250,
  },
  "classic-skirt": {
    name: "Classic Skirt",
    description: "A short pleated skirt. You know what it means.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 250,
  },
  "pink-maid-outfit": {
    name: "Pink Maid Outfit",
    description: "A pastel pink take on the classic maid uniform. Extra cute, extra embarrassing.",
    rarity: "uncommon",
    collection: "maid",
    sell_value: 450,
  },
  "classic-bunnysuit": {
    name: "Classic Bunnysuit",
    description: "The iconic strapless bunny leotard. Ears sold separately, shame included.",
    rarity: "uncommon",
    collection: "bunny",
    sell_value: 375,
  },
  "classic-thong": {
    name: "Classic Thong",
    description: "Minimal black thong. Less fabric, more exposure.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 250,
  },
  "pink-corset": {
    name: "Pink Corset",
    description: "Playful pink corset that cinches you in all the right (wrong) ways.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 300,
  },
  "classic-anal-beads": {
    name: "Anal Beads",
    description: "Smooth graduated anal beads designed for wearable pleasure and easy control.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 200,
  },
  "classic-dildo": {
    name: "Classic Dildo",
    description: "Classic smooth dildo with realistic shape and firm yet flexible design for comfortable use.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 650,
  },
  "pink-small-vibrator": {
    name: "Pink Small Vibrator",
    description: "Compact pink small vibrator with powerful vibrations and smooth silicone finish for discreet pleasure.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 550,
  },

  // Rare
  "cute-thighhighs": {
    name: "Cute Thighhighs",
    description: "Soft and girly thigh highs. Perfect for a good pet.",
    rarity: "rare",
    collection: "cute",
    sell_value: 450,
  },
  "pink-tail": {
    name: "Pink Tail",
    description: "A fluffy pink tail to wag on command.",
    rarity: "rare",
    collection: "pink",
    sell_value: 500,
  },
  "cute-miniskirt": {
    name: "Cute Miniskirt",
    description: "Tiny and pink. Leaves very little to the imagination.",
    rarity: "rare",
    collection: "cute",
    sell_value: 575,
  },
  "latex-thighhighs": {
    name: "Latex Thighhighs",
    description: "Shiny black latex. Strict and unforgiving.",
    rarity: "rare",
    collection: "latex",
    sell_value: 525,
  },
  "latex-skirt": {
    name: "Latex Skirt",
    description: "Tight, shiny latex. Every movement is a reminder.",
    rarity: "rare",
    collection: "latex",
    sell_value: 550,
  },
  "good-boy-tag": {
    name: "Good Boy Tag",
    description: "A tag that says exactly what you want to hear.",
    rarity: "rare",
    collection: "pet",
    sell_value: 475,
  },
  "latex-maid-outfit": {
    name: "Latex Maid Outfit",
    description: "Shiny black latex version of the maid dress. Strict, tight, and perfect for cleaning on your knees.",
    rarity: "rare",
    collection: "maid",
    sell_value: 625,
  },
  "pink-bunnysuit": {
    name: "Pink Bunnysuit",
    description: "Soft pink bunny girl leotard. Hop to it, pet.",
    rarity: "rare",
    collection: "bunny",
    sell_value: 850,
  },
  "fishnet-croptop": {
    name: "Fishnet Croptop",
    description: "Open-weave fishnet crop top. Barely covers anything.",
    rarity: "rare",
    collection: "fishnet",
    sell_value: 750,
  },
  "fishnet-stockings": {
    name: "Fishnet Stockings",
    description: "Classic diamond fishnet thigh highs. The perfect accessory for any outfit.",
    rarity: "rare",
    collection: "fishnet",
    sell_value: 675,
  },
  "pink-thong": {
    name: "Pink Thong",
    description: "Bright pink micro thong. Cute and cruelly revealing.",
    rarity: "rare",
    collection: "pink",
    sell_value: 575,
  },
   "pink-sheer-bikini": {
    name: "Pink Sheer Bikini",
    description: "Flirty sheer pink bikini. The color draws the eye, the fabric hides nothing.",
    rarity: "rare",
    collection: "sheer",
    sell_value: 925,
  },
  "black-dildo": {
    name: "Black Dildo",
    description: "Deep black dildo with smooth surface and firm yet flexible design for comfortable use.",
    rarity: "rare",
    collection: "",
    sell_value: 1300,
  },
  "remote-control-vibrator": {
    name: "Remote Control Vibrator",
    description: "Wireless remote control vibrator with powerful vibrations and smooth silicone body for discreet, hands-free pleasure.",
    rarity: "rare",
    collection: "pink",
    sell_value: 1100,
  },

  // Epic
  "gorgeous-panties": {
    name: "Gorgeous Panties",
    description: "Lace and luxury. Far too nice for the likes of you.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 1250,
  },
  "gorgeous-bra": {
    name: "Gorgeous Bra",
    description: "Expensive looking lace bra. You don't deserve to wear it.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 1350,
  },
  "gorgeous-thighhighs": {
    name: "Gorgeous Thighhighs",
    description: "High quality stockings with garter straps. Pure elegance.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 1500,
  },
  "gorgeous-highheels": {
    name: "Gorgeous High Heels",
    description: "Designer heels. Walking in these is an art form.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 1200,
  },
  "gorgeous-buttplug": {
    name: "Gorgeous Buttplug",
    description: "A beautiful jeweled plug. The crown jewel of your collection.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 1650,
  },
  "gorgeous-bunnysuit": {
    name: "Gorgeous Bunnysuit",
    description: "Luxurious iridescent purple bunny suit with gem accents. High-class humiliation.",
    rarity: "epic",
    collection: "bunny",
    sell_value: 1500,
  },
  "fishnet-leotard": {
    name: "Fishnet Leotard",
    description: "Full-body black fishnet bodysuit with long sleeves. Every inch on display.",
    rarity: "epic",
    collection: "fishnet",
    sell_value: 2150,
  },
  "gorgeous-thong": {
    name: "Gorgeous Thong",
    description: "Delicate and expensive-looking thong. You don't deserve to wear something this nice.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 1100,
  },
  "gorgeous-corset": {
    name: "Gorgeous Corset",
    description: "Elegant and expensive corset. Pure luxury you can barely afford to wear.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 1750,
  },
  "gorgeous-sheer-bikini": {
    name: "Gorgeous Sheer Bikini",
    description: "Delicate sheer bikini set. Almost see-through luxury.",
    rarity: "epic",
    collection: "sheer",
    sell_value: 1300,
  },
  "rabbit-small-vibrator": {
    name: "Small Rabbit Vibrator",
    description: "Small rabbit vibrator with dual stimulation: smooth shaft and cute bunny-ear clitoral stimulator for powerful pleasure.",
    rarity: "epic",
    collection: "cute",
    sell_value: 2700,
  },

  // Legendary
  "shiny-bra": {
    name: "Shiny Bra",
    description: "Glossy and attention-grabbing. Made to be stared at.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 9300,
  },
  "shiny-panties": {
    name: "Shiny Panties",
    description: "Reflective and tight. Humiliation has never looked so polished.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 9300,
  },
  "shiny-thighhighs": {
    name: "Shiny Thighhighs",
    description: "High-gloss thigh highs. The shine draws the eye.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 9300,
  },
  "shiny-skirt": {
    name: "Shiny Skirt",
    description: "A short, glossy skirt that leaves nothing hidden.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 9300,
  },
  "shiny-highheels": {
    name: "Shiny High Heels",
    description: "Patent leather heels with a mirror finish.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 9300,
  },
  "principessas-pet": {
    name: "Principessa's Pet",
    description: "The ultimate symbol. You have been claimed.",
    rarity: "legendary",
    collection: "special",
    sell_value: 9300,
  },
  
  "vibrator": {
    name: "Vibrator",
    description: "A sleek wand-style massager. Hands-free pleasure, or punishment.",
    rarity: "legendary",
    collection: "toy",
    sell_value: 11250,
  },
  "ultra-vibrator": {
    name: "Ultra Vibrator",
    description: "Ultra vibrator with powerful vibrations and dedicated clitoral stimulator for intense dual pleasure.",
    rarity: "legendary",
    collection: "toy",
    sell_value: 17000,
  },
  "shiny-maid-outfit": {
    name: "Shiny Maid Outfit",
    description: "Glossy, eye-catching maid uniform. You’ll sparkle while you serve.",
    rarity: "legendary",
    collection: "maid",
    sell_value: 7650,
  },
  "shiny-bunnysuit": {
    name: "Shiny Bunnysuit",
    description: "Ultra glossy purple bunny leotard. Reflective, tight, and impossible to ignore.",
    rarity: "legendary",
    collection: "bunny",
    sell_value: 7100,
  },
  "shiny-thong": {
    name: "Shiny Thong",
    description: "Glossy, skin-tight shiny thong. Every curve catches the light.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 6250,
  },
  "shiny-corset": {
    name: "Shiny Corset",
    description: "High-gloss corset that hugs and shines. Restriction has never looked so polished.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 8500,
  },

  // --- New wardrobe batch (2026-07) - now in Cosplay Case, rarity randomly assigned ---
  "leather_jacket": {
    name: "Leather Jacket",
    description: "A classic black leather jacket.",
    rarity: "uncommon",
    collection: "cosplay-wardrobe",
    sell_value: 1175,
  },
  "denim_shorts": {
    name: "Denim Shorts",
    description: "Classic denim shorts.",
    rarity: "common",
    collection: "cosplay-wardrobe",
    sell_value: 200,
  },
  "knee_high_socks": {
    name: "Knee-High Socks",
    description: "Simple knee-high socks.",
    rarity: "common",
    collection: "cosplay-wardrobe",
    sell_value: 188,
  },
  "white_thighhighs": {
    name: "White Thighhighs",
    description: "Plain white thighhighs.",
    rarity: "common",
    collection: "cosplay-wardrobe",
    sell_value: 213,
  },
  "red_collar": {
    name: "Red Collar",
    description: "A simple red collar.",
    rarity: "common",
    collection: "cosplay-wardrobe",
    sell_value: 175,
  },
  "white_tie_front_shirt": {
    name: "White Tie-Front Shirt",
    description: "A white shirt tied at the front.",
    rarity: "rare",
    collection: "cosplay-wardrobe",
    sell_value: 2500,
  },
  "black_v_neck_crop_top": {
    name: "Black V-Neck Crop Top",
    description: "A fitted black V-neck crop top.",
    rarity: "rare",
    collection: "cosplay-wardrobe",
    sell_value: 2400,
  },
  "purple_crop_sweater": {
    name: "Purple Crop Sweater",
    description: "A cropped purple knit sweater.",
    rarity: "uncommon",
    collection: "cosplay-wardrobe",
    sell_value: 1225,
  },
  "black_dolphin_shorts": {
    name: "Black Dolphin Shorts",
    description: "Black high-cut dolphin shorts.",
    rarity: "epic",
    collection: "cosplay-wardrobe",
    sell_value: 5500,
  },
  "silver_vinyl_shorts": {
    name: "Silver Vinyl Shorts",
    description: "Glossy silver vinyl shorts.",
    rarity: "epic",
    collection: "cosplay-wardrobe",
    sell_value: 6250,
  },
  "black_bow_thighhighs": {
    name: "Black Bow Thighhighs",
    description: "Black thighhighs with a bow accent.",
    rarity: "uncommon",
    collection: "cosplay-wardrobe",
    sell_value: 1200,
  },
  "fireworks_crop_top": {
    name: "Fireworks Crop Top",
    description: "A crop top with a fireworks print.",
    rarity: "uncommon",
    collection: "cosplay-wardrobe",
    sell_value: 1150,
  },
  "pink_off_shoulder_sweater": {
    name: "Pink Off-Shoulder Sweater",
    description: "A cozy pink off-shoulder sweater.",
    rarity: "uncommon",
    collection: "cosplay-wardrobe",
    sell_value: 1250,
  },
  "blue_tartan_pleated_skirt": {
    name: "Blue Tartan Pleated Skirt",
    description: "A pleated blue tartan skirt.",
    rarity: "rare",
    collection: "cosplay-wardrobe",
    sell_value: 2325,
  },
  "red_tartan_pleated_skirt": {
    name: "Red Tartan Pleated Skirt",
    description: "A pleated red tartan skirt.",
    rarity: "rare",
    collection: "cosplay-wardrobe",
    sell_value: 2350,
  },
  "white_distressed_denim_shorts": {
    name: "White Distressed Denim Shorts",
    description: "Distressed white denim shorts.",
    rarity: "rare",
    collection: "cosplay-wardrobe",
    sell_value: 2375,
  },
  "black_strappy_harness_top": {
    name: "Black Strappy Harness Top",
    description: "A strappy black harness top.",
    rarity: "epic",
    collection: "cosplay-wardrobe",
    sell_value: 6500,
  },
  "red_off_shoulder_crop_top": {
    name: "Red Off-Shoulder Crop Top",
    description: "A red off-shoulder crop top.",
    rarity: "rare",
    collection: "cosplay-wardrobe",
    sell_value: 2450,
  },
  "red_satin_halter_bra": {
    name: "Red Satin Halter Bra",
    description: "A satin red halter bra.",
    rarity: "epic",
    collection: "cosplay-wardrobe",
    sell_value: 6000,
  },
  "white_off_shoulder_crop_top": {
    name: "White Off-Shoulder Crop Top",
    description: "A white off-shoulder crop top.",
    rarity: "rare",
    collection: "cosplay-wardrobe",
    sell_value: 2300,
  },
  "pink_dolphin_shorts": {
    name: "Pink Dolphin Shorts",
    description: "Pink high-cut dolphin shorts.",
    rarity: "epic",
    collection: "cosplay-wardrobe",
    sell_value: 5750,
  },

  // Cosplay Case - Full Set items (see FULL_SET_ITEM_IDS in avatar-slots.ts).
  // Equipping one replaces the base model + every layer with a single
  // pre-rendered illustration instead of adding a wardrobe layer.
  "2b_cosplay": {
    name: "2B Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 25000,
  },
  "ada_wong_cosplay": {
    name: "Ada Wong Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 17500,
  },
  "astolfo_cosplay": {
    name: "Astolfo Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 21250,
  },
  "asuka_cosplay": {
    name: "Asuka Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 20000,
  },
  "asuna_cosplay": {
    name: "Asuna Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 17500,
  },
  "chunli_cosplay": {
    name: "Chun-Li Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 22500,
  },
  "frieren_cosplay": {
    name: "Frieren Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 17500,
  },
  "jinx_cosplay": {
    name: "Jinx Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 27500,
  },
  "lara_croft_cosplay": {
    name: "Lara Croft Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 20000,
  },
  "megumin_cosplay": {
    name: "Megumin Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 17500,
  },
  "misa_amane_cosplay": {
    name: "Misa Amane Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 27500,
  },
  "mona_cosplay": {
    name: "Mona Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 22500,
  },
  "raiden_shogun_cosplay": {
    name: "Raiden Shogun Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 25000,
  },
  "ryuko_matoi_cosplay": {
    name: "Ryuko Matoi Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 30000,
  },
  "tifa_lockhart_cosplay": {
    name: "Tifa Lockhart Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 18750,
  },

  // --- New wardrobe batch (2026-07, round 2) - rarity/sell_value are
  // placeholders, to be finalized separately. ---
  "ruined_makeup": {
    name: "Ruined Makeup",
    description: "Streaked mascara and tears. Proof you couldn't hold it together.",
    rarity: "common",
    collection: "makeup",
    sell_value: 163,
  },
  "black_lips": {
    name: "Black Lips",
    description: "Bold black lipstick. Striking and a little dangerous.",
    rarity: "uncommon",
    collection: "makeup",
    sell_value: 800,
  },
  "red_lips": {
    name: "Red Lips",
    description: "Classic red lipstick. Impossible to ignore.",
    rarity: "common",
    collection: "makeup",
    sell_value: 125,
  },
  "cat_panties": {
    name: "Cat Panties",
    description: "Playful panties with a cat print. Meow.",
    rarity: "epic",
    collection: "cat",
    sell_value: 4000,
  },
  "cat-bra": {
    name: "Cat Bra",
    description: "A bra with a playful cat motif.",
    rarity: "epic",
    collection: "cat",
    sell_value: 4500,
  },
  "cute_short_shorts": {
    name: "Cute Short Shorts",
    description: "Snug little shorts that leave nothing to guess.",
    rarity: "uncommon",
    collection: "cute",
    sell_value: 225,
  },
  "cute_choker": {
    name: "Cute Choker",
    description: "A delicate choker with a little charm. Sweet and simple.",
    rarity: "common",
    collection: "cute",
    sell_value: 95,
  },
  "cute_dress": {
    name: "Cute Dress",
    description: "A soft, girly dress. Innocent on the outside.",
    rarity: "rare",
    collection: "cute",
    sell_value: 1600,
  },
  "cute_bra": {
    name: "Cute Bra",
    description: "A soft pastel bra with delicate trim.",
    rarity: "rare",
    collection: "cute",
    sell_value: 550,
  },
  "cute_sneakers": {
    name: "Cute Sneakers",
    description: "Pastel sneakers with a playful bow.",
    rarity: "uncommon",
    collection: "cute",
    sell_value: 175,
  },
  "fishnet_panties": {
    name: "Fishnet Panties",
    description: "Open-weave fishnet panties. Barely there.",
    rarity: "epic",
    collection: "fishnet",
    sell_value: 4250,
  },
  "red_fishnet_shorts": {
    name: "Red Fishnet Shorts",
    description: "Fishnet shorts with a bold red trim.",
    rarity: "legendary",
    collection: "fishnet",
    sell_value: 12000,
  },
  "red_fishnet_croptop": {
    name: "Red Fishnet Croptop",
    description: "Fishnet crop top with a fiery red trim.",
    rarity: "legendary",
    collection: "fishnet",
    sell_value: 12500,
  },
  "latex_panties": {
    name: "Latex Panties",
    description: "Skin-tight latex panties. Shiny and unforgiving.",
    rarity: "epic",
    collection: "latex",
    sell_value: 1100,
  },
  "latex_gloves": {
    name: "Latex Gloves",
    description: "Glossy latex gloves that grip tight.",
    rarity: "rare",
    collection: "latex",
    sell_value: 1350,
  },
  "latex_bra": {
    name: "Latex Bra",
    description: "A tight latex bra, glossy and severe.",
    rarity: "epic",
    collection: "latex",
    sell_value: 1100,
  },
  "dominatrix_boots": {
    name: "Dominatrix Boots",
    description: "Tall latex boots built for command.",
    rarity: "legendary",
    collection: "latex",
    sell_value: 10000,
  },
  "red_office_skirt": {
    name: "Red Office Skirt",
    description: "A tight red pencil skirt. Dress code: obedience.",
    rarity: "common",
    collection: "office",
    sell_value: 175,
  },
  "classic_gloves": {
    name: "Classic Gloves",
    description: "Simple fitted gloves. A basic finishing touch.",
    rarity: "common",
    collection: "classic",
    sell_value: 113,
  },
  "pink_gloves": {
    name: "Pink Gloves",
    description: "Soft pink gloves for delicate hands.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 775,
  },
  "pink_highheels": {
    name: "Pink High Heels",
    description: "Bright pink heels. Loud and confident.",
    rarity: "epic",
    collection: "pink",
    sell_value: 1200,
  },

  // --- New wardrobe batch (2026-07, round 3) - rarity/sell_value are
  // placeholders, to be finalized separately. ---
  "cat_ears": {
    name: "Cat Ears",
    description: "Perky cat ears. Purr on command.",
    rarity: "uncommon",
    collection: "cat",
    sell_value: 725,
  },
  "cat_collar": {
    name: "Cat Collar",
    description: "A collar with a little bell. Everyone hears you coming.",
    rarity: "uncommon",
    collection: "cat",
    sell_value: 700,
  },
  "cat_croptop": {
    name: "Cat Camisole",
    description: "A slinky camisole with a playful cat motif.",
    rarity: "uncommon",
    collection: "cat",
    sell_value: 850,
  },
  "cat_short_shorts": {
    name: "Cat Short Shorts",
    description: "Tiny shorts with a cat-print trim.",
    rarity: "rare",
    collection: "cat",
    sell_value: 1475,
  },
  "cat_thighhighs": {
    name: "Cat Thighhighs",
    description: "Thighhighs with a paw-print pattern.",
    rarity: "rare",
    collection: "cat",
    sell_value: 1500,
  },
  "cat_sneakers": {
    name: "Cat Sneakers",
    description: "Sneakers with a cute cat design.",
    rarity: "epic",
    collection: "cat",
    sell_value: 3500,
  },
  "pink_panties": {
    name: "Pink Panties",
    description: "Simple pink panties. Soft and unassuming.",
    rarity: "epic",
    collection: "pink",
    sell_value: 1250,
  },
  "pink_camisole": {
    name: "Pink Camisole",
    description: "A silky pink camisole. Delicate and revealing.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 900,
  },
  "pink_thighhighs": {
    name: "Pink Thighhighs",
    description: "Soft pink thighhighs to match the rest of the set.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 250,
  },
  "pink_lips": {
    name: "Pink Lips",
    description: "Soft pink lipstick. Sweet and inviting.",
    rarity: "common",
    collection: "pink",
    sell_value: 138,
  },
  "cute_gloves": {
    name: "Cute Gloves",
    description: "Soft pastel gloves with a delicate trim.",
    rarity: "uncommon",
    collection: "cute",
    sell_value: 825,
  },
  "fishnet_choker": {
    name: "Fishnet Choker",
    description: "An open-weave fishnet choker. Barely there.",
    rarity: "uncommon",
    collection: "fishnet",
    sell_value: 150,
  },
  "latex_tape": {
    name: "Latex Tape",
    description: "Glossy latex tape sealed tight over the mouth.",
    rarity: "uncommon",
    collection: "latex",
    sell_value: 275,
  },

  // --- New wardrobe batch (2026-07, round 4) - discipline toys. ---
  "latex_whip": {
    name: "Latex Whip",
    description: "A glossy latex whip. Every crack is a warning.",
    rarity: "common",
    collection: "latex",
    sell_value: 250,
  },
  "cat_o_nine_tails": {
    name: "Cat-o'-Nine-Tails",
    description: "Nine braided tails. Purr through it.",
    rarity: "rare",
    collection: "cat",
    sell_value: 1525,
  },
  "pink_paddle": {
    name: "Pink Paddle",
    description: "A cute pink paddle. Sting comes in pastel too.",
    rarity: "common",
    collection: "pink",
    sell_value: 225,
  },
  "pink_feather_tickler": {
    name: "Pink Feather Tickler",
    description: "A soft pink feather tickler. Sensation, not punishment.",
    rarity: "rare",
    collection: "pink",
    sell_value: 1375,
  },
  "ruler": {
    name: "Ruler",
    description: "A strict wooden ruler. Class is in session.",
    rarity: "rare",
    collection: "office",
    sell_value: 1400,
  },
  "spiked_collar": {
    name: "Spiked Collar",
    description: "A glossy black collar ringed with metal spikes.",
    rarity: "epic",
    collection: "latex",
    sell_value: 3625,
  },

  // --- New wardrobe batch (2026-07, round 5) ---
  "sharp_eyes": {
    name: "Sharp Eyes",
    description: "Sharp winged eyeliner. A look that cuts.",
    rarity: "common",
    collection: "makeup",
    sell_value: 85,
  },
  "blacked_panties": {
    name: "Blacked Panties",
    description: "Branded black panties. A statement, not a secret.",
    rarity: "legendary",
    collection: "blacked",
    sell_value: 11000,
  },
  "blacked_bra": {
    name: "Blacked Bra",
    description: "A branded black bra to match.",
    rarity: "legendary",
    collection: "blacked",
    sell_value: 11500,
  },
  "blacked_leggings": {
    name: "Blacked Leggings",
    description: "Branded black leggings, waist to ankle.",
    rarity: "epic",
    collection: "blacked",
    sell_value: 3875,
  },
  "bimbo_collar": {
    name: "Bimbo Collar",
    description: "A glossy black collar that spells it out.",
    rarity: "epic",
    collection: "bimbo",
    sell_value: 5250,
  },
  "qos_tattoo": {
    name: "QOS Tattoo",
    description: "A small inked spade. Everyone knows what it means.",
    rarity: "uncommon",
    collection: "bimbo",
    sell_value: 675,
  },
  "slingshot_swimsuit": {
    name: "Slingshot Swimsuit",
    description: "A minimal slingshot one-piece. Barely a swimsuit.",
    rarity: "legendary",
    collection: "swim",
    sell_value: 10500,
  },
  "white_fingerless_sports_gloves": {
    name: "White Fingerless Sports Gloves",
    description: "Fingerless athletic gloves for grip and show.",
    rarity: "uncommon",
    collection: "sport",
    sell_value: 750,
  },
  "white_sneakers": {
    name: "White Sneakers",
    description: "Clean white athletic sneakers.",
    rarity: "common",
    collection: "sport",
    sell_value: 150,
  },
  "white_sports_bra": {
    name: "White Sports Bra",
    description: "A supportive white sports bra.",
    rarity: "rare",
    collection: "sport",
    sell_value: 1425,
  },
  "white_sport_pants": {
    name: "White Sport Pants",
    description: "Sleek white athletic leggings.",
    rarity: "rare",
    collection: "sport",
    sell_value: 1450,
  },
  "pink_yoga_pants": {
    name: "Pink Yoga Pants",
    description: "Soft pink high-waisted yoga pants.",
    rarity: "epic",
    collection: "pink",
    sell_value: 3750,
  },
  "ripped_jeans": {
    name: "Ripped Jeans",
    description: "Distressed skinny jeans, torn at the knees.",
    rarity: "common",
    collection: "grunge",
    sell_value: 85,
  },
  // These three ship as .png rather than the default .webp, so image_url is
  // set explicitly - getCrateItemImageUrl only auto-resolves .png for the
  // "cosplay" collection.
  "jeans_with_red_thong": {
    name: "Jeans With Red Thong",
    description: "Low-rise jeans worn just low enough to show the red thong underneath.",
    image_url: "/crate-items/jeans_with_red_thong.png",
    rarity: "epic",
    collection: "grunge",
    // Kitten Case epic band sits at 7000-8000 (cat_sneakers 7000,
    // spiked_collar 7250, pink_yoga_pants 7500, blacked_leggings 7750).
    sell_value: 3700,
  },
  "gyaru_shirt": {
    name: "Gyaru Shirt",
    description: "A loose gyaru-cut shirt, knotted high and worn off one shoulder.",
    image_url: "/crate-items/gyaru_shirt.png",
    rarity: "rare",
    collection: "cosplay-wardrobe",
    // Obedience Case rare band, just under black_v_neck_crop_top (4800) and
    // white_distressed_denim_shorts (4750), which is why it carries a slightly
    // higher drop weight than both.
    sell_value: 2350,
  },
  "pink_bandeau_top": {
    name: "Pink Bandeau Top",
    description: "A strapless pink band that stays up on attitude alone.",
    image_url: "/crate-items/pink_bandeau_top.png",
    rarity: "rare",
    collection: "pink",
    // Kitten Case rare band sits at 2700-3100 (latex_gloves 2700,
    // white_sports_bra 2850, white_sport_pants 2900, latex_leggings 3100).
    sell_value: 1400,
  },
  "latex_leggings": {
    name: "Latex Leggings",
    description: "Skin-tight glossy latex, waist to ankle.",
    rarity: "rare",
    collection: "latex",
    sell_value: 1550,
  },
  "black_garter_stockings": {
    name: "Black Garter Stockings",
    description: "Sheer black stockings with an attached garter belt.",
    rarity: "uncommon",
    collection: "garter",
    sell_value: 1125,
  },
  "pink_garter_stockings": {
    name: "Pink Garter Stockings",
    description: "Sheer pink stockings with an attached garter belt.",
    rarity: "rare",
    collection: "garter",
    sell_value: 2250,
  },
  "red_garter_stockings": {
    name: "Red Garter Stockings",
    description: "Sheer red stockings with an attached garter belt.",
    rarity: "rare",
    collection: "garter",
    sell_value: 2275,
  },
  "white_garter_stockings": {
    name: "White Garter Stockings",
    description: "Sheer white stockings with an attached garter belt.",
    rarity: "epic",
    collection: "garter",
    sell_value: 5000,
  },

  // Full Set items (see FULL_SET_ITEM_IDS in avatar-slots.ts) - original
  // themed sets, not tied to a licensed character. Epic, not legendary.
  "angel": {
    name: "Angel",
    description: "A fully rendered angel set.",
    rarity: "epic",
    collection: "angel",
    sell_value: 5000,
  },
  "bimbo_set": {
    name: "Bimbo Set",
    description: "A fully rendered bimbo set.",
    rarity: "epic",
    collection: "bimbo",
    sell_value: 7500,
  },
  "grunge_girl": {
    name: "Grunge Girl",
    description: "A fully rendered grunge set.",
    rarity: "epic",
    collection: "grunge",
    sell_value: 2850,
  },
  "ponyplay": {
    name: "Ponyplay",
    description: "A fully rendered ponyplay set.",
    rarity: "legendary",
    collection: "ponyplay",
    sell_value: 13500,
  },
  "succubus": {
    name: "Succubus",
    description: "A fully rendered succubus set.",
    rarity: "epic",
    collection: "succubus",
    sell_value: 8000,
  },

  // --- New wardrobe batch (2026-08). Art placed by
  // scripts/place-item-art.mjs; icons resolve to /crate-items/<id>.webp,
  // except the cosplay full sets which getCrateItemImageUrl serves as .png.
  "maid_headband": {
    name: "Maid Headband",
    description: "White lace band. The uniform starts at the head.",
    rarity: "common",
    collection: "maid",
    sell_value: 200,
  },
  "pearl_drop_earrings": {
    name: "Pearl Drop Earrings",
    description: "Small, tasteful, and worth more than your opinion.",
    rarity: "common",
    collection: "gorgeous",
    sell_value: 275,
  },
  "smokey_eyes": {
    name: "Smokey Eyes",
    description: "Smudged dark shadow. Looks better after crying.",
    rarity: "common",
    collection: "makeup",
    sell_value: 225,
  },
  "beach_bangles": {
    name: "Beach Bangles",
    description: "Thin gold bangles that rattle when your hands shake.",
    rarity: "common",
    collection: "summer",
    sell_value: 150,
  },
  "black_nails": {
    name: "Black Nails",
    description: "Chipped black polish. You bite them when she is late.",
    rarity: "common",
    collection: "makeup",
    sell_value: 325,
  },
  "black_platform_boots": {
    name: "Black Platform Boots",
    description: "Heavy soles. You will still kneel in them.",
    rarity: "common",
    collection: "grunge",
    sell_value: 375,
  },
  "strappy_sandals": {
    name: "Strappy Sandals",
    description: "Thin straps, high arch, nowhere to hide.",
    rarity: "common",
    collection: "summer",
    sell_value: 250,
  },
  "barcode_tattoo": {
    name: "Barcode Tattoo",
    description: "Inked on the nape. Scan it and it says property.",
    rarity: "common",
    collection: "ink",
    sell_value: 125,
  },
  "owned_tattoo": {
    name: "Owned Tattoo",
    description: "One word across the skin. It does not wash off.",
    rarity: "common",
    collection: "ink",
    sell_value: 100,
  },
  "qos_leg_tattoo": {
    name: "QOS Leg Tattoo",
    description: "A spade high on the thigh. Everyone knows what it means.",
    rarity: "common",
    collection: "blacked",
    sell_value: 125,
  },
  "bbc_owned_tshirt": {
    name: "BBC Owned T-shirt",
    description: "Printed across the chest. You picked it out yourself.",
    rarity: "common",
    collection: "blacked",
    sell_value: 400,
  },
  "black_lace_panties": {
    name: "Black Lace Panties",
    description: "Sheer black lace. Barely a formality.",
    rarity: "uncommon",
    collection: "lace",
    sell_value: 925,
  },
  "cute_high_waist_skirt": {
    name: "High-Waist Skirt",
    description: "Cinched at the waist, short everywhere else.",
    rarity: "uncommon",
    collection: "cute",
    sell_value: 650,
  },
  "gold_micro_thong": {
    name: "Gold Micro Thong",
    description: "Two gold strings and a decision.",
    rarity: "uncommon",
    collection: "gold",
    sell_value: 800,
  },
  "cow_bell_collar": {
    name: "Cow Bell Collar",
    description: "She hears you coming from the next room.",
    rarity: "uncommon",
    collection: "dairy",
    sell_value: 775,
  },
  "fangs": {
    name: "Fangs",
    description: "Sharp little points. Decorative, mostly.",
    rarity: "uncommon",
    collection: "gothic",
    sell_value: 600,
  },
  "wine_lipstick": {
    name: "Wine Lipstick",
    description: "Deep red. It transfers onto everything.",
    rarity: "uncommon",
    collection: "makeup",
    sell_value: 700,
  },
  "black_lace_bra": {
    name: "Black Lace Bra",
    description: "Matching black lace, and it hides nothing.",
    rarity: "uncommon",
    collection: "lace",
    sell_value: 875,
  },
  "cute_crop_camisole": {
    name: "Crop Camisole",
    description: "Thin straps, cropped short, softly ribbed.",
    rarity: "uncommon",
    collection: "cute",
    sell_value: 575,
  },
  "gold_bra": {
    name: "Gold Bra",
    description: "Polished gold cups. Expensive and unsubtle.",
    rarity: "uncommon",
    collection: "gold",
    sell_value: 825,
  },
  "pink_satin_bra": {
    name: "Pink Satin Bra",
    description: "Cool satin in her favourite colour.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 725,
  },
  "summer_tie_bikini_top": {
    name: "Tie Bikini Top",
    description: "Held on by two bows anyone could pull.",
    rarity: "uncommon",
    collection: "summer",
    sell_value: 900,
  },
  "white_lace_bra": {
    name: "White Lace Bra",
    description: "White lace. Innocent until it is not.",
    rarity: "uncommon",
    collection: "lace",
    sell_value: 975,
  },
  "black_mini_skirt": {
    name: "Black Mini Skirt",
    description: "Short, plain, and always riding up.",
    rarity: "rare",
    collection: "classic",
    sell_value: 1200,
  },
  "cow_print_panties": {
    name: "Cow Print Panties",
    description: "Spotted print. The set is not a coincidence.",
    rarity: "rare",
    collection: "dairy",
    sell_value: 1450,
  },
  "green_sarong": {
    name: "Green Sarong",
    description: "Knotted at the hip, sheer enough to be pointless.",
    rarity: "rare",
    collection: "summer",
    sell_value: 1350,
  },
  "summer_tie_side_panties": {
    name: "Tie-Side Panties",
    description: "Two bows at the hips. One tug each.",
    rarity: "rare",
    collection: "summer",
    sell_value: 1250,
  },
  "cow_ears": {
    name: "Cow Ears",
    description: "Soft spotted ears. You wear them without arguing.",
    rarity: "rare",
    collection: "dairy",
    sell_value: 1150,
  },
  "shibari_harness_with_black_bikini": {
    name: "Shibari Harness & Bikini",
    description: "Rope over black fabric, tied to be looked at.",
    rarity: "rare",
    collection: "shibari",
    sell_value: 1750,
  },
  "lace_gloves": {
    name: "Lace Gloves",
    description: "Sheer to the elbow. Useless and lovely.",
    rarity: "rare",
    collection: "lace",
    sell_value: 1400,
  },
  "tongue_out": {
    name: "Tongue Out",
    description: "Mouth open, tongue out. No thought behind it.",
    rarity: "rare",
    collection: "makeup",
    sell_value: 1600,
  },
  "cow_print_bra": {
    name: "Cow Print Bra",
    description: "Spotted and cropped. The herd look, completed.",
    rarity: "rare",
    collection: "dairy",
    sell_value: 1550,
  },
  "crotch_pasties": {
    name: "Crotch Pasties",
    description: "Adhesive and nothing else. Technically dressed.",
    rarity: "epic",
    collection: "pasties",
    sell_value: 5500,
  },
  "white_lace_panties": {
    name: "White Lace Panties",
    description: "Fine white lace. Bridal, if you squint.",
    rarity: "epic",
    collection: "lace",
    sell_value: 5200,
  },
  "ahegao_eyes": {
    name: "Ahegao Eyes",
    description: "Rolled back and unfocused. Nobody is home.",
    rarity: "epic",
    collection: "bimbo",
    sell_value: 4300,
  },
  "cow_legs": {
    name: "Cow Legs",
    description: "Spotted stockings into hooves. Legs and feet, one piece.",
    rarity: "epic",
    collection: "dairy",
    sell_value: 4000,
  },
  "victorian_boots": {
    name: "Victorian Boots",
    description: "Buttoned to the thigh. Nothing goes under them.",
    rarity: "epic",
    collection: "gothic",
    sell_value: 4400,
  },
  "ballet_heels": {
    name: "Ballet Heels",
    description: "Vertical, locked, and impossible to stand in for long.",
    rarity: "epic",
    collection: "latex",
    sell_value: 4150,
  },
  "womb_tattoo": {
    name: "Womb Tattoo",
    description: "Inked low on the belly. Marked where it counts.",
    rarity: "epic",
    collection: "ink",
    sell_value: 4700,
  },
  "nipple_pasties": {
    name: "Nipple Pasties",
    description: "Two small stars. That is the entire top.",
    rarity: "epic",
    collection: "pasties",
    sell_value: 5600,
  },
  "shredded_fishnet_top": {
    name: "Shredded Fishnet Top",
    description: "Torn wide open. It stopped covering anything.",
    rarity: "epic",
    collection: "fishnet",
    sell_value: 4800,
  },
  "ripped_denim_thong": {
    name: "Ripped Denim Thong",
    description: "Denim cut down until only the idea is left.",
    rarity: "legendary",
    collection: "grunge",
    sell_value: 12000,
  },
  "bat_hairpins": {
    name: "Bat Hairpins",
    description: "Small silver bats holding it all back.",
    rarity: "legendary",
    collection: "gothic",
    sell_value: 10750,
  },
  "gothic_lolita_dress": {
    name: "Gothic Lolita Dress",
    description: "Layered black frills, ribbon, and a great deal of lace.",
    rarity: "legendary",
    collection: "gothic",
    sell_value: 13500,
  },
  "sexy_officer_cosplay": {
    name: "Officer Cosplay",
    description: "Badge, cap, and absolutely no authority.",
    rarity: "epic",
    collection: "cosplay",
    sell_value: 5100,
  },
  "witch_cosplay": {
    name: "Witch Cosplay",
    description: "Hat, hooks, and a very short hem.",
    rarity: "epic",
    collection: "cosplay",
    sell_value: 5350,
  },
  "jiangshi_cosplay": {
    name: "Jiangshi Cosplay",
    description: "Talisman on the forehead, arms out, hopping.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 18000,
  },
  "nezuko_cosplay": {
    name: "Nezuko Cosplay",
    description: "Bamboo, pink kimono, and a muzzled mouth.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 16000,
  },
  "spider_man_cosplay": {
    name: "Spider Man Cosplay",
    description: "Skin-tight webbing from neck to toe.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 17000,
  },
  "venom_cosplay": {
    name: "Venom Cosplay",
    description: "Black, wet-looking, and far too tight.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 15000,
  },
};

export const ALL_LEGENDARY_ITEM_IDS = Object.keys(SAMPLE_CRATE_ITEMS).filter(
  (id) => SAMPLE_CRATE_ITEMS[id].rarity === "legendary"
);

export function getRarityColor(rarity: CrateRarity): string {
  return RARITY_COLORS[rarity] ?? RARITY_COLORS.common;
}

/**
 * Otomatik image_url üretici.
 * Eğer item tanımında image_url verilmemişse, /crate-items/{item_id}.webp olarak otomatik oluşturur.
 */
export function getCrateItemImageUrl(itemId: string, provided?: string | null): string | null {
  // Full Set collectible portraits are intentionally transparent PNG icons.
  // Prefer the local icon over legacy database rows that still point to a
  // previous .webp thumbnail.
  if (SAMPLE_CRATE_ITEMS[itemId]?.collection === "cosplay") {
    return `/crate-items/${itemId}.png`;
  }
  if (provided) return provided;
  return `/crate-items/${itemId}.webp`;
}

/**
 * Principessa Case (or future crates) icon.
 * Defaults to /crate-icons/{crateType-kebab}.webp
 * e.g. "principessa_case" → "/crate-icons/principessa-case.webp"
 * You can override per-crate by putting icon_url in the CRATE_TYPES entry.
 */
export function getCrateIconUrl(crateType: string, provided?: string | null): string | null {
  if (provided) return provided;
  const fileName = crateType.replace(/_/g, "-");
  return `/crate-icons/${fileName}.webp`;
}

export function getCrateItemSellValue(itemId: string): number | null {
  return SAMPLE_CRATE_ITEMS[itemId]?.sell_value ?? null;
}

export function getCrateItemDropChancePercent(crateType: string, itemId: string): number | null {
  const crate = CRATE_TYPES[crateType];
  if (!crate) {
    return null;
  }

  const totalWeight = crate.drops.reduce((sum, drop) => sum + drop.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }

  const itemWeight = crate.drops
    .filter((drop) => drop.item_id === itemId)
    .reduce((sum, drop) => sum + drop.weight, 0);

  if (itemWeight <= 0) {
    return null;
  }

  return (itemWeight / totalWeight) * 100;
}
