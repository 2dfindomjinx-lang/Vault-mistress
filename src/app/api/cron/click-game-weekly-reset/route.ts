import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { CLICK_GAME_CHAMPION_TITLE_ID } from "@/lib/click-game";

// Dedicated cron (vercel.json: "0 0 * * 1") so the Click Game weekly champion
// is determined at exactly UTC Monday 00:00, independent of whatever time the
// daily data-retention job happens to run.
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "Unauthorized cron request." }, { status: 401 });
  if (!isSupabaseAdminConfigured) return Response.json({ error: "Supabase admin is not configured." }, { status: 500 });

  const supabase = createSupabaseAdminClient();
  const weekStart = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc("run_click_game_category_weekly_reset", {
    p_week_start: weekStart,
    p_title_id: CLICK_GAME_CHAMPION_TITLE_ID,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ result: data });
}
