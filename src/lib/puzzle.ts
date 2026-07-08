export type PuzzleDifficulty =
  | "glimpse"
  | "focus"
  | "devotion"
  | "trial"
  | "mastery"
  | "obsession";

export type PuzzleAspectKind = "standard" | "vertical";

export type PuzzlePreset = {
  difficulty: PuzzleDifficulty;
  label: string;
  coinCost: number;
  cols: number;
  rows: number;
};

export type PuzzleImageSourceType = "puzzle";

export type PuzzleImagePoolItem = {
  id: string;
  sourceType: PuzzleImageSourceType;
  title: string;
  image: string;
  tag: string;
};

export const PUZZLE_COIN_COST_PER_PIECE = 15;
export const PUZZLE_DAILY_IMAGE_COUNT = 1;

function createPuzzlePreset(
  difficulty: PuzzleDifficulty,
  label: string,
  cols: number,
  rows: number,
): PuzzlePreset {
  return {
    difficulty,
    label,
    coinCost: cols * rows * PUZZLE_COIN_COST_PER_PIECE,
    cols,
    rows,
  };
}

const standardPuzzlePresets: PuzzlePreset[] = [
  createPuzzlePreset("glimpse", "Glimpse", 9, 9),
  createPuzzlePreset("focus", "Focus", 10, 9),
  createPuzzlePreset("devotion", "Devotion", 10, 10),
  createPuzzlePreset("trial", "Trial", 12, 10),
  createPuzzlePreset("mastery", "Mastery", 12, 12),
  createPuzzlePreset("obsession", "Obsession", 15, 15),
];

const verticalPuzzlePresets: PuzzlePreset[] = [
  createPuzzlePreset("glimpse", "Glimpse", 7, 12),
  createPuzzlePreset("focus", "Focus", 8, 11),
  createPuzzlePreset("devotion", "Devotion", 9, 12),
  createPuzzlePreset("trial", "Trial", 10, 14),
  createPuzzlePreset("mastery", "Mastery", 12, 15),
  createPuzzlePreset("obsession", "Obsession", 14, 18),
];

export function getPuzzlePresets(aspect: PuzzleAspectKind) {
  return aspect === "vertical" ? verticalPuzzlePresets : standardPuzzlePresets;
}

export function getPuzzlePreset(difficulty: string, aspect: PuzzleAspectKind) {
  return getPuzzlePresets(aspect).find((preset) => preset.difficulty === difficulty) ?? null;
}

export function normalizePuzzleAspect(value: unknown): PuzzleAspectKind {
  return value === "vertical" ? "vertical" : "standard";
}

function getStableSeed(value: string) {
  return Array.from(value).reduce((seed, char) => {
    return ((seed * 31) + char.charCodeAt(0)) >>> 0;
  }, 2166136261);
}

export function pickDailyPuzzleImages(
  images: PuzzleImagePoolItem[],
  dayKey: string,
  count = PUZZLE_DAILY_IMAGE_COUNT,
) {
  const targetCount = Math.max(1, Math.floor(count));
  const shuffled = [...images];
  let seed = getStableSeed(`puzzle:${dayKey}`);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled.slice(0, Math.min(targetCount, shuffled.length));
}
