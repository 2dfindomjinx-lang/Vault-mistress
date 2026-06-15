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
    cost: 2500,
    enabled: true,
    drops: [
      // === COMPLETE LIST OF ALL 39 ITEMS (matching your 39 images) ===
      // Weights distributed for fair but exciting drops (higher for common, low for legendary)
      // Total weight = 1000

      // Common
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

      // Uncommon
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

      // Rare
      { item_id: "cute-miniskirt", weight: 200 },
      { item_id: "latex-thighhighs", weight: 400 },
	  { item_id: "good-boy-tag", weight: 500 },
	  { item_id: "latex-skirt", weight: 300 },
	  { item_id: "cute-thighhighs", weight: 300 },
	  { item_id: "pink-tail", weight: 350 },

      // Epic
	  { item_id: "gorgeous-panties", weight: 140 },
      { item_id: "gorgeous-bra", weight: 140 },
      { item_id: "gorgeous-buttplug", weight: 155 },
      { item_id: "gorgeous-highheels", weight: 125 },
      { item_id: "gorgeous-pawmitts", weight: 210 },
      { item_id: "gorgeous-thighhighs", weight: 130 },

      // Legendary
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
    cost: 1000,
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
};

// Sample item catalog (in real V1 you would INSERT these into crate_items table)
export const SAMPLE_CRATE_ITEMS: Record<string, Omit<CrateItem, "item_id" | "enabled">> = {
  // Common
  "classic-collar": {
    name: "Classic Collar",
    description: "A simple leather collar. The starting point of many journeys.",
    rarity: "common",
    collection: "classic",
    sell_value: 250,
  },
  "classic-ears": {
    name: "Classic Ears",
    description: "Soft pet ears. Basic but effective.",
    rarity: "common",
    collection: "classic",
    sell_value: 250,
  },
  "classic-tail": {
    name: "Classic Tail",
    description: "A modest tail plug. Gets the job done.",
    rarity: "common",
    collection: "classic",
    sell_value: 250,
  },
  "boxer": {
    name: "Boxer Briefs",
    description: "Plain and functional. The most pathetic starting point.",
    rarity: "common",
    collection: "basic",
    sell_value: 125,
  },
  "ballgag": {
    name: "Ball Gag",
    description: "A classic red ball gag. Silence is golden.",
    rarity: "common",
    collection: "classic",
    sell_value: 175,
  },
  "classic-bra": {
    name: "Classic Bra",
    description: "A basic bra that still manages to look desperate on you.",
    rarity: "common",
    collection: "classic",
    sell_value: 250,
  },
  "white-pawmitts": {
    name: "White Pawmitts",
    description: "Soft white paw mitts. No more using your hands properly.",
    rarity: "common",
    collection: "pet",
    sell_value: 175,
  },
  "classic-blindfold": {
    name: "Classic Blindfold",
    description: "A simple blindfold. Helps you focus on other sensations.",
    rarity: "common",
    collection: "classic",
    sell_value: 150,
  },
  "classic-pawmitts": {
    name: "Classic Pawmitts",
    description: "Basic paw mitts to keep those hands out of trouble.",
    rarity: "common",
    collection: "pet",
    sell_value: 125,
  },
  "pet-tag": {
    name: "Pet Tag",
    description: "A simple engraved tag. You now have a name.",
    rarity: "common",
    collection: "pet",
    sell_value: 125,
  },

  // Uncommon
  "classic-buttplug": {
    name: "Classic Buttplug",
    description: "A solid, no-nonsense plug. The reliable workhorse.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 750,
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
    sell_value: 750,
  },
  "pink-bra": {
    name: "Pink Bra",
    description: "A bright pink bra. Loud and embarrassing.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 850,
  },
  "pink-blindfold": {
    name: "Pink Blindfold",
    description: "Soft pink blindfold. Darkness is a privilege.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 700,
  },
  "pink-collar": {
    name: "Pink Collar",
    description: "Cute pink collar for the more playful pets.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 700,
  },
  "pink-ears": {
    name: "Pink Ears",
    description: "Matching pink ears. Adorable and humiliating.",
    rarity: "uncommon",
    collection: "pink",
    sell_value: 700,
  },
  "classic-highheels": {
    name: "Classic High Heels",
    description: "Simple black heels. Walking in them is training.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 850,
  },
  "classic-thighhighs": {
    name: "Classic Thighhighs",
    description: "Elegant black thigh highs. A step up from basic.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 900,
  },
  "classic-skirt": {
    name: "Classic Skirt",
    description: "A short pleated skirt. You know what it means.",
    rarity: "uncommon",
    collection: "classic",
    sell_value: 700,
  },

  // Rare
  "cute-thighhighs": {
    name: "Cute Thighhighs",
    description: "Soft and girly thigh highs. Perfect for a good pet.",
    rarity: "rare",
    collection: "cute",
    sell_value: 3200,
  },
  "pink-tail": {
    name: "Pink Tail",
    description: "A fluffy pink tail to wag on command.",
    rarity: "rare",
    collection: "pink",
    sell_value: 2900,
  },
  "cute-miniskirt": {
    name: "Cute Miniskirt",
    description: "Tiny and pink. Leaves very little to the imagination.",
    rarity: "rare",
    collection: "cute",
    sell_value: 3200,
  },
  "latex-thighhighs": {
    name: "Latex Thighhighs",
    description: "Shiny black latex. Strict and unforgiving.",
    rarity: "rare",
    collection: "latex",
    sell_value: 2900,
  },
  "latex-skirt": {
    name: "Latex Skirt",
    description: "Tight, shiny latex. Every movement is a reminder.",
    rarity: "rare",
    collection: "latex",
    sell_value: 3200,
  },
  "good-boy-tag": {
    name: "Good Boy Tag",
    description: "A tag that says exactly what you want to hear.",
    rarity: "rare",
    collection: "pet",
    sell_value: 2600,
  },

  // Epic
  "gorgeous-panties": {
    name: "Gorgeous Panties",
    description: "Lace and luxury. Far too nice for the likes of you.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 6700,
  },
  "gorgeous-bra": {
    name: "Gorgeous Bra",
    description: "Expensive looking lace bra. You don't deserve to wear it.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 6700,
  },
  "gorgeous-thighhighs": {
    name: "Gorgeous Thighhighs",
    description: "High quality stockings with garter straps. Pure elegance.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 6800,
  },
  "gorgeous-highheels": {
    name: "Gorgeous High Heels",
    description: "Designer heels. Walking in these is an art form.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 7000,
  },
  "gorgeous-buttplug": {
    name: "Gorgeous Buttplug",
    description: "A beautiful jeweled plug. The crown jewel of your collection.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 6500,
  },
  "gorgeous-pawmitts": {
    name: "Gorgeous Pawmitts",
    description: "Luxury paw mitts. No more fingers for you.",
    rarity: "epic",
    collection: "gorgeous",
    sell_value: 5750,
  },

  // Legendary
  "shiny-bra": {
    name: "Shiny Bra",
    description: "Glossy and attention-grabbing. Made to be stared at.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 40000,
  },
  "shiny-panties": {
    name: "Shiny Panties",
    description: "Reflective and tight. Humiliation has never looked so polished.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 40000,
  },
  "shiny-thighhighs": {
    name: "Shiny Thighhighs",
    description: "High-gloss thigh highs. The shine draws the eye.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 40000,
  },
  "shiny-skirt": {
    name: "Shiny Skirt",
    description: "A short, glossy skirt that leaves nothing hidden.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 40000,
  },
  "shiny-highheels": {
    name: "Shiny High Heels",
    description: "Patent leather heels with a mirror finish.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 40000,
  },
  "shiny_pawmitts": {
    name: "Shiny Pawmitts",
    description: "Ultra glossy paw mitts. You look expensive and useless.",
    rarity: "legendary",
    collection: "shiny",
    sell_value: 25000,
  },
  "principessas-pet": {
    name: "Principessa's Pet",
    description: "The ultimate symbol. You have been claimed.",
    rarity: "legendary",
    collection: "special",
    sell_value: 40000,
  },
};

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
