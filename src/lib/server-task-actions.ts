import type { SupabaseClient } from "@supabase/supabase-js";
import { getGmt3DateKey, getGmt3DayIndex } from "@/lib/time";
export { DAY_MS } from "@/lib/time";

export const HIGH_LOW_BET_ALLOWANCE = 2000;
export const HIGH_LOW_PROFIT_LIMIT = 2500;
export const HIGH_LOW_TIE_FEE_RATIO = 0.25;
export const HIGH_LOW_REVEAL_DELAY_MS = 10 * 1000;
export const HIGH_LOW_REPLAY_COOLDOWN_MS = 15 * 1000;
export const HIGH_LOW_DISPLAY_NUMBER_MIN = 2;
export const HIGH_LOW_DISPLAY_NUMBER_MAX = 19;
const HIGH_LOW_RESULT_NUMBER_MIN = 1;
const HIGH_LOW_RESULT_NUMBER_MAX = 25;
const HIGH_LOW_DISPLAY_NUMBER_CENTER = 10.5;
const HIGH_LOW_RESULT_NUMBER_CENTER = 13;
export const CASE_OPEN_REWARD_WEIGHTS = [
  { value: 100, weight: 35 },
  { value: 125, weight: 25 },
  { value: 150, weight: 15 },
  { value: 175, weight: 10 },
  { value: 200, weight: 5 },
  { value: 250, weight: 5 },
  { value: 300, weight: 2 },
  { value: 350, weight: 1 },
  { value: 400, weight: 1 },
  { value: 450, weight: 0.5 },
  { value: 500, weight: 0.5 },
];

function pickWeightedNumber(entries: Array<{ value: number; weight: number }>) {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of entries) {
    roll -= entry.weight;

    if (roll <= 0) {
      return entry.value;
    }
  }

  return entries[entries.length - 1].value;
}

const HIGH_LOW_DISPLAY_WEIGHTS = Array.from(
  { length: HIGH_LOW_DISPLAY_NUMBER_MAX - HIGH_LOW_DISPLAY_NUMBER_MIN + 1 },
  (_, index) => {
    const value = HIGH_LOW_DISPLAY_NUMBER_MIN + index;
    const distance = Math.abs(value - HIGH_LOW_DISPLAY_NUMBER_CENTER);
    const weight = Math.max(1, 10 - distance);

    return { value, weight };
  },
);

const HIGH_LOW_RESULT_WEIGHTS = Array.from(
  { length: HIGH_LOW_RESULT_NUMBER_MAX - HIGH_LOW_RESULT_NUMBER_MIN + 1 },
  (_, index) => {
    const value = HIGH_LOW_RESULT_NUMBER_MIN + index;
    const distance = Math.abs(value - HIGH_LOW_RESULT_NUMBER_CENTER);
    const weight = Math.max(1, 14 - distance);

    return { value, weight };
  },
);

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
  return getGmt3DateKey();
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
  return pickWeightedNumber(HIGH_LOW_RESULT_WEIGHTS);
}

export function randomHighLowDisplayNumber() {
  return pickWeightedNumber(HIGH_LOW_DISPLAY_WEIGHTS);
}

export function generateHighLowRoundNumbers() {
  return {
    currentNumber: randomHighLowDisplayNumber(),
    nextNumber: randomHighLowDisplayNumber(),
  };
}

export function randomCaseOpeningReward() {
  return pickWeightedNumber(CASE_OPEN_REWARD_WEIGHTS);
}

export function getHighLowTieFee(stake: number) {
  return Math.max(1, Math.floor(stake * HIGH_LOW_TIE_FEE_RATIO));
}

export function generateNumberPickOptions(seed = getGmt3DayIndex()) {
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

export function isHighLowLocked(dailyBetTotal: number, dailyProfit = 0) {
  return dailyBetTotal >= HIGH_LOW_BET_ALLOWANCE || dailyProfit >= HIGH_LOW_PROFIT_LIMIT;
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
