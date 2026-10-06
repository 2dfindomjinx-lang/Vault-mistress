import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

const bucket = "vault-private-media";
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]))).flat();
}
export async function privateMediaManifest(root) {
  const files = [...await walk(path.join(root, "private/gallery")), ...await walk(path.join(root, "private/worship"))];
  const entries = {};
  for (const file of files.sort()) {
    if (!/\.(avif|gif|jfif|jpe?g|png|webp)$/i.test(file)) continue;
    const bytes = await fs.readFile(file);
    const key = path.relative(path.join(root, "private"), file).replaceAll("\\", "/");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    entries[key] = { key: `v1/${sha256}${path.extname(file).toLowerCase()}`, sha256, size: bytes.length };
  }
  return entries;
}
function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Error("Private media requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function verifyPrivateMedia(entries) {
  const db = client();
  const { data: info, error } = await db.storage.getBucket(bucket);
  if (error || !info || info.public) throw Error("Private media bucket is missing or public. Apply the storage SQL and run the upload script first.");
  const hash = createHash("sha256").update(JSON.stringify(entries)).digest("hex");
  const { data, error: manifestError } = await db.storage.from(bucket).download(`manifests/${hash}.json`);
  if (manifestError || !data || await data.text() !== JSON.stringify(entries)) {
    throw Error("Private media upload has not been verified for this exact asset set. Run npm run media:upload before building remote mode.");
  }
}
async function main() {
  for (const file of [".env.local", ".env"]) {
    try { process.loadEnvFile(file); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const entries = await privateMediaManifest(process.cwd());
  if (process.argv.includes("--upload")) {
    const db = client();
    const { data: info, error } = await db.storage.getBucket(bucket);
    if (error || !info || info.public) throw Error("Apply supabase/202610060002_private_media.sql first. A private bucket is required.");
    for (const [file, entry] of Object.entries(entries)) {
      const bytes = await fs.readFile(path.join(process.cwd(), "private", file));
      const { error: uploadError } = await db.storage.from(bucket).upload(entry.key, bytes, { upsert: true, contentType: "application/octet-stream", cacheControl: "31536000" });
      if (uploadError) throw uploadError;
      const { data, error: downloadError } = await db.storage.from(bucket).download(entry.key);
      if (downloadError || !data || createHash("sha256").update(Buffer.from(await data.arrayBuffer())).digest("hex") !== entry.sha256) {
        throw Error(`Read-back verification failed: ${file}`);
      }
    }
    const json = JSON.stringify(entries);
    const hash = createHash("sha256").update(json).digest("hex");
    const { error: saveError } = await db.storage.from(bucket).upload(`manifests/${hash}.json`, json, { upsert: true, contentType: "application/json" });
    if (saveError) throw saveError;
  }
  await verifyPrivateMedia(entries);
  console.log(`Verified ${Object.keys(entries).length} private files. PRIVATE_MEDIA_STORAGE=supabase may now be enabled at build time.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
