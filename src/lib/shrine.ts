export type ShrineMemoryDefinition = {
  fileName: string;
  path: string;
  title: string;
};

export type ShrineMemoryRecord = {
  fileName: string;
  path: string;
  title: string;
};

export type ShrineWorshipper = {
  displayName: string | null;
  totalSpent: number;
  userId: string;
  username: string;
};

export const SHRINE_PURCHASE_OPTIONS = [
  {
    amount: 5000,
    description: "A simple offering laid before Principessa's Shrine.",
    devotionReward: 1,
    label: "Offering",
  },
  {
    amount: 10000,
    description: "A richer act of worship for a more meaningful tribute.",
    devotionReward: 2,
    label: "Blessed Offering",
  },
  {
    amount: 25000,
    description: "A lavish royal offering worthy of deeper reverence.",
    devotionReward: 5,
    label: "Royal Offering",
  },
] as const;

export const SHRINE_IMAGE_UNLOCK_COST = 10000;
export const SHRINE_LEVEL_COIN_INTERVAL = 5000;

export const SHRINE_MEMORY_LIBRARY: ShrineMemoryDefinition[] = [
  { fileName: "shrine_1.jpg", path: "/shrine/shrine_1.jpg", title: "Throne of Tribute" },
  { fileName: "shrine_2.jpg", path: "/shrine/shrine_2.jpg", title: "Executive Drain" },
  { fileName: "shrine_3.jpg", path: "/shrine/shrine_3.jpg", title: "Bunny Tax Collector" },
  { fileName: "shrine_4.jpg", path: "/shrine/shrine_4.jpg", title: "Feet Up, Wallet Down" },
  { fileName: "shrine_5.jpg", path: "/shrine/shrine_5.jpg", title: "Black Stocking Goddess" },
  { fileName: "shrine_6.jpg", path: "/shrine/shrine_6.jpg", title: "Latex Overlord" },
  { fileName: "shrine_7.jpg", path: "/shrine/shrine_7.jpg", title: "Chair of Obedience" },
  { fileName: "shrine_8.jpg", path: "/shrine/shrine_8.jpg", title: "City Lights" },
  { fileName: "shrine_9.jpg", path: "/shrine/shrine_9.jpg", title: "Casual Cruelty" },
  { fileName: "shrine_10.jpg", path: "/shrine/shrine_10.jpg", title: "Short Skirt Supremacy" },
  { fileName: "shrine_11.jpg", path: "/shrine/shrine_11.jpg", title: "Close-Up Ruin" },
  { fileName: "shrine_12.jpg", path: "/shrine/shrine_12.jpg", title: "Bondage Tease" },
  { fileName: "shrine_13.jpg", path: "/shrine/shrine_13.jpg", title: "Strap & Drain" },
  { fileName: "shrine_14.jpg", path: "/shrine/shrine_14.jpg", title: "Foot Throne" },
  { fileName: "shrine_15.jpg", path: "/shrine/shrine_15.jpg", title: "Red Devil Mistress" },
  { fileName: "shrine_16.jpg", path: "/shrine/shrine_16.jpg", title: "Ruined Orgasm" },
  { fileName: "shrine_17.jpg", path: "/shrine/shrine_17.jpg", title: "Rear View Tribute" },
  { fileName: "shrine_18.jpg", path: "/shrine/shrine_18.jpg", title: "Purple Night Drain" },
  { fileName: "shrine_19.jpg", path: "/shrine/shrine_19.jpg", title: "Blacked & Owned" },
  { fileName: "shrine_20.jpg", path: "/shrine/shrine_20.jpg", title: "Pussy Denial" },
  { fileName: "shrine_21.jpg", path: "/shrine/shrine_21.jpg", title: "Blessing Play" },
  { fileName: "shrine_22.jpg", path: "/shrine/shrine_22.jpg", title: "No Control" },
  { fileName: "shrine_23.jpg", path: "/shrine/shrine_23.jpg", title: "Reward" },
  { fileName: "shrine_24.jpg", path: "/shrine/shrine_24.jpg", title: "Balls Crushed" },
  { fileName: "shrine_25.jpg", path: "/shrine/shrine_25.jpg", title: "Completely Submisive Pet" },
];

export type ShrinePurchaseAmount = (typeof SHRINE_PURCHASE_OPTIONS)[number]["amount"];

export type ShrineStatus = {
  availableImageCount: number;
  coinsUntilNextUnlock: number | null;
  currentImagePath: string | null;
  currentMemory: ShrineMemoryRecord | null;
  imagePaths: string[];
  level: number;
  memories: ShrineMemoryRecord[];
  nextUnlockAt: number | null;
  revealedMemories: ShrineMemoryRecord[];
  totalSpent: number;
  topWorshippers: ShrineWorshipper[];
  unlockedImageCount: number;
  unlockedImagePaths: string[];
  // Separate sub/femsub bonus gallery unlocked at Worship Level thresholds.
  // Undefined for address_term === "neutral" (no bonus gallery for that preference).
  bonus?: ShrineBonusStatus;
};

// Worship Level interval between bonus gallery unlocks (level 5, 10, 15, ...).
export const SHRINE_BONUS_LEVEL_STEP = 5;

export type ShrineBonusStatus = {
  images: ShrineMemoryRecord[];
  unlockedImages: ShrineMemoryRecord[];
  unlockedCount: number;
  nextUnlockLevel: number | null;
  levelsUntilNextUnlock: number | null;
};

export function buildShrineBonusStatus(level: number, images: ShrineMemoryRecord[]): ShrineBonusStatus {
  const safeLevel = Math.max(0, Math.floor(level));
  const unlockedCount = Math.min(images.length, Math.floor(safeLevel / SHRINE_BONUS_LEVEL_STEP));
  const unlockedImages = images.slice(0, unlockedCount);
  const hasMore = unlockedCount < images.length;
  const nextUnlockLevel = hasMore ? (unlockedCount + 1) * SHRINE_BONUS_LEVEL_STEP : null;
  const levelsUntilNextUnlock = nextUnlockLevel === null ? null : Math.max(0, nextUnlockLevel - safeLevel);

  return {
    images,
    unlockedImages,
    unlockedCount,
    nextUnlockLevel,
    levelsUntilNextUnlock,
  };
}

export function isShrinePurchaseAmount(value: number): value is ShrinePurchaseAmount {
  return SHRINE_PURCHASE_OPTIONS.some((option) => option.amount === value);
}

export function getShrinePurchaseOption(amount: number) {
  return SHRINE_PURCHASE_OPTIONS.find((option) => option.amount === amount) ?? null;
}

export function getShrineDevotionReward(amount: number) {
  return getShrinePurchaseOption(amount)?.devotionReward ?? 0;
}

function toTitleCaseFromFileName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolveShrineMemories(fileNames: string[]) {
  const configuredMap = new Map(
    SHRINE_MEMORY_LIBRARY.map((memory) => [memory.fileName.toLowerCase(), memory]),
  );

  return [...fileNames]
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }))
    .map((fileName) => {
      const configured = configuredMap.get(fileName.toLowerCase());

      if (configured) {
        return configured;
      }

      return {
        fileName,
        path: `/shrine/${fileName}`,
        title: toTitleCaseFromFileName(fileName),
      };
    });
}

export function buildShrineStatus(totalSpent: number, memories: ShrineMemoryRecord[]): ShrineStatus {
  const safeTotalSpent = Math.max(0, Math.floor(totalSpent));
  const availableImageCount = memories.length;
  const unlockedImageCount = Math.min(
    availableImageCount,
    Math.floor(safeTotalSpent / SHRINE_IMAGE_UNLOCK_COST),
  );
  const revealedMemories = memories.slice(0, unlockedImageCount);
  const level = Math.floor(safeTotalSpent / SHRINE_LEVEL_COIN_INTERVAL);
  const unlockedImagePaths = revealedMemories.map((memory) => memory.path);
  const hasMoreImages = unlockedImageCount < availableImageCount;
  const nextUnlockAt = hasMoreImages
    ? SHRINE_IMAGE_UNLOCK_COST * (unlockedImageCount + 1)
    : null;
  const coinsUntilNextUnlock = nextUnlockAt === null
    ? null
    : Math.max(0, nextUnlockAt - safeTotalSpent);
  const currentMemory = revealedMemories[revealedMemories.length - 1] ?? null;

  return {
    availableImageCount,
    coinsUntilNextUnlock,
    currentImagePath: currentMemory?.path ?? null,
    currentMemory,
    imagePaths: memories.map((memory) => memory.path),
    level,
    memories,
    nextUnlockAt,
    revealedMemories,
    totalSpent: safeTotalSpent,
    topWorshippers: [],
    unlockedImageCount,
    unlockedImagePaths,
  };
}
