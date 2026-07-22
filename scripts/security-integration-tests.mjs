// Regression tests for the 2026-07 security fixes: gallery paywall bypass,
// duplicate/race-condition double-unlock, insufficient-balance side effects,
// jackpot double-spend/atomicity, cross-user authorization, and rate
// limiting.
//
// Section A runs against Supabase directly (service role) - no server
// needed - and exercises the exact atomic RPCs the API routes call, using a
// disposable real auth user that is deleted at the end either way.
//
// Section B runs real HTTP requests against a running server (default
// http://localhost:3000, override with TEST_BASE_URL) and checks that
// sensitive routes reject unauthenticated / cross-user requests before
// touching any body-supplied identity.
//
// Section C is optional and only runs if TEST_SESSION_COOKIE is set (copy
// the `sb-...-auth-token` cookie value from a logged-in browser session on a
// disposable test account) - it exercises the deeper authenticated flows
// (mood-gate rejection, insufficient funds, rate-limit 429) end-to-end.
//
// Run: node scripts/security-integration-tests.mjs
// Exits non-zero on any failed check.

import "./_env.mjs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEST_BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || "";

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } else {
    failed += 1;
    failures.push({ name, detail });
    console.error(`  [FAIL] ${name}${detail ? ` - ${detail}` : ""}`);
  }
}

async function createDisposableUser(admin, password) {
  const email = `security-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });
  if (error || !data.user) {
    throw new Error(`Failed to create disposable test user: ${error?.message ?? "unknown error"}`);
  }

  const username = `sectest_${data.user.id.slice(0, 8)}`;
  const { error: profileError } = await admin.from("profiles").upsert({
    id: data.user.id,
    username,
    coins: 0,
    affection: 0,
    pet_score: 0,
  });
  if (profileError) {
    throw new Error(`Failed to create disposable test profile: ${profileError.message}`);
  }

  return { userId: data.user.id, email };
}

async function setCoins(admin, userId, coins) {
  const { error } = await admin.from("profiles").update({ coins }).eq("id", userId);
  if (error) throw error;
}

async function getCoins(admin, userId) {
  const { data, error } = await admin.from("profiles").select("coins").eq("id", userId).single();
  if (error) throw error;
  return data.coins;
}

async function countRows(admin, table, filters) {
  let query = admin.from(table).select("id", { count: "exact", head: true });
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function testGalleryUnlocks(admin, userId) {
  console.log("\n-- Gallery unlock atomicity/idempotency --");

  // --- First charge succeeds ---
  await setCoins(admin, userId, 1000);
  const commonItem = { item_id: "common-velvet-arrival", cost: 300 };
  const first = await admin.rpc("unlock_gallery_items_atomic", {
    p_user_id: userId,
    p_common_items: [commonItem],
    p_free_items: [],
    p_reason: "spend:gallery-unlock",
  });
  check("gallery unlock charges once (first call)", first.data?.coins === 700 && first.data?.chargedTotal === 300, JSON.stringify(first.data ?? first.error));

  // --- Repeated (sequential) request for the SAME already-unlocked item
  // must charge nothing at all - this is the exact case ON CONFLICT DO
  // NOTHING alone does not protect, since the old implementation summed
  // costs from the caller's list unconditionally before checking ownership. ---
  const repeat = await admin.rpc("unlock_gallery_items_atomic", {
    p_user_id: userId,
    p_common_items: [commonItem],
    p_free_items: [],
    p_reason: "spend:gallery-unlock",
  });
  const coinsAfterRepeat = await getCoins(admin, userId);
  check(
    "repeated request for an already-unlocked item charges zero coins",
    repeat.data?.coins === 700 && repeat.data?.chargedTotal === 0 && coinsAfterRepeat === 700,
    `expected 700 unchanged with chargedTotal 0, got coins=${JSON.stringify(repeat.data)} balance=${coinsAfterRepeat}`,
  );
  const ledgerCount = await countRows(admin, "coin_transactions", { user_id: userId, reason: "spend:gallery-unlock" });
  check("repeated request does not create a second ledger row", ledgerCount === 1, `found ${ledgerCount} ledger rows, expected 1`);

  // --- Mixed request: one already-unlocked item + one genuinely new item
  // must only charge for the new one. ---
  const mixed = await admin.rpc("unlock_gallery_items_atomic", {
    p_user_id: userId,
    p_common_items: [commonItem, { item_id: "common-midnight-maid", cost: 300 }],
    p_free_items: [],
    p_reason: "spend:gallery-unlock",
  });
  check(
    "mixed request (1 owned + 1 new) charges only for the new item",
    mixed.data?.chargedTotal === 300 && mixed.data?.coins === 400,
    JSON.stringify(mixed.data ?? mixed.error),
  );

  // --- Insufficient funds: zero side effects ---
  await setCoins(admin, userId, 100);
  const before = await getCoins(admin, userId);
  const insufficient = await admin.rpc("unlock_gallery_items_atomic", {
    p_user_id: userId,
    p_common_items: [{ item_id: "common-executive-glare", cost: 300 }],
    p_free_items: [],
    p_reason: "spend:gallery-unlock",
  });
  const after = await getCoins(admin, userId);
  check("insufficient funds is rejected with the correct error", insufficient.data?.error === "insufficient_funds", JSON.stringify(insufficient.data ?? insufficient.error));
  check("insufficient funds leaves coin balance untouched", before === after, `before=${before} after=${after}`);
  const unlockedCount = await countRows(admin, "user_gallery", { user_id: userId, item_id: "common-executive-glare" });
  check("insufficient funds does not create an unlock row", unlockedCount === 0);

  // --- Insufficient funds on a MIXED batch: total cost across the whole
  // batch exceeds balance -> the whole batch must be rejected, not
  // partially charged. ---
  await setCoins(admin, userId, 300);
  const mixedInsufficient = await admin.rpc("unlock_gallery_items_atomic", {
    p_user_id: userId,
    p_common_items: [
      { item_id: "common-executive-glare", cost: 300 },
      { item_id: "common-rose-vault", cost: 300 },
    ],
    p_free_items: [],
    p_reason: "spend:gallery-unlock",
  });
  const coinsAfterMixedInsufficient = await getCoins(admin, userId);
  check(
    "batch whose total cost exceeds balance is rejected with zero writes",
    mixedInsufficient.data?.error === "insufficient_funds" && coinsAfterMixedInsufficient === 300,
    JSON.stringify(mixedInsufficient.data),
  );

  // --- Race: N parallel requests for the SAME brand-new item, balance
  // comfortably covers MULTIPLE charges. This is the test that actually
  // exercises the ownership-recheck-under-lock fix - with enough balance to
  // survive several charges, a buggy implementation that only guards the
  // coins column (without re-checking user_gallery ownership inside the
  // lock) would happily charge every single request instead of just one. ---
  await setCoins(admin, userId, 1500);
  const raceItem = { item_id: "common-rose-vault", cost: 300 };
  const raceResults = await Promise.all(
    Array.from({ length: 8 }, () =>
      admin.rpc("unlock_gallery_items_atomic", {
        p_user_id: userId,
        p_common_items: [raceItem],
        p_free_items: [],
        p_reason: "spend:gallery-unlock",
      }),
    ),
  );
  const raceCoinsAfter = await getCoins(admin, userId);
  const raceCharges = raceResults.filter((r) => (r.data?.chargedTotal ?? 0) > 0).length;
  const raceLedgerCount = await countRows(admin, "coin_transactions", {
    user_id: userId,
    reason: "spend:gallery-unlock",
  });
  check(
    "8 parallel unlock requests for the same new item (balance covers 5x the cost) charge exactly once",
    raceCoinsAfter === 1200 && raceCharges === 1,
    `coins left=${raceCoinsAfter} (expected 1200), requests that charged=${raceCharges} (expected 1)`,
  );
  void raceLedgerCount;
}

async function testSacrifice(admin, userId) {
  console.log("\n-- Sacrifice roll atomicity --");

  await setCoins(admin, userId, 500);
  const sacrificeBefore = await getCoins(admin, userId);
  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      admin.rpc("roll_sacrifice_unlock", {
        p_user_id: userId,
        p_cost: 500,
        p_chance: 0.35,
        p_candidate_ids: ["sacrifice-1", "sacrifice-2", "sacrifice-3"],
      }),
    ),
  );
  const sacrificeAfter = await getCoins(admin, userId);
  const charged = results.filter((r) => !r.data?.error && !r.data?.completed).length;
  const rejected = results.filter((r) => r.data?.error === "insufficient_funds").length;
  check(
    "6 parallel sacrifice rolls from a 500-coin balance (cost 500) charge exactly once",
    sacrificeAfter === sacrificeBefore - 500 && charged === 1 && rejected === 5,
    `coins ${sacrificeBefore} -> ${sacrificeAfter}, charged=${charged}, rejected=${rejected}`,
  );

  const wonRows = results.filter((r) => r.data?.won && r.data?.itemId);
  if (wonRows.length > 0) {
    const itemId = wonRows[0].data.itemId;
    const unlockCount = await countRows(admin, "user_gallery", { user_id: userId, item_id: itemId });
    check("the sacrificed item was unlocked exactly once, not once per winning call", unlockCount === 1, `found ${unlockCount} rows for ${itemId}`);
  }

  // --- All candidates already owned -> "completed", no charge. ---
  await setCoins(admin, userId, 500);
  const completed = await admin.rpc("roll_sacrifice_unlock", {
    p_user_id: userId,
    p_cost: 500,
    p_chance: 1,
    p_candidate_ids: ["sacrifice-1", "sacrifice-2", "sacrifice-3"],
  });
  const coinsAfterCompleted = await getCoins(admin, userId);
  check(
    "rolling with every candidate already unlocked reports completed and charges nothing",
    completed.data?.completed === true && coinsAfterCompleted === 500,
    JSON.stringify(completed.data),
  );
}

async function testJackpotAtomicity(admin, userId) {
  console.log("\n-- Jackpot contribution atomicity --");

  const cycleKey = `security-test-${Date.now()}`;
  const now = new Date();
  const { data: jackpot, error: jackpotError } = await admin
    .from("loyalty_jackpots")
    .insert({
      cycle_key: cycleKey,
      starts_at: now.toISOString(),
      contribution_ends_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      ends_at: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      base_pool: 5000,
    })
    .select("id")
    .single();

  if (jackpotError || !jackpot) {
    check("jackpot atomicity test setup", false, `could not create disposable jackpot: ${jackpotError?.message}`);
    return;
  }

  try {
    await setCoins(admin, userId, 1000);
    const result = await admin.rpc("contribute_to_jackpot_atomic", {
      p_user_id: userId,
      p_jackpot_id: jackpot.id,
      p_cycle_key: cycleKey,
      p_amount: 250,
    });
    const coinsAfter = await getCoins(admin, userId);
    const contributionCount = await countRows(admin, "loyalty_jackpot_contributions", { user_id: userId, jackpot_id: jackpot.id });
    const ledgerCount = await countRows(admin, "coin_transactions", { user_id: userId, reason: "jackpot_contribution" });
    check(
      "a successful contribution has coin deduction + contribution row + ledger row all present",
      result.data?.coins === 750 && coinsAfter === 750 && contributionCount === 1 && ledgerCount === 1,
      `coins=${coinsAfter} contributionRows=${contributionCount} ledgerRows=${ledgerCount}`,
    );

    // --- Race: parallel contributions, balance covers multiple but not all ---
    await setCoins(admin, userId, 900);
    const parallelResults = await Promise.all(
      Array.from({ length: 5 }, () =>
        admin.rpc("contribute_to_jackpot_atomic", {
          p_user_id: userId,
          p_jackpot_id: jackpot.id,
          p_cycle_key: cycleKey,
          p_amount: 300,
        }),
      ),
    );
    const successCount = parallelResults.filter((r) => !r.data?.error).length;
    const coinsAfterRace = await getCoins(admin, userId);
    const raceContributionCount = await countRows(admin, "loyalty_jackpot_contributions", { user_id: userId, jackpot_id: jackpot.id });
    const raceLedgerCount = await countRows(admin, "coin_transactions", { user_id: userId, reason: "jackpot_contribution" });
    check(
      "5 parallel 300-coin contributions from a 900-coin balance succeed exactly 3 times, with matching contribution/ledger rows",
      successCount === 3 && coinsAfterRace === 0 && raceContributionCount === 1 + 3 && raceLedgerCount === 1 + 3,
      `successes=${successCount} coinsLeft=${coinsAfterRace} contributionRows=${raceContributionCount} ledgerRows=${raceLedgerCount}`,
    );

    // --- Admin accounts are rejected ---
    await admin.from("profiles").update({ is_admin: true }).eq("id", userId);
    const adminAttempt = await admin.rpc("contribute_to_jackpot_atomic", {
      p_user_id: userId,
      p_jackpot_id: jackpot.id,
      p_cycle_key: cycleKey,
      p_amount: 10,
    });
    check("admin accounts cannot contribute to the jackpot", adminAttempt.data?.error === "admin_not_allowed", JSON.stringify(adminAttempt.data));
    await admin.from("profiles").update({ is_admin: false }).eq("id", userId);
  } finally {
    await admin.from("loyalty_jackpots").delete().eq("id", jackpot.id);
  }
}

async function testRateLimit(admin) {
  console.log("\n-- Rate limit bucket behavior --");

  const rlKey = `security-integration-tests:${Date.now()}`;
  const first = await admin.rpc("check_rate_limit", { p_key: rlKey, p_max_count: 2, p_window_seconds: 60 });
  const second = await admin.rpc("check_rate_limit", { p_key: rlKey, p_max_count: 2, p_window_seconds: 60 });
  const third = await admin.rpc("check_rate_limit", { p_key: rlKey, p_max_count: 2, p_window_seconds: 60 });
  check("request 1/2 allowed", first.data?.allowed === true, JSON.stringify(first.data ?? first.error));
  check("request 2/2 allowed", second.data?.allowed === true, JSON.stringify(second.data ?? second.error));
  check("request 3/2 rejected with a positive retryAfterSeconds", third.data?.allowed === false && third.data?.retryAfterSeconds > 0, JSON.stringify(third.data ?? third.error));

  // Concurrent hits against the SAME key must not all be admitted just
  // because they raced past each other before any row existed.
  const raceKey = `security-integration-tests-race:${Date.now()}`;
  const raceResults = await Promise.all(
    Array.from({ length: 10 }, () => admin.rpc("check_rate_limit", { p_key: raceKey, p_max_count: 3, p_window_seconds: 60 })),
  );
  const allowedCount = raceResults.filter((r) => r.data?.allowed).length;
  check(
    "10 concurrent requests against a max-3 bucket admit exactly 3",
    allowedCount === 3,
    `admitted ${allowedCount}, expected 3`,
  );

  await admin.from("rate_limit_buckets").delete().in("bucket_key", [rlKey, raceKey]);

  const pruneResult = await admin.rpc("prune_rate_limit_buckets");
  check("prune_rate_limit_buckets is callable and returns a count", !pruneResult.error && typeof pruneResult.data === "number", JSON.stringify(pruneResult.error ?? pruneResult.data));
}

async function testGrants(supabaseUrl, anonKey, userEmail, password) {
  console.log("\n-- SQL permissions: neither anon nor an authenticated user's own session can call these RPCs directly --");

  if (!anonKey) {
    console.warn("  Skipped (NEXT_PUBLIC_SUPABASE_ANON_KEY not set)");
    return;
  }

  const anon = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const anonRpc = await anon.rpc("unlock_gallery_items_atomic", {
    p_user_id: "00000000-0000-0000-0000-000000000000",
    p_common_items: [],
    p_free_items: [],
    p_reason: "spend:gallery-unlock",
  });
  check(
    "anon key cannot call unlock_gallery_items_atomic",
    Boolean(anonRpc.error),
    anonRpc.error ? undefined : "permission gap: anon key invoked a security-definer unlock RPC directly",
  );

  const anonCoinTx = await anon.from("coin_transactions").select("id, user_id, amount").limit(1);
  check(
    "anon key cannot read coin_transactions (RLS)",
    Boolean(anonCoinTx.error) || (anonCoinTx.data ?? []).length === 0,
    anonCoinTx.error ? undefined : `RLS gap: anon key returned ${anonCoinTx.data.length} row(s)`,
  );

  // A REAL signed-in user's own session (Postgres role `authenticated`, not
  // `anon`) must also be unable to call these RPCs directly - this is the
  // actual guarantee that a user can never pass someone else's id into a
  // security-definer function, since PostgREST simply refuses the call
  // before the function body (and its p_user_id parameter) ever runs.
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email: userEmail, password });
  if (signInError || !signIn.session) {
    check("authenticated-role rejection test setup", false, `sign-in failed: ${signInError?.message}`);
    return;
  }

  const authedClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  await authedClient.auth.setSession(signIn.session);

  const authedRpc = await authedClient.rpc("unlock_gallery_items_atomic", {
    p_user_id: "00000000-0000-0000-0000-000000000000", // attempting to act on an arbitrary/other id
    p_common_items: [],
    p_free_items: [],
    p_reason: "spend:gallery-unlock",
  });
  check(
    "a real signed-in user's own session cannot call unlock_gallery_items_atomic (even targeting another id)",
    Boolean(authedRpc.error),
    authedRpc.error ? undefined : "permission gap: an authenticated user's session was able to invoke a security-definer unlock RPC directly",
  );

  const authedSacrificeRpc = await authedClient.rpc("roll_sacrifice_unlock", {
    p_user_id: signIn.session.user.id,
    p_cost: 1,
    p_chance: 1,
    p_candidate_ids: ["sacrifice-1"],
  });
  check(
    "a real signed-in user's own session cannot call roll_sacrifice_unlock, even for their own id",
    Boolean(authedSacrificeRpc.error),
    authedSacrificeRpc.error ? undefined : "permission gap: an authenticated user's session was able to invoke roll_sacrifice_unlock directly",
  );

  await authedClient.auth.signOut();
}

async function runSectionA(admin) {
  console.log("\n== Section A: atomic RPC regression tests (no server needed) ==");
  const password = `Test-${Math.random().toString(36).slice(2)}!A1`;
  const { userId, email } = await createDisposableUser(admin, password);

  try {
    await testGalleryUnlocks(admin, userId);
    await testSacrifice(admin, userId);
    await testJackpotAtomicity(admin, userId);
    await testRateLimit(admin);
    await testGrants(SUPABASE_URL, ANON_KEY, email, password);

    // Pet gallery idempotency (no coin side effects, but should still not error twice)
    console.log("\n-- Pet gallery idempotency --");
    const petFirst = await admin.rpc("unlock_pet_gallery_items_atomic", { p_user_id: userId, p_item_ids: ["pet-gallery-1"] });
    const petSecond = await admin.rpc("unlock_pet_gallery_items_atomic", { p_user_id: userId, p_item_ids: ["pet-gallery-1"] });
    check("pet gallery unlock is idempotent on repeat requests", !petFirst.error && !petSecond.error, JSON.stringify(petFirst.error ?? petSecond.error));
  } finally {
    await admin.auth.admin.deleteUser(userId).catch((error) => {
      console.warn("Failed to clean up disposable test user", userId, error?.message ?? error);
    });
  }
}

async function runSectionB() {
  console.log(`\n== Section B: HTTP auth-gating tests against ${TEST_BASE_URL} ==`);

  let reachable = true;
  try {
    await fetch(TEST_BASE_URL, { method: "GET" });
  } catch {
    reachable = false;
  }

  if (!reachable) {
    console.warn(`  Skipped - ${TEST_BASE_URL} is not reachable. Start the app (npm run dev) and re-run to include Section B.`);
    return;
  }

  const otherUserId = "11111111-1111-1111-1111-111111111111";
  const sensitiveRequests = [
    ["POST /api/user/gallery-unlocks (no auth)", "/api/user/gallery-unlocks", { itemIds: ["common-velvet-arrival"] }],
    ["POST /api/user/gallery-unlocks (no auth, impersonating another user)", "/api/user/gallery-unlocks", { itemIds: ["common-velvet-arrival"], userId: otherUserId }],
    ["POST /api/user/pet-gallery-unlocks (no auth)", "/api/user/pet-gallery-unlocks", { itemIds: ["pet-gallery-1"] }],
    ["POST /api/jackpot (no auth)", "/api/jackpot", { amount: 100 }],
    ["POST /api/user/profile-progress (no auth)", "/api/user/profile-progress", { reason: "beg" }],
    ["POST /api/user/crates (no auth)", "/api/user/crates", { action: "open", crateType: "principessa_case" }],
    ["POST /api/user/debt-contracts (no auth)", "/api/user/debt-contracts", { action: "sign" }],
  ];

  for (const [name, path, body] of sensitiveRequests) {
    try {
      const response = await fetch(`${TEST_BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      check(`${name} returns 401`, response.status === 401, `got ${response.status}`);
    } catch (error) {
      check(name, false, `request failed: ${error.message}`);
    }
  }

  const adminRequests = [
    ["POST /api/jackpot/advance (no cron secret, no admin session)", "/api/jackpot/advance", {}],
    ["POST /api/admin/give (no admin session)", "/api/admin/give", { command: "/give 100 @someone" }],
  ];

  for (const [name, path, body] of adminRequests) {
    try {
      const response = await fetch(`${TEST_BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      check(`${name} is rejected`, response.status === 401 || response.status === 403, `got ${response.status}`);
    } catch (error) {
      check(name, false, `request failed: ${error.message}`);
    }
  }
}

async function runSectionC() {
  if (!TEST_SESSION_COOKIE) {
    console.log("\n== Section C: skipped (set TEST_SESSION_COOKIE to a logged-in disposable test account's `sb-...-auth-token` cookie value to enable) ==");
    return;
  }

  console.log(`\n== Section C: authenticated HTTP flow tests against ${TEST_BASE_URL} ==`);
  const cookieHeader = TEST_SESSION_COOKIE.includes("=") ? TEST_SESSION_COOKIE : `sb-auth-token=${TEST_SESSION_COOKIE}`;

  const moodItemResponse = await fetch(`${TEST_BASE_URL}/api/user/gallery-unlocks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    body: JSON.stringify({ itemIds: ["secret-defnes-final-favor"] }),
  });
  check("mood-gated gallery item is rejected below its affection threshold", moodItemResponse.status === 403, `got ${moodItemResponse.status}`);

  const rateLimitHits = await Promise.all(
    Array.from({ length: 25 }, () =>
      fetch(`${TEST_BASE_URL}/api/user/gallery-unlocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader },
        body: JSON.stringify({ itemIds: ["common-velvet-arrival"] }),
      }),
    ),
  );
  const got429 = rateLimitHits.some((response) => response.status === 429);
  check("rapid repeated requests eventually hit the rate limit (429)", got429);
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are required to run Section A. Aborting.");
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await runSectionA(admin);
  await runSectionB();
  await runSectionC();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("\nFailures:");
    for (const failure of failures) {
      console.error(`  - ${failure.name}${failure.detail ? `: ${failure.detail}` : ""}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("security-integration-tests crashed", error);
  process.exit(1);
});
