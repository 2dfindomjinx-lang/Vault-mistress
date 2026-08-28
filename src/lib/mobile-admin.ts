import { createHash, timingSafeEqual } from "node:crypto";

import {
  getTrustedAdminUserIds,
  isTrustedAdminUserId,
  normalizeAdminUsername,
} from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MIN_ADMIN_API_KEY_LENGTH = 32;

/**
 * Constant-time compare of a presented bearer against MOBILE_ADMIN_API_KEY.
 *
 * Both sides are hashed first so timingSafeEqual always receives equal-length buffers -- it
 * throws on a length mismatch, and that throw would itself leak the key length.
 */
function matchesAdminApiKey(candidate: string) {
  const expected = process.env.MOBILE_ADMIN_API_KEY?.trim();

  if (!expected || expected.length < MIN_ADMIN_API_KEY_LENGTH) {
    return false;
  }

  return timingSafeEqual(
    createHash("sha256").update(candidate).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

/**
 * The key authenticates "the admin", but the rest of the code needs a real profile id to write
 * against. Prefer an explicit MOBILE_ADMIN_USER_ID; otherwise fall back to ADMIN_USER_IDS when it
 * names exactly one admin, which is the single-admin setup this app is built for.
 */
function resolveApiKeyAdminUserId() {
  const explicit = process.env.MOBILE_ADMIN_USER_ID?.trim();

  if (explicit) {
    return isTrustedAdminUserId(explicit) ? explicit : null;
  }

  const trusted = Array.from(getTrustedAdminUserIds());

  return trusted.length === 1 ? trusted[0] : null;
}

async function loadAdminProfile(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { error: error.message, status: 500 } as const;
  }

  return {
    adminUser: { id: userId },
    adminProfile: {
      id: profile?.id ?? userId,
      username: normalizeAdminUsername(profile?.username ?? null),
    },
    supabase,
  } as const;
}

export async function requireMobileAdmin(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";

  if (!bearer) {
    return { error: "Missing bearer token", status: 401 } as const;
  }

  // Long-lived admin key. Supabase access tokens expire hourly and a broken refresh silently
  // signs the companion app out; this path exists so the single admin device can stay signed in.
  if (matchesAdminApiKey(bearer)) {
    const userId = resolveApiKeyAdminUserId();

    if (!userId) {
      return {
        error: "Admin key accepted but no admin user id is configured. Set MOBILE_ADMIN_USER_ID.",
        status: 500,
      } as const;
    }

    return loadAdminProfile(userId);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(bearer);

  if (error || !data.user) {
    return { error: "Invalid session", status: 401 } as const;
  }

  if (!isTrustedAdminUserId(data.user.id)) {
    return { error: "Admin access only.", status: 403 } as const;
  }

  return loadAdminProfile(data.user.id);
}
