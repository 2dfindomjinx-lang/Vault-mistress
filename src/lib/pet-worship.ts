import { readdir } from "node:fs/promises";
import path from "node:path";
import { PET_WORSHIP_CATEGORIES, type PetWorshipCategory } from "@/lib/pet-tasks-content";
import { getGmt3DayIndex } from "@/lib/time";

// Deliberately outside `public/` - these files must never be reachable by a
// direct static URL. All access goes through an authenticated API route.
const WORSHIP_ROOT = path.join(process.cwd(), "private", "worship");

export async function getWorshipImageFileNames(category: PetWorshipCategory) {
  const dir = path.join(WORSHIP_ROOT, category);

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && /\.(avif|gif|jfif|jpe?g|png|webp)$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException | null;
    if (nodeError?.code !== "ENOENT") {
      console.error("[pet-worship] image directory read failed", error);
    }
    return [] as string[];
  }
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

export function getWorshipFilePath(category: PetWorshipCategory, fileName: string) {
  return path.join(WORSHIP_ROOT, category, fileName);
}
