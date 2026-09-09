import { chromium } from "playwright";
import { build } from "esbuild";
import assert from "node:assert/strict";
const bundle = await build({
  absWorkingDir: process.cwd(),
  stdin: {
    contents:
      'import {createRoot} from "react-dom/client";import {CourtGames} from "./src/components/CourtGames";import {createCourtChallenge,verifyCourtActions} from "./src/lib/court-game-challenges";Object.assign(window,{courtTest:{createCourtChallenge,verifyCourtActions}});createRoot(document.getElementById("app")!).render(<CourtGames coins={1000} onReward={()=>{}}/>);',
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  platform: "browser",
  jsx: "automatic",
  plugins: [
    {
      name: "decorative-image",
      setup(builder) {
        builder.onResolve({ filter: /^next\/image$/ }, () => ({
          path: "image",
          namespace: "mock",
        }));
        builder.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
          contents: "export default function Image(){return null}",
          loader: "js",
        }));
      },
    },
  ],
});
(async () => {
  const browser = await chromium.launch({
    channel: process.platform === "win32" ? "chrome" : undefined,
    headless: true,
  });
  const page = await browser.newPage();
  const errors = [],
    completed = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-09-09T12:00:00Z") });
  await page.route("http://localhost:3999/**", async (route) => {
    const req = route.request();
    if (!req.url().includes("/api/user/court-games"))
      return route.fulfill({
        contentType: "text/html",
        body: '<div id="app"></div>',
      });
    if (req.method() === "GET") return route.fulfill({ json: { games: [] } });
    const body = req.postDataJSON();
    if (body.action === "start")
      return route.fulfill({
        json: { sessionId: body.gameId, challengeSeed: 12 },
      });
    if (body.action === "complete") {
      const verified = await page.evaluate(
        (b) =>
          window.courtTest.verifyCourtActions(
            b.gameId,
            12,
            b.metrics.actions,
            b.metrics.actions.at(-1).atMs + 1000,
          ),
        body,
      );
      completed.push({ game: body.gameId, verified, reported: body.metrics });
      return route.fulfill({
        json: { rewardCoins: 100, profile: { coins: 1100 } },
      });
    }
    return route.fulfill({ json: { failed: true } });
  });
  await page.goto("http://localhost:3999");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const challenge = await page.evaluate(() =>
    window.courtTest.createCourtChallenge(12),
  );
  async function open(name) {
    await page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .getByRole("button", { name: "Play", exact: true })
      .click();
    await page.getByRole("button", { name: "Close game" }).waitFor();
  }
  await open("Crown Match");
  const wrong = [
    challenge.cards[0].id,
    challenge.cards.find((card) => card.symbol !== challenge.cards[0].symbol)
      .id,
  ];
  for (let i = 0; i < 5; i++) {
    await page.locator(".court-match-card").nth(wrong[0]).click();
    await page.locator(".court-match-card").nth(wrong[1]).click();
    await page.clock.runFor(800);
    if (i < 4)
      assert.equal(
        await page
          .getByRole("status", { name: 4 - i + " lives remaining" })
          .count(),
        1,
      );
  }
  assert.equal(completed.length, 0, "Failed attempt must not grant reward");
  await page
    .getByText("No reward this time. You can try again.", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Back to Games" }).click();
  await open("Crown Match");
  await page.getByRole("status", { name: "5 lives remaining" }).waitFor();
  const seen = new Set();
  for (const card of challenge.cards) {
    if (seen.has(card.symbol)) continue;
    seen.add(card.symbol);
    for (const c of challenge.cards.filter((x) => x.symbol === card.symbol))
      await page.locator(".court-match-card").nth(c.id).click();
    await page.clock.runFor(400);
  }
  await page.getByRole("button", { name: "Back to Games" }).click();
  await open("Principessa Says");
  for (const round of challenge.says) {
    if (!round.shouldObey || round.action === "still")
      await page.clock.runFor(round.timeMs + 30);
    else if (round.action === "type") {
      assert.equal(
        await page.getByRole("textbox").getAttribute("placeholder"),
        "Your response…",
      );
      await page.getByRole("textbox").fill(round.expectedText);
      await page.getByRole("button", { name: "Submit", exact: true }).click();
    } else
      await page
        .getByRole("button", {
          name: round.action === "bow" ? /Bow$/ : /Kneel$/,
        })
        .click();
    await page.clock.runFor(600);
  }
  await page.getByRole("button", { name: "Back to Games" }).click();
  await open("Royal Guard");
  await page.getByRole("button", { name: "Take your post" }).click();
  for (let i = 0; i < challenge.targets.length; i++) {
    if (challenge.targets[i].threat)
      await page.locator(".royal-walker").click();
    else await page.clock.runFor((i < 6 ? 1700 : i < 12 ? 1250 : 900) + 30);
    await page.clock.runFor(500);
  }
  await page.getByRole("button", { name: "Back to Games" }).waitFor();
  assert.equal(completed.length, 3);
  for (const r of completed) {
    assert.ok(r.verified, JSON.stringify(r));
    assert.equal(r.verified.score, r.reported.score);
  }
  assert.deepEqual(errors, []);
  console.log(
    "Actual CourtGames client passed Crown Match, Principessa Says and Royal Guard; all emitted action transcripts verified against the server challenge. Clock controlled; HTTP mocked.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
