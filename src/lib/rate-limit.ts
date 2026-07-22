import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

/**
 * Fixed-window rate limit backed by the `check_rate_limit` Postgres function
 * (supabase/security-fixes-2026-07.sql). Works across Vercel serverless
 * invocations/regions because the counter lives in Postgres, not in memory.
 */
export async function checkRateLimit(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  key: string,
  maxCount: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_max_count: maxCount,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    // Only fail OPEN for the specific "function does not exist" case - that
    // means the security-fixes-2026-07.sql migration hasn't been deployed
    // yet, which is a deployment/config issue, not an attack, and shouldn't
    // take the whole feature down.
    //
    // Any OTHER error (a real, unexpected DB failure) fails CLOSED: silently
    // allowing every request through during a genuine rate-limiter outage on
    // a coin-spend/gamble endpoint is exactly the "protection silently
    // disabled" gap this exists to prevent - a short availability blip for
    // that one endpoint is the safer trade-off.
    const migrationMissing = error.code === "42883" || error.code === "PGRST202";

    if (migrationMissing) {
      console.error(
        "[rate-limit] check_rate_limit RPC is missing - deploy supabase/security-fixes-2026-07.sql. Allowing request through unlimited in the meantime.",
        { key },
      );
      return { allowed: true, retryAfterSeconds: 0 };
    }

    console.error("[rate-limit] check failed with an unexpected error - failing closed", { key, error });
    return { allowed: false, retryAfterSeconds: 5 };
  }

  const result = data as { allowed?: boolean; retryAfterSeconds?: number } | null;

  return {
    allowed: result?.allowed ?? true,
    retryAfterSeconds: Number(result?.retryAfterSeconds ?? 0),
  };
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return Response.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, retryAfterSeconds)),
        "X-RateLimit-Retry-After": String(Math.max(1, retryAfterSeconds)),
      },
    },
  );
}
