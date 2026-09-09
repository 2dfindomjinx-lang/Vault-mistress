import assert from "node:assert/strict";
import { registerHooks, createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const sourceRoot = path.resolve(import.meta.dirname, "../src");
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      return next(pathToFileURL(path.join(sourceRoot, specifier.slice(2)) + ".ts").href, context);
    }
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const url = new URL(specifier, context.parentURL);
      if (!path.extname(url.pathname) && existsSync(fileURLToPath(url) + ".ts")) return next(url.href + ".ts", context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith("file:") && url.endsWith(".ts")) {
      return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"),
        { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText };
    }
    return next(url, context);
  },
});
const { COMMUNITY_GOALS, getCurrentCommunityGoal } = await import("../src/lib/prestige.ts");
const goal = COMMUNITY_GOALS.at(-1);
assert.equal(goal.targetCoins, 2_000_000);
assert.equal(new Date(goal.endsAt) - new Date(goal.startsAt), 90 * 86400000);
assert.equal(goal.rewardCrateType, "couture_case");
assert.equal(goal.rewardFreeOpens, 3);
assert.equal(goal.rewardBadgeId, undefined);
assert.equal(getCurrentCommunityGoal(new Date(goal.startsAt).getTime()).id, goal.id);
assert.equal(getCurrentCommunityGoal(Date.parse("2026-08-01")).id, "summer-community-goal-ii-2026");
const { chatCursor, parseChatCursor, mergeChatMessages } = await import("../src/lib/live-chat-pagination.ts");
const row = { id: "00000000-0000-0000-0000-000000000001", created_at: "2026-09-09T12:00:00.123456+00:00" };
assert.deepEqual(parseChatCursor(chatCursor(row)), row);
for (const value of ["bad", chatCursor(row) + "|extra", chatCursor(row).replace("000001", "x),id.gt.1")]) assert.equal(parseChatCursor(value), null);
const later = { ...row, id: "00000000-0000-0000-0000-000000000002" };
assert.deepEqual(mergeChatMessages([later, row], [{ ...row, is_deleted: true }]), [{ ...row, is_deleted: true }, later]);
console.log("Rules: 90-day goal, 2m target, exactly 3 Couture keys, old goal preserved; chat cursor precision, validation, stable merge passed.");
