import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
const require = createRequire(import.meta.url);
const { webpack } = require("next/dist/compiled/webpack/webpack");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(import.meta.dirname, "..");
await new Promise((resolve, reject) => {
  const compiler = webpack({
    mode: "development", devtool: false, entry: path.join(root, "scripts/fixtures/maintenance.tsx"),
    output: { path: path.join(root, ".next/maintenance-fixture"), filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": path.join(root, "src") } },
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.join(root, "scripts/fixtures/maintenance-loader.cjs") }] },
  });
  compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
});
const bundle = await readFile(path.join(root, ".next/maintenance-fixture/fixture.js"), "utf8");
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.on("pageerror", (error) => console.error("Browser error:", error.message));
  const base = process.env.TEST_BASE_URL || "http://localhost:3100";
  const response = await page.request.get(base);
  const css = [...(await response.text()).matchAll(/href="([^"]+\.css[^"]*)"/g)].map((m) => m[1]);
  await page.route("**/maintenance-fixture?*", (route) => route.fulfill({ contentType: "text/html", body:
    '<html><head>' + css.map((href) => '<link rel="stylesheet" href="' + href + '">').join("") +
    '</head><body style="background:#100810;color:white"><script>window.process={env:{NODE_ENV:"development"}}</script><div id="fixture"></div></body></html>' }));
  let requests = 0;
  let fail = true;
  await page.route("**/fixture-case", async (route) => {
    requests++;
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: "Test save failed." } : { reward: 350 } });
  });
  await page.goto(base + "/maintenance-fixture?mode=case");
  await page.addScriptTag({ content: bundle });
  const open = page.getByRole("button", { name: "Open Case", exact: true });
  await open.click();
  await page.getByRole("alert").waitFor();
  assert.match(await page.getByRole("alert").innerText(), /Test save failed/);
  assert.equal(await open.isEnabled(), true);
  fail = false;
  await open.click();
  await page.getByRole("button", { name: "Opening...", exact: true }).waitFor();
  const tape = page.locator('div[style*="translateX("][style*="padding-left"]');
  await page.waitForTimeout(900);
  const before = await tape.getAttribute("style");
  await page.waitForTimeout(700);
  assert.notEqual(await tape.getAttribute("style"), before, "Reel must actually move");
  await page.waitForFunction(() => document.documentElement.dataset.revealed === "350");
  assert.equal(requests, 2, "One request per attempt");
  await page.screenshot({ path: path.join(root, ".next/ui-maintenance/case-landed.png") });
  console.log("Case: error shown, retry enabled, pending state, moving reel, exact reward reveal passed.");

  // Dense fixture: equal timestamps test the secondary UUID cursor.
  const id = (n) => "00000000-0000-0000-0000-" + String(n).padStart(12, "0");
  const stamp = "2026-09-09T16:00:00.123456+00:00";
  let rows = Array.from({ length: 130 }, (_, i) => ({ id: id(i + 1), created_at: stamp,
    message: "Message " + (i + 1), user_id: id(1), profiles: { display_name: "Test user" } }));
  let tailPolls = 0;
  let deletedIds = [];
  await page.route("**/api/live-chat?*", (route) => {
    const url = new URL(route.request().url());
    const params = url.searchParams;
    if (params.has("summary")) return route.fulfill({ json: { newestCreatedAt: stamp, unreadCount: 0 } });
    const beforeId = params.get("before")?.split("|")[1], afterId = params.get("after")?.split("|")[1];
    let matches = rows.filter((row) => beforeId ? row.id < beforeId : afterId ? row.id > afterId : true);
    if (!afterId) matches = matches.toReversed();
    const selected = matches.slice(0, 50);
    const nextCursor = selected.length ? stamp + "|" + selected.at(-1).id : null;
    if (afterId) tailPolls++;
    return route.fulfill({ json: { messages: afterId ? selected : selected.toReversed(),
      hasMore: matches.length > 50, nextCursor, deletedIds, currentUser: { isAdmin: false } } });
  });
  await page.goto(base + "/maintenance-fixture?mode=chat");
  await page.addScriptTag({ content: bundle });
  await page.getByRole("button", { name: /Live Chat/ }).click();
  await page.waitForFunction(() => document.querySelectorAll("article").length === 50);
  const scroll = page.locator('div.overflow-y-auto');
  await scroll.evaluate((el) => { el.scrollTop = 0; });
  await page.waitForFunction(() => document.querySelectorAll("article").length === 100);
  assert.ok(await scroll.evaluate((el) => el.scrollTop > 100), "History prepend preserves reading position");
  await scroll.evaluate((el) => { el.scrollTop = 0; });
  await page.waitForFunction(() => document.querySelectorAll("article").length === 130);
  assert.equal(await page.getByRole("button", { name: "Load older messages" }).count(), 0);
  assert.equal(await page.locator("article").first().innerText().then((s) => s.includes("Message 1")), true);
  // Close/reopen triggers a tail refresh; more than one page must be caught up.
  await page.getByRole("button", { name: "Close", exact: true }).click();
  rows.push(...Array.from({ length: 115 }, (_, i) => ({ ...rows[0], id: id(131 + i), message: "Message " + (131 + i) })));
  deletedIds = [id(1)];
  await page.getByRole("button", { name: /Live Chat/ }).click();
  await page.waitForFunction(() => document.querySelectorAll("article").length === 245);
  assert.ok(tailPolls >= 3);
  assert.match(await page.locator("article").first().innerText(), /Message deleted/);
  const ids = await page.locator("article").allTextContents();
  assert.equal(new Set(ids).size, 245);
  console.log("Chat: 130-message history, tied-timestamp pagination, scroll anchor, 115-message catchup, moderation and no duplicates passed.");
} finally { await browser.close(); }
