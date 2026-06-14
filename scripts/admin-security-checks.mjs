import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const filesToCheck = [
  "src/lib/admin-guard.ts",
  "src/lib/mobile-admin.ts",
  "src/app/api/admin/analytics/route.ts",
  "src/app/api/admin/debt-contracts/route.ts",
  "src/app/api/admin/events/route.ts",
  "src/app/api/admin/give/route.ts",
  "src/app/api/admin/irl-tasks/route.ts",
  "src/app/api/admin/max-affection/route.ts",
  "src/app/api/admin/notifications/route.ts",
  "src/app/api/admin/pet-tasks/route.ts",
  "src/app/api/admin/session/route.ts",
  "src/app/api/admin/timeouts/route.ts",
];

const forbiddenPatterns = [
  /isTrustedAdminUsername/,
  /ADMIN_USERNAMES/,
  /getTrustedAdminUsernames/,
  /\.select\(["']username,\s*is_admin["']\)/,
  /profile\.username.*Admin access/,
  /is_admin.*Admin access/,
];

const failures = [];

for (const file of filesToCheck) {
  const source = readFileSync(join(root, file), "utf8");

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(source)) {
      failures.push(`${file} still matches ${pattern}`);
    }
  }
}

const identitySource = readFileSync(join(root, "src/lib/admin-identity.ts"), "utf8");

if (!identitySource.includes("ADMIN_USER_IDS")) {
  failures.push("src/lib/admin-identity.ts does not use ADMIN_USER_IDS.");
}

if (identitySource.includes("DEFAULT_TRUSTED_ADMIN_USERNAMES")) {
  failures.push("src/lib/admin-identity.ts still has a username fallback.");
}

const adminGuardSource = readFileSync(join(root, "src/lib/admin-guard.ts"), "utf8");

if (!adminGuardSource.includes("isTrustedAdminUserId(data.user.id)")) {
  failures.push("src/lib/admin-guard.ts must authorize with auth user UUID.");
}

for (const file of filesToCheck.filter((file) => file.includes("/api/admin/"))) {
  const source = readFileSync(join(root, file), "utf8");

  if (!source.includes("requireAdmin") && !source.includes("requireMobileAdmin")) {
    failures.push(`${file} does not use the shared admin guard.`);
  }
}

const publicReadOnlyChecks = [
  "src/app/api/events/active/route.ts",
  "src/app/api/global-principessa/route.ts",
  "src/app/api/leadership/top/route.ts",
  "src/app/api/shame/top/route.ts",
  "src/app/api/recent-tributes/route.ts",
];

for (const file of publicReadOnlyChecks) {
  const source = readFileSync(join(root, file), "utf8");
  const exportedGet = source.match(/export\s+async\s+function\s+GET[\s\S]*?(?=export\s+async\s+function|$)/)?.[0] ?? source;

  if (exportedGet.includes("createSupabaseAdminClient")) {
    failures.push(`${file} public GET still uses createSupabaseAdminClient.`);
  }

  if (!source.includes("createPublicSupabaseClient")) {
    failures.push(`${file} should use createPublicSupabaseClient.`);
  }

  for (const forbidden of [".insert(", ".update(", ".delete(", ".upsert("]) {
    if (exportedGet.includes(forbidden)) {
      failures.push(`${file} public GET still contains ${forbidden}`);
    }
  }
}

const jackpotSource = readFileSync(join(root, "src/app/api/jackpot/route.ts"), "utf8");
const jackpotGetBody = jackpotSource.match(/export\s+async\s+function\s+GET\(\)[\s\S]*?export\s+async\s+function\s+POST/)?.[0] ?? "";

for (const forbidden of ["ensureCurrentJackpot(", "maybeSelectWinner(", ".insert(", ".update(", ".delete(", ".upsert(", "createSupabaseAdminClient"]) {
  if (jackpotGetBody.includes(forbidden)) {
    failures.push(`src/app/api/jackpot/route.ts public GET still contains ${forbidden}`);
  }
}

if (!jackpotGetBody.includes("createSupabaseServerClient")) {
  failures.push("src/app/api/jackpot/route.ts public GET should use the server anon client.");
}

const analyticsSource = readFileSync(join(root, "src/app/api/admin/analytics/route.ts"), "utf8");

if (/email\s*:/.test(analyticsSource) || /\.select\([^)]*email/.test(analyticsSource) || /profile\.email/.test(analyticsSource)) {
  failures.push("Admin analytics route still exposes profile email.");
}

const analyticsPageSource = readFileSync(join(root, "src/app/admin/analytics/page.tsx"), "utf8");

if (/user\.email|Search username or email/.test(analyticsPageSource)) {
  failures.push("Admin analytics UI still displays or searches email.");
}

const explicitSelectChecks = [
  "src/app/api/user/debt-contracts/route.ts",
  "src/app/page.tsx",
];

for (const file of explicitSelectChecks) {
  const source = readFileSync(join(root, file), "utf8");

  if (/\.select\(\s*["']\*["']\s*\)/.test(source)) {
    failures.push(`${file} still uses select("*").`);
  }
}

// Prevent email from leaking into any client-side profile selects or constants
const clientEmailPattern = /email/i;
const clientProfileSelectFiles = [
  "src/app/page.tsx",
  "src/lib/supabase/client.ts",
];

for (const file of clientProfileSelectFiles) {
  const source = readFileSync(join(root, file), "utf8");
  // Look for profile select strings or type definitions that mention email in client context
  if (clientEmailPattern.test(source) && (source.includes("profileSelect") || source.includes("Profile"))) {
    // Allow only if it's inside a comment explaining it's excluded
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("email") && /profileSelect|type Profile|interface Profile/.test(source.substring(Math.max(0, source.lastIndexOf('\n', source.indexOf(line))), source.indexOf(line) + 200))) {
        if (!/intentionally not populated|must never be returned|admin-only/i.test(line + (lines[i+1] || "") + (lines[i+2] || ""))) {
          failures.push(`${file} still references email in client profile select/type without a clear exclusion comment.`);
        }
      }
    }
  }
}

const profileBootstrapSource = readFileSync(join(root, "src/app/api/user/profile-bootstrap/route.ts"), "utf8");

if (/email\s*:/.test(profileBootstrapSource)) {
  failures.push("Profile bootstrap still copies email into profiles.");
}

const eventsRollSource = readFileSync(join(root, "src/app/api/events/roll/route.ts"), "utf8");

if (!eventsRollSource.includes("requireAdmin") && !eventsRollSource.includes("CRON_SECRET")) {
  failures.push("Events roll route is not protected by admin guard or CRON_SECRET.");
}

// Generic task sync must not blindly trust client for claimed_at / reward_coins on reward-bearing/cooldown tasks.
// This is the main vector for backdating daily-login, beg, streaks, etc. to farm rewards.
const genericTasksSource = readFileSync(join(root, "src/app/api/user/tasks/route.ts"), "utf8");

if (genericTasksSource.includes('claimed_at: task.claimed_at') || genericTasksSource.includes('reward_coins: rewardCoins')) {
  // Old blind write pattern
  failures.push("src/app/api/user/tasks/route.ts still writes client-provided claimed_at or reward_coins without sanitization/rejection for reward tasks.");
}

if (!genericTasksSource.includes("REWARD_COOLDOWN_TASKS") || !genericTasksSource.includes("daily-login") || !genericTasksSource.includes("This task must use its dedicated")) {
  failures.push("src/app/api/user/tasks/route.ts must have strict REWARD_COOLDOWN_TASKS protection and reject claimed/reward for daily-login and similar tasks.");
}

// profile-progress must not trust client nextProfile.coins / deltas for reward mechanics
// and must reject unknown reasons immediately without any legacy client-derived fallback.
const profileProgressSource = readFileSync(join(root, "src/app/api/user/profile-progress/route.ts"), "utf8");

if (profileProgressSource.includes("fallbackNext") || profileProgressSource.includes("Unknown or legacy - fall back")) {
  failures.push("src/app/api/user/profile-progress/route.ts still contains legacy fallbackNext construction from client values.");
}

if (profileProgressSource.includes("validateTransition")) {
  failures.push("src/app/api/user/profile-progress/route.ts still references the legacy validateTransition (should be removed for unknown reasons).");
}

if (!profileProgressSource.includes("Unsupported profile mutation reason") || !profileProgressSource.includes("return jsonError(`Unsupported")) {
  failures.push("src/app/api/user/profile-progress/route.ts must explicitly reject unknown reasons with 422 immediately.");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Admin security checks passed.");
