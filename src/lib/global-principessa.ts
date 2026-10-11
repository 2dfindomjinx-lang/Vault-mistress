export const GLOBAL_PRINCIPESSA_MAX_LEVEL = 100;

export type GlobalPrincipessaProgress = {
  id?: string | boolean;
  level: number;
  month: number;
  year: number;
  xp: number;
  updated_at?: string | null;
};

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
