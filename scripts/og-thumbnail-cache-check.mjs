import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const script = fileURLToPath(new URL("./generate-server-assets.mjs", import.meta.url));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "vault-og-cache-check-"));
const cache = path.join(fixture, ".next/cache/vault-og-thumbnails");
const thumbnails = path.join(fixture, "private/generated-og");
function removeFixturePath(target) {
  const resolved = path.resolve(target);
  assert.ok(resolved === fixture || resolved.startsWith(fixture + path.sep));
  fs.rmSync(resolved, { recursive: true, force: true });
}
function run() {
  return execFileSync(process.execPath, [script], {
    cwd: fixture, encoding: "utf8", env: { ...process.env, PRIVATE_MEDIA_STORAGE: "local" },
  });
}
async function image(name, background) {
  await sharp({ create: { width: 300, height: 300, channels: 4, background } })
    .png().toFile(path.join(fixture, "public/crate-items", name));
}
try {
  for (const folder of ["public/crate-items", "public/shrine", "public/principessa-discipline/overlay-pool", "private/gallery", "private/worship"]) {
    fs.mkdirSync(path.join(fixture, folder), { recursive: true });
  }
  await image("one.png", { r: 255, g: 0, b: 0, alpha: 0.5 });
  await image("two.png", { r: 0, g: 0, b: 255, alpha: 1 });
  assert.match(run(), /2 generated, 0 cache hits/);
  const originals = Object.fromEntries(fs.readdirSync(thumbnails).map(name => [name, fs.readFileSync(path.join(thumbnails, name))]));
  // Simulate a new deployment checkout with only the restored build cache.
  removeFixturePath(thumbnails);
  assert.match(run(), /0 generated, 2 cache hits/);
  let transparentThumbnails = 0;
  for (const [name, bytes] of Object.entries(originals)) {
    assert.deepEqual(fs.readFileSync(path.join(thumbnails, name)), bytes);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, 256);
    if (metadata.hasAlpha) transparentThumbnails++;
  }
  assert.equal(transparentThumbnails, 1, "The transparent source must retain its alpha channel");
  const readers = fs.readFileSync(path.join(fixture, "src/lib/generated/crate-image-readers.ts"), "utf8");
  assert.ok(readers.includes("private/generated-og/"));
  assert.ok(!readers.includes(".next/cache"));
  await image("one.png", { r: 0, g: 255, b: 0, alpha: 0.5 });
  assert.match(run(), /1 generated, 1 cache hits/);
  assert.equal(fs.readdirSync(cache).length, 2, "Obsolete thumbnail must leave the cache");
  removeFixturePath(cache);
  assert.match(run(), /0 generated, 0 cache hits, 2 existing thumbnails cached/);
  fs.unlinkSync(path.join(fixture, "public/crate-items/two.png"));
  assert.match(run(), /0 generated, 1 cache hits/);
  assert.equal(fs.readdirSync(cache).length, 1);
  console.log("OG cache checks passed: cold build, restored cache, alpha, changed/removed assets, local cache seeding and runtime paths.");
} finally {
  removeFixturePath(fixture);
}
