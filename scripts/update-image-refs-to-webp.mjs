// Rewrite static/dynamic public image path references from png/jpg/jpeg to webp
// where the corresponding webp file exists under public/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const SRC = path.join(ROOT, "src");

const KEEP = new Set([
  "/icon.png",
  "/icons/coin.png",
  "icon.png",
  "icons/coin.png",
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs|css|md|json)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function publicExists(urlPath) {
  const clean = urlPath.split("?")[0].replace(/^\//, "");
  return fs.existsSync(path.join(PUBLIC, clean));
}

function toWebpPath(assetPath) {
  return assetPath.replace(/\.(png|jpe?g)(\?[^"'`)\]\s]*)?$/i, (_, _ext, query) => {
    return `.webp${query ?? ""}`;
  });
}

function shouldKeep(assetPath) {
  const noQuery = assetPath.split("?")[0];
  return KEEP.has(noQuery) || KEEP.has(noQuery.replace(/^\//, ""));
}

function rewriteContent(content) {
  let next = content;
  let hits = 0;

  // Absolute public paths in quotes: "/foo/bar.png"
  next = next.replace(/(["'`])(\/[^"'`\s]+?\.(?:png|jpe?g))(\?[^"'`]*)?\1/gi, (full, q, p, query = "") => {
    if (shouldKeep(p)) return full;
    const candidate = `${p.replace(/\.(png|jpe?g)$/i, ".webp")}`;
    if (publicExists(candidate)) {
      hits += 1;
      return `${q}${candidate}${query ?? ""}${q}`;
    }
    return full;
  });

  // Template literals ending with .png/.jpg before ${ or after template parts:
  // `/gallery/pet-${index + 1}.png` and `/crate-items/${itemId}.png`
  next = next.replace(
    /([`'"])(\/[^`'"]*?)\.(png|jpe?g)(\?[^`'"]*)?([`'"])/gi,
    (full, q1, base, ext, query = "", q2) => {
      // only if no ${ in the static form already handled above
      if (base.includes("${")) return full;
      const p = `${base}.${ext}`;
      if (shouldKeep(`/${p}`.replace(/^\/\//, "/")) || shouldKeep(p)) return full;
      const candidate = `${base}.webp`;
      const check = candidate.startsWith("/") ? candidate : `/${candidate}`;
      if (publicExists(check.startsWith("/") ? check : `/${check}`)) {
        hits += 1;
        return `${q1}${base}.webp${query ?? ""}${q2}`;
      }
      return full;
    },
  );

  // Explicit dynamic suffixes used across the app
  const dynamicPairs = [
    // `/crate-items/${id}.png` style already covered if fully static end
    [/\.png`/g, ".webp`"], // end of template: ...${x}.png`
    [/\.jpg`/g, ".webp`"],
    [/\.jpeg`/g, ".webp`"],
    [/\.png"/g, '.webp"'],
    [/\.jpg"/g, '.webp"'],
    [/\.jpeg"/g, '.webp"'],
    [/\.png'/g, ".webp'"],
    [/\.jpg'/g, ".webp'"],
    [/\.jpeg'/g, ".webp'"],
  ];

  // Safer targeted replacements for known builders
  const targeted = [
    [/\/crate-items\/\$\{([^}]+)\}\.png/g, "/crate-items/${$1}.webp"],
    [/\/crate-icons\/\$\{([^}]+)\}\.png/g, "/crate-icons/${$1}.webp"],
    [/\/avatar\/\$\{([^}]+)\}\/\$\{([^}]+)\}\.png/g, "/avatar/${$1}/${$2}.webp"],
    [/\/gallery\/pet-\$\{([^}]+)\}\.png/g, "/gallery/pet-${$1}.webp"],
    [/\/gallery\/femsub\/pet-\$\{([^}]+)\}\.png/g, "/gallery/femsub/pet-${$1}.webp"],
    [/\/gallery\/sacrifice-\$\{([^}]+)\}\.png/g, "/gallery/sacrifice-${$1}.webp"],
    [/\/pet-ranks\/rank-\$\{([^}]+)\}\.png/g, "/pet-ranks/rank-${$1}.webp"],
    [
      /\/pet\/daily-click\/click-\$\{([^}]+)\}\.png/g,
      "/pet/daily-click/click-${$1}.webp",
    ],
    [
      /\/pet\/daily-click-femsub\/click-\$\{([^}]+)\}\.png/g,
      "/pet/daily-click-femsub/click-${$1}.webp",
    ],
    // rights background: prefix-N.png
    [
      /(\$\{[^}]+\}-\$\{[^}]+\})\.png/g,
      "$1.webp",
    ],
    [
      /(RIGHTS_IMAGE_PATH_PREFIX[^;]+)\.png/g,
      (m) => m.replace(/\.png/g, ".webp"),
    ],
  ];

  for (const [re, rep] of targeted) {
    const before = next;
    next = next.replace(re, rep);
    if (next !== before) hits += 1;
  }

  // Fix accidental conversion of kept icons if any
  next = next.replace(/\/icons\/coin\.webp/g, "/icons/coin.png");
  next = next.replace(/\/icon\.webp/g, "/icon.png");
  next = next.replace(/type:\s*"image\/webp"/g, (m, offset, str) => {
    // only if near icon.png favicon
    return m;
  });

  // mime type for icon must stay image/png
  // layout uses type: "image/png" with url icon.png - fine

  return { content: next, hits };
}

function main() {
  const files = walk(SRC);
  // also scripts comments optional - skip
  const changed = [];
  for (const file of files) {
    const original = fs.readFileSync(file, "utf8");
    // skip binary-ish
    if (original.includes("\u0000")) continue;
    const { content, hits } = rewriteContent(original);
    if (content !== original) {
      fs.writeFileSync(file, content);
      changed.push({ file: path.relative(ROOT, file), hits });
    }
  }
  console.log(JSON.stringify({ filesChanged: changed.length, changed }, null, 2));
}

main();
