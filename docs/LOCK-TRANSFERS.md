# Principessa Lock transfer administration

Vault's existing Activation Codes log covers Discipline, Wallpaper Control and Techdom, not Lock. The existing `/api/admin/mobile/whoami` endpoint verifies Vault admin sessions for Lock's bridge. This change adds a separate `/admin/lock-transfers` screen, linked from Admin Console and Activation Codes.

The `/admin/principessa-lock` directory was empty in this checkout (no tracked page or existing log UI). It now has an admin-guarded entry page with a visible **Transfer History & Approvals** link to the new screen, preserving that requested navigation address without claiming a pre-existing integration.

## Configuration

- Set server-only `PRINCIPESSA_LOCK_BASE_URL` to the trusted HTTPS origin of the separate Lock backend (no path, query or credentials). HTTP localhost is allowed only outside production. Never use a `NEXT_PUBLIC_` variable.
- Lock must configure its existing `VAULT_MISTRESS_BASE_URL` and `ADMIN_EMAIL` bridge settings and deploy its access-transfer routes/migration separately.
- Existing Vault cookie login and `ADMIN_USER_IDS` authorization apply. No new admin key, database table, migration or copied transfer history is introduced in Vault.

## Data flow

Every proxy request uses `requireAdminProfile`. The server retrieves that verified user's Vault access token and exchanges it at Lock `POST /api/admin/vault-bridge`. Only the returned access token is used; refresh tokens are discarded. A bounded per-process cache binds credentials to the origin, verified admin and Vault session for at most five minutes (or earlier token expiry). Every use still requires fresh Vault admin authorization. New instances may bridge again; Lock's rate limit remains authoritative.

`GET /api/admin/lock-transfers` reads Lock `GET /api/admin/access-transfers`, returning only allow-listed transfer/event/source fields. Results preserve Lock's newest-first ordering, capped at 100 transfers and 200 events. The backend retains audit names. No codes or tokens are included in history.

Same-origin JSON `POST /api/admin/lock-transfers` accepts:

- `{ "action": "issue", "sourceDeviceId": "..." }` -> Lock `POST /api/admin/access-transfers` with `{sourceDeviceId}`.
- `{ "action": "approve", "transferId": "..." }` -> Lock `POST /api/admin/access-transfers/:id/approve`.
- `{ "action": "reject", "transferId": "..." }` -> Lock `POST /api/admin/access-transfers/:id/reject`.

The UI lists up to 1000 `eligibleSources` for issuance and offers review only for claimed, undecided, unexpired transfers with status `pending`. Lock enforces actual status transitions, lifetime entitlement, non-revoked devices and no active session at issue/approval. The frontend is not an authorization boundary.

Responses are private/no-store, redirects are refused, requests time out, upstream error bodies are not forwarded, and writes are never automatically retried. After ambiguous failures, refresh before retrying. Codes appear only in the successful issue response and transient component state, clear on another action, unmount, Hide Code, expiry or five minutes, and never enter URLs/storage/logs. Approve/reject results return only `{ok:true}`.

## Verification

Run `npm run test:lock-transfers`, `npm run test:lock-transfers:browser`, targeted ESLint, `npx tsc --noEmit --incremental false`, and `npm run build`. Isolated checks use mocked auth and fetch with no external writes. The browser check bundles the real panel and verifies issue/hide, no browser storage, conflict gating, failed refresh, approval and mobile content with a mocked API; it is not live integration or styled visual acceptance. Live two-product bridging, distributed rate limits, backend concurrency and physical-device entitlement changes require separate integration acceptance after Lock deployment. No deployment or version bump is part of this change.

If bundled Chromium is unavailable, set `LOCK_TEST_BROWSER_CHANNEL=msedge` (or `chrome`) to use an already installed browser. The test never contacts the real Lock backend.
