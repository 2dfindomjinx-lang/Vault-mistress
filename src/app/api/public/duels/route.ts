import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

// Feeds the site-wide duel banner: just the counts, nothing personal. Public
// because the banner renders on every page, signed in or not. Covers both
// duel types - Tribute Duels (Throne spending) and Crate Duels (a sealed
// crate roll) - since both are "a stranger is waiting, come accept" calls to
// arms that share the same banner.
export async function GET() {
  if (!isSupabaseAdminConfigured) {
    console.error("Public duels feed is not configured", getSupabaseAdminConfigErrors());
    return Response.json({ active: 0, crateOpen: 0, open: 0 }, { status: 503 });
  }

  const supabase = createSupabaseAdminClient();
  const [openResult, activeResult, crateOpenResult] = await Promise.all([
    supabase.from("tribute_duels").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("tribute_duels").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("crate_duels").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  return Response.json(
    { active: activeResult.count ?? 0, crateOpen: crateOpenResult.count ?? 0, open: openResult.count ?? 0 },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" } },
  );
}
