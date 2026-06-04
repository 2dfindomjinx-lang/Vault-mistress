import { cosmeticItems, titleItems } from "@/lib/cosmetics";

export const profileSelect =
  "id, username, email, avatar_url, coins, affection, tribute_total, shame_count, is_admin, loyalty_streak, last_loyalty_at, last_login_at, timeout_until, pet_score, owner_likeness, pet_unlocked_at, last_pet_decay_at, last_owner_likeness_at, last_pet_tax_at, created_at, updated_at";

export const visibleGalleryCosts = new Map<string, number>([
  ["common-velvet-arrival", 300],
  ["common-midnight-maid", 300],
  ["common-executive-glare", 300],
  ["common-rose-vault", 300],
]);

const baseTaskRewards = new Map<string, number>([
  ["daily-login", 500],
  ["streak-bonus-1", 75],
  ["streak-bonus-3", 225],
  ["streak-bonus-7", 600],
  ["streak-bonus-15", 1500],
  ["streak-bonus-30", 3000],
  ["typing-accuracy", 250],
  ["wait-obediently", 150],
  ["number-pick", 75],
  ["timeout-risk", 150],
  ["beg", 50],
  ["affection", 250],
  ["affection-80", 250],
]);

export function getAllowedTaskRewards(taskId: string) {
  const baseReward = baseTaskRewards.get(taskId);

  if (typeof baseReward !== "number") {
    return [];
  }

  return Array.from(new Set([0, baseReward, Math.round(baseReward * 1.5), baseReward * 2]));
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
