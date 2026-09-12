# Visual overhaul — 12 September 2026

The approved design from `vault-mistress-visual-preview` is integrated into the main project. The original main files matched the preview's creation manifest, so this promotion resolves omissions in the preview rather than merging subsequent main-project additions.

## Included

- Approved navigation, home panels, task and Court Game presentation, casino tables, wheels, case-opening dialog, shrine, furnace, shop, runway, collections, contracts, loading screen and social styling.
- All 50 Anime / Manga borders, without visible anime-series labels, the series filter or series-name prefixes in their descriptions. Item IDs and artwork are unchanged.
- All 47 football borders (clubs and national teams) leave the rotating pool and appear in the seven-day farewell collection. Their original 10,000-Coin price is crossed out next to the 5,000-Coin sale price. The client and purchase endpoint use the same price function; the transaction ledger records the discounted amount.
- Existing ownership and equipping remain available after the farewell window closes. Avatar backgrounds cost 5,000 Coins.

## Main functionality retained

Real sign-in and the existing read-only exploration mode remain distinct. The live activity feed omitted from the redesigned entrance has been restored. Admin, analytics, licenses and wallpaper pages retain their original application logic, with only presentation classes added. The puzzle redirect, birthday page, social profile editing, messages, moderation, payment/webhook flows and existing database files remain in the main project.

Design-only sample accounts, mock API proxy, fake game outcomes and animation demonstration buttons are excluded from production. No files were deleted. Configuration, secrets, package dependencies and existing SQL ordering were preserved.

## Farewell window

The release window is pinned in `src/lib/world-cup-farewell.ts`: **12 September 2026, 19:35:28 UTC – 19 September 2026, 19:35:28 UTC**. Rebuilding does not restart the timer.

If deployment happens on a later date, set `NEXT_PUBLIC_WORLD_CUP_FAREWELL_START_AT` to that launch time as an ISO UTC timestamp **before building**. Use the same value in all instances and retain it on subsequent deployments. No database migration is required for this release.

## Verification and recovery

- Production build and TypeScript compilation passed; all 155 static pages generated.
- Static comparison found no removed API URL references in the changed components. The four admin implementations are byte-identical to their original logic after removing the added presentation class.
- Promoted image references resolve to existing files. The preview-only flags and mock imports are absent from the promoted application.
- Changed files were checked with ESLint. The one event-handler timestamp false positive is documented locally; existing warnings remain. Browser and full gameplay tests were left to the user as requested. Existing Crown Match server-check expectations were updated from six to nine pairs without running the suite.
- Before-change copies and the detailed transfer inventory are under the git-ignored `tmp/theme-promotion-20260912/` directory. The separate preview project is untouched.

This records a **local main-project integration**. It does not record a Git push or a Vercel production deployment.
