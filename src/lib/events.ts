import { DEFAULT_SPEECH_AVATAR_ID, cosmeticItems } from "@/lib/cosmetics";
import { getGmt3DateKey, getGmt3DayBounds } from "@/lib/time";

export type EventEffectType =
  | "cooldown_reduction"
  | "crate_cost_discount"
  | "crate_drop_adjustment"
  | "crate_free_open"
  | "high_low_bonus"
  | "task_reward_multiplier"
  | "tribute_affection_boost"
  | "speech_avatar_override";

export type CrateEventKey = "lucky_key" | "golden_key" | "free_key";

export type EventEffect = {
  type: EventEffectType;
  multiplier: number;
  speechAvatarId?: string;
  crateEventKey?: CrateEventKey;
};

export type RandomEvent = {
  id: string;
  name: string;
  description: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
  effect: EventEffect;
};

export type EventTemplate = {
  key: string;
  name: string;
  description: string;
  effect: EventEffect;
};

export type EventCategory = "economy" | "tribute" | "speech" | "utility";

export function getEventCategory(effect: EventEffect): EventCategory {
  if (
    effect.type === "crate_cost_discount" ||
    effect.type === "crate_drop_adjustment" ||
    effect.type === "crate_free_open"
  ) {
    return "utility";
  }

  if (effect.type === "tribute_affection_boost") {
    return "tribute";
  }

  if (effect.type === "speech_avatar_override") {
    return "speech";
  }

  if (
    effect.type === "task_reward_multiplier" ||
    effect.type === "high_low_bonus" ||
    effect.type === "cooldown_reduction"
  ) {
    return "economy";
  }

  return "utility";
}

export function isEventCompatibleWithActiveEvents(
  effect: EventEffect,
  activeEvents: Array<{ effect: EventEffect; id?: string }>,
  selfId?: string,
) {
  const category = getEventCategory(effect);
  const hasSameEffectType = activeEvents.some(
    (event) => event.id !== selfId && event.effect.type === effect.type,
  );

  if (hasSameEffectType) {
    return false;
  }

  if (category !== "economy") {
    return true;
  }

  return !activeEvents.some(
    (event) => event.id !== selfId && getEventCategory(event.effect) === "economy",
  );
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    key: "lucky-key",
    name: "Lucky Key",
    description: "All cases are 40% cheaper while this event is active.",
    effect: { type: "crate_cost_discount", multiplier: 0.6, crateEventKey: "lucky_key" },
  },
  {
    key: "golden-key",
    name: "Golden Key",
    description: "Blessing Case common items drop to 9.90% each, with the missing chance added evenly to legendary items. Principessa Case common drops by 4% and Epic rises by 4%. Premium Case common drops by 2%, Epic rises by 1.5%, and Legendary rises by 0.5%.",
    effect: { type: "crate_drop_adjustment", multiplier: 1, crateEventKey: "golden_key" },
  },
  {
    key: "free-key",
    name: "Free Key",
    description: "Each case gets one free open for the day while this event is active.",
    effect: { type: "crate_free_open", multiplier: 1, crateEventKey: "free_key" },
  },
  {
    key: "task-reward-2x",
    name: "Double Task Rewards",
    description: "All task coin rewards are doubled while this event is active.",
    effect: { type: "task_reward_multiplier", multiplier: 2 },
  },
  {
    key: "tribute-affection-boost",
    name: "Tribute Affection Boost",
    description: "Tribute affection gains are increased by 10%.",
    effect: { type: "tribute_affection_boost", multiplier: 1.1 },
  },
  {
    key: "high-low-bonus",
    name: "High or Lower Bonus",
    description: "Winning Higher or Lower rounds pay 3x instead of 2x.",
    effect: { type: "high_low_bonus", multiplier: 3 },
  },
  {
    key: "cooldown-reduction",
    name: "Cooldown Reduction",
    description: "Supported activity cooldowns are reduced while this event is active.",
    effect: { type: "cooldown_reduction", multiplier: 0.5 },
  },
  {
    key: "random-speech-bubble",
    name: "Random Speech Bubble",
    description: "A random speech bubble personality visits default-avatar users for the day.",
    effect: { type: "speech_avatar_override", multiplier: 1 },
  },
];

export const FIRST_DAY_EVENT_TEMPLATE: EventTemplate = {
  key: "task-reward-1-5x",
  name: "Coin Earn Surge",
  description: "Task coin rewards are increased by 1.5x until midnight GMT+3.",
  effect: { type: "task_reward_multiplier", multiplier: 1.5 },
};

export function getEventTemplate(key: string) {
  return [FIRST_DAY_EVENT_TEMPLATE, ...EVENT_TEMPLATES].find((event) => event.key === key) ?? null;
}

export function getRandomSpeechAvatarId() {
  const speechAvatars = cosmeticItems.filter(
    (item) => item.type === "speech-avatar" && item.id !== DEFAULT_SPEECH_AVATAR_ID,
  );

  if (speechAvatars.length === 0) {
    return DEFAULT_SPEECH_AVATAR_ID;
  }

  return speechAvatars[Math.floor(Math.random() * speechAvatars.length)].id;
}

export function resolveEventEffect(effect: EventEffect): EventEffect {
  if (effect.type !== "speech_avatar_override") {
    return effect;
  }

  return {
    ...effect,
    multiplier: effect.multiplier || 1,
    speechAvatarId: effect.speechAvatarId ?? getRandomSpeechAvatarId(),
  };
}

export function getEventDayKey(date = new Date()) {
  return getGmt3DateKey(date);
}

export function getUtcDayBounds(date = new Date()) {
  return getGmt3DayBounds(date);
}
