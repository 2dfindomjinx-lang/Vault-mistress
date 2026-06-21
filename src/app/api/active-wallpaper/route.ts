import { existsSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WALLPAPER_BASE_URL = "https://vault-mistress.vercel.app/wallpapers/pool";
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const MAX_POOL_SIZE = 200;

function wallpaperFileName(index: number) {
  return `${String(index).padStart(3, "0")}.jpg`;
}

function getAvailableWallpapers() {
  const poolDir = path.join(process.cwd(), "public", "wallpapers", "pool");
  const available: string[] = [];

  for (let index = 1; index <= MAX_POOL_SIZE; index += 1) {
    const fileName = wallpaperFileName(index);
    if (existsSync(path.join(poolDir, fileName))) {
      available.push(fileName);
    }
  }

  return available;
}

export async function GET() {
  const availableWallpapers = getAvailableWallpapers();
  const nowMs = Date.now();
  const windowNumber = Math.floor(nowMs / FOUR_HOURS_MS);
  const windowStartMs = windowNumber * FOUR_HOURS_MS;
  const nextWindowStartMs = windowStartMs + FOUR_HOURS_MS;
  const updatedAt = new Date(windowStartMs).toISOString();
  const nextUpdateAt = new Date(nextWindowStartMs).toISOString();

  if (availableWallpapers.length === 0) {
    return Response.json(
      {
        wallpaperUrl: null,
        version: `window-${windowNumber}-none`,
        updatedAt,
        nextUpdateAt,
      },
      { status: 404 },
    );
  }

  const selectedFileName = availableWallpapers[windowNumber % availableWallpapers.length];

  return Response.json(
    {
      wallpaperUrl: `${WALLPAPER_BASE_URL}/${selectedFileName}`,
      version: `window-${windowNumber}-${selectedFileName}`,
      updatedAt,
      nextUpdateAt,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=14400, stale-while-revalidate=3600",
      },
    },
  );
}
