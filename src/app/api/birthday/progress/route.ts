import { createHash } from "node:crypto";
import {
  BIRTHDAY_CANDLE_USD,
  BIRTHDAY_ENDS_AT,
  BIRTHDAY_SHOW_SUPPORTER_NAMES,
  BIRTHDAY_STARTS_AT,
  BIRTHDAY_TARGET_CANDLES,
  type BirthdayCandle,
  type BirthdayProgress,
} from "@/lib/birthday";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

function requestFingerprint(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || forwardedFor
    || "unknown";
  return createHash("sha256").update(address).digest("hex").slice(0, 24);
}

// Public on purpose - /birthday-2026 is a shareable link that must render for
// someone who has never logged in, so there is no auth check here. The RPC
// returns only aggregate dollars plus the handles of tributes that already
// carried a tribute code, and takes no caller-supplied input: the window and
// the candle rate come from src/lib/birthday.ts, never from the request.
export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured) {
    console.error("Birthday progress is not configured", getSupabaseAdminConfigErrors());
    return Response.json(
      {
        code: "BIRTHDAY_PROGRESS_NOT_CONFIGURED",
        error: "Birthday progress is not configured.",
      },
      { status: 503 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const rateLimit = await checkRateLimit(
    supabase,
    `birthday-progress:${requestFingerprint(request)}`,
    120,
    60,
  );
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);

  const { data, error } = await supabase.rpc("get_public_birthday_progress", {
    p_candle_usd: BIRTHDAY_CANDLE_USD,
    p_ends_at: BIRTHDAY_ENDS_AT,
    p_starts_at: BIRTHDAY_STARTS_AT,
    p_target_candles: BIRTHDAY_TARGET_CANDLES,
  });

  if (error) {
    console.error("Birthday progress RPC failed", error);
    return Response.json(
      { code: "BIRTHDAY_PROGRESS_RPC_FAILED", error: "Live candle progress is temporarily unavailable." },
      { status: 500 },
    );
  }

  const raw = (data ?? null) as BirthdayProgress | null;
  const rawLit = Array.isArray(raw?.lit) ? raw.lit : [];
  const litByIndex = new Map<number, BirthdayCandle>();
  for (const candle of rawLit) {
    const index = Number(candle.index);
    if (!Number.isInteger(index) || index < 1 || index > BIRTHDAY_TARGET_CANDLES || litByIndex.has(index)) continue;
    litByIndex.set(index, candle);
  }
  const lit = Array.from(litByIndex.values()).sort((left, right) => Number(left.index) - Number(right.index));

  const progress: BirthdayProgress = {
    candleUsd: BIRTHDAY_CANDLE_USD,
    candlesLit: lit.length,
    // Strip the handles server-side rather than in the component, so flipping
    // the flag off cannot be undone by reading the network response.
    lit: lit.map<BirthdayCandle>((candle) => ({
      displayName: BIRTHDAY_SHOW_SUPPORTER_NAMES ? candle.displayName ?? null : null,
      index: Number(candle.index) || 0,
      litAt: candle.litAt ?? null,
      username: BIRTHDAY_SHOW_SUPPORTER_NAMES ? candle.username ?? null : null,
    })),
    raisedUsd: Math.max(0, Number(raw?.raisedUsd) || 0),
  };

  return Response.json(
    { progress },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=20" } },
  );
}
