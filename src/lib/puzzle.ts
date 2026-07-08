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
  createPuzzlePreset("focus", "Focus", 10, 10),
  createPuzzlePreset("devotion", "Devotion", 12, 12),
  createPuzzlePreset("trial", "Trial", 15, 15),
  createPuzzlePreset("mastery", "Mastery", 18, 18),
  createPuzzlePreset("obsession", "Obsession", 25, 20),
];

const verticalPuzzlePresets: PuzzlePreset[] = [
  createPuzzlePreset("glimpse", "Glimpse", 7, 12),
  createPuzzlePreset("focus", "Focus", 8, 13),
  createPuzzlePreset("devotion", "Devotion", 10, 16),
  createPuzzlePreset("trial", "Trial", 12, 20),
  createPuzzlePreset("mastery", "Mastery", 14, 24),
  createPuzzlePreset("obsession", "Obsession", 16, 30),
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
