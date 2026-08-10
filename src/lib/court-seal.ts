import { createHmac, timingSafeEqual } from "node:crypto";
import type { CourtSealPayload } from "@/lib/court-seal-shared";

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
    if (!payload || !["devotion", "streak", "click"].includes(payload.board)) return null;
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

