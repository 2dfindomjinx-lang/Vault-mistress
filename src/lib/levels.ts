export const USER_LEVEL_MAX = 100;

export type UserLevelProgress = {
  level: number;
  levelFloorXp: number;
  nextLevelXp: number | null;
  progressPercent: number;
  xpIntoLevel: number;
  xpRequiredForNext: number | null;
};

export function getUserLevelXpRequirement(level: number) {
  if (level < 1 || level >= USER_LEVEL_MAX) {
    return null;
  }

  const safeLevel = Math.max(1, Math.floor(level));

  // Smooth progression: starts near 5k and rises gradually without sharp tier jumps.
  return Math.round(5000 + safeLevel * 150 + Math.pow(safeLevel, 1.2) * 25);
}

export function getUserLevelFloorXp(level: number) {
  const targetLevel = Math.min(USER_LEVEL_MAX, Math.max(1, Math.floor(level)));
  let total = 0;

  for (let currentLevel = 1; currentLevel < targetLevel; currentLevel += 1) {
    total += getUserLevelXpRequirement(currentLevel) ?? 0;
  }

  return total;
}

export function getUserLevelFromXp(totalXp: number) {
  const safeXp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let spent = 0;

  while (level < USER_LEVEL_MAX) {
    const requirement = getUserLevelXpRequirement(level);

    if (requirement === null || safeXp < spent + requirement) {
      break;
    }

    spent += requirement;
    level += 1;
  }

  return level;
}

export function getUserLevelProgress(totalXp: number): UserLevelProgress {
  const safeXp = Math.max(0, Math.floor(totalXp));
  const level = getUserLevelFromXp(safeXp);
  const levelFloorXp = getUserLevelFloorXp(level);
  const requirement = getUserLevelXpRequirement(level);
  const xpIntoLevel = safeXp - levelFloorXp;

  if (requirement === null) {
    return {
      level,
      levelFloorXp,
      nextLevelXp: null,
      progressPercent: 100,
      xpIntoLevel: 0,
      xpRequiredForNext: null,
    };
  }

  return {
    level,
    levelFloorXp,
    nextLevelXp: levelFloorXp + requirement,
    progressPercent: Math.min(100, Math.max(0, (xpIntoLevel / requirement) * 100)),
    xpIntoLevel,
    xpRequiredForNext: requirement,
  };
}

export function getUserLevelValue(level: number) {
  if (level >= 76) {
    return 25000;
  }

  if (level >= 51) {
    return 15000;
  }

  if (level >= 31) {
    return 10000;
  }

  return 5000;
}
