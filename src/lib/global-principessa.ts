export const GLOBAL_PRINCIPESSA_MAX_LEVEL = 100;

export type GlobalPrincipessaProgress = {
  id?: string | boolean;
  level: number;
  month: number;
  year: number;
  xp: number;
  updated_at?: string | null;
};

export type GlobalPrincipessaVisualTier =
  | "normal"
  | "subtle-glow"
  | "strong-glow"
  | "pulse"
  | "neon-border"
  | "particles"
  | "energy"
  | "spark"
  | "fire"
  | "burning-border"
  | "heavy-fire"
  | "boss-fire"
  | "maximum";

export function getGlobalPrincipessaXpRequirement(level: number) {
  if (level < 1 || level >= GLOBAL_PRINCIPESSA_MAX_LEVEL) {
    return null;
  }

  return 7500 + (Math.floor(level) - 1) * 500;
}

export function calculateGlobalPrincipessaLevel(level: number, xp: number) {
  let nextLevel = Math.max(1, Math.min(GLOBAL_PRINCIPESSA_MAX_LEVEL, Math.floor(level)));
  let remainingXp = Math.max(0, Math.floor(xp));

  while (nextLevel < GLOBAL_PRINCIPESSA_MAX_LEVEL) {
    const requirement = getGlobalPrincipessaXpRequirement(nextLevel);

    if (requirement === null || remainingXp < requirement) {
      break;
    }

    remainingXp -= requirement;
    nextLevel += 1;
  }

  return { level: nextLevel, xp: remainingXp };
}

export function getGlobalPrincipessaProgressPercent(level: number, xp: number) {
  const requirement = getGlobalPrincipessaXpRequirement(level);

  if (requirement === null) {
    return 100;
  }

  return Math.min(100, Math.max(0, (Math.max(0, xp) / requirement) * 100));
}

export function getGlobalPrincipessaVisualTier(level: number): GlobalPrincipessaVisualTier {
  if (level >= 100) return "maximum";
  if (level >= 90) return "boss-fire";
  if (level >= 80) return "heavy-fire";
  if (level >= 70) return "burning-border";
  if (level >= 60) return "fire";
  if (level >= 50) return "spark";
  if (level >= 40) return "energy";
  if (level >= 30) return "particles";
  if (level >= 20) return "neon-border";
  if (level >= 15) return "pulse";
  if (level >= 10) return "strong-glow";
  if (level >= 5) return "subtle-glow";
  return "normal";
}
