// Real UI components with local fixtures. No account, payment or economy mutations.
const { chromium } = require('playwright');
const { build } = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.THEME_TEST_URL || 'http://127.0.0.1:3108';
const out = path.resolve('../vault-mistress-presentation-check');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const bundle = await build({
    absWorkingDir: process.cwd(), bundle: true, write: false, outfile: 'fixture.js', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
      import {createRoot} from 'react-dom/client'; import {useState} from 'react';
      import {StrengthenPrincipessa} from './src/components/StrengthenPrincipessa';
      import {TributeGoalBar} from './src/components/TributeGoalBar';
      import {CrateDuelBattle} from './src/components/CrateDuelBattle';
      import {DebtSection} from './src/components/DebtSection';
      import {MobileCourtContext} from './src/lib/mobile-court-context';
      import {RARITY_ORDER,getRarityColor} from './src/lib/crates';
      function App(){
        const [view,show]=useState('rarity');const [level,setLevel]=useState(3);const [xp,setXp]=useState(1200);
        const [mobile,setMobile]=useState(false);window.fixture={show,setMobile,rebuild:()=>{setLevel(2);setXp(400);}};
        if(view==='strength')return <StrengthenPrincipessa level={2} xp={300} requiredXp={1000} progress={30} userLevel={level} userXp={xp} onGive={async()=>{setLevel(1);setXp(0);return {drainedUserXp:1200,transferredXp:300};}}/>;
        if(view==='bar')return <TributeGoalBar floorUsd={3500} goalUsd={4000} raisedUsd={3825}/>;
        if(view==='duel'){const items=RARITY_ORDER.map((rarity,i)=>({itemId:'fixture-'+i,name:rarity+' reward',rarity,sellValue:(i+1)*100,variant:'normal',imageUrl:'/bubblegum/principessa-icon.webp'}));return <CrateDuelBattle onClose={()=>show('rarity')} duel={{id:'fixture',challenger:'Alice',opponent:'Bea',challengerItems:items,opponentItems:[...items].reverse(),quantity:6,crateType:'principessa_case',crateName:'Principessa Case',isMine:true,isMyChallenge:true,winner:'Alice',wonByMe:true,challengerTotal:2100,opponentTotal:2100}}/>;}
        if(view.startsWith('debt'))return <MobileCourtContext.Provider value={mobile}><DebtSection key={view} previewMode={view==='debt-draft'} isDebtAutoPayEnabled={false} onDebtAutoPayChange={()=>{}} onPayDebtPeriod={()=>{}} onSignDebtContract={()=>false} petDebtContract={view==='debt-active'?{id:'fixture-coin',contract_type:'normal',status:'active',debt_amount:10000,duration_periods:8,paid_periods:2,missed_periods:0,period_type:'weekly',pet_name:'Debt Piglet',created_at:'2026-10-01',started_at:'2026-10-01',ends_at:'2026-12-01',next_due_at:'2026-10-18'}:null} tasks={[{kind:'debt-contract',id:'debt'}]}/></MobileCourtContext.Provider>;
        return <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:12}}>{RARITY_ORDER.map(r=><div key={r} data-rarity-sample={r} className={getRarityColor(r)} style={{padding:20,borderWidth:2,borderStyle:'solid',borderRadius:12}}><strong className="vm-rarity-text">{r}</strong></div>)}</div>;
      }
      createRoot(document.getElementById('fixture')).render(<App/>);
    ` },
    plugins: [{ name: 'fixture-adapters', setup(b) {
      b.onResolve({ filter: /^next\/image$/ }, () => ({ path: 'image', namespace: 'fixture' }));
      b.onResolve({ filter: /^@\/lib\/sound$/ }, () => ({ path: 'sound', namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ loader: 'jsx', resolveDir: process.cwd(), contents: a.path === 'sound' ? 'export function emitSoundEvent(){}' : 'export default function Image({src,alt,fill,className,style,width,height}){return <img src={typeof src==="string"?src:src.src} alt={alt||""} width={width} height={height} className={className} style={fill?{...style,position:"absolute",inset:0,width:"100%",height:"100%"}:style}/>;}' }));
    } }],
  });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, locale: 'en-US' });
  const errors = [];page.on('pageerror', e => errors.push(e.message));
  try {
    const html = await (await page.request.get(base)).text();
    const sheets = (html.match(/<link[^>]+>/g) || []).filter(s => s.includes('rel="stylesheet"')).join('');
    await page.route('**/api/**', r => r.fulfill({ json: { money: 500, contracts: [{ id: 'fixture-throne', debt_code: 'TD-FIXTURE', status: 'active', total_amount_usd: 200, installment_count: 4, contract_length_weeks: 4, repayment_frequency: 'weekly', approved_at: '2026-10-01', installments: Array.from({ length: 4 }, (_, i) => ({ id: 'p' + i, installment_number: i + 1, amount_usd: 50, status: i ? 'pending' : 'approved_paid', due_date: '2026-10-' + (8 + i * 7), pm_paid_usd: i ? 0 : 50 })) }] } }));
    await page.route('**/__presentation-check', r => r.fulfill({ contentType: 'text/html', body: '<html><head>'+sheets+'<style>body{margin:0;--font-geist-sans:Arial;--font-geist-mono:Consolas}#fixture{max-width:1160px;margin:24px auto;padding:12px}*{box-sizing:border-box}</style></head><body class="court-theme bubblegum-theme"><main id="fixture"></main></body></html>' }));
    await page.goto(base + '/__presentation-check');
    for (const file of bundle.outputFiles) {
      if (file.path.endsWith('.css')) await page.addStyleTag({ content: file.text });
      else await page.addScriptTag({ content: file.text });
    }
    const show = async name => { await page.evaluate(n => window.fixture.show(n), name); await page.waitForTimeout(100); };
    const noOverflow = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
    const colors = [];
    for (const mode of ['light','dark']) {
      await page.evaluate(m => document.documentElement.dataset.colorMode=m,mode);
      const result = await page.locator('[data-rarity-sample]').evaluateAll(nodes => nodes.map(n => ({ rarity:n.dataset.raritySample,border:getComputedStyle(n).borderColor,background:getComputedStyle(n).backgroundColor,text:getComputedStyle(n.querySelector('strong')).color })));
      assert.equal(new Set(result.map(r=>r.border)).size,6,'Six distinct rarity borders');colors.push({mode,result});
      await page.screenshot({path:path.join(out,'rarity-'+mode+'.png')});
    }
    await show('bar');await page.getByRole('progressbar').waitFor();
    assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'3825');
    assert((await page.getByRole('progressbar').locator('span').evaluate(n=>getComputedStyle(n).backgroundImage)).includes('244, 114, 182'),'Bright fill retained in dark mode');
    await page.screenshot({path:path.join(out,'tribute-dark.png')});
    await show('strength');await page.getByRole('button',{name:'Give her all your XP'}).click();
    await page.getByText('You gave',{exact:true}).waitFor();await page.getByText('She received',{exact:true}).waitFor();
    assert.equal(await page.locator('footer strong').allTextContents().then(x=>x.join('|')),'1,200 XP|+300 XP');
    await page.screenshot({path:path.join(out,'strength-receipt.png')});
    await page.evaluate(()=>window.fixture.rebuild());await page.getByText('You give',{exact:true}).waitFor();
    assert.equal(await page.locator('footer strong').allTextContents().then(x=>x.join('|')),'400 XP|+100 XP');
    await show('duel');await page.getByRole('dialog',{name:'Crate duel'}).waitFor();
    await page.getByRole('button',{name:/Skip/}).click();await page.getByRole('button',{name:'Done',exact:true}).waitFor();
    for(const mode of ['light','dark']){await page.evaluate(m=>document.documentElement.dataset.colorMode=m,mode);await page.screenshot({path:path.join(out,'duel-'+mode+'.png')});}
    await page.getByRole('button',{name:'Close',exact:true}).click();
    for (const view of ['debt-draft','debt-active']) {
      await show(view);await page.locator('#coin-agreement').waitFor();
      if(view==='debt-active')await page.getByText('TD-FIXTURE',{exact:true}).first().waitFor();
      for (const width of [1600,390]) {
        await page.setViewportSize({width,height:1000});await page.evaluate(m=>window.fixture.setMobile(m),width<600);await page.waitForTimeout(100);
        for(const mode of ['light','dark']){await page.evaluate(m=>document.documentElement.dataset.colorMode=m,mode);await noOverflow();await page.screenshot({path:path.join(out,view+'-'+width+'-'+mode+'.png'),fullPage:true});}
      }
      await page.setViewportSize({width:1600,height:1000});await page.evaluate(()=>window.fixture.setMobile(false));
      await page.waitForFunction(()=>!document.querySelector('[aria-label="Debt agreements"]').hasAttribute('data-mobile-contracts'));
      const nav=page.getByRole('navigation',{name:'Filter agreements'});
      await nav.getByRole('button',{name:/Throne Debt/}).click();await page.locator('#throne-agreement').waitFor();
      assert.equal(await page.locator('[data-contract]:visible').count(),1);
      await page.screenshot({path:path.join(out,view+'-filtered.png'),fullPage:true});
      if(view==='debt-active'){
        const pay=page.locator('.throne-agreement__payment'),schedule=page.locator('.throne-agreement__schedule');
        assert(await pay.evaluate((n)=>Boolean(n.compareDocumentPosition(document.querySelector('.throne-agreement__schedule'))&Node.DOCUMENT_POSITION_FOLLOWING)));
        assert.equal(await page.getByText('Agreement terms & payment rules',{exact:true}).locator('..').getAttribute('open'),null);
        await schedule.waitFor();
      }
      await nav.getByRole('button',{name:/Throne Debt/}).click();
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,colors,errors,boundary:'Local component fixtures; no live account or payment operations'},null,2));
    console.log('Passed: rarity colors, dark tribute bar, XP receipt and next offering, duel reveal, debt layouts and filters.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
