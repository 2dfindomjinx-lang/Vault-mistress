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

type VotingAvatarSnapshot = {
  id: string;
  equipped_avatar_slots: Record<string, string> | null;
  equipped_full_set_id: string | null;
  has_uncensored_avatar: boolean | null;
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
  const avatarIds = Array.from(
    new Set([...leaders.map((row) => row.avatarId), ...(viewerRow ? [viewerRow.avatarId] : [])]),
  );

  if (ownerIds.length === 0) {
    return Response.json({ section, leaders: [], viewer: null });
  }

  const [profilesResult, avatarsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", ownerIds),
    supabase
      .from("voting_avatars")
      .select("id, equipped_avatar_slots, equipped_full_set_id, has_uncensored_avatar")
      .in("id", avatarIds),
  ]);

  if (profilesResult.error) {
    console.error("[runway] leaderboard profile lookup failed", profilesResult.error);
  }
  if (avatarsResult.error) {
    console.error("[runway] leaderboard avatar lookup failed", avatarsResult.error);
  }

  const profileMap = new Map(
    (profilesResult.data ?? []).map((profile) => [
      String(profile.id),
      {
        username: profile.username ? `@${String(profile.username).replace(/^@/, "")}` : "@unknown",
        displayName: profile.display_name ?? null,
      },
    ]),
  );
  const avatarMap = new Map(
    ((avatarsResult.data ?? []) as VotingAvatarSnapshot[]).map((avatar) => [avatar.id, avatar]),
  );

  const buildEntry = (row: LeaderboardRow) => {
    const profile = profileMap.get(row.ownerUserId);
    const avatar = avatarMap.get(row.avatarId);
    return {
      rank: row.rank,
      avatarId: row.avatarId,
      ownerUserId: row.ownerUserId,
      username: profile?.username ?? "@unknown",
      displayName: profile?.displayName ?? null,
      equippedAvatarSlots: avatar?.equipped_avatar_slots ?? {},
      equippedFullSetId: avatar?.equipped_full_set_id ?? null,
      hasUncensoredAvatar: Boolean(avatar?.has_uncensored_avatar),
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
