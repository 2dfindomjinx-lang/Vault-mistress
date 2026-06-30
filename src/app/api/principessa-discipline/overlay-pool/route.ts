import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUBLIC_FOLDER = path.join(process.cwd(), "public", "principessa-discipline", "overlay-pool");
const PUBLIC_BASE_URL = "https://vault-mistress.vercel.app/principessa-discipline/overlay-pool";
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

type OverlayImagePayload = {
  key: string;
  fileName: string;
  imageUrl: string;
  updatedAt: string;
  sizeBytes: number;
};

function listOverlayImages(): OverlayImagePayload[] {
  if (!existsSync(PUBLIC_FOLDER)) {
    return [];
  }

  return readdirSync(PUBLIC_FOLDER, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => {
      const filePath = path.join(PUBLIC_FOLDER, fileName);
      const stats = statSync(filePath);
      return {
        key: fileName,
        fileName,
        imageUrl: `${PUBLIC_BASE_URL}/${encodeURIComponent(fileName)}`,
        updatedAt: stats.mtime.toISOString(),
        sizeBytes: stats.size,
      };
    });
}

export async function GET() {
  return Response.json(
    {
      images: listOverlayImages(),
      generatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
