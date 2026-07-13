export type SpeechBubbleMessageCategory =
  | "error"
  | "task"
  | "taskComplete"
  | "reward"
  | "cooldown"
  | "warning"
  | "contract"
  | "gallery"
  | "tribute"
  | "jackpot"
  | "cosmetic"
  | "title"
  | "cheat"
  | "adding_xp"
  | "level_up"
  | "general"
  | "crate_open"
  | "crate_result_common"
  | "crate_result_uncommon"
  | "crate_result_rare"
  | "crate_result_epic"
  | "crate_result_legendary";

export type SpeechBubbleMessagePool = {
  idle: string[];
  petIdle: string[];
  responses?: Partial<Record<SpeechBubbleMessageCategory, string[]>>;
};

export const DEFAULT_SPEECH_AVATAR_ID = "default-principessa";
export const RANDOM_SPEECH_AVATAR_ID = "speech-avatar-random";
