import { requireAdminProfile } from "@/lib/admin-guard";
import { CLICK_GAME_CHAMPION_TITLE_ID } from "@/lib/click-game";
import { getGmt3DateKey } from "@/lib/time";

// Manual fallback for the Click Game weekly champion determination, which
// otherwise only ever runs as a side effect of the daily data-retention cron
// on the one GMT+3 Monday boundary it happens to hit. Lets an admin verify
// or re-trigger it on demand instead of only finding out it silently no-op'd
// after the fact.
export async function POST() {
  const admin = await requireAdminProfile();
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });

  const { data, error } = await admin.supabase.rpc("run_click_game_category_weekly_reset", {
    p_week_start: getGmt3DateKey(),
    p_title_id: CLICK_GAME_CHAMPION_TITLE_ID,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  let winnerProfile: { username: string; display_name: string | null } | null = null;
  const winnerUserId = (data as { winnerUserId?: string | null } | null)?.winnerUserId ?? null;
  if (winnerUserId) {
    const { data: profile } = await admin.supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", winnerUserId)
      .maybeSingle();
    winnerProfile = profile ?? null;
  }

  return Response.json({ result: data, winnerProfile });
}
