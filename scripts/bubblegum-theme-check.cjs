const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.THEME_TEST_URL || 'http://127.0.0.1:3108';
const out = process.env.THEME_TEST_OUTPUT || '../vault-mistress-theme-check';

(async () => {
  fs.mkdirSync(out, {recursive:true});
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const context = await browser.newContext({viewport:{width:1600,height:1050},colorScheme:'light'});
  const errors=[];
  // Fixtures exist in this test only. Never contact real payment/account APIs.
  await context.route('**/api/**', route => route.fulfill({json:{user:null,session:null,items:[],events:[],entries:[],posts:[],messages:[],notifications:[],leaders:[],tributes:[],openers:[],duels:[],myLiveDuel:null,hallOfFame:[],currentUserBadges:[],communityGoal:null,goalFloorUsd:0,goalUsd:500,raisedUsd:0}}));
  await context.route('**/*.supabase.co/**', route => route.fulfill({json:{user:null,session:null}}));
  const page=await context.newPage();
  page.on('pageerror', e=>errors.push(e.message));
  const mode=()=>page.evaluate(()=>document.documentElement.dataset.colorMode);
  const noOverflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
  try {
    await page.goto(base,{timeout:90000});
    await page.getByRole('button',{name:'Explore the court',exact:true}).waitFor({timeout:60000});
    assert.equal(await mode(),'light');
    await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
    assert.equal(await mode(),'dark');
    await page.reload();
    await page.getByRole('button',{name:'Switch to light mode',exact:true}).waitFor();
    assert.equal(await mode(),'dark');
    await page.getByRole('button',{name:'Explore the court',exact:true}).click();
    await page.locator('.bb-welcome').waitFor({timeout:45000});
    await page.waitForTimeout(1000);
    await noOverflow();
    const portrait=page.locator('.bb-character-layer');
    assert.equal(await portrait.evaluate(el=>getComputedStyle(el).animationName),'bb-character-breathe');
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await portrait.evaluate(el=>getComputedStyle(el).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
    await page.screenshot({path:out+'/desktop-dark.png'});
    await page.getByRole('button',{name:'Switch to light mode',exact:true}).click();
    assert.equal(await mode(),'light');
    await page.screenshot({path:out+'/desktop-light.png'});
    // Preferences synchronize across tabs and override the operating system.
    const second=await context.newPage();await second.goto(base);await second.getByRole('button',{name:'Switch to dark mode',exact:true}).waitFor();
    await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
    await second.getByRole('button',{name:'Switch to light mode',exact:true}).waitFor();
    await page.emulateMedia({colorScheme:'light'});assert.equal(await mode(),'dark');await second.close();
    for(const [label,key]of [['Games','tasks'],['Cases','crates'],['Debt Contracts','debt'],['Shop','shop']]) {
      await page.getByRole('navigation',{name:'Court navigation',exact:true}).getByRole('button').filter({has:page.getByText(label,{exact:true})}).click();
      await page.waitForFunction(k=>document.querySelector('.principessa-court-ui')?.dataset.page===k,key,{timeout:45000});
      await page.waitForTimeout(1600);await noOverflow();await page.screenshot({path:out+'/'+key+'-dark.png'});
    }
    for(const [name,width,height]of [['tablet',820,1180],['mobile',390,844]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(1500);
      const toggle=page.getByRole('button',{name:'Switch to light mode',exact:true});await toggle.waitFor();assert.equal(await toggle.count(),1);
      await noOverflow();await page.screenshot({path:out+'/'+name+'-dark.png'});
      await toggle.click();assert.equal(await mode(),'light');await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
    }
    // With no saved choice, the system preference applies before hydration.
    await page.evaluate(()=>localStorage.removeItem('vault-color-mode'));
    await page.emulateMedia({colorScheme:'dark'});await page.reload();assert.equal(await mode(),'dark');
    await page.getByRole('button',{name:'Switch to light mode',exact:true}).waitFor();
    await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.colorMode==='light');
    assert.deepEqual(errors,[]);
    fs.writeFileSync(out+'/result.json',JSON.stringify({passed:true,errors,checks:['light/dark toggle','reload persistence','cross-tab sync','OS default and preference override','desktop route layout','tablet/mobile toggle and overflow','hero breathing and reduced motion'],boundary:'Browser fixtures only; no real account or payment calls'},null,2));
    console.log('Theme checks passed: persistence, OS preference, cross-tab sync, desktop/tablet/mobile. No page errors.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
