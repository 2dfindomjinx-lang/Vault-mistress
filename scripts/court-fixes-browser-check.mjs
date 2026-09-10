import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { build } from "esbuild";
import { chromium } from "playwright";

const source = fs.readFileSync("src/app/page.tsx", "utf8");
const ast = ts.createSourceFile(
  "page.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let sequenceHandler, timeoutUpdate;
function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.name.getText(ast) === "handlePetFalseHopeKey"
  )
    sequenceHandler = node.initializer.getText(ast);
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(ast) === "setTasks" &&
    node.arguments[0]?.getText(ast).includes("profile.timeout_until")
  )
    timeoutUpdate = node.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(sequenceHandler && timeoutUpdate);
const fixture = `
import {createRoot} from "react-dom/client";
import {useState,useRef} from "react";
import {FindomWheels} from "./src/components/FindomWheels";
import {PetSection} from "./src/components/PetSection";
import {TaskList} from "./src/components/TaskList";
import {GambleAnalyticsPanel} from "./src/components/admin/GambleAnalyticsPanel";
import {getDailyGmt3CooldownUntil as getPetTaskCooldownUntil} from "./src/lib/time";
import {getCourtSealShareText} from "./src/lib/court-seal-shared";
window.shareText=getCourtSealShareText({board:"furnace",burned:115});
function PetFixture(){
  const [tasks,setTasks]=useState([
    {id:"pet-confession-dm",kind:"confession-writing",title:"Confession Repetition",sentence:"I’m Principessa’s devoted pet.",reward:10,status:"available"},
    {id:"pet-ownership-oath",kind:"ownership-oath",title:"Ownership Oath",sentence:"I’m Principessa’s devoted pet.",reward:10,status:"available"},
    {id:"pet-false-hope",kind:"false-hope",title:"Obedience Sequence",reward:10,status:"available",falseHopeExpectedKey:"a",falseHopeProgress:10}
  ]);
  const petTaskStateRef=useRef(tasks),falseHopePersistQueueRef=useRef(Promise.resolve());
  const setPetTaskStateOptimistic=fn=>{petTaskStateRef.current=fn(petTaskStateRef.current);setTasks(petTaskStateRef.current);window.sequence=petTaskStateRef.current[2]};
  const blockIfTimedOut=()=>false, isGuestMode=true,authUserId=null,petScore=0,eventPetTaskCoinReward=50;
  const setAvatarMistressReply=()=>{},emitSoundEvent=()=>{},setPetScore=()=>{},setAuthError=()=>{},describeError=String;
  const persistPetProfilePatch=async()=>{},persistPetTask=async()=>{};
  const handlePetFalseHopeKey=${sequenceHandler};
  return <PetSection tasks={tasks} coins={10000} favorCoinReward={100} petTaskCoinReward={50} petReviewTaskCoinReward={50} highLowAllowanceCap={5000} highLowProfitCap={1000} nextTaxDueAt={null} ownerLikeness={10} petScore={100} petAffectionClaimed={false} storedRights={0} rightExpirations={[]} dailyPurchaseCount={0} rightPurchaseDate={null} weeklyTaxCost={2500} onFalseHopeKey={handlePetFalseHopeKey}/>;
}
function TimeoutFixture(){
 const [tasks,setTasks]=useState([{id:"timeout-risk",kind:"timeout-risk",title:"Risk My Freedom",description:"A royal risk",reward:100,completed:false,claimed:false,timeoutUntil:new Date(Date.now()+3600000).toISOString()}]);
 const clear=()=>{const profile={timeout_until:null};setTasks(${timeoutUpdate})};
 return <><button onClick={clear}>Clear timeout fixture</button><TaskList tasks={tasks} coins={10000} globalPrincipessaLevel={1} globalPrincipessaProgressPercent={0} globalPrincipessaRequirement={1000} globalPrincipessaXp={0} userLevel={1} userLevelProgressPercent={0} userXpIntoLevel={0} userXpRequiredForNext={100} timeoutRiskChance={0.5} timeoutRiskEffectiveDays={1} timeoutRiskMaxDays={1} timeoutRiskTimeoutHours={1} timeoutRiskReward={100}/></>;
}
const metric={rounds:4,players:2,wagered:800,settledWager:300,settledRounds:3,openRounds:1,payout:516,profitableRounds:2,doubleWins:1,doubleLosses:1};
function Fixture(){const[mode,setMode]=useState("Wheels");return <><nav style={{display:"flex",gap:20,flexWrap:"wrap",padding:16}}>{["Wheels","Pet","Timeout","Analytics"].map(m=><button key={m} onClick={()=>setMode(m)}>{m} fixture</button>)}</nav>{mode==="Wheels"?<FindomWheels/>:mode==="Pet"?<PetFixture/>:mode==="Timeout"?<TimeoutFixture/>:<GambleAnalyticsPanel data={{summary:metric,games:[{...metric,game:"slots"}],byDay:[{...metric,day:"2026-09-10"}]}}/>}</>}
createRoot(document.getElementById("app")).render(<Fixture/>);
`;
const bundle = await build({
  stdin: { contents: fixture, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true,
  write: false,
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NEXT_PUBLIC_PET_THRONE_URL": "undefined" },
  plugins: [
    {
      name: "next-image",
      setup(b) {
        b.onResolve({ filter: /^next\/image$/ }, () => ({
          path: "image",
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          resolveDir: process.cwd(),
          contents:
            'import {createElement} from "react";export default function Image({fill,priority,quality,unoptimized,sizes,preload,...p}){return createElement("img",{...p,style:{...(fill?{position:"absolute",width:"100%",height:"100%",inset:0}:{}),...p.style}})}',
        }));
      },
    },
  ],
});
const css = fs
  .readdirSync(".next/static/chunks")
  .filter((f) => f.endsWith(".css"))
  .map((f) => fs.readFileSync(path.join(".next/static/chunks", f), "utf8"))
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
  page.on("pageerror", (e) => { errors.push(e.message); process.stderr.write(e.message + "\n"); });
  await page.clock.install({ time: new Date("2026-09-10T12:00:00Z") });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/user/wheels") {
      if (route.request().method() === "POST")
        return route.fulfill({
          json: {
            wheelId: "chastity",
            segmentIndex: 0,
            segment: { amount: 4, label: "4h", throneUrl: null },
            amountOwed: 0,
            chastityUntil: null,
            payCode: null,
          },
        });
      return route.fulfill({
        json: {
          chastityUntil: null,
          debtors: [],
          money: 100,
          spins: [],
          unpaidSpin: null,
        },
      });
    }
    if (url.pathname === "/styles.css")
      return route.fulfill({ contentType: "text/css", body: css });
    const publicRoot = path.resolve("public"),
      asset = path.resolve(publicRoot, "." + decodeURIComponent(url.pathname));
    if (
      asset.startsWith(publicRoot + path.sep) &&
      fs.existsSync(asset) &&
      fs.statSync(asset).isFile()
    )
      return route.fulfill({ path: asset });
    if (url.pathname !== "/") return route.fulfill({ status: 404, body: "" });
    return route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><link rel="stylesheet" href="/styles.css"/></head><body class="principessa-court-ui" style="margin:0;background:#09050b;color:white;font-family:Arial"><main id="app" style="max-width:1150px;margin:auto;padding:16px"></main></body></html>',
    });
  });
  await page.goto("http://court-fixes.test/");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  assert.equal(
    await page.evaluate(() => window.shareText),
    "I burned $115 and got nothing back.",
  );
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const material of ["broke", "principessa", "luxury", "chastity"]) {
      const names = {
        broke: /Broke Wheel/,
        principessa: /Principessa.*Wheel/,
        luxury: /Luxury Wheel/,
        chastity: /Chastity Wheel/,
      };
      await page
        .getByRole("button", { name: names[material] })
        .filter({ has: page.locator('[class*="font-serif"]') })
        .first()
        .click();
      const wheel = page.locator(
        '.court-wheel-body[data-material="' + material + '"]',
      );
      await wheel.waitFor();
      const geometry = await wheel.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const positions = [...el.querySelectorAll("svg text")].map((text) => ({
          x: Number(text.getAttribute("x")),
          y: Number(text.getAttribute("y")),
        }));
        return {
          width: box.width,
          height: box.height,
          positions,
          scroll: document.documentElement.scrollWidth,
          viewport: innerWidth,
        };
      });
      assert.ok(
        Math.abs(geometry.width - geometry.height) < 1,
        "Wheel stays circular",
      );
      assert.equal(geometry.positions.length, 24);
      for (const pos of geometry.positions)
        assert.ok(
          Math.abs(Math.hypot(pos.x - 120, pos.y - 120) - 82) < 0.001,
          "Labels share the wheel centre and radius",
        );
      assert.ok(
        geometry.scroll <= geometry.viewport,
        "No horizontal wheel overflow",
      );
    }
    await page
      .locator(".court-wheel-body")
      .screenshot({ path: "tmp/court-fixes-wheel-" + width + ".png" });
  }
  await page.getByRole("button", { name: /^Spin Chastity Wheel/ }).click();
  await page.clock.runFor(4600);
  await page
    .getByRole("heading", { name: "+4h locked", exact: true })
    .waitFor();
  const landed = await page.locator(".court-wheel-body").evaluate((el) => {
    const rotation = Number(el.style.transform.match(/rotate\(([-.\d]+)/)?.[1]);
    const labels = [...el.querySelectorAll("svg text")];
    const selected = labels.find(
      (text, i) =>
        Math.abs(
          (((rotation + ((i + 0.5) * 360) / labels.length) % 360) + 360) % 360,
        ) < 0.01,
    );
    return selected?.textContent;
  });
  assert.equal(landed, "4h", "Pointer lands on the server result");
  await page.getByRole("button", { name: "Pet fixture", exact: true }).click();
  for (const [title, placeholder] of [
    ["Confession Repetition", "Type the sentence exactly..."],
    ["Ownership Oath", "Type the oath exactly..."],
  ]) {
    const card = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await card
      .getByPlaceholder(placeholder)
      .fill("I'm Principessa's devoted pet.");
    assert.equal(
      await card.locator(".court-writing-error").count(),
      0,
      "Straight apostrophes match curly quotes",
    );
    await card
      .getByPlaceholder(placeholder)
      .fill("I'm Principessa's devotex pet.");
    assert.equal(
      await card.locator(".court-writing-error").count(),
      1,
      "Real mismatches stay red",
    );
  }
  const sequence = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", {
        name: "Obedience Sequence",
        exact: true,
      }),
    });
  for (let i = 0; i < 5; i++)
    await sequence
      .getByRole("button", { name: i % 2 ? "a" : "d", exact: true })
      .click();
  assert.equal((await page.evaluate(() => window.sequence)).status, "failed");
  await sequence.getByText("0 mistakes left", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Timeout fixture", exact: true })
    .click();
  await page.getByText(/Current timeout:/).waitFor();
  await page
    .getByRole("button", { name: "Clear timeout fixture", exact: true })
    .click();
  assert.equal(
    await page.getByText(/Current timeout:/).count(),
    0,
    "Clearing updates the task without a reload",
  );
  await page
    .getByRole("button", { name: "Analytics fixture", exact: true })
    .click();
  const analytics = page.getByRole("region", { name: "Gamble analytics" });
  await analytics.waitFor();
  assert.ok(
    (await analytics.getByText("172.0%", { exact: true }).count()) >= 1,
  );
  assert.ok((await analytics.getByText("-216", { exact: true }).count()) >= 1);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: "tmp/court-fixes-analytics-" + width + ".png",
      fullPage: true,
    });
  }
  assert.deepEqual(errors, []);
  console.log(
    "Court fixes browser passed: four symmetric wheels at desktop/mobile sizes, correct landing, apostrophes, five sequence errors, immediate timeout refresh, Furnace share text and Gamble analytics. Local assets; HTTP mocked.",
  );
} finally {
  await browser.close();
}
