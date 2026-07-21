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
    cost: 1500,
    enabled: true,
    drops: [
      // === COMPLETE LIST OF ALL 39 ITEMS (matching your 39 images) ===
      // Weights distributed for fair but exciting drops (higher for common, low for legendary)
      // Total weight = 10000

      // Common %45
	  { item_id: "classic-pawmitts", weight: 450 },
	  { item_id: "pet-tag", weight: 450 },
	  { item_id: "white-pawmitts", weight: 450 },
      { item_id: "classic-collar", weight: 450 },
      { item_id: "classic-ears", weight: 450 },
      { item_id: "classic-tail", weight: 450 },
	  { item_id: "boxer", weight: 450 },
      { item_id: "classic-blindfold", weight: 450 },
	  { item_id: "classic-bra", weight: 450 },
	  { item_id: "ballgag", weight: 450 },

      // Uncommon %25
	  { item_id: "owned-tag", weight: 430 },
	  { item_id: "pink-collar", weight: 380 },
      { item_id: "pink-ears", weight: 330 },
	  { item_id: "pink-blindfold", weight: 290 },
      { item_id: "cute-panties", weight: 250 },
	  { item_id: "classic-buttplug", weight: 220 },
	  { item_id: "pink-bra", weight: 190 },
      { item_id: "classic-highheels", weight: 160 },
      { item_id: "classic-skirt", weight: 140 },
      { item_id: "classic-thighhighs", weight: 110 },

      // Rare %17
	  { item_id: "good-boy-tag", weight: 430 },
	  { item_id: "pink-tail", weight: 360 },
      { item_id: "latex-thighhighs", weight: 300 },
	  { item_id: "latex-skirt", weight: 210 },
	  { item_id: "cute-miniskirt", weight: 250 },
	  { item_id: "cute-thighhighs", weight: 150 },
	  

      // Epic %12.5
	  { item_id: "gorgeous-pawmitts", weight: 330 },
	  { item_id: "gorgeous-highheels", weight: 270 },
	  { item_id: "gorgeous-panties", weight: 220 },
      { item_id: "gorgeous-bra", weight: 180 },
      { item_id: "gorgeous-thighhighs", weight: 150 },
	  { item_id: "gorgeous-buttplug", weight: 100 },

      // Legendary %0.5
	  { item_id: "shiny-highheels", weight: 20 },
	  { item_id: "shiny-bra", weight: 12 },
      { item_id: "shiny-panties", weight: 6 },
      { item_id: "shiny-skirt", weight: 5 },
      { item_id: "shiny-thighhighs", weight: 5 },
      { item_id: "shiny_pawmitts", weight: 1 },
      { item_id: "principessas-pet", weight: 1 },
    ],
  },
  
  blessing_case: {
    name: "0.5% Blessing Case",
    description: "Open the 0.6% Blessing Case • Pray for the Goddess’s rare favor • Only the luckiest pets receive Her blessing.",
    cost: 300,
    enabled: true,
    drops: [
      // === COMPLETE LIST OF ALL 39 ITEMS (matching your 39 images) ===
      // Weights distributed for fair but exciting drops (higher for common, low for legendary)
      // Total weight = 100000

      // Common
      { item_id: "boxer", weight: 9950 },
      { item_id: "classic-collar", weight: 9950 },
      { item_id: "classic-ears", weight: 9950 },
      { item_id: "classic-tail", weight: 9950 },
      { item_id: "white-pawmitts", weight: 9950 },
	  { item_id: "ballgag", weight: 9950 },
	  { item_id: "pet-tag", weight: 9950 },
	  { item_id: "classic-bra", weight: 9950 },
      { item_id: "classic-blindfold", weight: 9950 },
      { item_id: "classic-pawmitts", weight: 9950 },

      // Legendary 500
	  { item_id: "shiny-bra", weight: 90 },
      { item_id: "shiny-highheels", weight: 90 },
      { item_id: "shiny-panties", weight: 80 },
      { item_id: "shiny-skirt", weight: 80 },
      { item_id: "shiny-thighhighs", weight: 80 },
      { item_id: "principessas-pet", weight: 80 },
    ],
  },
  
  premium_case: {
    name: "Premium Case",
    description: "A balanced case with reliable rewards, enhanced odds, and the chance to unlock truly valuable treasures.",
    cost: 3500,
    enabled: true,
    drops: [
      // === COMPLETE LIST OF ALL 39 ITEMS (matching your 39 images) ===
      // Weights distributed for fair but exciting drops (higher for common, low for legendary)
      // Total weight = 10000

      // Common %34
	  { item_id: "sneakers", weight: 1200 },
	  { item_id: "cat-croptop", weight: 1200 },
	  { item_id: "classic-corset", weight: 650 },
      { item_id: "classic-maid-outfit", weight: 350 },
		
	  // Uncommon %28
	  { item_id: "classic-anal-beads", weight: 700 },
	  { item_id: "classic-thong", weight: 600 },
	  { item_id: "pink-corset", weight: 500 },
	  { item_id: "classic-bunnysuit", weight: 400 },
	  { item_id: "pink-maid-outfit", weight: 300 },
	  { item_id: "pink-small-vibrator", weight: 200 },
	  { item_id: "classic-dildo", weight: 100 },
	  
	  //Rare %20
	  { item_id: "pink-thong", weight: 420 },
	  { item_id: "latex-maid-outfit", weight: 360 },
	  { item_id: "fishnet-stockings", weight: 310 },
	  { item_id: "fishnet-croptop", weight: 270 },
	  { item_id: "pink-bunnysuit", weight: 230 },
	  { item_id: "pink-sheer-bikini", weight: 180 },
	  { item_id: "remote-control-vibrator", weight: 140 },
	  { item_id: "black-dildo", weight: 90 },
	  
	  // Epic %15
	  { item_id: "gorgeous-thong", weight: 450 },
	  { item_id: "gorgeous-sheer-bikini", weight: 350 },
	  { item_id: "gorgeous-bunnysuit", weight: 260 },
	  { item_id: "gorgeous-corset", weight: 200 },
	  { item_id: "fishnet-leotard", weight: 150 },
	  { item_id: "rabbit-small-vibrator", weight: 90 },
	  
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
    name: "Cosplay Case",
    description: "An exclusive case of full-body cosplay illustrations.",
    cost: 5000,
    enabled: true,
    drops: [
      // Common %58
	  { item_id: "red_collar", weight: 1600 },
      { item_id: "knee_high_socks", weight: 1500 },
	  { item_id: "denim_shorts", weight: 1400 },
      { item_id: "white_thighhighs", weight: 1300 },

      // Uncommon %20
	  { item_id: "fireworks_crop_top", weight: 500 },
	  { item_id: "leather_jacket", weight: 450 },
	  { item_id: "black_bow_thighhighs", weight: 400 },
      { item_id: "purple_crop_sweater", weight: 350 },
	  { item_id: "pink_off_shoulder_sweater", weight: 300 },

      // Rare %12
      { item_id: "white_off_shoulder_crop_top", weight: 215 },
      { item_id: "blue_tartan_pleated_skirt", weight: 200 },
      { item_id: "red_tartan_pleated_skirt", weight: 190 },
      { item_id: "white_distressed_denim_shorts", weight: 175 },
	  { item_id: "red_off_shoulder_crop_top", weight: 150 },
	  { item_id: "black_v_neck_crop_top", weight: 145 },
	  { item_id: "white_tie_front_shirt", weight: 125 },

      // Epic %8
	  { item_id: "black_dolphin_shorts", weight: 215 },
	  { item_id: "pink_dolphin_shorts", weight: 180 },
      { item_id: "red_satin_halter_bra", weight: 150 },
      { item_id: "silver_vinyl_shorts", weight: 130 },
	  { item_id: "black_strappy_harness_top", weight: 125 },

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
};

// Sample item catalog (in real V1 you would INSERT these into crate_items table)
export const SAMPLE_CRATE_ITEMS: Record<string, Omit<CrateItem, "item_id" | "enabled">> = {
  // Common
  "classic-collar": {
    name: "Classic Collar",
    description: "A simple leather collar. The starting point of many journeys.",
    rarity: "common",
    collection: "classic",
    sell_value: 100,
  },
  "classic-ears": {
    name: "Classic Ears",
    description: "Soft pet ears. Basic but effective.",
    rarity: "common",
    collection: "classic",
    sell_value: 100,
  },
  "classic-tail": {
    name: "Classic Tail",
    description: "A modest tail plug. Gets the job done.",
    rarity: "common",
    collection: "classic",
    sell_value: 100,
  },
  "boxer": {
    name: "Boxer Briefs",
    description: "Plain and functional. The most pathetic starting point.",
    rarity: "common",
    collection: "basic",
    sell_value: 100,
  },
  "ballgag": {
    name: "Ball Gag",
    description: "A classic red ball gag. Silence is golden.",
    rarity: "common",
    collection: "classic",
    sell_value: 100,
  },
  "classic-bra": {
    name: "Classic Bra",
    description: "A basic bra that still manages to look desperate on you.",
    rarity: "common",
    collection: "classic",
    sell_value: 100,
  },
  "white-pawmitts": {
    name: "White Pawmitts",
    description: "Soft white paw mitts. No more using your hands properly.",
    rarity: "common",
    collection: "pet",
    sell_value: 100,
  },
  "classic-blindfold": {
    name: "Classic Blindfold",
    description: "A simple blindfold. Helps you focus on other sensations.",
    rarity: "common",
    collection: "classic",
    sell_value: 100,
  },
  "classic-pawmitts": {
    name: "Classic Pawmitts",
    description: "Basic paw mitts to keep those hands out of trouble.",
    rarity: "common",
    collection: "pet",
    sell_value: 100,
  },
  "pet-tag": {
    name: "Pet Tag",
    description: "A simple engraved tag. You now have a name.",
    rarity: "common",
    collection: "pet",
    sell_value: 100,
  },
  
  "classic-maid-outfit": {
    name: "Classic Maid Outfit",
    description: "Traditional black and white French maid dress complete with apron and frills. Service with a curtsy.",
    rarity: "common",
    collection: "maid",
    sell_value: 700,
  },
  "classic-corset": {
    name: "Classic Corset",
    description: "Structured black corset. Breathe less, look better.",
    rarity: "common",
    collection: "classic",
    sell_value: 400,
  },
  "cat-croptop": {
    name: "Cat Crop Top",
    description: "A simple crop top with cat design.",
    rarity: "common",
    collection: "classic",
    sell_value: 250,
  },
  "sneakers": {
    name: "Sneakers",
    description: "Comfortable casual athletic shoes with cushioned sole and breathable design for everyday wear.",
    rarity: "common",
    collection: "classic",
    sell_value: 250,
  },
  "classic": {
    name: "Classic",
    description: "The default full-body outfit. Simple and clean.",
    rarity: "common",
    collection: "classic",
    sell_value: 50,
  },

  // Uncommon
  "classic-buttplug": {
    name: "Classic Buttplug",
    description: "A solid, no-nonsense plug. The reliable workhorse.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 600,
  },
  "owned-tag": {
    name: "Owned Tag",
    description: "A heavy tag that says 'Owned'. Permanent reminder.",
    rarity: "uncommon",
    collection: "pet",
    sell_value: 500,
  },
  "cute-panties": {
    name: "Cute Panties",
    description: "Frilly and pink. Made to make you feel small.",
    rarity: "uncommon",
    collection: "cute",
    sell_value: 580,
  },
  "pink-bra": {
    name: "Pink Bra",
    description: "A bright pink bra. Loud and embarrassing.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 620,
  },
  "pink-blindfold": {
    name: "Pink Blindfold",
    description: "Soft pink blindfold. Darkness is a privilege.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 560,
  },
  "pink-collar": {
    name: "Pink Collar",
    description: "Cute pink collar for the more playful pets.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 520,
  },
  "pink-ears": {
    name: "Pink Ears",
    description: "Matching pink ears. Adorable and humiliating.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 540,
  },
  "classic-highheels": {
    name: "Classic High Heels",
    description: "Simple black heels. Walking in them is training.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 630,
  },
  "classic-thighhighs": {
    name: "Classic Thighhighs",
    description: "Elegant black thigh highs. A step up from basic.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 650,
  },
  "classic-skirt": {
    name: "Classic Skirt",
    description: "A short pleated skirt. You know what it means.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 640,
  },
  "pink-maid-outfit": {
    name: "Pink Maid Outfit",
    description: "A pastel pink take on the classic maid uniform. Extra cute, extra embarrassing.",
    rarity: "uncommon",
    collection: "maid",
    sell_value: 1600,
  },
  "classic-bunnysuit": {
    name: "Classic Bunnysuit",
    description: "The iconic strapless bunny leotard. Ears sold separately, shame included.",
    rarity: "uncommon",
    collection: "bunny",
    sell_value: 1350,
  },
  "classic-thong": {
    name: "Classic Thong",
    description: "Minimal black thong. Less fabric, more exposure.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 900,
  },
  "pink-corset": {
    name: "Pink Corset",
    description: "Playful pink corset that cinches you in all the right (wrong) ways.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 1100,
  },
  "classic-anal-beads": {
    name: "Anal Beads",
    description: "Smooth graduated anal beads designed for wearable pleasure and easy control.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 700,
  },
  "classic-dildo": {
    name: "Classic Dildo",
    description: "Classic smooth dildo with realistic shape and firm yet flexible design for comfortable use.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 2300,
  },
  "pink-small-vibrator": {
    name: "Pink Small Vibrator",
    description: "Compact pink small vibrator with powerful vibrations and smooth silicone finish for discreet pleasure.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 1900,
  },

  // Rare
  "cute-thighhighs": {
    name: "Cute Thighhighs",
    description: "Soft and girly thigh highs. Perfect for a good pet.",
    rarity: "rare",
    collection: "cute",
    sell_value: 1200,
  },
  "pink-tail": {
    name: "Pink Tail",
    description: "A fluffy pink tail to wag on command.",
    rarity: "rare",
    collection: "pink",
    sell_value: 1350,
  },
  "cute-miniskirt": {
    name: "Cute Miniskirt",
    description: "Tiny and pink. Leaves very little to the imagination.",
    rarity: "rare",
    collection: "cute",
    sell_value: 1550,
  },
  "latex-thighhighs": {
    name: "Latex Thighhighs",
    description: "Shiny black latex. Strict and unforgiving.",
    rarity: "rare",
    collection: "latex",
    sell_value: 1400,
  },
  "latex-skirt": {
    name: "Latex Skirt",
    description: "Tight, shiny latex. Every movement is a reminder.",
    rarity: "rare",
    collection: "latex",
    sell_value: 1500,
  },
  "good-boy-tag": {
    name: "Good Boy Tag",
    description: "A tag that says exactly what you want to hear.",
    rarity: "rare",
    collection: "pet",
    sell_value: 1300,
  },
  "latex-maid-outfit": {
    name: "Latex Maid Outfit",
    description: "Shiny black latex version of the maid dress. Strict, tight, and perfect for cleaning on your knees.",
    rarity: "rare",
    collection: "maid",
    sell_value: 2200,
  },
  "pink-bunnysuit": {
    name: "Pink Bunnysuit",
    description: "Soft pink bunny girl leotard. Hop to it, pet.",
    rarity: "rare",
    collection: "bunny",
    sell_value: 3000,
  },
  "fishnet-croptop": {
    name: "Fishnet Croptop",
    description: "Open-weave fishnet crop top. Barely covers anything.",
    rarity: "rare",
    collection: "fishnet",
    sell_value: 2600,
  },
  "fishnet-stockings": {
    name: "Fishnet Stockings",
    description: "Classic diamond fishnet thigh highs. The perfect accessory for any outfit.",
    rarity: "rare",
    collection: "fishnet",
    sell_value: 2400,
  },
  "pink-thong": {
    name: "Pink Thong",
    description: "Bright pink micro thong. Cute and cruelly revealing.",
    rarity: "rare",
    collection: "pink",
    sell_value: 2000,
  },
   "pink-sheer-bikini": {
    name: "Pink Sheer Bikini",
    description: "Flirty sheer pink bikini. The color draws the eye, the fabric hides nothing.",
    rarity: "rare",
    collection: "sheer",
    sell_value: 3300,
  },
  "black-dildo": {
    name: "Black Dildo",
    description: "Deep black dildo with smooth surface and firm yet flexible design for comfortable use.",
    rarity: "rare",
    collection: "",
    sell_value: 4500,
  },
  "remote-control-vibrator": {
    name: "Remote Control Vibrator",
    description: "Wireless remote control vibrator with powerful vibrations and smooth silicone body for discreet, hands-free pleasure.",
    rarity: "rare",
    collection: "pink",
    sell_value: 3800,
  },

  // Epic
  "gorgeous-panties": {
    name: "Gorgeous Panties",
    description: "Lace and luxury. Far too nice for the likes of you.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 3400,
  },
  "gorgeous-bra": {
    name: "Gorgeous Bra",
    description: "Expensive looking lace bra. You don't deserve to wear it.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 3600,
  },
  "gorgeous-thighhighs": {
    name: "Gorgeous Thighhighs",
    description: "High quality stockings with garter straps. Pure elegance.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 4000,
  },
  "gorgeous-highheels": {
    name: "Gorgeous High Heels",
    description: "Designer heels. Walking in these is an art form.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 3200,
  },
  "gorgeous-buttplug": {
    name: "Gorgeous Buttplug",
    description: "A beautiful jeweled plug. The crown jewel of your collection.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 4500,
  },
  "gorgeous-pawmitts": {
    name: "Gorgeous Pawmitts",
    description: "Luxury paw mitts. No more fingers for you.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 3000,
  },
  "gorgeous-bunnysuit": {
    name: "Gorgeous Bunnysuit",
    description: "Luxurious iridescent purple bunny suit with gem accents. High-class humiliation.",
    rarity: "epic",
    collection: "bunny",
    sell_value: 5200,
  },
  "fishnet-leotard": {
    name: "Fishnet Leotard",
    description: "Full-body black fishnet bodysuit with long sleeves. Every inch on display.",
    rarity: "epic",
    collection: "fishnet",
    sell_value: 7500,
  },
  "gorgeous-thong": {
    name: "Gorgeous Thong",
    description: "Delicate and expensive-looking thong. You don't deserve to wear something this nice.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 3800,
  },
  "gorgeous-corset": {
    name: "Gorgeous Corset",
    description: "Elegant and expensive corset. Pure luxury you can barely afford to wear.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 6200,
  },
  "gorgeous-sheer-bikini": {
    name: "Gorgeous Sheer Bikini",
    description: "Delicate sheer bikini set. Almost see-through luxury.",
    rarity: "epic",
    collection: "sheer",
    sell_value: 4500,
  },
  "rabbit-small-vibrator": {
    name: "Small Rabbit Vibrator",
    description: "Small rabbit vibrator with dual stimulation: smooth shaft and cute bunny-ear clitoral stimulator for powerful pleasure.",
    rarity: "epic",
    collection: "cute",
    sell_value: 9500,
  },

  // Legendary
  "shiny-bra": {
    name: "Shiny Bra",
    description: "Glossy and attention-grabbing. Made to be stared at.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 25000,
  },
  "shiny-panties": {
    name: "Shiny Panties",
    description: "Reflective and tight. Humiliation has never looked so polished.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 25000,
  },
  "shiny-thighhighs": {
    name: "Shiny Thighhighs",
    description: "High-gloss thigh highs. The shine draws the eye.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 25000,
  },
  "shiny-skirt": {
    name: "Shiny Skirt",
    description: "A short, glossy skirt that leaves nothing hidden.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 25000,
  },
  "shiny-highheels": {
    name: "Shiny High Heels",
    description: "Patent leather heels with a mirror finish.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 25000,
  },
  "shiny_pawmitts": {
    name: "Shiny Pawmitts",
    description: "Ultra glossy paw mitts. You look expensive and useless.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 20000,
  },
  "principessas-pet": {
    name: "Principessa's Pet",
    description: "The ultimate symbol. You have been claimed.",
    rarity: "legendary",
    collection: "special",
    sell_value: 25000,
  },
  
  "vibrator": {
    name: "Vibrator",
    description: "A sleek wand-style massager. Hands-free pleasure, or punishment.",
    rarity: "legendary",
    collection: "toy",
    sell_value: 40000,
  },
  "ultra-vibrator": {
    name: "Ultra Vibrator",
    description: "Ultra vibrator with powerful vibrations and dedicated clitoral stimulator for intense dual pleasure.",
    rarity: "legendary",
    collection: "toy",
    sell_value: 60000,
  },
  "shiny-maid-outfit": {
    name: "Shiny Maid Outfit",
    description: "Glossy, eye-catching maid uniform. You’ll sparkle while you serve.",
    rarity: "legendary",
    collection: "maid",
    sell_value: 27000,
  },
  "shiny-bunnysuit": {
    name: "Shiny Bunnysuit",
    description: "Ultra glossy purple bunny leotard. Reflective, tight, and impossible to ignore.",
    rarity: "legendary",
    collection: "bunny",
    sell_value: 25000,
  },
  "shiny-thong": {
    name: "Shiny Thong",
    description: "Glossy, skin-tight shiny thong. Every curve catches the light.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 22000,
  },
  "shiny-corset": {
    name: "Shiny Corset",
    description: "High-gloss corset that hugs and shines. Restriction has never looked so polished.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 30000,
  },

  // --- New wardrobe batch (2026-07) - now in Cosplay Case, rarity randomly assigned ---
  "leather_jacket": {
    name: "Leather Jacket",
    description: "A classic black leather jacket.",
    rarity: "uncommon",
    collection: "cosplay-wardrobe",
    sell_value: 1800,
  },
  "denim_shorts": {
    name: "Denim Shorts",
    description: "Classic denim shorts.",
    rarity: "common",
    collection: "cosplay-wardrobe",
    sell_value: 400,
  },
  "knee_high_socks": {
    name: "Knee-High Socks",
    description: "Simple knee-high socks.",
    rarity: "common",
    collection: "cosplay-wardrobe",
    sell_value: 300,
  },
  "white_thighhighs": {
    name: "White Thighhighs",
    description: "Plain white thighhighs.",
    rarity: "common",
    collection: "cosplay-wardrobe",
    sell_value: 500,
  },
  "red_collar": {
    name: "Red Collar",
    description: "A simple red collar.",
    rarity: "common",
    collection: "cosplay-wardrobe",
    sell_value: 200,
  },
  "white_tie_front_shirt": {
    name: "White Tie-Front Shirt",
    description: "A white shirt tied at the front.",
    rarity: "rare",
    collection: "cosplay-wardrobe",
    sell_value: 4800,
  },
  "black_v_neck_crop_top": {
    name: "Black V-Neck Crop Top",
    description: "A fitted black V-neck crop top.",
    rarity: "rare",
    collection: "cosplay-wardrobe",
    sell_value: 4500,
  },
  "purple_crop_sweater": {
    name: "Purple Crop Sweater",
    description: "A cropped purple knit sweater.",
    rarity: "uncommon",
    collection: "cosplay-wardrobe",
    sell_value: 2500,
  },
  "black_dolphin_shorts": {
    name: "Black Dolphin Shorts",
    description: "Black high-cut dolphin shorts.",
    rarity: "epic",
    collection: "cosplay-wardrobe",
    sell_value: 10000,
  },
  "silver_vinyl_shorts": {
    name: "Silver Vinyl Shorts",
    description: "Glossy silver vinyl shorts.",
    rarity: "epic",
    collection: "cosplay-wardrobe",
    sell_value: 13000,
  },
  "black_bow_thighhighs": {
    name: "Black Bow Thighhighs",
    description: "Black thighhighs with a bow accent.",
    rarity: "uncommon",
    collection: "cosplay-wardrobe",
    sell_value: 2200,
  },
  "fireworks_crop_top": {
    name: "Fireworks Crop Top",
    description: "A crop top with a fireworks print.",
    rarity: "uncommon",
    collection: "cosplay-wardrobe",
    sell_value: 1700,
  },
  "pink_off_shoulder_sweater": {
    name: "Pink Off-Shoulder Sweater",
    description: "A cozy pink off-shoulder sweater.",
    rarity: "uncommon",
    collection: "cosplay-wardrobe",
    sell_value: 2700,
  },
  "blue_tartan_pleated_skirt": {
    name: "Blue Tartan Pleated Skirt",
    description: "A pleated blue tartan skirt.",
    rarity: "rare",
    collection: "cosplay-wardrobe",
    sell_value: 4200,
  },
  "red_tartan_pleated_skirt": {
    name: "Red Tartan Pleated Skirt",
    description: "A pleated red tartan skirt.",
    rarity: "rare",
    collection: "cosplay-wardrobe",
    sell_value: 4200,
  },
  "white_distressed_denim_shorts": {
    name: "White Distressed Denim Shorts",
    description: "Distressed white denim shorts.",
    rarity: "rare",
    collection: "cosplay-wardrobe",
    sell_value: 4400,
  },
  "black_strappy_harness_top": {
    name: "Black Strappy Harness Top",
    description: "A strappy black harness top.",
    rarity: "epic",
    collection: "cosplay-wardrobe",
    sell_value: 14000,
  },
  "red_off_shoulder_crop_top": {
    name: "Red Off-Shoulder Crop Top",
    description: "A red off-shoulder crop top.",
    rarity: "rare",
    collection: "cosplay-wardrobe",
    sell_value: 4600,
  },
  "red_satin_halter_bra": {
    name: "Red Satin Halter Bra",
    description: "A satin red halter bra.",
    rarity: "epic",
    collection: "cosplay-wardrobe",
    sell_value: 12000,
  },
  "white_off_shoulder_crop_top": {
    name: "White Off-Shoulder Crop Top",
    description: "A white off-shoulder crop top.",
    rarity: "rare",
    collection: "cosplay-wardrobe",
    sell_value: 4000,
  },
  "pink_dolphin_shorts": {
    name: "Pink Dolphin Shorts",
    description: "Pink high-cut dolphin shorts.",
    rarity: "epic",
    collection: "cosplay-wardrobe",
    sell_value: 11000,
  },

  // Cosplay Case - Full Set items (see FULL_SET_ITEM_IDS in avatar-slots.ts).
  // Equipping one replaces the base model + every layer with a single
  // pre-rendered illustration instead of adding a wardrobe layer.
  "2b_cosplay": {
    name: "2B Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 50000,
  },
  "ada_wong_cosplay": {
    name: "Ada Wong Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 35000,
  },
  "astolfo_cosplay": {
    name: "Astolfo Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 42500,
  },
  "chunli_cosplay": {
    name: "Chun-Li Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 45000,
  },
  "jinx_cosplay": {
    name: "Jinx Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 55000,
  },
  "lara_croft_cosplay": {
    name: "Lara Croft Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 40000,
  },
  "ryuko_matoi_cosplay": {
    name: "Ryuko Matoi Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 60000,
  },
  "tifa_lockhart_cosplay": {
    name: "Tifa Lockhart Cosplay",
    description: "A fully rendered cosplay set.",
    rarity: "legendary",
    collection: "cosplay",
    sell_value: 37500,
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
