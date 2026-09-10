import { chromium } from "playwright";
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const bundle = await build({
  absWorkingDir: process.cwd(),
  outdir: "tmp/gameplay-fixture",
  bundle: true,
  write: false,
  platform: "browser",
  jsx: "automatic",
  stdin: {
    resolveDir: process.cwd(),
    loader: "tsx",
    contents: `
    import {createRoot} from "react-dom/client"; import {useState} from "react";
    import {CourtHomeStage} from "./src/components/CourtHomeStage";
    import {CourtChamberIntro} from "./src/components/CourtChamberIntro";
    import {HomeCommandCenter} from "./src/components/HomeCommandCenter";
    import {TransactionHistory} from "./src/components/TransactionHistory";
    import {TributePanel} from "./src/components/TributePanel";
    import {GambleHall} from "./src/components/GambleHall";
    import {CLICK_GAME_THRESHOLDS} from "./src/lib/click-game";
    const memory={id:"fixture",path:"/principessa-ui/generated/principessa-shrine-offering.webp",title:"Her offering"};
    window.clickBatches=[]; window.drainBatches=[];
    function Shrine(){const [coins,setCoins]=useState(10000);const [click,setClick]=useState({progress:149,stage:1,isActive:true,weeklyClicks:149,lifetimeClicks:149,costPerClick:1,thresholds:CLICK_GAME_THRESHOLDS,nextThreshold:150,lastClickAt:null,serverNowIso:new Date().toISOString()});return <TributePanel affection={100} hideAffectionOffer coins={coins} onTribute={()=>{}} shrine={{revealedMemories:[memory],totalSpent:1000,availableImageCount:1,unlockedImageCount:1,level:1,topWorshippers:[],coinsUntilNextUnlock:1000}} clickGameVisible clickGame={click} clickGameStatusCategory="classic" onClickGameStart={()=>setClick(c=>({...c,isActive:true}))} onClickGameStop={()=>setClick(c=>({...c,isActive:false}))} onClickGameClick={async count=>{window.clickBatches.push(count);setCoins(c=>c-count);setClick(c=>({...c,progress:c.progress+count}));}} onDrainSessionSync={async(amount)=>{window.drainBatches.push(amount);setCoins(c=>c-amount);return true;}}/>}
    function Fixture(){const [mode,setMode]=useState("Hero");return <><nav style={{display:"flex",flexWrap:"wrap",gap:16,padding:"16px 0"}}>{["Hero","Home","History","Shrine","Gamble"].map(m=><button key={m} onClick={()=>setMode(m)}>{m} fixture</button>)}</nav>{mode==="Hero"?<CourtChamberIntro page="tasks"/>:mode==="Home"?<><CourtHomeStage affection={50} coins={10000} dailyMessage="She noticed your absence. Make this visit worth remembering." displayName="Court Reader" onNavigate={()=>{}}/><HomeCommandCenter actions={[{target:"tasks",label:"Games",action:"Choose a game",detail:"Earn your daily Coins."}]} coins={10000} devotionRank={1} petScore={100} streak={3} devotion={[]} petScoreLeaders={[]} leadership={[]} shame={[]} inventories={[]} onNavigate={()=>{}}/></>:mode==="History"?<TransactionHistory/>:mode==="Shrine"?<Shrine/>:<GambleHall/>}</>}
    createRoot(document.getElementById("app")).render(<Fixture/>);
  `,
  },
  plugins: [
    {
      name: "image",
      setup(b) {
        b.onResolve({ filter: /^next\/image$/ }, () => ({
          path: "image",
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          loader: "js",
          resolveDir: process.cwd(),
          contents:
            'import {createElement} from "react";export default function Image({fill,preload,priority,unoptimized,quality,sizes,...p}){return createElement("img",{...p,style:fill?{position:"absolute",height:"100%",width:"100%",inset:0,...p.style}:p.style})}',
        }));
      },
    },
  ],
});
const css =
  fs
    .readdirSync(".next/static/chunks")
    .filter((p) => p.endsWith(".css"))
    .map((p) => fs.readFileSync(".next/static/chunks/" + p, "utf8"))
    .join("\n") +
  bundle.outputFiles
    .filter((f) => f.path.endsWith(".css"))
    .map((f) => f.text)
    .join("\n");
const browser = await chromium.launch({
  channel: process.platform === "win32" ? "chrome" : undefined,
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-09-10T12:00:00Z") });
  let crashStart = 0,
    cashoutFailure = false,
    autoWon = false;
  let rouletteRelease;
  await page.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      p = url.pathname;
    if (p === "/api/user/transactions")
      return route.fulfill({
        json: {
          transactions: Array.from({ length: 50 }, (_, i) => ({
            id: `${url.searchParams.get("currency")}-${i}`,
            amount: i % 2 ? -10 : 20,
            balance_after: 1000,
            reason: "reward:task:daily-login",
            created_at: "2026-09-09T12:00:00Z",
          })),
        },
      });
    if (p === "/api/user/gamble") {
      const body = req.postDataJSON();
      const now = await page.evaluate(() => Date.now());
      if (body.action === "mines-open")
        return route.fulfill({ json: { roundId: "jewelry" } });
      if (body.action === "mines-pick")
        return route.fulfill({
          json: { bust: false, picks: [body.cell], multiplier: 1.13 },
        });
      if (body.action === "crash-open") {
        assert.equal(body.autoCashout, autoWon ? 1.5 : null);
        crashStart = now + 3000;
        return route.fulfill({
          json: {
            roundId: "patience",
            startsAtMs: crashStart,
            serverReceivedAtMs: now,
            serverNowMs: now,
            autoCashout: body.autoCashout,
          },
        });
      }
      if (body.action === "crash-status")
        return route.fulfill({
          json: {
            startsAtMs: crashStart,
            serverReceivedAtMs: now,
            serverNowMs: now,
            settled: autoWon,
            survived: autoWon,
            multiplier: 1.5,
            payout: autoWon ? 150 : 0,
          },
        });
      if (body.action === "crash-cashout") {
        if (cashoutFailure) {
          cashoutFailure = false;
          return route.fulfill({
            status: 503,
            json: { error: "Connection interrupted. Try again." },
          });
        }
        return route.fulfill({
          json: {
            settled: true,
            survived: true,
            multiplier: 1.12,
            payout: 112,
          },
        });
      }
      if (body.action === "roulette") {
        await new Promise((resolve) => {
          rouletteRelease = resolve;
        });
        return route.fulfill({
          json: { number: 32, win: true, payout: 168, roundId: "roulette" },
        });
      }
      return route.fulfill({ json: {} });
    }
    if (p === "/styles.css")
      return route.fulfill({ contentType: "text/css", body: css });
    const asset = path.resolve("public", "." + decodeURIComponent(p));
    if (
      asset.startsWith(path.resolve("public") + path.sep) &&
      fs.existsSync(asset) &&
      fs.statSync(asset).isFile()
    )
      return route.fulfill({ path: asset });
    if (p !== "/") return route.fulfill({ status: 404, body: "" });
    return route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><link rel="stylesheet" href="/styles.css"/></head><body class="principessa-court-ui" style="background:#09050b;color:#fff;font-family:Arial,sans-serif"><main id="app" style="max-width:1100px;margin:auto;padding:16px"></main></body></html>',
    });
  });
  await page.goto("http://court-gameplay.test/");
  await page.addScriptTag({
    content:
      bundle.outputFiles.find((f) => f.path.endsWith(".js"))?.text ??
      bundle.outputFiles[0].text,
  });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("heading", { name: "Games", exact: true }).waitFor();
    const size = await page.locator(".court-chamber-portrait").boundingBox();
    assert.ok(size.height > 200 && size.width > 150);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `tmp/gameplay-hero-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Home fixture" }).click();
  await page.locator(".court-home-portrait img").waitFor();
  assert.ok(
    await page
      .locator(".court-home-portrait img")
      .evaluate((img) => img.complete && img.naturalWidth > 0),
  );
  await page.screenshot({
    path: "tmp/gameplay-home-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "History fixture" }).click();
  await page.locator("ol li").first().waitFor();
  assert.equal(await page.locator("ol li").count(), 6);
  await page.getByRole("button", { name: "Older", exact: true }).click();
  assert.match(await page.locator("ol li").first().textContent(), /Coin-6/);
  for (let i = 0; i < 7; i++)
    await page.getByRole("button", { name: "Older", exact: true }).click();
  assert.equal(await page.locator("ol li").count(), 2);
  assert.ok(
    await page.getByRole("button", { name: "Older", exact: true }).isDisabled(),
  );
  await page.getByRole("button", { name: "PM", exact: true }).click();
  await page.getByText("PM-0", { exact: true }).waitFor({ state: "attached" });
  assert.ok(
    await page.getByRole("button", { name: "Newer", exact: true }).isDisabled(),
  );
  await page.screenshot({
    path: "tmp/gameplay-history-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Shrine fixture" }).click();
  const tap = page.getByRole("button", { name: "Click the current stage" });
  await tap.click();
  await page
    .getByText("200 more clicks to reveal stage 3", { exact: true })
    .waitFor();
  assert.equal(await page.locator(".court-click-burst").count(), 1);
  assert.equal(
    await page
      .getByRole("progressbar", { name: "Progress to next stage" })
      .getAttribute("aria-valuenow"),
    "0",
  );
  await page.clock.runFor(1000);
  assert.deepEqual(await page.evaluate(() => window.clickBatches), [1]);
  await page
    .getByRole("button", { name: "Start Draining", exact: true })
    .click();
  await page.clock.runFor(2100);
  assert.match(await page.locator(".shrine-drain-total").innerText(), /200/);
  assert.ok(await page.locator("[data-drain-popup]").count() >= 5, "Several larger memories appear within two seconds");
  await page.getByRole("button", { name: "Stop", exact: true }).first().click();
  assert.equal(await page.locator("[data-drain-popup]").count(), 0, "Stop removes every popup");
  assert.deepEqual(await page.evaluate(() => window.drainBatches), [200]);
  assert.equal(
    await page.locator('.shrine-drain-scene[data-active="true"]').count(),
    0,
  );
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("button", { name: "Start Draining", exact: true }).click();
    await page.clock.runFor(6200);
    const popups = await page.locator("[data-drain-popup]").evaluateAll(els => els.map(el=>({width:el.clientWidth,position:getComputedStyle(el).position,imageHeight:el.querySelector("img").clientHeight,animation:getComputedStyle(el.querySelector("img")).animationName})));
    assert.ok(popups.length>=10 && popups.length<=12, "Dense popup stream stays bounded after expiry");
    for (const popup of popups) {
      assert.ok(popup.width >= Math.min(width * 0.59, 350), "Larger responsive popup width");
      assert.equal(popup.position, "absolute");
      assert.ok(popup.imageHeight > 0, "Popup image has a visible height");
      assert.equal(popup.animation, "drainImagePop", "The original popup animation runs");
    }
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `tmp/gameplay-shrine-${width}.png`,
    });
    await page.getByRole("button", { name: "Stop", exact: true }).first().click();
    assert.equal(await page.locator("[data-drain-popup]").count(), 0);
    await page.clock.runFor(1000);
    assert.equal(await page.locator("[data-drain-popup]").count(), 0, "No popup timers survive Stop");
  }
  await page.getByRole("button", { name: "Gamble fixture" }).click();
  await page
    .getByRole("button")
    .filter({ has: page.getByText("The Jewelry Box", { exact: true }) })
    .first()
    .click();
  const jewelry = page.locator("#table-mines");
  await jewelry.getByRole("button", { name: /^Buy in/ }).click();
  await jewelry
    .getByRole("button", { name: "Open jewelry box 1", exact: true })
    .click();
  await jewelry.locator('.court-jewelry-cell[data-revealed="true"]').waitFor();
  const originalTake = await jewelry
    .getByRole("button", { name: /^Take / })
    .innerText();
  await jewelry.getByRole("button", { name: /5[.,]000/, exact: true }).click();
  assert.equal(
    await jewelry.getByRole("button", { name: /^Take / }).innerText(),
    originalTake,
    "Changing the next stake cannot change this round's return",
  );
  await jewelry.getByRole("button", { name: "100", exact: true }).click();
  await page
    .getByRole("button")
    .filter({ has: page.getByText("Court Roulette", { exact: true }) })
    .first()
    .click();
  const roulette = page.locator("#table-roulette");
  for (const color of ["Red", "Black", "Green"]) assert.ok(await roulette.getByRole("button", {name:new RegExp(`^${color}`)}).isVisible());
  for (const removed of ["Odd", "Even", "1–18", "19–36"]) assert.equal(await roulette.getByRole("button", {name:new RegExp(`^${removed}`)}).count(),0);
  await roulette.getByRole("button", { name: /^Spin/ }).click();
  await roulette.getByRole("button", { name: "Taking your bet…" }).waitFor();
  assert.equal(
    await roulette
      .locator(".court-roulette-ball-orbit")
      .getAttribute("data-spinning"),
    "false",
  );
  rouletteRelease();
  await roulette.locator('[data-spinning="true"]').waitFor();
  assert.ok(
    await roulette
      .locator('[style*="conic-gradient"]')
      .evaluate((el) => el.style.transform !== "rotate(0deg)"),
  );
  await page.clock.runFor(3600);
  await roulette.getByRole("button", {name:/^Double/}).click();
  await roulette.getByText("Gone. She laughs at you", {exact:true}).waitFor();
  assert.equal(
    await roulette
      .locator(".court-roulette-ball-orbit")
      .getAttribute("data-spinning"),
    "false",
  );
  await page
    .getByRole("button")
    .filter({ has: page.getByText("Her Patience", { exact: true }) })
    .first()
    .click();
  const patience = page.locator("#table-crash");
  const automatic = patience.getByRole("checkbox", { name: "Take automatically", exact: true });
  assert.equal(await automatic.isChecked(), false, "Manual play is the default");
  await automatic.check();
  assert.ok(await patience.getByRole("spinbutton", { name: "Automatic cashout multiplier" }).isVisible());
  await automatic.uncheck();
  assert.equal(await patience.getByRole("spinbutton", { name: "Automatic cashout multiplier" }).count(), 0);
  await patience.getByRole("button", { name: /^Test her/ }).click();
  await patience.getByRole("button", { name: /^Beginning/ }).waitFor();
  assert.ok(
    await patience.getByRole("button", { name: /^Beginning/ }).isDisabled(),
  );
  await page.clock.runFor(4200);
  const cashButton = patience.getByRole("button", { name: /^Cash out at/ });
  await cashButton.waitFor();
  cashoutFailure = true;
  await cashButton.click();
  await patience.getByText("Connection interrupted. Try again.").waitFor();
  assert.ok(await cashButton.isEnabled());
  await cashButton.click();
  await patience
    .getByText("1.12x — 112 Coins returned.", { exact: true })
    .waitFor();
  await automatic.check();
  autoWon = true;
  await patience.getByRole("button", { name: /^Test her/ }).click();
  await page.clock.runFor(3100);
  autoWon = true;
  await page.clock.runFor(1600);
  await patience
    .getByText("1.50x — 150 Coins returned.", { exact: true })
    .waitFor();
  await patience.screenshot({ path: "tmp/gameplay-patience.png" });
  assert.deepEqual(errors, []);
  console.log(
    "Gameplay browser passed: desktop/mobile heroes, history pagination, Shrine stages and batched clicks, drain stop, synchronized Roulette, Patience countdown/manual retry/automatic result. All HTTP mocked.",
  );
} finally {
  await browser.close();
}
