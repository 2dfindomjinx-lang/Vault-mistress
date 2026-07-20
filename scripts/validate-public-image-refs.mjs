import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const PUBLIC = path.join(ROOT, "public");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const KEEP = new Set(["/icon.png", "/icons/coin.png"]);
const re = /(["'`])(\/[^"'`\s]+?\.(?:png|jpe?g|webp))(\?[^"'`]*)?\1/gi;

const missing = [];
let checked = 0;

for (const file of walk(SRC)) {
  const text = fs.readFileSync(file, "utf8");
  let match;
  while ((match = re.exec(text))) {
    const p = match[2].split("?")[0];
    if (KEEP.has(p)) continue;
    checked += 1;
    const disk = path.join(PUBLIC, p.replace(/^\//, ""));
    if (!fs.existsSync(disk)) {
      missing.push({ file: path.relative(ROOT, file), path: p });
    }
  }
}

console.log(JSON.stringify({ checked, missingCount: missing.length, missing: missing.slice(0, 50) }, null, 2));
