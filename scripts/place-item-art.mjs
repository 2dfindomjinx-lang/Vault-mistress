// Copies new item art into the repo, converting to the formats the app expects.
//
//   node scripts/place-item-art.mjs <source-dir>
//
// Expected source layout - rarity folder, then slot folder, then PNGs:
//
//   <source-dir>/epic/fulllegs/victorian_boots.png
//   <source-dir>/common/tattoo/owned_tattoo.png
//
// ORIGINALS ARE NEVER MODIFIED OR DELETED. Everything here only reads them.
//
// Each item lands in two places:
//   * public/crate-items/<id>.<ext>        - the inventory / case icon
//   * public/avatar/<slot folder>/<id>.webp - the layer drawn on the avatar
//
// Why webp and not the source PNG: resolveAvatarLayer() in
// src/lib/avatar-slots.ts builds the path as `${itemId}.webp` with no per-item
// extension. Dropping PNGs there would mean adding an override entry for every
// single item, so they are converted once here instead.
//
// The one exception is the crate icon for full sets. getCrateItemImageUrl()
// short-circuits the "cosplay" collection to `.png`, so those keep their PNG
// or that branch would 404.

import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.argv[2];

if (!source) {
  console.error("usage: node scripts/place-item-art.mjs <source-dir>");
  process.exit(1);
}

// Source slot folder -> folder under public/avatar/. Keep in step with
// SLOT_FOLDER_MAP in src/lib/avatar-slots.ts.
//
// "fullset" is not a slot: those are whole-character portraits resolved by
// resolveFullSetImagePath, and they are also the only ones whose icon stays PNG.
const AVATAR_DIR_BY_FOLDER = {
  ears: "ears",
  eyes: "blindfold",
  mouth: "mouth",
  collar: "collar",
  top: "tops",
  bottom: "bottoms",
  hands: "hands",
  shoes: "shoes",
  leggings: "leggings",
  thighhighs: "thighhighs",
  fulllegs: "fulllegs",
  fullbody: "fullbody",
  tattoo: "tattoo",
  fullset: "fullset",
};

const rows = [];
for (const rarity of readdirSync(source)) {
  const rarityDir = join(source, rarity);
  if (!statSync(rarityDir).isDirectory()) continue;
  for (const folder of readdirSync(rarityDir)) {
    const slotDir = join(rarityDir, folder);
    if (!statSync(slotDir).isDirectory()) continue;
    for (const file of readdirSync(slotDir)) {
      if (!file.toLowerCase().endsWith(".png")) continue;
      rows.push({ folder, id: file.replace(/\.png$/i, ""), rarity, source: join(slotDir, file) });
    }
  }
}

const unmapped = [...new Set(rows.map((r) => r.folder))].filter((f) => !AVATAR_DIR_BY_FOLDER[f]);
if (unmapped.length > 0) {
  console.error(`Unmapped source folders: ${unmapped.join(", ")}`);
  process.exit(1);
}

let webpWritten = 0;
let pngCopied = 0;

for (const row of rows) {
  const isFullSet = row.folder === "fullset";

  const layerDir = join(REPO, "public", "avatar", AVATAR_DIR_BY_FOLDER[row.folder]);
  mkdirSync(layerDir, { recursive: true });
  await sharp(row.source).webp({ quality: 92 }).toFile(join(layerDir, `${row.id}.webp`));
  webpWritten++;

  const iconDir = join(REPO, "public", "crate-items");
  mkdirSync(iconDir, { recursive: true });
  if (isFullSet) {
    copyFileSync(row.source, join(iconDir, `${row.id}.png`));
    pngCopied++;
  } else {
    await sharp(row.source).webp({ quality: 90 }).toFile(join(iconDir, `${row.id}.webp`));
    webpWritten++;
  }
}

console.log(`${rows.length} items placed`);
console.log(`  ${webpWritten} webp written`);
console.log(`  ${pngCopied} png copied (full-set icons)`);

console.log("\nrarity     slot      id");
for (const row of rows.sort((a, b) => a.rarity.localeCompare(b.rarity) || a.folder.localeCompare(b.folder) || a.id.localeCompare(b.id))) {
  console.log(`${row.rarity.padEnd(10)} ${row.folder.padEnd(9)} ${row.id}`);
}
