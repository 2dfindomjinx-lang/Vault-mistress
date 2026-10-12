const {chromium}=require('playwright');
const fs=require('node:fs');
const {build}=require('esbuild');
const base=process.env.THEME_TEST_URL||'http://127.0.0.1:3108';
const out='../vault-mistress-layout-check';
const widths=[320,390,768,1024,1280,1600];

async function inspect(page){return page.evaluate(()=>{
  const issues=[];
  for(const el of document.querySelectorAll('main *, .principessa-court-ui *, dialog *')){
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    if(!r.width||!r.height||s.visibility==='hidden'||s.display==='none'||el.closest('[aria-hidden=true]')||el.tagName==='SVG'||el.closest('svg'))continue;
    const clipped=(()=>{for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){if(/hidden|clip|auto|scroll/.test(getComputedStyle(p).overflowX))return true;}return false;})();
    if((r.right>innerWidth+2||r.left< -2)&&!clipped)issues.push({kind:'outside',tag:el.tagName,cls:String(el.className).slice(0,130),text:el.textContent?.trim().slice(0,55),left:Math.round(r.left),right:Math.round(r.right)});
    if(/^(BUTTON|H[1-4]|LABEL)$/.test(el.tagName)&&el.scrollWidth>el.clientWidth+3&&!/auto|scroll/.test(s.overflowX)&&s.textOverflow!=='ellipsis')issues.push({kind:'text-clipped',tag:el.tagName,cls:String(el.className).slice(0,100),text:el.textContent?.trim().slice(0,60),excess:el.scrollWidth-el.clientWidth});
  }
  return{width:innerWidth,document:document.documentElement.scrollWidth,issues:issues.slice(0,35)};
});}

(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1600,height:1000},colorScheme:'light'});const page=await context.newPage();const errors=[],rows=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/api/**',r=>r.fulfill({json:{user:null,session:null,items:[],events:[],entries:[],posts:[],messages:[],notifications:[],leaders:[],tributes:[],openers:[],duels:[],myLiveDuel:null,hallOfFame:[],currentUserBadges:[],communityGoal:null,goalFloorUsd:0,goalUsd:500,raisedUsd:0}}));
 await context.route('**/*.supabase.co/**',r=>r.fulfill({json:{user:null,session:null}}));
 try{
 await page.goto(base,{timeout:60000});await page.getByRole('button',{name:'Explore the court',exact:true}).click();await page.locator('.bb-welcome').waitFor();
 const performance=await page.evaluate(async()=>{const gaps=[],long=[];const o=new PerformanceObserver(l=>long.push(...l.getEntries().map(e=>Math.round(e.duration))));o.observe({type:'longtask',buffered:false});let last=performance.now(),start=last;await new Promise(resolve=>{function tick(now){gaps.push(now-last);last=now;if(now-start<4000)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});o.disconnect();gaps.sort((a,b)=>a-b);return{frames:gaps.length,p95FrameMs:Math.round(gaps[Math.floor(gaps.length*.95)]),longTasks:long,heroResource:document.querySelector('.bb-welcome-art img')?.currentSrc};});console.log('Hero sample',performance);
 await page.evaluate(()=>window.scrollTo(0,1300));await page.waitForTimeout(150);if(await page.locator('.bb-welcome').getAttribute('data-motion')!=='paused')throw Error('Offscreen animation did not pause');await page.evaluate(()=>window.scrollTo(0,0));
 if(!process.env.LAYOUT_DIALOG_ONLY) for(const [key,label]of [['home','Home'],['tasks','Games'],['crates','Cases'],['wheels','Gamble & Wheels'],['shop','Shop'],['moneyShop','Money Shop'],['debt','Debt Contracts'],['tribute','Shrine of Principessa'],['runway','Runway'],['profile','Profile'],['collection','Gallery']]){
   await page.setViewportSize({width:1600,height:1000});await page.getByRole('navigation',{name:'Court navigation',exact:true}).waitFor();
   await page.getByRole('navigation',{name:'Court navigation',exact:true}).getByRole('button').filter({has:page.getByText(label,{exact:true})}).click();
   await page.waitForFunction(k=>document.querySelector('.principessa-court-ui')?.dataset.page===k,key);await page.waitForTimeout(500);
   for(const width of widths){await page.setViewportSize({width,height:width<500?844:900});await page.waitForFunction(k=>document.querySelector('.principessa-court-ui')?.dataset.page===k,key);await page.waitForTimeout(220);const row={page:key,...await inspect(page)};rows.push(row);if(row.issues.length||row.document>width)console.log(key,width,JSON.stringify(row.issues));if([390,1024].includes(width))await page.screenshot({path:out+'/'+key+'-'+width+'.png'});}
   fs.writeFileSync(out+'/report.json',JSON.stringify({errors,performance,rows},null,2));
 }
 await page.setViewportSize({width:1600,height:900});await page.getByRole('navigation',{name:'Court navigation',exact:true}).getByRole('button').filter({has:page.getByText('Home',{exact:true})}).click();
 await page.setViewportSize({width:320,height:667});await page.locator('.bb-MobileCourt-header').waitFor();await page.waitForTimeout(250);
 await page.evaluate(()=>{const a=document.querySelector('.bb-MobileCourt-header')?.lastElementChild;if(a){const b=document.createElement('button');b.textContent='♧';b.style.cssText='width:40px;height:40px;flex-shrink:0';b.setAttribute('aria-label','Fixture notifications');a.prepend(b);}});
 rows.push({page:'mobile-with-notifications',...await inspect(page)});await page.screenshot({path:out+'/mobile-notifications.png'});
 // Isolate the actual game component to inspect its dialog without changing
 // production guest restrictions or starting a server-side paid/reward session.
 const bundle=await build({absWorkingDir:process.cwd(),stdin:{contents:'import {createRoot} from "react-dom/client";import {CourtGames} from "./src/components/CourtGames";createRoot(document.getElementById("fixture")).render(<CourtGames coins={0} guestMode onReward={()=>{}}/>);',resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outfile:'fixture.js',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'fixture-image',setup(b){b.onResolve({filter:/^next\/image$/},()=>({path:'image',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export default function Image({src,alt,fill,className,style}){return <img src={typeof src==="string"?src:src.src} alt={alt||""} className={className} style={fill?{...style,position:"absolute",inset:0,width:"100%",height:"100%"}:style}/>}',loader:'jsx',resolveDir:process.cwd()}));}}]});
 const sheets=await page.locator('link[rel=stylesheet]').evaluateAll(links=>links.map(l=>l.outerHTML).join(''));
 await page.setContent('<html><head>'+sheets+'</head><body class="court-theme bubblegum-theme"><main id="fixture"></main></body></html>');
 for(const file of bundle.outputFiles){if(file.path.endsWith('.css'))await page.addStyleTag({content:file.text});else await page.addScriptTag({content:file.text});}
 for(const width of widths){
   await page.setViewportSize({width,height:width<500?667:768});await page.locator('[data-testid="court-play-crown-match"]').click();await page.getByRole('dialog').waitFor();
   rows.push({page:'game-dialog-fixture',...await inspect(page)});await page.screenshot({path:out+'/dialog-'+width+'.png'});await page.getByRole('button',{name:'Close game',exact:true}).click();
 }
 fs.writeFileSync(out+(process.env.LAYOUT_DIALOG_ONLY?'/dialogs-report.json':'/report.json'),JSON.stringify({errors,performance,rows},null,2));console.log('Complete',rows.length,'layouts; page errors',errors);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
