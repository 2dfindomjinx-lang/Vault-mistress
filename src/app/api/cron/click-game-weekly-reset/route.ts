import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { CLICK_GAME_CHAMPION_TITLE_ID } from "@/lib/click-game";
import { PLUSH_ITEM_ID, PLUSH_WEEKLY_COIN_REWARD } from "@/lib/birthday-plush";

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

  // The birthday plush pays its holders once a week. It rides on this cron
  // rather than a third one because it wants the same Monday boundary, and it
  // is keyed on p_week_start so a retry or a double fire cannot pay twice.
  const { data: stipend, error: stipendError } = await supabase.rpc("run_plush_weekly_stipend", {
    p_week_start: weekStart,
    p_item_id: PLUSH_ITEM_ID,
    p_amount: PLUSH_WEEKLY_COIN_REWARD,
  });

  if (stipendError) console.warn("Plush weekly stipend failed", stipendError);

  return Response.json({ result: data, plushStipend: stipendError ? null : stipend });
}
