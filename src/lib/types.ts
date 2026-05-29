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
  numberPickAttemptsRemaining?: number;
  numberPickOptions?: number[];
  numberPickResult?: "win" | "loss" | null;
  numberPickSelected?: number | null;
  numberPickWrongSelections?: number[];
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

export type PetTaskItem = {
  id: string;
  title: string;
  description: string;
  reward: number;
  actionLabel?: string;
  actionUrl?: string;
  kind:
    | "review"
    | "confession-writing"
    | "perfect-writing"
    | "weekly-tax"
    | "coin-goal"
    | "case-open"
    | "evil-wait"
    | "randomized-rules"
    | "false-hope"
    | "favor-roulette";
  status?: "available" | "pending" | "approved" | "rejected" | "failed";
  cooldownUntil?: string | null;
  completedAt?: string | null;
  caseReward?: number | null;
  caseSpunAt?: string | null;
  confessionCount?: number;
  deadlineAt?: string | null;
  falseHopeProgress?: number;
  falseHopeStage?: number;
  falseHopeExpectedKey?: "a" | "d";
  goalDeposited?: number;
  goalTarget?: number;
  favorPickedIndex?: number | null;
  favorResult?: "win" | "loss" | "empty-day" | null;
  favorWinningIndex?: number | null;
  ruleAcknowledged?: boolean;
  ruleBannedMechanics?: string[];
  sentence?: string;
  attemptsRemaining?: number;
  reviewedAt?: string | null;
  voiceSentence?: string;
  waitCountdownEndsAt?: string | null;
  waitEndsAt?: string | null;
  waitState?: "ready" | "countdown" | "waiting" | "failed" | "completed" | "cooldown";
};

export type PetGalleryItem = {
  id: string;
  title: string;
  image: string;
  unlockCost: number;
};
