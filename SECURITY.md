# Vault Mistress - Security Notes

## 11 October 2026 source audit and fixes

The Pet profile endpoint previously spread an untrusted JSON patch into a service-role profile update. Its reward checks did not prove task completion or enforce a single daily settlement, and the task endpoint accepted client approval/timestamps. Those routes now expose bounded actions: the server validates writing and generates Favor rolls; service-only SQL locks the profile, validates stored progress and commits the task, reward and Devotion together. Daily replay returns the original task. Maintenance and weekly tax derive amounts/timestamps from stored state. Review remains an admin action. This is a confirmed code vulnerability; it is not evidence that a particular user exploited it.

PM conversion previously wrote two balances and ledgers across separate HTTP calls. Shrine and inventory sales also relied on compensating writes after partial failures. Conversion, Furnace, Shrine and inventory sales now settle atomically. Conversion/Furnace/Shrine use user-scoped permanent receipt IDs, retained by the browser after ambiguous failures. Crate keys now commit with the opening rather than being consumed first and manually restored; no key restoration is attempted after a lost response. Catalog preparation writes only winning definitions, preserving existing records. Independent case-pricing reads run in parallel, and Shrine reads return aggregate totals/three leaders rather than unbounded history. The Shrine SQL still aggregates its indexed ledger; it is not a constant-cost rollup or a claimed live latency benchmark.

Economic calculations include the Principessa pity renewal cycle. Previously its Golden Key sell-back return was 118.19%, or 123.39% with Lucky Key. Combined events also pushed Premium, Kitten, Couture and Obedience above 100%. Revised per-case discounts keep paid case returns below 98% in the checked scenarios (highest 97.42%). Normal-case returns range 64.13–88.64%; Upgrade stays at or below its 90% target. The existing Gamble Hall model passes its 82% maximum return budget. These are mathematical sell-back expectations, not observed player winnings, cash returns, or proof of a stable economy under real usage. Free rewards, supply distribution and player behavior still affect inflation.

Validation: actual route/client writing handlers, isolated PostgreSQL migration reapplication, duplicate claims, forged approvals/counters/timers, full Obedience Sequence, favor-loss replay, tax eligibility, conversion tiers, lost-response behavior, private leaderboard exclusions, a 1,200-row Shrine history, transaction fault injection, PM-copy protection and RPC/table grants. The production dependency audit reported zero known vulnerabilities. No production database, real-user balances, Vercel region/usage dashboard, real browser session or separate-connection contention was tested. These checks are a scoped audit, not a security certification. Install the three new migrations in the order in `supabase/README.md` before deploying the matching routes.

Writing/key validation is not proof of human play; the server validates the submitted sequence and caps daily payouts. The normal Turbopack build encountered a local Windows PostCSS-worker startup error; the fallback Webpack build also exposed pre-existing document-level selectors in a CSS Module. Those eight rules were moved unchanged into global CSS, preserving the mobile portal selectors. The bundler choice in package scripts/deployment configuration is unchanged.

Final verification: `npm run build -- --webpack` completed successfully, including TypeScript and all 157 generated static pages. Changed server modules passed targeted ESLint checks; `git diff --check` passed. The default local Turbopack build has not been validated successfully, and Webpack completion does not establish Vercel deployment/runtime behavior.

## Critical: Service Role Key
- `SUPABASE_SERVICE_ROLE_KEY` gives full database access (bypasses ALL RLS).
- It is **only** imported in server-side code (`src/lib/supabase/admin.ts` and routes that use `createSupabaseAdminClient`).
- **NEVER** prefix it with `NEXT_PUBLIC_`.
- **NEVER** commit it.
- If you ever suspect it was exposed (old deploys, logs, client bundle, preview environments), **rotate it immediately** in the Supabase dashboard and update all environments.

## Admin Authorization
- Admins are defined exclusively by the `ADMIN_USER_IDS` environment variable (comma-separated Supabase auth user UUIDs).
- All admin routes must go through `requireAdmin` / `requireAdminProfile` (from `@/lib/admin-guard`).
- Admin routes must use the server guard; username and client-controlled `is_admin` flags are not authorization. The isolated security checks cover the economy and access paths described below.

## Economy / Progression Protection
- Database triggers (`security-hardening.sql`):
  - Block non-privileged clients from changing `coins`, `affection`, `tribute_total`, `pet_score`, `owner_likeness`, `shame_count`, `is_admin`, `hide_from_leaderboard`.
  - Block direct client mutations on `user_tasks`, `coin_transactions`, `user_gallery*`, etc.
- All coin/reward changes for users must go through dedicated `/api/user/*` routes.
- Those routes:
  - Authenticate via `supabase.auth.getUser()`.
  - Look up base rewards from server allow-lists (`server-game-rules.ts`).
  - Never trust `coins`, `reward`, `amount` etc. coming from the client body.
  - Use the service-role client for the actual write + always log to `coin_transactions`.

## Email / PII
- The `profiles.email` column exists in the DB for potential admin/audit use.
- Client code and user-facing selects **must never** include `email`.
- The linter and code now actively prevent `email` in `profileSelect` constants and the client `Profile` type.
- Admin analytics routes and public security-definer functions explicitly exclude it.

## How to Verify Security
1. `npm run test:security` (isolated route and PostgreSQL regression checks).
2. `npm run test:security:http` only in an explicitly configured disposable test environment after `npm run start` (tests that admin routes reject unauthenticated requests and public routes don't leak sensitive fields/emails).
3. Manually: log in as non-admin and attempt to call `/api/admin/give` etc. (should 401/403).

## Past Incidents
- A user was able to mass-add coins (likely before server-side reward validation + triggers were in place).
- Reports of possible DB dump capability and email leakage (pointed to service key exposure or overly broad selects including `email`).

## Recommendations
- Rotate `SUPABASE_SERVICE_ROLE_KEY` if it was ever at risk.
- Add rate limiting on high-impact endpoints (`/api/admin/give`, task claims, tribute sends).
- Consider moving more reads behind security-definer RPCs instead of direct table selects from the browser client.
- Keep running the security linter as part of CI if possible.
- Review any new game mechanics for "trust client for reward value" mistakes.

Last reviewed: 2026-10-11 (scoped source, dependency and isolated transaction audit; see limitations above).

## Safe local checks (September 2026)

`npm run test:security` runs isolated route checks and the actual economy migration in an in-memory PostgreSQL engine. It needs no server, credentials or external database. `npm test` also runs the existing game/content regression scripts.

`npm run test:security:integration` and `test:security:http` are explicitly destructive test-environment checks. They no longer load `.env.local`. They require `ALLOW_TEST_DB_WRITES=yes`, `SECURITY_TEST_SUPABASE_URL`, `SECURITY_TEST_SERVICE_ROLE_KEY`, `SECURITY_TEST_ANON_KEY` and `SECURITY_TEST_CONFIRM_HOST` matching the disposable database host. Use a local app server configured for that same test database. Never use production credentials or a real account cookie.

Apply versioned migrations before deploying dependent API code. See supabase/README.md. The admin Economy health panel reports failures from the migrated command paths; it does not automatically replay a financial action.
