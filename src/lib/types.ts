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
    | "number-pick"
    | "wait-obediently"
    | "timeout-risk"
    | "irl-task-wheel"
    | "affection"
    | "affection-80";
  title: string;
  reward: number;
  completed: boolean;
  claimed: boolean;
  kind:
    | "claim"
    | "typing"
    | "high-low"
    | "number-pick"
    | "wait-obediently"
    | "timeout-risk"
    | "irl-wheel";
  cooldownUntil?: string | null;
  attemptsRemaining?: number;
  sentence?: string;
  currentNumber?: number;
  highLowDailyDate?: string | null;
  highLowDailyLocked?: boolean;
  highLowDailyProfit?: number;
  highLowDailyWins?: number;
  lastResult?: string | null;
  nextBaseRevealAt?: string | null;
  resultBaseNumber?: number;
  resultCoinDelta?: number;
  resultNumber?: number;
  resultOutcome?: "win" | "loss" | "tie";
  numberPickCorrect?: number;
  numberPickOptions?: number[];
  numberPickResult?: "win" | "loss" | null;
  numberPickSelected?: number | null;
  waitState?:
    | "ready"
    | "countdown"
    | "waiting"
    | "failed"
    | "completed"
    | "cooldown";
  waitCountdownEndsAt?: string | null;
  waitEndsAt?: string | null;
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
