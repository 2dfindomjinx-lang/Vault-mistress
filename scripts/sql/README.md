# 2026-09-09 maintenance deployment

1. Run `2026-09-09-chat-history-case-opening.sql` in the project's Supabase SQL editor as the database owner, **before** deploying the accompanying application changes.
2. Deploy the application. The new community goal is configured in `src/lib/prestige.ts`: September 9, 2026 19:45 to December 8, 2026 19:45 (UTC+3), 2,000,000 Coins, exactly three Couture Case keys, no community-goal badge. Prior goal/grant records are preserved.
3. With a signed-in test account, open the daily Games case once, verify the reward/balance and daily cooldown, then retry from a second tab. Verify chat history and moderation from two accounts.

The SQL retains chat history, adds pagination indexes, and atomically saves the daily case reward, ledger and task state. It can be reapplied. It changes only the chat deletion statement in the existing retention function; an unfamiliar deletion definition aborts the transaction for manual review. Other retention policies are preserved. Messages deleted before this change cannot be restored by this migration.

Local validation completed with a production build, browser fixtures and isolated PGlite tests. No production database was connected or modified. Real multi-connection locking, deployed triggers and authenticated production behavior still require the deployment check above. Targeted lint has no new errors; the six pre-existing page.tsx hook/purity errors remain (confirmed against HEAD).

## Regression checks

- `node scripts/maintenance-rules-check.mjs`
- `node scripts/ui-maintenance-smoke.mjs` (local Next server on port 3100)
- `node scripts/maintenance-interaction-check.mjs` (same server, mocked chat/case responses)
- `node scripts/maintenance-sql-check.mjs` (isolated PGlite, uses the local schema and retention SQL in `supabase/`)

Browser checks require Playwright and Edge; `PLAYWRIGHT_MODULE` can point to an existing bundled Playwright package. Set `TEST_BASE_URL` to override the local server URL. SQL tests accept `PGLITE_MODULE`, defaulting to `.next/sql-validation/node_modules/@electric-sql/pglite` (install this temporary dependency after building, since Next clears .next). No test sends real coins. Interaction fixtures mock chat/case responses; the UI smoke uses Preview Mode and can call read-only app APIs if the local server has Supabase configured.
