import type { SupabaseClient } from "@supabase/supabase-js";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HIGH_LOW_BET_ALLOWANCE = 4000;
export const HIGH_LOW_PROFIT_LIMIT = 4000;

const BASE_NUMBER_WEIGHTS = [
  { value: 2, weight: 1 },
  { value: 3, weight: 2 },
  { value: 4, weight: 3 },
  { value: 5, weight: 3 },
  { value: 6, weight: 3 },
  { value: 7, weight: 3 },
  { value: 8, weight: 2 },
  { value: 9, weight: 1 },
];

export type UserTaskActionRow = {
  claimed_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
  reward_coins: number | null;
  task_id: string;
};

export function getCooldownUntil(value: string | null | undefined, milliseconds: number) {
  if (!value) {
    return null;
  }

  const cooldownEndsAt = new Date(value).getTime() + milliseconds;

  if (Date.now() >= cooldownEndsAt) {
    return null;
  }

  return new Date(cooldownEndsAt).toISOString();
}

export function getDailyKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getMetadataNumber(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
  fallback = 0,
) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function getMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

export function getMetadataNumberArray(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return Array.isArray(value) && value.every((entry) => typeof entry === "number")
    ? value
    : null;
}

export function randomHighLowNumber() {
  return Math.floor(Math.random() * 10) + 1;
}

export function randomHighLowDisplayNumber() {
  const totalWeight = BASE_NUMBER_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of BASE_NUMBER_WEIGHTS) {
    roll -= entry.weight;

    if (roll <= 0) {
      return entry.value;
    }
  }

  return BASE_NUMBER_WEIGHTS[BASE_NUMBER_WEIGHTS.length - 1].value;
}

export function generateNumberPickOptions(seed = Math.floor(Date.now() / DAY_MS)) {
  const options = new Set<number>();
  let step = 0;

  while (options.size < 3) {
    const value = ((seed + step * 7) % 9) + 1;
    options.add(value);
    step += 1;
  }

  return Array.from(options).sort((a, b) => a - b);
}

export function randomFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function getEventMultiplier(effect: unknown, type: string, fallback = 1) {
  if (
    effect &&
    typeof effect === "object" &&
    "type" in effect &&
    "multiplier" in effect &&
    effect.type === type &&
    typeof effect.multiplier === "number" &&
    Number.isFinite(effect.multiplier)
  ) {
    return effect.multiplier;
  }

  return fallback;
}

export async function getActiveEventMultipliers(
  supabase: SupabaseClient,
  types: string[],
) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("random_events")
    .select("effect")
    .eq("active", true)
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("starts_at", { ascending: false })
    .limit(10);

  if (error || !data) {
    if (error) {
      console.error("Task action active event lookup failed", error);
    }

    return Object.fromEntries(types.map((type) => [type, 1]));
  }

  return Object.fromEntries(
    types.map((type) => [
      type,
      data.reduce((multiplier, row) => {
        const nextMultiplier = getEventMultiplier(row.effect, type, 1);
        return nextMultiplier !== 1 ? nextMultiplier : multiplier;
      }, 1),
    ]),
  );
}

export function getEventCooldownMs(baseMilliseconds: number, cooldownMultiplier: number) {
  return Math.max(1000, Math.round(baseMilliseconds * cooldownMultiplier));
}

export function getHighLowBetAllowance(dailyBetTotal: number) {
  return Math.max(0, HIGH_LOW_BET_ALLOWANCE - Math.max(0, dailyBetTotal));
}

export function validateNumberPickOptions(options: unknown) {
  if (
    !Array.isArray(options) ||
    options.length !== 3 ||
    !options.every((entry) => Number.isInteger(entry) && entry >= 1 && entry <= 9)
  ) {
    return null;
  }

  const uniqueOptions = Array.from(new Set(options as number[]));

  return uniqueOptions.length === 3 ? uniqueOptions.sort((a, b) => a - b) : null;
}
