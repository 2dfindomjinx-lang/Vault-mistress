import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

// Feeds the site-wide duel banner. Public because the banner renders on every
// page, signed in or not, so it carries nothing personal: counts, plus what a
// waiting crate duel is made of (crate types, total cost, expiry) - never who
// opened it. Covers both duel types - Tribute Duels (Throne spending) and
// Crate Duels (a sealed crate roll) - since both are "a stranger is waiting,
// come accept" calls to arms that share the same banner.

type CrateDuelPreview = { crates: string[]; expiresAt: string; totalCost: number };
type Payload = { crateDuels: CrateDuelPreview[]; crateOpen: number; open: number };

// Every visitor's banner polls this. A short in-memory cache means a burst of
// visitors on the same server instance shares one pair of database requests
// instead of each triggering their own (Supabase counts every request in its
// log ingestion quota).
const CACHE_MS = 30_000;
let cached: { at: number; body: Payload } | null = null;

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    console.error("Public duels feed is not configured", getSupabaseAdminConfigErrors());
    return Response.json({ crateDuels: [], crateOpen: 0, open: 0 }, { status: 503 });
  }

  const headers = { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" };
  if (cached && Date.now() - cached.at < CACHE_MS) return Response.json(cached.body, { headers });

  const supabase = createSupabaseAdminClient();
  // Two requests, not four: the crate duel query returns its exact count along
  // with the preview rows, and the unused "active" tribute count is gone.
  const [openResult, crateResult] = await Promise.all([
    supabase.from("tribute_duels").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase
      .from("crate_duels")
      .select("crate_type, crate_cost, crates, total_cost, quantity, expires_at", { count: "exact" })
      .eq("status", "open")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  if (openResult.error || crateResult.error) {
    console.error("[public-duels] lookup failed", openResult.error ?? crateResult.error);
    return Response.json({ error: "Duels are temporarily unavailable." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }

  const crateDuels: CrateDuelPreview[] = (crateResult.data ?? []).map((row) => ({
    crates:
      Array.isArray(row.crates) && row.crates.length > 0
        ? (row.crates as string[])
        : Array.from({ length: row.quantity as number }, () => row.crate_type as string),
    expiresAt: row.expires_at as string,
    totalCost: (row.total_cost as number | null) ?? (row.crate_cost as number) * (row.quantity as number),
  }));

  const body: Payload = { crateDuels, crateOpen: crateResult.count ?? 0, open: openResult.count ?? 0 };
  cached = { at: Date.now(), body };
  return Response.json(body, { headers });
}
