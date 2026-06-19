import { cosmeticItems, titleItems } from "@/lib/cosmetics";

export const profileSelect =
  "id, username, twitter_handle, display_name, avatar_url, equipped_avatar_slots, has_uncensored_avatar, coins, affection, tribute_total, shame_count, is_admin, loyalty_streak, last_loyalty_at, last_login_at, timeout_until, timeout_reason, pet_score, owner_likeness, user_level, user_xp, stored_rights, right_expirations, daily_purchase_count, right_purchase_date, pet_unlocked_at, last_pet_decay_at, last_owner_likeness_at, last_pet_tax_at, created_at, updated_at";

export const visibleGalleryCosts = new Map<string, number>([
  ["common-velvet-arrival", 300],
  ["common-midnight-maid", 300],
  ["common-executive-glare", 300],
  ["common-rose-vault", 300],
]);

export const TIMEOUT_CLEAR_FEE_PER_HOUR = 250;

const baseTaskRewards = new Map<string, number>([
  ["daily-login", 200],
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
