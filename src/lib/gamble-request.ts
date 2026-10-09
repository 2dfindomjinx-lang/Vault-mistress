import { profileSelect } from "./profile-columns";
import { checkRateLimit } from "./rate-limit";
import type { createSupabaseAdminClient } from "./supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;
export type GambleRpc = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

export class GambleRateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) { super("Gamble rate limit reached"); }
}

// Scoped to one HTTP request. Never retry a money mutation after an ambiguous
// network error; the legacy path is ONLY for an RPC absent from the schema cache.
export function createGambleRequest(db: Admin, userId: string, statusPoll: boolean, legacy = false) {
  let profile: Record<string, unknown> | null = null;
  let legacyLimited = false;
  const checkLegacyLimit = async () => {
    if (legacyLimited) return;
    const limit = await checkRateLimit(db, `${statusPoll ? "gamble-status" : "gamble"}:${userId}`, statusPoll ? 150 : 30, 60);
    if (!limit.allowed) throw new GambleRateLimitError(limit.retryAfterSeconds);
    legacyLimited = true;
  };
  const rpc: GambleRpc = async (name, args) => {
    if (!legacy) {
      const response = await db.rpc("gamble_request", {
        p_user_id: userId, p_operation: name, p_args: args,
      });
      if (response.error?.code === "PGRST202") {
        legacy = true;
      } else {
        if (response.error) return { data: null, error: response.error };
        const envelope = response.data as {
          result?: unknown; profile?: Record<string, unknown> | null;
          error?: string; retryAfterSeconds?: number;
        } | null;
        if (envelope?.error === "rate_limited") throw new GambleRateLimitError(envelope.retryAfterSeconds ?? 5);
        if (!envelope || envelope.error || !envelope.result) {
          return { data: null, error: { message: "Invalid gamble response" } };
        }
        // Keep the existing public profile contract, even if the DB adds fields.
        const source = envelope.profile;
        profile = source ? Object.fromEntries(profileSelect.split(/,\s*/).filter((key) => key in source).map((key) => [key, source[key]])) : null;
        return { data: envelope.result, error: null };
      }
    }
    await checkLegacyLimit();
    return await db.rpc(name, { ...args, p_user_id: userId });
  };
  return {
    rpc,
    checkLegacyLimit,
    async getProfile() {
      if (!legacy) return profile;
      const { data } = await db.from("profiles").select(profileSelect).eq("id", userId).single();
      return data;
    },
  };
}
