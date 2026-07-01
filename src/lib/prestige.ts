import {
  getCosmeticItem,
  rotatingCosmeticItems,
  type CosmeticItem,
} from "@/lib/cosmetics";
import { rotatingProfileFrameCosmeticItems } from "@/lib/profile-frame-cosmetics";
import { DAY_MS, GMT3_OFFSET_MS } from "@/lib/time";

export type PrestigeBadgeTone = "gold" | "rose" | "cyan" | "emerald";

export type PrestigeBadgeDefinition = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  tone: PrestigeBadgeTone;
};

export type UserPrestigeBadge = PrestigeBadgeDefinition & {
  earnedAt: string;
};

export type CommunityProfileSnippet = {
  badgeImagePath: string | null;
  badges: UserPrestigeBadge[];
  backgroundItemId: string | null;
  displayName: string | null;
  equippedAvatarSlots: Record<string, string> | null;
  frameColor: string | null;
  frameItemId: string | null;
  frameVariant: "rainbow" | "runner" | null;
  hasUncensoredAvatar: boolean;
  titleName: string | null;
  userId: string;
  username: string;
  usernameStyle?: {
    color?: string;
    textShadow?: string;
  };
};

export type HallOfFameCardData = {
  id: string;
  metricLabel: string;
  metricValue: number;
  title: string;
  valueDisplay: string;
  winner: CommunityProfileSnippet | null;
};

export type CommunityGoalStatus = {
  currentUserParticipating: boolean;
  endsAt: string;
  id: string;
  participantCount: number;
  progressCoins: number;
  progressPercent: number;
  rewardBadge: PrestigeBadgeDefinition;
  rewardDescription: string;
  rewardTitle: string;
  startsAt: string;
  targetCoins: number;
  title: string;
};

export type CommunityStatusResponse = {
  communityGoal: CommunityGoalStatus;
  currentUserBadges: UserPrestigeBadge[];
  hallOfFame: HallOfFameCardData[];
};

export type PublicCommunityProfile = {
  badges: UserPrestigeBadge[];
  profile: CommunityProfileSnippet & {
    loyaltyStreak: number;
    totalDevotion: number;
    tributeTotal: number;
  };
  stats: Array<{
    label: string;
    value: string;
  }>;
};

type SeasonalBadgeDefinition = PrestigeBadgeDefinition & {
  endsAt: string;
  startsAt: string;
};

type CommunityGoalDefinition = {
  endsAt: string;
  id: string;
  includedReasons: string[];
  rewardBadgeId: string;
  rewardDescription: string;
  rewardTitle: string;
  startsAt: string;
  targetCoins: number;
  title: string;
};

type RotatingShopDefinition = {
  buckets: Array<{
    itemIds: string[];
    picks: number;
  }>;
  itemIds: string[];
  picks: number;
  rotationDays: number;
};

export type CoinTransactionLite = {
  amount: number | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
  reason: string | null;
  user_id?: string | null;
};

const prestigeBadgeDefinitions: PrestigeBadgeDefinition[] = [
  {
    id: "summer-supporter-2026",
    label: "Summer Supporter 2026",
    shortLabel: "Summer 2026",
    description: "Supported the site during the Summer 2026 season.",
    tone: "gold",
  },
  {
    id: "halloween-supporter-2026",
    label: "Halloween Supporter 2026",
    shortLabel: "Halloween 2026",
    description: "Supported the site during the Halloween 2026 event.",
    tone: "rose",
  },
  {
    id: "winter-supporter-2026",
    label: "Winter Supporter 2026",
    shortLabel: "Winter 2026",
    description: "Supported the site during the Winter 2026 season.",
    tone: "cyan",
  },
  {
    id: "community-goal-summer-2026",
    label: "Vault Patron 2026",
    shortLabel: "Vault Patron",
    description: "Participated in the Summer 2026 community coin-spend objective.",
    tone: "emerald",
  },
];

export const PRESTIGE_BADGE_MAP = new Map(
  prestigeBadgeDefinitions.map((badge) => [badge.id, badge]),
);

export const SEASONAL_BADGES: SeasonalBadgeDefinition[] = [
  {
    ...PRESTIGE_BADGE_MAP.get("summer-supporter-2026")!,
    startsAt: "2026-06-01T00:00:00+03:00",
    endsAt: "2026-09-01T00:00:00+03:00",
  },
  {
    ...PRESTIGE_BADGE_MAP.get("halloween-supporter-2026")!,
    startsAt: "2026-10-20T00:00:00+03:00",
    endsAt: "2026-11-03T00:00:00+03:00",
  },
  {
    ...PRESTIGE_BADGE_MAP.get("winter-supporter-2026")!,
    startsAt: "2026-12-01T00:00:00+03:00",
    endsAt: "2027-01-08T00:00:00+03:00",
  },
];

export const COMMUNITY_GOALS: CommunityGoalDefinition[] = [
  {
    id: "summer-community-goal-2026",
    title: "Spend 5,000,000 Coins",
    startsAt: "2026-06-01T00:00:00+03:00",
    endsAt: "2026-09-01T00:00:00+03:00",
    targetCoins: 5_000_000,
    rewardBadgeId: "community-goal-summer-2026",
    rewardTitle: "Vault Patron 2026 Badge",
    rewardDescription: "Every participant receives a permanent prestige badge when the community finishes the objective.",
    includedReasons: [
      "crate:open",
      "jackpot_contribution",
      "spend:cosmetic",
      "spend:gallery-unlock",
      "spend:irl-task-wheel",
      "spend:pet-weekly-tax",
      "spend:rights",
      "spend:title",
      "spend:timeout-clear",
      "spend:uncensored",
      "tribute:coin-offer",
      "tribute:sacrifice",
      "tribute:support",
    ],
  },
];

const rotatingBorderIds = rotatingCosmeticItems
  .filter((item) => item.type === "profile-border" && !item.isArchived)
  .map((item) => item.id);

const rotatingBottomIds = rotatingProfileFrameCosmeticItems
  .filter((item) => item.type === "profile-frame-bottom")
  .map((item) => item.id);
const rotatingSideIds = rotatingProfileFrameCosmeticItems
  .filter((item) => item.type === "profile-frame-side")
  .map((item) => item.id);
const rotatingCornerIds = rotatingProfileFrameCosmeticItems
  .filter((item) => item.type === "profile-frame-corner")
  .map((item) => item.id);
const rotatingTopIds = rotatingProfileFrameCosmeticItems
  .filter((item) => item.type === "profile-frame-top")
  .map((item) => item.id);
const rotatingOverlayIds = rotatingProfileFrameCosmeticItems
  .filter((item) => item.type === "profile-frame-overlay")
  .map((item) => item.id);
const rotatingParticleIds = rotatingProfileFrameCosmeticItems
  .filter((item) => item.type === "profile-frame-particles")
  .map((item) => item.id);
const rotatingShowpieceIds = [
  ...rotatingBorderIds,
  ...rotatingBottomIds,
  ...rotatingSideIds,
  ...rotatingOverlayIds,
];
const rotatingAccentIds = [...rotatingCornerIds, ...rotatingTopIds];
const rotatingWildIds = rotatingProfileFrameCosmeticItems.map((item) => item.id);

const rotatingShopDefinition: RotatingShopDefinition = {
  buckets: [
    { itemIds: rotatingShowpieceIds, picks: 1 },
    { itemIds: rotatingAccentIds, picks: 1 },
    { itemIds: rotatingParticleIds, picks: 1 },
    { itemIds: rotatingWildIds, picks: 1 },
  ],
  itemIds: [...rotatingBorderIds, ...rotatingWildIds],
  picks: 4,
  rotationDays: 2,
};

export const SUPPORT_REASON_SET = new Set([
  "throne_tribute",
  "tribute:coin-offer",
  "tribute:sacrifice",
  "tribute:support",
]);

export function getPrestigeBadgeDefinition(badgeId: string) {
  return PRESTIGE_BADGE_MAP.get(badgeId) ?? null;
}

export function inflateUserPrestigeBadge(badgeId: string, earnedAt: string): UserPrestigeBadge | null {
  const definition = getPrestigeBadgeDefinition(badgeId);

  if (!definition) {
    return null;
  }

  return {
    ...definition,
    earnedAt,
  };
}

function getGmt3TimestampParts(date: Date | number | string = new Date()) {
  const shifted = new Date(new Date(date).getTime() + GMT3_OFFSET_MS);

  return {
    day: shifted.getUTCDate(),
    month: shifted.getUTCMonth(),
    year: shifted.getUTCFullYear(),
  };
}

export function getGmt3DayStart(date: Date | number | string = new Date()) {
  const dayKey = new Date(new Date(date).getTime() + GMT3_OFFSET_MS).toISOString().slice(0, 10);
  return new Date(`${dayKey}T00:00:00.000Z`).getTime() - GMT3_OFFSET_MS;
}

export function getGmt3MonthStart(date: Date | number | string = new Date()) {
  const { month, year } = getGmt3TimestampParts(date);
  return Date.UTC(year, month, 1, 0, 0, 0, 0) - GMT3_OFFSET_MS;
}

export function getGmt3WeekStart(date: Date | number | string = new Date()) {
  const now = new Date(new Date(date).getTime() + GMT3_OFFSET_MS);
  const dayOfWeek = now.getUTCDay();
  const daysFromMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysFromMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.getTime() - GMT3_OFFSET_MS;
}

function getRotationStartMs(date: Date | number | string = new Date()) {
  const summerStartMs = new Date("2026-06-01T00:00:00+03:00").getTime();
  const currentMs = new Date(date).getTime();
  const rotationWindowMs = rotatingShopDefinition.rotationDays * DAY_MS;
  const elapsed = Math.max(0, currentMs - summerStartMs);
  const rotationIndex = Math.floor(elapsed / rotationWindowMs);

  return summerStartMs + rotationIndex * rotationWindowMs;
}

export function getNextRotatingShopRefresh(date: Date | number | string = new Date()) {
  const rotationWindowMs = rotatingShopDefinition.rotationDays * DAY_MS;
  return new Date(getRotationStartMs(date) + rotationWindowMs);
}

function pickStableIndices(length: number, picks: number, seed: number) {
  const available = Array.from({ length }, (_, index) => index);
  const selected: number[] = [];
  let nextSeed = seed || 1;

  while (available.length > 0 && selected.length < picks) {
    nextSeed = (nextSeed * 1664525 + 1013904223) % 4294967296;
    const index = nextSeed % available.length;
    selected.push(available.splice(index, 1)[0]);
  }

  return selected;
}

function pickStableItemIds(itemIds: string[], picks: number, seed: number) {
  return pickStableIndices(itemIds.length, picks, seed)
    .map((index) => itemIds[index])
    .filter((itemId): itemId is string => Boolean(itemId));
}

function pickRotationItemIdsForIndex(
  rotationIndex: number,
  pooledItemIds: string[],
  previousRotationIds: string[],
) {
  const pooledSet = new Set(pooledItemIds);
  const previouslyShown = new Set(previousRotationIds);
  const used = new Set<string>();
  const selected: string[] = [];

  rotatingShopDefinition.buckets.forEach((bucket, bucketIndex) => {
    const availableInBucket = bucket.itemIds.filter(
      (itemId) => pooledSet.has(itemId) && !used.has(itemId),
    );
    const preferred = availableInBucket.filter(
      (itemId) => !previouslyShown.has(itemId),
    );
    const source =
      preferred.length >= bucket.picks ? preferred : availableInBucket;
    const pickedIds = pickStableItemIds(
      source,
      bucket.picks,
      (rotationIndex + 1) * 131 + (bucketIndex + 1) * 977,
    );

    pickedIds.forEach((itemId) => {
      if (!used.has(itemId)) {
        used.add(itemId);
        selected.push(itemId);
      }
    });
  });

  if (selected.length < rotatingShopDefinition.picks) {
    const remainingPool = pooledItemIds.filter((itemId) => !used.has(itemId));
    const preferredRemaining = remainingPool.filter(
      (itemId) => !previouslyShown.has(itemId),
    );
    const source =
      preferredRemaining.length >=
      rotatingShopDefinition.picks - selected.length
        ? preferredRemaining
        : remainingPool;
    const fillerIds = pickStableItemIds(
      source,
      rotatingShopDefinition.picks - selected.length,
      (rotationIndex + 1) * 7919,
    );

    fillerIds.forEach((itemId) => {
      if (!used.has(itemId)) {
        used.add(itemId);
        selected.push(itemId);
      }
    });
  }

  return selected.slice(0, rotatingShopDefinition.picks);
}

export function getCurrentRotatingShopItems(date: Date | number | string = new Date()) {
  const rotationStartMs = getRotationStartMs(date);
  const rotationIndex = Math.floor(
    (rotationStartMs - new Date("2026-06-01T00:00:00+03:00").getTime()) /
      (rotatingShopDefinition.rotationDays * DAY_MS),
  );
  const pooledItems = rotatingShopDefinition.itemIds;
  let previousRotationIds: string[] = [];
  let currentRotationIds: string[] = [];

  for (let index = 0; index <= rotationIndex; index += 1) {
    currentRotationIds = pickRotationItemIdsForIndex(
      index,
      pooledItems,
      previousRotationIds,
    );
    previousRotationIds = currentRotationIds;
  }

  return currentRotationIds
    .map((itemId) => getCosmeticItem(itemId))
    .filter((item): item is CosmeticItem => Boolean(item));
}

export function isCommunityGoalReason(reason: string | null | undefined) {
  return COMMUNITY_GOALS.some((goal) => goal.includedReasons.includes(reason ?? ""));
}

export function isSupportTransaction(transaction: CoinTransactionLite) {
  if (!transaction.reason) {
    return false;
  }

  if (SUPPORT_REASON_SET.has(transaction.reason)) {
    return true;
  }

  if (transaction.reason !== "live_gift") {
    return false;
  }

  const metadata = transaction.metadata ?? {};
  const command = typeof metadata.command === "string" ? metadata.command : "";
  const kind = typeof metadata.kind === "string" ? metadata.kind : "";
  const source = typeof metadata.source === "string" ? metadata.source : "";

  return command === "give" || kind === "manual_coin_purchase" || source === "throne";
}

export function getSupportAmountFromTransaction(transaction: CoinTransactionLite) {
  if (!isSupportTransaction(transaction)) {
    return 0;
  }

  return Math.abs(Number(transaction.amount ?? 0));
}

export function getCommunityGoalContributionAmount(transaction: CoinTransactionLite) {
  if (!transaction.reason || !isCommunityGoalReason(transaction.reason)) {
    return 0;
  }

  return Math.abs(Number(transaction.amount ?? 0));
}

export function getEarnedSeasonBadgeIds(
  transactions: CoinTransactionLite[],
  now: Date | number | string = new Date(),
) {
  const currentMs = new Date(now).getTime();

  return SEASONAL_BADGES.filter((badge) => {
    const startsAtMs = new Date(badge.startsAt).getTime();
    const endsAtMs = new Date(badge.endsAt).getTime();

    if (currentMs < startsAtMs) {
      return false;
    }

    return transactions.some((transaction) => {
      const createdAtMs = transaction.created_at ? new Date(transaction.created_at).getTime() : 0;
      return (
        createdAtMs >= startsAtMs &&
        createdAtMs < endsAtMs &&
        getSupportAmountFromTransaction(transaction) > 0
      );
    });
  }).map((badge) => badge.id);
}

export function getCurrentCommunityGoal(date: Date | number | string = new Date()) {
  const nowMs = new Date(date).getTime();

  return (
    COMMUNITY_GOALS.find((goal) => {
      const startsAtMs = new Date(goal.startsAt).getTime();
      const endsAtMs = new Date(goal.endsAt).getTime();
      return nowMs >= startsAtMs && nowMs < endsAtMs;
    }) ??
    COMMUNITY_GOALS[COMMUNITY_GOALS.length - 1]
  );
}

export function buildCommunityGoalStatus(
  goal: CommunityGoalDefinition,
  transactions: CoinTransactionLite[],
  currentUserId?: string | null,
): CommunityGoalStatus {
  const badge = PRESTIGE_BADGE_MAP.get(goal.rewardBadgeId)!;
  const startsAtMs = new Date(goal.startsAt).getTime();
  const endsAtMs = new Date(goal.endsAt).getTime();
  const relevantTransactions = transactions.filter((transaction) => {
    if (!transaction.created_at || !goal.includedReasons.includes(transaction.reason ?? "")) {
      return false;
    }

    const createdAtMs = new Date(transaction.created_at).getTime();
    return createdAtMs >= startsAtMs && createdAtMs < endsAtMs;
  });
  const progressCoins = relevantTransactions.reduce(
    (sum, transaction) => sum + getCommunityGoalContributionAmount(transaction),
    0,
  );
  const participantIds = new Set(
    relevantTransactions
      .filter((transaction) => getCommunityGoalContributionAmount(transaction) > 0)
      .map((transaction) => transaction.user_id)
      .filter((userId): userId is string => Boolean(userId)),
  );

  return {
    currentUserParticipating: currentUserId ? participantIds.has(currentUserId) : false,
    endsAt: goal.endsAt,
    id: goal.id,
    participantCount: participantIds.size,
    progressCoins,
    progressPercent: Math.min(100, Math.round((progressCoins / goal.targetCoins) * 100)),
    rewardBadge: badge,
    rewardDescription: goal.rewardDescription,
    rewardTitle: goal.rewardTitle,
    startsAt: goal.startsAt,
    targetCoins: goal.targetCoins,
    title: goal.title,
  };
}

export function getBadgeToneClasses(tone: PrestigeBadgeTone) {
  switch (tone) {
    case "gold":
      return "border-amber-200/35 bg-amber-400/12 text-amber-50";
    case "rose":
      return "border-rose-200/35 bg-rose-400/12 text-rose-50";
    case "cyan":
      return "border-cyan-200/35 bg-cyan-400/12 text-cyan-50";
    case "emerald":
      return "border-emerald-200/35 bg-emerald-400/12 text-emerald-50";
    default:
      return "border-white/15 bg-white/10 text-white";
  }
}

export function getRotatingCosmeticItems() {
  return rotatingCosmeticItems.filter((item) =>
    rotatingShopDefinition.itemIds.includes(item.id) && !item.isArchived,
  );
}
