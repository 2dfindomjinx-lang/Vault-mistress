// Convert public PNG/JPG/JPEG assets to real WebP via sharp.
// Skips favicons, tiny UI icons, and conversions that don't save bytes.
// Does not change dimensions/aspect ratio.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

const QUALITY = 85;
const MIN_BYTES_TO_CONSIDER = 8 * 1024; // skip tiny files (<8KB)
const MIN_SAVINGS_RATIO = 0.05; // require at least 5% smaller

/** Paths relative to public/ that must stay as-is */
const SKIP_RELATIVE = new Set([
  "favicon.ico",
  "icon.png",
  "icons/coin.png",
]);

const SKIP_BASENAMES = new Set(["favicon.ico"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function relPublic(full) {
  return path.relative(PUBLIC, full).split(path.sep).join("/");
}

function shouldSkip(full) {
  const rel = relPublic(full);
  const base = path.basename(full).toLowerCase();
  const ext = path.extname(full).toLowerCase();

  if (![".png", ".jpg", ".jpeg"].includes(ext)) return true;
  if (SKIP_RELATIVE.has(rel)) return true;
  if (SKIP_BASENAMES.has(base)) return true;
  if (rel.startsWith("icons/")) return true;

  const stat = fs.statSync(full);
  if (stat.size < MIN_BYTES_TO_CONSIDER) return true;

  return false;
}

async function convertOne(full) {
  const rel = relPublic(full);
  const outPath = full.replace(/\.(png|jpe?g)$/i, ".webp");
  const originalSize = fs.statSync(full).size;

  try {
    const image = sharp(full, { failOn: "none" });
    const meta = await image.metadata();
    const hasAlpha = Boolean(meta.hasAlpha);

    // Photos/illustrations: lossy WebP. Preserve alpha for transparent PNGs.
    let pipeline = sharp(full, { failOn: "none" });
    // Do not resize — keep exact dimensions.
    const webpOpts = {
      quality: QUALITY,
      alphaQuality: 90,
      effort: 4,
      smartSubsample: true,
    };

    // Near-lossless for UI-ish small transparent sprites if narrow edge detail
    if (hasAlpha && originalSize < 40 * 1024) {
      webpOpts.quality = 90;
      webpOpts.alphaQuality = 100;
    }

    await pipeline.webp(webpOpts).toFile(outPath);
    const newSize = fs.statSync(outPath).size;

    if (newSize >= originalSize * (1 - MIN_SAVINGS_RATIO)) {
      fs.unlinkSync(outPath);
      return {
        rel,
        status: "kept",
        reason: "no meaningful savings",
        originalSize,
        newSize,
      };
    }

    // Remove original after successful conversion
    fs.unlinkSync(full);
    return {
      rel,
      status: "converted",
      originalSize,
      newSize,
      hasAlpha,
      width: meta.width,
      height: meta.height,
    };
  } catch (err) {
    if (fs.existsSync(outPath)) {
      try {
        fs.unlinkSync(outPath);
      } catch {
        /* ignore */
      }
    }
    return {
      rel,
      status: "error",
      reason: err instanceof Error ? err.message : String(err),
      originalSize,
    };
  }
}

async function main() {
  const all = walk(PUBLIC);
  const candidates = all.filter((f) => !shouldSkip(f) && /\.(png|jpe?g)$/i.test(f));
  const skipped = all.filter(
    (f) => /\.(png|jpe?g)$/i.test(f) && shouldSkip(f),
  );

  console.log(`Candidates: ${candidates.length}, pre-skipped: ${skipped.length}`);

  const results = [];
  // Process in batches to avoid memory spikes
  const BATCH = 8;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(convertOne));
    results.push(...batchResults);
    const done = Math.min(i + BATCH, candidates.length);
    if (done % 40 === 0 || done === candidates.length) {
      console.log(`Progress ${done}/${candidates.length}`);
    }
  }

  const converted = results.filter((r) => r.status === "converted");
  const kept = results.filter((r) => r.status === "kept");
  const errors = results.filter((r) => r.status === "error");

  const before = converted.reduce((s, r) => s + r.originalSize, 0);
  const after = converted.reduce((s, r) => s + r.newSize, 0);

  const report = {
    examinedRaster: candidates.length + skipped.length,
    converted: converted.length,
    keptNoSavings: kept.length,
    preSkipped: skipped.map(relPublic),
    errors,
    bytesBeforeConverted: before,
    bytesAfterConverted: after,
    savedBytes: before - after,
    savedPercent: before ? ((1 - after / before) * 100).toFixed(1) : 0,
    convertedList: converted.map((r) => ({
      rel: r.rel,
      from: r.originalSize,
      to: r.newSize,
    })),
    keptList: kept.map((r) => r.rel),
  };

  const reportPath = path.join(ROOT, "scripts", "webp-optimize-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        examined: report.examinedRaster,
        converted: report.converted,
        keptNoSavings: report.keptNoSavings,
        preSkipped: report.preSkipped.length,
        errors: report.errors.length,
        savedMB: (report.savedBytes / 1024 / 1024).toFixed(2),
        savedPercent: report.savedPercent,
        reportPath,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
