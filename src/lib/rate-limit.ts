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
    console.error("[rate-limit] check failed with an unexpected error - failing closed", { key, error });
    return { allowed: false, retryAfterSeconds: 5 };
  }

  const result = data as { allowed?: boolean; retryAfterSeconds?: number } | null;

  return {
    allowed: result?.allowed === true,
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
