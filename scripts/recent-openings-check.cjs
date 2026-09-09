// Real route regression, simulated Supabase. No network or credentials.
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  assert = require("node:assert/strict");
let rows = [],
  failure = false;
const db = {
  from(table) {
    assert.equal(table, "crate_opens");
    let filters = [],
      orders = [],
      limit = Infinity;
    const q = {
      select() {
        return q;
      },
      gte(k, v) {
        filters.push((r) => r[k] >= v);
        return q;
      },
      in(k, values) {
        filters.push((r) => values.includes(r[k]));
        return q;
      },
      not(k, op, v) {
        assert.equal(op, "is");
        filters.push((r) => r[k] !== v);
        return q;
      },
      order(k, o) {
        orders.push([k, o.ascending]);
        return q;
      },
      limit(n) {
        limit = n;
        return q;
      },
      then(resolve, reject) {
        return Promise.resolve()
          .then(() => ({
            data: failure
              ? null
              : rows
                  .filter((r) => filters.every((f) => f(r)))
                  .sort((a, b) => {
                    for (const [k, asc] of orders) {
                      const n = String(a[k]).localeCompare(String(b[k]));
                      if (n) return asc ? n : -n;
                    }
                    return 0;
                  })
                  .slice(0, limit),
            error: failure ? { message: "Read unavailable" } : null,
          }))
          .then(resolve, reject);
      },
    };
    return q;
  },
  async rpc(name, args) {
    if (name === "get_public_profile_snippets")
      return {
        data: args.p_user_ids.map((id) => ({
          id,
          username: "reader-" + id,
          display_name: "Reader " + id,
        })),
        error: null,
      };
    if (name === "get_public_username_cosmetics")
      return { data: [], error: null };
    throw Error(name);
  },
};
const mocks = {
  "@/lib/supabase/admin": {
    createSupabaseAdminClient: () => db,
    isSupabaseAdminConfigured: true,
    getSupabaseAdminConfigErrors: () => [],
  },
  "@/lib/username-styles": { getUsernameStylesByUserId: () => new Map() },
};
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const m = { exports: {} };
  cache.set(file, m);
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  new Function("require", "module", "exports", compiled)(
    (id) =>
      mocks[id] ??
      (id.startsWith("@/") ? load("src/" + id.slice(2) + ".ts") : require(id)),
    m,
    m.exports,
  );
  return m.exports;
}
(async () => {
  const { GET } = load("src/app/api/recent-case-openings/route.ts");
  const { CRATE_TYPES, SAMPLE_CRATE_ITEMS } = load("src/lib/crates.ts");
  const crate = Object.keys(CRATE_TYPES)[0],
    item = Object.keys(SAMPLE_CRATE_ITEMS)[0];
  // Nothing was opened in the last 24 hours, or even in the last year.
  rows = Array.from({ length: 10 }, (_, i) => ({
    id: "old-" + String(i).padStart(2, "0"),
    user_id: "u" + (i % 3),
    crate_type: crate,
    item_id: item,
    opened_at: "2023-01-" + String(i + 1).padStart(2, "0") + "T10:00:00Z",
  }));
  let response = await GET();
  assert.equal(response.status, 200);
  let payload = await response.json();
  let feed = payload.openers
    .flatMap((x) => x.recentOpenings)
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  assert.equal(
    feed.length,
    6,
    "Old records must remain visible after inactivity",
  );
  assert.deepEqual(
    feed.map((x) => x.id),
    ["old-09", "old-08", "old-07", "old-06", "old-05", "old-04"],
  );
  rows.push(
    {
      id: "latest",
      user_id: "u1",
      crate_type: crate,
      item_id: item,
      opened_at: "2026-09-10T10:00:00Z",
    },
    {
      id: "invalid",
      user_id: "u1",
      crate_type: "missing",
      item_id: item,
      opened_at: "2026-09-10T11:00:00Z",
    },
    {
      id: "no-item",
      user_id: "u1",
      crate_type: crate,
      item_id: null,
      opened_at: "2026-09-10T11:00:00Z",
    },
  );
  payload = await (await GET()).json();
  feed = payload.openers
    .flatMap((x) => x.recentOpenings)
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  assert.equal(feed.length, 6);
  assert.equal(feed[0].id, "latest");
  assert.ok(feed.some((x) => x.id === "old-05"));
  assert.ok(!feed.some((x) => ["invalid", "no-item", "old-04"].includes(x.id)));
  rows = [];
  payload = await (await GET()).json();
  assert.deepEqual(
    payload.openers,
    [],
    "No invented history when database is truly empty",
  );
  failure = true;
  const original = console.error;
  console.error = () => {};
  try {
    response = await GET();
    assert.equal(response.status, 500);
    assert.equal((await response.json()).error, "Read unavailable");
  } finally {
    console.error = original;
  }
  console.log(
    "Recent Openings: old history retained, latest six ordered, new opening replaces oldest, invalid rows excluded, empty history and read failure distinguished.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
