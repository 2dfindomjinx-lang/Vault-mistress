import { footballInspiredRotatingBorders } from "@/lib/profile-border-cosmetics";

// Approved release window. A deployment may override it once; keep the same value on rebuilds.
export const WORLD_CUP_FAREWELL_START_AT = process.env.NEXT_PUBLIC_WORLD_CUP_FAREWELL_START_AT || "2026-09-12T19:35:28.204Z";
export const WORLD_CUP_FAREWELL_DAYS = 7;
// The World Cup collection includes both club and national-team borders.
const worldCupBorderIds = new Set(footballInspiredRotatingBorders.map((item) => item.id));

export function isWorldCupBorder(itemId: string) {
  return worldCupBorderIds.has(itemId);
}
export function getWorldCupFarewell(now = Date.now()) {
  const startsAt = Date.parse(WORLD_CUP_FAREWELL_START_AT);
  const endsAt = startsAt + WORLD_CUP_FAREWELL_DAYS * 86_400_000;
  return { active: Number.isFinite(startsAt) && now >= startsAt && now < endsAt, endsAt: Number.isFinite(endsAt) ? new Date(endsAt).toISOString() : null };
}

/** Keep catalog list prices intact; only an active farewell purchase receives the discount. */
export function getCosmeticPurchasePrice(item: { id: string; price: number }, now = Date.now()) {
  return isWorldCupBorder(item.id) && getWorldCupFarewell(now).active ? Math.floor(item.price / 2) : item.price;
}
