import assert from "node:assert/strict";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "playwright";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import path from "node:path";

const fixture = `
import {createRoot} from "react-dom/client";
import {CrateDuelBattle} from "./src/components/CrateDuelBattle";
import {CrateUpgradeModal} from "./src/components/CrateUpgradeModal";
import {CRATE_TYPES,SAMPLE_CRATE_ITEMS} from "./src/lib/crates";
import {isUpgradeExcluded} from "./src/lib/crate-upgrade";
const crateType=Object.keys(CRATE_TYPES).find(key=>CRATE_TYPES[key].enabled);
const item=(value)=>({itemId:'fixture',name:'Item '+value,rarity:'rare',sellValue:value,variant:'normal',imageUrl:null});
const duel={id:'skip-fixture',challenger:'Same name',opponent:'Same name',challengerItems:[item(5),item(50),item(70)],opponentItems:[item(10),item(60),item(90)],challengerTotal:125,opponentTotal:160,crateName:'Three cases',crateType,crates:[crateType,crateType,crateType],quantity:3,isMine:true,isMyChallenge:true,wonByMe:false,winner:'Same name'};
const [inputId,input]=Object.entries(SAMPLE_CRATE_ITEMS).filter(([id,def])=>def.sell_value>0&&!isUpgradeExcluded(id)).sort((a,b)=>a[1].sell_value-b[1].sell_value)[0];
window.fixtureInput=input;window.fixtureItems=SAMPLE_CRATE_ITEMS;
const modal=new URLSearchParams(location.search).has('upgrade')?<CrateUpgradeModal item={{...input,item_id:inputId,variant:'normal'}} onClose={()=>{window.fixtureClosed=true}} onUpgraded={()=>{window.fixtureRefreshed=true}}/>:<CrateDuelBattle duel={duel} onClose={()=>{window.fixtureClosed=true}}/>;
createRoot(document.getElementById('root')).render(<><button id="outside">Outside</button>{modal}</>);
`;
const built = await build({ outfile: "tmp/duel-fixture.js", tsconfigRaw: { compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }, stdin: { contents: fixture, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", plugins: [{ name: "mute-fixture", setup(build) { build.onLoad({ filter: /[\\/]lib[\\/]sound\.ts$/ }, () => ({ contents: "export const emitSoundEvent=()=>{}", loader: "js" })); } }] });
const js = built.outputFiles.find(file => file.path.endsWith(".js")).text;
const moduleCss = built.outputFiles.find(file => file.path.endsWith(".css"))?.text ?? "";
const styles = await postcss([tailwind()]).process('@import "tailwindcss" source(none); @source "../src/components/CrateDuelBattle.tsx"; @source "../src/components/CrateUpgradeModal.tsx"; @source "../src/components/CourtDialog.tsx";', { from: path.resolve("scripts/crate-duel-fixture.css") });
const server = createServer((request, response) => {
  if (request.url === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(js); }
  else if (request.url === "/fixture.css") { response.setHeader("Content-Type", "text/css"); response.end(styles.css + moduleCss); }
  else { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>'); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true }).catch(() => chromium.launch({ headless: true, channel: "msedge" }));
  for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => route.request().resourceType() === "image" ? route.abort() : route.continue());
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => {
      const reels = [...document.querySelectorAll('.will-change-transform')];
      return reels.length === 2 && reels.every(node => node.getAnimations().some(animation => animation.playState === 'running'));
    });
    const firstPosition = await page.locator('.will-change-transform').first().evaluate(node => getComputedStyle(node).transform);
    await page.waitForTimeout(180);
    assert.notEqual(await page.locator('.will-change-transform').first().evaluate(node => getComputedStyle(node).transform), firstPosition, 'The first opening visibly travels instead of snapping to its result');
    await page.locator('.will-change-transform').last().evaluate(node => node.getAnimations()[0].pause());
    await page.waitForTimeout(3000);
    assert.equal(await page.getByText('Opening...', {exact:true}).count(), 2, 'Neither result is revealed while one reel is still moving');
    assert.equal(await page.getByText('Round 1 / 3', {exact:true}).count(), 1, 'The next round waits for both reels');
    await page.locator('.will-change-transform').last().evaluate(node => node.getAnimations()[0].play());
    await page.getByText('Item 5', {exact:true}).waitFor();
    await page.getByText('Item 10', {exact:true}).waitFor();
    assert.equal(await page.locator('.will-change-transform').evaluateAll(nodes => nodes.reduce((count,node) => count + node.getAnimations().length,0)), 0, 'Both reels settle before their results appear');
    await page.getByText('Round 2 / 3', {exact:true}).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.will-change-transform')].every(node => node.getAnimations().some(animation => animation.playState === 'running')));
    await page.getByRole("button", { name: "Skip ›", exact: true }).click();
    await page.getByText("Final", { exact: true }).waitFor();
    const reels = await page.locator(".will-change-transform").evaluateAll((nodes) => nodes.map((node) => ({ transform: node.style.transform, transition: node.style.transition })));
    assert.equal(reels.length, 2);
    assert.ok(reels.every((reel) => reel.transition === "none" && reel.transform === "translateY(-3202px)"), "Skip snaps both reels straight to their final cards");
    assert.equal(await page.locator('.will-change-transform').evaluateAll(nodes => nodes.reduce((count,node) => count + node.getAnimations().length,0)), 0, 'Skip cancels all compositor animations');
    assert.equal(await page.getByText("You win", { exact: true }).count(), 0, "Matching display names cannot assign the winner to the wrong player");
    await page.getByText("Same name wins", { exact: true }).waitFor();
    await page.waitForTimeout(3000);
    assert.deepEqual(await page.locator(".will-change-transform").evaluateAll((nodes) => nodes.map((node) => ({ transform: node.style.transform, transition: node.style.transition }))), reels, "Cancelled round and settle timers never restart reels");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.querySelector("dialog").contains(document.activeElement)), true, "Keyboard focus stays inside the modal");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => window.fixtureClosed), true);
    assert.deepEqual(errors, []);
    await page.close();
    const upgradePage = await browser.newPage({ viewport, reducedMotion: "reduce" });
    const attempts = [];
    await upgradePage.route("**/api/user/crate-upgrade", async (route) => {
      const body = route.request().postDataJSON();
      attempts.push(body);
      if (attempts.length === 1) return route.abort();
      const chancePercent = await upgradePage.evaluate((id) => Math.min(80, 90 * window.fixtureInput.sell_value / window.fixtureItems[id].sell_value), body.targetItemId);
      await route.fulfill({ json: { success: true, won: true, chancePercent, rollFraction: chancePercent / 200 } });
    });
    await upgradePage.goto(`http://127.0.0.1:${server.address().port}/?upgrade`);
    await upgradePage.getByRole("button", { name: /^⇪ Upgrade ·/ }).click();
    await upgradePage.getByRole("alert").waitFor();
    await upgradePage.getByRole("button", { name: /^⇪ Upgrade ·/ }).click();
    await upgradePage.getByRole("button", { name: "Collect", exact: true }).waitFor();
    assert.equal(attempts.length, 2);
    assert.ok(attempts[0].requestId);
    assert.equal(attempts[0].requestId, attempts[1].requestId, "A network failure retries the same upgrade attempt");
    assert.equal(await upgradePage.evaluate(() => window.fixtureRefreshed), true);
    assert.equal(await upgradePage.locator("dialog").evaluate((node) => node.scrollWidth <= node.clientWidth + 1), true, "Upgrade fits the viewport without horizontal scrolling");
    await upgradePage.keyboard.press("Escape");
    assert.equal(await upgradePage.evaluate(() => window.fixtureClosed), true);
    await upgradePage.close();
  }
  console.log("Crate browser: first-round movement, delayed reel synchronization, later-round animation, skip, cancelled animations/timers, duplicate names, focus, Escape, Upgrade retries and responsive modal passed at desktop and mobile widths.");
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
