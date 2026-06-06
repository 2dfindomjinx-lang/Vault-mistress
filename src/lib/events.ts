import { DEFAULT_SPEECH_AVATAR_ID, cosmeticItems } from "@/lib/cosmetics";

export type EventEffectType =
  | "cooldown_reduction"
  | "high_low_bonus"
  | "task_reward_multiplier"
  | "tribute_affection_boost"
  | "speech_avatar_override";

export type EventEffect = {
  type: EventEffectType;
  multiplier: number;
  speechAvatarId?: string;
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

export const EVENT_TEMPLATES: EventTemplate[] = [
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
  description: "Task coin rewards are increased by 1.5x until midnight GMT.",
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
  return date.toISOString().slice(0, 10);
}

export function getUtcDayBounds(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { end, start };
}
