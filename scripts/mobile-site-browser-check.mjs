import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
const origin = process.env.MOBILE_SITE_TEST_ORIGIN ?? 'http://localhost:3011';
const artifacts = join(tmpdir(), 'vault-mobile-site-check');
await mkdir(artifacts, { recursive:true });
const browser = await chromium.launch({ channel:'msedge',headless:true });
try {
  for (const [width,height,touch] of [[390,844,true],[768,1024,true],[1024,768,true],[1366,1024,true],[1440,900,false]]) {
    const context = await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
    const page = await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    const mobile=touch;
    const explore = page.getByRole('button',{name:mobile?'Take a look inside':'Explore the court',exact:true});
    await explore.waitFor({timeout:90000});
    assert.equal(await page.getByText('MOBILE PREVIEW',{exact:true}).count(),0);
    await explore.click();
    if (mobile) {
      const dock=page.getByRole('navigation',{name:'App navigation'});
      await dock.waitFor({timeout:90000});
      await page.getByRole('button',{name:'Daily rewards'}).waitFor();
      await page.screenshot({path:`${artifacts}/site-home-${width}.png`});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No overflow at ${width}`);
      await dock.getByRole('button',{name:'Games',exact:true}).click();
      await page.waitForURL('**/games');
      await page.getByRole('tab',{name:'Daily',exact:true}).waitFor();
      await page.locator('details[data-mobile-task]').first().waitFor();
      await page.getByRole('button',{name:'All sections',exact:true}).click();
      const directory=page.getByRole('dialog',{name:'Mobile court directory'});
      await directory.waitFor();
      await directory.getByRole('button',{name:'Contracts'}).click();
      await page.waitForURL('**/debt');
      const agreements=page.getByRole('region',{name:'Debt agreements'});
      await agreements.waitFor();
      assert.equal(await agreements.locator('[id$="-contract-panel"]:visible').count(),1);
      await agreements.getByRole('button',{name:'Evil Debt'}).click();
      await agreements.locator('#evil-contract-panel').waitFor();
      assert.equal(await agreements.locator('[id$="-contract-panel"]:visible').count(),1);
      await page.goBack();
      await page.waitForURL('**/games');
      await dock.getByRole('button',{name:'Cases',exact:true}).click();
      await page.waitForURL('**/cases');
      const item=page.locator('details[data-inventory-item]').first();
      await item.waitFor();
      assert.equal(await page.getByRole('button',{name:'Preview Upgrade'}).count(),0);
      await item.locator('summary').click();
      await item.getByRole('button',{name:'Upgrade',exact:true}).click();
      const upgrader=page.getByRole('dialog',{name:'Upgrade an item'});
      await upgrader.waitFor();
      assert.ok(await upgrader.getByRole('button',{name:/⇪ Upgrade/}).isDisabled());
      await upgrader.getByRole('button',{name:'Back',exact:true}).click();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Inventory no overflow ${width}`);
      const columns=await page.locator('.inventory-section .court-grid--collection').evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length);
      assert.equal(columns,width>=700?3:2);
      await page.locator('.inventory-section').scrollIntoViewIfNeeded();
      await page.screenshot({path:`${artifacts}/site-inventory-${width}.png`});
    } else {
      await page.getByRole('heading',{name:'Choose your obsession.',exact:true}).waitFor({timeout:90000});
      assert.equal(await page.getByRole('navigation',{name:'App navigation'}).count(),0);
      await page.screenshot({path:`${artifacts}/site-desktop-${width}.png`});
    }
    assert.deepEqual(errors,[]);
    await context.close();
  }
  console.log('Mobile website passed: phones/tablets/landscape touch tablet/desktop, normal URLs and Back, single contract, expandable inventory, preserved transaction lock, no experimental demo or client exceptions.');
} finally {await browser.close();}


