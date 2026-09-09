// Run against a local server. PLAYWRIGHT_MODULE may point to a bundled install.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const output = new URL("../.next/ui-maintenance/", import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, "");
await mkdir(output, { recursive: true });
try {
  await page.goto(process.env.TEST_BASE_URL || "http://localhost:3100");
  await page.getByRole("button", { name: "Continue in Preview Mode" }).click();
  await page.locator("aside nav").getByRole("button", { name: /Home/ }).click();
  await page.getByRole("heading", { name: "What should you do now?" }).waitFor();
  const section = page.locator('section[aria-labelledby="court-destinations-title"]');
  assert.equal(await section.getByRole("button").count(), 5);
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({ path: output + "/home-desktop.png" });
  for (const [label, route] of [["Debt Contracts", "/debt"], ["Gamble Hall", "/wheels"], ["Cases", "/cases"], ["Shrine of Principessa", "/tribute"], ["Money Shop", "/money-shop"]]) {
    await section.getByRole("button").filter({ hasText: label }).click();
    assert.equal(new URL(page.url()).pathname, route);
    await page.locator("aside nav").getByRole("button", { name: /Home/ }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({ path: output + "/home-mobile.png" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  for (const height of [900, 768, 600]) {
    await page.setViewportSize({ width: 1440, height });
    const metrics = await page.locator("aside nav").first().evaluate((nav) => {
      const bounds = nav.getBoundingClientRect();
      const buttons = [...nav.querySelectorAll("button")];
      return { overflow: nav.scrollHeight > nav.clientHeight + 1,
        clipped: buttons.filter((button) => button.getBoundingClientRect().bottom > bounds.bottom + 1).map((b) => b.textContent),
        fonts: buttons.map((button) => getComputedStyle(button.querySelector(".font-serif")).fontSize) };
    });
    assert.equal(metrics.overflow, false, JSON.stringify({ height, metrics }));
    assert.equal(metrics.clipped.length, 0, JSON.stringify({ height, metrics }));
    assert.ok(metrics.fonts.every((size) => parseFloat(size) >= 16));
    console.log("Sidebar fits", height, metrics.fonts[0]);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Notifications", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Notification Center" });
  await dialog.waitFor();
  assert.equal(await dialog.evaluate((el) => el.parentElement === document.body), true);
  assert.equal(await dialog.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + Math.min(box.height / 2, 100)));
  }), true);
  await page.screenshot({ path: output + "/notifications.png" });
  await page.keyboard.press("Escape");
  await page.locator("aside nav").getByRole("button", { name: /Games/ }).click();
  await page.getByRole("heading", { name: "IRL Task Wheel", exact: true }).scrollIntoViewIfNeeded();
  const wheel = page.locator('div[style*="conic-gradient"]').last();
  const radii = await wheel.evaluate((el) => [...el.querySelectorAll('span[style*="left"]')].map((label) => {
    return Math.hypot(parseFloat(label.style.left) - 50, parseFloat(label.style.top) - 50);
  }));
  assert.equal(radii.length, 20);
  assert.ok(radii.every((r) => Math.abs(r - 39) < .001), "All wheel labels share one radius");
  await page.screenshot({ path: output + "/wheel-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await wheel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: output + "/wheel-mobile.png" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "Mobile page overflow");
  console.log("Home cards, notification portal, mobile overflow passed.");
} finally {
  await browser.close();
}
