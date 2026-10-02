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

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    console.error("Public duels feed is not configured", getSupabaseAdminConfigErrors());
    return Response.json({ active: 0, crateDuels: [], crateOpen: 0, open: 0 }, { status: 503 });
  }

  const supabase = createSupabaseAdminClient();
  const [openResult, activeResult, crateOpenResult, cratePreviewResult] = await Promise.all([
    supabase.from("tribute_duels").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("tribute_duels").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("crate_duels").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase
      .from("crate_duels")
      .select("crate_type, crate_cost, crates, total_cost, quantity, expires_at")
      .eq("status", "open")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const crateDuels: CrateDuelPreview[] = (cratePreviewResult.data ?? []).map((row) => ({
    crates:
      Array.isArray(row.crates) && row.crates.length > 0
        ? (row.crates as string[])
        : Array.from({ length: row.quantity as number }, () => row.crate_type as string),
    expiresAt: row.expires_at as string,
    totalCost: (row.total_cost as number | null) ?? (row.crate_cost as number) * (row.quantity as number),
  }));

  return Response.json(
    { active: activeResult.count ?? 0, crateDuels, crateOpen: crateOpenResult.count ?? 0, open: openResult.count ?? 0 },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" } },
  );
}
