// Static / DB-level security regression checks. Does NOT need a running
// `next dev` server - talks to Supabase directly with the service-role key,
// exercising the exact RPCs the API routes call (supabase/security-fixes-2026-07.sql).
//
// Run: node scripts/admin-security-checks.mjs
// Exits non-zero on any failed check.

import "./_env.mjs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

async function main() {
  console.log("== Environment ==");
  check("NEXT_PUBLIC_SUPABASE_URL is set", Boolean(SUPABASE_URL));
  check("SUPABASE_SERVICE_ROLE_KEY is set", Boolean(SERVICE_ROLE_KEY));
  check("NEXT_PUBLIC_SUPABASE_ANON_KEY is set", Boolean(ANON_KEY));
  check("ADMIN_USER_IDS is set", Boolean(process.env.ADMIN_USER_IDS));
  check("CRON_SECRET is set", Boolean(process.env.CRON_SECRET));

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error(
      "\nCannot run DB-level checks without Supabase credentials. Aborting remaining checks.",
    );
    printSummaryAndExit();
    return;
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("\n== Required RPC functions exist (supabase/security-fixes-2026-07.sql) ==");
  await checkRpcExists(admin, "unlock_gallery_items_atomic", {
    p_user_id: "00000000-0000-0000-0000-000000000000",
    p_common_items: [],
    p_free_items: [],
    p_reason: "spend:gallery-unlock",
  });
  await checkRpcExists(admin, "unlock_pet_gallery_items_atomic", {
    p_user_id: "00000000-0000-0000-0000-000000000000",
    p_item_ids: [],
  });
  await checkRpcExists(admin, "roll_sacrifice_unlock", {
    p_user_id: "00000000-0000-0000-0000-000000000000",
    p_cost: 500,
    p_chance: 0.35,
    p_candidate_ids: ["sacrifice-1"],
  });
  await checkRpcExists(admin, "contribute_to_jackpot_atomic", {
    p_user_id: "00000000-0000-0000-0000-000000000000",
    p_jackpot_id: "00000000-0000-0000-0000-000000000000",
    p_cycle_key: "smoke-test",
    p_amount: 100,
  });
  await checkRpcExists(admin, "check_rate_limit", {
    p_key: "admin-security-checks:smoke",
    p_max_count: 1000,
    p_window_seconds: 60,
  });
  await checkRpcExists(admin, "prune_rate_limit_buckets", {});

  console.log("\n== Community status aggregate RPC (supabase/vercel-performance-optimizations.sql) ==");
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const aggResult = await admin.rpc("get_community_status_aggregates", {
    p_user_id: "00000000-0000-0000-0000-000000000000",
    p_day_start: dayStart.toISOString(),
    p_week_start: dayStart.toISOString(),
    p_month_start: dayStart.toISOString(),
    p_now: now.toISOString(),
    p_goal_start: dayStart.toISOString(),
    p_goal_end: now.toISOString(),
    p_goal_reasons: ["tribute:coin-offer"],
  });
  const aggMissing = aggResult.error && ["42883", "PGRST202"].includes(aggResult.error.code);
  check(
    "get_community_status_aggregates exists (fallback loop should never fire in production)",
    !aggMissing,
    aggMissing ? "RPC missing - deploy supabase/vercel-performance-optimizations.sql, or the community/status route will fall back to an unbounded-scan-capped legacy path" : undefined,
  );

  console.log("\n== Rate limiting actually limits ==");
  const rlKey = `admin-security-checks:${Date.now()}`;
  const first = await admin.rpc("check_rate_limit", { p_key: rlKey, p_max_count: 2, p_window_seconds: 60 });
  const second = await admin.rpc("check_rate_limit", { p_key: rlKey, p_max_count: 2, p_window_seconds: 60 });
  const third = await admin.rpc("check_rate_limit", { p_key: rlKey, p_max_count: 2, p_window_seconds: 60 });
  check("request 1/2 allowed", first.data?.allowed === true, JSON.stringify(first.data ?? first.error));
  check("request 2/2 allowed", second.data?.allowed === true, JSON.stringify(second.data ?? second.error));
  check("request 3/2 rejected", third.data?.allowed === false, JSON.stringify(third.data ?? third.error));
  await admin.from("rate_limit_buckets").delete().eq("bucket_key", rlKey);

  console.log("\n== Row Level Security blocks the anon key from reading sensitive tables ==");
  if (ANON_KEY) {
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anonCoinTx = await anon.from("coin_transactions").select("id, user_id, amount").limit(1);
    check(
      "anon key cannot read coin_transactions",
      Boolean(anonCoinTx.error) || (anonCoinTx.data ?? []).length === 0,
      anonCoinTx.error ? undefined : `RLS gap: anon key returned ${anonCoinTx.data.length} row(s)`,
    );

    const anonRateLimit = await anon.from("rate_limit_buckets").select("bucket_key").limit(1);
    check(
      "anon key cannot read rate_limit_buckets",
      Boolean(anonRateLimit.error) || (anonRateLimit.data ?? []).length === 0,
      anonRateLimit.error ? undefined : `RLS gap: anon key returned ${anonRateLimit.data.length} row(s)`,
    );

    const anonGalleryRpc = await anon.rpc("unlock_gallery_items_atomic", {
      p_user_id: "00000000-0000-0000-0000-000000000000",
      p_common_items: [],
      p_free_items: [],
      p_reason: "spend:gallery-unlock",
    });
    check(
      "anon key cannot call unlock_gallery_items_atomic directly",
      Boolean(anonGalleryRpc.error),
      anonGalleryRpc.error ? undefined : "grant gap: anon key was able to invoke a security-definer unlock RPC directly",
    );

    const anonSacrificeRpc = await anon.rpc("roll_sacrifice_unlock", {
      p_user_id: "00000000-0000-0000-0000-000000000000",
      p_cost: 1,
      p_chance: 1,
      p_candidate_ids: ["sacrifice-1"],
    });
    check(
      "anon key cannot call roll_sacrifice_unlock directly",
      Boolean(anonSacrificeRpc.error),
      anonSacrificeRpc.error ? undefined : "grant gap: anon key was able to invoke roll_sacrifice_unlock directly",
    );

    const anonJackpotRpc = await anon.rpc("contribute_to_jackpot_atomic", {
      p_user_id: "00000000-0000-0000-0000-000000000000",
      p_jackpot_id: "00000000-0000-0000-0000-000000000000",
      p_cycle_key: "smoke-test",
      p_amount: 1,
    });
    check(
      "anon key cannot call contribute_to_jackpot_atomic directly",
      Boolean(anonJackpotRpc.error),
      anonJackpotRpc.error ? undefined : "grant gap: anon key was able to invoke contribute_to_jackpot_atomic directly",
    );
  } else {
    console.warn("  Skipped (NEXT_PUBLIC_SUPABASE_ANON_KEY not set)");
  }

  printSummaryAndExit();
}

async function checkRpcExists(admin, name, args) {
  const { error } = await admin.rpc(name, args);
  const missing = error && ["42883", "PGRST202"].includes(error.code);
  check(`${name} exists`, !missing, missing ? `Postgres function not found - run supabase/security-fixes-2026-07.sql` : undefined);
}

function printSummaryAndExit() {
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
  console.error("admin-security-checks crashed", error);
  process.exit(1);
});
