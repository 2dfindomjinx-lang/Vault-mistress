import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  if (!isSupabaseAdminConfigured) return Response.json({ error: "Supabase is not configured." }, { status: 500 });
  const auth = await createSupabaseServerClient();
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const supabase = createSupabaseAdminClient();
  const { data: snapshots, error: snapshotError } = await supabase
    .from("site_daily_snapshots")
    .select("snapshot_date, devotion_rank, tribute_total, owner_likeness, loyalty_streak")
    .eq("user_id", data.user.id)
    .order("snapshot_date", { ascending: false })
    .limit(2);
  if (snapshotError) return Response.json({ card: null, configured: false });
  if (!snapshots || snapshots.length < 2) return Response.json({ card: null, configured: true });
  const [latest, previous] = snapshots;
  const changes = [
    latest.devotion_rank !== previous.devotion_rank && latest.devotion_rank !== null
      ? { label: `Devotion rank ${latest.devotion_rank > previous.devotion_rank ? "rose" : "fell"} ${Math.abs(latest.devotion_rank - previous.devotion_rank)} places`, href: "/devotion" }
      : null,
    latest.tribute_total !== previous.tribute_total ? { label: "The Court ledger moved while you were away", href: "/tribute" } : null,
    latest.owner_likeness !== previous.owner_likeness ? { label: `Owner likeness changed by ${latest.owner_likeness - previous.owner_likeness}`, href: "/tasks" } : null,
    latest.loyalty_streak !== previous.loyalty_streak ? { label: `Loyalty streak is now ${latest.loyalty_streak} days`, href: "/tasks" } : null,
  ].filter(Boolean);
  return Response.json({ card: changes.length >= 2 ? { from: previous.snapshot_date, to: latest.snapshot_date, changes } : null, configured: true });
}

