import { createCourtSealToken } from "@/lib/court-seal";
import { COURT_SEAL_BOARDS, getCourtSealShareText, type CourtSealBoard, type CourtSealPayload } from "@/lib/court-seal-shared";
import { SAMPLE_CRATE_ITEMS } from "@/lib/crates";
import { formatHandle } from "@/lib/username";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

const VALID_BOARDS = new Set<CourtSealBoard>(COURT_SEAL_BOARDS);

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

async function readBody(request: Request): Promise<{ board: CourtSealBoard; itemId: string | null } | null> {
  const body = await request.json().catch(() => ({})) as { board?: unknown; itemId?: unknown };
  const board = body.board === undefined ? "devotion" : body.board;
  if (typeof board !== "string" || !VALID_BOARDS.has(board as CourtSealBoard)) return null;
  return {
    board: board as CourtSealBoard,
    itemId: typeof body.itemId === "string" ? body.itemId : null,
  };
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) return jsonError("Court Seal is unavailable.", 503);

  const parsed = await readBody(request);
  if (!parsed) return jsonError("Invalid Court Seal type.", 400);
  const { board, itemId } = parsed;

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

  // The receipt boards carry a handle, because exposure is their point. It is
  // read from the profile here - never from the request - and left off when the
  // owner hides from leaderboards.
  if (board === "furnace" || board === "crate" || board === "tribute") {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username, display_name, hide_from_leaderboard, pm_burned_total")
      .eq("id", data.user.id)
      .single();
    if (profileError || !profile) {
      console.error("Court Seal profile lookup failed", profileError);
      return jsonError("Could not read your court record.", 500);
    }
    if (!profile.hide_from_leaderboard) {
      payload.handle = profile.display_name?.trim() || formatHandle(profile.username);
    }

    if (board === "furnace") {
      const burned = Math.max(0, Number(profile.pm_burned_total) || 0);
      if (burned <= 0) return jsonError("Burn something first.", 400);
      payload.burned = burned;
    }

    if (board === "crate") {
      // The client names the item; the open itself has to be on record.
      const item = itemId ? SAMPLE_CRATE_ITEMS[itemId] : undefined;
      if (!itemId || !item) return jsonError("Unknown item.", 400);
      const { data: open, error: openError } = await supabase
        .from("crate_opens")
        .select("id")
        .eq("user_id", data.user.id)
        .eq("item_id", itemId)
        .limit(1)
        .maybeSingle();
      if (openError) {
        console.error("Court Seal crate lookup failed", openError);
        return jsonError("Could not verify that pull.", 500);
      }
      if (!open) return jsonError("No record of you pulling that item.", 400);
      payload.itemId = itemId;
      payload.itemName = item.name;
      payload.rarity = item.rarity;
    }

    if (board === "tribute") {
      // USD figure: base Money of every public Throne tribute, which is 1:1
      // with dollars. Bonuses are deliberately not counted - the receipt says
      // what was SENT.
      const { data: rows, error: sumError } = await supabase
        .from("money_transactions")
        .select("amount, metadata")
        .eq("user_id", data.user.id)
        .eq("reason", "throne_tribute")
        .gt("amount", 0);
      if (sumError) {
        console.error("Court Seal tribute lookup failed", sumError);
        return jsonError("Could not read your tribute record.", 500);
      }
      const usd = (rows ?? []).reduce((sum, row) => {
        const metadata = (row.metadata ?? {}) as { throneMoneyBaseAmount?: number };
        return sum + Math.max(0, Number(metadata.throneMoneyBaseAmount) || Number(row.amount) || 0);
      }, 0);
      if (usd <= 0) return jsonError("Nothing on the ledger yet.", 400);
      payload.usd = usd;
    }
  }

  try {
    const token = createCourtSealToken(payload);
    return Response.json(
      { board, shareText: getCourtSealShareText(payload), url: `/s/${token}` },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (sealError) {
    console.error("Court Seal token creation failed", sealError);
    return jsonError("Court Seal is unavailable.", 503);
  }
}
