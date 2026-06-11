import { requireMobileAdmin } from "@/lib/mobile-admin";
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

export async function GET(request: Request) {
  const admin = await requireMobileAdmin(request);

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const nowMs = Date.now();
  const windowNumber = Math.floor(nowMs / FOUR_HOURS_MS);
  const updatedAt = new Date(windowNumber * FOUR_HOURS_MS).toISOString();
  const availableWallpapers = getAvailableWallpapers();

  if (availableWallpapers.length === 0) {
    return Response.json({ image_url: "", updated_at: updatedAt }, { status: 404 });
  }

  const selectedFileName = availableWallpapers[windowNumber % availableWallpapers.length];

  return Response.json({
    image_url: `${WALLPAPER_BASE_URL}/${selectedFileName}`,
    updated_at: updatedAt,
  });
}
