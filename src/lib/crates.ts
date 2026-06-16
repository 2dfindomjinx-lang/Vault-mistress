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
    cost: 1000,
    enabled: true,
    drops: [
      // === COMPLETE LIST OF ALL 39 ITEMS (matching your 39 images) ===
      // Weights distributed for fair but exciting drops (higher for common, low for legendary)
      // Total weight = 1000

      // Common 4500
      { item_id: "boxer", weight: 600 },
      { item_id: "classic-collar", weight: 350 },
      { item_id: "classic-ears", weight: 350 },
      { item_id: "classic-tail", weight: 350 },
      { item_id: "white-pawmitts", weight: 500 },
	  { item_id: "ballgag", weight: 400 },
	  { item_id: "pet-tag", weight: 600 },
	  { item_id: "classic-bra", weight: 300 },
      { item_id: "classic-blindfold", weight: 500 },
      { item_id: "classic-pawmitts", weight: 550 },

      // Uncommon 2500
	  { item_id: "owned-tag", weight: 500 },
	  { item_id: "pink-collar", weight: 300 },
      { item_id: "pink-ears", weight: 300 },
      { item_id: "cute-panties", weight: 250 },
      { item_id: "pink-bra", weight: 100 },
      { item_id: "pink-blindfold", weight: 300 },
	  { item_id: "classic-buttplug", weight: 150 },
      { item_id: "classic-highheels", weight: 150 },
      { item_id: "classic-skirt", weight: 300 },
      { item_id: "classic-thighhighs", weight: 150 },

      // Rare 2050
      { item_id: "cute-miniskirt", weight: 200 },
      { item_id: "latex-thighhighs", weight: 400 },
	  { item_id: "good-boy-tag", weight: 500 },
	  { item_id: "latex-skirt", weight: 300 },
	  { item_id: "cute-thighhighs", weight: 300 },
	  { item_id: "pink-tail", weight: 350 },

      // Epic 900
	  { item_id: "gorgeous-panties", weight: 140 },
      { item_id: "gorgeous-bra", weight: 140 },
      { item_id: "gorgeous-buttplug", weight: 155 },
      { item_id: "gorgeous-highheels", weight: 125 },
      { item_id: "gorgeous-pawmitts", weight: 210 },
      { item_id: "gorgeous-thighhighs", weight: 130 },

      // Legendary 50
	  { item_id: "shiny-bra", weight: 6 },
      { item_id: "shiny-highheels", weight: 6 },
      { item_id: "shiny-panties", weight: 6 },
      { item_id: "shiny-skirt", weight: 6 },
      { item_id: "shiny-thighhighs", weight: 6 },
      { item_id: "shiny_pawmitts", weight: 14 },
      { item_id: "principessas-pet", weight: 6 },
    ],
  },
  
  blessing_case: {
    name: "0.6% Blessing Case",
    description: "Open the 0.6% Blessing Case • Pray for the Goddess’s rare favor • Only the luckiest pets receive Her blessing.",
    cost: 400,
    enabled: true,
    drops: [
      // === COMPLETE LIST OF ALL 39 ITEMS (matching your 39 images) ===
      // Weights distributed for fair but exciting drops (higher for common, low for legendary)
      // Total weight = 1000

      // Common
      { item_id: "boxer", weight: 9940 },
      { item_id: "classic-collar", weight: 9940 },
      { item_id: "classic-ears", weight: 9940 },
      { item_id: "classic-tail", weight: 9940 },
      { item_id: "white-pawmitts", weight: 9940 },
	  { item_id: "ballgag", weight: 9940 },
	  { item_id: "pet-tag", weight: 9940 },
	  { item_id: "classic-bra", weight: 9940 },
      { item_id: "classic-blindfold", weight: 9940 },
      { item_id: "classic-pawmitts", weight: 9940 },

      // Legendary
	  { item_id: "shiny-bra", weight: 100 },
      { item_id: "shiny-highheels", weight: 100 },
      { item_id: "shiny-panties", weight: 100 },
      { item_id: "shiny-skirt", weight: 100 },
      { item_id: "shiny-thighhighs", weight: 100 },
      { item_id: "principessas-pet", weight: 100 },
    ],
  },
  
  premium_case: {
    name: "Premium Case",
    description: "A balanced case with reliable rewards, enhanced odds, and the chance to unlock truly valuable treasures.",
    cost: 2500,
    enabled: true,
    drops: [
      // === COMPLETE LIST OF ALL 39 ITEMS (matching your 39 images) ===
      // Weights distributed for fair but exciting drops (higher for common, low for legendary)
      // Total weight = 10000

      // Common %12
      { item_id: "classic-maid-outfit", weight: 600 },
      { item_id: "classic-corset", weight: 600 },
		
	  // Uncommon %35
	  { item_id: "pink-maid-outfit", weight: 875 },
	  { item_id: "classic-bunnysuit", weight:875 },
	  { item_id: "classic-thong", weight: 875 },
	  { item_id: "pink-corset", weight: 875 },
	  
	  //Rare %35
	  { item_id: "latex-maid-outfit", weight: 600 },
	  { item_id: "pink-bunnysuit", weight: 600 },
	  { item_id: "fishnet-croptop", weight: 575 },
	  { item_id: "fishnet-stockings", weight: 575 },
	  { item_id: "pink-thong", weight: 575 },
	  { item_id: "pink-sheer-bikini", weight: 575 },
	  
	  // Epic %15
	  { item_id: "gorgeous-bunnysuit", weight: 300 },
	  { item_id: "fishnet-leotard", weight: 300 },
	  { item_id: "gorgeous-thong", weight: 300 },
	  { item_id: "gorgeous-corset", weight: 300 },
	  { item_id: "gorgeous-sheer-bikini", weight: 300 },
	  
      // Legendary %3
	  { item_id: "vibrator", weight: 60 },
      { item_id: "shiny-maid-outfit", weight: 60 },
      { item_id: "shiny-bunnysuit", weight: 60 },
      { item_id: "shiny-thong", weight: 60 },
      { item_id: "shiny-corset", weight: 60 },
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
    sell_value: 120,
  },
  "classic-ears": {
    name: "Classic Ears",
    description: "Soft pet ears. Basic but effective.",
    rarity: "common",
    collection: "classic",
    sell_value: 120,
  },
  "classic-tail": {
    name: "Classic Tail",
    description: "A modest tail plug. Gets the job done.",
    rarity: "common",
    collection: "classic",
    sell_value: 120,
  },
  "boxer": {
    name: "Boxer Briefs",
    description: "Plain and functional. The most pathetic starting point.",
    rarity: "common",
    collection: "basic",
    sell_value: 70,
  },
  "ballgag": {
    name: "Ball Gag",
    description: "A classic red ball gag. Silence is golden.",
    rarity: "common",
    collection: "classic",
    sell_value: 90,
  },
  "classic-bra": {
    name: "Classic Bra",
    description: "A basic bra that still manages to look desperate on you.",
    rarity: "common",
    collection: "classic",
    sell_value: 120,
  },
  "white-pawmitts": {
    name: "White Pawmitts",
    description: "Soft white paw mitts. No more using your hands properly.",
    rarity: "common",
    collection: "pet",
    sell_value: 90,
  },
  "classic-blindfold": {
    name: "Classic Blindfold",
    description: "A simple blindfold. Helps you focus on other sensations.",
    rarity: "common",
    collection: "classic",
    sell_value: 90,
  },
  "classic-pawmitts": {
    name: "Classic Pawmitts",
    description: "Basic paw mitts to keep those hands out of trouble.",
    rarity: "common",
    collection: "pet",
    sell_value: 70,
  },
  "pet-tag": {
    name: "Pet Tag",
    description: "A simple engraved tag. You now have a name.",
    rarity: "common",
    collection: "pet",
    sell_value: 70,
  },
  
  "classic-maid-outfit": {
    name: "Classic Maid Outfit",
    description: "Traditional black and white French maid dress complete with apron and frills. Service with a curtsy.",
    rarity: "common",
    collection: "maid",
    sell_value: 120,
  },
  "classic-corset": {
    name: "Classic Corset",
    description: "Structured black corset. Breathe less, look better.",
    rarity: "common",
    collection: "classic",
    sell_value: 80,
  },

  // Uncommon
  "classic-buttplug": {
    name: "Classic Buttplug",
    description: "A solid, no-nonsense plug. The reliable workhorse.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 400,
  },
  "owned-tag": {
    name: "Owned Tag",
    description: "A heavy tag that says 'Owned'. Permanent reminder.",
    rarity: "uncommon",
    collection: "pet",
    sell_value: 300,
  },
  "cute-panties": {
    name: "Cute Panties",
    description: "Frilly and pink. Made to make you feel small.",
    rarity: "uncommon",
    collection: "cute",
    sell_value: 400,
  },
  "pink-bra": {
    name: "Pink Bra",
    description: "A bright pink bra. Loud and embarrassing.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 450,
  },
  "pink-blindfold": {
    name: "Pink Blindfold",
    description: "Soft pink blindfold. Darkness is a privilege.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 400,
  },
  "pink-collar": {
    name: "Pink Collar",
    description: "Cute pink collar for the more playful pets.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 400,
  },
  "pink-ears": {
    name: "Pink Ears",
    description: "Matching pink ears. Adorable and humiliating.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 400,
  },
  "classic-highheels": {
    name: "Classic High Heels",
    description: "Simple black heels. Walking in them is training.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 450,
  },
  "classic-thighhighs": {
    name: "Classic Thighhighs",
    description: "Elegant black thigh highs. A step up from basic.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 450,
  },
  "classic-skirt": {
    name: "Classic Skirt",
    description: "A short pleated skirt. You know what it means.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 400,
  },
  "pink-maid-outfit": {
    name: "Pink Maid Outfit",
    description: "A pastel pink take on the classic maid uniform. Extra cute, extra embarrassing.",
    rarity: "uncommon",
    collection: "maid",
    sell_value: 500,
  },
  "classic-bunnysuit": {
    name: "Classic Bunnysuit",
    description: "The iconic strapless bunny leotard. Ears sold separately, shame included.",
    rarity: "uncommon",
    collection: "bunny",
    sell_value: 500,
  },
  "classic-thong": {
    name: "Classic Thong",
    description: "Minimal black thong. Less fabric, more exposure.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 450,
  },
  "pink-corset": {
    name: "Pink Corset",
    description: "Playful pink corset that cinches you in all the right (wrong) ways.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 400,
  },

  // Rare
  "cute-thighhighs": {
    name: "Cute Thighhighs",
    description: "Soft and girly thigh highs. Perfect for a good pet.",
    rarity: "rare",
    collection: "cute",
    sell_value: 1400,
  },
  "pink-tail": {
    name: "Pink Tail",
    description: "A fluffy pink tail to wag on command.",
    rarity: "rare",
    collection: "pink",
    sell_value: 1300,
  },
  "cute-miniskirt": {
    name: "Cute Miniskirt",
    description: "Tiny and pink. Leaves very little to the imagination.",
    rarity: "rare",
    collection: "cute",
    sell_value: 1400,
  },
  "latex-thighhighs": {
    name: "Latex Thighhighs",
    description: "Shiny black latex. Strict and unforgiving.",
    rarity: "rare",
    collection: "latex",
    sell_value: 1300,
  },
  "latex-skirt": {
    name: "Latex Skirt",
    description: "Tight, shiny latex. Every movement is a reminder.",
    rarity: "rare",
    collection: "latex",
    sell_value: 1400,
  },
  "good-boy-tag": {
    name: "Good Boy Tag",
    description: "A tag that says exactly what you want to hear.",
    rarity: "rare",
    collection: "pet",
    sell_value: 1100,
  },
  "latex-maid-outfit": {
    name: "Latex Maid Outfit",
    description: "Shiny black latex version of the maid dress. Strict, tight, and perfect for cleaning on your knees.",
    rarity: "rare",
    collection: "maid",
    sell_value: 1500,
  },
  "pink-bunnysuit": {
    name: "Pink Bunnysuit",
    description: "Soft pink bunny girl leotard. Hop to it, pet.",
    rarity: "rare",
    collection: "bunny",
    sell_value: 1500,
  },
  "fishnet-croptop": {
    name: "Fishnet Croptop",
    description: "Open-weave fishnet crop top. Barely covers anything.",
    rarity: "rare",
    collection: "fishnet",
    sell_value: 1400,
  },
  "fishnet-stockings": {
    name: "Fishnet Stockings",
    description: "Classic diamond fishnet thigh highs. The perfect accessory for any outfit.",
    rarity: "rare",
    collection: "fishnet",
    sell_value: 1400,
  },
  "pink-thong": {
    name: "Pink Thong",
    description: "Bright pink micro thong. Cute and cruelly revealing.",
    rarity: "rare",
    collection: "pink",
    sell_value: 1400,
  },
   "pink-sheer-bikini": {
    name: "Pink Sheer Bikini",
    description: "Flirty sheer pink bikini. The color draws the eye, the fabric hides nothing.",
    rarity: "rare",
    collection: "sheer",
    sell_value: 1500,
  },

  // Epic
  "gorgeous-panties": {
    name: "Gorgeous Panties",
    description: "Lace and luxury. Far too nice for the likes of you.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 3000,
  },
  "gorgeous-bra": {
    name: "Gorgeous Bra",
    description: "Expensive looking lace bra. You don't deserve to wear it.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 3000,
  },
  "gorgeous-thighhighs": {
    name: "Gorgeous Thighhighs",
    description: "High quality stockings with garter straps. Pure elegance.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 3000,
  },
  "gorgeous-highheels": {
    name: "Gorgeous High Heels",
    description: "Designer heels. Walking in these is an art form.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 3000,
  },
  "gorgeous-buttplug": {
    name: "Gorgeous Buttplug",
    description: "A beautiful jeweled plug. The crown jewel of your collection.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 2800,
  },
  "gorgeous-pawmitts": {
    name: "Gorgeous Pawmitts",
    description: "Luxury paw mitts. No more fingers for you.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 2500,
  },
  "gorgeous-bunnysuit": {
    name: "Gorgeous Bunnysuit",
    description: "Luxurious iridescent purple bunny suit with gem accents. High-class humiliation.",
    rarity: "epic",
    collection: "bunny",
    sell_value: 4800,
  },
  "fishnet-leotard": {
    name: "Fishnet Leotard",
    description: "Full-body black fishnet bodysuit with long sleeves. Every inch on display.",
    rarity: "epic",
    collection: "fishnet",
    sell_value: 4800,
  },
  "gorgeous-thong": {
    name: "Gorgeous Thong",
    description: "Delicate and expensive-looking thong. You don't deserve to wear something this nice.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 4000,
  },
  "gorgeous-corset": {
    name: "Gorgeous Corset",
    description: "Elegant and expensive corset. Pure luxury you can barely afford to wear.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 4000,
  },
  "gorgeous-sheer-bikini": {
    name: "Gorgeous Sheer Bikini",
    description: "Delicate sheer bikini set. Almost see-through luxury.",
    rarity: "epic",
    collection: "sheer",
    sell_value: 5000,
  },

  // Legendary
  "shiny-bra": {
    name: "Shiny Bra",
    description: "Glossy and attention-grabbing. Made to be stared at.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 28000,
  },
  "shiny-panties": {
    name: "Shiny Panties",
    description: "Reflective and tight. Humiliation has never looked so polished.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 28000,
  },
  "shiny-thighhighs": {
    name: "Shiny Thighhighs",
    description: "High-gloss thigh highs. The shine draws the eye.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 28000,
  },
  "shiny-skirt": {
    name: "Shiny Skirt",
    description: "A short, glossy skirt that leaves nothing hidden.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 28000,
  },
  "shiny-highheels": {
    name: "Shiny High Heels",
    description: "Patent leather heels with a mirror finish.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 28000,
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
    sell_value: 28000,
  },
  
  "vibrator": {
    name: "Vibrator",
    description: "A sleek wand-style massager. Hands-free pleasure, or punishment.",
    rarity: "legendary",
    collection: "toy",
    sell_value: 40000,
  },
  "shiny-maid-outfit": {
    name: "Shiny Maid Outfit",
    description: "Glossy, eye-catching maid uniform. You’ll sparkle while you serve.",
    rarity: "legendary",
    collection: "maid",
    sell_value: 40000,
  },
  "shiny-bunnysuit": {
    name: "Shiny Bunnysuit",
    description: "Ultra glossy purple bunny leotard. Reflective, tight, and impossible to ignore.",
    rarity: "legendary",
    collection: "bunny",
    sell_value: 40000,
  },
  "shiny-thong": {
    name: "Shiny Thong",
    description: "Glossy, skin-tight shiny thong. Every curve catches the light.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 40000,
  },
  "shiny-corset": {
    name: "Shiny Corset",
    description: "High-gloss corset that hugs and shines. Restriction has never looked so polished.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 40000,
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
 * Eğer item tanımında image_url verilmemişse, /crate-items/{item_id}.png olarak otomatik oluşturur.
 */
export function getCrateItemImageUrl(itemId: string, provided?: string | null): string | null {
  if (provided) return provided;
  return `/crate-items/${itemId}.png`;
}

/**
 * Principessa Case (or future crates) icon.
 * Defaults to /crate-icons/{crateType-kebab}.png
 * e.g. "principessa_case" → "/crate-icons/principessa-case.png"
 * You can override per-crate by putting icon_url in the CRATE_TYPES entry.
 */
export function getCrateIconUrl(crateType: string, provided?: string | null): string | null {
  if (provided) return provided;
  const fileName = crateType.replace(/_/g, "-");
  return `/crate-icons/${fileName}.png`;
}
