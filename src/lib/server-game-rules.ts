import { cosmeticItems, titleItems } from "@/lib/cosmetics";
import { CASE_OPEN_REWARD_WEIGHTS } from "@/lib/server-task-actions";

export const profileSelect =
  "id, username, twitter_handle, display_name, avatar_url, equipped_avatar_slots, equipped_full_set_id, has_uncensored_avatar, avatar_presets, unlocked_avatar_preset_slots, coins, affection, tribute_total, total_devotion, lifetime_spent_coins, shame_count, is_admin, loyalty_streak, last_loyalty_at, last_login_at, timeout_until, timeout_reason, pet_score, owner_likeness, user_level, user_xp, stored_rights, right_expirations, daily_purchase_count, right_purchase_date, pet_unlocked_at, last_pet_decay_at, last_owner_likeness_at, last_pet_tax_at, address_term, created_at, updated_at";

export const visibleGalleryCosts = new Map<string, number>([
  ["common-velvet-arrival", 300],
  ["common-midnight-maid", 300],
  ["common-executive-glare", 300],
  ["common-rose-vault", 300],
]);

// Server-authoritative mirror of the client's `moodUnlocks` (src/app/page.tsx)
// affection thresholds - these gallery items are free but gated by affection,
// not coins. Keep in sync with the client list.
export const galleryMoodRequirements = new Map<string, number>([
  ["rare-loyal-glimpse", 20],
  ["rare-private-smile", 25],
  ["rare-purple-obsession", 40],
  ["rare-golden-approval", 50],
  ["divine-throne-room", 60],
  ["divine-goddess-mood", 70],
  ["divine-final-favor", 80],
  ["divine-velvet-throne", 90],
  ["secret-defnes-final-favor", 100],
]);

// Server-authoritative mirror of the client's `sacrificeGalleryItems` ids
// (src/app/page.tsx). The coin charge and the 35% roll both happen
// server-side in the `roll_sacrifice_unlock` RPC - the client never reports
// the roll outcome to the server.
export const SACRIFICE_ITEM_IDS = Array.from({ length: 10 }, (_, index) => `sacrifice-${index + 1}`);
export const SACRIFICE_COST = 500;
export const SACRIFICE_UNLOCK_CHANCE = 0.35;

// Server-authoritative mirror of the client's `petGalleryItems` (src/app/page.tsx):
// free, pet_score-threshold gated. Keep the formula in sync with the client.
export const petGalleryScoreRequirements = new Map<string, number>(
  Array.from({ length: 30 }, (_, index) => [
    `pet-gallery-${index + 1}`,
    Math.ceil(((index + 1) * 1000) / 30),
  ]),
);

export const TIMEOUT_CLEAR_FEE_PER_HOUR = 100;

// Runway (avatar voting pool): coins reward only the first N *new* votes a
// user casts per day. Passed into the cast_avatar_vote RPC as parameters -
// plpgsql cannot import this file, so this is the single source of truth.
export const RUNWAY_VOTE_COIN_REWARD = 50;
export const RUNWAY_DAILY_REWARDED_VOTE_LIMIT = 5;

const baseTaskRewards = new Map<string, number>([
  ["daily-login", 150],
  ["streak-bonus-1", 50],
  ["streak-bonus-3", 125],
  ["streak-bonus-7", 250],
  ["streak-bonus-15", 500],
  ["streak-bonus-30", 1000],
  ["typing-accuracy", 100],
  ["wait-obediently", 100],
  ["number-pick", 100],
  ["timeout-risk", 125],
  ["beg", 50],
  ["affection", 250],
  ["affection-80", 250],
]);

export function roundRewardToNearestFive(value: number) {
  return Math.round(value / 5) * 5;
}

export function getAllowedTaskRewards(taskId: string) {
  if (taskId === "case-opening") {
    return Array.from(new Set([0, ...CASE_OPEN_REWARD_WEIGHTS.map((entry) => entry.value)]));
  }

  const baseReward = baseTaskRewards.get(taskId);

  if (typeof baseReward !== "number") {
    return [];
  }

  return Array.from(new Set([
    0,
    baseReward,
    roundRewardToNearestFive(baseReward * 1.5),
    roundRewardToNearestFive(baseReward * 2),
  ]));
}

export function getBaseTaskReward(taskId: string) {
  return baseTaskRewards.get(taskId) ?? null;
}

export function getCosmeticPrice(itemId: string) {
  return cosmeticItems.find((item) => item.id === itemId)?.price ?? null;
}

export function getTitlePrice(titleId: string) {
  return titleItems.find((title) => title.id === titleId)?.price ?? null;
}

export function getTimeoutClearFee(timeoutUntil: string | null, timeoutReason: string | null, now = Date.now()) {
  if (!timeoutUntil) {
    return 0;
  }

  if (timeoutReason === "evil_debt_underage") {
    return 0;
  }

  const remainingMs = new Date(timeoutUntil).getTime() - now;

  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return 0;
  }

  const hours = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
  return hours * TIMEOUT_CLEAR_FEE_PER_HOUR;
}

export const TIMEOUT_RISK_DAILY_SAFE_LIMIT = 2;
