import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { build } from "esbuild";
import { chromium } from "playwright";

// Render the real header actions and sound controls from page.tsx, without
// authenticating or connecting to a live account.
const source = fs.readFileSync("src/app/page.tsx", "utf8");
const ast = ts.createSourceFile(
  "page.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const initializers = new Map();
function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.initializer &&
    ts.isIdentifier(node.name)
  ) {
    if (["headerActions", "soundControls"].includes(node.name.text))
      initializers.set(node.name.text, node.initializer.getText(ast));
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(initializers.size, 2);
const stageClass = source.match(/className="(court-profile-stage[^"]*)"/)?.[1];
assert.ok(stageClass);
const fixture = `
import {createRoot} from "react-dom/client";
import {useState} from "react";
import Link from "next/link";
import {ProfileHeader} from "./src/components/ProfileHeader";
import {NotificationBell} from "./src/components/NotificationBell";
import {RecentTributesTicker} from "./src/components/RecentTributesTicker";
function Fixture(){
  const isAdminUser = !location.search.includes("member"), isLoggedIn=true, isGuestMode=false, isPreviewMode=false;
  const [soundSettings, setSoundSettings]=useState({masterVolume:.7,gameplayEnabled:true,uiEnabled:true});
  const soundsMuted=!soundSettings.uiEnabled&&!soundSettings.gameplayEnabled;
  const applySoundSettings=patch=>setSoundSettings(s=>({...s,...patch}));
  const handleLogout=()=>window.fixtureLoggedOut=true;
  const soundControls=${initializers.get("soundControls")};
  const headerActions=${initializers.get("headerActions")};
  return <div className="principessa-court-ui"><main className="relative z-10 mx-auto flex max-w-6xl flex-col gap-5 p-4">
    <div className=${JSON.stringify(stageClass)}><div className="relative z-30 mt-3"><ProfileHeader compact avatarSrc="" coins={1000} username="Court Reader" currentTitle="Royal Favorite" pageLabel="Home" stats={[{label:"Money",value:25}]} soundControls={soundControls} actions={headerActions}/></div></div>
    <RecentTributesTicker showRecentOpenings={false} tributes={[{id:"fixture",username:"Reader",avatarUrl:null,amount:100,createdAt:"2026-09-10T12:00:00Z"}]}/>
    <div style={{height:1200}}>Court content</div>
  </main></div>;
}
createRoot(document.getElementById("app")).render(<Fixture/>);
`;
const result = await build({
  absWorkingDir: process.cwd(),
  stdin: { contents: fixture, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true,
  write: false,
  platform: "browser",
  jsx: "automatic",
  plugins: [
    {
      name: "next-fixture",
      setup(builder) {
        builder.onResolve({ filter: /^next\/(image|link)$/ }, (args) => ({
          path: args.path,
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          contents: args.path.endsWith("link")
            ? 'import {createElement} from "react";export default function Link(p){return createElement("a",p)}'
            : "export default function Image(){return null}",
          resolveDir: process.cwd(),
          loader: "js",
        }));
      },
    },
  ],
});
const css = fs
  .readdirSync(".next/static/chunks")
  .filter((name) => name.endsWith(".css"))
  .map((name) =>
    fs.readFileSync(path.join(".next/static/chunks", name), "utf8"),
  )
  .join("\n");
fs.mkdirSync("tmp", { recursive: true });
const browser = await chromium.launch({
  channel: process.platform === "win32" ? "chrome" : undefined,
  headless: true,
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/user/notifications")
      return route.fulfill({
        json: {
          notifications: [
            {
              id: "test",
              title: "Fixture notification",
              body: "This panel must remain above Recent Tributes.",
              created_at: "2026-09-10T12:00:00Z",
              read_at: null,
            },
          ],
          unreadCount: 1,
        },
      });
    if (url.pathname === "/api/admin/notifications")
      return route.fulfill({ json: { notifications: [], counts: {} } });
    if (url.pathname === "/api/tribute-goal")
      return route.fulfill({ json: { goalUsd: 1000, raisedUsd: 100 } });
    if (url.pathname === "/styles.css")
      return route.fulfill({ contentType: "text/css", body: css });
    if (url.pathname !== "/")
      return route.fulfill({ body: "Fixture destination" });
    return route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><link rel="stylesheet" href="/styles.css"/></head><body style="margin:0;background:#060305;color:white;font-family:Arial"><div id="app"></div></body></html>',
    });
  });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://header.test/");
    await page.addScriptTag({ content: result.outputFiles[0].text });
    const header = page.locator(".court-account-bar");
    await header.waitFor();
    assert.equal(
      await header.locator("details").count(),
      0,
      "Header actions must not require expanding Account",
    );
    for (const name of ["Admin", "Analytics"])
      assert.ok(
        await header.getByRole("link", { name, exact: true }).isVisible(),
      );
    await header.getByRole("button", { name: "Mute sound" }).click();
    assert.ok(
      await header.getByRole("button", { name: "Unmute sound" }).isVisible(),
    );
    const bell = header.getByRole("button", { name: /Notifications/ });
    await bell.click();
    const panel = page.getByRole("dialog", { name: "Notification Center" });
    await panel.getByText("Fixture notification", { exact: true }).waitFor();
    const overlay = await panel.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const tribute = document
        .querySelector("main > section")
        .getBoundingClientRect();
      const x =
        (Math.max(rect.left, tribute.left) +
          Math.min(rect.right, tribute.right)) /
        2;
      const y =
        (Math.max(rect.top, tribute.top) +
          Math.min(rect.bottom, tribute.bottom)) /
        2;
      return {
        overlaps: y >= tribute.top && y <= tribute.bottom,
        topmost: el.contains(document.elementFromPoint(x, y)),
        insideViewport:
          rect.left >= 0 &&
          rect.right <= innerWidth &&
          rect.bottom <= innerHeight,
      };
    });
    assert.deepEqual(
      overlay,
      { overlaps: true, topmost: true, insideViewport: true },
      "Notifications must paint over the tribute feed and fit the viewport",
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({ path: `tmp/header-notifications-${width}.png` });
    await page.keyboard.press("Escape");
    assert.equal(await panel.count(), 0);
    assert.ok(await bell.evaluate((el) => el === document.activeElement));
    await bell.click();
    await panel.waitFor();
    await page.mouse.click(2, 2);
    assert.equal(await panel.count(), 0);
    await header.getByRole("link", { name: "Admin", exact: true }).click();
    await page.waitForURL("http://header.test/admin");
  }
  await page.goto("http://header.test/?member");
  await page.addScriptTag({ content: result.outputFiles[0].text });
  await page.locator(".court-account-bar").waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Admin", exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("link", { name: "Analytics", exact: true }).count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Header passed: direct admin/analytics access, separate sound controls, member visibility, notifications above tribute feed, mobile widths, Escape and outside click. HTTP mocked.",
  );
} finally {
  await browser.close();
}
