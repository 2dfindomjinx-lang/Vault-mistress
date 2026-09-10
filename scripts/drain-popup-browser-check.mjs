// Real Next Image and TributePanel; local assets and isolated HTTP only.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";

const bundle = await build({
  stdin: {
    resolveDir: process.cwd(), loader: "tsx",
    contents: `
      import {createRoot} from "react-dom/client";
      import {TributePanel} from "./src/components/TributePanel";
      const memory={path:"/shrine/shrine_1.webp",title:"Unlocked memory"};
      window.batches=[];
      createRoot(document.getElementById("app")).render(<TributePanel
        affection={100} coins={10000} hideAffectionOffer onTribute={()=>{}}
        shrine={{revealedMemories:[memory],level:1,totalSpent:10000,unlockedImageCount:1,availableImageCount:1,coinsUntilNextUnlock:10000,topWorshippers:[]}}
        onDrainSessionSync={async amount=>{window.batches.push(amount);return true;}}
      />);
    `,
  },
  bundle: true, write: false, platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
});
const css = fs.readdirSync(".next/static/chunks").filter(name=>name.endsWith(".css"))
  .map(name=>fs.readFileSync(`.next/static/chunks/${name}`,"utf8")).join("\n");
const browser = await chromium.launch({channel:process.platform==="win32"?"chrome":undefined,headless:true});
try {
  for (const width of [390,1440]) {
    const page = await browser.newPage({viewport:{width,height:1000}});
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.clock.install({time:new Date("2026-09-10T12:00:00Z")});
    await page.route("**/*",async route=>{
      const url=new URL(route.request().url());
      if(url.pathname==="/styles.css") return route.fulfill({contentType:"text/css",body:css});
      const assetPath=url.pathname==="/_next/image"?url.searchParams.get("url"):url.pathname;
      const publicRoot=path.resolve("public"), asset=path.resolve(publicRoot,"."+assetPath);
      if(asset.startsWith(publicRoot+path.sep)&&fs.existsSync(asset)&&fs.statSync(asset).isFile())
        return route.fulfill({path:asset});
      if(url.pathname!=="/") return route.fulfill({status:404,body:""});
      return route.fulfill({contentType:"text/html",body:'<!doctype html><html><head><link rel="stylesheet" href="/styles.css"></head><body class="principessa-court-ui"><main id="app"></main></body></html>'});
    });
    await page.goto("http://drain-fixture.invalid/");
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.getByRole("button",{name:"Start Draining",exact:true}).click();
    await page.clock.runFor(2600);
    // CSS animations advance on the browser timeline, independently of the
    // mocked interval clock. Wait for painted images, not just inserted nodes.
    await page.waitForFunction(()=>Array.from(document.querySelectorAll("[data-drain-popup] img")).filter(img=>img.complete&&img.naturalWidth>0&&Number(getComputedStyle(img).opacity)>0.1).length>=3);
    const visible=await page.locator("[data-drain-popup] img").evaluateAll(images=>images.filter(img=>{
      const rect=img.getBoundingClientRect(),style=getComputedStyle(img);
      return img.naturalWidth>0&&Number(style.opacity)>0.1&&style.visibility==="visible"&&rect.width>150&&rect.height>100&&rect.right>0&&rect.left<innerWidth&&rect.bottom>0&&rect.top<innerHeight;
    }).length);
    assert.ok(visible>=3,`Actual loaded, animated images must be visible at ${width}px; got ${visible}`);
    await page.screenshot({path:`tmp/drain-popup-visible-${width}.png`});
    const drained=Number((await page.locator(".shrine-drain-total").innerText()).replace(/\D/g,""));
    await page.getByRole("button",{name:"Stop",exact:true}).click();
    assert.equal(await page.locator("[data-drain-popup]").count(),0);
    assert.ok(drained>=200);
    assert.deepEqual(await page.evaluate(()=>window.batches),[drained]);
    assert.deepEqual(errors,[]);
    await page.close();
  }
  console.log("Drain popups passed: real Next Image, loaded visible images on mobile/desktop, original animation, Stop and drain amount. Local HTTP only.");
} finally { await browser.close(); }
