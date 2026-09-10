# Database changes

schema.sql is the reviewed, non-personal legacy schema snapshot. It is not a complete migration history and must not be replayed blindly on production.

SQL files stay directly in this directory, following the existing project layout. Apply 202609090001_atomic_economy.sql before the corresponding API release. It is additive and safe to reapply. Existing balances are not changed by installation. Only service_role can execute the command or read its receipts/failure table.

Operational scripts stay ignored because some target real users; only the reviewed scripts named here are explicitly included in Git. Capture the deployed schema separately when database access is available; the local snapshot does not prove the production schema version.

Apply 202609090002_product_milestones.sql after the first migration for prospective product metrics. No historical milestones are fabricated; the first observed cohort includes returning users.

For the September 10 gameplay update, apply `202609100001_court_gameplay.sql` last, before deploying the new application. It requires the existing Gamble Hall engine. `gamble-hall.sql` is now included for isolated testing and initial setup; an existing installation does not need to replay it. If installing the engine from scratch, run `gamble-hall.sql` before the September 10 script. Replaying the engine later would replace the updated Patience functions, so always reapply the latest gameplay script afterward.

Existing installation order: `202609090001_atomic_economy.sql` → `202609090002_product_milestones.sql` → `202609100001_court_gameplay.sql`. If the first two have already run, only the third is new. No balances are changed by installing this script. Failed Court Games now permit another attempt; completed daily rewards remain locked. Patience targets are set before the wager and settle correctly even when the result is read late. The Jewelry Box multiplier is capped at the settlement engine's existing 250x ceiling so high-pick cashouts remain payable; the low-mine starting returns are unchanged. `npm run test:gameplay:sql` checks actual SQL in isolated PostgreSQL, including retries, ownership, countdowns and duplicate payouts.

The next September 10 fixes use `202609100002_court_fixes.sql`, directly in this same directory. Apply it **after** `202609100001_court_gameplay.sql` and before deploying these fixes. If the previous scripts already ran, only this new file is needed; do not replay the older engine afterward. It updates the Jewelry Box profit thresholds (7 mines: third safe pick; 10 mines: second; 15 mines: first), excludes admins and hidden profiles from the Furnace board, and adds service-only Gamble analytics. Installation does not alter balances, purchases or existing round records. The existing Furnace feature tables/profile fields are required. `npm run test:gameplay:sql` now applies both September 10 scripts and verifies thresholds through actual cashouts, leaderboard exclusions and analytics totals.

Typing recovery, timeout display refresh, apostrophe matching, wheel layout, three-color Roulette, Plinko's zero bucket, manual Patience defaults, share copy and license revocation are application changes. Revoke retains the purchase record and blocks activation/Wallpaper requests; already activated offline Discipline copies cannot be remotely stopped by this web release.

Run npm run test:security for isolated route and PostgreSQL checks. They never load .env.local. A production release also needs npm run check:deployment in its deployment environment and a backup/restore check. No production SQL has been applied by this implementation.
