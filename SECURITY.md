# Vault Mistress - Security Notes

## Critical: Service Role Key
- `SUPABASE_SERVICE_ROLE_KEY` gives full database access (bypasses ALL RLS).
- It is **only** imported in server-side code (`src/lib/supabase/admin.ts` and routes that use `createSupabaseAdminClient`).
- **NEVER** prefix it with `NEXT_PUBLIC_`.
- **NEVER** commit it.
- If you ever suspect it was exposed (old deploys, logs, client bundle, preview environments), **rotate it immediately** in the Supabase dashboard and update all environments.

## Admin Authorization
- Admins are defined exclusively by the `ADMIN_USER_IDS` environment variable (comma-separated Supabase auth user UUIDs).
- All admin routes must go through `requireAdmin` / `requireAdminProfile` (from `@/lib/admin-guard`).
- The static linter (`npm run test:security`) enforces that admin routes use the guard and that we don't regress to username-based or `is_admin` flag checks.

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
1. `npm run test:security` (static checks + expects certain files to be clean).
2. `npm run test:security:http` after `npm run start` (tests that admin routes reject unauthenticated requests and public routes don't leak sensitive fields/emails).
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

Last reviewed: 2026-06-14 (Grok security pass)
