import { chromium } from "playwright";
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
fs.mkdirSync("tmp", { recursive: true });
const settleVisuals = (locator) =>
  locator.evaluate((el) => {
    for (const animation of el.getAnimations({ subtree: true })) {
      if (animation.effect?.getComputedTiming().iterations !== Infinity)
        animation.finish();
    }
  });
const fixture = `
import {createRoot} from "react-dom/client";import {useState} from "react";
import {CratesPanel} from "./src/components/CratesPanel";import {CourtGames} from "./src/components/CourtGames";import {GambleHall} from "./src/components/GambleHall";import {TaskList} from "./src/components/TaskList";
import {PetSection} from "./src/components/PetSection";
import {RecentCaseOpenings} from "./src/components/RecentTributesTicker";
import {CRATE_TYPES,SAMPLE_CRATE_ITEMS} from "./src/lib/crates";import {createCourtChallenge} from "./src/lib/court-game-challenges";
const crates=Object.entries(CRATE_TYPES).map(([crate_type,c])=>({...c,crate_type}));const c=crates[0];const itemId=c.drops[0].item_id;const item={...SAMPLE_CRATE_ITEMS[itemId],item_id:itemId,variant:"normal"};window.fixtureData={crates,challenge:createCourtChallenge(12),item};window.fixtureCalls=[];

function PetFixture(){const [picked,setPicked]=useState(null);const base={description:"Visual fixture",reward:10,status:"available"};const tasks=[{...base,id:"confession",kind:"confession-writing",title:"Confession Repetition",sentence:"I follow the royal order.",confessionCount:2},{...base,id:"favor",kind:"favor-roulette",title:"Favor Roulette",favorPickedIndex:picked,favorWinningIndex:picked,favorResult:picked===null?null:"win"},{...base,id:"highlow",kind:"high-low",title:"Higher or Lower",currentNumber:12},{...base,id:"sequence",kind:"false-hope",title:"Obedience Sequence",falseHopeProgress:3,falseHopeExpectedKey:"d"}];return <PetSection tasks={tasks} coins={10000} favorCoinReward={100} petTaskCoinReward={50} petReviewTaskCoinReward={50} highLowAllowanceCap={5000} highLowProfitCap={1000} nextTaxDueAt={null} ownerLikeness={10} petScore={100} petAffectionClaimed={false} storedRights={0} rightExpirations={[]} dailyPurchaseCount={0} rightPurchaseDate={null} weeklyTaxCost={2500} onFavorPick={async index=>setPicked(index)}/>}
function Fixture(){const[mode,setMode]=useState("Cases"),[balance,setBalance]=useState(100000);return <><nav style={{display:"flex",flexWrap:"wrap",gap:16,padding:16}}>{["Cases","Games","Gamble","Drain","Pet"].map(x=><button key={x} onClick={()=>setMode(x)}>{x} fixture</button>)}</nav>{mode==="Cases"?<><RecentCaseOpenings/><CratesPanel coins={balance} crates={crates} inventory={[]} onNotice={message=>{throw Error(message)}} onOpenCrate={async(type,quantity)=>{window.fixtureCalls.push({type,quantity});return {success:true,result:{items:Array.from({length:quantity},()=>item),newCoins:90000}}}} onSellItem={async()=>({success:true})}/></>:mode==="Games"?<CourtGames coins={balance} onReward={setBalance}/>:mode==="Gamble"?<GambleHall/>:mode==="Pet"?<PetFixture/>:<TaskList coins={balance} tasks={[]} globalPrincipessaLevel={2} globalPrincipessaProgressPercent={10} globalPrincipessaRequirement={1000} globalPrincipessaXp={100} userLevel={5} userLevelProgressPercent={70} userXpIntoLevel={140} userXpRequiredForNext={200} onLevelDrain={async()=>({drainedUserXp:800,transferredXp:200})}/> }</>}
createRoot(document.getElementById("app")).render(<Fixture/>);
`;
const bundled = await build({
  absWorkingDir: process.cwd(),
  stdin: { contents: fixture, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true,
  write: false,
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NEXT_PUBLIC_PET_THRONE_URL": "undefined" },
  plugins: [
    {
      name: "image",
      setup(b) {
        b.onResolve({ filter: /^next\/image$/ }, () => ({
          path: "image",
          namespace: "mock",
        }));
        b.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
          contents:
            'import {createElement} from "react";export default function Image({fill,unoptimized,quality,sizes,priority,preload,...p}){return createElement("img",{...p,style:fill?{position:"absolute",height:"100%",width:"100%",inset:0,...p.style}:p.style})}',
          resolveDir: process.cwd(),
          loader: "js",
        }));
      },
    },
  ],
});
const css = fs
  .readdirSync(".next/static/chunks")
  .filter((x) => x.endsWith(".css"))
  .map((x) => fs.readFileSync(".next/static/chunks/" + x, "utf8"))
  .join("\n");
const browser = await chromium.launch({
  channel: process.platform === "win32" ? "chrome" : undefined,
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [],
    metrics = [];
  let failRefresh = false;
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("Browser error:", e.message);
  });
  await page.clock.install({ time: new Date("2026-09-10T12:00:00Z") });
  await page.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      p = url.pathname;
    if (p === "/api/recent-case-openings")
      return failRefresh
        ? route.fulfill({ status: 503, json: { error: "Read unavailable" } })
        : route.fulfill({
            json: {
              openers: [
                {
                  id: "reader",
                  username: "Court Reader",
                  rawUsername: "reader",
                  displayName: "Court Reader",
                  recentOpenings: Array.from({ length: 6 }, (_, i) => ({
                    id: "old-" + i,
                    crateName: "Principessa Case",
                    itemId: "demo",
                    itemName: "Historical opening " + (i + 1),
                    itemRarity: i === 0 ? "legendary" : "rare",
                    itemChancePercent: 5,
                    itemImageUrl: "/crate-icons/principessa-case.webp",
                    openedAt: "2023-01-" + String(20 - i) + "T10:00:00Z",
                  })),
                },
              ],
            },
          });
    if (p === "/api/user/court-games") {
      const b = req.method() === "GET" ? {} : req.postDataJSON();
      return route.fulfill({
        json:
          b.action === "start"
            ? { sessionId: b.gameId, challengeSeed: 12 }
            : b.action === "complete"
              ? { rewardCoins: 100, profile: { coins: 100100 } }
              : { games: [] },
      });
    }
    if (p === "/api/user/gamble") {
      const b = req.postDataJSON();
      const responses = {
        slots: {
          reels: [4, 4, 4],
          multiplier: 51,
          payout: 5100,
          roundId: "slots",
        },
        dice: {
          mine: [5, 6],
          hers: [2, 3],
          win: true,
          payout: 184,
          roundId: "dice",
        },
        roulette: { number: 32, win: true, payout: 168, roundId: "roulette" },
        plinko: {
          path: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
          bucket: 6,
          multiplier: 0.27,
          payout: 27,
          roundId: "plinko",
        },
        "mines-open": { roundId: "mines" },
        "mines-pick": { safe: true, picks: [b.cell], multiplier: 1.13 },
        "crash-open": {
          roundId: "crash",
          serverNowMs: Date.now(),
          startsAtMs: Date.now(),
        },
        "crash-status": { crashed: false, elapsedMs: 1000 },
        "crash-cashout": { survived: true, multiplier: 1.08, payout: 108 },
        "crawl-race": { raceId: "race", odds: [2, 3, 4, 5] },
        "crawl-bet": { winner: 0, win: true, payout: 200, roundId: "race" },
      };
      return route.fulfill({ json: responses[b.action] ?? {} });
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
      body: '<!doctype html><html><head><link rel="stylesheet" href="/styles.css"/></head><body class="principessa-court-ui" style="background:#09070c;color:#fff;font-family:Arial,sans-serif"><main id="app" style="max-width:1150px;margin:auto;padding:20px"></main></body></html>',
    });
  });
  await page.goto("http://court.test/");
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  const first = page.locator(".crate-catalog-card").first();
  await first.waitFor();
  await page.locator(".recent-opening-card").first().waitFor();
  const openingStrip = page.locator(".recent-openings-strip");
  assert.equal(
    await page.locator(".crate-cases-panel .recent-openings-strip").count(),
    0,
  );
  assert.ok(
    await openingStrip.evaluate(
      (el) =>
        el.getBoundingClientRect().bottom <
        document.querySelector(".crate-cases-panel").getBoundingClientRect()
          .top,
    ),
    "Recent Openings belongs above the case panel",
  );
  const openingCard = page.locator(".recent-opening-card").first();
  await openingCard.hover();
  await settleVisuals(openingCard);
  assert.ok(
    await openingCard
      .locator(":scope > div")
      .evaluate((el) =>
        getComputedStyle(el).transform.startsWith("matrix3d(-1"),
      ),
    "Previous opening cards must flip on hover",
  );
  await page.mouse.move(0, 0);
  await settleVisuals(openingCard);

  assert.equal(
    await page.getByText("Historical opening 1", { exact: true }).count(),
    1,
  );
  assert.equal(
    await first.evaluate((el) => getComputedStyle(el).transform),
    "none",
  );
  await first
    .getByRole("button", { name: "View contents & drop rates" })
    .click();
  assert.equal(await page.locator("dialog[open]").count(), 1);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog[open]").count(), 0);
  await first.getByRole("button", { name: "5", exact: true }).click();
  assert.equal(
    await first
      .getByRole("button", { name: "5", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await first.getByRole("button", { name: "1", exact: true }).click();
  const buttonYs = await page
    .locator(".crate-catalog-card .crate-open-button")
    .evaluateAll((nodes) =>
      nodes.slice(0, 3).map((x) => x.getBoundingClientRect().y),
    );
  assert.ok(
    Math.max(...buttonYs) - Math.min(...buttonYs) < 2,
    "Case actions must align within the row",
  );
  await page.screenshot({
    path: "tmp/visual-cases-desktop.png",
    fullPage: true,
  });
  failRefresh = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page
    .getByText("Refresh unavailable. Showing the last loaded openings.")
    .waitFor();
  assert.equal(
    await page.getByText("Historical opening 1", { exact: true }).count(),
    1,
  );
  failRefresh = false;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "tmp/visual-cases-mobile.png",
    fullPage: true,
  });
  metrics.push({
    screen: "cases mobile",
    width: await page.evaluate(() => document.documentElement.scrollWidth),
  });
  assert.ok(metrics.at(-1).width <= 390);
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const quantity of [1, 5]) {
    await first
      .getByRole("button", { name: String(quantity), exact: true })
      .click();
    await first
      .getByRole("button", { name: "Open " + quantity, exact: true })
      .click();
    await page.getByRole("heading", { name: "Reel is spinning…" }).waitFor();
    await page.clock.runFor(9000);
    await page.getByTitle("Back to Cases", { exact: true }).waitFor();
    assert.equal(
      (await page.evaluate(() => window.fixtureCalls)).at(-1).quantity,
      quantity,
    );
    await page.getByTitle("Back to Cases", { exact: true }).click();
    await first.waitFor();
  }
  await page.getByRole("button", { name: "Games fixture" }).click();
  await page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "Crown Match", exact: true }),
    })
    .getByRole("button", { name: "Play", exact: true })
    .click();
  await page.locator(".court-match-card").first().click();
  await page.clock.runFor(350);
  assert.equal(await page.locator(".seal-flip[data-open=true]").count(), 1);
  await settleVisuals(page.locator(".court-match-card").first());
  const front = await page
    .locator(".seal-flip[data-open=true] .seal-front")
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return (
        document
          .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
          ?.closest(".seal-front") === el
      );
    });
  assert.equal(
    front,
    true,
    "Opened card front must be painted and receive the hit test",
  );
  await page.screenshot({ path: "tmp/visual-crown-match.png", fullPage: true });
  await page.getByRole("button", { name: "Close game" }).click();
  await page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "Royal Guard", exact: true }),
    })
    .getByRole("button", { name: "Play", exact: true })
    .click();
  await page.getByRole("button", { name: "Take your post" }).click();
  assert.equal(
    await page.locator(".court-games-panel").evaluate((el) => el.scrollLeft),
    0,
    "Game switch must not horizontally scroll the panel",
  );
  await page.screenshot({ path: "tmp/visual-royal-guard.png", fullPage: true });
  await page.getByRole("button", { name: "Drain fixture" }).click();
  await page.getByRole("button", { name: "Drain All Your XP" }).click();
  await page.clock.runFor(1500);
  await page.getByText("800 XP offered · 200 XP received (25%)").waitFor();
  await page.screenshot({ path: "tmp/visual-level-drain.png", fullPage: true });
  await page.getByRole("button", { name: "Gamble fixture" }).click();
  for (const [name, id, action, ms] of [
    ["Her Reels", "slots", "Pull", 2300],
    ["Her Dice", "dice", "Roll", 1700],
    ["Court Roulette", "roulette", "Spin", 3600],
    ["Royal Plinko", "plinko", "Drop", 2600],
    ["The Jewelry Box", "mines", "Buy in", 300],
    ["Her Patience", "crash", "Test her", 1200],
    ["The Crawl", "crawl", "Draw a race sheet", 300],
  ]) {
    await page
      .getByRole("button")
      .filter({ has: page.getByText(name, { exact: true }) })
      .first()
      .click();
    const table = page.locator("#table-" + id);
    await table.getByRole("button", { name: new RegExp("^" + action) }).click();
    await page.clock.runFor(ms);
    if (id === "mines") {
      await table
        .getByRole("button", { name: "Open jewelry box 1", exact: true })
        .click();
      await page.clock.runFor(400);
    }
    if (id === "crawl") {
      await table.getByRole("button", { name: /Pink Collar/ }).click();
      await table.locator(".court-runner[data-running=true]").first().waitFor();
      await page.clock.runFor(1700);
      assert.ok(
        await table
          .locator(".court-runner-wrap")
          .first()
          .evaluate((el) => parseFloat(el.style.left.match(/[\d.]+/)[0]) > 10),
        "Race figures must advance along the lane",
      );
    }
    await settleVisuals(table);
    await table.screenshot({ path: "tmp/visual-gamble-" + id + ".png" });
    metrics.push({ screen: id, text: (await table.innerText()).slice(-250) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  metrics.push({
    screen: "gamble mobile",
    width: await page.evaluate(() => document.documentElement.scrollWidth),
  });
  assert.ok(metrics.at(-1).width <= 390);
  await page.screenshot({
    path: "tmp/visual-gamble-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Pet fixture" }).click();
  const favor = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Favor Roulette", exact: true }),
  });
  const selectable = favor.getByRole("button", { name: "Hidden card 1" });
  await selectable.hover(); await settleVisuals(selectable);
  assert.equal(await selectable.evaluate(el => getComputedStyle(el).outlineStyle), "solid");
  assert.ok(await selectable.evaluate(el => getComputedStyle(el).transform !== "none"), "Hover must lift a selectable card");
  await selectable.click();
  await page.clock.runFor(1000);
  await settleVisuals(favor);
  assert.equal(await favor.locator(".seal-flip[data-open=true]").count(), 5);
  await favor.screenshot({ path: "tmp/visual-pet-favor-mobile.png" });
  const writing = page.locator("article").filter({
    has: page.getByRole("heading", {
      name: "Confession Repetition",
      exact: true,
    }),
  });
  await writing
    .getByPlaceholder("Type the sentence exactly...")
    .fill("I follow");
  assert.equal(
    (await writing.locator(".court-writing-ink").allTextContents()).join(""),
    "I follow",
  );
  await writing.getByPlaceholder("Type the sentence exactly...").fill("I xollow");
  assert.equal((await writing.locator(".court-writing-error").allTextContents()).join(""), "f");
  assert.equal(await writing.locator(".court-writing-error").evaluate(el => getComputedStyle(el).color), "rgb(253, 164, 175)");
  await writing.screenshot({ path: "tmp/visual-pet-writing-mobile.png" });
  metrics.push({
    screen: "pet mobile",
    width: await page.evaluate(() => document.documentElement.scrollWidth),
  });
  assert.ok(metrics.at(-1).width <= 390);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Games fixture" }).click();
  await page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "Royal Guard", exact: true }),
    })
    .getByRole("button", { name: "Play", exact: true })
    .click();
  await page.getByRole("button", { name: "Take your post" }).click();
  assert.equal(
    await page
      .locator(".royal-walker")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "tmp/visual-browser-results.json",
    JSON.stringify({ errors, metrics }, null, 2),
  );
  console.log(
    "Visual fixtures passed: static cases, contents dialog, single + five-case opening, old openings + failed refresh retention, card flip, guard, XP transfer, all seven gamble tables, mobile widths and reduced motion. HTTP mocked.",
  );
} finally {
  await browser.close();
}
