export const SHRINE_PURCHASE_OPTIONS = [
  {
    amount: 1000,
    description: "A small shrine offering that still feeds your score and devotion.",
    label: "Velvet Shrine",
  },
  {
    amount: 2500,
    description: "A richer devotion sink for users who want faster shrine progress.",
    label: "Golden Shrine",
  },
  {
    amount: 5000,
    description: "A heavier coin burn for the most eager little contributors.",
    label: "Crown Shrine",
  },
] as const;

export const SHRINE_IMAGE_UNLOCK_COST = 20000;
export const SHRINE_DEVOTION_REWARD = 1;

export type ShrinePurchaseAmount = (typeof SHRINE_PURCHASE_OPTIONS)[number]["amount"];

export type ShrineStatus = {
  availableImageCount: number;
  coinsUntilNextUnlock: number | null;
  currentImagePath: string | null;
  imagePaths: string[];
  nextUnlockAt: number | null;
  totalSpent: number;
  unlockedImageCount: number;
  unlockedImagePaths: string[];
};

export function isShrinePurchaseAmount(value: number): value is ShrinePurchaseAmount {
  return SHRINE_PURCHASE_OPTIONS.some((option) => option.amount === value);
}

export function buildShrineStatus(totalSpent: number, imagePaths: string[]): ShrineStatus {
  const safeTotalSpent = Math.max(0, Math.floor(totalSpent));
  const availableImageCount = imagePaths.length;
  const unlockedImageCount = Math.min(
    availableImageCount,
    Math.floor(safeTotalSpent / SHRINE_IMAGE_UNLOCK_COST),
  );
  const unlockedImagePaths = imagePaths.slice(0, unlockedImageCount);
  const hasMoreImages = unlockedImageCount < availableImageCount;
  const nextUnlockAt = hasMoreImages
    ? SHRINE_IMAGE_UNLOCK_COST * (unlockedImageCount + 1)
    : null;
  const coinsUntilNextUnlock = nextUnlockAt === null
    ? null
    : Math.max(0, nextUnlockAt - safeTotalSpent);

  return {
    availableImageCount,
    coinsUntilNextUnlock,
    currentImagePath: unlockedImagePaths[unlockedImagePaths.length - 1] ?? null,
    imagePaths,
    nextUnlockAt,
    totalSpent: safeTotalSpent,
    unlockedImageCount,
    unlockedImagePaths,
  };
}
