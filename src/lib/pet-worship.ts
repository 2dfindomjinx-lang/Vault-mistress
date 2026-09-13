import assetNames from "@/lib/generated/asset-names.json";
import { PET_WORSHIP_CATEGORIES, type PetWorshipCategory } from "@/lib/pet-tasks-content";
import { getGmt3DayIndex } from "@/lib/time";

export async function getWorshipImageFileNames(category: PetWorshipCategory) {
  return (assetNames.worship as Record<string, string[]>)[category] ?? [];
}

export function getTodaysWorshipCategory(): PetWorshipCategory {
  const dayIndex = getGmt3DayIndex();
  return PET_WORSHIP_CATEGORIES[dayIndex % PET_WORSHIP_CATEGORIES.length];
}

// Scatters the pick across the folder independent of filename/sort order,
// while staying stable for the whole day (same image on every reload today).
function hashDailyPick(seed: string, optionCount: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % optionCount;
}

export async function getTodaysWorshipImage() {
  const category = getTodaysWorshipCategory();
  const fileNames = await getWorshipImageFileNames(category);

  if (fileNames.length === 0) {
    return { category, fileName: null as string | null, imageKey: null as string | null };
  }

  const dayIndex = getGmt3DayIndex();
  const fileName = fileNames[hashDailyPick(`${category}:${dayIndex}`, fileNames.length)];
  return { category, fileName, imageKey: `${category}/${fileName}` };
}
