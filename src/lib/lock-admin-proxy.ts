import "server-only";
import { createHash } from "node:crypto";
import { requireAdminProfile } from "@/lib/admin-guard";
import { createClient } from "@/lib/supabase/server";
import type { LockTransferHistory } from "@/lib/lock-transfer-types";

class ProxyError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type BridgeSession = { token: string; expiresAt: number };
// Never persist bridge credentials or share them across Vault sessions/origins.
const sessions = new Map<string, Promise<BridgeSession>>();

export function lockJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" },
  });
}

function lockOrigin() {
  try {
    const url = new URL(process.env.PRINCIPESSA_LOCK_BASE_URL ?? "");
    const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
        url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error();
    return url.origin;
  } catch {
    throw new ProxyError(503, "Lock integration is not configured. Set PRINCIPESSA_LOCK_BASE_URL to the trusted Lock origin.");
  }
}

async function upstream(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    // Never forward an upstream error body: it may contain credentials or internal details.
    const status = [400, 401, 403, 404, 409, 410, 429].includes(response.status) ? response.status : 502;
    const message = status === 409 || status === 410
      ? "Transfer state changed or is no longer eligible. Refresh before continuing."
      : status === 429 ? "Lock is rate limited. Please wait before retrying."
      : status === 401 || status === 403 ? "Lock admin authorization failed. Refresh or sign in again."
      : "Lock request failed. Refresh to check its current state before retrying.";
    throw new ProxyError(status, message);
  }
  const body = await response.json();
  if (!body || body.ok !== true) throw new ProxyError(502, "Invalid Lock response.");
  return body;
}

async function bridge(origin: string, vaultAccessToken: string): Promise<BridgeSession> {
  const body = await upstream(`${origin}/api/admin/vault-bridge`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vaultAccessToken }),
  });
  const token = body.session?.accessToken;
  const expiresAt = body.session?.expiresAt;
  if (typeof token !== "string" || !token || typeof expiresAt !== "number" || expiresAt * 1000 <= Date.now() + 30_000) {
    throw new ProxyError(502, "Invalid Lock admin session.");
  }
  return { token, expiresAt: Math.min(expiresAt * 1000 - 30_000, Date.now() + 5 * 60_000) };
}

async function bridgeSession(key: string, origin: string, vaultAccessToken: string): Promise<BridgeSession> {
  let pending = sessions.get(key);
  if (!pending) {
    if (sessions.size >= 64) sessions.clear();
    pending = bridge(origin, vaultAccessToken);
    // Register before awaiting so concurrent requests cannot mint duplicate sessions.
    sessions.set(key, pending);
  }
  try {
    const session = await pending;
    if (session.expiresAt > Date.now()) return session;
    if (sessions.get(key) === pending) sessions.delete(key);
    return bridgeSession(key, origin, vaultAccessToken);
  } catch (error) {
    if (sessions.get(key) === pending) sessions.delete(key);
    throw error;
  }
}

async function lockRequest(adminId: string, path: string, method: "GET" | "POST", body?: unknown) {
  const origin = lockOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();
  // Identity was verified by requireAdminProfile; getSession only supplies its bearer token.
  if (error || !data.session?.access_token || data.session.user.id !== adminId) {
    throw new ProxyError(401, "Admin session expired. Sign in again.");
  }
  const key = createHash("sha256").update(`${origin}:${adminId}:${data.session.access_token}`).digest("hex");
  const session = await bridgeSession(key, origin, data.session.access_token);
  try {
    return await upstream(`${origin}/api/admin/access-transfers${path}`, {
      method,
      headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (error instanceof ProxyError && [401, 403].includes(error.status)) sessions.delete(key);
    throw error;
  }
}

function pickRows(value: unknown, fields: readonly string[], limit: number) {
  if (!Array.isArray(value)) throw new ProxyError(502, "Invalid Lock history response.");
  return value.slice(0, limit).map((row: unknown) => {
    if (!row || typeof row !== "object") throw new ProxyError(502, "Invalid Lock history row.");
    const record = row as Record<string, unknown>;
    // Allow-list scalar fields rather than forwarding secrets added to the upstream contract.
    return Object.fromEntries(fields.map((field) => {
      const item = record[field];
      if (item !== null && typeof item !== "string") throw new ProxyError(502, "Invalid Lock history field.");
      return [field, item];
    }));
  });
}

function history(body: Record<string, unknown>): LockTransferHistory {
  return {
    transfers: pickRows(body.transfers, ["id", "status", "source_sub_id", "source_device_id", "target_sub_id", "target_device_id", "created_at", "expires_at", "requested_at", "decided_at", "source_username", "source_device_name", "target_username", "target_device_name"], 100),
    events: pickRows(body.events, ["id", "transfer_id", "event_type", "actor", "created_at"], 200),
    eligibleSources: pickRows(body.eligibleSources, ["id", "sub_id", "device_name", "username"], 1000),
  } as LockTransferHistory;
}

const validId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);

export async function handleLockTransfers(request: Request) {
  try {
    const admin = await requireAdminProfile();
    if ("error" in admin) return lockJson({ error: "Admin access required." }, admin.status);

    if (request.method === "GET") {
      return lockJson({ ok: true, ...history(await lockRequest(admin.adminUser.id, "", "GET")) });
    }
    if (request.method !== "POST") return lockJson({ error: "Method not allowed." }, 405);
    // Cookie-authenticated mutations must originate from this Vault origin, not another site.
    if (request.headers.get("origin") !== new URL(request.url).origin ||
        request.headers.get("sec-fetch-site") === "cross-site") {
      return lockJson({ error: "Same-origin request required." }, 403);
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return lockJson({ error: "JSON required." }, 415);
    }
    const raw = await request.text();
    if (raw.length > 2048) return lockJson({ error: "Request too large." }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return lockJson({ error: "Invalid JSON." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return lockJson({ error: "Invalid action." }, 400);
    if (body.action === "issue" && validId(body.sourceDeviceId)) {
      const result = await lockRequest(admin.adminUser.id, "", "POST", { sourceDeviceId: body.sourceDeviceId });
      if (typeof result.code !== "string" || typeof result.expiresAt !== "string") throw new ProxyError(502, "Invalid Lock issue response. Refresh before retrying.");
      return lockJson({ ok: true, code: result.code, expiresAt: result.expiresAt });
    }
    if (["approve", "reject"].includes(body.action) && validId(body.transferId)) {
      await lockRequest(admin.adminUser.id, `/${encodeURIComponent(body.transferId)}/${body.action}`, "POST", {});
      return lockJson({ ok: true });
    }
    return lockJson({ error: "Invalid transfer action or identifier." }, 400);
  } catch (error) {
    return lockJson({ error: error instanceof ProxyError ? error.message : "Lock is unavailable. Refresh to check the current state before retrying." }, error instanceof ProxyError ? error.status : 502);
  }
}
