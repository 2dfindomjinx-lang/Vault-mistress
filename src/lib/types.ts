export type GalleryRarity = "Common" | "Rare" | "Divine" | "Secret" | "Sacrifice";

export type GalleryTag = string;

export type GalleryItem = {
  id: string;
  title: string;
  rarity: GalleryRarity;
  unlockCost?: number;
  moodRequired?: number;
  tag: GalleryTag;
  image: string;
  unlocked: boolean;
};

export type TaskItem = {
  id:
    | "daily-login"
    | "typing-accuracy"
    | "high-low"
    | "irl-task-wheel"
    | "affection"
    | "affection-80";
  title: string;
  reward: number;
  completed: boolean;
  claimed: boolean;
  kind: "claim" | "typing" | "high-low" | "irl-wheel";
  cooldownUntil?: string | null;
  attemptsRemaining?: number;
  sentence?: string;
  currentNumber?: number;
  lastResult?: string | null;
  nextBaseRevealAt?: string | null;
  resultBaseNumber?: number;
  resultCoinDelta?: number;
  resultNumber?: number;
  resultOutcome?: "win" | "loss" | "tie";
  assignedIrlTask?: string | null;
  assignedIrlTaskDescription?: string | null;
  assignedIrlTaskStatus?: string | null;
  assignedIrlWheelIndex?: number | null;
  assignedIrlDueAt?: string | null;
  assignedIrlPenaltyMinutes?: number | null;
  timeoutUntil?: string | null;
};

export type MechanicsState = {
  begCooldownUntil?: string | null;
  sacrificeCooldownUntil?: string | null;
  supportUnlocked: boolean;
  sacrificeUnlockedCount: number;
  sacrificeTotal: number;
  sacrificeComplete: boolean;
  allGalleryComplete: boolean;
  sacrificeLastResult?: string | null;
  supportLastResult?: string | null;
};
