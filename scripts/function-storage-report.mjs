import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// Read-only local estimate. NFT sums are NOT Vercel's billed Functions Storage:
// the adapter may combine routes, and retained deployments are not available here.
const root = path.resolve(process.argv[2] || ".");
const out = process.argv[3];
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const relative = file => path.relative(root, file).replaceAll("\\", "/");
const size = file => { try { return fs.statSync(file).size; } catch { return 0; } };
const prerender = JSON.parse(fs.readFileSync(path.join(root, ".next/prerender-manifest.json"), "utf8"));
const staticRoutes = new Set(Object.keys(prerender.routes));
const routes = [];
const usage = new Map();
const packageTotals = new Map();
for (const trace of walk(path.join(root, ".next/server/app")).filter(file => /(?:route|page)\.js\.nft\.json$/.test(file))) {
  const route = "/" + relative(trace).replace(/^\.next\/server\/app\//, "").replace(/\/(?:route|page)\.js\.nft\.json$/, "").replace(/^(?:route|page)\.js\.nft\.json$/, "");
  const data = JSON.parse(fs.readFileSync(trace, "utf8"));
  const files = [...new Set([trace.replace(/\.nft\.json$/, ""), ...data.files.map(file => path.resolve(path.dirname(trace), file))])];
  const isStatic = staticRoutes.has(route);
  let bytes = 0;
  const missing = [];
  for (const file of files) {
    const n = size(file);
    bytes += n;
    if (!fs.existsSync(file)) missing.push(relative(file));
    if (isStatic) continue;
    const row = usage.get(file) ?? { path: relative(file), bytes: n, references: 0 };
    row.references++;
    usage.set(file, row);
  }
  routes.push({ route, static: isStatic, bytes, files: files.length, missing });
}
const files = [...usage.values()];
for (const file of files) {
  const match = file.path.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  if (!match) continue;
  const row = packageTotals.get(match[1]) ?? { package: match[1], uniqueBytes: 0, referencedBytes: 0, files: 0 };
  row.uniqueBytes += file.bytes;
  row.referencedBytes += file.bytes * file.references;
  row.files++;
  packageTotals.set(match[1], row);
}
const staticFiles = walk(path.join(root, ".next/static"));
const chunks = staticFiles.filter(file => file.endsWith(".js")).map(file => ({ path: relative(file), bytes: size(file), gzipBytes: zlib.gzipSync(fs.readFileSync(file)).length }));
const assets = walk(path.join(root, "public"));
const newPaths = ["public/principessa-ui/ritual/", "public/programs/principessa-discipline.mp4", "public/programs/principessa-wallpaper.mp4", "public/programs/discipline-poster.webp", "public/programs/wallpaper-poster.webp"];
const newAssets = assets.filter(file => newPaths.some(prefix => relative(file).startsWith(prefix))).map(file => ({ path: relative(file), bytes: size(file), functionReferences: usage.get(file)?.references ?? 0 }));
const result = {
  measuredAt: new Date().toISOString(), root,
  note: "Uncompressed Next output traces; dynamic-route sum counts duplicates, unique union does not. Neither is a billed deployment total.",
  summary: { tracedRoutes: routes.length, staticRoutes: routes.filter(r => r.static).length, dynamicRoutes: routes.filter(r => !r.static).length, dynamicTraceSumBytes: routes.filter(r => !r.static).reduce((a,r) => a+r.bytes,0), uniqueDynamicBytes: files.reduce((a,f) => a+f.bytes,0), publicBytes: assets.reduce((a,f) => a+size(f),0), publicFiles: assets.length, jsBytes: chunks.reduce((a,f) => a+f.bytes,0), cssBytes: staticFiles.filter(file=>file.endsWith(".css")).reduce((a,f)=>a+size(f),0) },
  routes: routes.sort((a,b)=>b.bytes-a.bytes),
  packages: [...packageTotals.values()].sort((a,b)=>b.uniqueBytes-a.uniqueBytes),
  largestFiles: files.sort((a,b)=>b.bytes-a.bytes).slice(0,35),
  mostDuplicatedFiles: [...files].sort((a,b)=>(b.references-1)*b.bytes-(a.references-1)*a.bytes).slice(0,35),
  largestClientChunks: chunks.sort((a,b)=>b.bytes-a.bytes).slice(0,15),
  bundledMedia: files.filter(file=>/\.(?:png|webp|jpg|mp4|mp3|avif|gif|jpeg)$/i.test(file.path)),
  newAssets,
};
if(out) fs.writeFileSync(path.resolve(out),JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify({summary:result.summary, largestRoutes:result.routes.filter(r=>!r.static).slice(0,8), topPackages:result.packages.slice(0,8), newAssets},null,2));
