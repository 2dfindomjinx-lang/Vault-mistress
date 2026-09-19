import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export function buildOverlayManifest(folder, includeMedia = false) {
  const extensions = includeMedia ? /\.(jpg|jpeg|png|webp|gif|mp4|webm)$/i : /\.(jpg|jpeg|png|webp)$/i;
  const names = fs.readdirSync(folder, { withFileTypes: true })
    .filter(entry => entry.isFile() && extensions.test(entry.name))
    .map(entry => entry.name).sort((a, b) => a.localeCompare(b));
  if (names.length > 1000) throw new Error("Overlay pool exceeds 1000 files");
  let total = 0;
  const images = names.map(fileName => {
    const file = path.join(folder, fileName);
    const stat = fs.statSync(file);
    if (!stat.size || stat.size > 25 * 1024 * 1024) throw new Error(`Invalid overlay size: ${fileName}`);
    total += stat.size;
    if (total > 512 * 1024 * 1024) throw new Error("Overlay pool exceeds 512 MiB");
    const sha256 = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    return {
      key: fileName, fileName,
      imageUrl: `https://vault-mistress.vercel.app/principessa-discipline/overlay-pool/${encodeURIComponent(fileName)}?v=${sha256}`,
      updatedAt: stat.mtime.toISOString(), sizeBytes: stat.size, sha256,
      ...(includeMedia ? { mediaType: /\.(mp4|webm)$/i.test(fileName) ? "video" : /\.gif$/i.test(fileName) ? "gif" : "image" } : {}),
    };
  });
  return { images, generatedAt: new Date(Math.max(0, ...images.map(image => Date.parse(image.updatedAt)))).toISOString() };
}
