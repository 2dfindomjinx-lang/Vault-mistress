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
    | "streak-bonus-1"
    | "streak-bonus-3"
    | "streak-bonus-7"
    | "streak-bonus-15"
    | "streak-bonus-30"
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
  highLowDailyBetTotal?: number;
  highLowDailyLocked?: boolean;
  highLowDailyProfit?: number;
  highLowDailyWins?: number;
  highLowBetAllowance?: number;
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
    | "case-open"
    | "evil-wait"
    | "randomized-rules"
    | "false-hope"
    | "favor-roulette"
    | "debt-contract";
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
  debtContract?: PetDebtContract | null;
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

export type PetDebtContract = {
  id: string;
  user_id: string;
  pet_name: string;
  period_type: "weekly" | "monthly";
  debt_amount: number;
  duration_periods: number;
  paid_periods: number;
  missed_periods: number;
  status: "active" | "expired" | "completed" | "cancelled";
  started_at: string;
  next_due_at: string;
  ends_at: string;
  created_at: string;
  updated_at?: string | null;
};

export type PetGalleryItem = {
  id: string;
  title: string;
  image: string;
  unlockCost: number;
};

export type PetCaseItem = {
  tier: string;
  value: number;
};
