// Publicly licensed recording sources, saved only inside this audition folder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const OUT=path.join(path.dirname(fileURLToPath(import.meta.url)),'sources/foley');
fs.mkdirSync(OUT,{recursive:true});
const sources=[
 {id:'casino',author:'Kenney',title:'Casino Audio',page:'https://kenney.nl/assets/casino-audio',license:'CC0-1.0',file:'casino.zip',url:'https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip'},
 {id:'book',author:'Voltiment555',title:'Book Flip Sounds',page:'https://opengameart.org/content/book-flip-sounds',license:'CC0-1.0',file:'book.zip',url:'https://opengameart.org/sites/default/files/BookFlip_SFX.zip'},
 {id:'fireplace',author:'AntumDeluge',title:'Fire Crackling',page:'https://opengameart.org/content/fire-crackling',license:'CC0-1.0',file:'fireplace.wav',url:'https://opengameart.org/sites/default/files/fire-1.wav'},
 {id:'fireloop',author:'qubodup',title:'Fire Loop',page:'https://opengameart.org/content/fire-loop',license:'CC-BY-3.0',file:'fireloop.flac',url:'https://opengameart.org/sites/default/files/qubodupFireLoop.flac'},
 {id:'zippo',author:'dawith',title:'Zippo click sound',page:'https://opengameart.org/content/zippo-click-sound',license:'CC0-1.0',file:'zippo.flac',url:'https://opengameart.org/sites/default/files/zipclick.flac'},
 {id:'impact',author:'Kenney',title:'Impact Sounds',page:'https://kenney.nl/assets/impact-sounds',license:'CC0-1.0',file:'impact.zip',pattern:'zip'},
 {id:'lighter',author:'stephan',title:'Cheap cigarette lighter',page:'https://commons.wikimedia.org/wiki/File:Cheap_cigarette_lighter.ogg',license:'Public domain',file:'lighter.ogg',url:'https://upload.wikimedia.org/wikipedia/commons/6/65/Cheap_cigarette_lighter.ogg'},
 {id:'lighter-takes',author:'plucinskicasey',title:'lighter.wav',page:'https://freesound.org/people/plucinskicasey/sounds/516987/',license:'CC0-1.0',file:'lighter-takes.mp3',pattern:'freesound'},
 {id:'forge',author:'Work With Sounds / La Fonderie',title:'Fire of the forge',page:'https://commons.wikimedia.org/wiki/File:WWS_Fireoftheforge.ogg',license:'CC-BY-4.0',file:'forge.ogg',url:'https://upload.wikimedia.org/wikipedia/commons/0/01/WWS_Fireoftheforge.ogg'},
 {id:'catching',author:'themightyglider (source: qubodup)',title:'Catching fire',page:'https://opengameart.org/content/catching-fire',license:'CC0-1.0',file:'catching.ogg',url:'https://opengameart.org/sites/default/files/flame_0.ogg'},
];
async function fetchBytes(url,max=25*1048576){
 const response=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{'User-Agent':'PrincipessaSoundAtelier/1.0 (public licensed audio audition)'}});
 if(!response.ok)throw new Error(`${response.status} ${url}`);
 if(Number(response.headers.get('content-length'))>max)throw new Error('File size limit');
 const parts=[];let length=0;
 for await(const part of response.body){length+=part.length;if(length>max)throw new Error('File size limit');parts.push(part);}
 return Buffer.concat(parts);
}
const results=[];
// A small fixed list, no crawling, account access, uploads or executable files.
for(const source of sources){
 try{
  if(!source.url){
   const html=(await fetchBytes(source.page,3*1048576)).toString('utf8');
   fs.writeFileSync(path.join(OUT,source.id+'-source.html'),html);
   const urls=[...html.matchAll(/(?:https:)?\/\/[^\s<>"']+/g)].map(m=>m[0].replaceAll('&amp;','&'));
   source.url=urls.find(u=>source.pattern==='zip'?u.startsWith('https://kenney.nl/')&&u.endsWith('.zip'):source.pattern==='wikimedia'?u.includes('upload.wikimedia.org/')&&u.endsWith('/Cheap_cigarette_lighter.ogg'):u.includes('cdn.freesound.org/previews/')&&u.endsWith('-hq.mp3'));
   if(!source.url)throw new Error('No public recording URL on the source page');
   if(source.url.startsWith('//'))source.url='https:'+source.url;
  }
  const destination=path.join(OUT,source.file);
  const bytes=fs.existsSync(destination)?fs.readFileSync(destination):await fetchBytes(source.url);
  if(bytes.subarray(0,80).toString('utf8').includes('<!DOCTYPE'))throw new Error('HTML instead of audio');
  fs.writeFileSync(destination,bytes);
  const result={...source,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),downloadedAt:new Date().toISOString()};results.push(result);
  console.log(`${source.id}: ${bytes.length} bytes`);
 }catch(error){results.push({...source,error:error.message});console.log(`${source.id}: ${error.message}`);}
 fs.writeFileSync(path.join(OUT,'sources.json'),JSON.stringify(results,null,2));
}
