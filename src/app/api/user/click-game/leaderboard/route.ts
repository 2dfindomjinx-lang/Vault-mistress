import type { ClickGameLeaderboardEntry, ClickGameWinHistoryEntry } from "@/lib/click-game";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type RawLeaderRow = { rank: number; userId: string; weeklyClicks: number };
type RawWinRow = { userId: string; winCount: number; lastWonWeekStart: string };

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function getAuthedUserId() {
  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return { error: jsonError(authError?.message ?? "Authentication required.", 401), userId: null };
  }

  return { error: null, userId: authData.user.id };
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authResult = await getAuthedUserId();
  if (authResult.error) return authResult.error;

  const supabase = createSupabaseAdminClient();
  const userId = authResult.userId!;

  // Single combined leaderboard across all 5 categories - a user's clicks in
  // classic/censored/pixel/huge_breasts/huge_ass all count toward the same
  // ranking, not five separate per-category boards.
  const { data, error } = await supabase.rpc("click_game_combined_leaderboard", {
    p_limit: 20,
    p_viewer_id: userId,
  });

  if (error) {
    console.error("[click-game] leaderboard failed", error);
    return jsonError(error.message, 500);
  }

  const rawLeaders = (data?.leaders ?? []) as RawLeaderRow[];
  const rawViewer = data?.viewer as RawLeaderRow | null;
  const rawWinHistory = (data?.winHistory ?? []) as RawWinRow[];

  const allUserIds = Array.from(
    new Set([
      ...rawLeaders.map((row) => row.userId),
      ...(rawViewer ? [rawViewer.userId] : []),
      ...rawWinHistory.map((row) => row.userId),
    ]),
  );

  if (allUserIds.length === 0) {
    return Response.json({ leaders: [], viewerEntry: null, winHistory: [] });
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", allUserIds);

  if (profilesError) {
    console.error("[click-game] leaderboard profile lookup failed", profilesError);
  }

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [
      String(profile.id),
      {
        username: profile.username ? `@${String(profile.username).replace(/^@/, "")}` : "@unknown",
        displayName: profile.display_name ?? null,
      },
    ]),
  );

  const buildEntry = (row: RawLeaderRow): ClickGameLeaderboardEntry => {
    const profile = profileMap.get(row.userId);
    return {
      rank: row.rank,
      userId: row.userId,
      username: profile?.username ?? "@unknown",
      displayName: profile?.displayName ?? null,
      weeklyClicks: row.weeklyClicks,
    };
  };

  const winHistory: ClickGameWinHistoryEntry[] = rawWinHistory.map((row) => {
    const profile = profileMap.get(row.userId);
    return {
      userId: row.userId,
      username: profile?.username ?? "@unknown",
      displayName: profile?.displayName ?? null,
      winCount: row.winCount,
      lastWonWeekStart: row.lastWonWeekStart,
    };
  });

  return Response.json({
    leaders: rawLeaders.map(buildEntry),
    viewerEntry: rawViewer ? buildEntry(rawViewer) : null,
    winHistory,
  });
}
