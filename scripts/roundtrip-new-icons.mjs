// Round-trips the 44 newly registered crate icons out to PNG so they can be
// hand-replaced, then back to WebP.
//
//   node scripts/roundtrip-new-icons.mjs          webp -> png
//   node scripts/roundtrip-new-icons.mjs --back   png  -> webp
//
// Exactly one format per item survives a run: the old file is removed once the
// new one is on disk. Keeping both would leave no way to tell which copy is the
// current art, and getCrateItemImageUrl only ever asks for one of them.
//
// While the PNGs are the ones on disk, these icons 404 in the app - the
// resolver requests .webp for everything outside `collection === "cosplay"`.
// That is the intended state only for as long as the art is being replaced.

import sharp from "sharp";
import { readFile, writeFile, access, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "crate-items",
);

// The 6 cosplay full sets are already served as .png (collection === "cosplay"),
// so they are not part of the round trip.
const IDS = [
  "maid_headband","pearl_drop_earrings","smokey_eyes","beach_bangles","black_nails",
  "black_platform_boots","strappy_sandals","barcode_tattoo","owned_tattoo","qos_leg_tattoo",
  "bbc_owned_tshirt","black_lace_panties","cute_high_waist_skirt","gold_micro_thong",
  "cow_bell_collar","fangs","wine_lipstick","black_lace_bra","cute_crop_camisole","gold_bra",
  "pink_satin_bra","summer_tie_bikini_top","white_lace_bra","black_mini_skirt",
  "cow_print_panties","green_sarong","summer_tie_side_panties","cow_ears",
  "shibari_harness_with_black_bikini","lace_gloves","tongue_out","cow_print_bra",
  "crotch_pasties","white_lace_panties","ahegao_eyes","cow_legs","victorian_boots",
  "ballet_heels","womb_tattoo","nipple_pasties","shredded_fishnet_top",
  "ripped_denim_thong","bat_hairpins","gothic_lolita_dress",
];

const back = process.argv.includes("--back");
const from = back ? "png" : "webp";
const to = back ? "webp" : "png";

let done = 0;
const missing = [];

for (const id of IDS) {
  const src = path.join(DIR, `${id}.${from}`);
  const dst = path.join(DIR, `${id}.${to}`);
  try {
    await access(src);
  } catch {
    missing.push(`${id}.${from}`);
    continue;
  }
  const input = await readFile(src);
  const img = sharp(input);
  const out = back
    ? await img.webp({ quality: 92, effort: 5 }).toBuffer()
    : await img.png({ compressionLevel: 9 }).toBuffer();
  await writeFile(dst, out);
  // Only after the replacement is safely written, so an interrupted run loses
  // nothing.
  await unlink(src);
  done += 1;
}

console.log(`${from} -> ${to}: ${done}/${IDS.length} converted, ${done} ${from} removed`);
if (missing.length) console.log(`missing sources (${missing.length}): ${missing.join(", ")}`);
