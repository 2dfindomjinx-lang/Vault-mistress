import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const names = JSON.parse(fs.readFileSync("src/lib/generated/asset-names.json"));
for (const [kind, folders] of Object.entries(names)) {
  const base = kind === "worship" ? "private/worship" : "public/shrine";
  for (const [folder, files] of Object.entries(folders)) {
    for (const file of files) assert.ok(fs.existsSync(path.join(base, folder, file)), `${kind}/${folder}/${file}`);
  }
}
const manifest = JSON.parse(fs.readFileSync("src/lib/generated/overlay-manifest.json"));
for (const image of manifest.images) {
  const bytes = fs.readFileSync(path.join("public/principessa-discipline/overlay-pool", image.fileName));
  assert.equal(image.sizeBytes, bytes.length);
  assert.equal(image.sha256, createHash("sha256").update(bytes).digest("hex"));
}
const paths = JSON.parse(fs.readFileSync(".next/server/app-paths-manifest.json"));
const urls = JSON.parse(fs.readFileSync(".next/app-path-routes-manifest.json"));
const prerendered = JSON.parse(fs.readFileSync(".next/prerender-manifest.json")).routes;
let total = 0;
for (const [key, js] of Object.entries(paths)) {
  const trace = path.join(".next/server", `${js}.nft.json`);
  const files = JSON.parse(fs.readFileSync(trace)).files.map(file => path.resolve(path.dirname(trace), file));
  const relative = files.map(file => path.relative(process.cwd(), file).replaceAll("\\", "/"));
  const bytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  if (!prerendered[urls[key]]) total += bytes;
  if (key.startsWith("/s/")) assert.ok(relative.filter(file => file.startsWith("public/")).every(file => file.startsWith("public/crate-items/")), `Unrelated share assets: ${key}`);
  if (["/api/user/pet-worship/route", "/api/user/shrine/route", "/api/principessa-discipline/overlay-pool/route"].includes(key)) {
    assert.ok(!relative.some(file => /^(public|private)\//.test(file)), `Media in metadata route: ${key}`);
  }
  if (key.endsWith("wallpapers/image/route") || key === "/api/admin/mobile/live-chat/route") {
    assert.ok(!relative.some(file => /node_modules\/(firebase-admin|google-auth-library|@aws-sdk|@smithy)\//.test(file)), `Unneeded SDK: ${key}`);
  }
}
assert.ok(prerendered["/api/principessa-discipline/overlay-pool"], "Overlay manifest must be static");
console.log(`Asset filenames, overlay integrity, SDK isolation, and trace boundaries passed. Dynamic trace total: ${(total / 1e6).toFixed(2)} MB (uncompressed, repeated files per route).`);
