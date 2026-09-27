import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";

// Exercise the actual panel in a browser, with no production server or credentials.
const bundle = await build({
  stdin: { contents: 'import React from "react"; import { createRoot } from "react-dom/client"; import Panel from "./src/components/LockTransfersPanel"; createRoot(document.getElementById("root")).render(<Panel />);', loader: "tsx", resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "iife", define: { "process.env.NODE_ENV": '"production"' },
});
const browser = await chromium.launch({ headless: true, channel: process.env.LOCK_TEST_BROWSER_CHANNEL || undefined });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  const now = Date.now();
  const transfer = {
    id: "transfer-1", status: "pending", source_sub_id: "sub-1", source_device_id: "device-1", target_sub_id: "sub-2", target_device_id: "device-2",
    source_username: "Source user", source_device_name: "Source device", target_username: "Target user", target_device_name: "Target device",
    created_at: new Date(now).toISOString(), requested_at: new Date(now).toISOString(), expires_at: new Date(now + 3600_000).toISOString(), decided_at: null,
  };
  let failHistory = false;
  let failMutation = false;
  const writes = [];
  await page.route("http://vault.test/**", async (route) => {
    if (!route.request().url().includes("/api/admin/lock-transfers")) {
      return route.fulfill({ contentType: "text/html", body: '<!doctype html><html><body><div id="root"></div></body></html>' });
    }
    const fulfill = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (route.request().method() === "GET") {
      if (failHistory) return fulfill({ error: "Lock unavailable" }, 502);
      return fulfill({ ok: true, transfers: [transfer], events: [{ id: "event-1", transfer_id: transfer.id, event_type: "requested", actor: "sub", created_at: transfer.created_at }], eligibleSources: [{ id: "device-1", sub_id: "sub-1", username: "Source user", device_name: "Source device" }] });
    }
    const body = route.request().postDataJSON(); writes.push(body);
    if (failMutation) return fulfill({ error: "Transfer state changed. Refresh." }, 409);
    if (body.action === "issue") return fulfill({ ok: true, code: "PRIVATE-CODE", expiresAt: transfer.expires_at });
    transfer.status = body.action === "approve" ? "approved" : "rejected";
    transfer.decided_at = new Date().toISOString();
    return fulfill({ ok: true });
  });
  await page.goto("http://vault.test/admin/lock-transfers");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.getByRole("button", { name: "Approve", exact: true }).waitFor();
  await page.locator("#lock-source").selectOption("device-1");
  await page.getByRole("button", { name: "Create Code", exact: true }).click();
  await page.getByText("PRIVATE-CODE", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  await page.getByRole("button", { name: "Hide Code", exact: true }).click();
  assert.equal(await page.getByText("PRIVATE-CODE", { exact: true }).count(), 0);
  failMutation = true;
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByText("Transfer state changed. Refresh.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Approve", exact: true }).isDisabled(), true);
  failMutation = false; failHistory = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByText("Lock unavailable", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Create Code", exact: true }).isDisabled(), true);
  failHistory = false;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByText("approved", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Approve", exact: true }).count(), 0);
  transfer.status = "pending"; transfer.decided_at = null;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByText("rejected", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Reject", exact: true }).count(), 0);
  assert.deepEqual(writes.map((body) => body.action), ["issue", "approve", "approve", "reject"]);
  assert.deepEqual(errors, []);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.getByText("Lock audit events", { exact: true }).isVisible());
  console.log("PASS: real panel issue/hide, no browser storage, conflict gating, failed refresh, approval/rejection, mobile content, no runtime errors (mocked Lock API).");
} finally {
  await browser.close();
}
