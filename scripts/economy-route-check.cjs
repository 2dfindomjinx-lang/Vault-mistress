// Audit harness: actual route code, in-memory database. No network or credentials.
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const assert = require("node:assert/strict");
const state = {
  profiles: [
    {
      id: "audit-user",
      coins: 1000,
      affection: 0,
      tribute_total: 0,
      loyalty_streak: 0,
      last_loyalty_at: null,
    },
  ],
  user_tasks: [],
  coin_transactions: [],
  user_gallery: [],
  user_pet_gallery: [],
};
const clone = (x) => JSON.parse(JSON.stringify(x));
const db = {
  async rpc(name, args) {
    if (name !== "commit_economy_action") throw Error("Unexpected RPC " + name);
    Object.assign(state.profiles[0], args.p_profile_patch);
    if (args.p_task_patch) {
      const old = state.user_tasks.find((x) => x.task_id === args.p_task_id);
      if (old) Object.assign(old, args.p_task_patch);
      else
        state.user_tasks.push({ ...args.p_task_patch, user_id: "audit-user" });
    }
    return {
      data: {
        task: args.p_task_patch,
        rewardCoins: args.p_profile_patch.coins - args.p_expected_profile.coins,
      },
      error: null,
    };
  },
  from(table) {
    let operation = "read",
      payload,
      filters = [],
      collection = false;
    const q = {
      select() {
        return q;
      },
      in(k, values) {
        collection = true;
        filters.push((r) => values.includes(r[k]));
        return q;
      },
      eq(k, v) {
        filters.push((r) => r[k] === v);
        return q;
      },
      upsert(p) {
        operation = "upsert";
        payload = p;
        return q;
      },
      update(p) {
        operation = "update";
        payload = p;
        return q;
      },
      insert(p) {
        operation = "insert";
        payload = p;
        return q;
      },
      single() {
        return q;
      },
      maybeSingle() {
        return q;
      },
      then(resolve, reject) {
        return Promise.resolve()
          .then(() => {
            const rows = state[table];
            if (!rows) throw Error("Unexpected table " + table);
            let row = rows.find((r) => filters.every((f) => f(r)));
            if (operation === "upsert") {
              row = rows.find(
                (r) =>
                  r.user_id === payload.user_id &&
                  r.task_id === payload.task_id,
              );
              if (row) Object.assign(row, payload);
              else {
                row = clone(payload);
                rows.push(row);
              }
            }
            if (operation === "update" && row) Object.assign(row, payload);
            if (operation === "insert") {
              row = { id: "audit-tx-" + rows.length, ...clone(payload) };
              rows.push(row);
            }
            return {
              data: collection
                ? clone(rows.filter((r) => filters.every((f) => f(r))))
                : row
                  ? clone(row)
                  : null,
              error: null,
            };
          })
          .then(resolve, reject);
      },
    };
    return q;
  },
};
const cache = {};
const mocks = {
  "@/lib/supabase/admin": {
    createSupabaseAdminClient: () => db,
    isSupabaseAdminConfigured: true,
    getSupabaseAdminConfigErrors: () => [],
  },
  "@/lib/supabase/server": {
    createClient: async () => ({
      auth: {
        getUser: async () => ({
          data: { user: { id: "audit-user" } },
          error: null,
        }),
      },
    }),
  },
  "@/lib/devotion": {
    awardDevotion: async () => {},
    DEVOTION_REWARD_BASIC_TASK: 1,
  },
  "@/lib/server-task-actions": {
    getActiveEventMultipliers: async () => ({}),
    CASE_OPEN_REWARD_WEIGHTS: [],
  },
  "@/lib/cosmetics": { cosmeticItems: [], titleItems: [] },
  "@/lib/rate-limit": { checkRateLimit: async () => ({ allowed: true }) },
  "@/lib/irl-task-wheel": { IRL_TASK_WHEEL_COST: 0 },
};
function load(file) {
  const full = path.resolve(file);
  if (cache[full]) return cache[full].exports;
  const m = { exports: {} };
  cache[full] = m;
  const source = ts.transpileModule(fs.readFileSync(full, "utf8"), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", source)(
    (id) => {
      if (mocks[id]) return mocks[id];
      if (id.startsWith("@/")) return load("src/" + id.slice(2) + ".ts");
      return require(id);
    },
    m,
    m.exports,
  );
  return m.exports;
}
async function call(handler, body) {
  const r = await handler(
    new Request("http://audit.invalid", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return { status: r.status, body: await r.json() };
}
(async () => {
  const challenges = load("src/lib/court-game-challenges.ts");
  const clock = load("src/lib/gamble-clock.ts");
  assert.equal(
    clock.estimateGambleClock(0, 2400, 100000, 102200),
    102300,
    "Database time must not be mistaken for network latency",
  );
  assert.equal(clock.estimateGambleClock(0, 200, 100000, 100000), 100100);
  const c = challenges.createCourtChallenge(12);
  let ms = 0;
  const says = c.says.map((r) => ({
    action:
      !r.shouldObey || r.action === "still"
        ? "wait"
        : r.action === "type"
          ? "type:" + r.expectedText
          : r.action,
    atMs: (ms += r.timeMs + 550),
  }));
  assert.equal(
    challenges.verifyCourtActions("principessa-says", 12, says, ms).score,
    8,
  );
  assert.equal(
    challenges.verifyCourtActions(
      "principessa-says",
      12,
      says.map((x) => ({ ...x, atMs: 0 })),
      ms,
    ),
    null,
  );
  let crownTime = 0;
  const pairs = [];
  const seen = new Set();
  for (const card of c.cards) {
    if (seen.has(card.symbol)) continue;
    seen.add(card.symbol);
    for (const match of c.cards.filter((x) => x.symbol === card.symbol))
      pairs.push({ action: String(match.id), atMs: (crownTime += 500) });
  }
  assert.equal(
    challenges.verifyCourtActions("crown-match", 12, pairs, crownTime).score,
    6,
  );
  assert.equal(
    challenges.verifyCourtActions(
      "crown-match",
      12,
      [...pairs, ...pairs],
      crownTime,
    ),
    null,
  );
  const wrongPair = [
    c.cards[0].id,
    c.cards.find((card) => card.symbol !== c.cards[0].symbol).id,
  ];
  function crownWithMistakes(count) {
    const actions = [
      ...Array.from({ length: count }, () => wrongPair).flat(),
      ...pairs.map((action) => Number(action.action)),
    ];
    return actions.map((id, index) => ({
      action: String(id),
      atMs: (index + 1) * 500,
    }));
  }
  assert.equal(
    challenges.verifyCourtActions(
      "crown-match",
      12,
      crownWithMistakes(4),
      20000,
    ).score,
    6,
  );
  assert.equal(
    challenges.verifyCourtActions(
      "crown-match",
      12,
      crownWithMistakes(5),
      20000,
    ),
    null,
  );
  let guardTime = 0;
  const guard = c.targets.map((target, i) => ({
    action: target.threat ? "hit" : "wait",
    atMs: (guardTime += challenges.guardWaveDuration(i) + 500),
  }));
  assert.equal(
    challenges.verifyCourtActions("royal-guard", 12, guard, guardTime).score,
    18,
  );
  assert.equal(
    challenges.verifyCourtActions("royal-guard", 12, undefined, guardTime),
    null,
  );
  const court = load("src/app/api/user/court-games/route.ts");
  const startAttempt = await call(court.POST, {
    action: "start",
    gameId: "crown-match",
  });
  assert.equal(startAttempt.status, 200);
  const failedAttempt = await call(court.POST, {
    action: "fail",
    gameId: "crown-match",
    sessionId: startAttempt.body.sessionId,
  });
  assert.equal(failedAttempt.body.cooldownUntil, null);
  const afterFail = await (await court.GET()).json();
  assert.ok(
    afterFail.games.find((game) => game.gameId === "crown-match").reward > 0,
    "Reload after failure must still advertise the normal reward",
  );
  const retryAttempt = await call(court.POST, {
    action: "start",
    gameId: "crown-match",
  });
  assert.equal(retryAttempt.status, 200);
  assert.notEqual(retryAttempt.body.sessionId, startAttempt.body.sessionId);
  assert.equal(
    (
      await call(court.POST, {
        action: "fail",
        gameId: "crown-match",
        sessionId: startAttempt.body.sessionId,
      })
    ).status,
    409,
    "A late failure cannot close the new attempt",
  );
  const retryRow = state.user_tasks.find(
    (row) => row.task_id === "crown-match",
  );
  retryRow.metadata.sessionStartedAt = new Date(
    Date.now() - 40 * 60000,
  ).toISOString();
  assert.equal(
    (await call(court.POST, { action: "start", gameId: "crown-match" })).status,
    200,
    "An expired attempt can be retried",
  );
  retryRow.claimed_at = retryRow.completed_at = new Date().toISOString();
  assert.equal(
    (await call(court.POST, { action: "start", gameId: "crown-match" })).status,
    429,
    "Claimed daily reward still blocks replay for Coins",
  );
  assert.equal(state.profiles[0].coins, 1000);
  const tasks = load("src/app/api/user/tasks/route.ts");
  const claims = load("src/app/api/user/task-claim/route.ts");
  for (const game of [
    "crown-match",
    "principessa-says",
    "royal-guard",
    "number-pick",
    "timeout-risk",
  ]) {
    for (let i = 0; i < 3; i++) {
      assert.equal(
        (
          await call(tasks.POST, {
            task: {
              task_id: game,
              completed_at: new Date().toISOString(),
              claimed_at: null,
              reward_coins: 100,
              metadata: {},
            },
          })
        ).status,
        409,
      );
      assert.equal((await call(claims.POST, { taskId: game })).status, 409);
    }
  }
  assert.equal(state.profiles[0].coins, 1000);
  const profile = load("src/app/api/user/profile-progress/route.ts");
  for (const reward of [
    "reward:task:crown-match",
    "task:timeout-risk",
    "streak_bonus",
  ])
    assert.equal((await call(profile.POST, { reason: reward })).status, 409);
  const tribute = await call(profile.POST, {
    reason: "tribute:coin-offer",
    metadata: { spendAmount: 250, affectionGain: 100 },
  });
  assert.equal(tribute.status, 200);
  assert.equal(state.profiles[0].affection, 1);
  assert.equal(state.profiles[0].coins, 750);
  const login = await call(claims.POST, { taskId: "daily-login" });
  assert.equal(login.status, 200);
  assert.equal(state.profiles[0].coins, 900);
  assert.equal(
    (await call(claims.POST, { taskId: "daily-login" })).status,
    422,
  );
  assert.equal(state.profiles[0].coins, 900);
  assert.equal((await call(claims.POST, { taskId: "affection" })).status, 422);
  const gallery = load("src/app/api/gallery/[...path]/route.ts");
  const imageContext = { params: Promise.resolve({ path: ["secret-1.webp"] }) };
  assert.equal(
    (await gallery.GET(new Request("http://audit.invalid"), imageContext))
      .status,
    403,
  );
  state.user_gallery.push({
    user_id: "audit-user",
    item_id: "secret-defnes-final-favor",
  });
  const granted = await gallery.GET(
    new Request("http://audit.invalid"),
    imageContext,
  );
  assert.equal(granted.status, 200);
  assert.equal(granted.headers.get("Cache-Control"), "private, no-store");
  assert.ok((await granted.arrayBuffer()).byteLength > 0);
  mocks["@/lib/supabase/server"].createClient = async () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  });
  assert.equal(
    (await gallery.GET(new Request("http://audit.invalid"), imageContext))
      .status,
    401,
  );
  assert.equal(
    (
      await gallery.GET(new Request("http://audit.invalid"), {
        params: Promise.resolve({ path: ["..", "secret-1.webp"] }),
      })
    ).status,
    404,
  );
  console.log(
    "Gallery passed: locked 403, owner image 200/no-store, signed-out 401, invalid path 404.",
  );
  console.log(
    "Route regressions passed: dedicated games cannot sync/claim/reward indirectly; affection is server-derived; login pays once; affection gate enforced.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
