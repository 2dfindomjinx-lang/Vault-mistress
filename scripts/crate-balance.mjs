// Balance report for every crate: advertised band odds vs the actual weights,
// plus expected value of one open.
//
// EV/cost is the number that matters. Above 1.00 the crate pays out more than
// it costs, which is an open-sell-repeat coin loop rather than a generous crate.
//
//   node --experimental-strip-types scripts/crate-balance.mjs [crate_type]

import { readFileSync } from "node:fs";
import { CRATE_TYPES, SAMPLE_CRATE_ITEMS } from "../src/lib/crates.ts";

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
const only = process.argv[2];

// The "// Common 44%" comments are what players are shown, so they are verified
// against the weights instead of trusted.
const src = readFileSync("src/lib/crates.ts", "utf8");
function claimedBands(crateType) {
  const start = src.indexOf(`${crateType}: {`);
  if (start < 0) return {};
  const rest = src.slice(start + 1);
  const nextIdx = rest.search(/^  [a-z_]+: \{$/m);
  const blk = rest.slice(0, nextIdx < 0 ? undefined : nextIdx);
  const out = {};
  for (const m of blk.matchAll(/^\s*\/\/\s*([A-Za-z]+)\s+([\d.]+)\s*%/gm)) {
    const r = m[1].toLowerCase();
    if (RARITIES.includes(r)) out[r] = parseFloat(m[2]);
  }
  return out;
}

let problems = 0;
for (const [type, crate] of Object.entries(CRATE_TYPES)) {
  if (only && type !== only) continue;
  const total = crate.drops.reduce((s, d) => s + d.weight, 0);
  const claimed = claimedBands(type);

  let ev = 0;
  const wByR = {}, evByR = {};
  for (const d of crate.drops) {
    const it = SAMPLE_CRATE_ITEMS[d.item_id];
    if (!it) { console.log(`  !! ${type}: tanimsiz item ${d.item_id}`); problems++; continue; }
    const p = d.weight / total;
    ev += p * it.sell_value;
    wByR[it.rarity] = (wByR[it.rarity] ?? 0) + d.weight;
    evByR[it.rarity] = (evByR[it.rarity] ?? 0) + p * it.sell_value;
  }

  const ratio = ev / crate.cost;
  console.log(`\n=== ${type}   cost ${crate.cost}   ${crate.drops.length} drop   agirlik ${total}${total === 10000 ? "" : "  (10000 degil)"}`);
  console.log(`    EV ${ev.toFixed(0)}   EV/cost ${ratio.toFixed(3)}   ${ratio > 1 ? "*** ZARARDA ***" : "ev avantaji %" + (100 * (1 - ratio)).toFixed(1)}`);
  if (ratio > 1) problems++;

  const ids = crate.drops.map((d) => d.item_id);
  const dup = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
  if (dup.length) { console.log(`    !! duplike drop: ${dup.join(", ")}`); problems++; }

  console.log(`    bant        ilan   gercek     fark   EV katkisi`);
  for (const r of RARITIES) {
    if (!wByR[r]) continue;
    const act = 100 * wByR[r] / total;
    const cl = claimed[r];
    const diff = cl === undefined ? null : act - cl;
    if (diff !== null && Math.abs(diff) >= 0.005) problems++;
    console.log(
      `    ${r.padEnd(11)}${(cl ?? "-").toString().padStart(5)}%  ${act.toFixed(2).padStart(6)}%  ` +
      `${diff === null ? "    -  " : ((diff >= 0 ? "+" : "") + diff.toFixed(2)).padStart(7)}` +
      `${diff !== null && Math.abs(diff) >= 0.005 ? " ***" : "    "} ` +
      `${evByR[r].toFixed(0).padStart(6)} (%${(100 * evByR[r] / ev).toFixed(1)})`,
    );
  }
  const sum = Object.values(claimed).reduce((a, b) => a + b, 0);
  if (Object.keys(claimed).length && Math.abs(sum - 100) > 0.005) {
    console.log(`    !! ilan edilen bantlarin toplami %${sum}`);
    problems++;
  }
}
console.log(problems ? `\n${problems} sorun bulundu` : "\nsorun yok");
process.exit(problems ? 1 : 0);
