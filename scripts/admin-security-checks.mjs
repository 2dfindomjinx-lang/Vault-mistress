import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const filesToCheck = [
  "src/lib/admin-guard.ts",
  "src/lib/mobile-admin.ts",
  "src/app/api/admin/give/route.ts",
  "src/app/api/admin/irl-tasks/route.ts",
  "src/app/api/admin/max-affection/route.ts",
  "src/app/api/admin/pet-tasks/route.ts",
  "src/app/api/admin/timeouts/route.ts",
];

const forbiddenPatterns = [
  /isTrustedAdminUsername/,
  /ADMIN_USERNAMES/,
  /getTrustedAdminUsernames/,
  /\.select\(["']username,\s*is_admin["']\)/,
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

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Admin security checks passed.");
