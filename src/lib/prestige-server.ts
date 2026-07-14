import type { SupabaseClient } from "@supabase/supabase-js";
import { getCosmeticItem, getSpendBadge, getTitleItem } from "@/lib/cosmetics";
import { getDevotionFrameVariant } from "@/lib/devotion";
import { getLeadershipRank } from "@/lib/leadership";
import {
  buildCommunityGoalStatus,
  getCurrentCommunityGoal,
  getEarnedSeasonBadgeIds,
  inflateUserPrestigeBadge,
  type CoinTransactionLite,
  type CommunityProfileSnippet,
  type UserPrestigeBadge,
} from "@/lib/prestige";
import { getUsernameStylesByUserId, type EquippedUsernameCosmeticRow } from "@/lib/username-styles";

type ProfilePresentationRow = {
  equipped_avatar_slots: Record<string, string> | null;
  has_uncensored_avatar: boolean | null;
  id: string;
  loyalty_streak: number | null;
  total_devotion: number | null;
  tribute_total: number | null;
  username: string;
  display_name: string | null;
  lifetime_spent_coins: number | null;
};

type EquippedCosmeticRow = {
  equipped: boolean | null;
  item_id: string;
  item_type: string;
  user_id: string;
};

type EquippedTitleRow = {
  equipped: boolean | null;
  title_id: string;
  user_id: string;
};

type UserPrestigeBadgeRow = {
  badge_id: string;
  earned_at: string;
  user_id: string;
};

export type CommunityProfileRecord = CommunityProfileSnippet & {
  loyaltyStreak: number;
  totalDevotion: number;
  tributeTotal: number;
};

export async function loadUserPrestigeBadges(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_prestige_badges")
    .select("badge_id, earned_at")
    .eq("user_id", userId)
    .order("earned_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{ badge_id: string; earned_at: string }>)
    .map((row) => inflateUserPrestigeBadge(row.badge_id, row.earned_at))
    .filter((badge): badge is UserPrestigeBadge => Boolean(badge));
}

export async function syncCurrentUserPrestige(
  supabase: SupabaseClient,
  userId: string,
  communityGoalSnapshot?: { currentUserParticipating: boolean; progressCoins: number },
) {
  const currentGoal = getCurrentCommunityGoal();
  const earliestSeasonStart = "2026-06-01T00:00:00+03:00";
  const earliestStart = new Date(
    Math.min(new Date(earliestSeasonStart).getTime(), new Date(currentGoal.startsAt).getTime()),
  ).toISOString();

  const { data, error } = await supabase
    .from("coin_transactions")
    .select("amount, created_at, metadata, reason, user_id")
    .eq("user_id", userId)
    .gte("created_at", earliestStart)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const transactions = (data ?? []) as CoinTransactionLite[];
  const seasonBadgeIds = getEarnedSeasonBadgeIds(transactions);
  const goalStatus = buildCommunityGoalStatus(currentGoal, transactions, userId);
  const goalProgressCoins = communityGoalSnapshot?.progressCoins ?? goalStatus.progressCoins;
  const currentUserParticipating = communityGoalSnapshot?.currentUserParticipating ?? goalStatus.currentUserParticipating;
  const communityGoalCompleted = goalProgressCoins >= goalStatus.targetCoins;
  const badgeIds = new Set(seasonBadgeIds);

  if (communityGoalCompleted && currentUserParticipating) {
    badgeIds.add(goalStatus.rewardBadge.id);
  }

  if (badgeIds.size > 0) {
    const now = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from("user_prestige_badges")
      .upsert(
        Array.from(badgeIds).map((badgeId) => ({
          badge_id: badgeId,
          earned_at: now,
          source: badgeId === goalStatus.rewardBadge.id ? "community_goal" : "seasonal_support",
          user_id: userId,
        })),
        { onConflict: "user_id,badge_id", ignoreDuplicates: true },
      );

    if (upsertError) {
      throw upsertError;
    }
  }

  if (
    communityGoalCompleted &&
    currentUserParticipating &&
    goalStatus.rewardCrateType &&
    (goalStatus.rewardFreeOpens ?? 0) > 0
  ) {
    const { error: grantError } = await supabase
      .from("user_crate_open_grants")
      .upsert(
        {
          crate_type: goalStatus.rewardCrateType,
          goal_id: goalStatus.id,
          remaining_opens: goalStatus.rewardFreeOpens,
          source: "community_goal",
          total_opens: goalStatus.rewardFreeOpens,
          user_id: userId,
        },
        { onConflict: "user_id,goal_id,crate_type", ignoreDuplicates: true },
      );

    if (grantError) {
      throw grantError;
    }
  }

  return loadUserPrestigeBadges(supabase, userId);
}

export async function loadCommunityProfiles(
  supabase: SupabaseClient,
  userIds: string[],
) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));

  if (ids.length === 0) {
    return new Map<string, CommunityProfileRecord>();
  }

  const [profileResult, cosmeticResult, titleResult, badgeResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, username, display_name, equipped_avatar_slots, has_uncensored_avatar, lifetime_spent_coins, loyalty_streak, total_devotion, tribute_total",
      )
      .in("id", ids),
    supabase
      .from("user_cosmetics")
      .select("user_id, item_id, item_type, equipped")
      .in("user_id", ids)
      .eq("equipped", true),
    supabase
      .from("user_titles")
      .select("user_id, title_id, equipped")
      .in("user_id", ids)
      .eq("equipped", true),
    supabase
      .from("user_prestige_badges")
      .select("user_id, badge_id, earned_at")
      .in("user_id", ids)
      .order("earned_at", { ascending: true }),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (cosmeticResult.error) {
    throw cosmeticResult.error;
  }

  if (titleResult.error) {
    throw titleResult.error;
  }

  if (badgeResult.error) {
    throw badgeResult.error;
  }

  const usernameStyles = getUsernameStylesByUserId(
    (cosmeticResult.data ?? []) as EquippedUsernameCosmeticRow[],
  );
  const borderByUserId = new Map<string, { color: string | null; itemId: string | null }>();
  const backgroundByUserId = new Map<string, string | null>();
  const titleByUserId = new Map<string, string | null>();
  const badgesByUserId = new Map<string, UserPrestigeBadge[]>();

  ((cosmeticResult.data ?? []) as EquippedCosmeticRow[]).forEach((row) => {
    if (!row.equipped) {
      return;
    }

    if (row.item_type === "avatar-background") {
      backgroundByUserId.set(row.user_id, row.item_id);
      return;
    }

    if (row.item_type === "profile-border") {
      borderByUserId.set(row.user_id, {
        color: getCosmeticItem(row.item_id)?.color ?? null,
        itemId: row.item_id,
      });
    }
  });

  ((titleResult.data ?? []) as EquippedTitleRow[]).forEach((row) => {
    if (!row.equipped) {
      return;
    }

    titleByUserId.set(row.user_id, getTitleItem(row.title_id)?.name ?? null);
  });

  ((badgeResult.data ?? []) as UserPrestigeBadgeRow[]).forEach((row) => {
    const current = badgesByUserId.get(row.user_id) ?? [];
    const inflated = inflateUserPrestigeBadge(row.badge_id, row.earned_at);

    if (inflated) {
      current.push(inflated);
      badgesByUserId.set(row.user_id, current);
    }
  });

  return new Map(
    ((profileResult.data ?? []) as ProfilePresentationRow[]).map((profile) => {
      const border = borderByUserId.get(profile.id);
      const spendBadge = getSpendBadge(Number(profile.lifetime_spent_coins ?? 0));
      const fallbackTitle = getLeadershipRank(Number(profile.tribute_total ?? 0)).currentRank.title;

      return [
        profile.id,
        {
          badgeImagePath: spendBadge.isEarned ? spendBadge.imagePath : null,
          badges: badgesByUserId.get(profile.id) ?? [],
          backgroundItemId: backgroundByUserId.get(profile.id) ?? null,
          displayName: profile.display_name ?? null,
          equippedAvatarSlots: profile.equipped_avatar_slots ?? null,
          frameColor: border?.color ?? null,
          frameItemId: border?.itemId ?? null,
          frameVariant: getDevotionFrameVariant(border?.itemId ?? null),
          hasUncensoredAvatar: Boolean(profile.has_uncensored_avatar),
          loyaltyStreak: Number(profile.loyalty_streak ?? 0),
          titleName: titleByUserId.get(profile.id) ?? fallbackTitle,
          totalDevotion: Number(profile.total_devotion ?? 0),
          tributeTotal: Number(profile.tribute_total ?? 0),
          userId: profile.id,
          username: profile.username.startsWith("@") ? profile.username : `@${profile.username}`,
          usernameStyle: usernameStyles.get(profile.id),
        } satisfies CommunityProfileRecord,
      ];
    }),
  );
}
