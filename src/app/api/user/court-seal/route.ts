import { createCourtSealToken } from "@/lib/court-seal";
import type { CourtSealBoard, CourtSealPayload } from "@/lib/court-seal-shared";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

const COURT_SEAL_BOARDS = new Set<CourtSealBoard>(["devotion", "streak", "click"]);

type DevotionViewerRow = {
  rank?: number | string;
  row_type?: string;
  user_id?: string;
};

type ClickViewerRow = {
  rank?: number | string;
  userId?: string;
  weeklyClicks?: number | string;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readBoard(request: Request): Promise<CourtSealBoard | null> {
  const body = await request.json().catch(() => ({})) as { board?: unknown };
  if (body.board === undefined) return "devotion";
  return typeof body.board === "string" && COURT_SEAL_BOARDS.has(body.board as CourtSealBoard)
    ? body.board as CourtSealBoard
    : null;
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) return jsonError("Court Seal is unavailable.", 503);

  const board = await readBoard(request);
  if (!board) return jsonError("Invalid Court Seal type.", 400);

  const auth = await createSupabaseServerClient();
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) return jsonError("Authentication required.", 401);

  const supabase = createSupabaseAdminClient();
  const payload: CourtSealPayload = { board, createdAt: Date.now() };

  if (board === "devotion") {
    const { data: ranking, error: rankingError } = await supabase.rpc("get_devotion_leaderboard", {
      p_limit: 1,
      p_period: "all_time",
      p_viewer_id: data.user.id,
    });
    if (rankingError) {
      console.error("Court Seal devotion lookup failed", rankingError);
      return jsonError("Could not read your Devotion rank.", 500);
    }
    const viewer = ((ranking ?? []) as DevotionViewerRow[]).find(
      (row) => row.row_type === "viewer" && row.user_id === data.user.id,
    );
    if (viewer?.rank) payload.rank = Number(viewer.rank);
  }

  if (board === "streak") {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("loyalty_streak")
      .eq("id", data.user.id)
      .single();
    if (profileError || !profile) {
      console.error("Court Seal streak lookup failed", profileError);
      return jsonError("Could not read your loyalty streak.", 500);
    }
    payload.streak = Math.max(0, Number(profile.loyalty_streak ?? 0));
  }

  if (board === "click") {
    const { data: leaderboard, error: leaderboardError } = await supabase.rpc(
      "click_game_combined_leaderboard",
      { p_limit: 1, p_viewer_id: data.user.id },
    );
    if (leaderboardError) {
      console.error("Court Seal click lookup failed", leaderboardError);
      return jsonError("Could not read your weekly Click rank.", 500);
    }
    const viewer = leaderboard?.viewer as ClickViewerRow | null;
    if (viewer?.rank) payload.rank = Number(viewer.rank);
    payload.clicks = Math.max(0, Number(viewer?.weeklyClicks ?? 0));
  }

  try {
    const token = createCourtSealToken(payload);
    return Response.json(
      { board, url: `/s/${token}` },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (sealError) {
    console.error("Court Seal token creation failed", sealError);
    return jsonError("Court Seal is unavailable.", 503);
  }
}
