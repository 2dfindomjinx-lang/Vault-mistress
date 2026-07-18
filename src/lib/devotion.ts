import type { SupabaseClient } from "@supabase/supabase-js";
import type { AddressTerm } from "@/lib/address-term";

export type DevotionPeriod = "weekly" | "monthly" | "all_time";

export type DevotionFrameVariant = "rainbow" | "runner" | null;

export type DevotionLeaderboardEntry = {
  userId: string;
  rank: number;
  devotion: number;
  username: string;
  displayName: string | null;
  equippedAvatarSlots: Record<string, string> | null;
  hasUncensoredAvatar: boolean;
  usernameStyle?: {
    color?: string;
    textShadow?: string;
  };
  badgeImagePath: string | null;
  backgroundItemId: string | null;
  frameColor: string | null;
  frameItemId: string | null;
  frameVariant: DevotionFrameVariant;
  titleName: string | null;
  addressTerm: AddressTerm;
};

export type DevotionLeaderboardResponse = {
  currentUserEntry: DevotionLeaderboardEntry | null;
  leaders: DevotionLeaderboardEntry[];
  period: DevotionPeriod;
};

export const DEVOTION_REWARD_BASIC_TASK = 1;
export const DEVOTION_REWARD_PET_TASK = 2;
export const DEVOTION_REWARD_REVIEW_TASK = 5;
export const DEVOTION_REWARD_IRL_SUCCESS = 5;
export const DEVOTION_PENALTY_IRL_FAIL = -3;

export function normalizeDevotionPeriod(period: string | null | undefined): DevotionPeriod {
  if (period === "weekly" || period === "monthly" || period === "all_time") {
    return period;
  }

  return "all_time";
}

export function getDevotionFrameVariant(itemId: string | null | undefined): DevotionFrameVariant {
  if (itemId === "profile-border-rainbow-animated") {
    return "rainbow";
  }

  if (itemId === "profile-border-animated") {
    return "runner";
  }

  return null;
}

type AwardDevotionInput = {
  amount: number;
  metadata?: Record<string, unknown>;
  source: string;
  sourceKey: string;
  userId: string;
};

export async function awardDevotion(
  supabase: SupabaseClient,
  { amount, metadata = {}, source, sourceKey, userId }: AwardDevotionInput,
) {
  if (!Number.isInteger(amount) || amount === 0) {
    return { awarded: false };
  }

  const { data, error } = await supabase
    .from("devotion_events")
    .insert({
      amount,
      metadata,
      source,
      source_key: sourceKey,
      user_id: userId,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { awarded: false, duplicate: true };
    }

    throw error;
  }

  return {
    awarded: Boolean(data?.id),
    eventId: data?.id ?? null,
  };
}
