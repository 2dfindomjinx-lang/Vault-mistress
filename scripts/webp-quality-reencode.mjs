// Targeted re-encode from git originals using category policy.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();

/** @typedef {{ match: (rel: string) => boolean, mode: 'nearLossless' | 'high' | 'premium', quality?: number }} Policy */

const policies = [
  // Transparent character / wardrobe layers — stacking needs cleaner edges
  {
    match: (rel) =>
      rel.startsWith("avatar/") &&
      !rel.startsWith("avatar/background/"),
    mode: "nearLossless",
  },
  // Avatar backgrounds still large; bump quality
  {
    match: (rel) => rel.startsWith("avatar/background/"),
    mode: "high",
    quality: 92,
  },
  // Close-up rank portraits
  { match: (rel) => rel.startsWith("pet-ranks/"), mode: "nearLossless" },
  // Badges / case icons / crate shop icons — metal edges + text tags
  { match: (rel) => rel.startsWith("badges/"), mode: "nearLossless" },
  { match: (rel) => rel.startsWith("crate-icons/"), mode: "nearLossless" },
  { match: (rel) => rel.startsWith("crate-items/"), mode: "nearLossless" },
  // Speech avatars (small faces)
  { match: (rel) => rel.startsWith("cosmetics/"), mode: "high", quality: 92 },
  // Premium gallery CG / secret / pet gallery
  {
    match: (rel) =>
      /gallery\/(divine|secret|rare|pet|femsub\/pet|sacrifice)/.test(rel),
    mode: "premium",
    quality: 92,
  },
  // Puzzle tiles with text overlays
  { match: (rel) => rel.startsWith("puzzle/"), mode: "high", quality: 90 },
  // Principessa UI generated characters (alpha)
  {
    match: (rel) => rel.startsWith("principessa-ui/generated/"),
    mode: "high",
    quality: 92,
  },
  // Pet rights + ranks already covered; daily click fullbleed illust
  {
    match: (rel) =>
      rel.startsWith("pet/daily-click") ||
      rel.startsWith("pet/rights/") ||
      rel === "pet/level-drain-principessa.webp",
    mode: "high",
    quality: 90,
  },
  // Tasks motion frames (fullscreen)
  {
    match: (rel) => rel.startsWith("tasks/"),
    mode: "premium",
    quality: 90,
  },
  // Main character stages
  {
    match: (rel) =>
      /^character(-stage-\d+|-icon)?\.webp$/.test(path.basename(rel)) ||
      rel === "evil-principessa.webp" ||
      rel === "default-tribute-avatar.webp" ||
      rel === "pet-wait-reveal.webp",
    mode: "premium",
    quality: 90,
  },
];

function listWebp(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listWebp(full, out);
    else if (/\.webp$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function gitExists(rel) {
  try {
    execFileSync("git", ["cat-file", "-e", `HEAD:${rel}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function gitShow(rel) {
  return execFileSync("git", ["show", `HEAD:${rel}`], { maxBuffer: 100 * 1024 * 1024 });
}

function findOriginal(webpRel) {
  const base = webpRel.replace(/\.webp$/i, "");
  for (const ext of [".png", ".jpg", ".jpeg"]) {
    const cand = `${base}${ext}`;
    if (gitExists(cand)) return cand;
  }
  return null;
}

function pickPolicy(rel) {
  for (const p of policies) {
    if (p.match(rel)) return p;
  }
  return null;
}

async function encode(buf, policy) {
  const img = sharp(buf, { failOn: "none" });
  if (policy.mode === "nearLossless") {
    return img
      .webp({
        nearLossless: true,
        quality: 80,
        alphaQuality: 100,
        effort: 5,
      })
      .toBuffer();
  }
  if (policy.mode === "premium" || policy.mode === "high") {
    return img
      .webp({
        quality: policy.quality ?? 92,
        alphaQuality: 100,
        effort: 5,
        smartSubsample: true,
      })
      .toBuffer();
  }
  throw new Error("unknown mode");
}

async function main() {
  const all = listWebp(path.join(ROOT, "public"));
  const results = [];
  let before = 0;
  let after = 0;
  let skippedNoPolicy = 0;
  let skippedNoOrig = 0;
  let skippedNoGain = 0;

  for (const full of all) {
    const rel = path.relative(path.join(ROOT, "public"), full).split(path.sep).join("/");
    const webpRel = `public/${rel}`;
    const policy = pickPolicy(rel);
    if (!policy) {
      skippedNoPolicy += 1;
      continue;
    }

    const origRel = findOriginal(webpRel);
    if (!origRel) {
      skippedNoOrig += 1;
      continue;
    }

    const origBuf = gitShow(origRel);
    const currentSize = fs.statSync(full).size;
    const nextBuf = await encode(origBuf, policy);

    // Only replace if we still save vs original, and prefer better quality even if larger than current q85
    // But never exceed original size * 0.98
    if (nextBuf.length >= origBuf.length * 0.98) {
      // fall back: keep current if already smaller
      skippedNoGain += 1;
      results.push({
        rel,
        status: "kept-current",
        reason: "reencode-not-smaller-than-original",
        policy: policy.mode,
        currentKB: +(currentSize / 1024).toFixed(1),
      });
      continue;
    }

    before += currentSize;
    after += nextBuf.length;
    fs.writeFileSync(full, nextBuf);
    results.push({
      rel,
      status: "reencoded",
      policy: policy.mode,
      quality: policy.quality ?? null,
      fromKB: +(currentSize / 1024).toFixed(1),
      toKB: +(nextBuf.length / 1024).toFixed(1),
      origKB: +(origBuf.length / 1024).toFixed(1),
      deltaKB: +((nextBuf.length - currentSize) / 1024).toFixed(1),
    });
  }

  const reencoded = results.filter((r) => r.status === "reencoded");
  const report = {
    totalWebpScanned: all.length,
    reencoded: reencoded.length,
    skippedNoPolicy,
    skippedNoOrig,
    skippedNoGain,
    bytesAdded: after - before,
    mbAdded: +((after - before) / 1024 / 1024).toFixed(2),
    samples: reencoded.slice(0, 30),
    all: results,
  };
  fs.writeFileSync(
    path.join(ROOT, "scripts", "webp-quality-reencode-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        totalWebpScanned: report.totalWebpScanned,
        reencoded: report.reencoded,
        skippedNoPolicy: report.skippedNoPolicy,
        skippedNoOrig: report.skippedNoOrig,
        skippedNoGain: report.skippedNoGain,
        mbAdded: report.mbAdded,
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
