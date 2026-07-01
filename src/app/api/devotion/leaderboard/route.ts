import {
  getDevotionFrameVariant,
  normalizeDevotionPeriod,
  type DevotionLeaderboardEntry,
} from "@/lib/devotion";
import { getCosmeticItem, getTitleItem, getSpendBadge } from "@/lib/cosmetics";
import { getLeadershipRank } from "@/lib/leadership";
import { getUsernameStylesByUserId, type EquippedUsernameCosmeticRow } from "@/lib/username-styles";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type RpcRow = {
  devotion: number | string | null;
  rank: number | string | null;
  row_type: "top" | "viewer";
  user_id: string;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(
      `Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`,
      500,
    );
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const url = new URL(request.url);
  const period = normalizeDevotionPeriod(url.searchParams.get("period"));
  const supabase = createSupabaseAdminClient();
  const { data: rows, error: rpcError } = await supabase.rpc("get_devotion_leaderboard", {
    p_limit: 20,
    p_period: period,
    p_viewer_id: authData.user.id,
  });

  if (rpcError) {
    console.error("Devotion leaderboard RPC failed", rpcError);
    return jsonError(rpcError.message, 500);
  }

  const rankingRows = ((rows ?? []) as RpcRow[]).filter((row) => row?.user_id);
  const userIds = Array.from(new Set(rankingRows.map((row) => String(row.user_id))));

  if (userIds.length === 0) {
    return Response.json({
      currentUserEntry: null,
      leaders: [],
      period,
    });
  }

  const [profileResult, cosmeticResult, titleResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, username, display_name, equipped_avatar_slots, has_uncensored_avatar, lifetime_spent_coins, total_devotion, tribute_total",
      )
      .in("id", userIds),
    supabase
      .from("user_cosmetics")
      .select("user_id, item_id, item_type, equipped")
      .in("user_id", userIds)
      .eq("equipped", true),
    supabase
      .from("user_titles")
      .select("user_id, title_id, equipped")
      .in("user_id", userIds)
      .eq("equipped", true),
  ]);

  if (profileResult.error) {
    console.error("Devotion leaderboard profile lookup failed", profileResult.error);
    return jsonError(profileResult.error.message, 500);
  }

  if (cosmeticResult.error) {
    console.error("Devotion leaderboard cosmetic lookup failed", cosmeticResult.error);
  }

  if (titleResult.error) {
    console.error("Devotion leaderboard title lookup failed", titleResult.error);
  }

  const usernameStyles = getUsernameStylesByUserId((cosmeticResult.data ?? []) as EquippedUsernameCosmeticRow[]);
  const profileBorderByUserId = new Map<string, { color: string | null; itemId: string | null }>();
  const backgroundByUserId = new Map<string, string | null>();

  ((cosmeticResult.data ?? []) as Array<{
    equipped: boolean | null;
    item_id: string;
    item_type: string;
    user_id: string;
  }>).forEach((row) => {
    if (!row.equipped) {
      return;
    }

    if (row.item_type === "avatar-background") {
      backgroundByUserId.set(String(row.user_id), row.item_id);
      return;
    }

    if (row.item_type === "profile-border") {
      profileBorderByUserId.set(String(row.user_id), {
        color: getCosmeticItem(row.item_id)?.color ?? null,
        itemId: row.item_id,
      });
    }
  });

  const titleByUserId = new Map(
    ((titleResult.data ?? []) as Array<{ title_id: string; user_id: string }>).map((row) => [
      String(row.user_id),
      getTitleItem(row.title_id)?.name ?? null,
    ]),
  );

  const profileMap = new Map(
    (profileResult.data ?? []).map((profile) => [
      String(profile.id),
      {
        badgeImagePath: (() => {
          const badge = getSpendBadge(Number(profile.lifetime_spent_coins ?? 0));
          return badge.isEarned ? badge.imagePath : null;
        })(),
        displayName: profile.display_name ?? null,
        equippedAvatarSlots: (profile.equipped_avatar_slots as Record<string, string> | null) ?? null,
        hasUncensoredAvatar: Boolean(profile.has_uncensored_avatar),
        totalDevotion: Number(profile.total_devotion ?? 0),
        tributeTotal: Number(profile.tribute_total ?? 0),
        username: profile.username.startsWith("@") ? profile.username : `@${profile.username}`,
      },
    ]),
  );

  const buildEntry = (row: RpcRow): DevotionLeaderboardEntry | null => {
    const profile = profileMap.get(String(row.user_id));

    if (!profile) {
      return null;
    }

    const border = profileBorderByUserId.get(String(row.user_id));
    const borderItemId = border?.itemId ?? null;
    const fallbackTitleName = getLeadershipRank(profile.tributeTotal).currentRank.title;

    return {
      badgeImagePath: profile.badgeImagePath,
      backgroundItemId: backgroundByUserId.get(String(row.user_id)) ?? null,
      devotion: period === "all_time" ? profile.totalDevotion : Number(row.devotion ?? 0),
      displayName: profile.displayName,
      equippedAvatarSlots: profile.equippedAvatarSlots,
      frameColor: border?.color ?? null,
      frameItemId: borderItemId,
      frameVariant: getDevotionFrameVariant(borderItemId),
      hasUncensoredAvatar: profile.hasUncensoredAvatar,
      rank: Number(row.rank ?? 0),
      titleName: titleByUserId.get(String(row.user_id)) ?? fallbackTitleName,
      userId: String(row.user_id),
      username: profile.username,
      usernameStyle: usernameStyles.get(String(row.user_id)),
    };
  };

  const leaders = rankingRows
    .filter((row) => row.row_type === "top")
    .map(buildEntry)
    .filter((entry): entry is DevotionLeaderboardEntry => Boolean(entry));

  const currentUserEntry = rankingRows
    .filter((row) => row.row_type === "viewer")
    .map(buildEntry)
    .filter((entry): entry is DevotionLeaderboardEntry => Boolean(entry))[0] ?? null;

  return Response.json({
    currentUserEntry,
    leaders,
    period,
  });
}
