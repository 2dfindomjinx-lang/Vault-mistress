// Invariants for the Runway fallback outfit generator.
//
//   node --experimental-strip-types scripts/runway-outfit-check.mjs
//
// Generated outfits are shown to real users and rated for real coins, so a
// broken one is not cosmetic: a missing layer renders an invisible piece, and a
// slot conflict renders two things in the same place.

import { register } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// The lib files import through the "@/" tsconfig alias, which bare node does
// not know about.
register(
  "data:text/javascript," +
    encodeURIComponent(`
      import { pathToFileURL } from "node:url";
      import path from "node:path";
      const ROOT = path.resolve(process.cwd(), "src");
      export function resolve(specifier, context, next) {
        if (specifier.startsWith("@/")) {
          const p = path.join(ROOT, specifier.slice(2));
          return next(pathToFileURL(p.endsWith(".ts") ? p : p + ".ts").href, context);
        }
        return next(specifier, context);
      }
    `),
  pathToFileURL("./"),
);

const { generateOutfitBatch, generateSmartOutfit, generateRandomOutfit } = await import(
  "../src/lib/runway-outfit-generator.ts"
);
const { resolveAvatarLayer, getItemAvatarSlot } = await import("../src/lib/avatar-slots.ts");

const SAMPLE_SIZE = 3000;
let seed = 20260812;
const rng = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

const failures = [];
const fail = (message) => failures.push(message);

const batch = generateOutfitBatch(SAMPLE_SIZE, rng);
const kinds = { smart: 0, random: 0 };
const sizes = {};
const themes = {};
const missingLayers = new Set();

for (const outfit of batch) {
  kinds[outfit.kind] += 1;
  const slots = outfit.equippedAvatarSlots;
  const count = Object.keys(slots).length;
  sizes[count] = (sizes[count] ?? 0) + 1;
  if (outfit.theme) themes[outfit.theme] = (themes[outfit.theme] ?? 0) + 1;

  if (count === 0) fail("empty outfit produced");
  if (slots.fullLegs && (slots.shoes || slots.thighhighs || slots.leggings)) {
    fail(`fullLegs paired with a leg/foot slot: ${JSON.stringify(slots)}`);
  }
  if (slots.thighhighs && slots.leggings) fail("thighhighs and leggings together");

  for (const [slot, itemId] of Object.entries(slots)) {
    if (getItemAvatarSlot(itemId) !== slot) fail(`${itemId} is not a ${slot} item`);
    const layer = resolveAvatarLayer(itemId);
    if (!layer) {
      missingLayers.add(`${itemId} (no layer resolved)`);
      continue;
    }
    if (!existsSync(path.join("public", layer.replace(/^\//, "")))) {
      missingLayers.add(`${itemId} -> ${layer}`);
    }
  }
}

for (const entry of missingLayers) fail(`missing avatar layer: ${entry}`);

// The feed serves four themed outfits per absurd one.
const ratio = kinds.smart / Math.max(1, kinds.random);
if (Math.abs(ratio - 4) > 0.01) fail(`smart:random ratio is ${ratio.toFixed(2)}:1, expected 4:1`);

// A themed outfit that never covers the body is not a combination.
const smartSample = Array.from({ length: 300 }, () => generateSmartOutfit(rng));
const dressed = smartSample.filter((o) => o.equippedAvatarSlots.top || o.equippedAvatarSlots.bottom);
if (dressed.length !== smartSample.length) {
  fail(`${smartSample.length - dressed.length} smart outfits had neither top nor bottom`);
}

// Random outfits are allowed to be absurd, but never empty.
const randomSample = Array.from({ length: 300 }, () => generateRandomOutfit(rng));
if (randomSample.some((o) => Object.keys(o.equippedAvatarSlots).length === 0)) {
  fail("random generator produced an empty outfit");
}

console.log(`${SAMPLE_SIZE} outfits | smart ${kinds.smart}, random ${kinds.random} (${ratio.toFixed(2)}:1)`);
console.log(
  "pieces per outfit:",
  Object.entries(sizes)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => `${k}:${v}`)
    .join(" "),
);
console.log(`distinct themes: ${Object.keys(themes).length}`);

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const message of [...new Set(failures)].slice(0, 20)) console.error(`  ${message}`);
  process.exit(1);
}
console.log("\nall passed");
