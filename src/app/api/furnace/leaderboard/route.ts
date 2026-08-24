import { formatHandle } from "@/lib/username";
import type { FurnaceLeaderboardEntry } from "@/lib/tribute-furnace";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

type FurnaceRow = {
  username: string | null;
  display_name: string | null;
  burned: number | null;
  rank: number | null;
};

// Public: the board is the whole reward, so it has to be readable by anyone -
// including someone who has not signed in yet and is deciding whether to.
export async function GET() {
  if (!isSupabaseAdminConfigured) {
    console.error("Furnace leaderboard is not configured", getSupabaseAdminConfigErrors());
    return Response.json({ leaders: [] }, { status: 503 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("get_furnace_leaderboard", { p_limit: 20 });

  if (error) {
    console.error("Furnace leaderboard lookup failed", error);
    return Response.json({ error: "The furnace ledger is temporarily unavailable." }, { status: 500 });
  }

  const leaders = ((data ?? []) as FurnaceRow[]).map<FurnaceLeaderboardEntry>((row) => ({
    burned: Math.max(0, Number(row.burned) || 0),
    displayName: row.display_name?.trim() || null,
    rank: Number(row.rank) || 0,
    username: row.username ? formatHandle(row.username) : null,
  }));

  return Response.json(
    { leaders },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" } },
  );
}
