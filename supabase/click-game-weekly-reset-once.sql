-- One-off manual run of the Click Game weekly champion determination, since
-- the new dedicated cron (vercel.json: "0 0 * * 1") hasn't been deployed yet.
-- Run this once in the Supabase SQL editor to close out the current week now
-- (pick the champion, grant the title on first win, reset weekly_clicks).
-- Safe to run only once per week - a second run this same week is a no-op
-- for the title/win-history grant (unique on user_id+week_start) but will
-- still reset weekly_clicks again, so don't run it twice.
select public.run_click_game_category_weekly_reset(
  (now() at time zone 'utc')::date,
  'click-game-weekly-champion'
);
