import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";

// Uses the actual production route and its dynamically loaded CSS/JS.
// API responses are empty fixtures; no live account or database is needed.
const base = process.env.CONTRACT_TEST_URL ?? "http://127.0.0.1:3210";
const ready = await fetch(base + "/debt");
assert.equal(ready.status, 200);
fs.mkdirSync("tmp", {recursive:true});
const browser = await chromium.launch({channel:process.platform === "win32" ? "chrome" : undefined, headless:true});
try {
  const page = await browser.newPage({locale:"en-US",viewport:{width:1440,height:1000},reducedMotion:"reduce"});
  const errors=[], stylesheets=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("response",response=>{
    if(response.request().resourceType()==="stylesheet") stylesheets.push({url:response.url(),status:response.status(),type:response.headers()["content-type"]});
  });
  await page.route("**/api/**",route=>route.fulfill({json:{tributes:[],openings:[],items:[],data:[],contracts:[]}}));
  await page.route("https://**",route=>route.abort());
  await page.goto(base+"/debt");
  await page.getByRole("button",{name:"Continue in Preview Mode",exact:true}).click();
  await page.getByRole("button",{name:/Debt/}).click();
  const agreements=page.getByRole("region",{name:"Debt agreements"});
  await agreements.waitFor();
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    for(const kind of ["coin","evil","throne"]) {
      const card=page.locator('[data-contract="'+kind+'"]');
      await card.scrollIntoViewIfNeeded();
      const actual=await card.evaluate(node=>({
        background:getComputedStyle(node).backgroundColor,
        padding:getComputedStyle(node.lastElementChild).paddingTop,
        titleSize:parseFloat(getComputedStyle(node.querySelector("h3")).fontSize),
        fields:[...node.querySelectorAll("input:not([type=checkbox]):not([type=file]),select,textarea")].map(input=>({width:input.getBoundingClientRect().width,height:input.getBoundingClientRect().height})),
      }));
      assert.notEqual(actual.background,"rgba(0, 0, 0, 0)",kind+" must load its document surface");
      assert.ok(parseFloat(actual.padding)>=20,kind+" must load body spacing");
      assert.ok(actual.titleSize>=32,kind+" must load contract typography");
      assert.ok(actual.fields.every(field=>field.width>100&&field.height>=40),kind+" fields must be styled");
      await card.screenshot({path:"tmp/contract-"+kind+"-"+width+".png"});
    }
    assert.ok(await agreements.evaluate(node=>node.scrollWidth<=node.clientWidth+1),"Agreement layout must not overflow");
  }
  assert.ok(stylesheets.length>0);
  assert.ok(stylesheets.every(sheet=>sheet.status===200&&sheet.type?.includes("text/css")),JSON.stringify(stylesheets));
  assert.deepEqual(errors,[]);
  fs.writeFileSync("tmp/contract-css-evidence.json",JSON.stringify(stylesheets,null,2));
  console.log("Real Next route passed: preview navigation, three styled contracts at 1440/390, field sizes, typography, no layout overflow, all requested CSS served as 200 text/css. APIs mocked; application HTML/JS/CSS unmodified.");
} finally {await browser.close();}

