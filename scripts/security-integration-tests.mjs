import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const baseUrl = process.env.SECURITY_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const failures = [];

const sensitiveFieldPattern =
  /"(email|is_admin|service_role|SUPABASE_SERVICE_ROLE_KEY|hide_from_leaderboard|timeout_reason)"\s*:/i;

const publicGetRoutes = [
  "/api/events/active",
  "/api/global-principessa",
  "/api/jackpot",
  "/api/leadership/top",
  "/api/shame/top",
  "/api/recent-tributes",
];

const adminRoutes = [
  { method: "GET", path: "/api/admin/session" },
  { method: "GET", path: "/api/admin/analytics" },
  { method: "POST", path: "/api/admin/give", body: { command: "coins", amount: 1, username: "test" } },
  { method: "POST", path: "/api/admin/events", body: { action: "list" } },
  { method: "POST", path: "/api/admin/debt-contracts", body: { action: "list" } },
  { method: "POST", path: "/api/events/roll", body: {} },
  { method: "POST", path: "/api/jackpot/advance", body: {} },
  { method: "GET", path: "/api/admin/mobile/pending-actions" },
  { method: "POST", path: "/api/admin/mobile/pending-actions", body: { id: "00000000-0000-0000-0000-000000000000", decision: "approve" } },
];

const protectedUserRoutes = [
  { method: "POST", path: "/api/user/debt-contracts", body: { action: "pay", contractId: "00000000-0000-0000-0000-000000000000" } },
  { method: "POST", path: "/api/user/profile-bootstrap", body: { username: "test_user" } },
  { method: "POST", path: "/api/user/timeout", body: { timeoutUntil: null } },
  // Generic task sync must not accept client-controlled claim/reward state for cooldown tasks (prevents backdating to farm)
  { method: "POST", path: "/api/user/tasks", body: { task: { task_id: "daily-login", claimed_at: "2020-01-01T00:00:00.000Z", reward_coins: 9999 } } },
  { method: "POST", path: "/api/user/tasks", body: { task: { task_id: "beg", claimed_at: "2020-01-01T00:00:00.000Z", reward_coins: 500, metadata: { lastBegAt: "2020-01-01T00:00:00.000Z" } } } },
  { method: "POST", path: "/api/user/tasks", body: { task: { task_id: "timeout-risk", reward_coins: 999, metadata: { resetAt: "2020-01-01T00:00:00.000Z" } } } },
  // profile-progress must not trust client coins/deltas for any reason (prevents direct coin farming via beg/timeout-risk etc.)
  { method: "POST", path: "/api/user/profile-progress", body: { reason: "beg", nextProfile: { coins: 999999, affection: 50 }, metadata: {} } },
  { method: "POST", path: "/api/user/profile-progress", body: { reason: "task:timeout-risk", nextProfile: { coins: 999999, affection: 50 }, metadata: { lastResult: "safe" } } },
  // Unknown reasons must be rejected with 422, never apply any client-provided deltas
  { method: "POST", path: "/api/user/profile-progress", body: { reason: "weird-unknown-reason-xyz", nextProfile: { coins: 123456, affection: 99, tribute_total: 99999 } } },
  { method: "POST", path: "/api/user/profile-progress", body: { reason: "", nextProfile: { coins: 999, affection: 50 } } },
];

async function isServerAvailable() {
  try {
    const response = await fetch(`${baseUrl}/api/events/active`, {
      method: "GET",
      signal: AbortSignal.timeout(4000),
    });

    return response.status >= 200 && response.status < 600;
  } catch {
    return false;
  }
}

function collectJsonStrings(value, bucket = []) {
  if (value == null) {
    return bucket;
  }

  if (typeof value === "string") {
    bucket.push(value);
    return bucket;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectJsonStrings(entry, bucket);
    }

    return bucket;
  }

  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      bucket.push(String(key));
      collectJsonStrings(entry, bucket);
    }
  }

  return bucket;
}

function assertNoSensitiveFields(label, payload) {
  const serialized = JSON.stringify(payload);

  if (sensitiveFieldPattern.test(serialized)) {
    failures.push(`${label} returned sensitive fields in JSON body.`);
  }

  const flattened = collectJsonStrings(payload).join(" ");

  if (/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(flattened)) {
    failures.push(`${label} appears to expose an email address.`);
  }
}

async function requestRoute(route) {
  const init = {
    method: route.method,
    headers: {
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(8000),
  };

  if (route.body !== undefined) {
    init.body = JSON.stringify(route.body);
  }

  return fetch(`${baseUrl}${route.path}`, init);
}

async function runHttpTests() {
  if (!(await isServerAvailable())) {
    console.log(`Skipping HTTP integration tests: ${baseUrl} is not reachable.`);
    console.log("Start the app with `npm run start` and rerun `npm run test:security:http`.");
    return;
  }

  for (const route of adminRoutes) {
    const response = await requestRoute(route);

    if (response.status !== 401 && response.status !== 403) {
      failures.push(
        `${route.method} ${route.path} without auth expected 401/403, got ${response.status}.`,
      );
    }
  }

  for (const route of protectedUserRoutes) {
    const response = await requestRoute(route);

    if (response.status !== 401 && response.status !== 403) {
      failures.push(
        `${route.method} ${route.path} without auth expected 401/403, got ${response.status}.`,
      );
    }
  }

  for (const path of publicGetRoutes) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 401 || response.status === 403) {
      failures.push(`GET ${path} should be public-readable, got ${response.status}.`);
      continue;
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      continue;
    }

    const payload = await response.json();
    assertNoSensitiveFields(`GET ${path}`, payload);
  }

  for (const path of publicGetRoutes) {
    const postResponse = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(8000),
    });

    if (postResponse.status !== 405 && postResponse.status !== 401 && postResponse.status !== 403) {
      failures.push(`POST ${path} should not accept public writes (expected 405), got ${postResponse.status}.`);
    }
  }
}

function runStaticPublicRouteChecks() {
  const publicRouteFiles = [
    "src/app/api/events/active/route.ts",
    "src/app/api/global-principessa/route.ts",
    "src/app/api/jackpot/route.ts",
    "src/app/api/leadership/top/route.ts",
    "src/app/api/shame/top/route.ts",
    "src/app/api/recent-tributes/route.ts",
  ];

  for (const file of publicRouteFiles) {
    const source = readFileSync(join(root, file), "utf8");
    const exportedGet = source.match(/export\s+async\s+function\s+GET[\s\S]*?(?=export\s+async\s+function|$)/)?.[0] ?? "";

    if (exportedGet.includes("createSupabaseAdminClient")) {
      failures.push(`${file} public GET still uses createSupabaseAdminClient.`);
    }

    for (const forbidden of [".insert(", ".update(", ".delete(", ".upsert("]) {
      if (exportedGet.includes(forbidden)) {
        failures.push(`${file} public GET still contains ${forbidden}`);
      }
    }

    if (file !== "src/app/api/jackpot/route.ts" && !source.includes("createPublicSupabaseClient") && !source.includes("createSupabaseServerClient")) {
      failures.push(`${file} should use the public or server anon Supabase client.`);
    }
  }

  const jackpotSource = readFileSync(join(root, "src/app/api/jackpot/route.ts"), "utf8");
  const jackpotGetBody = jackpotSource.match(/export\s+async\s+function\s+GET\(\)[\s\S]*?export\s+async\s+function\s+POST/)?.[0] ?? "";

  if (jackpotGetBody.includes("createSupabaseAdminClient")) {
    failures.push("src/app/api/jackpot/route.ts public GET still uses createSupabaseAdminClient.");
  }

  if (!jackpotGetBody.includes("createSupabaseServerClient")) {
    failures.push("src/app/api/jackpot/route.ts public GET should use the server anon client.");
  }
}

await runHttpTests();
runStaticPublicRouteChecks();

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Security integration checks passed.");
