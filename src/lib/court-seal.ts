import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { COURT_SEAL_BOARDS, type CourtSealPayload } from "@/lib/court-seal-shared";

export type { CourtSealBoard, CourtSealPayload } from "@/lib/court-seal-shared";

function getSecret() {
  return process.env.COURT_SEAL_SECRET ?? "";
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createCourtSealToken(payload: CourtSealPayload) {
  if (!getSecret()) throw new Error("COURT_SEAL_SECRET is not configured.");
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyCourtSealToken(token: string): CourtSealPayload | null {
  if (!getSecret()) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(decode(encoded)) as CourtSealPayload;
    if (!payload || !COURT_SEAL_BOARDS.includes(payload.board)) return null;
    if (
      !Number.isInteger(payload.createdAt) ||
      payload.createdAt > Date.now() + 1000 * 60 * 5 ||
      Date.now() - payload.createdAt > 1000 * 60 * 60 * 24 * 365
    ) return null;
    if (payload.rank !== undefined && (!Number.isInteger(payload.rank) || payload.rank < 1)) return null;
    if (payload.streak !== undefined && (!Number.isInteger(payload.streak) || payload.streak < 0)) return null;
    if (payload.clicks !== undefined && (!Number.isInteger(payload.clicks) || payload.clicks < 0)) return null;
    if (payload.board === "streak" && payload.streak === undefined) return null;
    if (payload.board === "click" && payload.clicks === undefined) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- short slugs
// A seal link used to carry its whole signed payload in the path, which read
// as line noise on X. New seals are stored rows behind an 8-char slug; the
// signed-token form stays verifiable so old links never die.

const SLUG_PATTERN = /^[a-z0-9]{8}$/;

export function generateSealSlug() {
  return randomBytes(6).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").padEnd(8, "0").slice(0, 8);
}

export async function storeSealSlug(payload: CourtSealPayload, userId: string | null): Promise<string | null> {
  if (!isSupabaseAdminConfigured) return null;
  const supabase = createSupabaseAdminClient();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = generateSealSlug();
    const { error } = await supabase.from("court_seals").insert({ payload, slug, user_id: userId });
    if (!error) return slug;
    // 23505 = slug collision, retry; anything else (e.g. table not migrated
    // yet) falls back to the signed-token URL so minting never breaks.
    if (error.code !== "23505") return null;
  }
  return null;
}

export async function resolveSealPayload(tokenOrSlug: string): Promise<CourtSealPayload | null> {
  if (SLUG_PATTERN.test(tokenOrSlug)) {
    if (!isSupabaseAdminConfigured) return null;
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase.from("court_seals").select("payload").eq("slug", tokenOrSlug).maybeSingle();
    const payload = (data?.payload ?? null) as CourtSealPayload | null;
    if (!payload || !COURT_SEAL_BOARDS.includes(payload.board)) return null;
    return payload;
  }
  return verifyCourtSealToken(tokenOrSlug);
}
