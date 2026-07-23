import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { isTrustedAdminUserId } from "@/lib/admin-identity";

type LeaderboardRow = {
  rank: number;
  avatarId: string;
  ownerUserId: string;
  totalPoints: number;
  ratingCount: number;
  createdAt: string;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();
  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const userId = authData.user.id;
  const isAdminViewer = isTrustedAdminUserId(userId);
  const supabase = createSupabaseAdminClient();

  const url = new URL(request.url);
  const rawSection = url.searchParams.get("section") ?? "top";
  const section = ["top", "highest_rated", "new"].includes(rawSection) ? rawSection : "top";

  const { data, error } = await supabase.rpc("get_runway_leaderboard", {
    p_section: section,
    p_limit: 20,
    // The leaderboard RPC's optional viewer record is singular. Admins may
    // own multiple active runway entries, so omit that optional row for them.
    p_viewer_id: isAdminViewer ? null : userId,
  });

  if (error) {
    console.error("[runway] leaderboard RPC failed", error);
    return jsonError(error.message, 500);
  }

  const payload = data as { section: string; leaders: LeaderboardRow[]; viewer: LeaderboardRow | null } | null;
  const leaders = payload?.leaders ?? [];
  const viewerRow = payload?.viewer ?? null;

  const ownerIds = Array.from(
    new Set([...leaders.map((row) => row.ownerUserId), ...(viewerRow ? [viewerRow.ownerUserId] : [])]),
  );

  if (ownerIds.length === 0) {
    return Response.json({ section, leaders: [], viewer: null });
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", ownerIds);

  if (profilesError) {
    console.error("[runway] leaderboard profile lookup failed", profilesError);
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

  const buildEntry = (row: LeaderboardRow) => {
    const profile = profileMap.get(row.ownerUserId);
    return {
      rank: row.rank,
      avatarId: row.avatarId,
      ownerUserId: row.ownerUserId,
      username: profile?.username ?? "@unknown",
      displayName: profile?.displayName ?? null,
      totalPoints: row.totalPoints,
      ratingCount: row.ratingCount,
      averageRating: row.ratingCount > 0 ? row.totalPoints / row.ratingCount : null,
      createdAt: row.createdAt,
    };
  };

  return Response.json({
    section,
    leaders: leaders.map(buildEntry),
    viewer: viewerRow ? buildEntry(viewerRow) : null,
  });
}
