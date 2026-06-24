"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import { AppShell } from "@/components/AppShell";
import { CharacterCard } from "@/components/CharacterCard";
import { CosmeticShop } from "@/components/CosmeticShop";
import { CratesPanel, type CrateDefinition, type CrateInventoryItem } from "@/components/CratesPanel";
import { FloatingDefneBubble } from "@/components/FloatingDefneBubble";
import { GalleryGrid } from "@/components/GalleryGrid";
import { LayeredAvatar } from "@/components/LayeredAvatar";
import { LoginScreen } from "@/components/LoginScreen";
import { PetSection } from "@/components/PetSection";
import { ProfileHeader } from "@/components/ProfileHeader";
import {
  RecentTributesTicker,
  type RecentTribute,
  type TopInventory,
} from "@/components/RecentTributesTicker";
import { StatsPanel } from "@/components/StatsPanel";
import { TaskList } from "@/components/TaskList";
import { ProfileTaskCard, TitleCollection } from "@/components/TitleCollection";
import { TributePanel } from "@/components/TributePanel";
import type { DashboardPage } from "@/components/SidebarNav";
import {
  AVATAR_SLOT_ORDER,
  resolveAvatarItemIconPath,
  equipAvatarItem,
  getItemAvatarSlot,
  isAvatarEquippableItem,
  normalizeEquipment,
  unequipAvatarSlot,
  SLOT_LABELS,
  type AvatarSlot,
  type EquippedAvatarSlots,
} from "@/lib/avatar-slots";
import {
  cosmeticItems,
  DEFAULT_SPEECH_AVATAR_ID,
  getCosmeticItem,
  getSpeechBubbleMessageForText,
  getSpeechBubbleMessagePool,
  getSpeechBubbleResponseMessage,
  RANDOM_SPEECH_AVATAR_ID,
  getTitleItem,
  getSpendBadge,
  getUnlockedCrateTitleIds,
  getUnlockedInventoryTitleIds,
  getUnlockedPetTitleIds,
  titleItems,
  type CosmeticItem,
  type CosmeticType,
  type TitleItem,
} from "@/lib/cosmetics";
import type { RandomEvent } from "@/lib/events";
import {
  getGlobalPrincipessaProgressPercent,
  getGlobalPrincipessaXpRequirement,
  type GlobalPrincipessaProgress,
} from "@/lib/global-principessa";
import { userDebtContractSelect } from "@/lib/debt-contract-select";
import {
  getRandomIrlTaskDurationMinutes,
  getRandomIrlTaskPenaltyMinutes,
  IRL_TASK_WHEEL_COST,
  irlTaskWheelSegments,
  isFreeTaskFriday,
} from "@/lib/irl-task-wheel";
import {
  ALL_LEGENDARY_ITEM_IDS,
  CRATE_TYPES,
  SAMPLE_CRATE_ITEMS,
  RARITY_ORDER,
  getCrateIconUrl,
} from "@/lib/crates";
import { JACKPOT_MIN_CONTRIBUTION, type LoyaltyJackpotState } from "@/lib/jackpot";
import type { LeadershipEntry, ShameEntry } from "@/lib/leadership";
import {
  HIGH_LOW_BET_ALLOWANCE,
  HIGH_LOW_PROFIT_LIMIT,
  HIGH_LOW_REPLAY_COOLDOWN_MS,
  HIGH_LOW_REVEAL_DELAY_MS,
  getHighLowBetAllowance,
  getHighLowTieFee,
  isHighLowLocked,
  randomHighLowDisplayNumber,
  randomHighLowNumber,
  randomCaseOpeningReward,
} from "@/lib/server-task-actions";
import { getUserLevelProgress } from "@/lib/levels";
import { getTimeoutClearFee, roundRewardToNearestFive, TIMEOUT_CLEAR_FEE_PER_HOUR } from "@/lib/server-game-rules";
import {
  getDailyGmt3CooldownUntil,
  getGmt3DateKey,
  getGmt3DayIndex,
  getNextGmt3Reset,
} from "@/lib/time";
import {
  emitSoundEvent,
  getSoundSettings,
  unlockSoundPlayback,
  updateSoundSettings,
  type SoundSettings,
} from "@/lib/sound";
import {
  profileAvatarFromUser,
  isSupabaseConfigured,
  supabase,
  validateDisplayName,
  type Profile,
} from "@/lib/supabase/client";
import type {
  GalleryItem,
  MechanicsState,
  PetDebtContract,
  PetGalleryItem,
  PetTaskItem,
  TaskItem,
} from "@/lib/types";

const visibleGalleryItems: GalleryItem[] = [
  {
    id: "common-velvet-arrival",
    title: "Dollar Rain",
    rarity: "Common",
    unlockCost: 500,
    tag: "Pole Dancer",
    image: "/gallery/common-1.png",
    unlocked: false,
  },
  {
    id: "common-midnight-maid",
    title: "Leather Eclipse",
    rarity: "Common",
    unlockCost: 500,
    tag: "Rebel",
    image: "/gallery/common-2.png",
    unlocked: false,
  },
  {
    id: "common-executive-glare",
    title: "Golden Lust",
    rarity: "Common",
    unlockCost: 500,
    tag: "Gorgeous",
    image: "/gallery/common-3.png",
    unlocked: false,
  },
  {
    id: "common-rose-vault",
    title: "Silk & Vintage",
    rarity: "Common",
    unlockCost: 500,
    tag: "Pantyhose",
    image: "/gallery/common-4.png",
    unlocked: false,
  },
  {
    id: "rare-loyal-glimpse",
    title: "Crimson Veil",
    rarity: "Rare",
    moodRequired: 20,
    tag: "Tease",
    image: "/gallery/rare-1.png",
    unlocked: false,
  },
  {
    id: "rare-private-smile",
    title: "Campus Craving",
    rarity: "Rare",
    moodRequired: 25,
    tag: "Tsundere",
    image: "/gallery/rare-2.png",
    unlocked: false,
  },
  {
    id: "rare-purple-obsession",
    title: "Gym Goddess",
    rarity: "Rare",
    moodRequired: 40,
    tag: "Goddess",
    image: "/gallery/rare-3.png",
    unlocked: false,
  },
  {
    id: "rare-golden-approval",
    title: "Midnight Kitten",
    rarity: "Rare",
    moodRequired: 50,
    tag: "Neko",
    image: "/gallery/rare-4.png",
    unlocked: false,
  },
  {
    id: "divine-throne-room",
    title: "Sinful V",
    rarity: "Divine",
    moodRequired: 60,
    tag: "Shy Kitten",
    image: "/gallery/divine-1.png",
    unlocked: false,
  },
  {
    id: "divine-goddess-mood",
    title: "Leopard Fever",
    rarity: "Divine",
    moodRequired: 70,
    tag: "Pouting",
    image: "/gallery/divine-2.png",
    unlocked: false,
  },
  {
    id: "divine-final-favor",
    title: "Naughty Present",
    rarity: "Divine",
    moodRequired: 80,
    tag: "Gift",
    image: "/gallery/divine-3.png",
    unlocked: false,
  },
  {
    id: "divine-velvet-throne",
    title: "Witch's Desire",
    rarity: "Divine",
    moodRequired: 90,
    tag: "Naughty",
    image: "/gallery/divine-4.png",
    unlocked: false,
  },
];

const secretGalleryItem: GalleryItem = {
  id: "secret-defnes-final-favor",
  title: "Principessa's Final Favor",
  rarity: "Secret",
  moodRequired: 100,
  tag: "Luxury",
  image: "/gallery/secret-1.png",
  unlocked: false,
};

const sacrificeGalleryItems: GalleryItem[] = Array.from({ length: 10 }, (_, index) => ({
  id: `sacrifice-${index + 1}`,
  title: `Sacrifice Offering ${index + 1}`,
  rarity: "Sacrifice",
  tag: "Sacrifice Collection",
  image: `/gallery/sacrifice-${index + 1}.png`,
  unlocked: false,
}));

const moodUnlocks = [
  { id: "rare-loyal-glimpse", mood: 20 },
  { id: "rare-private-smile", mood: 25 },
  { id: "rare-purple-obsession", mood: 40 },
  { id: "rare-golden-approval", mood: 50 },
  { id: "divine-throne-room", mood: 60 },
  { id: "divine-goddess-mood", mood: 70 },
  { id: "divine-final-favor", mood: 80 },
  { id: "divine-velvet-throne", mood: 90 },
  { id: "secret-defnes-final-favor", mood: 100 },
];

type UserTaskRow = {
  task_id: string;
  completed_at: string | null;
  claimed_at: string | null;
  reward_coins: number | null;
  metadata: Record<string, unknown> | null;
};

type UserCosmeticRow = {
  item_id: string;
  item_type: CosmeticType;
  equipped: boolean | null;
};

type TemporarySpeechAvatarState = {
  avatarId: string;
  eventId: string;
};

type SiteAnnouncement = {
  id: string;
  title: string;
  body: string;
  active: boolean;
  starts_at: string;
  ends_at: string;
};

type UserTitleRow = {
  title_id: string;
  equipped: boolean | null;
};

type UserIrlTaskRow = {
  task_label: string;
  task_description: string | null;
  wheel_index: number;
  status: string;
  due_at: string | null;
  penalty_timeout_minutes: number | null;
};

type UserPetTaskRow = {
  task_id: string;
  completed_at: string | null;
  reward_score: number | null;
  status?: string | null;
  reviewed_at?: string | null;
  metadata: Record<string, unknown> | null;
};

function hasOwnProperty<T extends object>(value: T, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function resolveProfileDisplayName(profile: Partial<Profile>) {
  if (hasOwnProperty(profile, "displayName")) {
    return profile.displayName ?? null;
  }

  if (hasOwnProperty(profile, "display_name")) {
    return profile.display_name ?? null;
  }

  return undefined;
}

const profileSelect =
  "id, username, twitter_handle, display_name, avatar_url, equipped_avatar_slots, has_uncensored_avatar, coins, affection, tribute_total, lifetime_spent_coins, shame_count, is_admin, loyalty_streak, last_loyalty_at, last_login_at, timeout_until, timeout_reason, pet_score, owner_likeness, user_level, user_xp, stored_rights, right_expirations, daily_purchase_count, right_purchase_date, pet_unlocked_at, last_pet_decay_at, last_owner_likeness_at, last_pet_tax_at, created_at, updated_at";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const PET_WEEKLY_TAX_MIN_COST = 2500;
const PET_WEEKLY_TAX_MAX_COST = 10000;
const PET_TASK_REWARD = 10;
const PET_TASK_COIN_REWARD = 200;
const PET_REVIEW_TASK_COIN_REWARD = 250;
const PET_WEEKLY_TAX_REWARD = 20;
const PET_DAILY_CLICK_FLUSH_DELAY_MS = 2500;
const PET_DAILY_CLICK_FLUSH_BATCH_SIZE = 100;
const PET_DAILY_CLICK_MAX_COIN_REWARD = 200;
const PET_EVIL_WAIT_MS = 2 * 60 * 1000;
const PET_FAVOR_EMPTY_DAY_CHANCE = 0.12;
const PET_FAVOR_ROULETTE_COIN_REWARD = 500;
const IMAGE_DOWNLOAD_ALLOW_SELECTOR = "[data-allow-image-download]";
const LOCAL_GUEST_USER_ID = "local-guest-user";
const DEFAULT_SITE_ANNOUNCEMENT: Pick<SiteAnnouncement, "title" | "body"> = {
  title: "Announcement",
  body: "Higher or Lower and Case Opening have swapped places. Please check the new task positions before playing. This announcement will remain visible for 3 days.",
};

function getPetWeeklyTaxCost(coins: number) {
  return Math.min(
    PET_WEEKLY_TAX_MAX_COST,
    Math.max(PET_WEEKLY_TAX_MIN_COST, Math.floor(coins * 0.2)),
  );
}

const DEBT_AUTO_PAY_STORAGE_PREFIX = "vault-debt-auto-pay-enabled";
const PET_X_POST_TEXT = [
  "I belong to Principessa.",
  "My small dick is completely hers.",
  "Every night I’m forced to fill my mandatory humiliation report like the pathetic paypig I am.",
  "Every day I return for discipline, attention, and control.",
  "Craving the same shame and control?",
  "Click Here",
  "https://vault-mistress.vercel.app",
  "Weak. Leaking. Addicted."
].join("\n");
const PET_X_POST_URL = `https://x.com/intent/tweet?text=I%20belong%20to%20@VMPrincipessa.%20My%20small%20dick%20is%20completely%20hers.%20Every%20night%20I%E2%80%99m%20forced%20to%20fill%20my%20mandatory%20humiliation%20report%20like%20the%20pathetic%20pet%20I%20am.%0A%0ACraving%20the%20same%20shame%20and%20control%3F%0A%0AClick%20Here%20%E2%9C%85%0Ahttps%3A%2F%2Fvault-mistress.vercel.app%0A%0AWeak.%20Leaking.%20Addicted.%20%F0%9F%92%B8%F0%9F%94%97`;
void PET_X_POST_TEXT;
const MAX_TIMEOUT_DAYS = 1;
const TIMEOUT_RISK_TIMEOUT_MS = 12 * 60 * 60 * 1000;
const TIMEOUT_RISK_DAILY_SAFE_LIMIT = 2;
const SAFE_REWARD = 125;
const BEG_REWARD = 50;
const SACRIFICE_COST = 500;
const SACRIFICE_SUCCESS_COOLDOWN_MS = 60 * 60 * 1000;
const SACRIFICE_UNLOCK_CHANCE = 0.35;
const SUPPORT_COST = 2500;
const TIMEOUT_RISK_CHANCE = 0.2;
const JACKPOT_IDLE_REFRESH_MS = 5 * 60 * 1000;
const JACKPOT_NEAR_END_REFRESH_MS = 60 * 1000;
const JACKPOT_FINAL_REFRESH_MS = 15 * 1000;
const JACKPOT_WIN_SOUND_STORAGE_KEY = "vault:jackpot-win-sound:last-played";
const OWNER_LIKENESS_PROTECTED_USERNAME = "vmprincipessa";
const STREAK_BONUSES = [
  { id: "streak-bonus-1", milestone: 1, reward: 50, title: "1 day streak bonus" },
  { id: "streak-bonus-3", milestone: 3, reward: 125, title: "3 day streak bonus" },
  { id: "streak-bonus-7", milestone: 7, reward: 250, title: "7 day streak bonus" },
  { id: "streak-bonus-15", milestone: 15, reward: 500, title: "15 day streak bonus" },
  { id: "streak-bonus-30", milestone: 30, reward: 1000, title: "30 day streak bonus" },
] as const;

function getJackpotRefreshDelay(jackpot: LoyaltyJackpotState | null) {
  if (!jackpot?.phaseEndsAt) {
    return JACKPOT_IDLE_REFRESH_MS;
  }

  const msUntilPhaseEnds = new Date(jackpot.phaseEndsAt).getTime() - Date.now();

  if (!Number.isFinite(msUntilPhaseEnds)) {
    return JACKPOT_IDLE_REFRESH_MS;
  }

  if (msUntilPhaseEnds <= 5 * 60 * 1000) {
    return JACKPOT_FINAL_REFRESH_MS;
  }

  if (msUntilPhaseEnds <= 30 * 60 * 1000) {
    return JACKPOT_NEAR_END_REFRESH_MS;
  }

  return JACKPOT_IDLE_REFRESH_MS;
}

const petTasks: PetTaskItem[] = [
  {
    id: "pet-confession-dm",
    title: "Confession Repetition",
    description: "Type the fixed confession sentence exactly 5 times.",
    reward: PET_TASK_REWARD,
    kind: "confession-writing",
  },
  {
    id: "pet-daily-report",
    title: "Small Dick Touching Journal",
    description: "Report in full detail how many times you touched and played with your small dick today. Include the exact number of sessions, how long each one lasted, and the times they occurred.",
    reward: PET_TASK_REWARD,
    kind: "review",
  },
  {
    id: "pet-twitter-post",
    title: "X Post Assignment",
    description: "Open the prepared X post, publish it, then submit for review.",
    reward: PET_TASK_REWARD,
    actionLabel: "Open X Post",
    actionUrl: PET_X_POST_URL,
    kind: "review",
  },
  {
    id: "pet-weekly-throne-tax",
    title: "Weekly Throne Tax",
    description: "Send weekly Throne tax proof by DM.",
    reward: PET_WEEKLY_TAX_REWARD,
    kind: "weekly-tax",
  },
  {
    id: "pet-voice-proof",
    title: "Voice Proof",
    description: "Send a voice recording saying today's required Pet phrase by DM.",
    reward: PET_TASK_REWARD,
    kind: "review",
  },
  {
    id: "pet-perfect-writing",
    title: "Perfect Pet Writing",
    description: "Write the longer gratitude sentence with no mistakes. One attempt only; DM proof for review.",
    reward: PET_TASK_REWARD,
    kind: "perfect-writing",
  },
  {
    id: "pet-evil-wait",
    title: "Evil Wait Obediently",
    description: "After a 3 second countdown, do nothing for 2 minutes while distractions appear.",
    reward: PET_TASK_REWARD,
    kind: "evil-wait",
  },
  {
    id: "high-low",
    title: "Higher or Lower",
    description: "Choose higher or lower against the vault's next hidden number.",
    reward: 0,
    kind: "high-low",
  },
  {
    id: "pet-false-hope",
    title: "Obedience Sequence",
    description: "Alternate A and D to keep the signal stable. Wrong order pulls progress back.",
    reward: PET_TASK_REWARD,
    kind: "false-hope",
  },
  {
    id: "pet-favor-roulette",
    title: "Favor Roulette",
    description: "Choose one hidden card. One may hold a Special Favor; the rest are disappointments.",
    reward: PET_TASK_REWARD,
    kind: "favor-roulette",
  },
  {
    id: "pet-daily-click",
    title: "Daily Pet Clicks",
    description: "Complete today's required Pet clicks. Each click gives 1 coin, up to 200 coins per day.",
    reward: PET_TASK_REWARD,
    kind: "daily-click",
  },
  {
    id: "pet-debt-contract",
    title: "Debt Contract",
    description: "Sign a recurring debt contract and pay the selected amount each period.",
    reward: PET_TASK_REWARD,
    kind: "debt-contract",
  },
];

const petPerfectWritingSentencePool = [
  "I am grateful to serve as Principessa's obedient Pet and I will prove it with perfect discipline.",
  "I am a pathetic and weak pet who is truly grateful to serve Principessa as Her obedient and denied little bitch, and I will prove my worthless devotion with perfect discipline, daily humiliation and total submission every single day.",
  "I am deeply grateful to serve as Principessa’s pathetic paypig and obedient pet. My small dick, my pleasure and my dignity belong to Her completely, and I will prove my devotion with strict discipline, endless edging and constant shame.",
  "I am grateful and honored to serve as Principessa’s obedient, locked and denied pet. I exist only for Her amusement and control, and I will prove it every day with perfect discipline, honesty and humiliating obedience.",
  "I am a desperate, leaking paypig who is truly grateful to serve Principessa as Her personal obedient pet, and I will prove my pathetic submission with perfect discipline, daily reports and total financial and sexual control.",
  "I am grateful to be allowed to serve as Principessa’s weak and inferior pet. My small dick is useless and belongs to Her, and I will prove my loyalty with perfect discipline, constant denial and shameful obedience.",
  "I am truly grateful to serve Principessa as her devoted and humiliated pet. I accept my place beneath Her and I will prove my complete submission with perfect discipline, daily confessions and endless worship.",
  "I am a pathetic small dick loser who is grateful to serve as Principessa’s obedient pet. I will prove my devotion every single day with strict discipline, total honesty and by giving up all control to her.",
  "I am grateful to serve Principessa as her owned, controlled and regularly humiliated pet, and I will prove my worthless existence with perfect discipline, aching denial and unconditional obedience.",
];
const petConfessionSentencePool = [
  "I am Principessa's pathetic little pet, and I obey every rule like the weak bitch I am.",
  "Principessa owns my small dick, my mind, my money, and my dignity.",
  "I crawl back to the vault because I’m too weak to resist Principessa’s control.",
  "I’m grateful to be trained and humiliated as Principessa’s obedient paypig.",
  "Principessa’s approval is everything. I will degrade myself daily to earn it.",
  "I accept my place: locked, denied, and used for Principessa’s amusement.",
  "My pathetic Pet score and my tiny dick belong entirely to Principessa.",
  "I will not rush. I will edge and suffer properly like a good denied pet.",
  "Principessa’s pet waits, leaks, reports, and begs for more humiliation.",
  "Excuses are for weak losers. I prove my devotion with discipline and shame.",
  "I exist to be broken and reshaped into Principessa’s perfect humiliated pet.",
];
const petVoiceSentencePool = [
  "Principessa, I can’t resist spending money on you. Serving you turns me on so much.",
  "I keep thinking I should send you my entire salary, Principessa. I want to be your slave.",
  "I confess to Principessa, pleasing you is my greatest pleasure, even if it means going broke.",
  "Being under your control feels amazing. I’m handing over my money to you, Principessa.",
  "Every day I want to earn more money just to spend it all on you.",
  "Principessa, I’m even willing to go into debt for you. This is my deepest confession.",
  "I admit that I worship you and my money belongs to you, Principessa.",
  "I can’t stop myself. I constantly want to send you gifts. You are my owner.",
  "I’m ready to sacrifice every penny just to be crushed under Principessa’s feet.",
  "I confess, I can’t be happy without your findom. Please take my money, Principessa.",
  "I work for you, I earn for you, and I want to give it all to you.",
  "Principessa, owning me financially is your right. I surrender completely.",
];
const EVIL_CONSENT_PRIMARY_TEXT =
  "I confirm that these images belong to me and I am sharing them with my own consent.";
const EVIL_CONSENT_SECONDARY_TEXT =
  "I consent that Principessa may use these images and I accept the consequences.";
const EVIL_DEBT_TIMEZONE_OPTIONS = new Set(
  Array.from({ length: 25 }, (_, index) => {
    const offset = index - 12;
    return `UTC${offset >= 0 ? "+" : ""}${offset}`;
  }),
);

const petGalleryItems: PetGalleryItem[] = Array.from({ length: 30 }, (_, index) => ({
  id: `pet-gallery-${index + 1}`,
  title: `Pet Vault ${index + 1}`,
  image: `/gallery/pet-${index + 1}.png`,
  unlockCost: Math.ceil(((index + 1) * 1000) / 30),
}));

const startingTasks: TaskItem[] = [
  {
    id: "daily-login",
    title: "Login Reward",
    reward: 200,
    completed: true,
    claimed: false,
    kind: "claim",
  },
  ...STREAK_BONUSES.map((bonus) => ({
    id: bonus.id,
    title: bonus.title,
    reward: bonus.reward,
    completed: false,
    claimed: false,
    kind: "claim" as const,
  })),
  {
    id: "typing-accuracy",
    title: "Typing Accuracy",
    reward: 100,
    completed: false,
    claimed: false,
    kind: "typing",
    attemptsRemaining: 3,
  },
  {
    id: "number-pick",
    title: "Number Pick",
    reward: 100,
    completed: false,
    claimed: false,
    kind: "number-pick",
  },
  {
    id: "case-opening",
    title: "Case Opening",
    reward: 0,
    completed: false,
    claimed: false,
    kind: "case-open",
  },
  {
    id: "timeout-risk",
    title: "Risk My Freedom",
    reward: SAFE_REWARD,
    completed: false,
    claimed: false,
    kind: "timeout-risk",
  },
  {
    id: "irl-task-wheel",
    title: "IRL Task Wheel",
    reward: 0,
    completed: false,
    claimed: false,
    kind: "irl-wheel",
  },
  {
    id: "wait-obediently",
    title: "Wait Obediently",
    reward: 100,
    completed: false,
    claimed: false,
    kind: "wait-obediently",
  },
  {
    id: "vertical-motion",
    title: "Daily Edge",
    reward: 100,
    completed: false,
    claimed: false,
    kind: "movement",
    movementProgress: 0,
    movementState: "ready",
  },
  {
    id: "affection",
    title: "Reach 50 affection",
    reward: 250,
    completed: false,
    claimed: false,
    kind: "claim",
  },
  {
    id: "affection-80",
    title: "Reach 80 affection",
    reward: 250,
    completed: false,
    claimed: false,
    kind: "claim",
  },
];

const typingSentencePool = [
  "I am a pathetic paypig for Principessa.",
  "My only purpose is to send and be drained.",
  "Principessa owns my wallet and my dignity.",
  "I am a worthless loser.",
  "I am nothing but a human ATM.",
  "I get hard when Principessa takes my money.",
  "I am a weak beta who sends without thinking.",
  "I am a completely worthless paypig whose only value is in my wallet.",
  "A loyal player studies before acting.",
  "Principessa owns my money, my dignity, and my pathetic existence.",
  "I exist solely to be drained and humiliated by my superior Goddess.",
  "Please ruin me financially and laugh at how weak I am, Principessa.",
  "I am a broke, desperate loser who lives to tribute Principessa.",
  "My purpose in life is to send everything I have to my greedy Mistress.",
  "I surrender my wallet, my pride, and my self-respect to Principessa.",
  "Being used and drained by Principessa is the only thing I deserve.",
  "I am an inferior paypig and I beg you to take everything from me.",
  "Principessa, I am your devoted financial slave and I will send until I break.",
  "I am a disgusting paypig who gets aroused only when my money is being stolen.",
  "Principessa, I am nothing but a pathetic, leaking wallet begging to be emptied.",
  "Use me, abuse me, and drain every last coin from this worthless beta bitch.",
  "My biggest pleasure in life is watching my balance drop while you ignore me.",
  "My entire existence revolves around sending tributes to Principessa and being humiliated for how broke and desperate I am.",
  "I surrender my wallet, my dignity, and my self-respect to Principessa and I will keep sending until I have nothing left.",
  "Being financially dominated and ignored by Principessa is the only thing a pathetic paypig like me truly deserves in this life.",
  "Please drain my account dry and laugh at me while I stroke to the thought of becoming completely broke for you, Principessa.",
  "I am nothing but a leaking, addicted wallet who lives to be used, abused, and financially destroyed by my greedy Mistress.",
  "I surrender complete control of my finances to Principessa and I promise to stay a loyal, obedient, and financially ruined paypig for as long as you allow me to serve you.",
  "The thought of being completely drained and left with nothing by such a powerful and greedy Goddess like Principessa makes this worthless beta leak and throb with shameful excitement.",
  "I am a pathetic and worthless slave who admits that I deserve nothing but humiliation and contempt from Principessa.",
  "I confess that I am inferior, useless, and completely pathetic in every way before Principessa.",
  "I am a pathetic loser with a tiny useless dick who admits that I can never satisfy a woman and deserve only humiliation from Principessa.",
  "I beg Principessa to laugh at my tiny useless cock while I stroke it shamefully in front of her.",
  "My wallet exists solely for Principessa to use and destroy as she pleases.",
  "Principessa owns every cent I have and every shred of my dignity.",
  "I get painfully hard knowing Principessa is ruining me financially.",
  "Being used as Principessa’s personal cash cow is my highest purpose.",
  "My tiny useless cock throbs only when Principessa drains my account.",
  "I leak like a desperate loser while Principessa ruins my finances.",
  "I’m a leaking paypig whose tiny cock drips for every dollar Principessa steals.",
  "Every time I send to Principessa, my small dick leaks in complete submission.",
];

const dailyTeases = [
  "Principessa is awake. Empty your wallet for me like the pathetic paypig you are.",
  "Want my attention? Pay for it. Principessa doesn’t waste time on broke boys.",
  "Losers like you don’t need savings. They need a Superior Woman to control them.",
  "Principessa is online. Time to drain that wallet, paypig. You know you exist for my luxury.",
  "Principessa doesn’t do free attention. Tribute first, or stay invisible like the broke bitch you are.",
  "Want to talk to me? Prove you’re not a pathetic time-waster. Send and kneel.",
  "Real men provide. Losers like you just leak and send. Get draining, paypig.",
  "Your savings are cute. They’d look much better in my account.",
];

const affectionCharacterStages = [
  {
    id: "velvet-gate",
    image: "/character.png",
    label: "No Attention",
    min: 0,
  },
  {
    id: "rare-attention",
    image: "/character-stage-25.png",
    label: "Rare Attention",
    min: 25,
  },
  {
    id: "gilded-approval",
    image: "/character-stage-50.png",
    label: "Gilded Approval",
    min: 50,
  },
  {
    id: "royal-claim",
    image: "/character-stage-75.png",
    label: "Royal Claim",
    min: 75,
  },
  {
    id: "perfect-devotion",
    image: "/character-stage-100.png",
    label: "Perfect Devotion",
    min: 100,
  },
] as const;

const affectionDailyMessagePools = [
  {
    min: 0,
    messages: dailyTeases,
  },
  {
    min: 25,
    messages: [
      "Principessa notices the vault opening a little wider. Do not mistake that for mercy.",
      "Your persistence has bought you a sharper glance from Principessa.",
      "A faint approval enters the room. Keep proving you deserve it.",
    ],
  },
  {
    min: 50,
    messages: [
      "Principessa is entertained now. That is expensive attention.",
      "The vault feels warmer, but only because your devotion is finally useful.",
      "You are beginning to look less forgettable in Principessa's eyes.",
    ],
  },
  {
    min: 75,
    messages: [
      "Principessa's approval is rare, polished, and still not free.",
      "The vault recognizes your loyalty. Principessa expects you to maintain it.",
      "Her attention lingers longer today. Do not waste the privilege.",
    ],
  },
  {
    min: 100,
    messages: [
      "Principessa is fully pleased. The vault marks you as one of her finest possessions.",
      "Perfect devotion has a glow of its own. Principessa allows you to see it.",
      "You reached the peak of her mood. Now stay worthy of it.",
    ],
  },
] as const;

const affectionMoodLines = [
  { min: 0, text: "Principessa barely acknowledges you. Even the vault feels colder." },
  { min: 5, text: "Principessa notices your presence, but only enough to judge it." },
  { min: 10, text: "Principessa gives you a slow glance. Not approval. Curiosity." },
  { min: 15, text: "Principessa seems mildly amused by your persistence." },
  { min: 20, text: "Principessa's mood softens just enough to unlock a rare glance." },
  { min: 25, text: "Principessa lets the silence linger, then rewards you with attention." },
  { min: 30, text: "Principessa is entertained. That is more than most deserve." },
  { min: 35, text: "Principessa's smile looks expensive, and somehow you earned a fraction of it." },
  { min: 40, text: "Principessa is pleased enough to let you see a little more of the vault." },
  { min: 45, text: "Principessa watches you like an investment that might finally pay off." },
  { min: 50, text: "Principessa approves. Barely. But from her, barely is dangerous." },
  { min: 55, text: "Principessa's attention lingers longer than usual. Do not waste it." },
  { min: 60, text: "Principessa's mood turns divine. The vault begins to open deeper." },
  { min: 65, text: "Principessa is satisfied, as if your loyalty is finally becoming useful." },
  { min: 70, text: "Principessa rewards devotion with a colder smile and a richer prize." },
  { min: 75, text: "Principessa seems almost proud. Almost." },
  { min: 80, text: "Principessa's approval feels rare, polished, and impossible to ignore." },
  { min: 85, text: "Principessa treats your devotion like something already marked by the vault." },
  { min: 90, text: "Principessa's mood is dangerously high. The final divine doors open." },
  { min: 95, text: "Principessa is indulgent now, but only because you have proven useful." },
  { min: 100, text: "Principessa is fully pleased. The secret reward reveals itself." }
];

const begIgnoredLines = [
  "Principessa is ignoring you right now. You're not even worth her time.",
  "Ignored again... how does it feel being this forgettable?",
  "Principessa has better things to do than waste attention on a loser like you.",
  "She sees you... and still chooses to ignore you. Embarrassing.",
  "No response. How humbling.",
];

const begRewardLines = [
  "Your desperate begging entertained me, so I threw you a small reward.",
  "I pitied your begging and gave you something. Say thank you.",
  "I decided to reward your desperation. How humiliating for you.",
  "Fine. A small gift, because the silence was getting boring.",
];

const sacrificeFailureLines = [
  "You sacrificed all those coins for nothing. How pathetic.",
  "Your coins are gone and I still don't care about you.",
  "All that sacrifice... completely worthless. Just like you.",
  "I watched you throw away your coins and laughed.",
];

const sacrificeSuccessLines = [
  "Your sacrifice pleased me. Good boy.",
  "I took your offering. You may thank me properly.",
  "I liked your sacrifice. You earned a small mercy.",
  "Successful sacrifice. I'm marginally impressed.",
];

const supportLines = [
  "Principessa took your coins without a single word. You're nothing to her.",
  "Coins gone. She still doesn't care about you.",
  "A worthless pig sent money and got ignored. Shocking.",
  "Your support was accepted. Your dignity was not.",
  "She drained you again and remains completely indifferent.",
  "Pathetic. Even your coins can't make her respect you.",
  "The vault swallowed your offering. Principessa is bored.",
  "You paid like a good little loser. Still irrelevant.",
  "Support recorded. Principessa thinks you're laughable.",
  "Your coins were taken. You remain a disgusting beta.",
];

function getAffectionMoodLine(affection: number) {
  return [...affectionMoodLines]
    .reverse()
    .find((line) => affection >= line.min)?.text ?? affectionMoodLines[0].text;
}

function getAffectionCharacterStage(affection: number) {
  return [...affectionCharacterStages]
    .reverse()
    .find((stage) => affection >= stage.min) ?? affectionCharacterStages[0];
}

function getAffectionDailyMessage(affection: number) {
  const unlockedMessages = affectionDailyMessagePools.flatMap((pool) =>
    affection >= pool.min ? pool.messages : [],
  );
  const dayIndex = new Date().getDay();

  return unlockedMessages[dayIndex % unlockedMessages.length] ?? dailyTeases[dayIndex % dailyTeases.length];
}

function getUnlockedProgressionTitleIds(tributeTotal: number) {
  return titleItems
    .filter((title) => title.source === "progression" && tributeTotal >= (title.minTribute ?? 0))
    .map((title) => title.id);
}

function getUnlockedThroneTitleIds(throneCoins: number) {
  return titleItems
    .filter((title) => title.source === "throne" && throneCoins >= (title.minThroneCoins ?? 0))
    .map((title) => title.id);
}

function getDefaultTitleId(tributeTotal: number) {
  return [...titleItems]
    .reverse()
    .find((title) => title.source === "progression" && tributeTotal >= (title.minTribute ?? 0))
    ?.id ?? "leadership-0";
}

function getPremiumShopTitle() {
  return titleItems.find((title) => title.source === "shop") ?? titleItems[0];
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const maybeError = error as { message?: unknown };

    if (typeof maybeError.message === "string") {
      return maybeError.message;
    }

    try {
      return JSON.stringify(error, null, 2);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

function createApiError(endpoint: string, response: Response, payload: { error?: string; message?: string }) {
  const message = payload.message ?? payload.error ?? `${endpoint} failed with HTTP ${response.status}`;
  const error = new Error(message) as Error & {
    endpoint?: string;
    payload?: unknown;
    status?: number;
  };

  error.endpoint = endpoint;
  error.payload = payload;
  error.status = response.status;
  return error;
}

function getDailyCooldownUntil(value: string | null) {
  return getDailyGmt3CooldownUntil(value);
}

function getCooldownUntil(value: string | null, milliseconds: number) {
  if (!value) {
    return null;
  }

  const cooldownEndsAt = new Date(value).getTime() + milliseconds;

  if (Date.now() >= cooldownEndsAt) {
    return null;
  }

  return new Date(cooldownEndsAt).toISOString();
}

function getPetTaskCooldownUntil(value: string | null) {
  return getDailyCooldownUntil(value);
}

function getWaitTaskState(
  status: string | null,
  countdownEndsAt: string | null,
  waitEndsAt: string | null,
  cooldownUntil: string | null,
): TaskItem["waitState"] {
  const now = Date.now();
  const countdownMs = countdownEndsAt ? new Date(countdownEndsAt).getTime() : 0;
  const waitMs = waitEndsAt ? new Date(waitEndsAt).getTime() : 0;

  if (status === "countdown" && countdownMs > now) {
    return "countdown";
  }

  if ((status === "countdown" || status === "waiting") && waitMs > now) {
    return "waiting";
  }

  if (cooldownUntil) {
    return "cooldown";
  }

  if (status === "completed") {
    return "completed";
  }

  if (status === "failed") {
    return "failed";
  }

  return "ready";
}

function buildHighLowPetTask(task: PetTaskItem, highLowRow: UserTaskRow | null) {
  const highLowCooldownUntil = getCooldownUntil(highLowRow?.claimed_at ?? null, HIGH_LOW_REPLAY_COOLDOWN_MS);
  const windowStartedAt =
    getTaskMetadataString(highLowRow?.metadata, "higherLowerWindowStartedAt") ??
    highLowRow?.claimed_at ??
    null;
  const windowActive = Boolean(getDailyGmt3CooldownUntil(windowStartedAt));
  const highLowResetAt = windowActive ? getDailyGmt3CooldownUntil(windowStartedAt) : null;
  const dailyProfit = windowActive
    ? getTaskMetadataNumber(highLowRow?.metadata, "higherLowerDailyProfit", 0)
    : 0;
  const dailyWins = windowActive ? getTaskMetadataNumber(highLowRow?.metadata, "higherLowerDailyWins", 0) : 0;
  const dailyBetTotal = windowActive
    ? getTaskMetadataNumber(
        highLowRow?.metadata,
        "higherLowerDailyBetTotal",
        getTaskMetadataNumber(highLowRow?.metadata, "higherLowerDailyWinningExposure", 0),
      )
    : 0;

  return {
    ...task,
    completed: Boolean(highLowRow?.completed_at),
    claimed: Boolean(highLowCooldownUntil),
    cooldownUntil: highLowCooldownUntil,
    currentNumber:
      getTaskMetadataNumber(highLowRow?.metadata, "highLowCurrentNumber", Number.NaN) ??
      getTaskMetadataNumber(highLowRow?.metadata, "currentNumber", Number.NaN) ??
      undefined,
    highLowNextNumber:
      getTaskMetadataNumber(highLowRow?.metadata, "highLowNextNumber", Number.NaN) ??
      getTaskMetadataNumber(highLowRow?.metadata, "nextNumber", Number.NaN) ??
      undefined,
    highLowDailyDate: windowActive ? getDailyKey() : null,
    highLowDailyBetTotal: dailyBetTotal,
    highLowDailyLocked: isHighLowLocked(dailyBetTotal, dailyProfit),
    highLowDailyProfit: dailyProfit,
    highLowDailyWins: dailyWins,
    highLowBetAllowance: getHighLowBetAllowance(dailyBetTotal),
    highLowResetAt,
    highLowRoundAvailableAt:
      getTaskMetadataString(highLowRow?.metadata, "highLowRoundAvailableAt") ??
      getTaskMetadataString(highLowRow?.metadata, "nextBaseRevealAt") ??
      null,
  };
}

function buildPetTasksFromRows(
  rows: UserPetTaskRow[],
  lastPetTaxAt?: string | null,
  highLowRow?: UserTaskRow | null,
) {
  return petTasks.map((task) => {
    const petRow = task.id === "high-low" ? null : rows.find((entry) => entry.task_id === task.id) ?? null;
    const row = task.id === "high-low" ? highLowRow ?? null : petRow;
    const baseStatus =
      task.id === "high-low" ? "available" : ((petRow?.status as PetTaskItem["status"]) ?? "available");
    const completedAt = row?.completed_at ?? null;
    const reviewedAt = task.id === "high-low" ? null : petRow?.reviewed_at ?? null;

    if (task.kind === "perfect-writing") {
      const failedAt = getTaskMetadataString(row?.metadata, "failedAt");
      const cooldownUntil = getPetTaskCooldownUntil(completedAt ?? failedAt);

      return {
        ...task,
        attemptsRemaining: cooldownUntil ? 0 : 1,
        completedAt,
        cooldownUntil,
        reviewedAt,
        sentence: getDailyPetPerfectWritingSentence(),
        status: cooldownUntil ? baseStatus : "available",
      };
    }

    if (task.kind === "confession-writing") {
      const cooldownUntil = getPetTaskCooldownUntil(completedAt);
      const confessionCount =
        completedAt && !cooldownUntil ? 0 : getTaskMetadataNumber(row?.metadata, "count", 0);

      return {
        ...task,
        completedAt,
        confessionCount,
        cooldownUntil,
        reviewedAt,
        sentence: getDailyPetConfessionSentence(),
        status: cooldownUntil ? baseStatus : "available",
      };
    }

    if (task.kind === "weekly-tax") {
      const taxCompletedAt = completedAt ?? lastPetTaxAt ?? null;
      const cooldownUntil = getCooldownUntil(taxCompletedAt, WEEK_MS);
      const status: PetTaskItem["status"] =
        cooldownUntil ? ((baseStatus === "available" ? "approved" : baseStatus) as PetTaskItem["status"]) : "available";

      return {
        ...task,
        completedAt: taxCompletedAt,
        cooldownUntil,
        reviewedAt,
        status,
      };
    }

    if (task.kind === "debt-contract") {
      return {
        ...task,
        completedAt,
        reviewedAt,
        status: baseStatus,
      };
    }

    if (task.kind === "high-low") {
      const highLowTaskRow = highLowRow ?? null;
      const highLowCooldownUntil = getCooldownUntil(highLowTaskRow?.claimed_at ?? null, HIGH_LOW_REPLAY_COOLDOWN_MS);
      const windowStartedAt =
        getTaskMetadataString(highLowTaskRow?.metadata, "higherLowerWindowStartedAt") ??
        highLowTaskRow?.claimed_at ??
        null;
      const windowActive = Boolean(getDailyGmt3CooldownUntil(windowStartedAt));
      const highLowResetAt = windowActive ? getDailyGmt3CooldownUntil(windowStartedAt) : null;
      const dailyProfit = windowActive
        ? getTaskMetadataNumber(highLowTaskRow?.metadata, "higherLowerDailyProfit", 0)
        : 0;
      const dailyWins = windowActive ? getTaskMetadataNumber(highLowTaskRow?.metadata, "higherLowerDailyWins", 0) : 0;
      const dailyBetTotal = windowActive
        ? getTaskMetadataNumber(
            highLowTaskRow?.metadata,
            "higherLowerDailyBetTotal",
            getTaskMetadataNumber(highLowTaskRow?.metadata, "higherLowerDailyWinningExposure", 0),
          )
        : 0;

      return {
        ...task,
        completed: Boolean(highLowTaskRow?.completed_at),
        claimed: Boolean(highLowCooldownUntil),
        cooldownUntil: highLowCooldownUntil,
        currentNumber:
          getTaskMetadataNumber(highLowTaskRow?.metadata, "highLowCurrentNumber", Number.NaN) ??
          getTaskMetadataNumber(highLowTaskRow?.metadata, "currentNumber", Number.NaN) ??
          undefined,
        highLowNextNumber:
          getTaskMetadataNumber(highLowTaskRow?.metadata, "highLowNextNumber", Number.NaN) ??
          getTaskMetadataNumber(highLowTaskRow?.metadata, "nextNumber", Number.NaN) ??
          undefined,
        highLowDailyDate: windowActive ? getDailyKey() : null,
        highLowDailyBetTotal: dailyBetTotal,
        highLowDailyLocked: isHighLowLocked(dailyBetTotal, dailyProfit),
        highLowDailyProfit: dailyProfit,
        highLowDailyWins: dailyWins,
        highLowBetAllowance: getHighLowBetAllowance(dailyBetTotal),
        highLowResetAt,
        highLowRoundAvailableAt:
          getTaskMetadataString(highLowTaskRow?.metadata, "highLowRoundAvailableAt") ??
          getTaskMetadataString(highLowTaskRow?.metadata, "nextBaseRevealAt") ??
          null,
      };
    }

    if (task.kind === "evil-wait") {
      const status = getTaskMetadataString(row?.metadata, "status");
      const cooldownUntil = getPetTaskCooldownUntil(row?.completed_at ?? null);
      const waitCountdownEndsAt = getTaskMetadataString(row?.metadata, "countdownEndsAt");
      const waitEndsAt = getTaskMetadataString(row?.metadata, "waitEndsAt");
      const waitState = getWaitTaskState(status, waitCountdownEndsAt, waitEndsAt, cooldownUntil);

      return {
        ...task,
        completedAt,
        cooldownUntil,
        reviewedAt,
        status: baseStatus,
        waitCountdownEndsAt,
        waitEndsAt,
        waitState,
      };
    }

    if (task.kind === "false-hope") {
      const cooldownUntil = getPetTaskCooldownUntil(completedAt);
      const isCoolingDown = Boolean(cooldownUntil);
      const hasActiveProgress = !completedAt;
      const progress = getTaskMetadataNumber(row?.metadata, "progress", 0);
      const stage = getTaskMetadataNumber(row?.metadata, "stage", 1);
      const wrongInputs = getTaskMetadataNumber(row?.metadata, "wrongInputs", 0);
      const expectedKeyRaw = getTaskMetadataString(row?.metadata, "expectedKey");
      const expectedKey: "a" | "d" = expectedKeyRaw === "d" ? "d" : "a";

      return {
        ...task,
        completedAt: isCoolingDown ? completedAt : null,
        cooldownUntil,
        falseHopeExpectedKey: isCoolingDown || hasActiveProgress ? expectedKey : "a",
        falseHopeProgress: isCoolingDown || hasActiveProgress ? progress : 0,
        falseHopeStage: isCoolingDown || hasActiveProgress ? stage : 1,
        falseHopeWrongInputs: isCoolingDown || hasActiveProgress ? wrongInputs : 0,
        reviewedAt: null,
        status: isCoolingDown ? baseStatus : "available" as const,
      };
    }

    if (task.kind === "favor-roulette") {
      const result = getTaskMetadataString(row?.metadata, "result");
      const typedResult: PetTaskItem["favorResult"] =
        result === "win" || result === "loss" || result === "empty-day" ? result : null;
      const cooldownUntil = getPetTaskCooldownUntil(completedAt);
      const isCoolingDown = Boolean(cooldownUntil);

      return {
        ...task,
        completedAt: isCoolingDown ? completedAt : null,
        cooldownUntil,
        favorPickedIndex: isCoolingDown ? getTaskMetadataNumber(row?.metadata, "pickedIndex", -1) : null,
        favorResult: isCoolingDown ? typedResult : null,
        favorWinningIndex: isCoolingDown ? getTaskMetadataNumber(row?.metadata, "winningIndex", -1) : null,
        reviewedAt: isCoolingDown ? reviewedAt : null,
        status: isCoolingDown ? baseStatus : "available",
      };
    }

    if (task.kind === "daily-click") {
      const today = getDailyKey();
      const metadataDate = getTaskMetadataString(row?.metadata, "date");
      const isToday = metadataDate === today;
      const requirement = isToday ? getTaskMetadataNumber(row?.metadata, "requirement", 0) : 0;
      const progress = isToday ? getTaskMetadataNumber(row?.metadata, "progress", 0) : 0;
      const completed = Boolean(isToday && requirement > 0 && progress >= requirement);

      return {
        ...task,
        clickDate: isToday ? metadataDate : null,
        clickImage: isToday ? getTaskMetadataString(row?.metadata, "image") : null,
        clickProgress: isToday ? progress : 0,
        clickRequirement: isToday ? requirement : 0,
        completedAt: completed ? completedAt : null,
        reviewedAt: completed ? reviewedAt : null,
        status: completed ? "approved" as const : "available" as const,
      };
    }

    if (task.id === "pet-voice-proof") {
      return {
        ...task,
        status: baseStatus,
        completedAt,
        reviewedAt,
        cooldownUntil: getPetTaskCooldownUntil(completedAt),
        voiceSentence: getDailyPetVoiceSentence(),
      };
    }

    return {
      ...task,
      status: baseStatus,
      completedAt,
        reviewedAt,
      cooldownUntil: getPetTaskCooldownUntil(completedAt),
    };
  });
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function formatEventCountdown(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  return `${days}d ${hours}h ${minutes}m`;
}

function randomFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomChance(probability: number) {
  return Math.random() < probability;
}

function normalizeWritingComparisonText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "")
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u02BC\u02BB\uFF07\u00B4`]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\uFF02]/g, '"')
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

function formatLongTimeoutDuration(milliseconds: number) {
  const totalDays = Math.max(0, Math.ceil(milliseconds / DAY_MS));
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  const days = (totalDays % 365) % 30;

  return `${years} years ${months} months ${days} days`;
}

function writingStartsWith(sentence: string, value: string) {
  return normalizeWritingComparisonText(sentence).startsWith(
    normalizeWritingComparisonText(value),
  );
}

function writingEquals(sentence: string, value: string) {
  return normalizeWritingComparisonText(sentence) === normalizeWritingComparisonText(value);
}

function getDailyTypingSentence() {
  const dayIndex = getGmt3DayIndex();
  return typingSentencePool[dayIndex % typingSentencePool.length];
}

function getDailyPetVoiceSentence() {
  const dayIndex = getGmt3DayIndex();
  return petVoiceSentencePool[dayIndex % petVoiceSentencePool.length];
}

function getDailyPetPerfectWritingSentence() {
  const dayIndex = getGmt3DayIndex();
  return petPerfectWritingSentencePool[dayIndex % petPerfectWritingSentencePool.length];
}

function getDailyPetConfessionSentence() {
  const dayIndex = getGmt3DayIndex();
  return petConfessionSentencePool[dayIndex % petConfessionSentencePool.length];
}

function getDebtAutoPayStorageKey(userId: string) {
  return `${DEBT_AUTO_PAY_STORAGE_PREFIX}:${userId}`;
}

function getJackpotWinnerRevealKey(jackpotState: LoyaltyJackpotState | null) {
  if (!jackpotState) {
    return null;
  }

  const winners =
    jackpotState.currentWinners.length > 0
      ? jackpotState.currentWinners
      : jackpotState.currentWinner
        ? [jackpotState.currentWinner]
        : [];

  if (winners.length === 0) {
    return null;
  }

  const winnerKey = winners
    .map((winner) =>
      [
        winner.place ?? 0,
        winner.username,
        winner.amount,
        winner.selectedAt,
      ].join(":"),
    )
    .join("|");

  return `${jackpotState.id}:${jackpotState.cycleKey}:${winnerKey}`;
}

function readDebtAutoPayEnabled(userId: string) {
  if (typeof window === "undefined") {
    return false;
  }

  const stored = window.localStorage.getItem(getDebtAutoPayStorageKey(userId));
  return stored === "true";
}

function writeDebtAutoPayEnabled(userId: string, enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getDebtAutoPayStorageKey(userId), String(enabled));
}

function withTimeout<T>(promise: PromiseLike<T>, label: string, timeoutMs = 12000) {
  let timeoutId: number | null = null;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out.`));
    }, timeoutMs);
  });

  return Promise.race([
    promise,
    timeout,
  ]).finally(() => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  });
}

function getDebtPeriodMs(periodType: PetDebtContract["period_type"]) {
  return periodType === "weekly" ? WEEK_MS : 30 * DAY_MS;
}

function getDueDebtPaymentPlan(
  contract: PetDebtContract,
  options: { autoPayEnabled: boolean; nowMs?: number },
) {
  if (contract.status !== "active") {
    return null;
  }

  const nowMs = options.nowMs ?? Date.now();
  const dueMs = new Date(contract.next_due_at).getTime();

  if (!Number.isFinite(dueMs) || dueMs > nowMs) {
    return null;
  }

  const remainingPeriods = Math.max(0, contract.duration_periods - contract.paid_periods);

  if (remainingPeriods === 0) {
    return null;
  }

  const periodMs = getDebtPeriodMs(contract.period_type);
  const activeDuePeriods = Math.floor((nowMs - dueMs) / periodMs) + 1;
  const missedDuePeriods = Math.floor((nowMs - dueMs) / periodMs);
  const duePeriods = Math.min(
    remainingPeriods,
    options.autoPayEnabled ? activeDuePeriods : missedDuePeriods,
  );

  if (duePeriods <= 0) {
    return null;
  }

  const nextPaidPeriods = contract.paid_periods + duePeriods;
  const completed = nextPaidPeriods >= contract.duration_periods;
  const nextDueAt = completed
    ? contract.next_due_at
    : new Date(dueMs + duePeriods * periodMs).toISOString();

  return {
    amount: contract.debt_amount * duePeriods,
    completed,
    duePeriods,
    missedPeriods: options.autoPayEnabled ? 0 : duePeriods,
    nextDueAt,
    nextPaidPeriods,
  };
}

function getDailyKey(date: Date | number | string = new Date()) {
  return getGmt3DateKey(date);
}

function isPetTaskApprovedToday(task: PetTaskItem, today = getDailyKey()) {
  if (task.id === "pet-affection-claim" || task.status !== "approved") {
    return false;
  }

  const completedDate = task.completedAt ? getDailyKey(task.completedAt) : null;
  const reviewedDate = task.reviewedAt ? getDailyKey(task.reviewedAt) : null;
  const taskDate = task.clickDate ?? null;

  return completedDate === today || reviewedDate === today || taskDate === today;
}

function normalizeUsernameKey(value: string | null | undefined) {
  return (value ?? "").replace(/^@+/, "").trim().toLowerCase();
}

function getStreakCycleKey(streak: number, lastLoyaltyAt: string | null) {
  if (!lastLoyaltyAt || streak <= 0) {
    return null;
  }

  const cycleStart = new Date(lastLoyaltyAt);
  cycleStart.setUTCDate(cycleStart.getUTCDate() - (streak - 1));
  return getGmt3DateKey(cycleStart);
}

function generateNumberPickOptions(seed = getGmt3DayIndex()) {
  const options = new Set<number>();
  let step = 0;

  while (options.size < 3) {
    const value = ((seed + step * 7) % 9) + 1;
    options.add(value);
    step += 1;
  }

  return Array.from(options).sort((a, b) => a - b);
}

function getTaskMetadataNumberArray(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = metadata?.[key];

  if (!Array.isArray(value)) {
    return null;
  }

  const numbers = value.filter(
    (entry): entry is number => typeof entry === "number" && Number.isFinite(entry),
  );

  return numbers.length === value.length ? numbers : null;
}

function getTaskMetadataNumber(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number,
) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getTaskMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function isCompletedAfterClaim(row: UserTaskRow | undefined) {
  if (!row?.completed_at) {
    return false;
  }

  if (!row.claimed_at) {
    return true;
  }

  return new Date(row.completed_at).getTime() > new Date(row.claimed_at).getTime();
}

function buildTasksFromRows(
  rows: UserTaskRow[],
  affection: number,
  loyaltyStreak: number,
  lastLoyaltyAt: string | null,
  assignedIrlTask: UserIrlTaskRow | null,
  timeoutUntil: string | null,
) {
  return startingTasks.map((task) => {
    const row =
      rows.find((entry) => entry.task_id === task.id);
    const claimedForever = Boolean(row?.claimed_at);
    const failureCooldownUntil = getDailyCooldownUntil(
      getTaskMetadataString(row?.metadata, "failedAt"),
    );
    const claimCooldownUntil = getDailyCooldownUntil(row?.claimed_at ?? null);
    const cooldownUntil = claimCooldownUntil ?? failureCooldownUntil;

    if (task.id === "daily-login") {
      return {
        ...task,
        completed: !cooldownUntil,
        claimed: Boolean(cooldownUntil),
        cooldownUntil,
      };
    }

    const streakBonus = STREAK_BONUSES.find((bonus) => bonus.id === task.id);

    if (streakBonus) {
      const claimed = Boolean(row?.claimed_at);

      return {
        ...task,
        completed: loyaltyStreak >= streakBonus.milestone,
        claimed,
      };
    }

    if (task.id === "typing-accuracy") {
      return {
        ...task,
        attemptsRemaining: cooldownUntil
          ? getTaskMetadataNumber(row?.metadata, "attemptsRemaining", 0)
          : 3,
        completed: !cooldownUntil && isCompletedAfterClaim(row),
        claimed: Boolean(cooldownUntil),
        cooldownUntil,
        sentence: getDailyTypingSentence(),
      };
    }

    if (task.id === "case-opening") {
      const reward = getTaskMetadataNumber(row?.metadata, "reward", 0);
      const completed = Boolean(row?.completed_at);
      const caseCooldownUntil = getPetTaskCooldownUntil(row?.claimed_at ?? row?.completed_at ?? null);

      return {
        ...task,
        caseReward: reward || null,
        caseSpunAt: completed ? row?.completed_at ?? null : null,
        claimed: Boolean(caseCooldownUntil),
        completed,
        cooldownUntil: caseCooldownUntil,
      };
    }

    if (task.id === "number-pick") {
	  const metadata = cooldownUntil ? row?.metadata : {};

	  const options =
		getTaskMetadataNumberArray(metadata, "options") ?? generateNumberPickOptions();
	  const selected = getTaskMetadataNumber(metadata, "selected", Number.NaN);
	  const correct = getTaskMetadataNumber(metadata, "correct", Number.NaN);
	  const attemptsRemaining = getTaskMetadataNumber(metadata, "attemptsRemaining", 2);
	  const wrongSelections = getTaskMetadataNumberArray(metadata, "wrongSelections") ?? [];
	  const rawResult = getTaskMetadataString(metadata, "result");
	  const result: "win" | "loss" | null =
		rawResult === "win" || rawResult === "loss" ? rawResult : null;

	  return {
		...task,
		claimed: Boolean(cooldownUntil),
		completed: result === "win",
		cooldownUntil,
		numberPickAttemptsRemaining: cooldownUntil ? 0 : attemptsRemaining,
		numberPickCorrect: Number.isFinite(correct) ? correct : undefined,
		numberPickOptions: options,
		numberPickResult: result,
		numberPickSelected: Number.isFinite(selected) ? selected : null,
		numberPickWrongSelections: wrongSelections,
	  };
	}

    if (task.id === "wait-obediently") {
      const status = getTaskMetadataString(row?.metadata, "status");
      const waitCountdownEndsAt = getTaskMetadataString(row?.metadata, "countdownEndsAt");
      const waitEndsAt = getTaskMetadataString(row?.metadata, "waitEndsAt");
      const waitState = getWaitTaskState(status, waitCountdownEndsAt, waitEndsAt, cooldownUntil);

      return {
        ...task,
        claimed: Boolean(cooldownUntil),
        completed: status === "completed",
        cooldownUntil,
        waitCountdownEndsAt,
        waitEndsAt,
        waitState,
      };
    }

    if (task.id === "vertical-motion") {
      const metadataDate = getTaskMetadataString(row?.metadata, "date");
      const movementCooldownUntil = getDailyCooldownUntil(row?.claimed_at ?? null);
      const metadataActive = !row?.claimed_at || Boolean(movementCooldownUntil);
      const rawState = metadataActive ? getTaskMetadataString(row?.metadata, "state") : null;
      const movementState: TaskItem["movementState"] =
        rawState === "active" ||
        rawState === "fake_hope" ||
        rawState === "failed" ||
        rawState === "completed"
          ? rawState
          : "ready";
      const rawOutcome = metadataActive ? getTaskMetadataString(row?.metadata, "outcome") : null;
      const movementOutcome: TaskItem["movementOutcome"] =
        rawOutcome === "success" || rawOutcome === "instant_denial" || rawOutcome === "fake_hope"
          ? rawOutcome
          : null;
      const resolvedInCooldown =
        Boolean(movementCooldownUntil) && (movementState === "failed" || movementState === "completed");

      return {
        ...task,
        claimed: resolvedInCooldown,
        completed: movementState === "completed",
        cooldownUntil: movementCooldownUntil,
        movementDate: metadataActive ? metadataDate : null,
        movementFailAt: metadataActive ? getTaskMetadataString(row?.metadata, "fakeHopeStartedAt") : null,
        movementOutcome,
        movementProgress: metadataActive ? getTaskMetadataNumber(row?.metadata, "progress", 0) : 0,
        movementResolvedAt: metadataActive ? row?.claimed_at ?? null : null,
        movementState,
      };
    }

    if (task.id === "timeout-risk") {
      const resetAt = getTaskMetadataString(row?.metadata, "resetAt");
      const resetMs = resetAt ? new Date(resetAt).getTime() : 0;
      const dailyWindowActive = resetMs > Date.now();
      const safeWins = dailyWindowActive
        ? getTaskMetadataNumber(row?.metadata, "safeWins", 0)
        : 0;
      const dailyLimitReached = safeWins >= TIMEOUT_RISK_DAILY_SAFE_LIMIT;
      const multiplier = Math.min(3, Math.max(1, getTaskMetadataNumber(row?.metadata, "multiplier", 1)));

      return {
        ...task,
        claimed: dailyLimitReached,
        completed: dailyLimitReached,
        cooldownUntil: dailyLimitReached && resetAt ? resetAt : null,
        lastResult: getTaskMetadataString(row?.metadata, "lastResult"),
        safeWinsToday: safeWins,
        timeoutUntil,
        timeoutRiskMultiplier: multiplier,
      };
    }

    if (task.id === "irl-task-wheel") {
      return {
        ...task,
        assignedIrlTask: assignedIrlTask?.task_label ?? null,
        assignedIrlTaskDescription: assignedIrlTask?.task_description ?? null,
        assignedIrlTaskStatus: assignedIrlTask?.status ?? null,
        assignedIrlWheelIndex: assignedIrlTask?.wheel_index ?? null,
        assignedIrlDueAt: assignedIrlTask?.due_at ?? null,
        assignedIrlPenaltyMinutes: assignedIrlTask?.penalty_timeout_minutes ?? null,
        completed: Boolean(assignedIrlTask),
        timeoutUntil,
      };
    }

    if (task.id === "affection") {
      return {
        ...task,
        completed: affection >= 50 || Boolean(row?.completed_at),
        claimed: claimedForever,
      };
    }

    if (task.id === "affection-80") {
      return {
        ...task,
        completed: affection >= 80 || Boolean(row?.completed_at),
        claimed: claimedForever,
      };
    }

    return {
      ...task,
      completed: Boolean(row?.completed_at) || task.completed,
      claimed: claimedForever,
    };
  });
}

function buildMechanicsFromRows(
  rows: UserTaskRow[],
  unlockedIds: string[],
): MechanicsState {
  const begRow = rows.find((entry) => entry.task_id === "beg");
  const sacrificeRow = rows.find((entry) => entry.task_id === "sacrifice");
  const supportRow = rows.find((entry) => entry.task_id === "support");
  const sacrificeUnlockedCount = sacrificeGalleryItems.filter((item) =>
    unlockedIds.includes(item.id),
  ).length;
  const normalGalleryComplete = [...visibleGalleryItems, secretGalleryItem].every((item) =>
    unlockedIds.includes(item.id),
  );
  const sacrificeComplete = sacrificeUnlockedCount >= sacrificeGalleryItems.length;
  const allGalleryComplete = normalGalleryComplete && sacrificeComplete;

  return {
    begCooldownUntil: getCooldownUntil(
      getTaskMetadataString(begRow?.metadata, "lastBegAt") ?? begRow?.completed_at ?? null,
      60 * 1000,
    ),
    sacrificeCooldownUntil: getCooldownUntil(
      sacrificeRow?.claimed_at ?? null,
      SACRIFICE_SUCCESS_COOLDOWN_MS,
    ),
    supportUnlocked: allGalleryComplete,
    sacrificeUnlockedCount,
    sacrificeTotal: sacrificeGalleryItems.length,
    sacrificeComplete,
    allGalleryComplete,
    sacrificeLastResult: getTaskMetadataString(sacrificeRow?.metadata, "lastResult"),
    supportLastResult: getTaskMetadataString(supportRow?.metadata, "lastResult"),
  };
}

function getGalleryMechanicState(unlockedIds: string[]) {
  const sacrificeUnlockedCount = sacrificeGalleryItems.filter((item) =>
    unlockedIds.includes(item.id),
  ).length;
  const normalGalleryComplete = [...visibleGalleryItems, secretGalleryItem].every((item) =>
    unlockedIds.includes(item.id),
  );
  const sacrificeComplete = sacrificeUnlockedCount >= sacrificeGalleryItems.length;
  const allGalleryComplete = normalGalleryComplete && sacrificeComplete;

  return {
    allGalleryComplete,
    sacrificeComplete,
    sacrificeTotal: sacrificeGalleryItems.length,
    sacrificeUnlockedCount,
    supportUnlocked: allGalleryComplete,
  };
}

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const previewModeRef = useRef(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState("");
  const [authBootstrapped, setAuthBootstrapped] = useState(false);
  const authBootstrappedRef = useRef(false);
  const [isProfileVerified, setIsProfileVerified] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [hasHydratedInitialProfile, setHasHydratedInitialProfile] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(isSupabaseConfigured);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [username, setUsername] = useState("@littledevotee");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [showDisplayNameSetup, setShowDisplayNameSetup] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [displayNameError, setDisplayNameError] = useState("");
  const [isSettingDisplayName, setIsSettingDisplayName] = useState(false);

  const resetViewportScroll = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  // For using purchased Display Name Change right from Profile tab
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [displayNameEditInput, setDisplayNameEditInput] = useState("");
  const [coins, setCoins] = useState(100);
  const coinsRef = useRef(coins);
  const [affection, setAffection] = useState(0);
  const [loyaltyStreak, setLoyaltyStreak] = useState(0);
  const [lastLoyaltyAt, setLastLoyaltyAt] = useState<string | null>(null);
  const [tributeTotal, setTributeTotal] = useState(0);
  const [lifetimeSpentCoins, setLifetimeSpentCoins] = useState(0);
  const [userLevel, setUserLevel] = useState(1);
  const [userXp, setUserXp] = useState(0);
  const [petScore, setPetScore] = useState(0);
  const [ownerLikeness, setOwnerLikeness] = useState(100);
  const [storedRights, setStoredRights] = useState(0);
  const [rightExpirations, setRightExpirations] = useState<string[]>([]);
  const [dailyPurchaseCount, setDailyPurchaseCount] = useState(0);
  const [rightPurchaseDate, setRightPurchaseDate] = useState<string | null>(null);
  const [globalPrincipessa, setGlobalPrincipessa] = useState<GlobalPrincipessaProgress>({
    level: 1,
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    xp: 0,
  });
  const [latestGlobalLevelUpId, setLatestGlobalLevelUpId] = useState<string | null>(null);

  // Crate system V1 (collectibles + coin sink) - integrated inside Cosmetics panel
  const [availableCrates, setAvailableCrates] = useState<CrateDefinition[]>([]);
  const [crateInventory, setCrateInventory] = useState<CrateInventoryItem[]>([]);
  const [pityStats, setPityStats] = useState<{ principessa_bad_luck: number; blessing_legendary_pity: number }>({
    principessa_bad_luck: 0,
    blessing_legendary_pity: 0,
  });
  const [crateFreeOpensUsedToday, setCrateFreeOpensUsedToday] = useState<Record<string, boolean>>({});
  const [cratePending, setCratePending] = useState(false);
  const [petUnlockedAt, setPetUnlockedAt] = useState<string | null>(null);
  const [lastPetTaxAt, setLastPetTaxAt] = useState<string | null>(null);
  const [petDebtContract, setPetDebtContract] = useState<PetDebtContract | null>(null);
  const [isDebtAutoPayEnabled, setIsDebtAutoPayEnabled] = useState(false);
  const [petTaskState, setPetTaskState] = useState<PetTaskItem[]>(petTasks);
  const petTaskStateRef = useRef<PetTaskItem[]>(petTasks);
  const [petAffectionClaimDate, setPetAffectionClaimDate] = useState<string | null>(null);
  const [petGalleryUnlockedIds, setPetGalleryUnlockedIds] = useState<string[]>([]);
  const [timeoutUntil, setTimeoutUntil] = useState<string | null>(null);
  const [timeoutReason, setTimeoutReason] = useState<string | null>(null);
  const [isTimeoutClearPending, setIsTimeoutClearPending] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const petAffectionClaimed = petAffectionClaimDate === getDailyKey(currentTime);
  const [bubbleHiddenTick, setBubbleHiddenTick] = useState(0);
  const [fullyHiddenBubbleMessage, setFullyHiddenBubbleMessage] = useState("");
  const [fullyHiddenBubbleMessageId, setFullyHiddenBubbleMessageId] = useState(0);
  const [unlockedGalleryIds, setUnlockedGalleryIds] = useState<string[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [typingPraiseVisible, setTypingPraiseVisible] = useState(false);
  const [isLoyaltyClaimPending, setIsLoyaltyClaimPending] = useState(false);
  const typingPraiseTimerRef = useRef<number | null>(null);
  const [leadershipTop, setLeadershipTop] = useState<LeadershipEntry[]>([]);
  const [shameTop, setShameTop] = useState<ShameEntry[]>([]);
  const [recentTributes, setRecentTributes] = useState<RecentTribute[]>([]);
  const [topTributes, setTopTributes] = useState<RecentTribute[]>([]);
  const [topValuableInventories, setTopValuableInventories] = useState<TopInventory[]>([]);
  const [pendingTaskActionIds, setPendingTaskActionIds] = useState<string[]>([]);
  const [pendingPetActionIds, setPendingPetActionIds] = useState<string[]>([]);
  const [activeEvents, setActiveEvents] = useState<RandomEvent[]>([]);
  const [siteAnnouncement, setSiteAnnouncement] = useState<SiteAnnouncement | null>(null);
  const [siteAnnouncementLoadFailed, setSiteAnnouncementLoadFailed] = useState(false);
  const [freeFridaySpinAvailable, setFreeFridaySpinAvailable] = useState(false);
  const [temporarySpeechAvatar, setTemporarySpeechAvatar] =
    useState<TemporarySpeechAvatarState | null>(null);
  const [randomSpeechAvatarId, setRandomSpeechAvatarId] = useState<string>(DEFAULT_SPEECH_AVATAR_ID);
  const [dismissedSpeechAvatarEventId, setDismissedSpeechAvatarEventId] = useState<string | null>(
    null,
  );
  const [jackpot, setJackpot] = useState<LoyaltyJackpotState | null>(null);
  const [jackpotError, setJackpotError] = useState("");
  const [isJackpotBusy, setIsJackpotBusy] = useState(false);
  const [ownedCosmeticIds, setOwnedCosmeticIds] = useState<string[]>([DEFAULT_SPEECH_AVATAR_ID]);
  const [equippedCosmeticIds, setEquippedCosmeticIds] = useState<Partial<Record<CosmeticType, string>>>({
    "speech-avatar": DEFAULT_SPEECH_AVATAR_ID,
  });
  const [ownedTitleIds, setOwnedTitleIds] = useState<string[]>(["leadership-0"]);
  const [equippedTitleId, setEquippedTitleId] = useState<string | null>("leadership-0");
  const [isTitleManuallySelected, setIsTitleManuallySelected] = useState(false);
  const [equippedAvatarSlots, setEquippedAvatarSlots] = useState<EquippedAvatarSlots>({});
  const [hasUncensoredAvatar, setHasUncensoredAvatar] = useState(false);
  const [isAvatarActionPending, setIsAvatarActionPending] = useState(false);
  const committedEquippedRef = useRef<EquippedAvatarSlots>({});

  useEffect(() => {
    if (!isAvatarActionPending) {
      committedEquippedRef.current = equippedAvatarSlots;
    }
  }, [equippedAvatarSlots, isAvatarActionPending]);

  useEffect(() => {
    let cancelled = false;

    const loadSiteAnnouncement = async () => {
      try {
        const response = await fetch("/api/site-announcement", { cache: "no-store" });
        const result = (await response.json().catch(() => null)) as {
          announcement?: SiteAnnouncement | null;
          error?: string;
        } | null;

        if (!response.ok || !result || result.error) {
          if (!cancelled) {
            setSiteAnnouncementLoadFailed(true);
          }
          return;
        }

        if (!cancelled) {
          setSiteAnnouncementLoadFailed(false);
          setSiteAnnouncement(result.announcement ?? null);
        }
      } catch (error) {
        console.error("Site announcement load failed", error);
        if (!cancelled) {
          setSiteAnnouncementLoadFailed(true);
        }
      }
    };

    void loadSiteAnnouncement();

    return () => {
      cancelled = true;
    };
  }, []);

  const [wardrobeCategoryFilter, setWardrobeCategoryFilter] = useState<AvatarSlot | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [adminSessionRefreshNonce, setAdminSessionRefreshNonce] = useState(0);
  const [pendingIrlReviewCount, setPendingIrlReviewCount] = useState(0);
  const [soundSettings, setSoundSettings] = useState<SoundSettings>({
    gameplayEnabled: true,
    masterVolume: 0.7,
    uiEnabled: true,
  });
  const [affectionStageRevealToken, setAffectionStageRevealToken] = useState(0);
  const [mechanics, setMechanics] = useState<MechanicsState>({
    supportUnlocked: false,
    sacrificeUnlockedCount: 0,
    sacrificeTotal: sacrificeGalleryItems.length,
    sacrificeComplete: false,
    allGalleryComplete: false,
  });
  const [activePanel, setActivePanel] = useState<DashboardPage>("home");
  const [mistressReply, setMistressReply] = useState(
    "The vault is hungry. Drain yourself properly for Principessa.",
  );
  const [bubbleMessageId, setBubbleMessageId] = useState(1);
  const lastIdleLineIndexRef = useRef(-1);
  const bubbleMessageIdRef = useRef(1);
  const lastAddingXpBubbleAtRef = useRef(0);
  const highLowRefreshTimerRef = useRef<number | null>(null);
  const lastPlayedJackpotWinnerSoundKeyRef = useRef<string | null>(null);
  const activeEventIdsRef = useRef<string[]>([]);
  const profileIdRef = useRef<string | null>(null);
  const authProfileLoadInFlightRef = useRef<string | null>(null);
  const authProfileLoadedRef = useRef<string | null>(null);
  const initialAuthCheckInFlightRef = useRef(false);
  const loadProfileRef = useRef<((user: User) => Promise<Profile>) | null>(null);
  const updateLoyaltyForProfileRef = useRef<((profile: Profile) => Promise<Profile>) | null>(null);
  const authReplyRef = useRef<((message: string) => void) | null>(null);
  const timeoutUntilRef = useRef<string | null>(null);
  const timeoutReasonRef = useRef<string | null>(null);
  const falseHopePersistQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingTaskActionsRef = useRef(new Set<string>());
  const pendingPetActionsRef = useRef(new Set<string>());
  const petDailyClickPendingRef = useRef(0);
  const petDailyClickFlushTimerRef = useRef<number | null>(null);
  const petDailyClickFlushInFlightRef = useRef(false);
  const petDailyClickLastClickAtRef = useRef(0);
  const isPreviewRestricted = isPreviewMode;
  const soundsMuted = !soundSettings.uiEnabled && !soundSettings.gameplayEnabled;
  const isVaultReady =
    isPreviewMode || (isLoggedIn && hasHydratedInitialProfile && isProfileVerified && !isProfileLoading);

  const characterEvolutionStage = getAffectionCharacterStage(affection);
  const dailyMessage = getAffectionDailyMessage(affection);
  const speechAvatarEvent =
    activeEvents.find((event) => event.effect.type === "speech_avatar_override") ?? null;
  const eventSpeechAvatarId =
    speechAvatarEvent?.effect.type === "speech_avatar_override"
      ? speechAvatarEvent.effect.speechAvatarId ?? null
      : null;
  const persistedSpeechAvatarId =
    equippedCosmeticIds["speech-avatar"] ?? DEFAULT_SPEECH_AVATAR_ID;
  const randomSpeechAvatarCandidates = useMemo(
    () =>
      cosmeticItems
        .filter(
          (item) =>
            item.type === "speech-avatar" &&
            item.id !== RANDOM_SPEECH_AVATAR_ID &&
            item.id !== DEFAULT_SPEECH_AVATAR_ID,
        )
        .map((item) => item.id),
    [],
  );
  const activeManualTemporarySpeechAvatar =
    speechAvatarEvent &&
    eventSpeechAvatarId &&
    temporarySpeechAvatar?.eventId === speechAvatarEvent.id &&
    temporarySpeechAvatar.avatarId === eventSpeechAvatarId
      ? temporarySpeechAvatar
      : null;
  const autoEventSpeechAvatarId =
    speechAvatarEvent &&
    eventSpeechAvatarId &&
    persistedSpeechAvatarId === DEFAULT_SPEECH_AVATAR_ID &&
    dismissedSpeechAvatarEventId !== speechAvatarEvent.id
      ? eventSpeechAvatarId
      : null;
  const equippedRandomSpeechAvatarId =
    persistedSpeechAvatarId === RANDOM_SPEECH_AVATAR_ID
      ? randomSpeechAvatarId || randomSpeechAvatarCandidates[0] || DEFAULT_SPEECH_AVATAR_ID
      : null;
  const displayedSpeechAvatarId =
    activeManualTemporarySpeechAvatar?.avatarId ??
    autoEventSpeechAvatarId ??
    equippedRandomSpeechAvatarId ??
    persistedSpeechAvatarId;
  const effectiveEquippedCosmeticIds = useMemo(
    () => ({
      ...equippedCosmeticIds,
      "speech-avatar": displayedSpeechAvatarId,
    }),
    [displayedSpeechAvatarId, equippedCosmeticIds],
  );
  const equippedSpeechAvatar =
    getCosmeticItem(displayedSpeechAvatarId) ??
    getCosmeticItem(DEFAULT_SPEECH_AVATAR_ID);
  const resolveSpeechAvatarIdForMessage = useCallback(() => {
    if (activeManualTemporarySpeechAvatar?.avatarId) {
      return activeManualTemporarySpeechAvatar.avatarId;
    }

    if (autoEventSpeechAvatarId) {
      return autoEventSpeechAvatarId;
    }

    if (persistedSpeechAvatarId === RANDOM_SPEECH_AVATAR_ID) {
      const nextAvatarId =
        randomSpeechAvatarCandidates[Math.floor(Math.random() * randomSpeechAvatarCandidates.length)] ??
        DEFAULT_SPEECH_AVATAR_ID;
      setRandomSpeechAvatarId(nextAvatarId);
      return nextAvatarId;
    }

    return persistedSpeechAvatarId;
  }, [
    activeManualTemporarySpeechAvatar?.avatarId,
    autoEventSpeechAvatarId,
    persistedSpeechAvatarId,
    randomSpeechAvatarCandidates,
  ]);
  useEffect(() => {
    if (
      persistedSpeechAvatarId === RANDOM_SPEECH_AVATAR_ID &&
      randomSpeechAvatarCandidates.length > 0 &&
      !randomSpeechAvatarCandidates.includes(randomSpeechAvatarId)
    ) {
      setRandomSpeechAvatarId(randomSpeechAvatarCandidates[0]);
    }
  }, [persistedSpeechAvatarId, randomSpeechAvatarCandidates, randomSpeechAvatarId]);
  const equippedUsernameColor = getCosmeticItem(equippedCosmeticIds["username-color"] ?? "");
  const equippedUsernameGlow = getCosmeticItem(equippedCosmeticIds["username-glow"] ?? "");
  const equippedProfileBorder = getCosmeticItem(equippedCosmeticIds["profile-border"] ?? "");
  const equippedTitle = getTitleItem(equippedTitleId ?? "") ?? getTitleItem(getDefaultTitleId(tributeTotal));
  const spendBadge = getSpendBadge(lifetimeSpentCoins);
  const usernameStyle = {
    color: equippedUsernameColor?.color,
    textShadow: equippedUsernameGlow?.glow,
  };
  const avatarFrameVariant =
    equippedProfileBorder?.id === "profile-border-rainbow-animated"
      ? "rainbow"
      : equippedProfileBorder?.id === "profile-border-animated"
        ? "runner"
        : null;
  const avatarFrameClassName = equippedProfileBorder?.color
    ? "bg-white/10"
    : avatarFrameVariant === "rainbow"
      ? "bg-[conic-gradient(from_180deg,rgba(244,114,182,0.26)_0deg,rgba(168,85,247,0.28)_60deg,rgba(34,211,238,0.28)_120deg,rgba(16,185,129,0.26)_180deg,rgba(245,158,11,0.26)_240deg,rgba(244,63,94,0.28)_300deg,rgba(244,114,182,0.26)_360deg)]"
      : avatarFrameVariant === "runner"
        ? "bg-[linear-gradient(135deg,rgba(255,255,255,0.15),rgba(251,113,133,0.22),rgba(236,72,153,0.24),rgba(255,255,255,0.1))]"
        : "bg-white/10";
  const avatarFrameStyle = equippedProfileBorder?.color
    ? {
        backgroundColor: equippedProfileBorder.color,
        boxShadow: `0 0 24px ${equippedProfileBorder.color}55`,
      }
    : avatarFrameVariant === "rainbow"
      ? {
          boxShadow: "0 0 16px rgba(168, 85, 247, 0.18), 0 0 28px rgba(34, 211, 238, 0.12)",
        }
      : avatarFrameVariant === "runner"
        ? {
            boxShadow: "0 0 16px rgba(236, 72, 153, 0.18), 0 0 24px rgba(251, 113, 133, 0.12)",
          }
      : undefined;
  const userLevelProgress = getUserLevelProgress(userXp);
  const globalPrincipessaRequirement = getGlobalPrincipessaXpRequirement(globalPrincipessa.level);
  const globalPrincipessaProgressPercent = getGlobalPrincipessaProgressPercent(
    globalPrincipessa.level,
    globalPrincipessa.xp,
  );
  const setSpeechBubbleReply = useCallback((message: string) => {
    bubbleMessageIdRef.current += 1;
    setBubbleMessageId(bubbleMessageIdRef.current);
    setMistressReply(message);
  }, []);
  const setAvatarMistressReply = useCallback(
    (message: string) => {
      const avatarId = resolveSpeechAvatarIdForMessage();
      setSpeechBubbleReply(getSpeechBubbleMessageForText(avatarId, message));
    },
    [resolveSpeechAvatarIdForMessage, setSpeechBubbleReply],
  );
  const showTypingPraise = useCallback(() => {
    if (typingPraiseTimerRef.current !== null) {
      window.clearTimeout(typingPraiseTimerRef.current);
    }

    setTypingPraiseVisible(true);
    typingPraiseTimerRef.current = window.setTimeout(() => {
      setTypingPraiseVisible(false);
      typingPraiseTimerRef.current = null;
    }, 1600);
  }, []);

  useEffect(() => {
    return () => {
      if (typingPraiseTimerRef.current !== null) {
        window.clearTimeout(typingPraiseTimerRef.current);
      }
    };
  }, []);
  const loadGlobalPrincipessa = useCallback(async (announceLevelUp = false) => {
    const response = await fetch("/api/global-principessa", { cache: "no-store" });
    const payload = (await response.json()) as {
      error?: string;
      latestLevelUp?: { id: string; new_global_level: number | null } | null;
      progress?: {
        level?: number;
        month?: number;
        updated_at?: string | null;
        xp?: number;
        year?: number;
      };
    };

    if (!response.ok || !payload.progress) {
      throw createApiError("/api/global-principessa", response, payload);
    }

    const incomingLevelUpId = payload.latestLevelUp?.id ?? null;

    // Always mark the current latest level-up event as "seen" when we load.
    // This prevents the poller from re-playing old "I can feel my power growing."
    // messages after drains that did not cause a level up.
    if (incomingLevelUpId && incomingLevelUpId !== latestGlobalLevelUpId) {
      setLatestGlobalLevelUpId(incomingLevelUpId);
    }

    setGlobalPrincipessa({
      level: payload.progress.level ?? 1,
      month: payload.progress.month ?? new Date().getMonth() + 1,
      updated_at: payload.progress.updated_at ?? null,
      xp: payload.progress.xp ?? 0,
      year: payload.progress.year ?? new Date().getFullYear(),
    });

    // Only announce from background poller if it's a genuinely new level up event
    // AND we were explicitly asked to announce (announceLevelUp=true).
    if (announceLevelUp && incomingLevelUpId && incomingLevelUpId !== latestGlobalLevelUpId) {
      setSpeechBubbleReply(
        getSpeechBubbleResponseMessage(
          resolveSpeechAvatarIdForMessage(),
          "level_up",
          "I can feel my power growing.",
        ),
      );
    }
  }, [equippedSpeechAvatar?.id, latestGlobalLevelUpId, setSpeechBubbleReply]);
  const applySoundSettings = useCallback(
    (settings: Partial<SoundSettings>) => {
      const nextSettings = {
        ...soundSettings,
        ...settings,
        masterVolume: Math.min(
          1,
          Math.max(0, settings.masterVolume ?? soundSettings.masterVolume),
        ),
      };

      updateSoundSettings(nextSettings);
      setSoundSettings(nextSettings);
    },
    [soundSettings],
  );

  useEffect(() => {
    if (!isVaultReady || isGuestMode || isPreviewRestricted) {
      return;
    }

    const initialTimer = window.setTimeout(() => {
      void loadGlobalPrincipessa(false).catch((error) => {
        console.error("Failed to load Global Principessa progress", error);
      });
    }, 0);

    const interval = window.setInterval(() => {
      void loadGlobalPrincipessa(true).catch((error) => {
        console.error("Failed to refresh Global Principessa progress", error);
      });
    }, 120000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [isGuestMode, isPreviewRestricted, isVaultReady, loadGlobalPrincipessa]);
  const handleGlobalPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    const target = event.target;

    if (!(target instanceof HTMLElement) || !target.closest("button")) {
      return;
    }

    unlockSoundPlayback();
  }, []);
  const galleryItems =
    affection >= 100
      ? [
          ...visibleGalleryItems,
          secretGalleryItem,
          ...sacrificeGalleryItems.filter((item) =>
            unlockedGalleryIds.includes(item.id),
          ),
        ]
      : [
          ...visibleGalleryItems,
          ...sacrificeGalleryItems.filter((item) =>
            unlockedGalleryIds.includes(item.id),
          ),
        ];
  const visibleGallery = galleryItems.map((item) => ({
    ...item,
    unlocked: unlockedGalleryIds.includes(item.id),
  }));
  const displayMechanics = useMemo(
    () => ({
      ...mechanics,
      ...getGalleryMechanicState(unlockedGalleryIds),
    }),
    [mechanics, unlockedGalleryIds],
  );
  const getNextTributeTotal = useCallback(
    (spentCoins: number) => tributeTotal + Math.max(0, spentCoins),
    [tributeTotal],
  );
  const getEventMultiplier = useCallback(
    (type: RandomEvent["effect"]["type"], fallback = 1) =>
      activeEvents.find((event) => event.effect.type === type)?.effect.multiplier ?? fallback,
    [activeEvents],
  );
  const getEventTaskReward = useCallback(
    (baseReward: number) =>
      roundRewardToNearestFive(baseReward * getEventMultiplier("task_reward_multiplier")),
    [getEventMultiplier],
  );
  const getEventCooldownMs = useCallback(
    (baseMilliseconds: number) =>
      Math.max(1000, Math.round(baseMilliseconds * getEventMultiplier("cooldown_reduction"))),
    [getEventMultiplier],
  );
  const getEventTributeAffection = useCallback(
    (baseAffection: number) =>
      Math.max(baseAffection, Math.ceil(baseAffection * getEventMultiplier("tribute_affection_boost"))),
    [getEventMultiplier],
  );
  const highLowWinMultiplier = getEventMultiplier("high_low_bonus", 2);
  const eventBegReward = getEventTaskReward(BEG_REWARD);
  const eventFavorCoinReward = getEventTaskReward(PET_FAVOR_ROULETTE_COIN_REWARD);
const eventPetTaskCoinReward = getEventTaskReward(PET_TASK_COIN_REWARD);
  const eventSafeReward = getEventTaskReward(SAFE_REWARD);
  const claimableLoyaltyBonuses = tasks.filter(
    (task) => task.id.startsWith("streak-bonus-") && task.completed && !task.claimed,
  );
  const todayKey = getGmt3DateKey();
  const tasksCompletedToday = tasks.filter((task) => {
    if (task.id.startsWith("streak-bonus-")) {
      return false;
    }

    if (task.id === "case-opening") {
      return task.caseSpunAt ? getGmt3DateKey(task.caseSpunAt) === todayKey : false;
    }

    if (task.id === "typing-accuracy" || task.id === "daily-login") {
      return task.cooldownUntil ? getGmt3DateKey(new Date(new Date(task.cooldownUntil).getTime() - 1)) === todayKey : false;
    }

    if (task.id === "timeout-risk") {
      return (task.safeWinsToday ?? 0) > 0;
    }

    if (task.id === "irl-task-wheel") {
      return Boolean(task.assignedIrlDueAt && getGmt3DateKey(task.assignedIrlDueAt) === todayKey);
    }

    return task.completed && Boolean(task.cooldownUntil || task.claimed);
  });
  const taskCoinsEarnedToday = tasksCompletedToday.reduce((sum, task) => {
    if (task.id === "case-opening") {
      return sum + Math.max(0, task.caseReward ?? 0);
    }

    if (task.id === "timeout-risk") {
      return sum + (task.safeWinsToday ?? 0) * eventSafeReward * (task.timeoutRiskMultiplier ?? 1);
    }

    if (task.id === "irl-task-wheel") {
      return sum;
    }

    return sum + Math.max(0, getEventTaskReward(task.reward));
  }, 0);
  const petTasksCompletedToday = petTaskState.filter((task) => {
    const approvedAt = task.reviewedAt ?? task.completedAt;
    return approvedAt ? getGmt3DateKey(approvedAt) === todayKey : false;
  });
  const petCoinsEarnedToday = petTasksCompletedToday.reduce((sum, task) => {
    if (task.kind === "weekly-tax") {
      return sum;
    }
    if (task.kind === "favor-roulette") {
      return sum + eventFavorCoinReward;
    }
    if (task.kind === "review") {
      return sum + PET_REVIEW_TASK_COIN_REWARD;
    }
    if (task.kind === "daily-click") {
      return sum + Math.min(PET_DAILY_CLICK_MAX_COIN_REWARD, task.clickRequirement ?? 0);
    }
    return sum + eventPetTaskCoinReward;
  }, 0);
  const getReadableSpeechAvatarName = useCallback((avatarId: string | null | undefined) => {
    if (!avatarId) {
      return "Unknown Avatar";
    }

    return getCosmeticItem(avatarId)?.name ?? avatarId.replace(/[-_]+/g, " ");
  }, []);
  const unlockProgressionTitles = useCallback((nextTributeTotal: number) => {
    const unlockedProgressionTitleIds = getUnlockedProgressionTitleIds(nextTributeTotal);
    const previousDefaultTitleId = getDefaultTitleId(tributeTotal);
    const nextDefaultTitleId = getDefaultTitleId(nextTributeTotal);
    const shouldAutoEquipProgressionTitle =
      !isTitleManuallySelected && (!equippedTitleId || equippedTitleId === previousDefaultTitleId);

    setOwnedTitleIds((current) => Array.from(new Set([...current, ...unlockedProgressionTitleIds])));

    if (shouldAutoEquipProgressionTitle) {
      setEquippedTitleId(nextDefaultTitleId);
    }

    if (isGuestMode || !authUserId) {
      return;
    }

    const missingTitleIds = unlockedProgressionTitleIds.filter(
      (titleId) => !ownedTitleIds.includes(titleId),
    );

    void fetch("/api/user/titles", {
      body: JSON.stringify({
        action: "unlock",
        equipTitleId: shouldAutoEquipProgressionTitle ? nextDefaultTitleId : null,
        source: "progression",
        titleIds: Array.from(new Set([...missingTitleIds, ...(shouldAutoEquipProgressionTitle ? [nextDefaultTitleId] : [])])),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).then(async (response) => {
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw createApiError("/api/user/titles", response, payload);
      }
    }).catch((error) => {
      console.error("Failed to persist progression title unlocks", error);
    });
  }, [authUserId, equippedTitleId, isGuestMode, isTitleManuallySelected, ownedTitleIds, tributeTotal]);

  useEffect(() => {
    const unlockedPetTitleIds = getUnlockedPetTitleIds(petScore);
    const missingTitleIds = unlockedPetTitleIds.filter((titleId) => !ownedTitleIds.includes(titleId));

    if (missingTitleIds.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setOwnedTitleIds((current) => Array.from(new Set([...current, ...missingTitleIds])));
    }, 0);

    if (isGuestMode || !authUserId) {
      return () => window.clearTimeout(timer);
    }

    void fetch("/api/user/titles", {
      body: JSON.stringify({
        action: "unlock",
        source: "pet",
        titleIds: missingTitleIds,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).then(async (response) => {
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw createApiError("/api/user/titles", response, payload);
      }
    }).catch((error) => {
      console.error("Failed to persist pet title unlocks", error);
    });

    return () => window.clearTimeout(timer);
  }, [authUserId, isGuestMode, ownedTitleIds, petScore]);

  // Auto unlock crate legendary and inventory value titles
  useEffect(() => {
    const hasLegendary = crateInventory.some((item) => item.rarity === "legendary");
    const invValue = crateInventory.reduce((sum, item) => sum + (item.quantity || 0) * (item.sell_value || 0), 0);

    const ownedLegendaryIds = new Set(
      crateInventory
        .filter((item) => item.rarity === "legendary")
        .map((item) => item.item_id)
    );
    const hasAllLegendaries = ALL_LEGENDARY_ITEM_IDS.every((id) => ownedLegendaryIds.has(id));

    const unlockedCrateIds = getUnlockedCrateTitleIds(hasLegendary);
    const unlockedInvIds = getUnlockedInventoryTitleIds(invValue, hasAllLegendaries);
    const missingTitleIds = [...unlockedCrateIds, ...unlockedInvIds].filter(
      (titleId) => !ownedTitleIds.includes(titleId)
    );

    if (missingTitleIds.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setOwnedTitleIds((current) => Array.from(new Set([...current, ...missingTitleIds])));
    }, 0);

    if (isGuestMode || !authUserId) {
      return () => window.clearTimeout(timer);
    }

    void fetch("/api/user/titles", {
      body: JSON.stringify({
        action: "unlock",
        titleIds: missingTitleIds,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).then(async (response) => {
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw createApiError("/api/user/titles", response, payload);
      }
    }).catch((error) => {
      console.error("Failed to persist crate/inventory title unlocks", error);
    });

    return () => window.clearTimeout(timer);
  }, [authUserId, isGuestMode, ownedTitleIds, crateInventory]);

  const timeoutRemaining = timeoutUntil ? new Date(timeoutUntil).getTime() - currentTime : 0;
  const isTimeoutActive = timeoutRemaining > 0;
  const isUnderageTimeoutActive =
    isTimeoutActive &&
    (timeoutReason === "evil_debt_underage" || timeoutRemaining >= 9 * 365 * DAY_MS);
  const timeoutClearFee = getTimeoutClearFee(timeoutUntil, timeoutReason, currentTime);
  const canSelfClearTimeout = isTimeoutActive && !isUnderageTimeoutActive;
  const accountAnnouncement = siteAnnouncement ?? (siteAnnouncementLoadFailed ? DEFAULT_SITE_ANNOUNCEMENT : null);
  const showAccountAnnouncement = Boolean(accountAnnouncement?.body.trim());
  const isFreeFridayActive = isFreeTaskFriday(currentTime);
  const isFreeFridaySpinAvailable = Boolean(authUserId) && isFreeFridayActive && freeFridaySpinAvailable;
  const freeFridayRemainingMs = isFreeFridayActive
    ? getNextGmt3Reset(currentTime).getTime() - currentTime
    : 0;
  const timeoutRiskProjectedDays = currentTime > 0
    ? (Math.max(0, timeoutRemaining) + TIMEOUT_RISK_TIMEOUT_MS) / DAY_MS
    : TIMEOUT_RISK_TIMEOUT_MS / DAY_MS;
  const timeoutMessage =
    isUnderageTimeoutActive
      ? "This account is under a special Evil Debt Contract safety timeout. If the age entry was a joke or mistake, DM @VMPrincipessa with proof."
      : "You are in timeout. Actions are locked until the timer ends. You can send $5 on Throne and DM @VMPrincipessa for manual review to remove it.";
  const petEverUnlocked = Boolean(petUnlockedAt) || affection >= 100;
  const isPetUnlocked = affection >= 100 || (petEverUnlocked && affection >= 85);
  const nextPetTaxDueAt = petUnlockedAt
    ? new Date(new Date(lastPetTaxAt ?? petUnlockedAt).getTime() + WEEK_MS).toISOString()
    : null;

  const blockIfTimedOut = () => {
    if (isPreviewRestricted) {
      setAvatarMistressReply("Sign in to unlock this feature. Preview Mode is read-only.");
      return true;
    }

    if (isLoggedIn && !isGuestMode && !isProfileVerified && authProfileLoadInFlightRef.current) {
      setAvatarMistressReply("The vault is still verifying your profile. Try again in a moment.");
      return true;
    }

    if (isLoggedIn && !isGuestMode && !isProfileVerified && !authProfileLoadInFlightRef.current) {
      console.warn("[action-gate] profile verification was stale; allowing backend-protected action retry", {
        authUserId,
        pendingPetActionIds: Array.from(pendingPetActionsRef.current),
        pendingTaskActionIds: Array.from(pendingTaskActionsRef.current),
      });
    }

    const activeTimeout = timeoutUntilRef.current;
    const active = Boolean(activeTimeout && new Date(activeTimeout).getTime() > Date.now());

    if (!active) {
      return false;
    }

    setAvatarMistressReply("Timeout active. Stay denied like the pathetic loser you are or pay to unlock.");
    return true;
  };

  useEffect(() => {
    coinsRef.current = coins;
  }, [coins]);

  useEffect(() => {
    const shouldBlockImageInteraction = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      if (target.closest(IMAGE_DOWNLOAD_ALLOW_SELECTOR)) {
        return false;
      }

      return Boolean(target.closest("img"));
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (shouldBlockImageInteraction(event.target)) {
        event.preventDefault();
      }
    };

    const handleDragStart = (event: DragEvent) => {
      if (shouldBlockImageInteraction(event.target)) {
        event.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("dragstart", handleDragStart);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("dragstart", handleDragStart);
    };
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setSoundSettings(getSoundSettings());
    });
  }, []);

  useEffect(() => {
    if (!hasHydratedInitialProfile || !isProfileVerified || !authUserId || isGuestMode) {
      return;
    }

    const currentNormalized = normalizeEquipment(equippedAvatarSlots);
    const ownedItemIds = new Set(
      crateInventory
        .filter((item) => item.quantity > 0)
        .map((item) => item.item_id),
    );
    Object.values(equippedAvatarSlots).forEach((itemId) => {
      if (itemId) {
        ownedItemIds.add(itemId);
      }
    });
    // "classic" fullbody is a default always-unlocked item (no need for DB inventory entry)
    ownedItemIds.add("classic");

    const next = Object.fromEntries(
      Object.entries(equippedAvatarSlots).filter(([, itemId]) => ownedItemIds.has(itemId)),
    ) as EquippedAvatarSlots;

    const cleaned = normalizeEquipment(next);
    if (JSON.stringify(cleaned) === JSON.stringify(currentNormalized)) {
      return;
    }

    setEquippedAvatarSlots(cleaned);

    // Best effort sync to server (authoritative on mutations)
    if (!isGuestMode && authUserId) {
      void fetch("/api/user/wardrobe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-equipped", equippedSlots: cleaned }),
      }).catch(() => {});
    }
  }, [authUserId, crateInventory, equippedAvatarSlots, hasHydratedInitialProfile, isGuestMode, isProfileVerified]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rebrandResult = params.get("rebrand");

    if (!rebrandResult) {
      return;
    }

    const reply =
      rebrandResult === "applied"
        ? "X write access connected. Rebrand profile applied."
        : rebrandResult === "apply_failed"
          ? params.get("rebrand_error") ??
            "X write access connected, but the rebrand failed to apply."
          : "";

    if (reply) {
      queueMicrotask(() => setAvatarMistressReply(reply));
    }

    params.delete("rebrand");
    params.delete("rebrand_error");

    const nextQuery = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`,
    );
  }, [setAvatarMistressReply]);

  useEffect(() => {
    previewModeRef.current = isPreviewMode;
  }, [isPreviewMode]);

  useEffect(() => {
    timeoutUntilRef.current = timeoutUntil;
  }, [timeoutUntil]);

  useEffect(() => {
    timeoutReasonRef.current = timeoutReason;
  }, [timeoutReason]);

  useEffect(() => {
    petTaskStateRef.current = petTaskState;
  }, [petTaskState]);

  const setPetTaskStateOptimistic = useCallback((updater: (current: PetTaskItem[]) => PetTaskItem[]) => {
    const nextState = updater(petTaskStateRef.current);
    petTaskStateRef.current = nextState;
    setPetTaskState(nextState);
    return nextState;
  }, []);

  const beginTaskAction = useCallback((actionId: string) => {
    if (pendingTaskActionsRef.current.has(actionId)) {
      console.info("[action-lock] begin skipped: task action already pending", {
        actionId,
        pendingTaskActionIds: Array.from(pendingTaskActionsRef.current),
      });
      return false;
    }

    const next = new Set(pendingTaskActionsRef.current);
    next.add(actionId);
    pendingTaskActionsRef.current = next;
    setPendingTaskActionIds(Array.from(next));
    console.info("[action-lock] begin task action", {
      actionId,
      pendingTaskActionIds: Array.from(next),
    });
    return true;
  }, []);

  const finishTaskAction = useCallback((actionId: string) => {
    const next = new Set(pendingTaskActionsRef.current);
    next.delete(actionId);
    pendingTaskActionsRef.current = next;
    setPendingTaskActionIds(Array.from(next));
    console.info("[action-lock] finish task action", {
      actionId,
      pendingTaskActionIds: Array.from(next),
    });
  }, []);

  const beginPetAction = useCallback((actionId: string) => {
    if (pendingPetActionsRef.current.has(actionId)) {
      console.info("[action-lock] begin skipped: pet action already pending", {
        actionId,
        pendingPetActionIds: Array.from(pendingPetActionsRef.current),
      });
      return false;
    }

    const next = new Set(pendingPetActionsRef.current);
    next.add(actionId);
    pendingPetActionsRef.current = next;
    setPendingPetActionIds(Array.from(next));
    console.info("[action-lock] begin pet action", {
      actionId,
      pendingPetActionIds: Array.from(next),
    });
    return true;
  }, []);

  const finishPetAction = useCallback((actionId: string) => {
    const next = new Set(pendingPetActionsRef.current);
    next.delete(actionId);
    pendingPetActionsRef.current = next;
    setPendingPetActionIds(Array.from(next));
    console.info("[action-lock] finish pet action", {
      actionId,
      pendingPetActionIds: Array.from(next),
    });
  }, []);

  const resyncAuthenticatedProfile = useCallback(async (label: string) => {
    if (isGuestMode) {
      return;
    }

    console.info("[profile-resync] start", { label });

    try {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        console.error("[profile-resync] auth user unavailable", { error, label });
        return;
      }

      const profileLoader = loadProfileRef.current;

      if (!profileLoader) {
        console.warn("[profile-resync] profile loader unavailable", { label });
        return;
      }

      await profileLoader(data.user);
      setIsProfileVerified(true);
      console.info("[profile-resync] success", { label, userId: data.user.id });
    } catch (error) {
      console.error("[profile-resync] fail", { error, label });
      throw error;
    }
  }, [isGuestMode]);

  useEffect(() => () => {
    if (highLowRefreshTimerRef.current !== null) {
      window.clearTimeout(highLowRefreshTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadActiveEvent = async () => {
      try {
        const response = await fetch("/api/events/active", { cache: "no-store" });
        const payload = (await response.json()) as {
          event?: RandomEvent | null;
          events?: RandomEvent[];
        };

        if (!response.ok) {
          throw new Error("Active event could not be loaded.");
        }

        const nextEvents = payload.events ?? (payload.event ? [payload.event] : []);
        const previousEventIds = new Set(activeEventIdsRef.current);
        const nextEventIds = nextEvents.map((event) => event.id);
        const newlyActivatedEvents = nextEvents.filter((event) => !previousEventIds.has(event.id));

        if (cancelled) {
          return;
        }

        activeEventIdsRef.current = nextEventIds;
        setActiveEvents(nextEvents);
        for (const event of newlyActivatedEvents) {
          emitSoundEvent("random_event_activation");
          if (event.effect.type === "speech_avatar_override") {
            const avatarName = getReadableSpeechAvatarName(event.effect.speechAvatarId);
            setAvatarMistressReply(
              `Random Speech Bubble event triggered: ${avatarName} was selected.`,
            );
          }
        }
      } catch (error) {
        console.error("Failed to load active random event", error);
      }
    };

    void loadActiveEvent();

    return () => {
      cancelled = true;
    };
  }, [getReadableSpeechAvatarName]);

  useEffect(() => {
    if (!authUserId || isGuestMode) {
      return;
    }

    let cancelled = false;

    const loadFreeFridayStatus = async () => {
      try {
        const response = await fetch("/api/user/irl-task-wheel", { cache: "no-store" });
        const payload = (await response.json()) as {
          freeFridayAvailable?: boolean;
          freeFridayActive?: boolean;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Free Task Friday status failed.");
        }

        if (!cancelled) {
          setFreeFridaySpinAvailable(Boolean(payload.freeFridayAvailable));
        }
      } catch (error) {
        console.error("Failed to load Free Task Friday status", error);
        if (!cancelled) {
          setFreeFridaySpinAvailable(false);
        }
      }
    };

    void loadFreeFridayStatus();

    return () => {
      cancelled = true;
    };
  }, [authUserId, isGuestMode]);

  useEffect(() => {
    if (activeEvents.length === 0) {
      return;
    }

    const eventEndTimes = activeEvents
      .map((event) => new Date(event.ends_at).getTime())
      .filter(Number.isFinite);

    if (eventEndTimes.length === 0) {
      return;
    }

    const nextEndAt = Math.min(...eventEndTimes);
    const remaining = Math.max(0, nextEndAt - new Date().getTime());
    const timer = window.setTimeout(
      () =>
        setActiveEvents((events) =>
          events.filter((event) => new Date(event.ends_at).getTime() > Date.now()),
        ),
      remaining,
    );

    return () => window.clearTimeout(timer);
  }, [activeEvents]);

  const handleBubbleFullyHidden = useCallback((hiddenMessage: string, hiddenMessageId: number) => {
    if (hiddenMessageId !== bubbleMessageIdRef.current) {
      return;
    }

    setFullyHiddenBubbleMessage(hiddenMessage);
    setFullyHiddenBubbleMessageId(hiddenMessageId);
    setBubbleHiddenTick((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }
    if (bubbleHiddenTick === 0) {
      return;
    }
    if (fullyHiddenBubbleMessage !== mistressReply) {
      return;
    }
    if (fullyHiddenBubbleMessageId !== bubbleMessageIdRef.current) {
      return;
    }

    const getRandomDelay = (minimum: number, maximum: number) =>
      Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;

    const getRandomIdleLine = () => {
      const avatarId = resolveSpeechAvatarIdForMessage();
      const idleLines = getSpeechBubbleMessagePool(avatarId, "idle");
      const petIdleLines = petEverUnlocked
        ? getSpeechBubbleMessagePool(avatarId, "petIdle")
        : [];
      const availableLines = [...idleLines, ...petIdleLines];
      let nextIndex = Math.floor(Math.random() * availableLines.length);

      if (availableLines.length > 1) {
        while (nextIndex === lastIdleLineIndexRef.current) {
          nextIndex = Math.floor(Math.random() * availableLines.length);
        }
      }

      lastIdleLineIndexRef.current = nextIndex;
      return availableLines[nextIndex];
    };

    const idleTimer = window.setTimeout(() => {
      setAvatarMistressReply(getRandomIdleLine());
    }, getRandomDelay(10000, 15000));

    return () => {
      window.clearTimeout(idleTimer);
    };
  }, [
    bubbleHiddenTick,
    equippedSpeechAvatar?.id,
    fullyHiddenBubbleMessage,
    fullyHiddenBubbleMessageId,
    isLoggedIn,
    mistressReply,
    petEverUnlocked,
    setAvatarMistressReply,
  ]);

  const loadRecentTributes = useCallback(async () => {
    try {
      const response = await fetch("/api/recent-tributes");
      const result = (await response.json()) as {
        error?: string;
        topTributes?: RecentTribute[];
        tributes?: RecentTribute[];
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Recent tribute ticker failed.");
      }

      setRecentTributes(result.tributes ?? []);
      setTopTributes(result.topTributes ?? []);
    } catch (error) {
      console.error("Failed to load recent tributes", error);
    }
  }, []);

  // === CRATE SYSTEM (V1) ===
  const loadCratesData = useCallback(async () => {
    // For preview / guest mode (dev testing), always seed local rich data
    // rich local data so Cases are visible and Profile avatar customization has every
    // item in inventory (including all avatar-layer items).
    if (isPreviewMode || isGuestMode) {
      const seededCrates: CrateDefinition[] = Object.entries(CRATE_TYPES)
        .filter(([, def]) => (def as any).enabled !== false)
        .map(([crate_type, def]) => ({
          crate_type,
          name: def.name,
          description: def.description,
          cost: def.cost,
          icon_url: getCrateIconUrl(crate_type, (def as any).icon_url ?? null) ?? undefined,
        }))
        .sort((a, b) => a.cost - b.cost);

      const seededInventory: CrateInventoryItem[] = Object.entries(SAMPLE_CRATE_ITEMS).map(
        ([item_id, def]) => ({
          item_id,
          name: def.name,
          description: def.description || "",
          image_url: null,
          rarity: def.rarity,
          collection: def.collection || null,
          sell_value: def.sell_value || 0,
          variant: "normal",
          quantity: 50,
        }),
      );

      setAvailableCrates(seededCrates);
      setCrateInventory(seededInventory);
      setCrateFreeOpensUsedToday({});
      setPityStats({ principessa_bad_luck: 0, blessing_legendary_pity: 0 });
      return;
    }

    try {
      const response = await fetch("/api/user/crates", { cache: "no-store" });
      const result = (await response.json()) as {
        error?: string;
        crates?: CrateDefinition[];
        inventory?: CrateInventoryItem[];
        free_opens_used_today?: Record<string, boolean>;
        pity?: {
          principessa_bad_luck?: number;
          blessing_legendary_pity?: number;
        };
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to load crates.");
      }

      setAvailableCrates(result.crates ?? []);
      setCrateInventory(result.inventory ?? []);
      setCrateFreeOpensUsedToday(result.free_opens_used_today ?? {});
      if (result.pity) {
        setPityStats({
          principessa_bad_luck: result.pity.principessa_bad_luck ?? 0,
          blessing_legendary_pity: result.pity.blessing_legendary_pity ?? 0,
        });
      }
    } catch (error) {
      console.error("Failed to load crate data", error);
    }
  }, [isPreviewMode, isGuestMode]);

  const handleOpenCrate = async (crateType: string, quantity = 1) => {
    if (cratePending) return { success: false };

    setCratePending(true);

    try {
      const response = await fetch("/api/user/crates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open", crateType, quantity }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        result?: { item?: CrateInventoryItem & { sell_value: number }; items?: Array<CrateInventoryItem & { sell_value: number }>; newCoins: number };
        free_open_applied?: boolean;
        pity?: {
          principessa_bad_luck?: number;
          blessing_legendary_pity?: number;
        };
      };

      if (!response.ok || !payload.success || !payload.result) {
        throw new Error(payload.error ?? "Crate open failed.");
      }

      // Update coins + inventory optimistically from server result
      const wonItems = payload.result.items ?? (payload.result.item ? [payload.result.item] : []);
      setCoins(payload.result.newCoins);
      coinsRef.current = payload.result.newCoins;

      // Update pity AFTER result received, but visible counters (in shop) only reappear after reveal/close
      // This satisfies the "no spoiler during animation" requirement
      if (payload.pity) {
        setPityStats({
          principessa_bad_luck: payload.pity.principessa_bad_luck ?? pityStats.principessa_bad_luck,
          blessing_legendary_pity: payload.pity.blessing_legendary_pity ?? pityStats.blessing_legendary_pity,
        });
      }
      if (payload.free_open_applied) {
        setCrateFreeOpensUsedToday((current) => ({ ...current, [crateType]: true }));
      }

      // Merge into local inventory (increase quantity or add)
      setCrateInventory((current) => {
        const next = [...current];

        for (const won of wonItems) {
          const idx = next.findIndex((i) => i.item_id === won.item_id && i.variant === (won.variant || "normal"));
          if (idx >= 0) {
            next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
          } else {
            next.push({ ...won, quantity: 1 });
          }
        }

        return next;
      });

      // Refresh full data in background
      void loadCratesData();
      void loadLeadershipTop();

      return { success: true, result: { items: wonItems, newCoins: payload.result.newCoins } };
    } catch (error) {
      console.error("Open crate failed", error);
      const errMsg = error instanceof Error ? error.message : "Crate open failed.";
      setAuthError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setCratePending(false);
    }
  };

  const handleSellCrateItem = async (itemId: string, variant: string, quantity = 1) => {
    if (cratePending) return { success: false };

    setCratePending(true);

    try {
      const response = await fetch("/api/user/crates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sell", itemId, variant, quantity }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        newCoins?: number;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Sell failed.");
      }

      if (typeof payload.newCoins === "number") {
        setCoins(payload.newCoins);
        coinsRef.current = payload.newCoins;
      }

      // Refresh inventory from server
      await loadCratesData();
      void loadLeadershipTop();

      return { success: true, newCoins: payload.newCoins };
    } catch (error) {
      console.error("Sell crate item failed", error);
      const errMsg = error instanceof Error ? error.message : "Sell failed.";
      setAuthError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setCratePending(false);
    }
  };

  const handleSellAllCrateItems = async () => {
    if (cratePending) return { success: false };

    setCratePending(true);

    try {
      const response = await fetch("/api/user/crates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sell_all" }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        newCoins?: number;
        total_value?: number;
        item_count?: number;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Sell all failed.");
      }

      if (typeof payload.newCoins === "number") {
        setCoins(payload.newCoins);
        coinsRef.current = payload.newCoins;
      }

      // Refresh inventory + crates from server (now empty or reduced)
      await loadCratesData();
      void loadLeadershipTop();

      return {
        success: true,
        newCoins: payload.newCoins,
        totalValue: payload.total_value,
        itemCount: payload.item_count,
      };
    } catch (error) {
      console.error("Sell all crate items failed", error);
      const errMsg = error instanceof Error ? error.message : "Sell all failed.";
      setAuthError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setCratePending(false);
    }
  };

  const handleSellDuplicateCrateItems = async () => {
    if (cratePending) return { success: false };

    setCratePending(true);

    try {
      const response = await fetch("/api/user/crates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sell_duplicates" }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        newCoins?: number;
        total_value?: number;
        item_count?: number;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Sell duplicates failed.");
      }

      if (typeof payload.newCoins === "number") {
        setCoins(payload.newCoins);
        coinsRef.current = payload.newCoins;
      }

      await loadCratesData();
      void loadLeadershipTop();

      return {
        success: true,
        newCoins: payload.newCoins,
        totalValue: payload.total_value,
        itemCount: payload.item_count,
      };
    } catch (error) {
      console.error("Sell duplicate crate items failed", error);
      const errMsg = error instanceof Error ? error.message : "Sell duplicates failed.";
      setAuthError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setCratePending(false);
    }
  };

  const handleSellWonCrateItems = async (
    items: Array<{ itemId: string; variant: string; quantity: number }>,
  ) => {
    if (cratePending) return { success: false };

    setCratePending(true);

    try {
      const response = await fetch("/api/user/crates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sell_many", items }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        newCoins?: number;
        total_value?: number;
        item_count?: number;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Sell all failed.");
      }

      if (typeof payload.newCoins === "number") {
        setCoins(payload.newCoins);
        coinsRef.current = payload.newCoins;
      }

      await loadCratesData();
      void loadLeadershipTop();

      return {
        success: true,
        newCoins: payload.newCoins,
        totalValue: payload.total_value,
        itemCount: payload.item_count,
      };
    } catch (error) {
      console.error("Sell won crate items failed", error);
      const errMsg = error instanceof Error ? error.message : "Sell all failed.";
      setAuthError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setCratePending(false);
    }
  };

  const loadLeadershipTop = useCallback(async () => {
    try {
      const response = await fetch("/api/leadership/top");
      const payload = (await response.json()) as {
        leaders?: LeadershipEntry[];
        topInventories?: TopInventory[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Leadership leaderboard could not be loaded.");
      }

      setLeadershipTop(payload.leaders ?? []);
      setTopValuableInventories(payload.topInventories ?? []);
    } catch (error) {
      console.error("Failed to load leadership top 5", error);
    }
  }, []);

  const loadShameTop = useCallback(async () => {
    try {
      const response = await fetch("/api/shame/top");
      const payload = (await response.json()) as {
        shame?: ShameEntry[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Public shame board could not be loaded.");
      }

      setShameTop(payload.shame ?? []);
    } catch (error) {
      console.error("Failed to load public shame board", error);
    }
  }, []);

  const loadJackpot = useCallback(async () => {
    if (isGuestMode || isPreviewMode) {
      setJackpot(null);
      setJackpotError("");
      return;
    }

    try {
      const response = await fetch("/api/jackpot", { cache: "no-store" });
      const payload = (await response.json()) as {
        jackpot?: LoyaltyJackpotState;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Jackpot could not be loaded.");
      }

      setJackpot(payload.jackpot ?? null);
      setJackpotError("");
    } catch (error) {
      console.error("Failed to load loyalty jackpot", error);
      setJackpotError(describeError(error));
    }
  }, [isGuestMode, isPreviewMode]);

  useEffect(() => {
    const revealKey = getJackpotWinnerRevealKey(jackpot);

    if (!revealKey) {
      return;
    }

    if (lastPlayedJackpotWinnerSoundKeyRef.current === revealKey) {
      return;
    }

    try {
      if (window.localStorage.getItem(JACKPOT_WIN_SOUND_STORAGE_KEY) === revealKey) {
        lastPlayedJackpotWinnerSoundKeyRef.current = revealKey;
        return;
      }

      window.localStorage.setItem(JACKPOT_WIN_SOUND_STORAGE_KEY, revealKey);
    } catch {
      // Storage failures should not break jackpot rendering.
    }

    lastPlayedJackpotWinnerSoundKeyRef.current = revealKey;
    emitSoundEvent("jackpot_win");
  }, [jackpot]);

  const loadPendingIrlReviewCount = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/notifications", {
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        count?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Pending IRL review count failed.");
      }

      setPendingIrlReviewCount(payload.count ?? 0);
    } catch (error) {
      console.error("Failed to load pending IRL review count", error);
    }
  }, []);

  useEffect(() => {
    if (!isAdminUser || !isLoggedIn) {
      return;
    }

    const immediateTimer = window.setTimeout(() => {
      void loadPendingIrlReviewCount();
    }, 0);
    const timer = window.setInterval(() => {
      void loadPendingIrlReviewCount();
    }, 120000);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(immediateTimer);
    };
  }, [isAdminUser, isLoggedIn, loadPendingIrlReviewCount]);

  useEffect(() => {
    // Load crates data also for preview/guest so the crate UI is visible on localhost
    // (the internal loadCratesData now falls back to in-memory for preview)
    if (!isLoggedIn && !isPreviewMode && !isGuestMode) {
      return;
    }

    const initialTimer = window.setTimeout(() => {
      void loadRecentTributes();
      void loadCratesData();
    }, 0);

    const refreshRecentTributes = () => {
      void loadRecentTributes();
    };

    window.addEventListener("focus", refreshRecentTributes);
    window.addEventListener("storage", refreshRecentTributes);

    return () => {
      window.clearTimeout(initialTimer);
      window.removeEventListener("focus", refreshRecentTributes);
      window.removeEventListener("storage", refreshRecentTributes);
    };
  }, [isLoggedIn, loadRecentTributes]);

  useEffect(() => {
    if (!isLoggedIn || isGuestMode || isPreviewMode || activePanel !== "tasks") {
      return;
    }

    let isDisposed = false;
    let isRefreshing = false;
    let timer: number | null = null;

    const clearScheduledRefresh = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const scheduleNextRefresh = (delay = getJackpotRefreshDelay(jackpot)) => {
      clearScheduledRefresh();

      if (isDisposed) {
        return;
      }

      timer = window.setTimeout(() => {
        void refreshJackpot();
      }, delay);
    };

    const refreshJackpot = async () => {
      if (isDisposed || isRefreshing) {
        return;
      }

      if (document.visibilityState === "hidden") {
        scheduleNextRefresh();
        return;
      }

      isRefreshing = true;

      try {
        await loadJackpot();
      } finally {
        isRefreshing = false;
        scheduleNextRefresh();
      }
    };

    const handleWindowFocus = () => {
      clearScheduledRefresh();
      void refreshJackpot();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      clearScheduledRefresh();
      void refreshJackpot();
    };

    scheduleNextRefresh(0);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isDisposed = true;
      clearScheduledRefresh();
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activePanel, isGuestMode, isLoggedIn, isPreviewMode, jackpot?.phase, jackpot?.phaseEndsAt, loadJackpot]);

  const persistGalleryUnlocks = useCallback(async (itemIds: string[]) => {
    if (!authUserId || itemIds.length === 0 || isGuestMode) {
      return;
    }

    const rows = itemIds.map((itemId) => ({
      user_id: authUserId,
      item_id: itemId,
    }));

    void rows;
    const response = await fetch("/api/user/gallery-unlocks", {
      body: JSON.stringify({ itemIds }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      console.error("Failed to persist user_gallery unlocks", {
        itemIds,
        error: payload.error,
      });
      throw new Error(payload.error ?? "Gallery unlock failed.");
    }
  }, [authUserId, isGuestMode]);

  const refreshDisplayName = useCallback(async (userId?: string | null) => {
    const targetUserId = userId ?? authUserId;

    if (!targetUserId || isGuestMode || isPreviewMode) {
      return null;
    }

    try {
      const response = await fetch("/api/user/display-name", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        displayName?: string | null;
        error?: string;
      } | null;

      if (!response.ok) {
        return null;
      }

      const nextDisplayName = typeof payload?.displayName === "string" ? payload.displayName : null;
      setDisplayName(nextDisplayName);
      return nextDisplayName;
    } catch (error) {
      console.error("Failed to refresh display name", error);
      return null;
    }
  }, [authUserId, isGuestMode, isPreviewMode]);

  useEffect(() => {
    if (!authBootstrapped || !isLoggedIn || isGuestMode || isPreviewMode) {
      return;
    }

    void refreshDisplayName();
  }, [authBootstrapped, isGuestMode, isLoggedIn, isPreviewMode, refreshDisplayName]);

  const applyProfile = useCallback(async (profile: Profile) => {
    setAuthUserId(profile.id);
    setUsername(profile.twitter_handle ?? profile.username);
    const nextDisplayName = resolveProfileDisplayName(profile);
    if (nextDisplayName !== undefined) {
      setDisplayName(nextDisplayName);
    } else {
      void refreshDisplayName(profile.id);
    }
    setCoins(profile.coins);
    setAffection(profile.affection);
    setTributeTotal(profile.tribute_total ?? 0);
    setLifetimeSpentCoins(profile.lifetime_spent_coins ?? 0);
    setUserLevel(profile.user_level ?? getUserLevelProgress(profile.user_xp ?? 0).level);
    setUserXp(profile.user_xp ?? 0);
    setPetScore(profile.pet_score ?? 0);
    setOwnerLikeness(profile.owner_likeness ?? 100);
    setStoredRights(profile.stored_rights ?? 0);
    setRightExpirations(Array.isArray(profile.right_expirations) ? profile.right_expirations : []);
    setDailyPurchaseCount(profile.daily_purchase_count ?? 0);
    setRightPurchaseDate(profile.right_purchase_date ?? null);
    setPetUnlockedAt(profile.pet_unlocked_at ?? null);
    setLastPetTaxAt(profile.last_pet_tax_at ?? null);
    setLoyaltyStreak(profile.loyalty_streak ?? 0);
    setLastLoyaltyAt(profile.last_loyalty_at ?? null);
    const slots = normalizeEquipment(profile.equipped_avatar_slots || {});
    setEquippedAvatarSlots(slots);
    committedEquippedRef.current = slots;
    setHasUncensoredAvatar(profile.has_uncensored_avatar || false);

    const { data: cosmeticData, error: cosmeticError } = await supabase
      .from("user_cosmetics")
      .select("item_id, item_type, equipped")
      .eq("user_id", profile.id);

    if (cosmeticError) {
      console.warn("Failed to load user cosmetics", cosmeticError);
      setOwnedCosmeticIds([DEFAULT_SPEECH_AVATAR_ID]);
      setEquippedCosmeticIds({ "speech-avatar": DEFAULT_SPEECH_AVATAR_ID });
    } else {
      const cosmeticRows = (cosmeticData ?? []) as UserCosmeticRow[];
      const ownedIds = Array.from(
        new Set([DEFAULT_SPEECH_AVATAR_ID, ...cosmeticRows.map((entry) => entry.item_id)]),
      );
      const equipped = cosmeticRows.reduce<Partial<Record<CosmeticType, string>>>(
        (acc, entry) => {
          if (entry.equipped) {
            acc[entry.item_type] = entry.item_id;
          }

          return acc;
        },
        { "speech-avatar": DEFAULT_SPEECH_AVATAR_ID },
      );

      setOwnedCosmeticIds(ownedIds);
      setEquippedCosmeticIds(equipped);
    }

    const { data: throneTransactions, error: throneError } = await supabase
      .from("coin_transactions")
      .select("amount, metadata, reason")
      .eq("user_id", profile.id)
      .in("reason", ["throne_tribute", "live_gift"]);

    if (throneError) {
      console.warn("Failed to load Throne coin milestone totals", throneError);
    }

    const throneCoinTotal = (throneTransactions ?? []).reduce(
      (sum, entry) => {
        const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
        const command = typeof metadata.command === "string" ? metadata.command : null;
        const kind = typeof metadata.kind === "string" ? metadata.kind : null;
        const source = typeof metadata.source === "string" ? metadata.source : null;
        const isThroneTribute =
          entry.reason === "throne_tribute" ||
          (entry.reason === "live_gift" && (command === "give" || kind === "manual_coin_purchase" || source === "throne"));

        return isThroneTribute ? sum + Math.max(0, Number(entry.amount ?? 0)) : sum;
      },
      0,
    );
    const hasLegendary = crateInventory.some((item) => item.rarity === "legendary");
    const invValue = crateInventory.reduce((sum, item) => sum + (item.quantity || 0) * (item.sell_value || 0), 0);

    const ownedLegendaryIds = new Set(
      crateInventory
        .filter((item) => item.rarity === "legendary")
        .map((item) => item.item_id)
    );
    const hasAllLegendaries = ALL_LEGENDARY_ITEM_IDS.every((id) => ownedLegendaryIds.has(id));

    const autoTitleIds = Array.from(
      new Set([
        ...getUnlockedProgressionTitleIds(profile.tribute_total ?? 0),
        ...getUnlockedThroneTitleIds(throneCoinTotal),
        ...getUnlockedCrateTitleIds(hasLegendary),
        ...getUnlockedInventoryTitleIds(invValue, hasAllLegendaries),
      ]),
    );

    if (autoTitleIds.length > 0) {
      try {
        const response = await fetch("/api/user/titles", {
          body: JSON.stringify({
            action: "unlock",
            titleIds: autoTitleIds,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string };

        if (!response.ok) {
          throw createApiError("/api/user/titles", response, payload);
        }
      } catch (error) {
        console.warn("Failed to upsert automatic titles", error);
      }
    }

    const { data: titleData, error: titleError } = await supabase
      .from("user_titles")
      .select("title_id, equipped")
      .eq("user_id", profile.id);

    if (titleError) {
      console.warn("Failed to load user titles", titleError);
      const fallbackTitle = getDefaultTitleId(profile.tribute_total ?? 0);
      setOwnedTitleIds([fallbackTitle]);
      setEquippedTitleId(fallbackTitle);
      setIsTitleManuallySelected(false);
    } else {
      const titleRows = (titleData ?? []) as UserTitleRow[];
      const fallbackTitle = getDefaultTitleId(profile.tribute_total ?? 0);
      const ownedTitles = Array.from(
        new Set([fallbackTitle, ...autoTitleIds, ...titleRows.map((entry) => entry.title_id)]),
      );
      const equippedTitle = titleRows.find((entry) => entry.equipped)?.title_id ?? fallbackTitle;

      setOwnedTitleIds(ownedTitles);
      setEquippedTitleId(ownedTitles.includes(equippedTitle) ? equippedTitle : fallbackTitle);
      setIsTitleManuallySelected(equippedTitle !== fallbackTitle);
    }

    const { data: galleryData, error: galleryError } = await supabase
      .from("user_gallery")
      .select("item_id")
      .eq("user_id", profile.id);

    if (galleryError) {
      console.error("Failed to load persisted gallery unlocks", galleryError);
      throw galleryError;
    }

    const { data: legacyGalleryData, error: legacyGalleryError } = await supabase
      .from("unlocked_gallery_items")
      .select("item_id")
      .eq("user_id", profile.id);

    if (legacyGalleryError) {
      console.warn("Failed to load legacy gallery unlocks", legacyGalleryError);
    }

    const galleryIds = new Set([
      ...(galleryData?.map((entry) => entry.item_id) ?? []),
      ...(legacyGalleryData?.map((entry) => entry.item_id) ?? []),
    ]);
    const unlockedIds = Array.from(galleryIds);

    setUnlockedGalleryIds(unlockedIds);

    const { data: petGalleryData, error: petGalleryError } = await supabase
      .from("user_pet_gallery")
      .select("item_id")
      .eq("user_id", profile.id);

    if (petGalleryError) {
      console.warn("Failed to load pet gallery unlocks", petGalleryError);
      setPetGalleryUnlockedIds([]);
    } else {
      setPetGalleryUnlockedIds(petGalleryData?.map((entry) => entry.item_id) ?? []);
    }

    const { data: debtData, error: debtError } = await supabase
      .from("pet_debt_contracts")
      .select(userDebtContractSelect)
      .eq("user_id", profile.id)
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (debtError) {
      console.warn("Failed to load Pet debt contract", debtError);
      setPetDebtContract(null);
    } else {
      const activeDebtContract = (debtData as PetDebtContract | null) ?? null;
      const debtAutoPayEnabled = readDebtAutoPayEnabled(profile.id);
      const duePlan =
        activeDebtContract
          ? getDueDebtPaymentPlan(activeDebtContract, {
              autoPayEnabled: debtAutoPayEnabled,
            })
          : null;

      setIsDebtAutoPayEnabled(debtAutoPayEnabled);

      if (!activeDebtContract || !duePlan) {
        setPetDebtContract(activeDebtContract);
      } else {
        try {
          const response = await fetch("/api/user/debt-contracts", {
            body: JSON.stringify({
              action: "autoCollect",
              autoPayEnabled: debtAutoPayEnabled,
              contractId: activeDebtContract.id,
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
          const result = (await response.json()) as {
            autoPaySkipped?: boolean;
            contract?: PetDebtContract | null;
            error?: string;
            plan?: { amount: number; missedPeriods: number };
            profile?: Profile;
            reason?: string;
          };

          if (!response.ok) {
            throw new Error(result.error ?? "Debt auto-collection failed.");
          }

          if (result.profile) {
            const updatedProfile = result.profile;
            setCoins(updatedProfile.coins);
            coinsRef.current = updatedProfile.coins;
            setAffection(updatedProfile.affection);
            setTributeTotal(updatedProfile.tribute_total ?? profile.tribute_total ?? 0);
            setPetScore(updatedProfile.pet_score ?? 0);
            setOwnerLikeness(updatedProfile.owner_likeness ?? 100);
            setPetUnlockedAt(updatedProfile.pet_unlocked_at ?? null);
            setLastPetTaxAt(updatedProfile.last_pet_tax_at ?? null);
            unlockProgressionTitles(result.profile.tribute_total ?? profile.tribute_total ?? 0);
            void loadLeadershipTop();
          }

          setPetDebtContract((result.contract as PetDebtContract | null) ?? null);
          if (result.autoPaySkipped) {
            setAvatarMistressReply("Debt Contract auto-payment skipped. Not enough coins for the current installment.");
          } else {
            setAvatarMistressReply(
              (result.plan?.missedPeriods ?? 0) > 0
                ? `Missed Debt Contract collected automatically. ${Number(result.plan?.amount ?? duePlan.amount).toLocaleString()} coins charged.`
                : `Debt Contract auto-payment completed. ${Number(result.plan?.amount ?? duePlan.amount).toLocaleString()} coins charged.`,
            );
          }
        } catch (error) {
          console.error("Failed to auto-collect overdue debt payment", error);
          setAuthError(describeError(error));
          setPetDebtContract(activeDebtContract);
        }
      }
    }

    const { data: taskData, error: taskError } = await supabase
      .from("user_tasks")
      .select("task_id, completed_at, claimed_at, reward_coins, metadata")
      .eq("user_id", profile.id);

    if (taskError) {
      console.error("Failed to load persisted task state", taskError);
      throw taskError;
    }

    let taskRows = (taskData ?? []) as UserTaskRow[];
    const highLowTaskRow = taskRows.find((entry) => entry.task_id === "high-low");
    const highLowNeedsSeed =
      !getTaskMetadataNumber(highLowTaskRow?.metadata, "highLowCurrentNumber", Number.NaN) ||
      !getTaskMetadataNumber(highLowTaskRow?.metadata, "highLowNextNumber", Number.NaN) ||
      !getTaskMetadataString(highLowTaskRow?.metadata, "highLowRoundAvailableAt");

    if (highLowNeedsSeed) {
      const seedResponse = await fetch("/api/user/task-actions/high-low", {
        body: JSON.stringify({ action: "seed" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const seedResult = (await seedResponse.json().catch(() => null)) as { error?: string; seeded?: boolean } | null;

      if (seedResponse.ok && seedResult?.seeded) {
        const { data: reseededTaskData, error: reseedError } = await supabase
          .from("user_tasks")
          .select("task_id, completed_at, claimed_at, reward_coins, metadata")
          .eq("user_id", profile.id);

        if (reseedError) {
          console.warn("Failed to refetch high-low seed state", reseedError);
        } else {
          taskRows = (reseededTaskData ?? []) as UserTaskRow[];
        }
      }
    }

    const { data: petTaskData, error: petTaskError } = await supabase
      .from("user_pet_tasks")
      .select("task_id, completed_at, reward_score, status, reviewed_at, metadata")
      .eq("user_id", profile.id);

    if (petTaskError) {
      console.warn("Failed to load pet task state", petTaskError);
      setPetTaskState(petTasks);
      setPetAffectionClaimDate(null);
    } else {
      const petRows = (petTaskData ?? []) as UserPetTaskRow[];
      const petMilestoneClaimRow = petRows.find(
        (entry) => entry.task_id === "pet-affection-claim" && entry.status === "approved",
      );
      const petMilestoneClaimDate = getTaskMetadataString(
        petMilestoneClaimRow?.metadata,
        "date",
      );

      setPetTaskState(buildPetTasksFromRows(petRows, profile.last_pet_tax_at, highLowTaskRow));
      setPetAffectionClaimDate(petMilestoneClaimDate);
    }

    const { data: irlTaskData, error: irlTaskError } = await supabase
      .from("user_irl_tasks")
      .select("task_label, task_description, wheel_index, status, due_at, penalty_timeout_minutes")
      .eq("user_id", profile.id)
      .eq("status", "assigned")
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (irlTaskError) {
      console.error("Failed to load assigned IRL task", irlTaskError);
      throw irlTaskError;
    }

    const latestIrlTask = irlTaskData as UserIrlTaskRow | null;

    const rebuiltTasks = buildTasksFromRows(
      taskRows,
      profile.affection,
      profile.loyalty_streak ?? 0,
      profile.last_loyalty_at ?? null,
      latestIrlTask,
      profile.timeout_until ?? null,
    );
    setTasks(rebuiltTasks);
    profileIdRef.current = profile.id;
    setMechanics(buildMechanicsFromRows(taskRows, unlockedIds));
    setIsLoggedIn(true);
    // Removed automatic setActivePanel("home") — successful profile load / actions should not redirect.
    // Only change panel if explicitly calling setActivePanel via navigation.
    void loadLeadershipTop();
    void loadShameTop();
  }, [
    loadLeadershipTop,
    loadShameTop,
    refreshDisplayName,
    setAvatarMistressReply,
    unlockProgressionTitles,
  ]);

  const applyProfileStats = useCallback((profile: Profile) => {
    setAuthUserId(profile.id);
    setUsername(profile.twitter_handle ?? profile.username);
    const nextDisplayName = resolveProfileDisplayName(profile);
    if (nextDisplayName !== undefined) {
      setDisplayName(nextDisplayName);
    } else {
      void refreshDisplayName(profile.id);
    }
    setCoins(profile.coins);
    setAffection(profile.affection);
    setTributeTotal(profile.tribute_total ?? 0);
    setLifetimeSpentCoins(profile.lifetime_spent_coins ?? 0);
    setPetScore(profile.pet_score ?? 0);
    setOwnerLikeness(profile.owner_likeness ?? 100);
    setPetUnlockedAt(profile.pet_unlocked_at ?? null);
    setLastPetTaxAt(profile.last_pet_tax_at ?? null);
    setLoyaltyStreak(profile.loyalty_streak ?? 0);
    setLastLoyaltyAt(profile.last_loyalty_at ?? null);
    timeoutUntilRef.current = profile.timeout_until ?? null;
    timeoutReasonRef.current = profile.timeout_reason ?? null;
    setTimeoutUntil(profile.timeout_until ?? null);
    setTimeoutReason(profile.timeout_reason ?? null);
    const slots = normalizeEquipment(profile.equipped_avatar_slots || {});
    setEquippedAvatarSlots(slots);
    committedEquippedRef.current = slots;
    setHasUncensoredAvatar(profile.has_uncensored_avatar || false);
    setIsLoggedIn(true);
    // Do not force "home" here — updates from other tabs (e.g. crates open) should not kick user out of current panel.
  }, []);

  const shouldHydrateAdminSession = isLoggedIn && Boolean(authUserId) && !isGuestMode;

  useEffect(() => {
    let active = true;

    const hydrateAdminSession = async () => {
      if (!shouldHydrateAdminSession) {
        await Promise.resolve();

        if (active) {
          setIsAdminUser(false);
        }

        return;
      }

      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        const result = (await response.json().catch(() => null)) as { isAdmin?: boolean } | null;

        if (active) {
          if (response.status === 401 || response.status === 403) {
            setIsAdminUser(false);
          } else if (response.ok) {
            setIsAdminUser(result?.isAdmin === true);
          }
        }
      } catch (error) {
        console.error("Admin session hydration failed", error);
      }
    };

    void hydrateAdminSession();

    return () => {
      active = false;
    };
  }, [adminSessionRefreshNonce, shouldHydrateAdminSession]);

  useEffect(() => {
    if (!authUserId || isGuestMode) {
      return;
    }

    const refreshTimeout = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(profileSelect)
        .eq("id", authUserId)
        .maybeSingle();

      if (error) {
        console.error("Failed to refresh profile timeout on focus", error);
        return;
      }

      if (data) {
        applyProfileStats(data as Profile);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshTimeout();
      }
    };

    window.addEventListener("focus", refreshTimeout);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshTimeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [applyProfileStats, authUserId, isGuestMode]);

  const createProfileForUser = useCallback(async (user: User) => {
    const avatarUrl = profileAvatarFromUser(user);

    const createProfile = async () => {
      console.info("Creating/upserting profile", {
        userId: user.id,
      });

      const response = await fetch("/api/user/profile-bootstrap", {
        body: JSON.stringify({
          avatarUrl,
          // username generation handled server-side using X metadata + uniqueness suffixing on first creation only
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string; profile?: Profile };
      const result = {
        data: payload.profile ?? null,
        error: response.ok ? null : { message: payload.error ?? "Profile could not be created." },
      };

      console.info("Profile upsert result", {
        data: result.data,
        error: result.error,
      });

      if (result.error) {
        console.error("Profile upsert error", result.error);
      }

      return result;
    };

    const { data: createdProfile, error: insertError } = await createProfile();

    if (insertError || !createdProfile) {
      console.error("Profile create final failure", {
        createdProfile,
        insertError,
      });
      throw insertError ?? new Error("Profile could not be created.");
    }

    if (avatarUrl) {
      const { error: avatarError } = await supabase
        .from("profiles")
        .update({
          avatar_url: avatarUrl,
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (avatarError) {
        console.error("Profile avatar sync failed", avatarError);
      }
    } else {
      const { error: loginError } = await supabase
        .from("profiles")
        .update({
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (loginError) {
        console.error("Profile login timestamp sync failed", loginError);
      }
    }

    return createdProfile;
  }, []);

  const applyPetMaintenance = useCallback(async (profile: Profile) => {
    if (isGuestMode) {
      return profile;
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const patch: Partial<Profile> & { updated_at?: string } = {};
    let workingProfile = profile;
    let nextAffection = profile.affection;
    let nextPetUnlockedAt = profile.pet_unlocked_at ?? null;
    let nextOwnerLikeness = profile.owner_likeness ?? 100;
    let nextLastOwnerLikenessAt = profile.last_owner_likeness_at ?? null;
    let nextLastTaxAt = profile.last_pet_tax_at ?? null;
    const ownerLikenessProtected =
      normalizeUsernameKey(profile.username) === OWNER_LIKENESS_PROTECTED_USERNAME;

    if (ownerLikenessProtected && nextOwnerLikeness !== 100) {
      nextOwnerLikeness = 100;
      patch.owner_likeness = 100;
    }

    if (!nextPetUnlockedAt && profile.affection >= 100) {
      nextPetUnlockedAt = nowIso;
      nextLastOwnerLikenessAt = nowIso;
      nextLastTaxAt = nextLastTaxAt ?? nowIso;
      patch.pet_unlocked_at = nextPetUnlockedAt;
      patch.last_owner_likeness_at = nextLastOwnerLikenessAt;
      patch.last_pet_tax_at = nextLastTaxAt;
      patch.owner_likeness = nextOwnerLikeness;
    }

    if (nextPetUnlockedAt && ownerLikenessProtected) {
      if (nextOwnerLikeness !== 100 || !nextLastOwnerLikenessAt) {
        nextOwnerLikeness = 100;
        nextLastOwnerLikenessAt = nowIso;
        patch.owner_likeness = 100;
        patch.last_owner_likeness_at = nowIso;
      }
    } else if (nextPetUnlockedAt) {
      const likenessBase = new Date(nextLastOwnerLikenessAt ?? nextPetUnlockedAt).getTime();
      const elapsedLikenessDays = Math.floor((now - likenessBase) / DAY_MS);

      if (elapsedLikenessDays > 0) {
        const dayStart = new Date(now - DAY_MS);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + DAY_MS);
        const { count, error: countError } = await supabase
          .from("user_pet_tasks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .eq("status", "approved")
          .gte("completed_at", dayStart.toISOString())
          .lt("completed_at", dayEnd.toISOString());

        if (countError) {
          console.error("Failed to count daily Pet tasks for Owner Likeness", countError);
        }

        if ((count ?? 0) >= 5) {
          nextOwnerLikeness = Math.min(100, nextOwnerLikeness + 10);
        } else {
          nextOwnerLikeness = Math.max(0, nextOwnerLikeness - 25);
        }

        if (nextOwnerLikeness <= 0) {
          nextAffection = Math.max(0, nextAffection - 30);
          nextOwnerLikeness = 100;
          patch.affection = nextAffection;
        }

        nextLastOwnerLikenessAt = nowIso;
        patch.owner_likeness = nextOwnerLikeness;
        patch.last_owner_likeness_at = nextLastOwnerLikenessAt;
        nextLastTaxAt = nextLastTaxAt ?? nowIso;
        patch.affection = nextAffection;
        patch.last_pet_tax_at = nextLastTaxAt;
      }
    }

    if (Object.keys(patch).length === 0) {
      workingProfile = profile;
    } else {
      const response = await fetch("/api/user/pet-profile-patch", {
        body: JSON.stringify({
          patch,
          reason: "pet:maintenance",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string; profile?: Profile };

      if (!response.ok || !result.profile) {
        console.error("Failed to persist Pet maintenance", result.error);
        return profile;
      }

      workingProfile = result.profile as Profile;
    }

    const taxBaseMs = new Date(workingProfile.last_pet_tax_at ?? workingProfile.pet_unlocked_at ?? 0).getTime();
    const taxDue = Boolean(workingProfile.pet_unlocked_at) && Number.isFinite(taxBaseMs) && now - taxBaseMs >= WEEK_MS;

    if (!taxDue) {
      return workingProfile;
    }

    const weeklyTaxCost = Math.min(getPetWeeklyTaxCost(workingProfile.coins), workingProfile.coins);

    if (weeklyTaxCost <= 0) {
      return workingProfile;
    }

    const nextCoins = workingProfile.coins - weeklyTaxCost;
    const nextPetScore = Math.min(1000, (workingProfile.pet_score ?? 0) + PET_WEEKLY_TAX_REWARD);

    try {
      const taxResponse = await fetch("/api/user/pet-profile-patch", {
        body: JSON.stringify({
          metadata: {
            autoCollected: true,
          },
          nextProfile: {
            coins: nextCoins,
            pet_score: nextPetScore,
          },
          patch: {
            coins: nextCoins,
            last_pet_tax_at: nowIso,
            pet_score: nextPetScore,
          },
          reason: "spend:pet-weekly-tax",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const taxResult = (await taxResponse.json()) as { error?: string; profile?: Profile };

      if (!taxResponse.ok || !taxResult.profile) {
        console.error("Failed to auto-collect weekly tax", taxResult.error);
        return workingProfile;
      }

      workingProfile = taxResult.profile as Profile;

      try {
        await persistPetTask(
          {
            task_id: "pet-weekly-throne-tax",
            completed_at: nowIso,
            metadata: {
              autoCollected: true,
              cost: weeklyTaxCost,
            },
            reviewed_at: nowIso,
            reward_score: PET_WEEKLY_TAX_REWARD,
            status: "approved",
          },
        );
      } catch (taskError) {
        console.error("Failed to persist auto-collected weekly tax task", taskError);
      }
    } catch (taxError) {
      console.error("Failed to auto-collect weekly tax", taxError);
    }

    return workingProfile;
  }, [isGuestMode]);

  const loadProfile = useCallback(async (user: User) => {
    console.info("[auth-init] profile fetch started", {
      id: user.id,
      metadata: user.user_metadata,
    });

    const { data: existingProfile, error } = await supabase
      .from("profiles")
      .select(profileSelect)
      .eq("id", user.id)
      .maybeSingle();

    console.info("[auth-init] profile fetch result", {
      existingProfile,
      error,
    });

    if (error) {
      console.error("[auth-init] profile fetch error", error);
      throw error;
    }

    if (existingProfile) {
      const avatarUrl = profileAvatarFromUser(user);

      if (avatarUrl) {
        void supabase
          .from("profiles")
          .update({
            avatar_url: avatarUrl,
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id)
          .then(({ error: avatarError }) => {
            if (avatarError) {
              console.error("Profile avatar sync failed", avatarError);
            }
          });
      } else {
        void supabase
          .from("profiles")
          .update({
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id)
          .then(({ error: loginError }) => {
            if (loginError) {
              console.error("Profile login timestamp sync failed", loginError);
            }
          });
      }

      const maintainedProfile = await applyPetMaintenance(existingProfile as Profile);
      await applyProfile(maintainedProfile);
      return maintainedProfile as Profile;
    }

    const createdProfile = await createProfileForUser(user);
    const maintainedProfile = await applyPetMaintenance(createdProfile as Profile);
    await applyProfile(maintainedProfile);
    return maintainedProfile as Profile;
  }, [applyPetMaintenance, applyProfile, createProfileForUser]);

  const updateLoyaltyForProfile = useCallback(async (profile: Profile) => {
    const lastLoyaltyAt = profile.last_loyalty_at;

    if (lastLoyaltyAt && getDailyCooldownUntil(lastLoyaltyAt)) {
      setLoyaltyStreak(profile.loyalty_streak ?? 0);
      setLastLoyaltyAt(lastLoyaltyAt);
      setTasks((current) =>
        current.map((entry) => {
          const bonus = STREAK_BONUSES.find((item) => item.id === entry.id);

          return bonus
            ? { ...entry, completed: (profile.loyalty_streak ?? 0) >= bonus.milestone }
            : entry;
        }),
      );
      return profile;
    }

    const response = await fetch("/api/user/loyalty", {
      method: "POST",
    });
    const result = (await response.json()) as { error?: string; profile?: Profile };

    console.info("Loyalty streak update result", { result, ok: response.ok });

    if (!response.ok || !result.profile) {
      console.error("Failed to persist loyalty streak", result.error);
      throw new Error(result.error ?? "Loyalty streak update failed.");
    }

    const data = result.profile;

    setLoyaltyStreak(data.loyalty_streak ?? 0);
    setLastLoyaltyAt(data.last_loyalty_at ?? null);
    setTasks((current) =>
      current.map((entry) => {
        const bonus = STREAK_BONUSES.find((item) => item.id === entry.id);

        return bonus
          ? { ...entry, completed: (data.loyalty_streak ?? 0) >= bonus.milestone }
          : entry;
      }),
    );
    return data as Profile;
  }, []);

  const persistProfileProgress = useCallback(async (
    nextProfile: Pick<Profile, "coins" | "affection"> &
      Partial<Pick<Profile, "tribute_total">>,
    reason: string,
    metadata: Record<string, unknown> = {},
  ) => {
    if (isGuestMode) {
      const nextTributeTotal =
        typeof nextProfile.tribute_total === "number" ? nextProfile.tribute_total : tributeTotal;
      setCoins(nextProfile.coins);
      setAffection(nextProfile.affection);
      setTributeTotal(nextTributeTotal);
      if (typeof nextProfile.tribute_total === "number") {
        unlockProgressionTitles(nextTributeTotal);
      }

      return {
        id: authUserId ?? LOCAL_GUEST_USER_ID,
        username,
        coins: nextProfile.coins,
        affection: nextProfile.affection,
        tribute_total: nextTributeTotal,
        shame_count: 0,
        is_admin: false,
        loyalty_streak: loyaltyStreak,
        last_loyalty_at: lastLoyaltyAt,
        timeout_until: timeoutUntil,
        pet_score: petScore,
        owner_likeness: ownerLikeness,
        pet_unlocked_at: petUnlockedAt,
        last_pet_tax_at: lastPetTaxAt,
      } as Profile;
    }

    const response = await fetch("/api/user/profile-progress", {
      body: JSON.stringify({
        metadata,
        nextProfile,
        reason,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = (await response.json()) as { error?: string; profile?: Profile };
    const data = result.profile ?? null;
    const error = response.ok ? null : createApiError("/api/user/profile-progress", response, result);

    console.info("Persist profile progress result", {
      reason,
      nextProfile,
      data,
      error,
    });

    if (error) {
      console.error("Failed to persist profile progress", error);
      throw error;
    }

    if (!data) {
      throw new Error("Profile update returned no data.");
    }

    applyProfileStats(data);
    if (typeof nextProfile.tribute_total === "number") {
      unlockProgressionTitles(nextProfile.tribute_total);
      void loadLeadershipTop();
    }
    return data;
  }, [
    applyProfileStats,
    authUserId,
    isGuestMode,
    lastLoyaltyAt,
    lastPetTaxAt,
    loadLeadershipTop,
    loyaltyStreak,
    ownerLikeness,
    petScore,
    petUnlockedAt,
    timeoutUntil,
    tributeTotal,
    unlockProgressionTitles,
    username,
  ]);

  const persistPetProfilePatch = useCallback(async (
    patch: Partial<Pick<Profile, "affection" | "coins" | "last_owner_likeness_at" | "last_pet_tax_at" | "owner_likeness" | "pet_score" | "pet_unlocked_at" | "tribute_total">>,
    reason: string,
    metadata: Record<string, unknown> = {},
  ) => {
    if (isGuestMode) {
      const nextCoins = typeof patch.coins === "number" ? patch.coins : coinsRef.current;
      const nextPetScore = typeof patch.pet_score === "number" ? patch.pet_score : petScore;
      const nextOwnerLikeness =
        typeof patch.owner_likeness === "number" ? patch.owner_likeness : ownerLikeness;
      const nextAffection =
        typeof patch.affection === "number" ? patch.affection : affection;
      const nextTributeTotal =
        typeof patch.tribute_total === "number" ? patch.tribute_total : tributeTotal;
      const nextPetUnlockedAt =
        typeof patch.pet_unlocked_at === "string" ? patch.pet_unlocked_at : petUnlockedAt;
      const nextLastPetTaxAt =
        typeof patch.last_pet_tax_at === "string" ? patch.last_pet_tax_at : lastPetTaxAt;

      setCoins(nextCoins);
      setPetScore(nextPetScore);
      setOwnerLikeness(nextOwnerLikeness);
      setAffection(nextAffection);
      setTributeTotal(nextTributeTotal);
      setPetUnlockedAt(nextPetUnlockedAt);
      setLastPetTaxAt(nextLastPetTaxAt ?? null);
      if (typeof patch.tribute_total === "number") {
        unlockProgressionTitles(nextTributeTotal);
      }

      return {
        id: authUserId ?? LOCAL_GUEST_USER_ID,
        username,
        coins: nextCoins,
        affection: nextAffection,
        tribute_total: nextTributeTotal,
        shame_count: 0,
        is_admin: false,
        loyalty_streak: loyaltyStreak,
        last_loyalty_at: lastLoyaltyAt,
        timeout_until: timeoutUntil,
        pet_score: nextPetScore,
        owner_likeness: nextOwnerLikeness,
        pet_unlocked_at: nextPetUnlockedAt,
        last_owner_likeness_at: patch.last_owner_likeness_at ?? null,
        last_pet_tax_at: nextLastPetTaxAt,
      } as Profile;
    }

    if (!authUserId) {
      throw new Error("Not authenticated");
    }

    const response = await fetch("/api/user/pet-profile-patch", {
      body: JSON.stringify({
        metadata,
        patch,
        reason,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = (await response.json()) as { error?: string; profile?: Profile };
    const data = result.profile ?? null;
    const error = response.ok ? null : createApiError("/api/user/pet-profile-patch", response, result);

    if (error) {
      console.error("Failed to persist Pet profile patch", { reason, error });
      throw error;
    }

    if (!data) {
      throw new Error("Pet profile update returned no profile.");
    }

    applyProfileStats(data as Profile);
    if (typeof patch.tribute_total === "number") {
      unlockProgressionTitles(patch.tribute_total);
      void loadLeadershipTop();
    }
    return data as Profile;
  }, [
    affection,
    applyProfileStats,
    authUserId,
    isGuestMode,
    lastLoyaltyAt,
    lastPetTaxAt,
    loadLeadershipTop,
    loyaltyStreak,
    ownerLikeness,
    petScore,
    petUnlockedAt,
    timeoutUntil,
    tributeTotal,
    unlockProgressionTitles,
    username,
  ]);

  const persistPetTask = useCallback(async (task: {
    completed_at?: string | null;
    metadata?: Record<string, unknown>;
    reviewed_at?: string | null;
    reward_score: number;
    status: string;
    task_id: string;
  }) => {
    const response = await fetch("/api/user/pet-tasks", {
      body: JSON.stringify(task),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string; task?: UserPetTaskRow };

    if (!response.ok || !payload.task) {
      throw createApiError("/api/user/pet-tasks", response, payload);
    }

    return payload.task;
  }, []);

  const persistPetGalleryUnlocks = useCallback(async (itemIds: string[]) => {
    const response = await fetch("/api/user/pet-gallery-unlocks", {
      body: JSON.stringify({ itemIds }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string; itemIds?: string[] };

    if (!response.ok) {
      throw createApiError("/api/user/pet-gallery-unlocks", response, payload);
    }

    return payload.itemIds ?? itemIds;
  }, []);

  const persistDebtContractAction = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/user/debt-contracts", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = (await response.json()) as {
      contract?: PetDebtContract | null;
      error?: string;
      plan?: {
        amount: number;
        completed: boolean;
        duePeriods: number;
        missedPeriods: number;
        nextDueAt: string;
        nextPaidPeriods: number;
      };
      profile?: Profile;
    };

    if (!response.ok) {
      throw createApiError("/api/user/debt-contracts", response, result);
    }

    if (result.profile) {
      applyProfileStats(result.profile);
      unlockProgressionTitles(result.profile.tribute_total ?? tributeTotal);
      void loadLeadershipTop();
    }

    return result;
  }, [applyProfileStats, loadLeadershipTop, tributeTotal, unlockProgressionTitles]);

  const persistTimeoutUntil = useCallback(async (nextTimeoutUntil: string | null) => {
    if (isGuestMode) {
      timeoutUntilRef.current = nextTimeoutUntil;
      setTimeoutUntil(nextTimeoutUntil);
      return {
        id: authUserId ?? LOCAL_GUEST_USER_ID,
        username,
        coins,
        affection,
        tribute_total: tributeTotal,
        shame_count: 0,
        is_admin: false,
        loyalty_streak: loyaltyStreak,
        last_loyalty_at: lastLoyaltyAt,
        timeout_until: nextTimeoutUntil,
      } as Profile;
    }

    if (!nextTimeoutUntil) {
      throw new Error("User timeout endpoint does not support clearing timeout.");
    }

    const response = await fetch("/api/user/timeout", {
      body: JSON.stringify({ timeoutUntil: nextTimeoutUntil }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = (await response.json()) as { error?: string; profile?: Profile };

    if (!response.ok || !result.profile) {
      console.error("Failed to persist timeout", result.error);
      throw createApiError("/api/user/timeout", response, result);
    }

    applyProfileStats(result.profile);
    return result.profile;
  }, [affection, applyProfileStats, authUserId, coins, isGuestMode, lastLoyaltyAt, loyaltyStreak, tributeTotal, username]);

  const handleTimeoutClear = useCallback(async () => {
    if (isPreviewRestricted) {
      setAvatarMistressReply("Sign in to unlock this feature. Preview Mode is read-only.");
      return;
    }

    if (isGuestMode || !authUserId) {
      setAvatarMistressReply("Timeout removal is only available on a signed-in account.");
      return;
    }

    if (!isTimeoutActive) {
      setAvatarMistressReply("No active timeout to clear.");
      return;
    }

    if (isUnderageTimeoutActive) {
      setAvatarMistressReply("This safety timeout needs manual review with proof.");
      return;
    }

    if (isTimeoutClearPending) {
      return;
    }

    if (coinsRef.current < timeoutClearFee) {
      setAvatarMistressReply(`You need ${timeoutClearFee.toLocaleString()} coins to clear this timeout.`);
      return;
    }

    setIsTimeoutClearPending(true);

    try {
      const response = await fetch("/api/user/timeout", {
        body: JSON.stringify({ action: "clear" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        clearFee?: number;
        error?: string;
        message?: string;
        profile?: Profile;
      };

      if (!response.ok || !result.profile) {
        console.error("Failed to clear timeout", result.error);
        throw createApiError("/api/user/timeout", response, result);
      }

      applyProfileStats(result.profile);
      setTimeoutUntil(result.profile.timeout_until ?? null);
      setTimeoutReason(result.profile.timeout_reason ?? null);
      setCurrentTime(Date.now());
      setAvatarMistressReply(
        result.message ??
          `Timeout cleared for ${(result.clearFee ?? timeoutClearFee).toLocaleString()} coins.`,
      );
      emitSoundEvent("task_completion");
    } catch (error) {
      console.error("Timeout clear failed", error);
      setAvatarMistressReply(describeError(error));
    } finally {
      setIsTimeoutClearPending(false);
    }
  }, [
    applyProfileStats,
    authUserId,
    coinsRef,
    describeError,
    emitSoundEvent,
    isGuestMode,
    isPreviewRestricted,
    isTimeoutActive,
    isTimeoutClearPending,
    isUnderageTimeoutActive,
    setAvatarMistressReply,
    timeoutClearFee,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = "auto";
    };
  }, [refreshDisplayName]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    resetScroll();
    const firstFrame = window.requestAnimationFrame(() => {
      resetScroll();
      window.requestAnimationFrame(resetScroll);
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
    };
  }, [activePanel]);

  const persistUserTask = useCallback(async (task: {
    claimed_at?: string | null;
    completed_at?: string | null;
    metadata?: Record<string, unknown>;
    reward_coins?: number | null;
    task_id: string;
  }) => {
    const response = await fetch("/api/user/tasks", {
      body: JSON.stringify({ task }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as {
      error?: string;
      task?: UserTaskRow;
    };

    if (!response.ok || !payload.task) {
      throw createApiError("/api/user/tasks", response, payload);
    }

    return payload.task;
  }, []);

  const persistTaskCompletion = useCallback(async (taskId: string) => {
    if (isGuestMode) {
      return;
    }

    if (!authUserId) {
      console.error("Cannot persist task completion without authenticated user id", taskId);
      return;
    }

    const task = startingTasks.find((entry) => entry.id === taskId);

    await persistUserTask({
        task_id: taskId,
        completed_at: new Date().toISOString(),
        reward_coins: task?.reward ?? 0,
        metadata: {},
    });
  }, [authUserId, isGuestMode, persistUserTask]);

  const persistTaskClaim = useCallback(async (task: TaskItem) => {
    if (isGuestMode) {
      const rewardCoins = getEventTaskReward(task.reward);
      return {
        task_id: task.id,
        completed_at: new Date().toISOString(),
        claimed_at: new Date().toISOString(),
        reward_coins: rewardCoins,
        metadata: {},
      };
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error("Failed to get authenticated user for task claim", userError);
      throw userError;
    }

    if (!userData.user) {
      throw new Error("Not authenticated");
    }

    const { data: existingTask, error: readError } = await supabase
      .from("user_tasks")
      .select("task_id, completed_at, claimed_at, reward_coins, metadata")
      .eq("user_id", userData.user.id)
      .eq("task_id", task.id)
      .maybeSingle();

    console.info("Task claim read result", { task, existingTask, readError });

    if (readError) {
      console.error("Failed to read task before claim", readError);
      throw readError;
    }

    if (task.id === "daily-login" && getDailyCooldownUntil(existingTask?.claimed_at ?? null)) {
      throw new Error("Daily task is still on cooldown.");
    }

    if (
      task.id === "typing-accuracy" &&
      (
        getDailyCooldownUntil(existingTask?.claimed_at ?? null) ||
        getDailyCooldownUntil(getTaskMetadataString(existingTask?.metadata, "failedAt"))
      )
    ) {
      throw new Error("Task is still on cooldown.");
    }

    if (
      task.id !== "daily-login" &&
      task.id !== "typing-accuracy" &&
      task.id !== "high-low" &&
      !STREAK_BONUSES.some((bonus) => bonus.id === task.id) &&
      existingTask?.claimed_at
    ) {
      throw new Error("Task reward was already claimed.");
    }

    const now = new Date().toISOString();
    const streakBonus = STREAK_BONUSES.find((bonus) => bonus.id === task.id);
    const streakCycleKey = getStreakCycleKey(loyaltyStreak, lastLoyaltyAt);
    const rewardCoins = getEventTaskReward(task.reward);

    if (streakBonus) {
      if (loyaltyStreak < streakBonus.milestone) {
        throw new Error("Streak milestone is not reached.");
      }

      if (existingTask?.claimed_at) {
        throw new Error("Streak bonus already claimed.");
      }
    }

    const data = await persistUserTask(
      {
        task_id: task.id,
        completed_at: existingTask?.completed_at ?? now,
        claimed_at: now,
        reward_coins: rewardCoins,
        metadata: {
          ...(existingTask?.metadata ?? {}),
          attemptsRemaining: task.id === "typing-accuracy" ? 3 : undefined,
          ...(streakBonus ? {
            cycleKey: streakCycleKey,
            milestone: streakBonus.milestone,
          } : {}),
        },
      });
    const error = null;

    console.info("Task claim persist result", { data, error });

    if (error) {
      console.error("Failed to persist task claim", error);
      throw error;
    }

    return data;
  }, [getEventTaskReward, isGuestMode, lastLoyaltyAt, loyaltyStreak, persistUserTask]);

  useEffect(() => {
    loadProfileRef.current = loadProfile;
    updateLoyaltyForProfileRef.current = updateLoyaltyForProfile;
    authReplyRef.current = setAvatarMistressReply;
  }, [loadProfile, setAvatarMistressReply, updateLoyaltyForProfile]);

  useEffect(() => {
    let mounted = true;

    const loadAuthenticatedUser = async (user: User, source: string) => {
      if (authProfileLoadInFlightRef.current === user.id) {
        console.info("[auth-init] profile load already in flight", { source, userId: user.id });
        return null;
      }

      if (authProfileLoadedRef.current === user.id && profileIdRef.current === user.id) {
        console.info("[auth-init] profile already loaded", { source, userId: user.id });
        return null;
      }

      authProfileLoadInFlightRef.current = user.id;
      setIsProfileLoading(true);
      setHasHydratedInitialProfile(false);
      setIsProfileVerified(false);

      try {
        console.info("[auth-init] profile fetch started", { source, userId: user.id });
        const profileLoader = loadProfileRef.current;
        const loyaltyUpdater = updateLoyaltyForProfileRef.current;

        if (!profileLoader || !loyaltyUpdater) {
          throw new Error("Auth profile loader is not ready.");
        }

        const profile = await withTimeout(profileLoader(user), `profile fetch ${source}`);
        await withTimeout(loyaltyUpdater(profile), `loyalty update ${source}`);
        authProfileLoadedRef.current = user.id;
        setHasHydratedInitialProfile(true);
        setIsProfileVerified(true);
        console.info("[auth-init] profile fetch result", { source, profile });
        return profile;
      } finally {
        if (authProfileLoadInFlightRef.current === user.id) {
          authProfileLoadInFlightRef.current = null;
        }
        setIsProfileLoading(false);
      }
    };

    const finishAuthLoad = () => {
      if (!mounted) {
        return;
      }

      console.info("[auth-init] loading false");
      authBootstrappedRef.current = true;
      setAuthBootstrapped(true);
      setIsAuthLoading(false);
    };

    const clearAuthState = () => {
      authProfileLoadInFlightRef.current = null;
      authProfileLoadedRef.current = null;
      setIsProfileVerified(false);
      setIsProfileLoading(false);
      setHasHydratedInitialProfile(false);
      setIsLoggedIn(false);
      setAuthUserId(null);
    };

    const verifyAuthenticatedUser = async (user: User, source: string) => {
      try {
        if (!mounted) {
          return;
        }

        setAuthError("");
        setIsGuestMode(false);
        setIsPreviewMode(false);
        previewModeRef.current = false;
        const profile = await loadAuthenticatedUser(user, source);
        if (profile) {
          authReplyRef.current?.("Logged in already? Eager little thing.");
        }
        finishAuthLoad();
      } catch (initError) {
        console.error("[auth-init] profile verification failed", initError);
        if (mounted && !previewModeRef.current) {
          setAuthError(describeError(initError));
          void supabase.auth.signOut();
          clearAuthState();
          finishAuthLoad();
        }
      }
    };

    const bootInitialAuth = async () => {
      initialAuthCheckInFlightRef.current = true;

      try {
        console.info("[auth-init] client session check started");
        setIsAuthLoading(true);
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          "supabase.auth.getSession optimistic",
        );

        console.info("[auth-init] client session result", {
          hasUser: Boolean(sessionResult.data.session?.user),
        });

        if (sessionResult.error) {
          throw sessionResult.error;
        }

        if (sessionResult.data.session?.user) {
          await verifyAuthenticatedUser(sessionResult.data.session.user, "client-session");
          return;
        }

        const response = await withTimeout(
          fetch("/api/auth/session", { cache: "no-store" }),
          "server auth session fallback",
        );
        const responseText = await response.text();
        let payload: { error?: string | null; user?: User | null } = {};

        if (responseText.trim()) {
          try {
            payload = JSON.parse(responseText) as { error?: string | null; user?: User | null };
          } catch (parseError) {
            console.warn("[auth-init] server session fallback returned non-JSON payload", {
              parseError,
              status: response.status,
              responseText,
            });
          }
        }

        console.info("[auth-init] server session fallback result", {
          hasUser: Boolean(payload.user),
          status: response.status,
        });

        if (!response.ok) {
          throw new Error(payload.error ?? "Auth session check failed.");
        }

        if (payload.user) {
          await verifyAuthenticatedUser(payload.user, "server-session-fallback");
          return;
        }

        console.info("[auth-init] no session; showing login screen");
        clearAuthState();
        finishAuthLoad();
      } catch (sessionError) {
        console.error("[auth-init] session check failed", sessionError);
        if (!previewModeRef.current) {
          setAuthError(describeError(sessionError));
          clearAuthState();
        }
        finishAuthLoad();
      } finally {
        initialAuthCheckInFlightRef.current = false;
      }
    };

    void bootInitialAuth();

    if (!isSupabaseConfigured) {
      console.info("[auth-init] Supabase env missing; showing login/preview screen");
      clearAuthState();
      finishAuthLoad();
      return () => {
        mounted = false;
      };
    }

    let subscription = null;
    const {
      data: { subscription: sub },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.info("[auth-init] auth state changed", {
        event: _event,
        hasSession: Boolean(session),
      });

      if (_event === "INITIAL_SESSION") {
        return;
      }

      if (!session?.user) {
        if (initialAuthCheckInFlightRef.current) {
          console.info("[auth-init] ignoring no-session auth event during initial check", {
            event: _event,
          });
          return;
        }

        if (previewModeRef.current) {
          return;
        }

        clearAuthState();
        finishAuthLoad();
        return;
      }

      setAdminSessionRefreshNonce((current) => current + 1);

      void (async () => {
        try {
          setIsAuthLoading(true);
          authBootstrappedRef.current = false;
          setAuthBootstrapped(false);
          await verifyAuthenticatedUser(session.user, `auth-change:${_event}`);
        } catch (profileError) {
          console.error("[auth-init] profile fetch error after auth change", profileError);
          setAuthError(describeError(profileError));
          setIsLoggedIn(false);
          setAuthUserId(null);
        } finally {
          console.info("[auth-init] loading false after auth change");
          authBootstrappedRef.current = true;
          setAuthBootstrapped(true);
          setIsAuthLoading(false);
        }
      })();
    });
    subscription = sub;

    return () => {
      mounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unlockTimer = window.setTimeout(() => {
      const idsToUnlock = moodUnlocks
        .filter((unlock) => affection >= unlock.mood)
        .map((unlock) => unlock.id);
      const missingIds = idsToUnlock.filter(
        (id) => !unlockedGalleryIds.includes(id),
      );

      if (missingIds.length === 0) {
        return;
      }

      setUnlockedGalleryIds((current) => {
        const nextIds = new Set(current);
        missingIds.forEach((id) => nextIds.add(id));
        return Array.from(nextIds);
      });
      void persistGalleryUnlocks(missingIds).catch((error) => {
        console.error("Failed to persist automatic mood gallery unlocks", {
          missingIds,
          error,
        });
        setAuthError(describeError(error));
      });
    }, 0);

    return () => {
      window.clearTimeout(unlockTimer);
    };
  }, [affection, persistGalleryUnlocks, unlockedGalleryIds]);

  const scriptedMessage = useMemo(
    () =>
      isTimeoutActive
        ? "You angered Principessa. The vault is locked until your timeout ends."
        : getAffectionMoodLine(affection),
    [affection, isTimeoutActive],
  );

  const completeTask = async (taskId: string) => {
    // Set local for immediate feedback (affection milestones are also derived from current affection on rebuild).
    // Persist after; only on success path we consider confirmed. On persist fail, resync will rebuild
    // from affection (or row) so completed state stays consistent without "burn".
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, completed: true } : task,
      ),
    );
    if (isGuestMode) {
      return;
    }
    try {
      await persistTaskCompletion(taskId);
    } catch (error) {
      console.error("Failed to persist affection milestone completion", { taskId, error });
      void resyncAuthenticatedProfile(`Failed completeTask ${taskId}`).catch((resyncError) => {
        console.error("[profile-resync] after completeTask error", resyncError);
      });
    }
  };

  const handleTypingProgress = async (value: string) => {
    if (blockIfTimedOut()) {
      return;
    }

    const task = tasks.find((entry) => entry.id === "typing-accuracy");
    const typingCooldownActive =
      Boolean(task?.cooldownUntil) &&
      new Date(task?.cooldownUntil ?? "").getTime() > new Date().getTime();

    if (!task || typingCooldownActive || task.completed || !authUserId) {
      return;
    }

    const sentence = task.sentence ?? getDailyTypingSentence();

    if (!writingStartsWith(sentence, value)) {
      const actionId = "typing-accuracy";

      if (!beginTaskAction(actionId)) {
        return;
      }

      const nextAttempts = Math.max(0, (task.attemptsRemaining ?? 3) - 1);
      const failedAt = nextAttempts === 0 ? new Date().toISOString() : null;

      try {
        if (!isGuestMode) {
          await persistUserTask({
            task_id: task.id,
            completed_at: null,
            claimed_at: null,
            reward_coins: task.reward,
            metadata: {
              attemptsRemaining: nextAttempts,
              failedAt,
            },
          });
        }
      } catch (error) {
        console.error("Failed to persist typing attempt", error);
        emitSoundEvent("error");
        setAuthError(describeError(error));
        setAvatarMistressReply("The typing attempt failed to save. Try again.");
        return;
      } finally {
        finishTaskAction(actionId);
      }

      setTasks((current) =>
        current.map((entry) =>
          entry.id === task.id
            ? {
                ...entry,
                attemptsRemaining: nextAttempts,
                completed: false,
                claimed: nextAttempts === 0,
                cooldownUntil: failedAt ? getDailyCooldownUntil(failedAt) : null,
              }
            : entry,
        ),
      );
      setAvatarMistressReply(
        nextAttempts === 0
          ? "Game over, loser. You couldn't even handle simple sentences."
          : "Pathetic. You made a mistake. One heart lost.",
      );
      return;
    }

    if (writingEquals(sentence, value)) {
      const actionId = "typing-accuracy";

      if (!beginTaskAction(actionId)) {
        return;
      }

      try {
        if (!isGuestMode) {
          await persistUserTask({
            task_id: task.id,
            completed_at: new Date().toISOString(),
            claimed_at: null,
            reward_coins: task.reward,
            metadata: {
              attemptsRemaining: task.attemptsRemaining ?? 3,
            },
          });
        }
      } catch (error) {
        console.error("Failed to persist typing success", error);
        emitSoundEvent("error");
        setAuthError(describeError(error));
        setAvatarMistressReply("Perfect text, but the vault failed to save it. Try again.");
        return;
      } finally {
        finishTaskAction(actionId);
      }

      setTasks((current) =>
        current.map((entry) =>
          entry.id === task.id
            ? { ...entry, completed: true, claimed: false }
            : entry,
        ),
      );
      showTypingPraise();
      setAvatarMistressReply("Perfect. Principessa appreciates precision.");
    }
  };

  const scheduleHighLowDisplayRefresh = useCallback(() => {
    if (highLowRefreshTimerRef.current !== null) {
      window.clearTimeout(highLowRefreshTimerRef.current);
    }

  }, [getEventCooldownMs]);

  const handleHighLowPlay = async (
    guess: "higher" | "lower",
    stake: number,
  ) => {
    if (blockIfTimedOut()) {
      return;
    }
    const task = petTaskStateRef.current.find((entry) => entry.id === "high-low");
    const highLowCooldownMs = getEventCooldownMs(HIGH_LOW_REPLAY_COOLDOWN_MS);
    const highLowCooldownActive =
      Boolean(task?.cooldownUntil) &&
      new Date(task?.cooldownUntil ?? "").getTime() > new Date().getTime();
    const highLowLocked = Boolean(task?.highLowDailyLocked);

    if (!task || highLowCooldownActive || highLowLocked) {
      if (highLowLocked) {
        setAvatarMistressReply(
          `Higher or Lower ${HIGH_LOW_BET_ALLOWANCE.toLocaleString()} coin profit or bet allowance reached for today.`,
        );
      } else if (highLowCooldownActive) {
        setAvatarMistressReply(`Wait ${formatDuration(highLowCooldownMs)} before playing Higher or Lower again.`);
      }
      return;
    }

    if (!Number.isInteger(stake) || stake <= 0) {
      setAvatarMistressReply("Choose a real stake before testing the vault.");
      return;
    }

    const currentCoins = coinsRef.current;
    const highLowBetAllowance =
      task.highLowBetAllowance ?? getHighLowBetAllowance(task.highLowDailyBetTotal ?? 0);

    if (currentCoins < stake) {
      setAvatarMistressReply("Too few coins for that little gamble.");
      return;
    }

    if (stake > highLowBetAllowance) {
      setAvatarMistressReply(
        `Higher or Lower bet allowance left: ${highLowBetAllowance.toLocaleString()} coins. Lower the stake.`,
      );
      return;
    }

    const actionId = "high-low";

    if (!beginTaskAction(actionId)) {
      return;
    }

    const currentNumber = task.currentNumber ?? task.highLowNextNumber ?? randomHighLowDisplayNumber();
    setAvatarMistressReply("Rolling the vault number...");

    try {
        if (isGuestMode) {
        const resultNumber = randomHighLowNumber();
        const outcome =
          resultNumber === currentNumber
            ? "tie"
            : (guess === "higher" && resultNumber > currentNumber) ||
                (guess === "lower" && resultNumber < currentNumber)
              ? "win"
              : "loss";
        const coinDelta =
          outcome === "win"
            ? Math.floor(stake * (highLowWinMultiplier - 1))
            : outcome === "loss"
              ? -stake
              : -getHighLowTieFee(stake);
        const nextCoins = currentCoins + coinDelta;
        const nowDate = new Date();
        const now = nowDate.toISOString();
        const windowActive = Boolean(task.highLowResetAt && new Date(task.highLowResetAt).getTime() > nowDate.getTime());
        const highLowResetAt = windowActive ? task.highLowResetAt : getNextGmt3Reset(nowDate).toISOString();
        const nextBaseRevealAt = new Date(new Date().getTime() + getEventCooldownMs(10 * 1000)).toISOString();
        const allowanceCost = stake;
        const nextDailyBetTotal = Math.min(
          HIGH_LOW_BET_ALLOWANCE,
          (task.highLowDailyBetTotal ?? 0) + allowanceCost,
        );
        const nextBetAllowance = getHighLowBetAllowance(nextDailyBetTotal);
        const nextDailyProfit = (task.highLowDailyProfit ?? 0) + coinDelta;

        setCoins(nextCoins);
        coinsRef.current = nextCoins;
        setPetTaskStateOptimistic((current) =>
          current.map((entry) =>
            entry.id === task.id
              ? {
                  ...entry,
                  completed: true,
                  claimed: false,
                  cooldownUntil: getCooldownUntil(now, highLowCooldownMs),
                  currentNumber,
                  highLowDailyDate: getDailyKey(nowDate),
                  highLowDailyBetTotal: nextDailyBetTotal,
                  highLowDailyLocked: isHighLowLocked(nextDailyBetTotal, nextDailyProfit),
                  highLowDailyProfit: nextDailyProfit,
                  highLowDailyWins: (task.highLowDailyWins ?? 0) + (outcome === "win" ? 1 : 0),
                  highLowBetAllowance: nextBetAllowance,
                  highLowResetAt,
                  lastResult:
                    outcome === "tie"
                      ? `${currentNumber} -> ${resultNumber}. Tie. Play fee ${Math.abs(coinDelta)} coins kept. Next round is prepared server-side.`
                      : `${currentNumber} -> ${resultNumber}. ${outcome === "win" ? "Won" : "Lost"} ${Math.abs(coinDelta)} coins. Next round is prepared server-side.`,
                  nextBaseRevealAt,
                  resultBaseNumber: currentNumber,
                  resultCoinDelta: coinDelta,
                  resultNumber,
                  resultOutcome: outcome,
                }
              : entry,
          ),
        );
        scheduleHighLowDisplayRefresh();
        if (outcome === "win") {
          emitSoundEvent("task_completion");
        } else if (outcome === "loss") {
          emitSoundEvent("task_fail");
        }
        return;
        }

        const response = await fetch("/api/user/task-actions/high-low", {
          body: JSON.stringify({ guess, stake }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json()) as {
          error?: string;
          profile?: Profile;
          taskState?: Partial<TaskItem>;
        };

        if (!response.ok || !payload.profile || !payload.taskState) {
          throw createApiError("/api/user/task-actions/high-low", response, payload);
        }

        applyProfileStats(payload.profile);
        setPetTaskStateOptimistic((current) =>
          current.map((entry) =>
            entry.id === task.id
              ? ({
                  ...entry,
                  ...payload.taskState,
                } as PetTaskItem)
              : entry,
          ),
        );

        scheduleHighLowDisplayRefresh();

        const outcome = payload.taskState.resultOutcome;
        setAvatarMistressReply(
          outcome === "tie"
            ? `A tie. The vault kept a ${Math.abs(payload.taskState.resultCoinDelta ?? 0)} coin play fee.`
            : outcome === "win"
              ? highLowWinMultiplier > 2
                ? "Event luck. The vault boosted your winning payout."
                : "A lucky guess. The vault pays your win."
              : "Wrong. The vault keeps that stake.",
        );
        if (outcome === "win") {
          emitSoundEvent("task_completion");
        } else if (outcome === "loss") {
          emitSoundEvent("task_fail");
        }
    } catch (error) {
      console.error("Failed to complete high-low play", error);
      emitSoundEvent("error");
      setAuthError(describeError(error));
      setAvatarMistressReply("The Higher or Lower ledger failed. Resyncing the vault state.");
      void resyncAuthenticatedProfile("Failed to complete high-low play").catch((resyncError) => {
        console.error("[profile-resync] failed after high-low error", resyncError);
      });
    } finally {
      finishTaskAction(actionId);
    }
  };

  const handleNumberPick = async (selectedNumber: number) => {
    if (blockIfTimedOut()) {
      return;
    }
    const task = tasks.find((entry) => entry.id === "number-pick");
    const isCoolingDown =
      Boolean(task?.cooldownUntil) &&
      new Date(task?.cooldownUntil ?? "").getTime() > new Date().getTime();

    if (!task || isCoolingDown || !authUserId) {
      return;
    }

    const options =
      task.numberPickOptions && task.numberPickOptions.length === 3
        ? task.numberPickOptions
        : generateNumberPickOptions();

    if (!options.includes(selectedNumber)) {
      return;
    }

    if ((task.numberPickWrongSelections ?? []).includes(selectedNumber)) {
      return;
    }

    const currentCoins = coinsRef.current;
    const actionId = "number-pick";

    if (!beginTaskAction(actionId)) {
      return;
    }

    setAvatarMistressReply("Checking that number with the vault...");

    try {
        if (isGuestMode) {
        const existingCorrect = task.numberPickCorrect;
        const correctNumber = typeof existingCorrect === "number" ? existingCorrect : randomFrom(options);
        const previousWrongSelections = task.numberPickWrongSelections ?? [];
        const attemptsRemaining = task.numberPickAttemptsRemaining ?? 2;
        const isCorrect = selectedNumber === correctNumber;
        const baseReward = isCorrect ? (attemptsRemaining >= 2 ? 100 : 50) : 0;
        const reward = baseReward > 0 ? getEventTaskReward(baseReward) : 0;
        const nextAttemptsRemaining = isCorrect ? 0 : Math.max(0, attemptsRemaining - 1);
        const finalAttempt = isCorrect || nextAttemptsRemaining === 0;
        const result: "win" | "loss" | null = finalAttempt ? (isCorrect ? "win" : "loss") : null;
        const wrongSelections = isCorrect
          ? previousWrongSelections
          : Array.from(new Set([...previousWrongSelections, selectedNumber]));
        const cooldownUntil = getDailyGmt3CooldownUntil(new Date());

        if (reward > 0) {
          const nextCoins = coinsRef.current + reward;
          setCoins(nextCoins);
          coinsRef.current = nextCoins;
        }

        setTasks((current) =>
          current.map((entry) =>
            entry.id === task.id
              ? {
                  ...entry,
                  claimed: finalAttempt,
                  completed: result === "win",
                  cooldownUntil: finalAttempt ? cooldownUntil : entry.cooldownUntil,
                  numberPickAttemptsRemaining: nextAttemptsRemaining,
                  numberPickCorrect: correctNumber,
                  numberPickOptions: options,
                  numberPickResult: result,
                  numberPickSelected: selectedNumber,
                  numberPickWrongSelections: wrongSelections,
                }
              : entry,
          ),
        );
        setAvatarMistressReply(
          result === "win"
            ? `Lucky pick. The vault grants you ${reward} coins.`
            : result === "loss"
              ? "Wrong again. The vault gives you nothing today."
              : "Wrong number. One chance remains.",
        );
        if (finalAttempt) {
          emitSoundEvent(result === "loss" ? "task_fail" : "task_completion");
        }
        return;
        }

        const response = await fetch("/api/user/task-actions/number-pick", {
          body: JSON.stringify({ options, selectedNumber }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json()) as {
          error?: string;
          profile?: Profile;
          taskState?: Partial<TaskItem>;
        };

        if (!response.ok || !payload.profile || !payload.taskState) {
          throw createApiError("/api/user/task-actions/number-pick", response, payload);
        }

        applyProfileStats(payload.profile);
        setTasks((current) =>
          current.map((entry) =>
            entry.id === task.id
              ? {
                  ...entry,
                  ...payload.taskState,
                }
              : entry,
          ),
        );

        const result = payload.taskState.numberPickResult;
        const rewardDelta =
          typeof payload.profile.coins === "number" ? payload.profile.coins - currentCoins : 0;

        setAvatarMistressReply(
          result === "win"
            ? `Lucky pick. The vault grants you ${Math.max(0, rewardDelta)} coins.`
            : result === "loss"
              ? "Wrong again. The vault gives you nothing today."
              : "Wrong number. One chance remains.",
        );
        if (result === "win" || result === "loss") {
          emitSoundEvent(result === "loss" ? "task_fail" : "task_completion");
        }
    } catch (error) {
      console.error("Failed to complete number pick task", error);
      emitSoundEvent("error");
      setAuthError(describeError(error));
      setAvatarMistressReply("Number Pick could not be saved. Resyncing the vault state.");
      void resyncAuthenticatedProfile("Failed to complete number pick task").catch((resyncError) => {
        console.error("[profile-resync] failed after number-pick error", resyncError);
      });
    } finally {
      finishTaskAction(actionId);
    }
  };

  const handleWaitObedientlyStart = async () => {
    if (blockIfTimedOut()) {
      return;
    }

    const task = tasks.find((entry) => entry.id === "wait-obediently");
    const isCoolingDown =
      Boolean(task?.cooldownUntil) &&
      new Date(task?.cooldownUntil ?? "").getTime() > Date.now();

    if (!task || isCoolingDown || !authUserId) {
      return;
    }

    const actionId = "wait-obediently";

    if (!beginTaskAction(actionId)) {
      return;
    }

    const now = new Date();
    const countdownEndsAt = new Date(now.getTime() + 3 * 1000).toISOString();
    const waitEndsAt = new Date(now.getTime() + 63 * 1000).toISOString();
    const cooldownUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    try {
      if (!isGuestMode) {
        await persistUserTask({
          task_id: task.id,
          completed_at: now.toISOString(),
          claimed_at: now.toISOString(),
          reward_coins: 0,
          metadata: {
            countdownEndsAt,
            status: "countdown",
            waitEndsAt,
          },
        });
      }
    } catch (error) {
      console.error("Failed to start wait obediently task", error);
      emitSoundEvent("error");
      setAuthError(describeError(error));
      setAvatarMistressReply("Wait Obediently failed to start safely. Try again.");
      void resyncAuthenticatedProfile("Failed wait start").catch((resyncError) => {
        console.error("[profile-resync] failed after wait start error", resyncError);
      });
      finishTaskAction(actionId);
      return;
    }

    setTasks((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              claimed: true,
              completed: false,
              cooldownUntil,
              waitCountdownEndsAt: countdownEndsAt,
              waitEndsAt,
              waitState: "countdown",
            }
          : entry,
      ),
    );
    setAvatarMistressReply("Now wait. One mistake and the vault closes.");
    finishTaskAction(actionId);
  };

  const handleWaitObedientlyFail = async () => {
    const task = tasks.find((entry) => entry.id === "wait-obediently");

    if (!task || !authUserId) {
      return;
    }

    const actionId = "wait-obediently:fail";

    if (!beginTaskAction(actionId)) {
      return;
    }

    try {
      if (!isGuestMode) {
        await persistUserTask({
          task_id: task.id,
          completed_at: new Date().toISOString(),
          claimed_at: new Date().toISOString(),
          reward_coins: 0,
          metadata: {
            status: "failed",
          },
        });
      }
    } catch (error) {
      console.error("Failed to fail wait obediently task", error);
      emitSoundEvent("error");
      setAuthError(describeError(error));
      setAvatarMistressReply("The fail state could not be saved. Resyncing the vault state.");
      void resyncAuthenticatedProfile("Failed wait fail state").catch((resyncError) => {
        console.error("[profile-resync] failed after wait fail error", resyncError);
      });
      finishTaskAction(actionId);
      return;
    }

    setTasks((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              completed: false,
              waitState: "failed",
            }
          : entry,
      ),
    );
    setAvatarMistressReply("You moved. Failed.");
    emitSoundEvent("task_fail");
    finishTaskAction(actionId);
  };

  const handleWaitObedientlyComplete = async () => {
    const task = tasks.find((entry) => entry.id === "wait-obediently");

    if (!task || !authUserId) {
      return;
    }

    const actionId = "wait-obediently";

    if (!beginTaskAction(actionId)) {
      return;
    }

    const rewardCoins = getEventTaskReward(task.reward);
    const nextCoins = coinsRef.current + rewardCoins;
    try {
      // Reward first via profile-progress; on success the route performs server-side task state
      // (completed/claimed/status) as side-effect. Only then do we mark local cooldown/completed.
      // If this fails, no reward and no completed_at/claimed_at is written.
      await persistProfileProgress(
        { coins: nextCoins, affection },
        "task:wait-obediently",
      );
    } catch (error) {
      console.error("Failed to complete wait obediently task", error);
      emitSoundEvent("error");
      setAuthError(describeError(error));
      setAvatarMistressReply("Wait Obediently reward failed to save. Resyncing the vault state.");
      void resyncAuthenticatedProfile("Failed to complete wait obediently").catch((resyncError) => {
        console.error("[profile-resync] failed after wait complete error", resyncError);
      });
      finishTaskAction(actionId);
      return;
    }

    setCoins(nextCoins);
    coinsRef.current = nextCoins;
    setTasks((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              completed: true,
              waitState: "completed",
            }
          : entry,
      ),
    );
    setAvatarMistressReply("Task completed. How cute. The pathetic loser can actually follow simple orders.");
    emitSoundEvent("task_completion");
    finishTaskAction(actionId);
  };

  const handleTimeoutRiskMultiplierChange = useCallback((direction: "up" | "down") => {
    setTasks((current) =>
      current.map((entry) =>
        entry.id === "timeout-risk"
          ? {
              ...entry,
              timeoutRiskMultiplier: Math.min(
                3,
                Math.max(1, (entry.timeoutRiskMultiplier ?? 1) + (direction === "up" ? 1 : -1)),
              ),
            }
          : entry,
      ),
    );
  }, []);

  const handleTimeoutRisk = async (multiplier: number) => {
    if (blockIfTimedOut()) {
      return;
    }

    if (!authUserId || !Number.isInteger(multiplier) || multiplier < 1 || multiplier > 3) {
      return;
    }

    const nowMs = Date.now();
    const activeTimeoutUntil = timeoutUntil && new Date(timeoutUntil).getTime() > nowMs
      ? timeoutUntil
      : null;
    if (timeoutRiskProjectedDays > MAX_TIMEOUT_DAYS) {
      setAvatarMistressReply("Maximum timeout reached. The risk table refuses you.");
      return;
    }

    const actionId = "timeout-risk";

    if (!beginTaskAction(actionId)) {
      return;
    }

    try {
      if (isGuestMode) {
        const hitTimeout = Math.random() < TIMEOUT_RISK_CHANCE;
        const activeTask = tasks.find((entry) => entry.id === "timeout-risk");
        const currentSafeWins = activeTask?.safeWinsToday ?? 0;
        const resetAt = getNextGmt3Reset().toISOString();

        if (currentSafeWins >= TIMEOUT_RISK_DAILY_SAFE_LIMIT) {
          setAvatarMistressReply("You already survived twice today. The risk table is closed.");
          return;
        }

        if (hitTimeout) {
          const timeoutMs = TIMEOUT_RISK_TIMEOUT_MS * multiplier;
          const baseMs = activeTimeoutUntil
            ? Math.max(new Date(activeTimeoutUntil).getTime(), nowMs)
            : nowMs;
          const nextTimeoutUntil = new Date(baseMs + timeoutMs).toISOString();
          timeoutUntilRef.current = nextTimeoutUntil;
          setTimeoutUntil(nextTimeoutUntil);
          setCurrentTime(Date.now());
          setTasks((current) =>
            current.map((entry) =>
              entry.id === "timeout-risk"
                ? {
                    ...entry,
                    lastResult: `Timeout hit. +${timeoutMs / (60 * 60 * 1000)} hours added.`,
                    safeWinsToday: currentSafeWins,
                    timeoutRiskMultiplier: multiplier,
                    timeoutUntil: nextTimeoutUntil,
                  }
                : entry.id === "irl-task-wheel"
                  ? { ...entry, timeoutUntil: nextTimeoutUntil }
                  : entry,
            ),
          );
          setAvatarMistressReply(`Bad roll. ${timeoutMs / (60 * 60 * 1000)} hours of timeout have been added.`);
          emitSoundEvent("task_fail");
          return;
        }

        const nextSafeWins = currentSafeWins + 1;
        const rewardCoins = eventSafeReward * multiplier;
        setCoins((current) => current + rewardCoins);
        coinsRef.current += rewardCoins;
        setTasks((current) =>
          current.map((entry) =>
            entry.id === "timeout-risk"
              ? {
                  ...entry,
                  claimed: nextSafeWins >= TIMEOUT_RISK_DAILY_SAFE_LIMIT,
                  completed: nextSafeWins >= TIMEOUT_RISK_DAILY_SAFE_LIMIT,
                  cooldownUntil: nextSafeWins >= TIMEOUT_RISK_DAILY_SAFE_LIMIT ? resetAt : entry.cooldownUntil,
                  lastResult: `Safe wins today: ${nextSafeWins}/${TIMEOUT_RISK_DAILY_SAFE_LIMIT}`,
                  safeWinsToday: nextSafeWins,
                  timeoutRiskMultiplier: multiplier,
                }
              : entry,
          ),
        );
        setAvatarMistressReply(`Safe roll. ${rewardCoins} coins added.`);
        emitSoundEvent("task_completion");
        return;
      }

      const response = await fetch("/api/user/task-actions/timeout-risk", {
        body: JSON.stringify({ multiplier }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        hitTimeout?: boolean;
        multiplier?: number;
        profile?: Profile;
        rewardCoins?: number;
        task?: UserTaskRow;
        timeoutUntil?: string;
      } | null;

      if (!response.ok || !payload?.profile || !payload.task) {
        throw createApiError("/api/user/task-actions/timeout-risk", response, payload ?? {});
      }

      applyProfileStats(payload.profile);
      const nextMultiplier = payload.multiplier ?? multiplier;
      const nextTimeoutUntil = payload.timeoutUntil ?? payload.profile.timeout_until ?? null;
      const safeWins = getTaskMetadataNumber(payload.task.metadata, "safeWins", 0);
      const cooldownUntil = safeWins >= TIMEOUT_RISK_DAILY_SAFE_LIMIT
        ? getTaskMetadataString(payload.task.metadata, "resetAt")
        : null;

      if (payload.hitTimeout) {
        const baseMs = activeTimeoutUntil
          ? Math.max(new Date(activeTimeoutUntil).getTime(), nowMs)
          : nowMs;
        timeoutUntilRef.current = nextTimeoutUntil;
        setTimeoutUntil(nextTimeoutUntil);
        setCurrentTime(Date.now());
        setTasks((current) =>
          current.map((entry) =>
            entry.id === "timeout-risk"
              ? {
                  ...entry,
                  claimed: false,
                  completed: false,
                  cooldownUntil: null,
                  lastResult: getTaskMetadataString(payload.task?.metadata, "lastResult") ?? "Timeout hit.",
                  safeWinsToday: safeWins,
                  timeoutRiskMultiplier: nextMultiplier,
                  timeoutUntil: nextTimeoutUntil,
                }
              : entry.id === "irl-task-wheel"
                ? { ...entry, timeoutUntil: nextTimeoutUntil }
                : entry,
          ),
        );
        setAvatarMistressReply(
          getTaskMetadataString(payload.task.metadata, "lastResult") ?? "Bad roll. Timeout has been added.",
        );
        emitSoundEvent("task_fail");
        return;
      }

      setTasks((current) =>
        current.map((entry) =>
          entry.id === "timeout-risk"
            ? {
                ...entry,
                claimed: safeWins >= TIMEOUT_RISK_DAILY_SAFE_LIMIT,
                completed: safeWins >= TIMEOUT_RISK_DAILY_SAFE_LIMIT,
                lastResult:
                  getTaskMetadataString(payload.task?.metadata, "lastResult") ??
                  `Safe wins today: ${safeWins}/${TIMEOUT_RISK_DAILY_SAFE_LIMIT}`,
                safeWinsToday: safeWins,
                cooldownUntil,
                timeoutRiskMultiplier: nextMultiplier,
              }
            : entry,
        ),
      );
      setAvatarMistressReply(`Safe roll. ${payload.rewardCoins ?? eventSafeReward * nextMultiplier} coins added.`);
      emitSoundEvent("task_completion");
    } catch (error) {
      console.error("Failed to complete timeout-risk task", error);
      emitSoundEvent("error");
      setAuthError(describeError(error));
      setAvatarMistressReply("The risk ledger failed. Try again.");
      void resyncAuthenticatedProfile("Failed timeout-risk").catch((resyncError) => {
        console.error("[profile-resync] failed after timeout-risk error", resyncError);
      });
    } finally {
      finishTaskAction(actionId);
    }
  };

  const handleLevelDrain = async () => {
    if (blockIfTimedOut()) {
      return;
    }

    const actionId = "level-drain";

    if (!beginTaskAction(actionId)) {
      return;
    }

    try {
      const response = await fetch("/api/user/level-drain", { method: "POST" });
      const payload = (await response.json()) as {
        error?: string;
        result?: {
          globalLevel?: number;
          globalLevelUp?: boolean;
          globalXp?: number;
          newUserLevel?: number;
          transferredXp?: number;
          userXp?: number;
        };
      };

      if (!response.ok || !payload.result) {
        throw createApiError("/api/user/level-drain", response, payload);
      }

      const result = payload.result;
      setUserLevel(result.newUserLevel ?? userLevel);
      setUserXp(result.userXp ?? userXp);
      setGlobalPrincipessa((current) => ({
        ...current,
        level: result.globalLevel ?? current.level,
        updated_at: new Date().toISOString(),
        xp: result.globalXp ?? current.xp,
      }));
      const now = Date.now();
      if (now - lastAddingXpBubbleAtRef.current >= 8000) {
        lastAddingXpBubbleAtRef.current = now;
        setSpeechBubbleReply(
          getSpeechBubbleResponseMessage(
            resolveSpeechAvatarIdForMessage(),
            "adding_xp",
            "Your sacrifice feeds my growth.",
          ),
        );
      }
      emitSoundEvent("task_completion");

      if (result.globalLevelUp) {
        window.setTimeout(() => {
          setSpeechBubbleReply(
            getSpeechBubbleResponseMessage(
              resolveSpeechAvatarIdForMessage(),
              "level_up",
              "I can feel my power growing.",
            ),
          );
        }, 1400);
      }

      void resyncAuthenticatedProfile("Level Drain completed").catch((error) => {
        console.error("[profile-resync] failed after level drain", error);
      });
      // Keep the freshly drained global XP/level visible immediately on the client.
      // Backend re-sync can arrive later through the normal poller without overwriting
      // the optimistic UI with briefly stale read-model data.
    } catch (error) {
      console.error("Level Drain failed", error);
      emitSoundEvent("error");
      setAuthError(describeError(error));
    } finally {
      finishTaskAction(actionId);
    }
  };

  const handleRightsAction = async (action: "buy" | "use") => {
    if (blockIfTimedOut()) {
      return;
    }

    const actionId = `rights:${action}`;

    if (!beginPetAction(actionId)) {
      return;
    }

    try {
      const response = await fetch("/api/user/rights", {
        body: JSON.stringify({ action }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        result?: {
          coins?: number;
          dailyPurchaseCount?: number;
          price?: number;
          rightExpirations?: string[];
          rightPurchaseDate?: string | null;
          storedRights?: number;
        };
      };

      if (!response.ok || !payload.result) {
        throw createApiError("/api/user/rights", response, payload);
      }

      const result = payload.result;
      if (typeof result.coins === "number") {
        setCoins(result.coins);
        coinsRef.current = result.coins;
      }
      setStoredRights(result.storedRights ?? storedRights);
      setRightExpirations(Array.isArray(result.rightExpirations) ? result.rightExpirations : rightExpirations);
      setDailyPurchaseCount(result.dailyPurchaseCount ?? dailyPurchaseCount);
      setRightPurchaseDate(result.rightPurchaseDate ?? rightPurchaseDate);
      setAvatarMistressReply(
        action === "buy"
          ? `Right purchased. ${result.price ?? 0} coins spent.`
          : "Right used.",
      );
      emitSoundEvent(action === "buy" ? "cosmetic_purchased" : "task_completion");
      void resyncAuthenticatedProfile(`Rights ${action}`).catch((error) => {
        console.error("[profile-resync] failed after rights action", error);
      });
    } catch (error) {
      console.error("Rights action failed", error);
      emitSoundEvent("error");
      setAuthError(describeError(error));
      setAvatarMistressReply(describeError(error));
    } finally {
      finishPetAction(actionId);
    }
  };

  const handleIrlTaskSpin = async (wheelIndex: number, useFreeFridaySpin = isFreeFridaySpinAvailable) => {
    if (blockIfTimedOut()) {
      return;
    }

    if (!authUserId) {
      return;
    }

    const task = tasks.find((entry) => entry.id === "irl-task-wheel");
    const timeoutActive =
      Boolean(task?.timeoutUntil) &&
      new Date(task?.timeoutUntil ?? "").getTime() > Date.now();
    const hasActiveAssignment = Boolean(task?.assignedIrlTask);

    if (timeoutActive) {
      setAvatarMistressReply("Timeout is active. The wheel is not available yet.");
      return;
    }

    if (hasActiveAssignment) {
      setAvatarMistressReply("Finish your assigned task first. The wheel is locked until admin review.");
      return;
    }

    const currentCoins = coinsRef.current;
    const wheelCost = useFreeFridaySpin ? 0 : IRL_TASK_WHEEL_COST;

    if (currentCoins < wheelCost) {
      setAvatarMistressReply(`The wheel costs ${IRL_TASK_WHEEL_COST} coins. Come back richer.`);
      return;
    }

    const assignedTask = irlTaskWheelSegments[wheelIndex];

    if (!assignedTask) {
      console.error("Invalid IRL wheel index", { wheelIndex });
      setAvatarMistressReply("The wheel landed outside the vault. Try again.");
      return;
    }

    const actionId = "irl-task-wheel";

    if (!beginTaskAction(actionId)) {
      return;
    }

    try {
      let assignedIrlTask = {
        due_at: new Date(Date.now() + getRandomIrlTaskDurationMinutes() * 60 * 1000).toISOString(),
        penalty_timeout_minutes: getRandomIrlTaskPenaltyMinutes(),
        status: "assigned",
        task_description: assignedTask.description,
        task_label: assignedTask.title,
        wheel_index: wheelIndex,
      };

      if (isGuestMode) {
        const nextCoins = currentCoins - wheelCost;
        setCoins(nextCoins);
        coinsRef.current = nextCoins;
      } else {
        const response = await fetch("/api/user/irl-task-wheel", {
          body: JSON.stringify({ wheelIndex }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const result = (await response.json()) as {
          assignment?: {
            due_at: string | null;
            penalty_timeout_minutes: number | null;
            status: string | null;
            task_description: string | null;
            task_label: string;
            wheel_index: number;
          };
          code?: string;
          freeFridayAvailable?: boolean;
          error?: string;
          profile?: Profile;
        };

        if (!response.ok) {
          throw createApiError("/api/user/irl-task-wheel", response, result);
        }

        if (!result.profile || !result.assignment) {
          throw new Error("IRL wheel endpoint returned no assignment.");
        }

        applyProfileStats(result.profile);
        setFreeFridaySpinAvailable(Boolean(result.freeFridayAvailable));
        assignedIrlTask = {
          due_at: result.assignment.due_at ?? assignedIrlTask.due_at,
          penalty_timeout_minutes: result.assignment.penalty_timeout_minutes ?? assignedIrlTask.penalty_timeout_minutes,
          status: result.assignment.status ?? "assigned",
          task_description: result.assignment.task_description ?? assignedTask.description,
          task_label: result.assignment.task_label,
          wheel_index: result.assignment.wheel_index,
        };
      }

      setTasks((current) =>
        current.map((entry) =>
          entry.id === "irl-task-wheel"
            ? {
                ...entry,
                assignedIrlTask: assignedIrlTask.task_label,
                assignedIrlTaskDescription: assignedIrlTask.task_description,
                assignedIrlTaskStatus: assignedIrlTask.status,
                assignedIrlWheelIndex: assignedIrlTask.wheel_index,
                assignedIrlDueAt: assignedIrlTask.due_at,
                assignedIrlPenaltyMinutes: assignedIrlTask.penalty_timeout_minutes,
                completed: true,
              }
            : entry,
        ),
      );
      setAvatarMistressReply("Task assigned. DM @VMPrincipessa when it is done.");
      emitSoundEvent("task_completion");
    } catch (error) {
      console.error("Failed to spin IRL task wheel", error);
      if (useFreeFridaySpin) {
        setFreeFridaySpinAvailable(true);
      }
      emitSoundEvent("error");
      setAuthError(describeError(error));
      setAvatarMistressReply("The task wheel jammed. Try again.");
    } finally {
      finishTaskAction(actionId);
    }
  };

  const handleBeg = async () => {
    if (blockIfTimedOut()) {
      return;
    }
    if (!authUserId) {
      return;
    }

    const cooldownActive =
      Boolean(displayMechanics.begCooldownUntil) &&
      new Date(displayMechanics.begCooldownUntil ?? "").getTime() > new Date().getTime();

    if (cooldownActive) {
      return;
    }

    const actionId = "beg";

    if (!beginTaskAction(actionId)) {
      return;
    }

    const now = new Date().toISOString();
      const reward = randomChance(0.07) ? eventBegReward : 0;

      try {
        // Always go through profile-progress for beg (even 0-reward): the route validates
        // cooldown/delta then on success does the server-side task row side-effect (lastBegAt etc).
        // This ensures state (cooldown) is only recorded if/after the action "grant" (0 or +) succeeds.
        // Pre-persist removed to prevent marking cooldown without the (profile) grant path succeeding.
        if (!isGuestMode) {
          await persistProfileProgress(
            { coins: coinsRef.current + reward, affection },
            "beg",
          );
        }

      setMechanics((current) => ({
        ...current,
        begCooldownUntil: getCooldownUntil(now, getEventCooldownMs(60 * 1000)),
      }));
      setAvatarMistressReply(
        reward > 0
          ? `${randomFrom(begRewardLines)} +${reward} coins.`
          : randomFrom(begIgnoredLines),
      );
      emitSoundEvent(reward > 0 ? "task_completion" : "task_fail");
    } catch (error) {
      console.error("Failed to complete beg mechanic", error);
      emitSoundEvent("error");
      setAuthError(describeError(error));
      setAvatarMistressReply("The vault ignored the request. Try again.");
      void resyncAuthenticatedProfile("Failed to complete beg").catch((resyncError) => {
        console.error("[profile-resync] failed after beg error", resyncError);
      });
    } finally {
      finishTaskAction(actionId);
    }
  };

  const handleSacrifice = async () => {
    if (blockIfTimedOut()) {
      return;
    }
    if (!authUserId || displayMechanics.sacrificeComplete) {
      return;
    }

    const cooldownActive =
      Boolean(displayMechanics.sacrificeCooldownUntil) &&
      new Date(displayMechanics.sacrificeCooldownUntil ?? "").getTime() > new Date().getTime();

    if (cooldownActive) {
      return;
    }

    if (coinsRef.current < SACRIFICE_COST) {
      setAvatarMistressReply(
        `The sacrifice requires ${SACRIFICE_COST} coins. Principessa is not impressed.`,
      );
      return;
    }

    const remainingItems = sacrificeGalleryItems.filter(
      (item) => !unlockedGalleryIds.includes(item.id),
    );

    if (remainingItems.length === 0) {
      setMechanics((current) => ({
        ...current,
        sacrificeComplete: true,
      }));
      setAvatarMistressReply("The Sacrifice Collection is already complete.");
      return;
    }

    const actionId = "sacrifice";

    if (!beginTaskAction(actionId)) {
      return;
    }

    const now = new Date().toISOString();
    const won = randomChance(SACRIFICE_UNLOCK_CHANCE);
    const unlockedItem = won ? randomFrom(remainingItems) : null;
    const nextCoins = coinsRef.current - SACRIFICE_COST;
    const nextTributeTotal = getNextTributeTotal(SACRIFICE_COST);
    const lastResult = unlockedItem
      ? `Unlocked ${unlockedItem.title}.`
      : "The offering burned away.";

    try {
      await persistProfileProgress(
        { coins: nextCoins, affection, tribute_total: nextTributeTotal },
        "tribute:sacrifice",
        {
          prestigeSource: "sacrifice",
          spendAmount: SACRIFICE_COST,
        },
      );
      if (unlockedItem) {
        await persistGalleryUnlocks([unlockedItem.id]);
        setUnlockedGalleryIds((current) =>
          current.includes(unlockedItem.id) ? current : [...current, unlockedItem.id],
        );
      }

      if (!isGuestMode) {
        await persistUserTask({
            task_id: "sacrifice",
            completed_at: now,
            claimed_at: unlockedItem ? now : null,
            reward_coins: unlockedItem ? 1 : 0,
            metadata: {
              won,
              unlockedItemId: unlockedItem?.id ?? null,
              lastResult,
            },
          });
      }

      setMechanics((current) => ({
        ...current,
        sacrificeCooldownUntil: unlockedItem
          ? getCooldownUntil(now, getEventCooldownMs(SACRIFICE_SUCCESS_COOLDOWN_MS))
          : null,
        sacrificeLastResult: lastResult,
      }));
      setAvatarMistressReply(
        unlockedItem
          ? `${randomFrom(sacrificeSuccessLines)} ${unlockedItem.title} joins the collection.`
          : randomFrom(sacrificeFailureLines),
      );
      emitSoundEvent(unlockedItem ? "gallery_unlock" : "tribute_sent");
      emitSoundEvent(unlockedItem ? "task_completion" : "task_fail");
    } catch (error) {
      console.error("Failed to complete sacrifice mechanic", error);
      emitSoundEvent("error");
      setAuthError(describeError(error));
      setAvatarMistressReply("The sacrifice ledger failed. Try again.");
      void resyncAuthenticatedProfile("Failed sacrifice").catch((resyncError) => {
        console.error("[profile-resync] failed after sacrifice error", resyncError);
      });
    } finally {
      finishTaskAction(actionId);
    }
  };

  const handleSupport = async () => {
    if (blockIfTimedOut()) {
      return;
    }
    if (!authUserId || !displayMechanics.supportUnlocked) {
      return;
    }

    if (coinsRef.current < SUPPORT_COST) {
      setAvatarMistressReply(`Support costs ${SUPPORT_COST} coins. The vault waits.`);
      return;
    }

    const actionId = "support";

    if (!beginTaskAction(actionId)) {
      return;
    }

    const now = new Date().toISOString();
    const message = randomFrom(supportLines);

    try {
      await persistProfileProgress(
        {
          coins: coinsRef.current - SUPPORT_COST,
          affection,
          tribute_total: getNextTributeTotal(SUPPORT_COST),
        },
        "tribute:support",
        {
          prestigeSource: "support",
          spendAmount: SUPPORT_COST,
        },
      );
      if (!isGuestMode) {
        await persistUserTask({
            task_id: "support",
            completed_at: now,
            reward_coins: -SUPPORT_COST,
            metadata: {
              lastUsedAt: now,
              lastResult: message,
            },
          });
      }

      setMechanics((current) => ({
        ...current,
        supportLastResult: message,
      }));
      setAvatarMistressReply(message);
      emitSoundEvent("tribute_sent");
      emitSoundEvent("task_completion");
    } catch (error) {
      console.error("Failed to complete support mechanic", error);
      emitSoundEvent("error");
      setAuthError(describeError(error));
      setAvatarMistressReply("The support ledger failed. Try again.");
      void resyncAuthenticatedProfile("Failed support").catch((resyncError) => {
        console.error("[profile-resync] failed after support error", resyncError);
      });
    } finally {
      finishTaskAction(actionId);
    }
  };

  const handleRebrandProfile = async () => {
    if (blockIfTimedOut()) {
      return;
    }

    if (isGuestMode) {
      setAvatarMistressReply("Preview mode cannot edit an X profile.");
      return;
    }

    if (!authUserId) {
      setAvatarMistressReply("Sign in with X before requesting a profile rebrand.");
      return;
    }

    const actionId = "rebrand-profile";

    if (!beginTaskAction(actionId)) {
      return;
    }

    setAvatarMistressReply("Opening X authorization for the rebrand...");
    finishTaskAction(actionId);
    window.location.href = "/api/user/rebrand-x/start";
  };

  const handleSignInWithX = async () => {
    let oauthRedirectStarted = false;

    setIsAuthBusy(true);
    setAuthError("");
    authBootstrappedRef.current = false;
    setAuthBootstrapped(false);
    setIsProfileVerified(false);
    setIsProfileLoading(true);
    setHasHydratedInitialProfile(false);
    setIsAuthLoading(true);
    setIsPreviewMode(false);
    setIsGuestMode(false);
    previewModeRef.current = false;
    authProfileLoadedRef.current = null;

    try {
      if (!isSupabaseConfigured) {
        throw new Error("Supabase env is missing locally. Preview Mode still works without local env.");
      }

      console.info("Starting Supabase OAuth", {
        provider: "x",
        redirectTo: `${window.location.origin}/auth/callback`,
      });

      const result = await supabase.auth.signInWithOAuth({
        // Temporary Supabase provider-id test for the new "X / Twitter" dashboard label.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        provider: "x" as any,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (result.error) {
        throw result.error;
      }

      oauthRedirectStarted = true;
    } catch (error) {
      console.error("Supabase X OAuth sign-in failed", error);
      setAuthError(
        error instanceof Error
          ? error.message
          : "X sign-in failed. Check Supabase OAuth settings.",
      );
    } finally {
      if (!oauthRedirectStarted) {
        authBootstrappedRef.current = true;
        setAuthBootstrapped(true);
        setIsProfileLoading(false);
        setHasHydratedInitialProfile(false);
        setIsAuthBusy(false);
        setIsAuthLoading(false);
      }
    }
  };

  const seedRichLocalTestData = useCallback(() => {
    authProfileLoadInFlightRef.current = null;
    authProfileLoadedRef.current = null;
    setAuthError("");
    authBootstrappedRef.current = true;
    setAuthBootstrapped(true);
    setIsProfileLoading(false);
    setHasHydratedInitialProfile(true);
    setIsAuthBusy(false);
    setIsAuthLoading(false);
    setIsGuestMode(true);
    setIsLoggedIn(true);
    profileIdRef.current = null;
    setIsDebtAutoPayEnabled(readDebtAutoPayEnabled(LOCAL_GUEST_USER_ID));
    setTimeoutUntil(null);
    setTimeoutReason(null);
    timeoutUntilRef.current = null;
    timeoutReasonRef.current = null;
    setUnlockedGalleryIds([]);
    setPetScore(0);
    setPetUnlockedAt(null);
    setLastPetTaxAt(null);
    setPetDebtContract(null);
    setPetAffectionClaimDate(null);
    setPetGalleryUnlockedIds([]);
    setLoyaltyStreak(0);
    setLastLoyaltyAt(null);

    setOwnerLikeness(100);
    setEquippedAvatarSlots({ fullBody: "classic" });
    committedEquippedRef.current = { fullBody: "classic" };
    setHasUncensoredAvatar(false);
    setOwnedCosmeticIds([DEFAULT_SPEECH_AVATAR_ID]);
    setEquippedCosmeticIds({ "speech-avatar": DEFAULT_SPEECH_AVATAR_ID });

    // Seed rich crates + full inventory immediately for avatar testing
    const seededCrates: CrateDefinition[] = Object.entries(CRATE_TYPES)
      .filter(([, def]) => (def as any).enabled !== false)
      .map(([crate_type, def]) => ({
        crate_type,
        name: def.name,
        description: def.description,
        cost: def.cost,
        icon_url: getCrateIconUrl(crate_type, (def as any).icon_url ?? null) ?? undefined,
      }))
      .sort((a, b) => a.cost - b.cost);
    const seededInventory: CrateInventoryItem[] = Object.entries(SAMPLE_CRATE_ITEMS).map(
      ([item_id, def]) => ({
        item_id,
        name: def.name,
        description: def.description || "",
        image_url: null,
        rarity: def.rarity,
        collection: def.collection || null,
        sell_value: def.sell_value || 0,
        variant: "normal",
        quantity: 50,
      }),
    );
    setAvailableCrates(seededCrates);
    setCrateInventory(seededInventory);
    setCrateFreeOpensUsedToday({});
    setPityStats({ principessa_bad_luck: 0, blessing_legendary_pity: 0 });
  }, [
    CRATE_TYPES,
    LOCAL_GUEST_USER_ID,
    SAMPLE_CRATE_ITEMS,
    getCrateIconUrl,
    readDebtAutoPayEnabled,
    sacrificeGalleryItems,
    setAuthError,
  ]);

  const handleEnterPreviewMode = useCallback(() => {
    seedRichLocalTestData();
    setIsProfileVerified(false);
    setIsPreviewMode(true);
    previewModeRef.current = true;
    setAuthUserId(null);
    setUsername("@preview");
    setDisplayName("Preview User");
    setCoins(0);
    setAffection(0);
    setTributeTotal(0);
    setLifetimeSpentCoins(0);
    setLoyaltyStreak(0);
    setLastLoyaltyAt(null);
    setUnlockedGalleryIds([]);
    setPetScore(0);
    setPetUnlockedAt(null);
    setLastPetTaxAt(null);
    setPetDebtContract(null);
    setPetAffectionClaimDate(null);
    setPetGalleryUnlockedIds([]);
    setOwnedTitleIds(["leadership-0"]);
    setEquippedTitleId("leadership-0");
    setIsTitleManuallySelected(false);
    setTasks(buildTasksFromRows([], 0, 0, null, null, null));
    setPetTaskState(buildPetTasksFromRows([]));
    setMechanics({
      supportUnlocked: false,
      sacrificeUnlockedCount: 0,
      sacrificeTotal: sacrificeGalleryItems.length,
      sacrificeComplete: false,
      allGalleryComplete: false,
    });
    setJackpot(null);
    setJackpotError("");

    setActivePanel("profile");
    setAvatarMistressReply("Preview Mode (test). Full inventory + cases seeded. Use Profile tab for avatar layers.");
    resetViewportScroll();
  }, [resetViewportScroll, seedRichLocalTestData, setAvatarMistressReply]);

  const handleLogout = async () => {
    if (!isGuestMode) {
      await supabase.auth.signOut();
    }
    authProfileLoadInFlightRef.current = null;
    authProfileLoadedRef.current = null;
    authBootstrappedRef.current = true;
    setAuthBootstrapped(true);
    setIsProfileVerified(false);
    setIsProfileLoading(false);
    setHasHydratedInitialProfile(false);
    setIsGuestMode(false);
    setIsPreviewMode(false);
    previewModeRef.current = false;
    setIsLoggedIn(false);
    setAuthUserId(null);
    setDisplayName(null);
    setUsername("@littledevotee");
    profileIdRef.current = null;
    setUnlockedGalleryIds([]);
    setTasks([]);
    setLeadershipTop([]);
    setShameTop([]);
    setTopTributes([]);
    setJackpot(null);
    setJackpotError("");
    setIsAdminUser(false);
    setPendingIrlReviewCount(0);
    setCoins(100);
    setAffection(0);
    setLastLoyaltyAt(null);
    setTributeTotal(0);
    setLifetimeSpentCoins(0);
    setPetScore(0);
    setOwnerLikeness(100);
    setPetUnlockedAt(null);
    setLastPetTaxAt(null);
    setPetDebtContract(null);
    setIsDebtAutoPayEnabled(false);
    setPetTaskState(petTasks);
    setPetAffectionClaimDate(null);
    setPetGalleryUnlockedIds([]);
    setEquippedAvatarSlots({});
    setHasUncensoredAvatar(false);
    setOwnedCosmeticIds([DEFAULT_SPEECH_AVATAR_ID]);
    setEquippedCosmeticIds({ "speech-avatar": DEFAULT_SPEECH_AVATAR_ID });
    setOwnedTitleIds(["leadership-0"]);
    setEquippedTitleId("leadership-0");
    setIsTitleManuallySelected(false);
    setCrateInventory([]);
    setAvatarMistressReply("Back at the gate. The vault can wait.");
    resetViewportScroll();
  };

  const handleTribute = async (amount: number) => {
    if (blockIfTimedOut()) {
      return;
    }
    const actionId = `tribute:${amount}`;

    if (!beginTaskAction(actionId)) {
      return;
    }

    if (affection >= 100) {
      setAvatarMistressReply(
        "My mood is already at its peak. Your coins can wait.",
      );
      finishTaskAction(actionId);
      return;
    }

    const currentCoins = coinsRef.current;

    if (currentCoins < amount) {
      setAvatarMistressReply(
        "Too poor for that one? How predictable.",
      );
      finishTaskAction(actionId);
      return;
    }

    const tributeGains: Record<number, number> = {
      250: 1,
      1000: 5,
      5000: 30,
    };
    const affectionGain = getEventTributeAffection(tributeGains[amount] ?? 0);

    const nextAffection = Math.min(100, affection + affectionGain);
    const nextCoins = currentCoins - amount;
    const nextTributeTotal = getNextTributeTotal(amount);

    try {
      await persistProfileProgress(
        {
          coins: nextCoins,
          affection: nextAffection,
          tribute_total: nextTributeTotal,
        },
        "tribute:coin-offer",
        {
          prestigeSource: "tribute-panel",
          spendAmount: amount,
          affectionGain,
        },
      );
      if (!isGuestMode && nextAffection >= 100 && !petUnlockedAt && authUserId) {
        const now = new Date().toISOString();
        try {
          await persistPetProfilePatch(
            {
            pet_unlocked_at: now,
            last_owner_likeness_at: now,
            last_pet_tax_at: now,
            owner_likeness: 100,
            },
            "pet:unlock",
          );
          setPetUnlockedAt(now);
          setLastPetTaxAt(now);
          setOwnerLikeness(100);
        } catch (petUnlockError) {
          console.error("Failed to persist Pet unlock", petUnlockError);
        }
      }
    } catch (error) {
      console.error("Failed to persist tribute progress", error);
      setAuthError(describeError(error));
      setAvatarMistressReply("The ledger refused that tribute. Try again.");
      finishTaskAction(actionId);
      return;
    }

    setTributeTotal(nextTributeTotal);
    emitSoundEvent("tribute_sent");
    if (nextAffection > affection) {
      setAffectionStageRevealToken((current) => current + 1);
      emitSoundEvent("affection_level_up");
    }
    if (nextAffection >= 50) {
      void completeTask("affection");
    }
    if (nextAffection >= 80) {
      void completeTask("affection-80");
    }
    setAvatarMistressReply(
      amount >= 5000
        ? "You emptied a big part of your wallet. I like this level of desperation."
        : amount >= 1000
          ? "Pathetic. You call that a tribute?"
          : "That tiny amount? You’re not even a real paypig, just a joke.",
    );
    finishTaskAction(actionId);
  };

  const handleJackpotContribute = async (amount: number) => {
    if (blockIfTimedOut()) {
      return;
    }

    if (isGuestMode || isPreviewMode || !authUserId) {
      setAvatarMistressReply("Sign in to join the Loyalty Jackpot.");
      return;
    }

    if (!Number.isInteger(amount) || amount < JACKPOT_MIN_CONTRIBUTION) {
      setAvatarMistressReply(
        `Jackpot contributions require at least ${JACKPOT_MIN_CONTRIBUTION.toLocaleString()} coins.`,
      );
      return;
    }

    if (coinsRef.current < amount) {
      setAvatarMistressReply("Not enough coins for the jackpot pool.");
      return;
    }

    setIsJackpotBusy(true);
    setJackpotError("");

    try {
      const response = await fetch("/api/jackpot", {
        body: JSON.stringify({ amount }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        coins?: number;
        jackpot?: LoyaltyJackpotState;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Jackpot contribution failed.");
      }

      if (typeof payload.coins === "number") {
        setCoins(payload.coins);
      }

      setJackpot(payload.jackpot ?? null);
      emitSoundEvent("jackpot_contribution");
      setAvatarMistressReply(`Your ${amount.toLocaleString()} coins were added to the jackpot pool.`);
    } catch (error) {
      console.error("Failed to contribute to jackpot", error);
      const message = describeError(error);
      setJackpotError(message);
      setAvatarMistressReply(message);
    } finally {
      setIsJackpotBusy(false);
    }
  };

  const handleUnlock = async (itemId: string) => {
    if (blockIfTimedOut()) {
      return;
    }
    const item = visibleGalleryItems.find((entry) => entry.id === itemId);

    if (!item || item.rarity !== "Common" || unlockedGalleryIds.includes(item.id)) {
      return;
    }

    const currentCoins = coinsRef.current;

    const unlockCost = item.unlockCost ?? 300;

    if (currentCoins < unlockCost) {
      setAvatarMistressReply(
        "Too poor for that one? How lame.",
      );
      return;
    }

    const actionId = `gallery:${item.id}`;

    if (!beginTaskAction(actionId)) {
      return;
    }

    const nextCoins = currentCoins - unlockCost;

    try {
      await persistProfileProgress(
        { coins: nextCoins, affection },
        "spend:gallery-unlock",
        {
          itemId: item.id,
          spendAmount: unlockCost,
        },
      );
      await persistGalleryUnlocks([item.id]);
    } catch (error) {
      console.error("Failed to persist gallery unlock progress", error);
      setAuthError(describeError(error));
      setAvatarMistressReply("The vault ledger rejected that unlock. Try again.");
      finishTaskAction(actionId);
      return;
    }

    setUnlockedGalleryIds((current) =>
      current.includes(item.id) ? current : [...current, item.id],
    );
    emitSoundEvent("gallery_unlock");
    setAvatarMistressReply(
      "You unlocked a little more of my attention.",
    );
    finishTaskAction(actionId);
  };

  const handlePurchaseCosmetic = async (item: CosmeticItem) => {
    if (blockIfTimedOut()) {
      return;
    }

    // display-name-change is now purchased normally like other items to grant a change right.
    // The right is used from the Profile tab via the pencil icon.

    if (item.price <= 0 || ownedCosmeticIds.includes(item.id)) {
      await handleEquipCosmetic(item);
      return;
    }

    if (!authUserId) {
      return;
    }

    if (coinsRef.current < item.price) {
      setAvatarMistressReply("Not enough coins for that cosmetic.");
      return;
    }

    const actionId = `cosmetic:${item.id}`;

    if (!beginTaskAction(actionId)) {
      return;
    }

    try {
      if (isGuestMode) {
        await persistProfileProgress(
          { coins: coinsRef.current - item.price, affection },
          "spend:cosmetic",
          {
            cosmeticId: item.id,
            cosmeticType: item.type,
            spendAmount: item.price,
            tributeTotalChanged: false,
          },
        );
      } else {
        const response = await fetch("/api/user/cosmetics", {
          body: JSON.stringify({ action: "purchase", itemId: item.id }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json()) as {
          alreadyOwned?: boolean;
          error?: string;
          profile?: Profile;
        };

        if (!response.ok) {
          throw createApiError("/api/user/cosmetics", response, payload);
        }

        if (payload.profile) {
          applyProfileStats(payload.profile);
        }
      }

      setOwnedCosmeticIds((current) =>
        current.includes(item.id) ? current : [...current, item.id],
      );
      emitSoundEvent("cosmetic_purchased");
      setAvatarMistressReply(`${item.name} purchased. Cosmetic spend counts toward all time coin spendings, not tribute total.`);
      finishTaskAction(actionId);
    } catch (error) {
      console.error("Failed to purchase cosmetic", error);
      setAuthError(describeError(error));
      setAvatarMistressReply("The cosmetic ledger failed. Try again.");
      finishTaskAction(actionId);
    }
  };

  const handleEquipCosmetic = async (item: CosmeticItem) => {
    if (blockIfTimedOut()) {
      return;
    }

    const hasTemporaryEventAccess =
      item.type === "speech-avatar" &&
      item.id === eventSpeechAvatarId &&
      Boolean(speechAvatarEvent);
    const ownsCosmetic = ownedCosmeticIds.includes(item.id) || item.price <= 0;

    if (!ownsCosmetic && item.price > 0 && !hasTemporaryEventAccess) {
      return;
    }

    if (hasTemporaryEventAccess && !ownsCosmetic && speechAvatarEvent) {
      setTemporarySpeechAvatar({
        avatarId: item.id,
        eventId: speechAvatarEvent.id,
      });
      setDismissedSpeechAvatarEventId(null);
      setAvatarMistressReply(`${item.name} equipped for today's event.`);
      return;
    }

    if (!authUserId) {
      return;
    }

    const actionId = `cosmetic:${item.id}`;

    if (!beginTaskAction(actionId)) {
      return;
    }

    try {
      if (item.type === "speech-avatar" && speechAvatarEvent) {
        setTemporarySpeechAvatar(null);
        if (item.id !== eventSpeechAvatarId) {
          setDismissedSpeechAvatarEventId(speechAvatarEvent.id);
        }
      }

      if (!isGuestMode) {
        const response = await fetch("/api/user/cosmetics", {
          body: JSON.stringify({ action: "equip", itemId: item.id }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw createApiError("/api/user/cosmetics", response, payload);
        }
      }

      setOwnedCosmeticIds((current) =>
        current.includes(item.id) ? current : [...current, item.id],
      );
      setEquippedCosmeticIds((current) => ({ ...current, [item.type]: item.id }));
      setAvatarMistressReply(`${item.name} equipped.`);
      finishTaskAction(actionId);
    } catch (error) {
      console.error("Failed to equip cosmetic", error);
      setAuthError(describeError(error));
      setAvatarMistressReply("The cosmetic equip failed. Try again.");
      finishTaskAction(actionId);
    }
  };

  const handlePurchaseTitle = async (title: TitleItem) => {
    if (blockIfTimedOut()) {
      return;
    }

    if (ownedTitleIds.includes(title.id)) {
      await handleEquipTitle(title);
      return;
    }

    const price = title.price ?? 0;

    if (!authUserId || price <= 0) {
      return;
    }

    if (coinsRef.current < price) {
      setAvatarMistressReply("Not enough coins for that title.");
      return;
    }

    const actionId = `title:${title.id}`;

    if (!beginTaskAction(actionId)) {
      return;
    }

    try {
      if (isGuestMode) {
        await persistProfileProgress(
          { coins: coinsRef.current - price, affection },
          "spend:title",
          {
            spendAmount: price,
            titleId: title.id,
            tributeTotalChanged: false,
          },
        );
      } else {
        const response = await fetch("/api/user/titles", {
          body: JSON.stringify({ action: "purchase", titleId: title.id }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json()) as {
          alreadyOwned?: boolean;
          error?: string;
          profile?: Profile;
        };

        if (!response.ok) {
          throw createApiError("/api/user/titles", response, payload);
        }

        if (payload.profile) {
          applyProfileStats(payload.profile);
        }
      }

      setOwnedTitleIds((current) =>
        current.includes(title.id) ? current : [...current, title.id],
      );
      setAvatarMistressReply(`${title.name} title purchased.`);
      finishTaskAction(actionId);
    } catch (error) {
      console.error("Failed to purchase title", error);
      setAuthError(describeError(error));
      setAvatarMistressReply("The title ledger failed. Try again.");
      finishTaskAction(actionId);
    }
  };

  const handleEquipTitle = async (title: TitleItem) => {
    if (blockIfTimedOut()) {
      return;
    }

    if (!ownedTitleIds.includes(title.id)) {
      return;
    }

    if (!authUserId) {
      return;
    }

    const actionId = `title:${title.id}`;

    if (!beginTaskAction(actionId)) {
      return;
    }

    try {
      if (!isGuestMode) {
        const response = await fetch("/api/user/titles", {
          body: JSON.stringify({ action: "equip", titleId: title.id }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw createApiError("/api/user/titles", response, payload);
        }
      }

      setEquippedTitleId(title.id);
      setIsTitleManuallySelected(true);
      setOwnedTitleIds((current) =>
        current.includes(title.id) ? current : [...current, title.id],
      );
      setAvatarMistressReply(`${title.name} title equipped.`);
      finishTaskAction(actionId);
    } catch (error) {
      console.error("Failed to equip title", error);
      setAuthError(describeError(error));
      setAvatarMistressReply("The title equip failed. Try again.");
      finishTaskAction(actionId);
    }
  };

  const handleClaimTask = async (taskId: string) => {
    if (blockIfTimedOut()) {
      return;
    }

    const task = tasks.find((entry) => entry.id === taskId);

    if (!task) {
      return;
    }

    const currentCoins = coinsRef.current;
    let rewardCoins = getEventTaskReward(task.reward);
    const nextCoins = currentCoins + rewardCoins;
    let confirmedCoins = nextCoins;
    const dailyCooldownActive =
      task.id === "daily-login" &&
      Boolean(task.cooldownUntil) &&
      new Date(task.cooldownUntil ?? "").getTime() > Date.now();

    if (!task.completed || (task.claimed && task.id !== "daily-login") || dailyCooldownActive) {
      if (task.id === "typing-accuracy") {
        setAvatarMistressReply("Finish the typing task before claiming the reward.");
      }
      return;
    }

    const actionId = `claim:${taskId}`;

    if (!beginTaskAction(actionId)) {
      return;
    }

    try {
      if (isGuestMode) {
        const streakBonus = STREAK_BONUSES.find((bonus) => bonus.id === task.id);

        await persistTaskClaim(task);
        await persistProfileProgress(
          { coins: nextCoins, affection },
          streakBonus ? "streak_bonus" : `reward:task:${task.id}`,
          streakBonus
            ? {
                milestone: streakBonus.milestone,
                taskId: task.id,
              }
            : {},
        );
      } else {
        const response = await fetch("/api/user/task-claim", {
          body: JSON.stringify({ taskId: task.id }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json()) as {
          error?: string;
          profile?: Profile;
          rewardCoins?: number;
          task?: UserTaskRow;
        };

        if (!response.ok || !payload.profile) {
          throw createApiError("/api/user/task-claim", response, payload);
        }

        rewardCoins = payload.rewardCoins ?? rewardCoins;
        confirmedCoins = payload.profile.coins;
        applyProfileStats(payload.profile);
      }
    } catch (error) {
      console.error("Failed to persist task reward", error);
      emitSoundEvent("error");
      setAuthError(describeError(error));
      setAvatarMistressReply("The reward failed to save. Resyncing the vault state.");
      void resyncAuthenticatedProfile("Failed to persist task reward").catch((resyncError) => {
        console.error("[profile-resync] failed after task claim error", resyncError);
      });
      finishTaskAction(actionId);
      return;
    }

    setCoins(confirmedCoins);
    coinsRef.current = confirmedCoins;
    setTasks((current) =>
      current.map((entry) =>
        entry.id === taskId
          ? {
              ...entry,
              claimed: true,
              completed:
                taskId === "daily-login" || taskId === "typing-accuracy"
                  ? false
                  : entry.completed,
              cooldownUntil:
                taskId === "daily-login" || taskId === "typing-accuracy"
                  ? getDailyCooldownUntil(new Date().toISOString())
                  : entry.cooldownUntil,
            }
          : entry,
      ),
    );
    emitSoundEvent("task_completion");
    setAvatarMistressReply(
      `Fine. ${rewardCoins} coins added. Spend them carefully.`,
    );
    finishTaskAction(actionId);
  };

  const handleClaimLoyaltyRewards = async () => {
    if (blockIfTimedOut() || claimableLoyaltyBonuses.length === 0 || isLoyaltyClaimPending) {
      return;
    }

    setIsLoyaltyClaimPending(true);

    try {
      if (isGuestMode) {
        const totalReward = claimableLoyaltyBonuses.reduce(
          (sum, bonus) => sum + getEventTaskReward(bonus.reward),
          0,
        );
        setCoins((current) => current + totalReward);
        coinsRef.current += totalReward;
        setTasks((current) =>
          current.map((entry) =>
            entry.id.startsWith("streak-bonus-") && entry.completed && !entry.claimed
              ? { ...entry, claimed: true }
              : entry,
          ),
        );
        setAvatarMistressReply(`Loyalty rewards claimed. +${totalReward} coins.`);
        emitSoundEvent("task_completion");
        return;
      }

      const response = await fetch("/api/user/loyalty-claim", {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        claimedBonuses?: Array<{ id: string; milestone: number; reward: number }>;
        profile?: Profile;
        totalReward?: number;
      } | null;

      if (!response.ok || !payload?.profile) {
        throw createApiError("/api/user/loyalty-claim", response, payload ?? {});
      }

      applyProfileStats(payload.profile);
      const claimedIds = new Set((payload.claimedBonuses ?? []).map((bonus) => bonus.id));
      setTasks((current) =>
        current.map((entry) =>
          claimedIds.has(entry.id)
            ? { ...entry, claimed: true }
            : entry,
        ),
      );
      setAvatarMistressReply(
        `Loyalty rewards claimed. +${payload.totalReward ?? 0} coins.`,
      );
      emitSoundEvent("task_completion");
    } catch (error) {
      console.error("Failed to claim loyalty rewards", error);
      setAuthError(describeError(error));
      setAvatarMistressReply("Loyalty claim failed. Try again.");
      emitSoundEvent("error");
    } finally {
      setIsLoyaltyClaimPending(false);
    }
  };

  const handlePetTaskComplete = async (taskId: string) => {
    if (blockIfTimedOut()) {
      return;
    }

    if (!isPetUnlocked) {
      setAvatarMistressReply("Principessa's Pet is locked.");
      return;
    }

    const task = petTaskState.find((entry) => entry.id === taskId);
    const coolingDown =
      Boolean(task?.cooldownUntil) &&
      new Date(task?.cooldownUntil ?? "").getTime() > Date.now();

    if (!task || coolingDown || task.status === "pending") {
      return;
    }

    if (task.kind !== "review") {
      setAvatarMistressReply("This Pet task has its own rules. Use its task controls.");
      return;
    }

    const now = new Date().toISOString();

    if (!isGuestMode && authUserId) {
      try {
        await persistPetTask(
        {
          task_id: task.id,
          completed_at: now,
          reward_score: task.reward,
          status: "pending",
          metadata: {},
        },
        );
      } catch (error) {
        console.error("Failed to persist pet task", error);
        setAuthError(describeError(error));
        return;
      }
    }

    setPetTaskStateOptimistic((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              completedAt: now,
              cooldownUntil: getPetTaskCooldownUntil(now),
              status: "pending",
            }
          : entry,
      ),
    );
    setAvatarMistressReply(
      isGuestMode
        ? "Guest Pet task submitted for review. Pet Score waits for approval."
        : "Pet task submitted for admin review.",
    );
  };

  const handlePetPerfectWritingProgress = async (value: string) => {
    if (blockIfTimedOut()) {
      return;
    }

    const task = petTaskStateRef.current.find((entry) => entry.id === "pet-perfect-writing");
    const coolingDown =
      Boolean(task?.cooldownUntil) &&
      new Date(task?.cooldownUntil ?? "").getTime() > Date.now();
    const sentence = task?.sentence ?? getDailyPetPerfectWritingSentence();

    if (!task || coolingDown || task.status === "pending") {
      return;
    }

    if (!writingStartsWith(sentence, value)) {
      const now = new Date().toISOString();
      const actionId = "pet-perfect-writing";

      if (!beginPetAction(actionId)) {
        return;
      }

      if (!isGuestMode && authUserId) {
        try {
          await persistPetTask(
          {
            task_id: task.id,
            completed_at: now,
            reward_score: task.reward,
            status: "failed",
            reviewed_at: now,
            metadata: {
              attemptsRemaining: 0,
              failedAt: now,
            },
          },
          );
        } catch (error) {
          console.error("Failed to persist Pet perfect writing failure", error);
          emitSoundEvent("error");
          setAuthError(describeError(error));
          finishPetAction(actionId);
          return;
        }
      }

      setPetTaskStateOptimistic((current) =>
        current.map((entry) =>
          entry.id === task.id
            ? {
                ...entry,
                attemptsRemaining: 0,
                completedAt: now,
                cooldownUntil: getPetTaskCooldownUntil(now),
                status: "failed",
              }
            : entry,
        ),
      );
      setAvatarMistressReply("One mistake. Start over tomorrow.");
      emitSoundEvent("task_fail");
      finishPetAction(actionId);
      return;
    }

    if (!writingEquals(sentence, value)) {
      return;
    }

    const now = new Date().toISOString();
    const nextPetScore = Math.min(1000, petScore + task.reward);
    const actionId = "pet-perfect-writing";

    if (!beginPetAction(actionId)) {
      return;
    }

    if (!isGuestMode && authUserId) {
      try {
        await persistPetProfilePatch(
          { coins: coinsRef.current + eventPetTaskCoinReward, pet_score: nextPetScore },
          "reward:pet-perfect-writing",
        );
      } catch (error) {
        emitSoundEvent("error");
        setAuthError(describeError(error));
        void resyncAuthenticatedProfile("Failed pet perfect writing reward").catch(() => {});
        finishPetAction(actionId);
        return;
      }

      try {
        await persistPetTask(
        {
          task_id: task.id,
          completed_at: now,
          reward_score: task.reward,
          status: "approved",
          reviewed_at: now,
          metadata: {
            attemptsRemaining: 1,
          },
        },
        );
      } catch (error) {
        console.error("Failed to persist Pet perfect writing success", error);
        emitSoundEvent("error");
        setAuthError(describeError(error));
        void resyncAuthenticatedProfile("Failed pet perfect writing state").catch(() => {});
        finishPetAction(actionId);
        return;
      }
    } else {
      setPetScore(nextPetScore);
    }

    setPetTaskStateOptimistic((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              attemptsRemaining: 1,
              completedAt: now,
              cooldownUntil: getPetTaskCooldownUntil(now),
              reviewedAt: now,
              status: "approved",
            }
          : entry,
      ),
    );
    setAvatarMistressReply(`Perfect. +${task.reward} Pet Score, +${eventPetTaskCoinReward} coins.`);
    emitSoundEvent("task_completion");
    finishPetAction(actionId);
  };

  const handlePetConfessionSubmit = async (
    value: string,
    options: { cheated?: boolean } = {},
  ) => {
    if (blockIfTimedOut()) {
      return;
    }

    const task = petTaskStateRef.current.find((entry) => entry.id === "pet-confession-dm");
    const coolingDown =
      Boolean(task?.cooldownUntil) &&
      new Date(task?.cooldownUntil ?? "").getTime() > new Date().getTime();
    const sentence = task?.sentence ?? getDailyPetConfessionSentence();

    if (!task || coolingDown) {
      return;
    }

    if (options.cheated) {
      const avatarId = resolveSpeechAvatarIdForMessage();
      setAvatarMistressReply(
        getSpeechBubbleResponseMessage(avatarId, "cheat", "Trying to cheat your confession? Pathetic."),
      );
      return;
    }

    if (!writingEquals(sentence, value)) {
      setAvatarMistressReply("Exact words only. Start that line again.");
      return;
    }

    const now = new Date().toISOString();
    const nextCount = Math.min(5, (task.confessionCount ?? 0) + 1);
    const completed = nextCount >= 5;
    const nextPetScore = completed ? Math.min(1000, petScore + task.reward) : petScore;

    if (!isGuestMode && authUserId) {
      if (completed) {
        try {
          await persistPetProfilePatch(
            { coins: coinsRef.current + eventPetTaskCoinReward, pet_score: nextPetScore },
            "reward:pet-confession",
          );
        } catch (error) {
          setAuthError(describeError(error));
          void resyncAuthenticatedProfile("Failed pet confession reward").catch(() => {});
          return;
        }
      }

      try {
        const savedTask = await persistPetTask(
        {
          task_id: task.id,
          completed_at: completed ? now : null,
          reward_score: task.reward,
          status: completed ? "approved" : "available",
          reviewed_at: completed ? now : null,
          metadata: {
            count: nextCount,
          },
        },
        );

        const savedCount = getTaskMetadataNumber(savedTask.metadata, "count", nextCount);
        if (savedCount !== nextCount) {
          console.warn("Pet confession saved count mismatch", { expected: nextCount, saved: savedCount });
        }
      } catch (error) {
        console.error("Failed to persist Pet confession progress", error);
        setAuthError(describeError(error));
        void resyncAuthenticatedProfile("Failed pet confession state").catch(() => {});
        return;
      }
    } else if (completed) {
      setPetScore(nextPetScore);
    }

    setPetTaskStateOptimistic((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              completedAt: completed ? now : entry.completedAt,
              confessionCount: nextCount,
              cooldownUntil: completed ? getPetTaskCooldownUntil(now) : entry.cooldownUntil,
              reviewedAt: completed ? now : entry.reviewedAt,
              status: completed ? "approved" : "available",
            }
          : entry,
      ),
    );
    setAvatarMistressReply(
      completed
        ? `Confession accepted. +${task.reward} Pet Score, +${eventPetTaskCoinReward} coins.`
        : `Good. ${nextCount}/5 confessions complete.`,
    );
    if (completed) {
      emitSoundEvent("task_completion");
    }
  };

  const handlePetWeeklyTax = async () => {
    if (blockIfTimedOut()) {
      return;
    }

    const task = petTaskStateRef.current.find((entry) => entry.id === "pet-weekly-throne-tax");
    const coolingDown =
      Boolean(task?.cooldownUntil) &&
      new Date(task?.cooldownUntil ?? "").getTime() > Date.now();

    if (!task || coolingDown) {
      return;
    }

    const weeklyTaxCost = getPetWeeklyTaxCost(coinsRef.current);

    if (coinsRef.current < weeklyTaxCost) {
      setAvatarMistressReply(`Weekly tax requires ${weeklyTaxCost} Principessa Coins.`);
      return;
    }

    const now = new Date().toISOString();
    const nextCoins = coinsRef.current - weeklyTaxCost;
    const nextPetScore = Math.min(1000, petScore + task.reward);

    if (!isGuestMode && authUserId) {
      try {
        await persistPetProfilePatch(
          {
            coins: nextCoins,
            pet_score: nextPetScore,
            last_pet_tax_at: now,
          },
          "spend:pet-weekly-tax",
          {
            spendAmount: weeklyTaxCost,
            rewardCoins: 0,
          },
        );
      } catch (error) {
        setAuthError(describeError(error));
        return;
      }

      try {
        await persistPetTask(
        {
          task_id: task.id,
          completed_at: now,
          reward_score: task.reward,
          status: "approved",
          reviewed_at: now,
          metadata: {
            cost: weeklyTaxCost,
          },
        },
        );
      } catch (error) {
        console.error("Failed to persist Pet weekly tax", error);
        setAuthError(describeError(error));
        return;
      }
    } else {
      setCoins(nextCoins);
      setPetScore(nextPetScore);
      setLastPetTaxAt(now);
    }

    setPetTaskStateOptimistic((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              completedAt: now,
              cooldownUntil: getCooldownUntil(now, WEEK_MS),
              reviewedAt: now,
              status: "approved",
            }
          : entry,
      ),
    );
    setAvatarMistressReply(`Weekly tax accepted. -${weeklyTaxCost} Coins, +${task.reward} Pet Score.`);
  };

  const handleDebtContractSign = async ({
    consentPrimary,
    consentPrimaryText,
    consentSecondary,
    consentSecondaryText,
    contractType = "normal",
    debtAmount,
    durationPeriods,
    age,
    fullName,
    customNote,
    imageUrls,
    periodType,
    petName,
    randomGenerated = false,
    timezone,
  }: {
    consentPrimary?: boolean;
    consentPrimaryText?: string;
    consentSecondary?: boolean;
    consentSecondaryText?: string;
    contractType?: "normal" | "evil";
    debtAmount: number;
    durationPeriods: number;
    age?: number | string;
    fullName?: string;
    customNote?: string;
    imageUrls?: string[];
    periodType: "weekly" | "monthly";
    petName: string;
    randomGenerated?: boolean;
    timezone?: string;
  }) => {
    if (blockIfTimedOut()) {
      return false;
    }

    const cleanAmount = Math.floor(debtAmount);
    const cleanDuration = Math.floor(durationPeriods);
    const cleanPetName = petName.trim();
    const baseMinimum = periodType === "weekly" ? 10000 : 50000;
    const minimum = contractType === "evil" ? (periodType === "weekly" ? 50000 : 200000) : baseMinimum;
    const amountStep = contractType === "evil" ? 5000 : periodType === "weekly" ? 5000 : 10000;
    const baseDurationLimit =
      periodType === "weekly"
        ? { label: "weeks", max: 52, min: 1 }
        : { label: "months", max: 24, min: 1 };
    const durationLimit = {
      ...baseDurationLimit,
      min: contractType === "evil" ? Math.ceil(baseDurationLimit.min * 2.5) : baseDurationLimit.min,
    };
    const cleanCustomNote = String(customNote ?? "").trim();
    const cleanAge = Math.floor(Number(age));

    if (petDebtContract && ["active", "pending"].includes(petDebtContract.status)) {
      return false;
    }

    if (cleanPetName.length < 2) {
      setAvatarMistressReply("Choose a clear Pet name before signing.");
      return false;
    }

    if (contractType === "evil") {
      if (!fullName?.trim() || !timezone?.trim() || !Number.isInteger(cleanAge) || cleanAge < 1) {
        setAvatarMistressReply("Evil Debt Contract requires full name, age, and timezone.");
        return false;
      }

      if (!EVIL_DEBT_TIMEZONE_OPTIONS.has(timezone.trim())) {
        setAvatarMistressReply("Timezone must be selected from UTC-12 to UTC+12.");
        return false;
      }

      if (cleanCustomNote.length > 240) {
        setAvatarMistressReply("Custom note must be 240 characters or fewer.");
        return false;
      }

      if (
        consentPrimaryText?.trim() !== EVIL_CONSENT_PRIMARY_TEXT ||
        consentSecondaryText?.trim() !== EVIL_CONSENT_SECONDARY_TEXT
      ) {
        setAvatarMistressReply("Both Evil Debt Contract consent confirmations must match exactly.");
        return false;
      }

      if (!imageUrls || imageUrls.length < 1 || imageUrls.length > 8) {
        setAvatarMistressReply("Evil Debt Contract requires 1-8 uploaded images.");
        return false;
      }
    }

    if (
      !Number.isInteger(cleanAmount) ||
      cleanAmount < minimum ||
      cleanAmount % amountStep !== 0
    ) {
        setAvatarMistressReply(
          periodType === "weekly"
          ? `${contractType === "evil" ? "Evil weekly" : "Weekly"} debt must be at least ${minimum.toLocaleString()} coins and a multiple of ${amountStep.toLocaleString()}.`
          : `${contractType === "evil" ? "Evil monthly" : "Monthly"} debt must be at least ${minimum.toLocaleString()} coins and a multiple of ${amountStep.toLocaleString()}.`,
      );
      return false;
    }

    if (
      !Number.isInteger(cleanDuration) ||
      cleanDuration < durationLimit.min ||
      cleanDuration > durationLimit.max
    ) {
      setAvatarMistressReply(
        `Contract duration must be between ${durationLimit.min} and ${durationLimit.max} ${durationLimit.label}.`,
      );
      return false;
    }

    if (!authUserId) {
      return false;
    }

    if (!isGuestMode && authUserId) {
      try {
        const result = await persistDebtContractAction({
          action: "sign",
          consentPrimary,
          consentPrimaryText,
          consentSecondary,
          consentSecondaryText,
          contractType,
          debtAmount: cleanAmount,
          durationPeriods: cleanDuration,
          age: cleanAge,
          fullName: fullName?.trim(),
          customNote: cleanCustomNote,
          imageUrls,
          periodType,
          petName: cleanPetName,
          randomGenerated,
          timezone: timezone?.trim(),
        });

        if (result.contract) {
          setPetDebtContract(result.contract as PetDebtContract);
        }
      } catch (error) {
        console.error("Failed to create debt contract", error);
        const maybeTimeoutUntil = (error as { payload?: { timeoutUntil?: unknown } })?.payload?.timeoutUntil;

        if (typeof maybeTimeoutUntil === "string") {
          timeoutUntilRef.current = maybeTimeoutUntil;
          timeoutReasonRef.current = "evil_debt_underage";
          setTimeoutUntil(maybeTimeoutUntil);
          setTimeoutReason("evil_debt_underage");
        }

        setAuthError(describeError(error));
        setAvatarMistressReply(describeError(error));
        return false;
      }
    }

    setAvatarMistressReply(
      contractType === "evil"
        ? "Evil Debt Contract submitted. It is waiting for admin approval."
        : "Debt Contract signed. The schedule is now active.",
    );
    emitSoundEvent("debt_contract_signed");
    return true;
  };

  const handleDebtAutoPayChange = (enabled: boolean) => {
    if (blockIfTimedOut()) {
      return;
    }

    const debtAutoPayUserId = profileIdRef.current ?? authUserId ?? LOCAL_GUEST_USER_ID;

    setIsDebtAutoPayEnabled(enabled);
    writeDebtAutoPayEnabled(debtAutoPayUserId, enabled);
  };

  const handleDebtContractPayment = async () => {
    if (blockIfTimedOut()) {
      return;
    }

    if (!petDebtContract || petDebtContract.status !== "active") {
      return;
    }

    const paymentDue =
      petDebtContract.paid_periods === 0 ||
      new Date(petDebtContract.next_due_at).getTime() <= Date.now();

    if (!paymentDue) {
      setAvatarMistressReply(
        `Future installments are locked. Next payment opens in ${formatDuration(
          new Date(petDebtContract.next_due_at).getTime() - Date.now(),
        )}.`,
      );
      return;
    }

    const now = new Date().toISOString();
    const nextCoins = coinsRef.current - petDebtContract.debt_amount;
    const nextPaidPeriods = petDebtContract.paid_periods + 1;
    const completed = nextPaidPeriods >= petDebtContract.duration_periods;
    const periodMs = petDebtContract.period_type === "weekly" ? WEEK_MS : 30 * DAY_MS;
    const overduePeriods = Math.max(
      0,
      Math.floor((Date.now() - new Date(petDebtContract.next_due_at).getTime()) / periodMs),
    );
    const nextMissedPeriods = Math.min(
      petDebtContract.duration_periods,
      petDebtContract.missed_periods + overduePeriods,
    );
    const nextDueAt = new Date(Date.now() + periodMs).toISOString();

    if (!isGuestMode && authUserId) {
      try {
        const result = await persistDebtContractAction({
          action: "pay",
          contractId: petDebtContract.id,
        });

        setPetDebtContract((result.contract as PetDebtContract | null) ?? null);
      } catch (error) {
        console.error("Failed to persist debt contract payment", error);
        setAuthError(describeError(error));
        return;
      }
    } else {
      setCoins(nextCoins);
      if (completed) {
        setPetDebtContract(null);
      } else {
        setPetDebtContract({
          ...petDebtContract,
          paid_periods: nextPaidPeriods,
          missed_periods: nextMissedPeriods,
          next_due_at: nextDueAt,
          updated_at: now,
        });
      }
    }

    setPetTaskStateOptimistic((current) =>
      current.map((entry) =>
        entry.id === "pet-debt-contract"
          ? {
              ...entry,
              completedAt: now,
              reviewedAt: now,
              status: "approved",
            }
          : entry,
      ),
    );
    setAvatarMistressReply(
      completed
        ? "Debt Contract completed. You may sign another."
        : `Debt payment accepted. ${nextPaidPeriods}/${petDebtContract.duration_periods} periods paid.`,
    );
  };

  const handleCaseOpen = async () => {
    if (blockIfTimedOut()) {
      return null;
    }

    const actionId = "case-opening";
    const task = tasks.find((entry) => entry.id === "case-opening");
    const coolingDown =
      Boolean(task?.cooldownUntil) &&
      new Date(task?.cooldownUntil ?? "").getTime() > Date.now();

    if (!task || coolingDown || !beginTaskAction(actionId)) {
      return null;
    }

    try {
      const now = new Date().toISOString();
      const reward = randomCaseOpeningReward();
      const nextCoins = Math.max(0, coinsRef.current + reward);

      if (!isGuestMode && authUserId) {
        try {
          await persistProfileProgress({ coins: nextCoins, affection }, "reward:case-opening");
        } catch (error) {
          setAuthError(describeError(error));
          return null;
        }

        try {
          await persistUserTask({
            task_id: task.id,
            completed_at: now,
            claimed_at: now,
            reward_coins: reward,
            metadata: { reward },
          });
        } catch (error) {
          console.error("Failed to persist case opening", error);
          setAuthError(describeError(error));
          return null;
        }
      } else {
        setCoins(nextCoins);
      }

      setTasks((current) =>
        current.map((entry) =>
          entry.id === task.id
            ? {
                ...entry,
                caseReward: reward,
                caseSpunAt: now,
                completed: true,
                claimed: true,
                cooldownUntil: getPetTaskCooldownUntil(now),
              }
            : entry,
        ),
      );
      setAvatarMistressReply(`Case result: ${reward > 0 ? "+" : ""}${reward} coins.`);
      return reward;
    } finally {
      finishTaskAction(actionId);
    }
  };

  const handleCooldownAttempt = useCallback((message: string) => {
    const avatarId = resolveSpeechAvatarIdForMessage();
    setSpeechBubbleReply(getSpeechBubbleResponseMessage(avatarId, "cooldown", message));
  }, [equippedSpeechAvatar?.id, setSpeechBubbleReply]);

  const applyVerticalMotionTaskRow = useCallback((row: UserTaskRow) => {
    const rawState = getTaskMetadataString(row.metadata, "state");
    const movementState: TaskItem["movementState"] =
      rawState === "active" ||
      rawState === "fake_hope" ||
      rawState === "failed" ||
      rawState === "completed"
        ? rawState
        : "ready";
    const rawOutcome = getTaskMetadataString(row.metadata, "outcome");
    const movementOutcome: TaskItem["movementOutcome"] =
      rawOutcome === "success" || rawOutcome === "instant_denial" || rawOutcome === "fake_hope"
        ? rawOutcome
        : null;

    setTasks((current) =>
      current.map((entry) =>
        entry.id === "vertical-motion"
          ? {
              ...entry,
              claimed: movementState === "failed" || movementState === "completed",
              completed: movementState === "completed",
              cooldownUntil:
                movementState === "failed" || movementState === "completed"
                  ? getCooldownUntil(row.claimed_at ?? null, DAY_MS)
                  : null,
              movementDate: getTaskMetadataString(row.metadata, "date"),
              movementFailAt: getTaskMetadataString(row.metadata, "fakeHopeStartedAt"),
              movementOutcome,
              movementProgress: getTaskMetadataNumber(row.metadata, "progress", 0),
              movementResolvedAt: row.claimed_at ?? null,
              movementState,
            }
          : entry,
      ),
    );
  }, []);

  const persistVerticalMotionAction = useCallback(async (body: { action: string; progress?: number }) => {
    const response = await fetch("/api/user/task-actions/vertical-motion", {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = (await response.json().catch(() => null)) as {
      error?: string;
      profile?: { coins?: number };
      task?: UserTaskRow;
    } | null;

    if (!response.ok) {
      throw new Error(result?.error ?? "Movement task update failed.");
    }

    if (typeof result?.profile?.coins === "number") {
      setCoins(result.profile.coins);
    }

    if (result?.task) {
      applyVerticalMotionTaskRow(result.task);
      const state = getTaskMetadataString(result.task.metadata, "state");
      const avatarId = resolveSpeechAvatarIdForMessage();

      if (state === "completed") {
        emitSoundEvent("task_completion");
        setAvatarMistressReply(
          getSpeechBubbleResponseMessage(avatarId, "taskComplete", "Daily Motion completed."),
        );
      } else if (state === "failed") {
        emitSoundEvent("task_fail");
        setAvatarMistressReply(
          getSpeechBubbleResponseMessage(avatarId, "error", "Daily Motion failed."),
        );
      } else if (state === "fake_hope") {
        setAvatarMistressReply(
          getSpeechBubbleResponseMessage(avatarId, "task", "So close. Keep going."),
        );
      }
    }
  }, [applyVerticalMotionTaskRow, equippedSpeechAvatar?.id]);

  const handleVerticalMotionStart = useCallback(() => {
    if (!beginTaskAction("vertical-motion")) {
      return;
    }

    persistVerticalMotionAction({ action: "start" }).catch((error) => {
      console.error("Failed to start movement task", error);
      setAuthError(describeError(error));
    }).finally(() => {
      finishTaskAction("vertical-motion");
    });
  }, [beginTaskAction, finishTaskAction, persistVerticalMotionAction]);

  const handleVerticalMotionProgress = useCallback((progress: number) => {
    if (!beginTaskAction("vertical-motion")) {
      return;
    }

    persistVerticalMotionAction({ action: "progress", progress }).catch((error) => {
      console.error("Failed to save movement task progress", error);
      setAuthError(describeError(error));
    }).finally(() => {
      finishTaskAction("vertical-motion");
    });
  }, [beginTaskAction, finishTaskAction, persistVerticalMotionAction]);

  const handleVerticalMotionFinishFakeHope = useCallback(() => {
    if (!beginTaskAction("vertical-motion")) {
      return;
    }

    persistVerticalMotionAction({ action: "finish_fake_hope" }).catch((error) => {
      console.error("Failed to finish movement fake hope phase", error);
      setAuthError(describeError(error));
    }).finally(() => {
      finishTaskAction("vertical-motion");
    });
  }, [beginTaskAction, finishTaskAction, persistVerticalMotionAction]);

  const handleVerticalMotionFail = useCallback(() => {
    if (!beginTaskAction("vertical-motion")) {
      return;
    }

    persistVerticalMotionAction({ action: "fail" }).catch((error) => {
      console.error("Failed to fail movement task", error);
      setAuthError(describeError(error));
    }).finally(() => {
      finishTaskAction("vertical-motion");
    });
  }, [beginTaskAction, finishTaskAction, persistVerticalMotionAction]);

  const applyPetDailyClickTaskRow = useCallback((row: UserPetTaskRow) => {
    const requirement = getTaskMetadataNumber(row.metadata, "requirement", 0);
    const progress = getTaskMetadataNumber(row.metadata, "progress", 0);
    const completed = requirement > 0 && progress >= requirement;

    setPetTaskStateOptimistic((current) =>
      current.map((entry) =>
        entry.id === "pet-daily-click"
          ? {
              ...entry,
              clickDate: getTaskMetadataString(row.metadata, "date"),
              clickImage: getTaskMetadataString(row.metadata, "image"),
              clickProgress: progress,
              clickRequirement: requirement,
              completedAt: completed ? row.completed_at : null,
              reviewedAt: completed ? row.reviewed_at ?? null : null,
              status: completed ? "approved" as const : "available" as const,
            }
          : entry,
      ),
    );
  }, [setPetTaskStateOptimistic]);

  async function flushPetDailyClicks() {
    if (petDailyClickFlushInFlightRef.current || petDailyClickPendingRef.current <= 0) {
      return;
    }

    const clicks = Math.min(PET_DAILY_CLICK_FLUSH_BATCH_SIZE, petDailyClickPendingRef.current);
    petDailyClickPendingRef.current -= clicks;
    petDailyClickFlushInFlightRef.current = true;

    try {
      const response = await fetch("/api/user/pet-daily-click", {
        body: JSON.stringify({ clicks }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        profile?: { coins?: number; pet_score?: number };
        task?: UserPetTaskRow;
      } | null;

      if (!response.ok) {
        console.error("Failed to persist pet daily clicks", { clicks, result });
        throw new Error(result?.error ?? "Pet daily click failed.");
      }

      if (typeof result?.profile?.coins === "number") {
        setCoins(result.profile.coins);
      }

      if (typeof result?.profile?.pet_score === "number") {
        setPetScore(result.profile.pet_score);
      }

      if (result?.task) {
        const previousTask = petTaskStateRef.current.find((entry) => entry.id === "pet-daily-click");
        const wasCompleted = previousTask?.status === "approved";
        applyPetDailyClickTaskRow(result.task);
        const progress = getTaskMetadataNumber(result.task.metadata, "progress", 0);
        const requirement = getTaskMetadataNumber(result.task.metadata, "requirement", 0);

        if (!wasCompleted && requirement > 0 && progress >= requirement) {
          emitSoundEvent("task_completion");
          setAvatarMistressReply("Daily Pet Clicks completed.");
        }
      }
    } catch (error) {
      petDailyClickPendingRef.current += clicks;
      console.error("Failed to flush pet daily clicks", error);
      setAuthError(describeError(error));
    } finally {
      petDailyClickFlushInFlightRef.current = false;

      if (petDailyClickPendingRef.current > 0) {
        const elapsedSinceLastClick = Date.now() - petDailyClickLastClickAtRef.current;
        const nextFlushDelay = Math.max(120, PET_DAILY_CLICK_FLUSH_DELAY_MS - elapsedSinceLastClick);

        petDailyClickFlushTimerRef.current = window.setTimeout(() => {
          petDailyClickFlushTimerRef.current = null;
          void flushPetDailyClicks();
        }, nextFlushDelay);
      }
    }
  }

  function schedulePetDailyClickFlush() {
    if (petDailyClickFlushTimerRef.current !== null) {
      window.clearTimeout(petDailyClickFlushTimerRef.current);
    }

    petDailyClickFlushTimerRef.current = window.setTimeout(() => {
      petDailyClickFlushTimerRef.current = null;
      void flushPetDailyClicks();
    }, PET_DAILY_CLICK_FLUSH_DELAY_MS);
  }

  function handlePetDailyClick() {
    if (blockIfTimedOut()) {
      return;
    }

    const task = petTaskStateRef.current.find((entry) => entry.id === "pet-daily-click");
    if (task?.status === "approved") {
      return;
    }

    petDailyClickPendingRef.current += 1;
    petDailyClickLastClickAtRef.current = Date.now();

    if (task && (task.clickRequirement ?? 0) > 0) {
      const requirement = task.clickRequirement ?? 0;
      const nextProgress = Math.min(requirement, (task.clickProgress ?? 0) + 1);
      const shouldRewardCoin = (task.clickProgress ?? 0) < PET_DAILY_CLICK_MAX_COIN_REWARD;

      if (shouldRewardCoin) {
        setCoins((current) => current + 1);
      }
      setPetTaskStateOptimistic((current) =>
        current.map((entry) =>
          entry.id === "pet-daily-click"
            ? {
                ...entry,
                clickProgress: nextProgress,
                status: nextProgress >= requirement ? "approved" as const : "available" as const,
              }
            : entry,
        ),
      );
    }

    schedulePetDailyClickFlush();
  }

  const handlePetEvilWaitStart = async () => {
    if (blockIfTimedOut()) {
      return;
    }

    const task = petTaskStateRef.current.find((entry) => entry.id === "pet-evil-wait");
    const coolingDown =
      Boolean(task?.cooldownUntil) &&
      new Date(task?.cooldownUntil ?? "").getTime() > Date.now();

    if (!task || coolingDown) {
      return;
    }

    const now = new Date();
    const countdownEndsAt = new Date(now.getTime() + 3000).toISOString();
    const waitEndsAt = new Date(now.getTime() + 3000 + PET_EVIL_WAIT_MS).toISOString();

    if (!isGuestMode && authUserId) {
      try {
        await persistPetTask(
        {
          task_id: task.id,
          completed_at: null,
          reward_score: task.reward,
          status: "available",
          reviewed_at: null,
          metadata: {
            countdownEndsAt,
            status: "countdown",
            waitEndsAt,
          },
        },
        );
      } catch (error) {
        console.error("Failed to persist Pet evil wait start", error);
        setAuthError(describeError(error));
        return;
      }
    }

    setPetTaskStateOptimistic((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              completedAt: null,
              cooldownUntil: null,
              reviewedAt: null,
              waitCountdownEndsAt: countdownEndsAt,
              waitEndsAt,
              waitState: "countdown",
            }
          : entry,
      ),
    );
    setAvatarMistressReply("Do not move. Principessa is watching.");
  };

  const handlePetEvilWaitFail = async () => {
    const task = petTaskStateRef.current.find((entry) => entry.id === "pet-evil-wait");

    if (!task) {
      return;
    }

    const waitEndsAt = task.waitEndsAt ? new Date(task.waitEndsAt).getTime() : 0;
    if (waitEndsAt > 0 && Date.now() >= waitEndsAt) {
      return;
    }

    const now = new Date().toISOString();

    if (!isGuestMode && authUserId) {
      try {
        await persistPetTask(
        {
          task_id: task.id,
          completed_at: now,
          reward_score: task.reward,
          status: "failed",
          reviewed_at: now,
          metadata: { status: "failed" },
        },
        );
      } catch (error) {
        console.error("Failed to persist Pet evil wait failure", error);
        emitSoundEvent("error");
        setAuthError(describeError(error));
        return;
      }
    }

    setPetTaskStateOptimistic((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              completedAt: now,
              cooldownUntil: getPetTaskCooldownUntil(now),
              status: "failed",
              waitState: "failed",
            }
          : entry,
      ),
    );
    setAvatarMistressReply("You moved. Evil Pet task failed.");
    emitSoundEvent("task_fail");
  };

  const handlePetEvilWaitComplete = async () => {
    const task = petTaskStateRef.current.find((entry) => entry.id === "pet-evil-wait");

    if (!task) {
      return;
    }

    const now = new Date().toISOString();
    const nextPetScore = Math.min(1000, petScore + task.reward);

    if (!isGuestMode && authUserId) {
      try {
        await persistPetProfilePatch(
          { coins: coinsRef.current + eventPetTaskCoinReward, pet_score: nextPetScore },
          "reward:pet-evil-wait",
        );
      } catch (error) {
        emitSoundEvent("error");
        setAuthError(describeError(error));
        return;
      }

      try {
        await persistPetTask(
        {
          task_id: task.id,
          completed_at: now,
          reward_score: task.reward,
          status: "approved",
          reviewed_at: now,
          metadata: { status: "completed" },
        },
        );
      } catch (error) {
        console.error("Failed to persist Pet evil wait completion", error);
        emitSoundEvent("error");
        setAuthError(describeError(error));
        return;
      }
    } else {
      setPetScore(nextPetScore);
    }

    setPetTaskStateOptimistic((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              completedAt: now,
              cooldownUntil: getPetTaskCooldownUntil(now),
              reviewedAt: now,
              status: "approved",
              waitState: "completed",
            }
          : entry,
      ),
    );
    setAvatarMistressReply(`Stillness accepted. +${task.reward} Pet Score, +${eventPetTaskCoinReward} coins.`);
    emitSoundEvent("task_completion");
  };

  const handlePetFalseHopeKey = async (key: "a" | "d") => {
    if (blockIfTimedOut()) {
      return;
    }

    const task = petTaskStateRef.current.find((entry) => entry.id === "pet-false-hope");
    const coolingDown =
      Boolean(task?.cooldownUntil) &&
      new Date(task?.cooldownUntil ?? "").getTime() > Date.now();

    if (!task || coolingDown) {
      return;
    }

    const expectedKey = task.falseHopeExpectedKey ?? "a";
    const currentProgress = task.falseHopeProgress ?? 0;
    const currentStage = task.falseHopeStage ?? 1;
    const currentWrongInputs = task.falseHopeWrongInputs ?? 0;
    const correct = key === expectedKey;
    const nextWrongInputs = correct ? currentWrongInputs : currentWrongInputs + 1;
    let nextProgress = Math.max(0, currentProgress + (correct ? 1 : -5));
    let nextStage = currentStage;
    let completed = false;
    const failed = nextWrongInputs >= 10;
    const nextExpectedKey: "a" | "d" = expectedKey === "a" ? "d" : "a";

    if (!failed && nextProgress >= 99 && currentStage === 1) {
      nextProgress = 0;
      nextStage = 2;
      setAvatarMistressReply("So close. Did you really think it would be that easy?");
    } else if (!failed && nextProgress >= 100 && currentStage >= 2) {
      nextProgress = 100;
      completed = true;
    }

    const now = new Date().toISOString();
    const nextPetScore = completed ? Math.min(1000, petScore + task.reward) : petScore;
    setPetTaskStateOptimistic((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              completedAt: completed || failed ? now : entry.completedAt,
              cooldownUntil: completed || failed ? getPetTaskCooldownUntil(now) : entry.cooldownUntil,
              falseHopeExpectedKey: nextExpectedKey,
              falseHopeProgress: nextProgress,
              falseHopeStage: nextStage,
              falseHopeWrongInputs: nextWrongInputs,
              reviewedAt: completed || failed ? now : entry.reviewedAt,
              status: completed ? "approved" as const : failed ? "failed" as const : "available" as const,
            }
          : entry,
      ),
    );
    if (completed && isGuestMode) {
      setPetScore(nextPetScore);
    }

    const persistFalseHopeProgress = async () => {
      if (isGuestMode || !authUserId) {
        return;
      }

      if (completed) {
        await persistPetProfilePatch(
          { coins: coinsRef.current + eventPetTaskCoinReward, pet_score: nextPetScore },
          "reward:pet-false-hope",
        );
      }

      await persistPetTask(
        {
          task_id: task.id,
          completed_at: completed || failed ? now : task.completedAt,
          reward_score: task.reward,
          status: completed ? "approved" : failed ? "failed" : "available",
          reviewed_at: completed || failed ? now : null,
          metadata: {
            expectedKey: nextExpectedKey,
            progress: nextProgress,
            stage: nextStage,
            wrongInputs: nextWrongInputs,
          },
        },
      );
    };

    falseHopePersistQueueRef.current = falseHopePersistQueueRef.current
      .catch(() => undefined)
      .then(persistFalseHopeProgress)
      .catch((error) => {
        console.error("Failed to persist Pet false hope progress", error);
        setAuthError(describeError(error));
        setAvatarMistressReply("The sequence saved locally, but the vault failed to persist it.");
      });

    if (completed) {
      setAvatarMistressReply(`Sequence completed. +${task.reward} Pet Score, +${eventPetTaskCoinReward} coins.`);
      emitSoundEvent("task_completion");
    } else if (failed) {
      setAvatarMistressReply("Too many wrong inputs. Sequence failed.");
      emitSoundEvent("task_fail");
    }
  };

  const handlePetFavorPick = async (pickedIndex: number) => {
    if (blockIfTimedOut()) {
      return;
    }

    const task = petTaskStateRef.current.find((entry) => entry.id === "pet-favor-roulette");
    const coolingDown =
      Boolean(task?.cooldownUntil) &&
      new Date(task?.cooldownUntil ?? "").getTime() > new Date().getTime();

    if (!task || coolingDown || task.favorResult) {
      return;
    }

    if (pickedIndex < 0 || pickedIndex > 4) {
      return;
    }

    const now = new Date().toISOString();
    const emptyDay = randomChance(PET_FAVOR_EMPTY_DAY_CHANCE);
    const winningIndex = emptyDay ? -1 : Math.floor(Math.random() * 5);
    const won = !emptyDay && pickedIndex === winningIndex;
    const result: NonNullable<PetTaskItem["favorResult"]> = emptyDay
      ? "empty-day"
      : won
        ? "win"
        : "loss";
    const nextPetScore = won ? Math.min(1000, petScore + task.reward) : petScore;

    if (!isGuestMode && authUserId) {
      if (won) {
        try {
          await persistPetProfilePatch(
            {
              coins: coinsRef.current + eventFavorCoinReward,
              pet_score: nextPetScore,
            },
            "reward:pet-favor-roulette",
          );
        } catch (error) {
          emitSoundEvent("error");
          setAuthError(describeError(error));
          return;
        }
      }

      try {
        await persistPetTask(
        {
          task_id: task.id,
          completed_at: now,
          reward_score: task.reward,
          status: won ? "approved" : "failed",
          reviewed_at: now,
          metadata: {
            emptyDay,
            pickedIndex,
            result,
            winningIndex,
          },
        },
        );
      } catch (error) {
        console.error("Failed to persist Pet favor roulette", error);
        emitSoundEvent("error");
        setAuthError(describeError(error));
        return;
      }
    } else if (won) {
      setCoins((current) => current + eventFavorCoinReward);
      setPetScore(nextPetScore);
    }

    setPetTaskStateOptimistic((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              completedAt: now,
              cooldownUntil: getPetTaskCooldownUntil(now),
              favorPickedIndex: pickedIndex,
              favorResult: result,
              favorWinningIndex: winningIndex,
              reviewedAt: now,
              status: won ? "approved" : "failed",
            }
          : entry,
      ),
    );

    setAvatarMistressReply(
      result === "win"
        ? `Special Favor. +${task.reward} Pet Score, +${eventFavorCoinReward} coins.`
        : result === "empty-day"
          ? "How adorable. Today, none of them were winners."
          : "Disappointment. Naturally.",
    );
    emitSoundEvent(result === "win" ? "task_completion" : "task_fail");
  };

  useEffect(() => {
    if (!isPetUnlocked) {
      return;
    }

    const thresholdIds = petGalleryItems
      .filter((item) => petScore >= item.unlockCost)
      .map((item) => item.id)
      .filter((id) => !petGalleryUnlockedIds.includes(id));

    if (thresholdIds.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPetGalleryUnlockedIds((current) => Array.from(new Set([...current, ...thresholdIds])));
    }, 0);

    if (isGuestMode || !authUserId) {
      return () => window.clearTimeout(timer);
    }

    void persistPetGalleryUnlocks(thresholdIds).catch((error) => {
      console.error("Failed to persist automatic pet gallery unlocks", error);
    });

    return () => window.clearTimeout(timer);
  }, [authUserId, isGuestMode, isPetUnlocked, persistPetGalleryUnlocks, petGalleryUnlockedIds, petScore]);

    const handlePetAffectionClaim = async () => {
        if (blockIfTimedOut()) {
            return;
        }

        const today = getDailyKey();
        const milestoneClaimedToday = petAffectionClaimDate === today;
        const approvedCount = petTaskState.filter((task) => isPetTaskApprovedToday(task, today)).length;

        if (approvedCount < 5 || milestoneClaimedToday) {
            return;
        }

        const nextPetScore = Math.min(1000, petScore + 10);

        if (!isGuestMode && authUserId) {
            try {
              await persistPetProfilePatch(
                { pet_score: nextPetScore },
                "reward:pet-affection-claim",
              );
              await persistPetTask(
                {
                    task_id: "pet-affection-claim",
                    completed_at: new Date().toISOString(),
                    reward_score: 10,
                    status: "approved",
                    reviewed_at: new Date().toISOString(),
                    metadata: { date: today },
                },
              );
            } catch (error) {
                console.error("Failed to persist Pet score claim", error);
                setAuthError(describeError(error));
                return;
            }
        }

        setPetScore(nextPetScore);
        setPetAffectionClaimDate(today);
        setAvatarMistressReply("Pet milestone claimed. +10 Pet Score.");
    };

  const runPetAction = useCallback(async (actionId: string, action: () => Promise<unknown> | unknown) => {
    if (blockIfTimedOut()) {
      return;
    }

    if (!beginPetAction(actionId)) {
      return;
    }

    try {
      await action();
    } catch (error) {
      console.error("[action-error] caught pet action error", { actionId, error });
      emitSoundEvent("error");
      setAvatarMistressReply("That Pet action failed to save. Resyncing the vault state.");
      void resyncAuthenticatedProfile(`Failed pet action ${actionId}`).catch((resyncError) => {
        console.error("[profile-resync] failed after pet action error", { actionId, resyncError });
      });
    } finally {
      finishPetAction(actionId);
    }
  }, [beginPetAction, finishPetAction, resyncAuthenticatedProfile, setAvatarMistressReply]);

  const stats = {
    coins,
    affection,
    loyaltyStreak,
    tributeTotal,
  };
  const equippableInventoryItems = useMemo(
    () => {
      const fromInv = crateInventory.filter((item) => item.quantity > 0 && isAvatarEquippableItem(item.item_id));
      const hasClassic = fromInv.some((item) => item.item_id === "classic");
      if (hasClassic) return fromInv;
      // Always inject the default "classic" fullbody so it appears in wardrobe and is equippable
      return [
        ...fromInv,
        {
          item_id: "classic",
          name: "Classic",
          description: "Default full body outfit.",
          image_url: null,
          rarity: "common" as const,
          collection: "classic",
          sell_value: 50,
          variant: "normal",
          quantity: 1,
        },
      ];
    },
    [crateInventory],
  );
  const inventoryItemNameById = useMemo(
    () => {
      const m = new Map(crateInventory.map((item) => [item.item_id, item.name]));
      if (!m.has("classic")) {
        m.set("classic", "Classic");
      }
      return m;
    },
    [crateInventory],
  );

  const hasDisplayNameChangeRight = ownedCosmeticIds.includes("display-name-change");

  // Group wardrobe items by their avatar slot category for cleaner UI
  const equippableByCategory = useMemo(() => {
    const groups: Partial<Record<AvatarSlot, typeof equippableInventoryItems>> = {};
    for (const item of equippableInventoryItems) {
      const slot = getItemAvatarSlot(item.item_id);
      if (slot) {
        if (!groups[slot]) groups[slot] = [];
        groups[slot]!.push(item);
      }
    }
    // Sort each category's items by rarity: common -> uncommon -> rare -> epic -> legendary
    Object.keys(groups).forEach((slot) => {
      const arr = groups[slot as AvatarSlot]!;
      arr.sort((a, b) => {
        const ia = RARITY_ORDER.indexOf((a.rarity || "").toLowerCase() as any);
        const ib = RARITY_ORDER.indexOf((b.rarity || "").toLowerCase() as any);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
    });
    return groups;
  }, [equippableInventoryItems]);

  const getRarityPillClasses = (rarity: string) => {
    const r = (rarity || "").toLowerCase();
    switch (r) {
      case "uncommon":
        return "border-emerald-300/25 bg-emerald-400/12 text-emerald-100";
      case "rare":
        return "border-sky-300/25 bg-sky-400/12 text-sky-100";
      case "epic":
        return "border-violet-300/25 bg-violet-400/12 text-violet-100";
      case "legendary":
        return "border-amber-300/30 bg-amber-400/14 text-amber-50 shadow-[0_0_12px_rgba(245,158,11,0.16)]";
      case "common":
      default:
        return "border-zinc-300/20 bg-zinc-500/10 text-zinc-100";
    }
  };

  const getRarityCardClasses = (rarity: string, isEquipped: boolean) => {
    const r = (rarity || "").toLowerCase();

    if (isEquipped) {
      // Keep equipped prominent with pink, blend subtle rarity tint/border
      let extra = "border-pink-300/40 bg-pink-500/10 text-pink-50 transition-all duration-200";
      switch (r) {
        case "uncommon":
          extra += " border-emerald-400/20 ring-1 ring-emerald-400/10";
          break;
        case "rare":
          extra += " border-sky-400/20 ring-1 ring-sky-400/10";
          break;
        case "epic":
          extra += " border-violet-400/20 ring-1 ring-violet-400/10";
          break;
        case "legendary":
          extra += " border-amber-400/25 ring-1 ring-amber-400/12";
          break;
        default:
          extra += " border-zinc-500/20";
      }
      return extra;
    }

    // Non-equipped: subtle rarity tint + soft glow, dark base preserved
    let classes = "border-white/10 hover:border-pink-300/30 transition-all duration-200";
    switch (r) {
      case "uncommon":
        classes += " bg-[linear-gradient(180deg,rgba(6,32,24,0.82),rgba(8,16,14,0.92))] border-emerald-400/18 shadow-[0_0_8px_rgba(16,185,129,0.12)] hover:shadow-[0_0_14px_rgba(16,185,129,0.20)]";
        break;
      case "rare":
        classes += " bg-[linear-gradient(180deg,rgba(6,20,40,0.84),rgba(8,12,22,0.94))] border-sky-400/18 shadow-[0_0_8px_rgba(14,165,233,0.12)] hover:shadow-[0_0_14px_rgba(14,165,233,0.20)]";
        break;
      case "epic":
        classes += " bg-[linear-gradient(180deg,rgba(35,12,56,0.88),rgba(12,8,22,0.96))] border-violet-400/18 shadow-[0_0_8px_rgba(139,92,246,0.12)] hover:shadow-[0_0_14px_rgba(139,92,246,0.20)]";
        break;
      case "legendary":
        classes += " bg-[linear-gradient(180deg,rgba(61,35,6,0.92),rgba(18,12,8,0.97))] border-amber-300/24 shadow-[0_0_10px_rgba(245,158,11,0.16)] hover:shadow-[0_0_18px_rgba(245,158,11,0.24)]";
        break;
      case "common":
      default:
        classes += " bg-[linear-gradient(180deg,rgba(18,18,22,0.92),rgba(10,10,14,0.98))] border-zinc-700/30";
        break;
    }
    return classes;
  };

  const dashboardNavItems = [
    { key: "home" as const, label: "Home" },
    { key: "tribute" as const, label: "Tribute" },
    { key: "collection" as const, label: "Gallery" },
    { key: "tasks" as const, label: "Tasks" },
    {
      key: "pet" as const,
      label: "Pet",
      disabled: !isPetUnlocked,
      badge: isPetUnlocked ? undefined : "Locked",
    },
    { key: "crates" as const, label: "Cases" },
    { key: "shop" as const, label: "Shop" },
    { key: "profile" as const, label: "Profile" },
  ];
  const activePageLabel =
    dashboardNavItems.find((item) => item.key === activePanel)?.label ?? "Home";
  const soundControls = (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-2.5 py-2">
      <button
        aria-label={soundsMuted ? "Unmute sound" : "Mute sound"}
        aria-pressed={soundsMuted}
        className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] transition ${
          soundsMuted
            ? "border-red-200/30 bg-red-500/15 text-red-50 hover:border-red-200/55"
            : "border-emerald-200/30 bg-emerald-400/10 text-emerald-50 hover:border-emerald-200/55"
        }`}
        onClick={() =>
          applySoundSettings({
            gameplayEnabled: soundsMuted,
            uiEnabled: soundsMuted,
          })
        }
        type="button"
      >
        {soundsMuted ? "Muted" : "Sound"}
      </button>
      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-300">
        <span className="sr-only">Volume</span>
        <input
          aria-label="Volume"
          className="w-20 accent-pink-400 sm:w-24"
          max={100}
          min={0}
          onChange={(event) =>
            applySoundSettings({ masterVolume: Number(event.target.value) / 100 })
          }
          type="range"
          value={Math.round(soundSettings.masterVolume * 100)}
        />
        <span className="w-8 text-right text-pink-100">
          {Math.round(soundSettings.masterVolume * 100)}%
        </span>
      </label>
    </div>
  );
  const effectiveDisplayName = displayName && displayName.trim().length >= 2 ? displayName.trim() : null;
  const requiresDisplayNameSetup = Boolean(authUserId) && !isGuestMode && !isPreviewMode && !effectiveDisplayName;

  const performDisplayNameUpdate = async (rawInput: string, { forceFree = false }: { forceFree?: boolean } = {}) => {
    const validation = validateDisplayName(rawInput, {
      allowExactPrincipessa: isAdminUser,
    });
    if (!validation.valid || !validation.normalized) {
      setDisplayNameError(validation.error ?? "Invalid display name.");
      return false;
    }
    if (!authUserId) {
      setDisplayNameError("Not authenticated.");
      return false;
    }

    setIsSettingDisplayName(true);
    setDisplayNameError("");

    try {
      const response = await fetch("/api/user/display-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: validation.normalized }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; profile?: Profile; isFirstSetup?: boolean };

      if (!response.ok) {
        const msg = payload.error ?? "Failed to set display name.";
        setDisplayNameError(msg);
        setAvatarMistressReply(msg);
        return false;
      }

      if (payload.profile) {
        applyProfileStats(payload.profile);
      } else {
        setDisplayName(validation.normalized);
      }

      setDisplayNameInput("");
      setShowDisplayNameSetup(false);
      emitSoundEvent("cosmetic_purchased");
      const wasFirst = payload.isFirstSetup ?? forceFree;
      setAvatarMistressReply(
        wasFirst
          ? "Display name set. Welcome."
          : "Display name changed. 2500 coins spent."
      );
      return true;
    } catch (err) {
      console.error("Display name update failed", err);
      const msg = describeError(err) || "Display name update failed.";
      setDisplayNameError(msg);
      setAvatarMistressReply(msg);
      return false;
    } finally {
      setIsSettingDisplayName(false);
    }
  };

  const handleConfirmDisplayNameSetup = async () => {
    await performDisplayNameUpdate(displayNameInput, { forceFree: true });
  };

  // Paid change modal removed - use purchased rights via pencil in Profile tab instead.

  const handleSaveDisplayNameChange = async () => {
    if (!hasDisplayNameChangeRight || !authUserId) return;
    const validation = validateDisplayName(displayNameEditInput, {
      allowExactPrincipessa: isAdminUser,
    });
    if (!validation.valid || !validation.normalized) {
      setDisplayNameError(validation.error || "Invalid display name.");
      return;
    }
    const currentDisplayNameNormalized = effectiveDisplayName?.trim().toLowerCase() ?? "";
    if (currentDisplayNameNormalized && validation.normalized.toLowerCase() === currentDisplayNameNormalized) {
      setDisplayNameError("Please choose a different display name.");
      return;
    }
    setIsSettingDisplayName(true);
    setDisplayNameError("");
    try {
      const response = await fetch("/api/user/display-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: validation.normalized,
          useRight: true,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; profile?: Profile };
      if (!response.ok) {
        setDisplayNameError(payload.error || "Failed to update display name.");
        return;
      }
      if (payload.profile) {
        applyProfileStats(payload.profile);
      } else {
        setDisplayName(validation.normalized);
      }
      // consume the right
      setOwnedCosmeticIds((prev) => prev.filter((id) => id !== "display-name-change"));
      setIsEditingDisplayName(false);
      setDisplayNameEditInput("");
      setAvatarMistressReply("Display name updated using your change right.");
    } catch (err) {
      setDisplayNameError("Failed to update display name.");
    } finally {
      setIsSettingDisplayName(false);
    }
  };

  const profileHeaderStats =
    activePanel === "pet"
      ? [
          { label: "Pet Score", value: petScore.toLocaleString(), hint: "Pet progression" },
          {
            label: "Likeness",
            value: (
              <div className="flex items-center gap-2">
                <span>{ownerLikeness}/100</span>
                {ownerLikeness >= 100 ? (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-pink-300/45 bg-pink-500/15 text-sm shadow-[0_0_18px_rgba(244,114,182,0.38)]">
                    ❤
                  </span>
                ) : null}
              </div>
            ),
            hint: "Owner likeness",
          },
          { label: "Rights", value: storedRights.toLocaleString(), hint: "Stored rights" },
        ]
      : activePanel === "tasks"
        ? [
            {
              label: "Loyalty",
              value: (
                <div className="flex flex-col items-start gap-2">
                  <span>{loyaltyStreak} days</span>
                  {claimableLoyaltyBonuses.length > 0 ? (
                    <button
                      className="rounded-full border border-pink-300/25 bg-pink-500/10 px-3 py-1 text-xs font-black text-pink-50 transition hover:border-pink-300/45 hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={isLoyaltyClaimPending}
                      onClick={handleClaimLoyaltyRewards}
                      type="button"
                    >
                      {isLoyaltyClaimPending ? "Claiming..." : "Claim Reward"}
                    </button>
                  ) : null}
                </div>
              ),
              hint: "Current streak",
            },
            { label: "User Level", value: userLevel.toLocaleString(), hint: "Independent level" },
            { label: "Principessa", value: `Level ${globalPrincipessa.level}`, hint: "Monthly level" },
          ]
        : [
            { label: "Affection", value: `${affection}/100`, hint: "Current mood" },
            { label: "Loyalty", value: `${loyaltyStreak} days`, hint: "Current streak" },
            { label: "Tribute", value: tributeTotal.toLocaleString(), hint: "Total offered" },
          ];
  const headerProgressStrip =
    activePanel === "tasks" ? (
      <div className="rounded-2xl border border-emerald-300/15 bg-emerald-500/10 px-3 py-2">
        <div className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-100/75">
          <span>Today&apos;s Task Progress</span>
          <span>{tasksCompletedToday.length} done</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/35">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#34d399,#f472b6)] transition-[width]"
            style={{ width: `${Math.min(100, (tasksCompletedToday.length / 8) * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-emerald-50/80">
          {tasksCompletedToday.length} tasks completed, +{taskCoinsEarnedToday.toLocaleString()} coins earned today.
        </p>
      </div>
    ) : activePanel === "pet" ? (
      <div className="rounded-2xl border border-red-300/15 bg-red-500/10 px-3 py-2">
        <div className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.18em] text-red-100/75">
          <span>Today&apos;s Pet Progress</span>
          <span>{petTasksCompletedToday.length} done</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/35">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#fb7185,#f59e0b)] transition-[width]"
            style={{ width: `${Math.min(100, (petTasksCompletedToday.length / 8) * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-red-50/80">
          {petTasksCompletedToday.length} pet tasks cleared, +{petCoinsEarnedToday.toLocaleString()} coins earned today.
        </p>
      </div>
    ) : null;
  const displayNameEditValidation = validateDisplayName(displayNameEditInput, {
    allowExactPrincipessa: isAdminUser,
  });
  const currentDisplayNameNormalized = effectiveDisplayName?.trim().toLowerCase() ?? "";
  const canSaveDisplayNameEdit =
    displayNameEditValidation.valid &&
    !!displayNameEditValidation.normalized &&
    (!currentDisplayNameNormalized ||
      displayNameEditValidation.normalized.toLowerCase() !== currentDisplayNameNormalized);
  const headerActions = (
    <>
      <div className="rounded-full border border-pink-300/30 bg-pink-500/10 px-3 py-1 text-sm font-semibold text-pink-100">
        Greedy Mode
      </div>
      {isAdminUser && (
        <>
          <Link
            className="relative rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-sm font-semibold text-zinc-200 transition hover:border-pink-300/40 hover:text-white"
            href="/admin"
          >
            Admin
            {pendingIrlReviewCount > 0 && (
              <span className="ml-2 rounded-full bg-pink-500 px-2 py-0.5 text-xs font-black text-white">
                {pendingIrlReviewCount}
              </span>
            )}
          </Link>
          <Link
            className="rounded-full border border-pink-200/20 bg-pink-500/10 px-3 py-1 text-sm font-semibold text-pink-100 transition hover:border-pink-300/50 hover:text-white"
            href="/admin/analytics"
          >
            Analytics
          </Link>
        </>
      )}
      <button
        className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-sm font-semibold text-zinc-200 transition hover:border-pink-300/40 hover:text-white"
        onClick={handleLogout}
        type="button"
      >
        Logout
      </button>
    </>
  );

  if (!authBootstrapped || isAuthLoading || isProfileLoading || (isLoggedIn && !isVaultReady)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06030a] text-pink-100">
        <div className="rounded-[2rem] border border-pink-200/20 bg-black/55 px-6 py-5 shadow-[0_0_44px_rgba(236,72,153,0.16)]">
          Loading vault...
        </div>
      </main>
    );
  }

  if (authBootstrapped && !isLoggedIn && !isPreviewMode) {
    return (
      <LoginScreen
        error={authError}
        isBusy={isAuthBusy}
        onEnterPreviewMode={handleEnterPreviewMode}
        onSignInWithX={handleSignInWithX}
      />
    );
  }

  // First-time Display Name requirement blocks all normal access (free)
  if (requiresDisplayNameSetup && authBootstrapped && isLoggedIn && !isPreviewMode) {
    const setupDisabled = isSettingDisplayName || !displayNameInput.trim();
    return (
      <main className="min-h-screen bg-[#06030a] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[2rem] border border-fuchsia-200/20 bg-black/70 p-8 shadow-[0_0_60px_rgba(217,70,239,0.2)]">
          <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-200/70">Welcome</p>
          <h1 className="mt-2 text-3xl font-black">Choose your Display Name</h1>
          <p className="mt-3 text-sm text-zinc-400">
            This is public-facing only. Your @username remains your stable identity for admin and logs.
            It cannot be changed later without the cosmetic purchase.
          </p>

          <div className="mt-6">
            <label className="text-xs font-black uppercase tracking-[0.2em] text-pink-200/80">Display Name</label>
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-lg font-black outline-none focus:border-pink-300/60"
              value={displayNameInput}
              onChange={(e) => {
                setDisplayNameInput(e.target.value);
                setDisplayNameError("");
              }}
              placeholder="e.g. Good Boy"
              maxLength={24}
              disabled={isSettingDisplayName}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !setupDisabled) void handleConfirmDisplayNameSetup();
              }}
            />
            {displayNameError && (
              <p className="mt-2 text-sm text-red-400">{displayNameError}</p>
            )}
            <p className="mt-1 text-[10px] text-zinc-500">2–24 characters. No line breaks.</p>
          </div>

          <button
            className="mt-6 w-full rounded-full bg-pink-500 py-3 text-sm font-black uppercase tracking-[0.2em] text-black disabled:opacity-50"
            disabled={setupDisabled}
            onClick={() => void handleConfirmDisplayNameSetup()}
            type="button"
          >
            {isSettingDisplayName ? "Saving..." : "Set Display Name"}
          </button>
          <p className="mt-3 text-center text-[10px] text-zinc-500">Free for first setup. No coins charged.</p>
        </div>
      </main>
    );
  }

  const currentWeeklyTaxCost = getPetWeeklyTaxCost(coins);

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-[#06030a] text-white"
      onPointerDown={handleGlobalPointerDown}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.22),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.2),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0),#06030a_78%)]" />
      <AppShell
        activePage={activePanel}
        items={dashboardNavItems}
        onNavigate={(page) => {
          emitSoundEvent("button_click");
          resetViewportScroll();
          setActivePanel(page);
        }}
      >
        <ProfileHeader
          actions={headerActions}
          avatarSrc={characterEvolutionStage.image}
          coins={coins}
          currentTitle={equippedTitle?.name}
          displayName={effectiveDisplayName}
          equippedAvatarSlots={equippedAvatarSlots}
          hasUncensoredAvatar={hasUncensoredAvatar}
          avatarFrameClassName={avatarFrameClassName}
          avatarFrameStyle={avatarFrameStyle}
          avatarFrameVariant={avatarFrameVariant}
          spendBadge={spendBadge}
          pageLabel={activePageLabel}
          soundControls={soundControls}
          stats={profileHeaderStats}
          progressStrip={headerProgressStrip}
          username={username}
          usernameStyle={usernameStyle}
          hasDisplayNameChangeRight={hasDisplayNameChangeRight}
          isEditingDisplayName={isEditingDisplayName}
          displayNameEditInput={displayNameEditInput}
          isDisplayNameSaveDisabled={isSettingDisplayName || !canSaveDisplayNameEdit}
          onStartDisplayNameEdit={() => {
            setDisplayNameEditInput(effectiveDisplayName ?? "");
            setIsEditingDisplayName(true);
          }}
          onSaveDisplayNameEdit={handleSaveDisplayNameChange}
          onCancelDisplayNameEdit={() => {
            setIsEditingDisplayName(false);
            setDisplayNameEditInput("");
          }}
          onDisplayNameEditInputChange={setDisplayNameEditInput}
        />

          {showAccountAnnouncement && (
            <section className="rounded-[1.25rem] border border-pink-200/30 bg-[linear-gradient(135deg,rgba(236,72,153,0.18),rgba(0,0,0,0.58))] px-4 py-3 shadow-[0_0_28px_rgba(236,72,153,0.14)]">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-pink-100/75">
                {accountAnnouncement?.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-pink-50">
                {accountAnnouncement?.body}
              </p>
            </section>
          )}

        {isFreeFridayActive && (
          <section className="overflow-hidden rounded-[1.5rem] border border-emerald-200/35 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(236,72,153,0.12),rgba(0,0,0,0.6))] px-4 py-4 shadow-[0_0_34px_rgba(16,185,129,0.14)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-100">
                  Active Vault Event
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">Free Task Friday</h2>
                <p className="mt-1 text-sm leading-6 text-emerald-50/80">
                  One IRL Task Wheel spin is free today.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100/25 bg-black/45 px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/70">
                  Ends In
                </p>
                <p className="mt-1 text-2xl font-black text-emerald-50">
                  {formatEventCountdown(freeFridayRemainingMs)}
                </p>
              </div>
            </div>
          </section>
        )}

        {activeEvents.length > 0 && (
          <section className="overflow-hidden rounded-[1.5rem] border border-yellow-200/35 bg-[linear-gradient(135deg,rgba(250,204,21,0.2),rgba(236,72,153,0.14),rgba(88,28,135,0.32),rgba(0,0,0,0.62))] px-4 py-4 shadow-[0_0_38px_rgba(250,204,21,0.16)]">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-yellow-100">
              Active Vault Events
            </p>
            <div className="mt-3 grid gap-3">
              {activeEvents.map((event) => (
                <div
                  className="flex flex-col gap-3 rounded-2xl border border-yellow-100/15 bg-black/25 p-3 sm:flex-row sm:items-center sm:justify-between"
                  key={event.id}
                >
                  <div>
                    <h2 className="text-xl font-black text-white">{event.name}</h2>
                    <p className="mt-1 text-sm leading-6 text-yellow-50/80">
                      {event.description}
                      {event.effect.type === "speech_avatar_override" && (
                        <>
                          {" "}
                          Selected speech bubble:{" "}
                          {getReadableSpeechAvatarName(event.effect.speechAvatarId)}.
                        </>
                      )}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-yellow-100/25 bg-black/45 px-4 py-3 text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-yellow-100/70">
                      Ends In
                    </p>
                    <p className="mt-1 text-2xl font-black text-yellow-50">
                      {formatEventCountdown(currentTime > 0 ? new Date(event.ends_at).getTime() - currentTime : 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <RecentTributesTicker
          currentUsername={effectiveDisplayName ?? username}
          topTributes={topTributes}
          tributes={recentTributes}
          showRecentOpenings={activePanel === "crates"}
          usernameStyle={usernameStyle}
        />

        {null}

        {isTimeoutActive && (
          <section
            className={`rounded-[1.5rem] border px-4 py-4 shadow-[0_0_34px_rgba(250,204,21,0.14)] ${
              isUnderageTimeoutActive
                ? "border-red-200/45 bg-[linear-gradient(135deg,rgba(127,29,29,0.45),rgba(236,72,153,0.13),rgba(0,0,0,0.72))]"
                : "border-yellow-200/35 bg-[linear-gradient(135deg,rgba(250,204,21,0.18),rgba(236,72,153,0.1),rgba(0,0,0,0.55))]"
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p
                  className={`text-xs font-black uppercase tracking-[0.28em] ${
                    isUnderageTimeoutActive ? "text-red-100" : "text-yellow-100"
                  }`}
                >
                  {isUnderageTimeoutActive ? "Special Safety Timeout" : "Timeout Active"}
                </p>
                <p className="mt-2 text-sm leading-6 text-yellow-50">
                  {timeoutMessage}
                </p>
                {isUnderageTimeoutActive && (
                  <p className="mt-2 rounded-2xl border border-red-200/20 bg-black/35 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-red-50">
                    This is a serious account restriction. Contact @VMPrincipessa only with proof.
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-yellow-100/25 bg-black/45 px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-yellow-100/70">
                  Time Remaining
                </p>
                <p className="mt-1 text-2xl font-black text-yellow-50">
                  {isUnderageTimeoutActive
                    ? formatLongTimeoutDuration(timeoutRemaining)
                    : formatDuration(timeoutRemaining)}
                </p>
                {canSelfClearTimeout ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-yellow-100/70">
                      Clear fee: {TIMEOUT_CLEAR_FEE_PER_HOUR.toLocaleString()} coins per hour
                    </p>
                    <button
                      className="w-full rounded-full border border-yellow-200/30 bg-yellow-400/10 px-3 py-2 text-sm font-black text-yellow-50 transition hover:bg-yellow-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isTimeoutClearPending || coins < timeoutClearFee}
                      onClick={handleTimeoutClear}
                      type="button"
                    >
                      {isTimeoutClearPending
                        ? "Clearing..."
                        : `Pay ${timeoutClearFee.toLocaleString()} coins to clear`}
                    </button>
                  </div>
                ) : isUnderageTimeoutActive ? (
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-red-100/70">
                    No unlock fee. Manual review only.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        )}

        <section className="min-w-0 pb-10">
          {activePanel === "home" && (
            <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="flex min-w-0 flex-col gap-6">
                <CharacterCard
                  dailyMessage={dailyMessage}
                  evolutionStage={characterEvolutionStage}
                  stageRevealToken={affectionStageRevealToken}
                />
                <section className="rounded-[2rem] border border-pink-200/15 bg-[linear-gradient(150deg,rgba(0,0,0,0.68),rgba(67,9,61,0.42))] p-5 shadow-[0_0_40px_rgba(236,72,153,0.12)]">
                  <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-200/70">
                    Affection Read
                  </p>
                  <h2 className="mt-1 text-2xl font-black">Principessa&apos;s Mood</h2>
                  <p className="mt-4 text-sm leading-6 text-pink-50">
                    {scriptedMessage}
                  </p>
                </section>
                <ProfileTaskCard
                  disabled={isTimeoutActive || isPreviewRestricted}
                  isPending={pendingTaskActionIds.includes("rebrand-profile")}
                  onRebrandProfile={handleRebrandProfile}
                />
              </div>

              <div className="flex min-w-0 flex-col gap-6">
                <StatsPanel
                  equippedTitleName={equippedTitle?.name}
                  leadershipTop={leadershipTop}
                  shameTop={shameTop}
                  statValueStyle={equippedUsernameColor?.color ? { color: equippedUsernameColor.color } : undefined}
                  stats={stats}
                  topValuableInventories={topValuableInventories}
                  username={effectiveDisplayName ?? username}
                  usernameStyle={usernameStyle}
                />
              </div>
            </div>
          )}
          {activePanel === "tribute" && (
            <TributePanel
              affection={affection}
              coins={coins}
              disabled={isTimeoutActive || isPreviewRestricted}
              hideAffectionOffer={affection >= 100}
              pending={pendingTaskActionIds.some((id) => id.startsWith("tribute:"))}
              onTribute={handleTribute}
            />
          )}
          {activePanel === "collection" && (
            <GalleryGrid
              items={visibleGallery}
              coins={coins}
              disabled={isTimeoutActive || isPreviewRestricted}
              mood={affection}
              pendingUnlockIds={pendingTaskActionIds
                .filter((id) => id.startsWith("gallery:"))
                .map((id) => id.slice("gallery:".length))}
              onUnlock={handleUnlock}
            />
          )}
          {activePanel === "tasks" && (
            <TaskList
              coins={coins}
              disabled={isTimeoutActive || isPreviewRestricted}
              isJackpotBusy={isJackpotBusy}
              isFreeFridaySpinAvailable={isFreeFridaySpinAvailable}
              onFreeFridaySpinConsumed={() => setFreeFridaySpinAvailable(false)}
              jackpot={jackpot}
              jackpotError={jackpotError}
              globalPrincipessaLevel={globalPrincipessa.level}
              globalPrincipessaProgressPercent={globalPrincipessaProgressPercent}
              globalPrincipessaRequirement={globalPrincipessaRequirement}
              globalPrincipessaXp={globalPrincipessa.xp}
              currentUsername={effectiveDisplayName ?? username}
              mechanics={displayMechanics}
              pendingTaskActionIds={pendingTaskActionIds}
              tasks={tasks}
              usernameStyle={usernameStyle}
              onBeg={handleBeg}
              onClaim={handleClaimTask}
              onCooldownAttempt={handleCooldownAttempt}
              onJackpotContribute={handleJackpotContribute}
              onLevelDrain={handleLevelDrain}
              onCaseOpen={handleCaseOpen}
              onIrlTaskSpin={handleIrlTaskSpin}
              onMovementFail={handleVerticalMotionFail}
              onMovementFinishFakeHope={handleVerticalMotionFinishFakeHope}
              onMovementProgress={handleVerticalMotionProgress}
              onMovementStart={handleVerticalMotionStart}
              onNumberPick={handleNumberPick}
              onSacrifice={handleSacrifice}
              onSupport={handleSupport}
              onTimeoutRisk={handleTimeoutRisk}
              onTimeoutRiskMultiplierChange={handleTimeoutRiskMultiplierChange}
              onTypingProgress={handleTypingProgress}
              timeoutRiskChance={TIMEOUT_RISK_CHANCE}
              timeoutRiskEffectiveDays={timeoutRiskProjectedDays}
              timeoutRiskMaxDays={MAX_TIMEOUT_DAYS}
              timeoutRiskTimeoutHours={TIMEOUT_RISK_TIMEOUT_MS / (60 * 60 * 1000)}
              timeoutRiskReward={eventSafeReward}
              userLevel={userLevel}
              userLevelProgressPercent={userLevelProgress.progressPercent}
              userXpIntoLevel={userLevelProgress.xpIntoLevel}
              userXpRequiredForNext={userLevelProgress.xpRequiredForNext}
              onWaitObedientlyComplete={handleWaitObedientlyComplete}
              onWaitObedientlyFail={handleWaitObedientlyFail}
              onWaitObedientlyStart={handleWaitObedientlyStart}
            />
          )}
          {activePanel === "crates" && (
              <CratesPanel
                coins={coins}
                disabled={isTimeoutActive || isPreviewRestricted}
                crates={availableCrates}
                inventory={crateInventory}
                activeEvents={activeEvents}
                freeOpensUsedToday={crateFreeOpensUsedToday}
                pending={cratePending}
                onOpenCrate={handleOpenCrate}
                onSellItem={handleSellCrateItem}
                onSellAll={handleSellAllCrateItems}
                onSellDuplicates={handleSellDuplicateCrateItems}
                onSellWonItems={handleSellWonCrateItems}
                pityStats={pityStats}
                onCrateOpen={() => {
                  const avatarId = resolveSpeechAvatarIdForMessage();
                  // Use direct set + explicit category so we hit the dedicated "crate_open" pool
                  // (instead of going through setAvatarMistressReply → getSpeechBubbleMessageForText → classify → general).
                  const msg = getSpeechBubbleResponseMessage(avatarId, "crate_open");
                  setSpeechBubbleReply(msg);
                }}
                onCrateResult={(item) => {
                  const avatarId = resolveSpeechAvatarIdForMessage();
                  const rarityKey = `crate_result_${item.rarity}` as const;
                  // Direct set ensures the specific crate_result_rarity category is used (random pick from its pool).
                  // Avoids re-classification that was forcing "general" for equipped speech avatars.
                  const msg = getSpeechBubbleResponseMessage(avatarId, rarityKey);
                  setSpeechBubbleReply(msg);
                }}
              />
          )}
          {activePanel === "shop" && (
              <CosmeticShop
                coins={coins}
                disabled={isTimeoutActive || isPreviewRestricted}
                equippedCosmeticIds={effectiveEquippedCosmeticIds}
                eventSpeechAvatarId={eventSpeechAvatarId}
                ownedCosmeticIds={ownedCosmeticIds}
                ownedTitleIds={ownedTitleIds}
                pendingCosmeticIds={pendingTaskActionIds
                  .filter((id) => id.startsWith("cosmetic:"))
                  .map((id) => id.slice("cosmetic:".length))}
                pendingTitleIds={pendingTaskActionIds
                  .filter((id) => id.startsWith("title:"))
                  .map((id) => id.slice("title:".length))}
                premiumTitle={getPremiumShopTitle()}
                shopItems={cosmeticItems}
                onEquipCosmetic={handleEquipCosmetic}
                onPurchaseCosmetic={handlePurchaseCosmetic}
                onPurchaseTitle={handlePurchaseTitle}
              />
          )}
          {activePanel === "profile" && (
            <div className="flex min-w-0 flex-col gap-6">
              <TitleCollection
                disabled={isTimeoutActive || isPreviewRestricted}
                equippedTitleId={equippedTitleId}
                layout="horizontal"
                ownedTitleIds={ownedTitleIds}
                titles={titleItems}
                onEquipTitle={handleEquipTitle}
              />

              <section className="rounded-[2rem] border border-fuchsia-200/15 bg-[linear-gradient(150deg,rgba(0,0,0,0.62),rgba(88,28,135,0.18))] p-5 shadow-[0_0_28px_rgba(168,85,247,0.08)]">
                <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-200/70">
                  Avatar Wardrobe
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">Profile Customization</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Items grouped by category (hands &amp; mouth added). Click items to equip or unequip. Avatar preview updates live.
                </p>
                <div className="mt-5 grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div className="flex min-w-0 flex-col rounded-[1.5rem] border border-white/10 bg-black/35 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-100/70">
                      Avatar Preview
                    </p>

                    <div className="flex flex-col xl:flex-row gap-2 mt-1 flex-1 min-h-0">
                      {/* Avatar */}
                      <div className="flex-1 min-w-0">
                        <div className="relative h-[440px] overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/40">
                          <LayeredAvatar
                            alt="Avatar wardrobe preview"
                            className="absolute inset-0"
                            equipped={isAvatarActionPending ? committedEquippedRef.current : equippedAvatarSlots}
                            hasUncensored={hasUncensoredAvatar}
                            imageClassName="object-contain object-center"
                          />
                        </div>
                      </div>

                      {/* Slim vertical equipped rail */}
                      <div className="xl:w-52 w-full flex-shrink-0 xl:flex-col flex flex-row flex-wrap gap-1.5 text-xs xl:border-l xl:pl-2 xl:border-t-0 border-t xl:pt-0 pt-2 border-white/10">
                        {AVATAR_SLOT_ORDER.map((slot) => {
                          const equippedItemId = equippedAvatarSlots[slot];
                          const isFiltered = wardrobeCategoryFilter === slot;

                          if (!equippedItemId) {
                            return (
                              <div
                                key={slot}
                                onClick={() => setWardrobeCategoryFilter(wardrobeCategoryFilter === slot ? null : slot)}
                                className={`flex items-center gap-1.5 px-1 py-0.5 rounded opacity-30 cursor-pointer hover:opacity-50 ${isFiltered ? 'opacity-60 bg-pink-500/5 ring-1 ring-pink-300/40' : ''}`}
                              >
                                <div className="w-5 h-5 rounded-sm bg-white/10" />
                                <span className="truncate">{SLOT_LABELS[slot]}</span>
                              </div>
                            );
                          }

                          const equippedItemName = inventoryItemNameById.get(equippedItemId) ?? equippedItemId;
                          const equippedItemIcon = resolveAvatarItemIconPath(equippedItemId);

                          return (
                            <div
                              key={slot}
                              className={`flex items-center gap-1.5 px-1 py-0.5 rounded border cursor-pointer transition text-[10px] ${isFiltered ? 'border-pink-300 bg-pink-500/10 ring-1 ring-pink-300/40' : 'border-white/10 hover:border-white/30'}`}
                              onClick={() => setWardrobeCategoryFilter(wardrobeCategoryFilter === slot ? null : slot)}
                            >
                              {equippedItemIcon ? (
                                <div className="relative w-5 h-5 shrink-0">
                                  <Image
                                    alt=""
                                    src={equippedItemIcon}
                                    fill
                                    className="object-contain"
                                    unoptimized
                                  />
                                </div>
                              ) : (
                                <div className="w-5 h-5 border rounded" />
                              )}
                              <span className="flex-1 truncate">{equippedItemName}</span>
                              <button
                                disabled={isAvatarActionPending}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (isAvatarActionPending) return;
                                  setIsAvatarActionPending(true);
                                  try {
                                    const res = await fetch("/api/user/wardrobe", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ action: "unequip", slot }),
                                    });
                                    const data = await res.json();
                                    if (res.ok && data.equipped) {
                                      setEquippedAvatarSlots(data.equipped);
                                      committedEquippedRef.current = data.equipped;
                                      void loadCratesData();
                                    }
                                  } catch (err) {
                                    console.error("Unequip error", err);
                                  } finally {
                                    setIsAvatarActionPending(false);
                                  }
                                }}
                                className="text-pink-400 hover:text-red-400 px-0.5"
                                aria-label="Unequip"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                        {Object.keys(equippedAvatarSlots).length === 0 && (
                          <span className="text-zinc-500">None</span>
                        )}
                      </div>
                    </div>

                    {/* Uncensored - kept compact */}
                    <div className="mt-3 rounded-[1.1rem] border border-white/10 bg-black/25 p-2 text-[10px]">
                      {hasUncensoredAvatar ? (
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <span>✓</span>
                          <span className="font-black uppercase tracking-widest">Uncensored Unlocked</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-zinc-300">Unlock full uncensored</span>
                          <button
                            className="rounded border border-pink-300/40 bg-pink-500/10 px-2 py-0.5 font-black text-pink-200 disabled:opacity-50"
                            disabled={coins < 10000 || isTimeoutActive || isPreviewRestricted}
                            onClick={async () => {
                              try {
                                const res = await fetch("/api/user/wardrobe", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ action: "unlock-uncensored" }),
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  if (data.hasUncensored) setHasUncensoredAvatar(true);
                                  if (typeof data.coins === "number") setCoins(data.coins);
                                  emitSoundEvent("cosmetic_purchased");
                                  setAvatarMistressReply("Uncensored unlocked.");
                                } else {
                                  setAvatarMistressReply(data.error || "Unlock failed.");
                                }
                              } catch (e) {
                                setAvatarMistressReply("Unlock failed.");
                              }
                            }}
                            type="button"
                          >
                            10k coins
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 rounded-[1.5rem] border border-white/5 bg-black/30 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-100/70">
                      Wardrobe Items
                      {wardrobeCategoryFilter && (
                        <button
                          className="ml-2 text-[10px] uppercase tracking-[0.14em] text-pink-300 hover:underline"
                          onClick={() => setWardrobeCategoryFilter(null)}
                          type="button"
                        >
                          Show all
                        </button>
                      )}
                    </p>
                    {Object.keys(equippableByCategory).length === 0 ? (
                      <div className="mt-4 rounded-[1.2rem] border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-zinc-400">
                        No equippable crate items yet.
                      </div>
                    ) : (
                      <div className="mt-1 h-[440px] overflow-y-auto pr-2 space-y-4">
                        {AVATAR_SLOT_ORDER.map((slot) => {
                          if (wardrobeCategoryFilter && slot !== wardrobeCategoryFilter) return null;
                          const items = equippableByCategory[slot] || [];
                          if (items.length === 0) return null;

                          return (
                            <div key={slot}>
                              <div className="mb-2 flex items-center justify-between">
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-100/70">
                                  {SLOT_LABELS[slot]}
                                </p>
                                <span className="text-[10px] text-zinc-500">{items.length} items</span>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {items.map((item) => {
                                  const isEquipped = equippedAvatarSlots[slot] === item.item_id;

                                  return (
                                    <button
                                      className={`rounded-[1.1rem] border px-3 py-2 text-left ${getRarityCardClasses(item.rarity, isEquipped)}`}
                                      key={`${item.item_id}:${item.variant}`}
                                      disabled={isAvatarActionPending}
                                      onClick={async () => {
                                        if (isAvatarActionPending) return;
                                        const action = isEquipped ? "unequip" : "equip";
                                        const body: any = isEquipped
                                          ? { action: "unequip", slot }
                                          : { action: "equip", itemId: item.item_id };
                                        setIsAvatarActionPending(true);
                                        try {
                                          const res = await fetch("/api/user/wardrobe", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify(body),
                                          });
                                          const data = await res.json();
                                          if (!res.ok) {
                                            console.error("Wardrobe action failed", data);
                                            return;
                                          }
                                          if (data.equipped) {
                                            setEquippedAvatarSlots(data.equipped);
                                            committedEquippedRef.current = data.equipped;
                                            void loadCratesData();
                                          }
                                        } catch (e) {
                                          console.error("Wardrobe equip error", e);
                                        } finally {
                                          setIsAvatarActionPending(false);
                                        }
                                      }}
                                      type="button"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2">
                                            {(() => {
                                              const iconSrc = resolveAvatarItemIconPath(item.item_id) || item.image_url || null;
                                              return iconSrc ? (
                                                <div className="relative w-5 h-5 flex-shrink-0">
                                                  <Image
                                                    alt={item.name}
                                                    src={iconSrc}
                                                    fill
                                                    className="object-contain"
                                                    unoptimized
                                                  />
                                                </div>
                                              ) : null;
                                            })()}
                                            <p className="truncate text-sm font-black text-white">
                                              {item.name}
                                            </p>
                                          </div>
                                          <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-fuchsia-200/70">
                                            {isEquipped ? "Equipped (tap to remove)" : slot}
                                          </p>
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-1">
                                          <span
                                            className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] ${getRarityPillClasses(item.rarity)}`}
                                          >
                                            {item.rarity}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-200">
                                              x{item.quantity}
                                            </span>
                                            {isEquipped && <span className="text-pink-300">✓</span>}
                                          </div>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}
          {activePanel === "pet" && isPetUnlocked && (
            <PetSection
              disabled={isTimeoutActive || isPreviewRestricted}
              coins={coins}
              galleryItems={petGalleryItems}
              isGuest={isGuestMode}
              isDebtAutoPayEnabled={isDebtAutoPayEnabled}
              favorCoinReward={eventFavorCoinReward}
              nextTaxDueAt={nextPetTaxDueAt}
              ownerLikeness={ownerLikeness}
              petReviewTaskCoinReward={PET_REVIEW_TASK_COIN_REWARD}
              petTaskCoinReward={eventPetTaskCoinReward}
              petDebtContract={petDebtContract}
              petGalleryUnlockedIds={petGalleryUnlockedIds}
              petScore={petScore}
              petAffectionClaimed={petAffectionClaimed}
              storedRights={storedRights}
              rightExpirations={rightExpirations}
              dailyPurchaseCount={dailyPurchaseCount}
              rightPurchaseDate={rightPurchaseDate}
              pendingPetActionIds={pendingPetActionIds}
              tasks={petTaskState}
              weeklyTaxCost={currentWeeklyTaxCost}
              onBuyRight={() => handleRightsAction("buy")}
              onClaimAffection={() => runPetAction("pet-affection-claim", handlePetAffectionClaim)}
              onConfessionSubmit={(value, options) =>
                runPetAction("pet-confession-dm", () => handlePetConfessionSubmit(value, options))
              }
              onCompleteTask={(taskId) => runPetAction(taskId, () => handlePetTaskComplete(taskId))}
              onCooldownAttempt={handleCooldownAttempt}
              onFalseHopeKey={handlePetFalseHopeKey}
              onFavorPick={(index) => runPetAction("pet-favor-roulette", () => handlePetFavorPick(index))}
              onHighLowPlay={handleHighLowPlay}
              highLowAllowanceCap={HIGH_LOW_BET_ALLOWANCE}
              highLowProfitCap={HIGH_LOW_PROFIT_LIMIT}
              onPetDailyClick={handlePetDailyClick}
              onDebtAutoPayChange={handleDebtAutoPayChange}
              onPayDebtPeriod={() => runPetAction("pet-debt-contract", handleDebtContractPayment)}
              onPayWeeklyTax={() => runPetAction("pet-weekly-throne-tax", handlePetWeeklyTax)}
              onPetEvilWaitComplete={() => runPetAction("pet-evil-wait", handlePetEvilWaitComplete)}
              onPetEvilWaitFail={() => runPetAction("pet-evil-wait", handlePetEvilWaitFail)}
              onPetEvilWaitStart={() => runPetAction("pet-evil-wait", handlePetEvilWaitStart)}
              onPerfectWritingProgress={handlePetPerfectWritingProgress}
              onSignDebtContract={handleDebtContractSign}
              onUseRight={() => handleRightsAction("use")}
            />
          )}
        </section>
      </AppShell>
      <FloatingDefneBubble
        avatarSrc={equippedSpeechAvatar?.image ?? "/character-icon.png"}
        globalPrincipessaLevel={globalPrincipessa.level}
        message={mistressReply}
        messageId={bubbleMessageId}
        messageStyle={equippedUsernameColor?.color ? { color: equippedUsernameColor.color } : undefined}
        onBubbleFullyHidden={handleBubbleFullyHidden}
      />
      {typingPraiseVisible && (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-[120] flex justify-center px-4">
          <div className="rounded-full border border-emerald-300/35 bg-emerald-500/15 px-5 py-2 text-sm font-black text-emerald-100 shadow-[0_0_26px_rgba(16,185,129,0.28)] backdrop-blur-sm">
            Good Boy!
          </div>
        </div>
      )}

      {/* Display Name change is now done via pencil in Profile tab using purchased rights */}
    </main>
  );
}



