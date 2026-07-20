import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";

const samples = [
  "public/avatar/base/base-model.webp",
  "public/avatar/tops/classic-bra.webp",
  "public/avatar/ears/pink-ears.webp",
  "public/avatar/collar/classic-collar.webp",
  "public/avatar/hands/classic-pawmitts.webp",
  "public/avatar/fullbody/classic-maid-outfit.webp",
  "public/crate-items/classic-collar.webp",
  "public/crate-items/good-boy-tag.webp",
  "public/crate-items/classic-tail.webp",
  "public/crate-items/owned-tag.webp",
  "public/cosmetics/avatar-catgirl.webp",
  "public/cosmetics/avatar-denialqueen.webp",
  "public/cosmetics/avatar-goth.webp",
  "public/character.webp",
  "public/character-stage-100.webp",
  "public/character-icon.webp",
  "public/gallery/common-1.webp",
  "public/gallery/divine-1.webp",
  "public/gallery/divine-3.webp",
  "public/gallery/secret-1.webp",
  "public/gallery/pet-3.webp",
  "public/gallery/sacrifice-2.webp",
  "public/gallery/rare-2.webp",
  "public/puzzle/get_on_your_knees.webp",
  "public/puzzle/brainmelt.webp",
  "public/puzzle/owned_by_principessa.webp",
  "public/puzzle/put_this_on.webp",
  "public/shrine/shrine_1.webp",
  "public/shrine/shrine_11.webp",
  "public/shrine/shrine_19.webp",
  "public/badges/gold.webp",
  "public/pet-ranks/rank-1.webp",
  "public/crate-icons/principessa-case.webp",
  "public/tasks/daily-motion/motion-50.webp",
  "public/principessa-ui/generated/principessa-home-command.webp",
  "public/avatar/background/bedroom.webp",
  "public/default-tribute-avatar.webp",
  "public/evil-principessa.webp",
];

function gitExists(rel) {
  try {
    execFileSync("git", ["cat-file", "-e", `HEAD:${rel}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function gitShow(rel) {
  return execFileSync("git", ["show", `HEAD:${rel}`], { maxBuffer: 80 * 1024 * 1024 });
}

function msePsnr(a, b) {
  let sum = 0;
  const n = a.length;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  const mse = sum / n;
  if (mse === 0) return 99;
  return 10 * Math.log10((255 * 255) / mse);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "webp-audit-"));
const rows = [];
const previewDir = path.join("scripts", "webp-audit-previews");
fs.mkdirSync(previewDir, { recursive: true });

for (const webp of samples) {
  if (!fs.existsSync(webp)) {
    rows.push({ webp, status: "missing-webp" });
    continue;
  }
  const base = webp.replace(/\.webp$/i, "");
  let origRel = null;
  for (const ext of [".png", ".jpg", ".jpeg"]) {
    const c = (base + ext).replace(/\\/g, "/");
    if (gitExists(c)) {
      origRel = c;
      break;
    }
  }
  if (!origRel) {
    rows.push({ webp, status: "no-git-original" });
    continue;
  }

  const origBuf = gitShow(origRel);
  const origPath = path.join(tmp, path.basename(origRel));
  fs.writeFileSync(origPath, origBuf);

  const oMeta = await sharp(origPath).metadata();
  const targetW = Math.min(oMeta.width || 1, 640);
  const targetH = Math.round(targetW * ((oMeta.height || 1) / (oMeta.width || 1)));

  const oRaw = await sharp(origPath).resize(targetW, targetH, { fit: "fill" }).ensureAlpha().raw().toBuffer();
  const wRaw = await sharp(webp).resize(targetW, targetH, { fit: "fill" }).ensureAlpha().raw().toBuffer();
  const psnr = msePsnr(oRaw, wRaw);

  let alphaPsnr = null;
  if (oMeta.hasAlpha) {
    const oA = await sharp(origPath)
      .resize(targetW, targetH, { fit: "fill" })
      .extractChannel(3)
      .raw()
      .toBuffer();
    const wA = await sharp(webp)
      .resize(targetW, targetH, { fit: "fill" })
      .ensureAlpha()
      .extractChannel(3)
      .raw()
      .toBuffer();
    alphaPsnr = msePsnr(oA, wA);
  }

  async function edgeMean(input) {
    const { data, info } = await sharp(input)
      .resize(targetW, targetH, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let s = 0;
    let c = 0;
    for (let y = 1; y < info.height - 1; y++) {
      for (let x = 1; x < info.width - 1; x++) {
        const i = y * info.width + x;
        const gx = data[i + 1] - data[i - 1];
        const gy = data[i + info.width] - data[i - info.width];
        s += Math.hypot(gx, gy);
        c++;
      }
    }
    return s / c;
  }

  const oEdge = await edgeMean(origPath);
  const wEdge = await edgeMean(webp);
  const edgeRatio = wEdge / (oEdge || 1);

  const left = await sharp(origPath).resize({ width: 360, withoutEnlargement: true }).png().toBuffer();
  const right = await sharp(webp).resize({ width: 360, withoutEnlargement: true }).png().toBuffer();
  const lMeta = await sharp(left).metadata();
  const rMeta = await sharp(right).metadata();
  const h = Math.max(lMeta.height || 1, rMeta.height || 1);
  const previewName = `${path.basename(webp, ".webp")}-compare.png`;
  await sharp({
    create: {
      width: (lMeta.width || 360) + (rMeta.width || 360) + 8,
      height: h,
      channels: 4,
      background: { r: 20, g: 20, b: 24, alpha: 1 },
    },
  })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: right, left: (lMeta.width || 360) + 8, top: 0 },
    ])
    .png()
    .toFile(path.join(previewDir, previewName));

  const savePct = (1 - fs.statSync(webp).size / origBuf.length) * 100;
  const risk =
    psnr < 32 || (alphaPsnr != null && alphaPsnr < 35) || edgeRatio < 0.85 || savePct > 92
      ? "high"
      : psnr < 36 || (alphaPsnr != null && alphaPsnr < 40) || edgeRatio < 0.92 || savePct > 88
        ? "medium"
        : "low";

  rows.push({
    webp: webp.replace(/^public\//, ""),
    orig: origRel.replace(/^public\//, ""),
    size: `${oMeta.width}x${oMeta.height}`,
    alpha: Boolean(oMeta.hasAlpha),
    origKB: +(origBuf.length / 1024).toFixed(1),
    webpKB: +(fs.statSync(webp).size / 1024).toFixed(1),
    savePct: +savePct.toFixed(1),
    psnr: +psnr.toFixed(2),
    alphaPsnr: alphaPsnr == null ? null : +alphaPsnr.toFixed(2),
    edgeRatio: +edgeRatio.toFixed(3),
    risk,
    preview: `scripts/webp-audit-previews/${previewName}`,
  });
}

rows.sort((a, b) => {
  const order = { high: 0, medium: 1, low: 2 };
  return (order[a.risk] ?? 9) - (order[b.risk] ?? 9) || (a.psnr ?? 99) - (b.psnr ?? 99);
});

fs.writeFileSync("scripts/webp-quality-audit-samples.json", JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows, null, 2));
console.log(
  "counts",
  JSON.stringify({
    total: rows.length,
    high: rows.filter((r) => r.risk === "high").length,
    medium: rows.filter((r) => r.risk === "medium").length,
    low: rows.filter((r) => r.risk === "low").length,
  }),
);
