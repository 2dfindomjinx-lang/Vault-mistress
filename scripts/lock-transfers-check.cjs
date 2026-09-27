// Real Vault route with isolated auth/fetch doubles. No credentials or external writes.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function harness() {
  const calls = [];
  const state = {
    auth: { adminUser: { id: "admin-1" } },
    session: { access_token: "vault-private-token", user: { id: "admin-1" } },
    guardCalls: 0,
    response: null,
    throws: false,
    bridgeToken: "lock-private-token",
    history: {
      ok: true,
      transfers: [{ id: "transfer-1", status: "pending", source_sub_id: "sub-1", source_device_id: "device-1", target_sub_id: "sub-2", target_device_id: "device-2", created_at: "2026-09-28T10:00:00Z", expires_at: "2026-09-29T10:00:00Z", requested_at: "2026-09-28T10:01:00Z", decided_at: null, source_username: "Source", source_device_name: "Old device", target_username: "Target", target_device_name: "New device", code: "history-secret", code_hash: "hash-secret" }],
      events: [{ id: "event-1", transfer_id: "transfer-1", event_type: "requested", actor: "sub", created_at: "2026-09-28T10:01:00Z", token: "event-secret" }],
      eligibleSources: [{ id: "device-1", sub_id: "sub-1", device_name: "Old device", username: "Source", refreshToken: "source-secret" }],
      session: { accessToken: "never-forward" },
    },
  };
  const env = { PRINCIPESSA_LOCK_BASE_URL: "https://lock.example", NODE_ENV: "production" };
  const mocks = {
    "server-only": {},
    "@/lib/admin-guard": { requireAdminProfile: async () => { state.guardCalls++; return state.auth; } },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getSession: async () => ({ data: { session: state.session }, error: null }) } }) },
  };
  const mockFetch = async (url, init) => {
    calls.push({ url, ...init });
    assert.equal(init.cache, "no-store");
    assert.equal(init.redirect, "error");
    assert.ok(init.signal instanceof AbortSignal);
    if (state.throws) throw Error("private upstream exception");
    if (url.endsWith("/vault-bridge")) return Response.json({ ok: true, session: { accessToken: state.bridgeToken, refreshToken: "discard-me", expiresAt: Math.floor(Date.now() / 1000) + 3600 } });
    if (state.response) return state.response();
    if (init.method === "GET") return Response.json(state.history);
    if (url.endsWith("/access-transfers")) return Response.json({ ok: true, code: "PRIVATE-ONE-TIME", expiresAt: "2026-09-29T10:00:00Z", accessToken: "never-forward" });
    return Response.json({ ok: true, code: "never-forward", token: "never-forward" });
  };
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} };
    cache.set(file, loaded);
    const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("require", "module", "exports", "fetch", "process", compiled)(
      (id) => mocks[id] ?? (id.startsWith("@/") ? load("src/" + id.slice(2) + ".ts") : require(id)),
      loaded, loaded.exports, mockFetch, { env },
    );
    return loaded.exports;
  }
  const route = load("src/app/api/admin/lock-transfers/route.ts");
  const get = () => route.GET(new Request("https://vault.example/api/admin/lock-transfers"));
  const post = (body, headers = {}, raw) => route.POST(new Request("https://vault.example/api/admin/lock-transfers", {
    method: "POST", headers: { Origin: "https://vault.example", "Content-Type": "application/json", ...headers }, body: raw ?? JSON.stringify(body),
  }));
  return { state, calls, env, get, post };
}

test("unauthenticated and non-admin reads/writes never reach Lock", async () => {
  for (const status of [401, 403]) {
    const h = harness(); h.state.auth = { error: "private auth details", status };
    for (const res of [await h.get(), await h.post({ action: "approve", transferId: "t-1" })]) {
      assert.equal(res.status, status); assert.deepEqual(await res.json(), { error: "Admin access required." });
      assert.match(res.headers.get("cache-control"), /no-store/);
    }
    assert.equal(h.calls.length, 0);
  }
});

test("history is allow-listed, bounded, name-preserving, and private", async () => {
  const h = harness();
  h.state.history.transfers = Array.from({ length: 105 }, (_, i) => ({ ...h.state.history.transfers[0], id: `transfer-${i}` }));
  h.state.history.events = Array.from({ length: 205 }, (_, i) => ({ ...h.state.history.events[0], id: `event-${i}` }));
  const res = await h.get(); assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  const text = await res.text(); assert.doesNotMatch(text, /secret|token|Token|code|never-forward|discard-me/);
  const body = JSON.parse(text);
  assert.equal(body.transfers.length, 100); assert.equal(body.events.length, 200);
  assert.equal(body.transfers[0].id, "transfer-0");
  assert.equal(body.transfers[0].source_username, "Source");
  assert.deepEqual(body.eligibleSources, [{ id: "device-1", sub_id: "sub-1", device_name: "Old device", username: "Source" }]);
  assert.deepEqual(JSON.parse(h.calls[0].body), { vaultAccessToken: "vault-private-token" });
  assert.equal(h.calls[1].headers.Authorization, "Bearer lock-private-token");
});

test("issuance returns only transient code/expiry and sends only source id", async () => {
  const h = harness();
  const res = await h.post({ action: "issue", sourceDeviceId: "device-1", adminToken: "attacker", target_sub_id: "ignored" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, code: "PRIVATE-ONE-TIME", expiresAt: "2026-09-29T10:00:00Z" });
  assert.deepEqual(JSON.parse(h.calls[1].body), { sourceDeviceId: "device-1" });
});

test("approve/reject use fixed Lock routes, no extra payload or secret response", async () => {
  const h = harness();
  for (const action of ["approve", "reject"]) {
    const res = await h.post({ action, transferId: "transfer-1", sourceDeviceId: "ignored" });
    assert.equal(res.status, 200); assert.deepEqual(await res.json(), { ok: true });
    assert.equal(h.calls.at(-1).url, `https://lock.example/api/admin/access-transfers/transfer-1/${action}`);
    assert.deepEqual(JSON.parse(h.calls.at(-1).body), {});
  }
  assert.equal(h.calls.filter((call) => call.url.endsWith("vault-bridge")).length, 1);
  assert.equal(h.state.guardCalls, 2);
});

test("CSRF, malformed bodies, unknown actions and path traversal are rejected before bridging", async () => {
  const h = harness();
  assert.equal((await h.post({}, { Origin: "https://evil.example" })).status, 403);
  assert.equal((await h.post({}, { Origin: "null" })).status, 403);
  assert.equal((await h.post({}, { Origin: "" })).status, 403);
  assert.equal((await h.post({}, { "Sec-Fetch-Site": "cross-site" })).status, 403);
  assert.equal((await h.post({}, { "Content-Type": "text/plain" })).status, 415);
  assert.equal((await h.post({}, {}, "{" )).status, 400);
  assert.equal((await h.post({}, {}, "a".repeat(2049))).status, 413);
  for (const body of [null, [], { action: "delete", transferId: "t-1" }, { action: "approve", transferId: "../vault-bridge" }, { action: "issue", sourceDeviceId: "" }, { action: "issue", sourceDeviceId: 123 }]) {
    assert.equal((await h.post(body)).status, 400);
  }
  assert.equal(h.calls.length, 0);
});

test("missing or unsafe server origin and mismatched Vault session fail closed", async () => {
  for (const origin of ["", "http://lock.example", "https://user:pass@lock.example", "https://lock.example/path", "https://lock.example/?token=x"]) {
    const h = harness(); h.env.PRINCIPESSA_LOCK_BASE_URL = origin;
    assert.equal((await h.get()).status, 503); assert.equal(h.calls.length, 0);
  }
  const h = harness(); h.state.session.user.id = "another-user";
  assert.equal((await h.get()).status, 401); assert.equal(h.calls.length, 0);
  h.state.session = null; assert.equal((await h.get()).status, 401);
});

test("upstream errors are sanitized and mutations are never automatically retried", async () => {
  for (const status of [400, 401, 403, 404, 409, 410, 429, 500]) {
    const h = harness(); h.state.response = () => Response.json({ error: "private-secret-token" }, { status });
    const res = await h.post({ action: "approve", transferId: "t-1" });
    assert.equal(res.status, status === 500 ? 502 : status);
    assert.doesNotMatch(await res.text(), /private-secret-token/); assert.equal(h.calls.length, 2);
  }
  const h = harness(); h.state.throws = true;
  const res = await h.post({ action: "issue", sourceDeviceId: "d-1" });
  assert.equal(res.status, 502); assert.doesNotMatch(await res.text(), /private upstream exception/);
  assert.equal(h.calls.length, 1);
});

test("cached bridge still checks admin each time and is bound to the Vault token", async () => {
  const h = harness(); await h.get(); await h.get();
  assert.equal(h.calls.length, 3); assert.equal(h.state.guardCalls, 2);
  h.state.session.access_token = "new-vault-token"; await h.get(); assert.equal(h.calls.length, 5);
  h.state.auth = { error: "revoked", status: 403 };
  assert.equal((await h.get()).status, 403); assert.equal(h.calls.length, 5);
});

test("malformed history and failed success payloads fail closed", async () => {
  const h = harness(); h.state.history.events[0].actor = { secret: "bad" };
  assert.equal((await h.get()).status, 502);
  h.state.response = () => Response.json({ ok: false, error: "secret" });
  const res = await h.post({ action: "reject", transferId: "t-1" });
  assert.equal(res.status, 502); assert.doesNotMatch(await res.text(), /secret/);
});

test("concurrent history requests share one bridge exchange", async () => {
  const h = harness();
  const responses = await Promise.all([h.get(), h.get(), h.get()]);
  assert.ok(responses.every((response) => response.status === 200));
  assert.equal(h.state.guardCalls, 3);
  assert.equal(h.calls.filter((call) => call.url.endsWith("/vault-bridge")).length, 1);
});

test("transfer screen is linked from both existing admin menus and the Lock entry address", () => {
  for (const file of ["src/app/admin/page.tsx", "src/app/admin/app-licenses/page.tsx", "src/app/admin/principessa-lock/page.tsx"]) {
    assert.match(fs.readFileSync(file, "utf8"), /href="\/admin\/lock-transfers"/);
  }
  for (const file of ["src/app/admin/lock-transfers/page.tsx", "src/app/admin/principessa-lock/page.tsx"]) {
    assert.match(fs.readFileSync(file, "utf8"), /await requireAdminProfile\(\)/);
  }
});
