import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
await mkdir('tmp/og-check',{recursive:true});
const out=path.resolve('tmp/og-check/render.cjs');
await build({stdin:{contents:'export { default as render } from "./src/app/s/[token]/opengraph-image"; export { crateImageReaders } from "./src/lib/generated/crate-image-readers";',resolveDir:process.cwd()},
  outfile:out,bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',
  tsconfigRaw:{compilerOptions:{baseUrl:'.',paths:{'@/*':['./src/*']}}},
  plugins:[{name:'seal-fixture',setup(b){b.onResolve({filter:/^@\/lib\/court-seal$/},()=>({path:'seal',namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const resolveSealPayload=async()=>({board:"crate",itemId:"witch_cosplay",itemName:"Witch Cosplay",rarity:"legendary",handle:"Thumbnail Check",createdAt:0});',loader:'js'}));}}],logLevel:'silent'});
const {render,crateImageReaders}=await import(pathToFileURL(out));
let originalBytes=0, thumbnailBytes=0, count=0, transparent=0;
for(const [url,reader] of Object.entries(crateImageReaders)){
  const thumb=await reader(), original=await readFile(path.join('public',url));
  const metadata=await sharp(thumb).metadata();
  assert.equal(metadata.format,'png');assert.ok(metadata.width<=256&&metadata.height<=256);
  const source=await sharp(original).metadata();
  if(source.hasAlpha){assert.ok(metadata.hasAlpha);transparent++;}
  originalBytes+=original.length;thumbnailBytes+=thumb.length;count++;
}
const response=await render({params:Promise.resolve({token:'fixture'})});
const image=Buffer.from(await response.arrayBuffer());const meta=await sharp(image).metadata();
assert.equal(meta.width,1200);assert.equal(meta.height,630);
await writeFile('tmp/og-check/receipt.png',image);
console.log(JSON.stringify({count,transparent,originalBytes,thumbnailBytes,reductionPercent:(1-thumbnailBytes/originalBytes)*100,rendered:'tmp/og-check/receipt.png'}));
