"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { CharacterCard } from "@/components/CharacterCard";
import { CosmeticShop } from "@/components/CosmeticShop";
import { FloatingDefneBubble } from "@/components/FloatingDefneBubble";
import { GalleryGrid } from "@/components/GalleryGrid";
import { LoginScreen } from "@/components/LoginScreen";
import { PetSection } from "@/components/PetSection";
import {
  RecentTributesTicker,
  type RecentTribute,
} from "@/components/RecentTributesTicker";
import { StatsPanel } from "@/components/StatsPanel";
import { TaskList } from "@/components/TaskList";
import { TitleCollection } from "@/components/TitleCollection";
import { TributePanel } from "@/components/TributePanel";
import { isTrustedAdminUsername } from "@/lib/admin-identity";
import {
  cosmeticItems,
  DEFAULT_SPEECH_AVATAR_ID,
  getCosmeticItem,
  getSpeechBubbleMessageForText,
  getSpeechBubbleMessagePool,
  getTitleItem,
  titleItems,
  type CosmeticItem,
  type CosmeticType,
  type TitleItem,
} from "@/lib/cosmetics";
import type { RandomEvent } from "@/lib/events";
import {
  getRandomIrlTaskDurationMinutes,
  getRandomIrlTaskPenaltyMinutes,
  IRL_TASK_WHEEL_COST,
  irlTaskWheelSegments,
} from "@/lib/irl-task-wheel";
import { JACKPOT_MIN_CONTRIBUTION, type LoyaltyJackpotState } from "@/lib/jackpot";
import type { LeadershipEntry, ShameEntry } from "@/lib/leadership";
import { emitSoundEvent } from "@/lib/sound";
import {
  profileAvatarFromUser,
  profileUsernameFromUser,
  isSupabaseConfigured,
  supabase,
  type Profile,
} from "@/lib/supabase/client";
import type {
  GalleryItem,
  MechanicsState,
  PetCaseItem,
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
    unlockCost: 300,
    tag: "Pole Dancer",
    image: "/gallery/common-1.png",
    unlocked: false,
  },
  {
    id: "common-midnight-maid",
    title: "Leather Eclipse",
    rarity: "Common",
    unlockCost: 300,
    tag: "Rebel",
    image: "/gallery/common-2.png",
    unlocked: false,
  },
  {
    id: "common-executive-glare",
    title: "Golden Lust",
    rarity: "Common",
    unlockCost: 300,
    tag: "Gorgeous",
    image: "/gallery/common-3.png",
    unlocked: false,
  },
  {
    id: "common-rose-vault",
    title: "Silk & Vintage",
    rarity: "Common",
    unlockCost: 300,
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

const profileSelect =
  "id, username, email, avatar_url, coins, affection, tribute_total, shame_count, is_admin, loyalty_streak, last_loyalty_at, last_login_at, timeout_until, pet_score, owner_likeness, pet_unlocked_at, last_pet_decay_at, last_owner_likeness_at, last_pet_tax_at, created_at, updated_at";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const PET_WEEKLY_TAX_COST = 5000;
const PET_TASK_REWARD = 10;
const PET_TASK_COIN_REWARD = 300;
const PET_EVIL_WAIT_MS = 2 * 60 * 1000;
const PET_FAVOR_EMPTY_DAY_CHANCE = 0.12;
const PET_FAVOR_ROULETTE_COIN_REWARD = 500;
const LOCAL_GUEST_USER_ID = "local-guest-user";
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
const PET_X_POST_URL = `https://x.com/intent/tweet?text=I%20belong%20to%20Principessa.%20My%20small%20dick%20is%20completely%20hers.%20Every%20night%20I%E2%80%99m%20forced%20to%20fill%20my%20mandatory%20humiliation%20report%20like%20the%20pathetic%20pet%20I%20am.%0A%0ACraving%20the%20same%20shame%20and%20control%3F%0A%0AClick%20Here%20%E2%9C%85%0Ahttps%3A%2F%2Fvault-mistress.vercel.app%0A%0AWeak.%20Leaking.%20Addicted.%20%F0%9F%92%B8%F0%9F%94%97`;
void PET_X_POST_TEXT;
const PET_RULE_MECHANICS = [
  { id: "tribute", label: "Tribute" },
  { id: "gallery", label: "Gallery Unlock" },
  { id: "beg", label: "Beg" },
  { id: "higher-lower", label: "Higher or Lower" },
  { id: "number-pick", label: "Number Pick" },
    { id: "typing-accuracy", label: "Typing Accuracy" },
    { id: "wait-obediently", label: "Wait Obediently" },
    { id: "timeout-risk", label: "Risk My Freedom" },
    { id: "daily-login", label: "Login Reward" },
];
const MAX_TIMEOUT_DAYS = 1;
const TIMEOUT_RISK_TIMEOUT_MS = 12 * 60 * 60 * 1000;
const TIMEOUT_RISK_DAILY_SAFE_LIMIT = 2;
const SAFE_REWARD = 150;
const BEG_REWARD = 50;
const SACRIFICE_COST = 250;
const SACRIFICE_SUCCESS_COOLDOWN_MS = 60 * 60 * 1000;
const SACRIFICE_UNLOCK_CHANCE = 0.5;
const SUPPORT_COST = 1000;
const TIMEOUT_RISK_CHANCE = 0.2;
const HIGH_LOW_PROFIT_LOCK = 5000;
const STREAK_BONUSES = [
  { id: "streak-bonus-1", milestone: 1, reward: 75, title: "1 day streak bonus" },
  { id: "streak-bonus-3", milestone: 3, reward: 225, title: "3 day streak bonus" },
  { id: "streak-bonus-7", milestone: 7, reward: 600, title: "7 day streak bonus" },
  { id: "streak-bonus-15", milestone: 15, reward: 1500, title: "15 day streak bonus" },
  { id: "streak-bonus-30", milestone: 30, reward: 3000, title: "30 day streak bonus" },
] as const;
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
    reward: PET_TASK_REWARD,
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
    id: "pet-case-opening",
    title: "Pet Case Opening",
    description: "Open a luxury case and let the vault decide your random coin reward.",
    reward: PET_TASK_REWARD,
    kind: "case-open",
  },
  {
    id: "pet-evil-wait",
    title: "Evil Wait Obediently",
    description: "After a 3 second countdown, do nothing for 2 minutes while distractions appear.",
    reward: PET_TASK_REWARD,
    kind: "evil-wait",
  },
  {
    id: "pet-randomized-rules",
    title: "Randomized Rules",
    description: "Daily forbidden mechanics. Type I understand to lock the rule until reset.",
    reward: PET_TASK_REWARD,
    kind: "randomized-rules",
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
    reward: 500,
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
    reward: 250,
    completed: false,
    claimed: false,
    kind: "typing",
    attemptsRemaining: 3,
  },
  {
    id: "high-low",
    title: "High or Lower",
    reward: 0,
    completed: false,
    claimed: false,
    kind: "high-low",
  },
  {
    id: "number-pick",
    title: "Number Pick",
    reward: 75,
    completed: false,
    claimed: false,
    kind: "number-pick",
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
    reward: 150,
    completed: false,
    claimed: false,
    kind: "wait-obediently",
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
    return error.stack || error.message;
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

function isWithinLast24Hours(value: string | null) {
  if (!value) {
    return false;
  }

  return Date.now() - new Date(value).getTime() < 24 * 60 * 60 * 1000;
}

function getDailyCooldownUntil(value: string | null) {
  if (!value || !isWithinLast24Hours(value)) {
    return null;
  }

  return new Date(new Date(value).getTime() + 24 * 60 * 60 * 1000).toISOString();
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
  return getCooldownUntil(value, DAY_MS);
}

function buildPetTasksFromRows(rows: UserPetTaskRow[]) {
  return petTasks.map((task) => {
    const row = rows.find((entry) => entry.task_id === task.id);
    const baseStatus = (row?.status as PetTaskItem["status"]) ?? "available";
    const completedAt = row?.completed_at ?? null;

    if (task.kind === "perfect-writing") {
      const failedAt = getTaskMetadataString(row?.metadata, "failedAt");
      const cooldownUntil = getPetTaskCooldownUntil(completedAt ?? failedAt);

      return {
        ...task,
        attemptsRemaining: cooldownUntil ? 0 : 1,
        completedAt,
        cooldownUntil,
        reviewedAt: row?.reviewed_at ?? null,
        sentence: getDailyPetPerfectWritingSentence(),
        status: cooldownUntil ? baseStatus : "available",
      };
    }

    if (task.kind === "confession-writing") {
      const cooldownUntil = getPetTaskCooldownUntil(completedAt);

      return {
        ...task,
        completedAt,
        confessionCount: cooldownUntil ? 5 : getTaskMetadataNumber(row?.metadata, "count", 0),
        cooldownUntil,
        reviewedAt: row?.reviewed_at ?? null,
        sentence: getDailyPetConfessionSentence(),
        status: cooldownUntil ? baseStatus : "available",
      };
    }

    if (task.kind === "weekly-tax") {
      return {
        ...task,
        completedAt,
        cooldownUntil: getCooldownUntil(completedAt, WEEK_MS),
        reviewedAt: row?.reviewed_at ?? null,
        status: baseStatus,
      };
    }

    if (task.kind === "debt-contract") {
      return {
        ...task,
        completedAt,
        reviewedAt: row?.reviewed_at ?? null,
        status: baseStatus,
      };
    }

    if (task.kind === "case-open") {
      return {
        ...task,
        caseReward: getTaskMetadataNumber(row?.metadata, "reward", 0) || null,
        caseSpunAt: completedAt,
        completedAt,
        cooldownUntil: getPetTaskCooldownUntil(completedAt),
        reviewedAt: row?.reviewed_at ?? null,
        status: baseStatus,
      };
    }

    if (task.kind === "evil-wait") {
      const status = getTaskMetadataString(row?.metadata, "status");
      const waitState: PetTaskItem["waitState"] = getPetTaskCooldownUntil(row?.completed_at ?? null)
        ? "cooldown"
        : status === "completed"
          ? "completed"
          : status === "failed"
            ? "failed"
            : status === "waiting"
              ? "waiting"
              : status === "countdown"
                ? "countdown"
                : "ready";

      return {
        ...task,
        completedAt,
        cooldownUntil: getPetTaskCooldownUntil(row?.completed_at ?? null),
        reviewedAt: row?.reviewed_at ?? null,
        status: baseStatus,
        waitCountdownEndsAt: getTaskMetadataString(row?.metadata, "countdownEndsAt"),
        waitEndsAt: getTaskMetadataString(row?.metadata, "waitEndsAt"),
        waitState,
      };
    }

    if (task.kind === "randomized-rules") {
      const dailyRules = getDailyPetRuleMechanics();
      const metadataDate = getTaskMetadataString(row?.metadata, "date");
      const isToday = metadataDate === getDailyKey();
      const ruleAcknowledged = isToday && getTaskMetadataString(row?.metadata, "acknowledged") === "true";

      return {
        ...task,
        completedAt: isToday ? completedAt : null,
        cooldownUntil: isToday && completedAt ? getPetTaskCooldownUntil(completedAt) : null,
        reviewedAt: row?.reviewed_at ?? null,
        ruleAcknowledged,
        ruleBannedMechanics: dailyRules.map((rule) => rule.id),
        status: isToday ? baseStatus : "available",
      };
    }

    if (task.kind === "false-hope") {
      const cooldownUntil = getPetTaskCooldownUntil(completedAt);
      const isCoolingDown = Boolean(cooldownUntil);
      const hasActiveProgress = !completedAt;
      const progress = getTaskMetadataNumber(row?.metadata, "progress", 0);
      const stage = getTaskMetadataNumber(row?.metadata, "stage", 1);
      const expectedKeyRaw = getTaskMetadataString(row?.metadata, "expectedKey");
      const expectedKey: "a" | "d" = expectedKeyRaw === "d" ? "d" : "a";

      return {
        ...task,
        completedAt: isCoolingDown ? completedAt : null,
        cooldownUntil,
        falseHopeExpectedKey: isCoolingDown || hasActiveProgress ? expectedKey : "a",
        falseHopeProgress: isCoolingDown || hasActiveProgress ? progress : 0,
        falseHopeStage: isCoolingDown || hasActiveProgress ? stage : 1,
        reviewedAt: null,
        status: "available" as const,
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
        reviewedAt: isCoolingDown ? row?.reviewed_at ?? null : null,
        status: isCoolingDown ? baseStatus : "available",
      };
    }

    if (task.id === "pet-voice-proof") {
      return {
        ...task,
        status: baseStatus,
        completedAt,
        reviewedAt: row?.reviewed_at ?? null,
        cooldownUntil: getPetTaskCooldownUntil(completedAt),
        voiceSentence: getDailyPetVoiceSentence(),
      };
    }

    return {
      ...task,
      status: baseStatus,
      completedAt,
      reviewedAt: row?.reviewed_at ?? null,
      cooldownUntil: getPetTaskCooldownUntil(completedAt),
    };
  });
}

function getEffectiveTimeoutDays(timeoutValue: string | null, now = Date.now()) {
  if (!timeoutValue) {
    return 0;
  }

  const remainingMs = new Date(timeoutValue).getTime() - now;

  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / DAY_MS);
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
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u00B4`]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"');
}

function writingStartsWith(sentence: string, value: string) {
  return normalizeWritingComparisonText(sentence).startsWith(
    normalizeWritingComparisonText(value),
  );
}

function writingEquals(sentence: string, value: string) {
  return normalizeWritingComparisonText(sentence) === normalizeWritingComparisonText(value);
}

function getDailyPetRuleMechanics() {
  const dayKey = getDailyKey();
  const seed = dayKey.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const first = seed % PET_RULE_MECHANICS.length;
  let second = (seed * 3 + 2) % PET_RULE_MECHANICS.length;

  if (second === first) {
    second = (second + 1) % PET_RULE_MECHANICS.length;
  }

  return [PET_RULE_MECHANICS[first], PET_RULE_MECHANICS[second]];
}

function getPetRuleMechanicLabel(mechanicId: string) {
  return PET_RULE_MECHANICS.find((entry) => entry.id === mechanicId)?.label ?? mechanicId;
}

function getDailyTypingSentence() {
  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return typingSentencePool[dayIndex % typingSentencePool.length];
}

function getDailyPetVoiceSentence() {
  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return petVoiceSentencePool[dayIndex % petVoiceSentencePool.length];
}

function getDailyPetPerfectWritingSentence() {
  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return petPerfectWritingSentencePool[dayIndex % petPerfectWritingSentencePool.length];
}

function getDailyPetConfessionSentence() {
  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return petConfessionSentencePool[dayIndex % petConfessionSentencePool.length];
}

function getDebtAutoPayStorageKey(userId: string) {
  return `${DEBT_AUTO_PAY_STORAGE_PREFIX}:${userId}`;
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

function randomHighLowNumber() {
  return Math.floor(Math.random() * 10) + 1;
}

function randomHighLowDisplayNumber() {
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

function getDailyKey() {
  return new Date().toISOString().slice(0, 10);
}

function isHighLowLocked(dailyProfit: number) {
  return dailyProfit >= HIGH_LOW_PROFIT_LOCK;
}

function getStreakCycleKey(streak: number, lastLoyaltyAt: string | null) {
  if (!lastLoyaltyAt || streak <= 0) {
    return null;
  }

  const cycleStart = new Date(lastLoyaltyAt);
  cycleStart.setUTCDate(cycleStart.getUTCDate() - (streak - 1));
  return cycleStart.toISOString().slice(0, 10);
}

function generateNumberPickOptions(seed = Math.floor(Date.now() / (24 * 60 * 60 * 1000))) {
  const options = new Set<number>();
  let step = 0;

  while (options.size < 3) {
    const raw = Math.sin(seed * 997 + step * 37) * 10000;
    options.add(Math.floor((raw - Math.floor(raw)) * 99) + 1);
    step += 1;
  }

  return [...options];
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
    const row = rows.find((entry) => entry.task_id === task.id);
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
      const cycleKey = getStreakCycleKey(loyaltyStreak, lastLoyaltyAt);
      const claimedCycleKey = getTaskMetadataString(row?.metadata, "cycleKey");
      const claimed = Boolean(row?.claimed_at && cycleKey && claimedCycleKey === cycleKey);

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

    if (task.id === "high-low") {
      const highLowCooldownUntil = getCooldownUntil(row?.claimed_at ?? null, 15 * 1000);
      const dailyDate = getTaskMetadataString(row?.metadata, "higherLowerDailyDate");
      const today = getDailyKey();
      const dailyProfit =
        dailyDate === today
          ? getTaskMetadataNumber(
              row?.metadata,
              "higherLowerDailyProfit",
              getTaskMetadataNumber(row?.metadata, "higherLowerDailyWinnings", 0),
            )
          : 0;
      const dailyWins =
        dailyDate === today
          ? getTaskMetadataNumber(row?.metadata, "higherLowerDailyWins", 0)
          : 0;

      return {
        ...task,
        completed: Boolean(row?.completed_at),
        claimed: Boolean(highLowCooldownUntil),
        cooldownUntil: highLowCooldownUntil,
        currentNumber: randomHighLowDisplayNumber(),
        highLowDailyDate: today,
        highLowDailyLocked: isHighLowLocked(dailyProfit),
        highLowDailyProfit: dailyProfit,
        highLowDailyWins: dailyWins,
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
      const waitState: TaskItem["waitState"] = cooldownUntil
        ? "cooldown"
        : status === "completed"
          ? "completed"
          : status === "failed"
            ? "failed"
            : "ready";

      return {
        ...task,
        claimed: Boolean(cooldownUntil),
        completed: status === "completed",
        cooldownUntil,
        waitCountdownEndsAt: getTaskMetadataString(row?.metadata, "countdownEndsAt"),
        waitEndsAt: getTaskMetadataString(row?.metadata, "waitEndsAt"),
        waitState,
      };
    }

    if (task.id === "timeout-risk") {
      const resetAt = getTaskMetadataString(row?.metadata, "resetAt");
      const safeWins = resetAt && new Date(resetAt).getTime() > Date.now()
        ? getTaskMetadataNumber(row?.metadata, "safeWins", 0)
        : 0;

      return {
        ...task,
        completed: safeWins >= TIMEOUT_RISK_DAILY_SAFE_LIMIT,
        lastResult: getTaskMetadataString(row?.metadata, "lastResult"),
        timeoutUntil,
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
  const [isAuthLoading, setIsAuthLoading] = useState(isSupabaseConfigured);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [username, setUsername] = useState("@littledevotee");
  const [coins, setCoins] = useState(100);
  const coinsRef = useRef(coins);
  const [affection, setAffection] = useState(0);
  const [loyaltyStreak, setLoyaltyStreak] = useState(0);
  const [lastLoyaltyAt, setLastLoyaltyAt] = useState<string | null>(null);
  const [tributeTotal, setTributeTotal] = useState(0);
  const [petScore, setPetScore] = useState(0);
  const [ownerLikeness, setOwnerLikeness] = useState(100);
  const [petUnlockedAt, setPetUnlockedAt] = useState<string | null>(null);
  const [lastPetTaxAt, setLastPetTaxAt] = useState<string | null>(null);
  const [petDebtContract, setPetDebtContract] = useState<PetDebtContract | null>(null);
  const [isDebtAutoPayEnabled, setIsDebtAutoPayEnabled] = useState(false);
  const [petTaskState, setPetTaskState] = useState<PetTaskItem[]>(petTasks);
  const petTaskStateRef = useRef<PetTaskItem[]>(petTasks);
  const [petAffectionClaimed, setPetAffectionClaimed] = useState(false);
  const [petGalleryUnlockedIds, setPetGalleryUnlockedIds] = useState<string[]>([]);
  const [timeoutUntil, setTimeoutUntil] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [bubbleHiddenTick, setBubbleHiddenTick] = useState(0);
  const [fullyHiddenBubbleMessage, setFullyHiddenBubbleMessage] = useState("");
  const [unlockedGalleryIds, setUnlockedGalleryIds] = useState<string[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [leadershipTop, setLeadershipTop] = useState<LeadershipEntry[]>([]);
  const [shameTop, setShameTop] = useState<ShameEntry[]>([]);
  const [recentTributes, setRecentTributes] = useState<RecentTribute[]>([]);
  const [topTributes, setTopTributes] = useState<RecentTribute[]>([]);
  const [pendingTaskActionIds, setPendingTaskActionIds] = useState<string[]>([]);
  const [pendingPetActionIds, setPendingPetActionIds] = useState<string[]>([]);
  const [activeEvent, setActiveEvent] = useState<RandomEvent | null>(null);
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
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [pendingIrlReviewCount, setPendingIrlReviewCount] = useState(0);
  const [mechanics, setMechanics] = useState<MechanicsState>({
    supportUnlocked: false,
    sacrificeUnlockedCount: 0,
    sacrificeTotal: sacrificeGalleryItems.length,
    sacrificeComplete: false,
    allGalleryComplete: false,
  });
  const [activePanel, setActivePanel] = useState<"tribute" | "gallery" | "tasks" | "shop" | "pet">("tribute");
  const [mistressReply, setMistressReply] = useState(
    "The vault is hungry. Drain yourself properly for Principessa.",
  );
  const lastIdleLineIndexRef = useRef(-1);
  const highLowRefreshTimerRef = useRef<number | null>(null);
  const profileIdRef = useRef<string | null>(null);
  const authProfileLoadInFlightRef = useRef<string | null>(null);
  const authProfileLoadedRef = useRef<string | null>(null);
  const loadProfileRef = useRef<((user: User) => Promise<Profile>) | null>(null);
  const updateLoyaltyForProfileRef = useRef<((profile: Profile) => Promise<Profile>) | null>(null);
  const authReplyRef = useRef<((message: string) => void) | null>(null);
  const timeoutUntilRef = useRef<string | null>(null);
  const falseHopePersistQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingTaskActionsRef = useRef(new Set<string>());
  const pendingPetActionsRef = useRef(new Set<string>());
  const isPreviewRestricted = isPreviewMode;

  const characterEvolutionStage = getAffectionCharacterStage(affection);
  const dailyMessage = getAffectionDailyMessage(affection);
  const equippedSpeechAvatar =
    getCosmeticItem(equippedCosmeticIds["speech-avatar"] ?? DEFAULT_SPEECH_AVATAR_ID) ??
    getCosmeticItem(DEFAULT_SPEECH_AVATAR_ID);
  const equippedUsernameColor = getCosmeticItem(equippedCosmeticIds["username-color"] ?? "");
  const equippedUsernameGlow = getCosmeticItem(equippedCosmeticIds["username-glow"] ?? "");
  const equippedTitle = getTitleItem(equippedTitleId ?? "") ?? getTitleItem(getDefaultTitleId(tributeTotal));
  const usernameStyle = {
    color: equippedUsernameColor?.color,
    textShadow: equippedUsernameGlow?.glow,
  };
  const setAvatarMistressReply = useCallback(
    (message: string) => {
      const avatarId = equippedSpeechAvatar?.id ?? DEFAULT_SPEECH_AVATAR_ID;
      setMistressReply(getSpeechBubbleMessageForText(avatarId, message));
    },
    [equippedSpeechAvatar?.id],
  );
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
      activeEvent?.effect.type === type ? activeEvent.effect.multiplier : fallback,
    [activeEvent],
  );
  const getEventTaskReward = useCallback(
    (baseReward: number) =>
      Math.round(baseReward * getEventMultiplier("task_reward_multiplier")),
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

    const persistUnlocks = missingTitleIds.length > 0
      ? supabase.from("user_titles").upsert(
        missingTitleIds.map((titleId) => ({
          user_id: authUserId,
          title_id: titleId,
          source: "progression",
          equipped: false,
        })),
        { onConflict: "user_id,title_id" },
      )
      : Promise.resolve({ error: null });

    void persistUnlocks.then(async ({ error }) => {
      if (error) {
        console.error("Failed to persist progression title unlocks", error);
        return;
      }

      if (!shouldAutoEquipProgressionTitle) {
        return;
      }

      const { error: clearError } = await supabase
        .from("user_titles")
        .update({ equipped: false })
        .eq("user_id", authUserId);

      if (clearError) {
        console.error("Failed to clear equipped progression titles", clearError);
        return;
      }

      const { error: equipError } = await supabase.from("user_titles").upsert(
        {
          user_id: authUserId,
          title_id: nextDefaultTitleId,
          source: "progression",
          equipped: true,
        },
        { onConflict: "user_id,title_id" },
      );

      if (equipError) {
        console.error("Failed to persist equipped progression title", equipError);
      }
    });
  }, [authUserId, equippedTitleId, isGuestMode, isTitleManuallySelected, ownedTitleIds, tributeTotal]);
  const timeoutRemaining = timeoutUntil ? new Date(timeoutUntil).getTime() - currentTime : 0;
  const isTimeoutActive = timeoutRemaining > 0;
  const effectiveTimeoutDays = currentTime > 0
    ? getEffectiveTimeoutDays(timeoutUntil, currentTime)
    : 0;
  const timeoutMessage =
    "You are in timeout. Actions are locked until the timer ends. You can send $5 on Throne and DM @Principessa2dfd for manual review to remove it.";
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
    previewModeRef.current = isPreviewMode;
  }, [isPreviewMode]);

  useEffect(() => {
    timeoutUntilRef.current = timeoutUntil;
  }, [timeoutUntil]);

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

  const persistInBackground = useCallback((
    promise: Promise<unknown>,
    label: string,
    options: {
      onFinally?: () => void;
      resyncOnFailure?: boolean;
    } = {},
  ) => {
    void promise.catch((error) => {
      console.error("[action-error] caught background action error", { error, label });
      setAvatarMistressReply("The action worked locally, but the vault failed to save it. Resyncing the vault state.");

      if (options.resyncOnFailure !== false) {
        void resyncAuthenticatedProfile(label).catch((resyncError) => {
          console.error("[profile-resync] failed after background action error", { label, resyncError });
        });
      }
    }).finally(() => {
      try {
        options.onFinally?.();
      } catch (cleanupError) {
        console.error("[action-lock] cleanup callback failed", { cleanupError, label });
      }
    });
  }, [resyncAuthenticatedProfile, setAvatarMistressReply]);

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
    const loadActiveEvent = async () => {
      try {
        const response = await fetch("/api/events/active", { cache: "no-store" });
        const payload = (await response.json()) as { event?: RandomEvent | null };

        if (!response.ok) {
          throw new Error("Active event could not be loaded.");
        }

        setActiveEvent(payload.event ?? null);
        if (payload.event) {
          emitSoundEvent("random_event_activation");
        }
      } catch (error) {
        console.error("Failed to load active random event", error);
      }
    };

    void loadActiveEvent();
  }, []);

  useEffect(() => {
    if (!activeEvent) {
      return;
    }

    const remaining = Math.max(0, new Date(activeEvent.ends_at).getTime() - new Date().getTime());
    const timer = window.setTimeout(() => setActiveEvent(null), remaining);

    return () => window.clearTimeout(timer);
  }, [activeEvent]);

  const handleBubbleFullyHidden = useCallback((hiddenMessage: string) => {
    setFullyHiddenBubbleMessage(hiddenMessage);
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

    const getRandomDelay = (minimum: number, maximum: number) =>
      Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;

    const getRandomIdleLine = () => {
      const avatarId = equippedSpeechAvatar?.id ?? DEFAULT_SPEECH_AVATAR_ID;
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
    isLoggedIn,
    mistressReply,
    petEverUnlocked,
    setAvatarMistressReply,
  ]);

  useEffect(() => {
    if (!isLoggedIn || !isPetUnlocked) {
      return;
    }

    const rulesTask = petTaskState.find((entry) => entry.id === "pet-randomized-rules");

    if (!rulesTask) {
      return;
    }

    const dailyKey = getDailyKey();
    const storageKey = `vault_randomized_rules_bubble_${authUserId ?? username}_${dailyKey}`;

    if (window.localStorage.getItem(storageKey) === "shown") {
      return;
    }

    const bannedNames = (rulesTask.ruleBannedMechanics ?? getDailyPetRuleMechanics().map((rule) => rule.id))
      .map(getPetRuleMechanicLabel)
      .slice(0, 2);

    if (bannedNames.length === 0) {
      return;
    }

    window.localStorage.setItem(storageKey, "shown");
    const timer = window.setTimeout(() => {
      setAvatarMistressReply(
        `Today's forbidden tasks: ${bannedNames.join(" and ")}. Break them and the rules fail.`,
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, [authUserId, isLoggedIn, isPetUnlocked, petTaskState, setAvatarMistressReply, username]);

  const loadRecentTributes = useCallback(async () => {
    try {
      const response = await fetch("/api/recent-tributes", { cache: "no-store" });
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

  const loadLeadershipTop = useCallback(async () => {
    try {
      const response = await fetch("/api/leadership/top", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        leaders?: LeadershipEntry[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Leadership leaderboard could not be loaded.");
      }

      setLeadershipTop(payload.leaders ?? []);
    } catch (error) {
      console.error("Failed to load leadership top 3", error);
    }
  }, []);

  const loadShameTop = useCallback(async () => {
    try {
      const response = await fetch("/api/shame/top", {
        cache: "no-store",
      });
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
      if (payload.jackpot?.currentWinner) {
        emitSoundEvent("jackpot_win");
      }
      setJackpotError("");
    } catch (error) {
      console.error("Failed to load loyalty jackpot", error);
      setJackpotError(describeError(error));
    }
  }, [isGuestMode, isPreviewMode]);

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
    }, 30000);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(immediateTimer);
    };
  }, [isAdminUser, isLoggedIn, loadPendingIrlReviewCount]);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const initialTimer = window.setTimeout(() => {
      void loadRecentTributes();
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
    if (!isLoggedIn || isGuestMode || isPreviewMode) {
      return;
    }

    const initialTimer = window.setTimeout(() => {
      void loadJackpot();
    }, 0);
    const timer = window.setInterval(() => {
      void loadJackpot();
    }, 60000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [isGuestMode, isLoggedIn, isPreviewMode, loadJackpot]);

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

  const applyProfile = useCallback(async (profile: Profile) => {
    setAuthUserId(profile.id);
    setUsername(profile.username);
    setCoins(profile.coins);
    setAffection(profile.affection);
    setTributeTotal(profile.tribute_total ?? 0);
    setPetScore(profile.pet_score ?? 0);
    setOwnerLikeness(profile.owner_likeness ?? 100);
    setPetUnlockedAt(profile.pet_unlocked_at ?? null);
    setLastPetTaxAt(profile.last_pet_tax_at ?? null);
    setLoyaltyStreak(profile.loyalty_streak ?? 0);
    setLastLoyaltyAt(profile.last_loyalty_at ?? null);
    setIsAdminUser(isTrustedAdminUsername(profile.username));

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
      .select("amount")
      .eq("user_id", profile.id)
      .eq("reason", "live_gift");

    if (throneError) {
      console.warn("Failed to load Throne coin milestone totals", throneError);
    }

    const throneCoinTotal = (throneTransactions ?? []).reduce(
      (sum, entry) => sum + Math.max(0, Number(entry.amount ?? 0)),
      0,
    );
    const autoTitleIds = Array.from(
      new Set([
        ...getUnlockedProgressionTitleIds(profile.tribute_total ?? 0),
        ...getUnlockedThroneTitleIds(throneCoinTotal),
      ]),
    );

    if (autoTitleIds.length > 0) {
      const { error: titleUpsertError } = await supabase.from("user_titles").upsert(
        autoTitleIds.map((titleId) => ({
          user_id: profile.id,
          title_id: titleId,
          source: getTitleItem(titleId)?.source ?? "progression",
        })),
        { onConflict: "user_id,title_id" },
      );

      if (titleUpsertError) {
        console.warn("Failed to upsert automatic titles", titleUpsertError);
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
      .select("*")
      .eq("user_id", profile.id)
      .eq("status", "active")
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
            contract?: PetDebtContract | null;
            error?: string;
            plan?: { amount: number; missedPeriods: number };
            profile?: Profile;
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
          setAvatarMistressReply(
            (result.plan?.missedPeriods ?? 0) > 0
              ? `Missed Debt Contract collected automatically. ${Number(result.plan?.amount ?? duePlan.amount).toLocaleString()} coins charged.`
              : `Debt Contract auto-payment completed. ${Number(result.plan?.amount ?? duePlan.amount).toLocaleString()} coins charged.`,
          );
        } catch (error) {
          console.error("Failed to auto-collect overdue debt payment", error);
          setAuthError(describeError(error));
          setPetDebtContract(activeDebtContract);
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
    } else {
      const petRows = (petTaskData ?? []) as UserPetTaskRow[];
      setPetTaskState(buildPetTasksFromRows(petRows));
      setPetAffectionClaimed(
        petRows.some((entry) => entry.task_id === "pet-affection-claim" && entry.status === "approved"),
      );
    }

    const { data: taskData, error: taskError } = await supabase
      .from("user_tasks")
      .select("task_id, completed_at, claimed_at, reward_coins, metadata")
      .eq("user_id", profile.id);

    if (taskError) {
      console.error("Failed to load persisted task state", taskError);
      throw taskError;
    }

    const taskRows = (taskData ?? []) as UserTaskRow[];
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
    const shouldKeepLocalHighLow = profileIdRef.current === profile.id;

    setTasks((current) => {
      const currentHighLow = current.find((entry) => entry.id === "high-low");

      return rebuiltTasks.map((task) =>
        task.id === "high-low" && shouldKeepLocalHighLow && currentHighLow
          ? {
              ...task,
              currentNumber: currentHighLow.currentNumber ?? task.currentNumber,
              lastResult: currentHighLow.lastResult,
              nextBaseRevealAt: currentHighLow.nextBaseRevealAt,
              resultBaseNumber: currentHighLow.resultBaseNumber,
              resultCoinDelta: currentHighLow.resultCoinDelta,
              resultNumber: currentHighLow.resultNumber,
              resultOutcome: currentHighLow.resultOutcome,
            }
          : task,
      );
    });
    profileIdRef.current = profile.id;
    setMechanics(buildMechanicsFromRows(taskRows, unlockedIds));
    setIsLoggedIn(true);
    void loadLeadershipTop();
    void loadShameTop();
    void loadJackpot();
  }, [
    loadJackpot,
    loadLeadershipTop,
    loadShameTop,
    setAvatarMistressReply,
    unlockProgressionTitles,
  ]);

  const applyProfileStats = useCallback((profile: Profile) => {
    setAuthUserId(profile.id);
    setUsername(profile.username);
    setCoins(profile.coins);
    setAffection(profile.affection);
    setTributeTotal(profile.tribute_total ?? 0);
    setPetScore(profile.pet_score ?? 0);
    setOwnerLikeness(profile.owner_likeness ?? 100);
    setPetUnlockedAt(profile.pet_unlocked_at ?? null);
    setLastPetTaxAt(profile.last_pet_tax_at ?? null);
    setLoyaltyStreak(profile.loyalty_streak ?? 0);
    setLastLoyaltyAt(profile.last_loyalty_at ?? null);
    timeoutUntilRef.current = profile.timeout_until ?? null;
    setTimeoutUntil(profile.timeout_until ?? null);
    setIsLoggedIn(true);
    setIsAdminUser(isTrustedAdminUsername(profile.username));
  }, []);

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
    const fallbackUsername = profileUsernameFromUser(user);
    const avatarUrl = profileAvatarFromUser(user);

    const createProfile = async (usernameForProfile: string) => {
      console.info("Creating/upserting profile", {
        userId: user.id,
        username: usernameForProfile,
      });

      const response = await fetch("/api/user/profile-bootstrap", {
        body: JSON.stringify({
          avatarUrl,
          username: usernameForProfile,
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

    const { data: createdProfile, error: insertError } =
      await createProfile(fallbackUsername);

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
          email: user.email ?? null,
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
          email: user.email ?? null,
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
    let nextAffection = profile.affection;
    let nextPetUnlockedAt = profile.pet_unlocked_at ?? null;
    let nextOwnerLikeness = profile.owner_likeness ?? 100;
    let nextLastOwnerLikenessAt = profile.last_owner_likeness_at ?? null;
    let nextLastTaxAt = profile.last_pet_tax_at ?? null;

    if (!nextPetUnlockedAt && profile.affection >= 100) {
      nextPetUnlockedAt = nowIso;
      nextLastOwnerLikenessAt = nowIso;
      nextLastTaxAt = nextLastTaxAt ?? nowIso;
      patch.pet_unlocked_at = nextPetUnlockedAt;
      patch.last_owner_likeness_at = nextLastOwnerLikenessAt;
      patch.last_pet_tax_at = nextLastTaxAt;
      patch.owner_likeness = nextOwnerLikeness;
    }

    if (nextPetUnlockedAt) {
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

        if ((count ?? 0) >= 6) {
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
      return profile;
    }

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

    return result.profile as Profile;
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
            email: user.email ?? null,
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
            email: user.email ?? null,
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

    if (lastLoyaltyAt && isWithinLast24Hours(lastLoyaltyAt)) {
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
    const error = response.ok ? null : new Error(result.error ?? "Profile update failed.");

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
    const error = response.ok ? null : new Error(result.error ?? "Pet profile update failed.");

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
      throw new Error(payload.error ?? "Pet task update failed.");
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
      throw new Error(payload.error ?? "Pet gallery unlock failed.");
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
      throw new Error(result.error ?? "Debt contract update failed.");
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
      throw new Error(result.error ?? "Timeout update failed.");
    }

    applyProfileStats(result.profile);
    return result.profile;
  }, [affection, applyProfileStats, authUserId, coins, isGuestMode, lastLoyaltyAt, loyaltyStreak, tributeTotal, username]);

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
      throw new Error(payload.error ?? "Task update failed.");
    }

    return payload.task;
  }, []);

  const persistTaskCompletion = useCallback((taskId: string) => {
    if (isGuestMode) {
      return;
    }

    if (!authUserId) {
      console.error("Cannot persist task completion without authenticated user id", taskId);
      return;
    }

    const task = startingTasks.find((entry) => entry.id === taskId);

    void persistUserTask({
        task_id: taskId,
        completed_at: new Date().toISOString(),
        reward_coins: task?.reward ?? 0,
        metadata: {},
    }).catch((error) => {
        console.error("Failed to persist task completion", { taskId, error });
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

    if (task.id === "daily-login" && isWithinLast24Hours(existingTask?.claimed_at ?? null)) {
      throw new Error("Daily task is still on cooldown.");
    }

    if (
      task.id === "typing-accuracy" &&
      (
        isWithinLast24Hours(existingTask?.claimed_at ?? null) ||
        isWithinLast24Hours(getTaskMetadataString(existingTask?.metadata, "failedAt"))
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
      const claimedCycleKey = getTaskMetadataString(existingTask?.metadata, "cycleKey");

      if (loyaltyStreak < streakBonus.milestone) {
        throw new Error("Streak milestone is not reached.");
      }

      if (existingTask?.claimed_at && claimedCycleKey === streakCycleKey) {
        throw new Error("Streak bonus already claimed for this cycle.");
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
        setIsProfileVerified(true);
        console.info("[auth-init] profile fetch result", { source, profile });
        return profile;
      } finally {
        if (authProfileLoadInFlightRef.current === user.id) {
          authProfileLoadInFlightRef.current = null;
        }
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
      setIsLoggedIn(false);
      setAuthUserId(null);
    };

    const showOptimisticDashboard = (user: User, source: string) => {
      console.info("[auth-init] optimistic session accepted", { source, userId: user.id });
      setAuthError("");
      setIsGuestMode(false);
      setIsPreviewMode(false);
      previewModeRef.current = false;
      setIsProfileVerified(false);
      setIsAdminUser(false);
      setAuthUserId(user.id);
      setUsername(profileUsernameFromUser(user));
      setIsLoggedIn(true);
      finishAuthLoad();
    };

    const verifyAuthenticatedUser = async (user: User, source: string) => {
      try {
        if (!mounted) {
          return;
        }

        const profile = await loadAuthenticatedUser(user, source);
        if (profile) {
          authReplyRef.current?.("Logged in already? Eager little thing.");
        }
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
          showOptimisticDashboard(sessionResult.data.session.user, "client-session");
          void verifyAuthenticatedUser(sessionResult.data.session.user, "client-session-verification");
          return;
        }

        const response = await withTimeout(
          fetch("/api/auth/session", { cache: "no-store" }),
          "server auth session fallback",
        );
        const payload = (await response.json()) as { error?: string | null; user?: User | null };

        console.info("[auth-init] server session fallback result", {
          hasUser: Boolean(payload.user),
          status: response.status,
        });

        if (!response.ok) {
          throw new Error(payload.error ?? "Auth session check failed.");
        }

        if (payload.user) {
          showOptimisticDashboard(payload.user, "server-session-fallback");
          void verifyAuthenticatedUser(payload.user, "server-session-verification");
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
      }
    };

    if (!isSupabaseConfigured) {
      console.info("[auth-init] Supabase env missing; showing login/preview screen");
      clearAuthState();
      finishAuthLoad();

      return () => {
        mounted = false;
      };
    }

    void bootInitialAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.info("[auth-init] auth state changed", {
        event: _event,
        hasSession: Boolean(session),
      });

      if (_event === "INITIAL_SESSION") {
        return;
      }

      if (!session?.user) {
        if (previewModeRef.current) {
          return;
        }

        clearAuthState();
        finishAuthLoad();
        return;
      }

      void (async () => {
        try {
          showOptimisticDashboard(session.user, `auth-change:${_event}`);
          await verifyAuthenticatedUser(session.user, `auth-change:${_event}:verification`);
        } catch (profileError) {
          console.error("[auth-init] profile fetch error after auth change", profileError);
          setAuthError(describeError(profileError));
          setIsLoggedIn(false);
          setAuthUserId(null);
        } finally {
          console.info("[auth-init] loading false after auth change");
          setAuthBootstrapped(true);
          setIsAuthLoading(false);
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
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

  const completeTask = (taskId: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, completed: true } : task,
      ),
    );
    persistTaskCompletion(taskId);
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

      if (!isGuestMode) {
        persistInBackground(
          persistUserTask({
            task_id: task.id,
            completed_at: null,
            claimed_at: null,
            reward_coins: task.reward,
            metadata: {
              attemptsRemaining: nextAttempts,
              failedAt,
            },
          }),
          "Failed to persist typing attempt",
          { onFinally: () => finishTaskAction(actionId) },
        );
      } else {
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

      if (!isGuestMode) {
        persistInBackground(
          persistUserTask({
            task_id: task.id,
            completed_at: new Date().toISOString(),
            claimed_at: null,
            reward_coins: task.reward,
            metadata: {
              attemptsRemaining: task.attemptsRemaining ?? 3,
            },
          }),
          "Failed to persist typing success",
          { onFinally: () => finishTaskAction(actionId) },
        );
      } else {
        finishTaskAction(actionId);
      }

      setTasks((current) =>
        current.map((entry) =>
          entry.id === task.id
            ? { ...entry, completed: true, claimed: false }
            : entry,
        ),
      );
      setAvatarMistressReply("Perfect. Principessa appreciates precision.");
    }
  };

  const scheduleHighLowDisplayRefresh = useCallback(() => {
    if (highLowRefreshTimerRef.current !== null) {
      window.clearTimeout(highLowRefreshTimerRef.current);
    }

    highLowRefreshTimerRef.current = window.setTimeout(() => {
      const nextDisplayNumber = randomHighLowDisplayNumber();

      setTasks((current) =>
        current.map((entry) =>
          entry.id === "high-low"
            ? { ...entry, currentNumber: nextDisplayNumber }
            : entry,
        ),
      );
    }, getEventCooldownMs(10 * 1000));
  }, [getEventCooldownMs]);

  const handleHighLowPlay = async (
    guess: "higher" | "lower",
    stake: number,
  ) => {
    if (blockIfTimedOut()) {
      return;
    }
    if (await markPetRulesFailed("higher-lower")) {
      return;
    }

    const task = tasks.find((entry) => entry.id === "high-low");
    const highLowCooldownMs = getEventCooldownMs(15 * 1000);
    const highLowCooldownActive =
      Boolean(task?.cooldownUntil) &&
      new Date(task?.cooldownUntil ?? "").getTime() > new Date().getTime();
    const highLowLocked = Boolean(task?.highLowDailyLocked);

    if (!task || highLowCooldownActive || highLowLocked || !authUserId) {
      if (highLowLocked) {
        setAvatarMistressReply(
          `Higher or Lower ${HIGH_LOW_PROFIT_LOCK.toLocaleString()} net profit limit reached for today.`,
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

    if (currentCoins < stake) {
      setAvatarMistressReply("Too few coins for that little gamble.");
      return;
    }

    const actionId = "high-low";

    if (!beginTaskAction(actionId)) {
      return;
    }

    const currentNumber = task.currentNumber ?? randomHighLowDisplayNumber();
    const resultNumber = randomHighLowNumber();
    const outcome =
      resultNumber === currentNumber
        ? "tie"
        : (guess === "higher" && resultNumber > currentNumber) ||
            (guess === "lower" && resultNumber < currentNumber)
          ? "win"
          : "loss";
    const coinDelta = outcome === "win" ? stake * (highLowWinMultiplier - 1) : outcome === "loss" ? -stake : 0;
    const nextCoins = currentCoins + coinDelta;
    const now = new Date().toISOString();
    const today = getDailyKey();
    const currentDailyDate = task.highLowDailyDate === today ? task.highLowDailyDate : today;
    const currentDailyProfit =
      task.highLowDailyDate === today ? task.highLowDailyProfit ?? 0 : 0;
    const currentDailyWins =
      task.highLowDailyDate === today ? task.highLowDailyWins ?? 0 : 0;
    const nextDailyProfit = currentDailyProfit + coinDelta;
    const nextDailyWins = currentDailyWins + (outcome === "win" ? 1 : 0);
    const nextDailyLocked = isHighLowLocked(nextDailyProfit);
    const nextBaseRevealAt = new Date(new Date().getTime() + getEventCooldownMs(10 * 1000)).toISOString();
    const lastResult =
      outcome === "tie"
        ? `${currentNumber} -> ${resultNumber}. Tie. Stake refunded. New number appears in 10 seconds.`
        : `${currentNumber} -> ${resultNumber}. ${outcome === "win" ? "Won" : "Lost"} ${Math.abs(coinDelta)} coins. New number appears soon.`;

    setCoins(nextCoins);
    coinsRef.current = nextCoins;
    setTasks((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              completed: true,
              claimed: false,
              currentNumber,
              highLowDailyDate: currentDailyDate,
              highLowDailyLocked: nextDailyLocked,
              highLowDailyProfit: nextDailyProfit,
              highLowDailyWins: nextDailyWins,
              lastResult,
              nextBaseRevealAt,
              resultBaseNumber: currentNumber,
              resultCoinDelta: coinDelta,
              resultNumber,
              resultOutcome: outcome,
              cooldownUntil: getCooldownUntil(now, highLowCooldownMs),
            }
          : entry,
      ),
    );
    scheduleHighLowDisplayRefresh();
    setAvatarMistressReply(
      outcome === "tie"
        ? "A tie. Your stake returns, this time."
        : outcome === "win"
        ? highLowWinMultiplier > 2
          ? "Event luck. The vault triples your winning payout."
          : "A lucky guess. The vault doubles your stake."
        : "Wrong. The vault keeps that stake.",
    );

    persistInBackground(
      (async () => {
        if (isGuestMode) {
          return;
        }

        const response = await fetch("/api/user/task-actions/high-low", {
          body: JSON.stringify({ currentNumber, guess, stake }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json()) as {
          error?: string;
          profile?: Profile;
          taskState?: Partial<TaskItem>;
        };

        if (!response.ok || !payload.profile || !payload.taskState) {
          throw new Error(payload.error ?? "Higher/Lower action failed.");
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
      })(),
      "Failed to complete high-low play",
      { onFinally: () => finishTaskAction(actionId) },
    );
  };

  const handleNumberPick = async (selectedNumber: number) => {
    if (blockIfTimedOut()) {
      return;
    }
    if (await markPetRulesFailed("number-pick")) {
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

    const actionId = "number-pick";

    if (!beginTaskAction(actionId)) {
      return;
    }

    const existingCorrect = task.numberPickCorrect;
    const correctNumber = typeof existingCorrect === "number" ? existingCorrect : randomFrom(options);
    const previousWrongSelections = task.numberPickWrongSelections ?? [];
    const attemptsRemaining = task.numberPickAttemptsRemaining ?? 2;
    const isCorrect = selectedNumber === correctNumber;
    const baseReward = isCorrect ? (attemptsRemaining >= 2 ? 150 : 75) : 0;
    const reward = baseReward > 0 ? getEventTaskReward(baseReward) : 0;
    const nextAttemptsRemaining = isCorrect ? 0 : Math.max(0, attemptsRemaining - 1);
    const finalAttempt = isCorrect || nextAttemptsRemaining === 0;
    const result: "win" | "loss" | null = finalAttempt ? (isCorrect ? "win" : "loss") : null;
    const wrongSelections = isCorrect
      ? previousWrongSelections
      : Array.from(new Set([...previousWrongSelections, selectedNumber]));
    const cooldownUntil = new Date(new Date().getTime() + getEventCooldownMs(24 * 60 * 60 * 1000)).toISOString();

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

    persistInBackground(
      (async () => {
        if (isGuestMode) {
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
          throw new Error(payload.error ?? "Number Pick action failed.");
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
      })(),
      "Failed to complete number pick task",
      { onFinally: () => finishTaskAction(actionId) },
    );
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

    if (!isGuestMode) {
      persistInBackground(
        persistUserTask({
            task_id: task.id,
            completed_at: now.toISOString(),
            claimed_at: now.toISOString(),
            reward_coins: 0,
            metadata: {
              countdownEndsAt,
              status: "countdown",
              waitEndsAt,
            },
          }),
        "Failed to start wait obediently task",
        { onFinally: () => finishTaskAction(actionId) },
      );
    } else {
      finishTaskAction(actionId);
    }
  };

  const handleWaitObedientlyFail = async () => {
    const task = tasks.find((entry) => entry.id === "wait-obediently");

    if (!task || !authUserId) {
      return;
    }

    const actionId = "wait-obediently";

    if (!beginTaskAction(actionId)) {
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

    if (!isGuestMode) {
      persistInBackground(
        persistUserTask({
            task_id: task.id,
            completed_at: new Date().toISOString(),
            claimed_at: new Date().toISOString(),
            reward_coins: 0,
            metadata: {
              status: "failed",
            },
          }),
        "Failed to fail wait obediently task",
        { onFinally: () => finishTaskAction(actionId) },
      );
    } else {
      finishTaskAction(actionId);
    }
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

    persistInBackground(
      (async () => {
        await persistProfileProgress(
          { coins: nextCoins, affection },
          "task:wait-obediently",
        );
        if (!isGuestMode) {
          await persistUserTask({
            task_id: task.id,
            completed_at: new Date().toISOString(),
            claimed_at: task.cooldownUntil
              ? new Date(new Date(task.cooldownUntil).getTime() - 24 * 60 * 60 * 1000).toISOString()
              : new Date().toISOString(),
            reward_coins: rewardCoins,
            metadata: {
              status: "completed",
            },
          });
        }
      })(),
      "Failed to complete wait obediently task",
      { onFinally: () => finishTaskAction(actionId) },
    );
  };

  const handleTimeoutRisk = async () => {
    if (blockIfTimedOut()) {
      return;
    }

    if (!authUserId) {
      return;
    }

    const nowMs = Date.now();
    const activeTimeoutUntil = timeoutUntil && new Date(timeoutUntil).getTime() > nowMs
      ? timeoutUntil
      : null;
    const effectiveDays = getEffectiveTimeoutDays(activeTimeoutUntil, nowMs);

    if (effectiveDays >= MAX_TIMEOUT_DAYS) {
      setAvatarMistressReply("Maximum timeout reached. The risk table refuses you.");
      return;
    }

    const actionId = "timeout-risk";

    if (!beginTaskAction(actionId)) {
      return;
    }

    const hitTimeout = Math.random() < TIMEOUT_RISK_CHANCE;

    try {
      const { data: existingTask, error: readError } = isGuestMode
        ? { data: null, error: null }
        : await supabase
            .from("user_tasks")
            .select("task_id, completed_at, claimed_at, reward_coins, metadata")
            .eq("user_id", authUserId)
            .eq("task_id", "timeout-risk")
            .maybeSingle();

      if (readError) {
        console.error("Failed to read timeout-risk task", readError);
        throw readError;
      }

      const resetAt = getTaskMetadataString(existingTask?.metadata, "resetAt");
      const dailyWindowActive = Boolean(resetAt && new Date(resetAt).getTime() > Date.now());
      const currentSafeWins = dailyWindowActive
        ? getTaskMetadataNumber(existingTask?.metadata, "safeWins", 0)
        : 0;

      if (currentSafeWins >= TIMEOUT_RISK_DAILY_SAFE_LIMIT) {
        setAvatarMistressReply("You already survived twice today. The risk table is closed.");
        return;
      }

      if (hitTimeout) {
        const baseMs = activeTimeoutUntil
          ? Math.max(new Date(activeTimeoutUntil).getTime(), nowMs)
          : nowMs;
        const nextTimeoutUntil = new Date(baseMs + TIMEOUT_RISK_TIMEOUT_MS).toISOString();
        const now = new Date().toISOString();

        timeoutUntilRef.current = nextTimeoutUntil;
        setTimeoutUntil(nextTimeoutUntil);
        setCurrentTime(Date.now());
        await persistTimeoutUntil(nextTimeoutUntil);
        if (!isGuestMode) {
          await persistUserTask({
              task_id: "timeout-risk",
              completed_at: now,
              claimed_at: existingTask?.claimed_at ?? null,
              reward_coins: 0,
              metadata: {
                ...(existingTask?.metadata ?? {}),
                lastResult: "timeout",
                resetAt: dailyWindowActive ? resetAt : new Date(Date.now() + DAY_MS).toISOString(),
                safeWins: currentSafeWins,
              },
            });
        }

        setTasks((current) =>
          current.map((entry) =>
            entry.id === "timeout-risk"
              ? {
                  ...entry,
                  lastResult: "Timeout hit. +12 hours added.",
                  timeoutUntil: nextTimeoutUntil,
                }
              : entry.id === "irl-task-wheel"
                ? { ...entry, timeoutUntil: nextTimeoutUntil }
              : entry,
          ),
        );
        setAvatarMistressReply("Bad roll. 12 hours of timeout have been added.");
        return;
      }

      await persistProfileProgress(
        { coins: coinsRef.current + eventSafeReward, affection },
        "task:timeout-risk",
      );
      const nextSafeWins = currentSafeWins + 1;
      const nextResetAt = dailyWindowActive
        ? resetAt
        : new Date(Date.now() + DAY_MS).toISOString();
      if (!isGuestMode) {
        await persistUserTask({
            task_id: "timeout-risk",
            completed_at: new Date().toISOString(),
            claimed_at: existingTask?.claimed_at ?? null,
            reward_coins: eventSafeReward,
            metadata: {
              ...(existingTask?.metadata ?? {}),
              lastResult: "safe",
              resetAt: nextResetAt,
              safeWins: nextSafeWins,
            },
          });
      }

      setTasks((current) =>
        current.map((entry) =>
          entry.id === "timeout-risk"
            ? {
                ...entry,
                completed: nextSafeWins >= TIMEOUT_RISK_DAILY_SAFE_LIMIT,
                lastResult: `Safe wins today: ${nextSafeWins}/${TIMEOUT_RISK_DAILY_SAFE_LIMIT}`,
              }
            : entry,
        ),
      );
      setAvatarMistressReply(`Safe roll. ${eventSafeReward} coins added.`);
    } catch (error) {
      console.error("Failed to complete timeout-risk task", error);
      setAuthError(describeError(error));
      setAvatarMistressReply("The risk ledger failed. Try again.");
    } finally {
      finishTaskAction(actionId);
    }
  };

  const handleIrlTaskSpin = async (wheelIndex: number) => {
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

    if (currentCoins < IRL_TASK_WHEEL_COST) {
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

    const durationMinutes = getRandomIrlTaskDurationMinutes();
    const penaltyMinutes = getRandomIrlTaskPenaltyMinutes();
    const dueAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    const nextCoins = currentCoins - IRL_TASK_WHEEL_COST;

    try {
      await persistProfileProgress(
        { coins: nextCoins, affection },
        "spend:irl-task-wheel",
      );

      if (!isGuestMode) {
        const { error } = await supabase.from("user_irl_tasks").insert({
          user_id: authUserId,
          task_label: assignedTask.title,
          task_description: assignedTask.description,
          wheel_index: wheelIndex,
          cost_coins: IRL_TASK_WHEEL_COST,
          status: "assigned",
          due_at: dueAt,
          penalty_timeout_minutes: penaltyMinutes,
        });

        if (error) {
          console.error("Failed to assign IRL wheel task", error);
          throw error;
        }
      }

      setTasks((current) =>
        current.map((entry) =>
          entry.id === "irl-task-wheel"
            ? {
                ...entry,
                assignedIrlTask: assignedTask.title,
                assignedIrlTaskDescription: assignedTask.description,
                assignedIrlTaskStatus: "assigned",
                assignedIrlWheelIndex: wheelIndex,
                assignedIrlDueAt: dueAt,
                assignedIrlPenaltyMinutes: penaltyMinutes,
                completed: true,
              }
            : entry,
        ),
      );
      setAvatarMistressReply("Task assigned. DM @Principessa2dfd when it is done.");
    } catch (error) {
      console.error("Failed to spin IRL task wheel", error);
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
    if (await markPetRulesFailed("beg")) {
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
        if (!isGuestMode) {
        await persistUserTask({
            task_id: "beg",
            completed_at: now,
            reward_coins: reward,
            metadata: {
              lastBegAt: now,
              lastReward: reward,
            },
          });
      }

      if (reward > 0) {
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
    } catch (error) {
      console.error("Failed to complete beg mechanic", error);
      setAuthError(describeError(error));
      setAvatarMistressReply("The vault ignored the request. Try again.");
    } finally {
      finishTaskAction(actionId);
    }
  };

  const handleSacrifice = async () => {
    if (blockIfTimedOut()) {
      return;
    }
    if (await markPetRulesFailed("sacrifice")) {
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
    } catch (error) {
      console.error("Failed to complete sacrifice mechanic", error);
      setAuthError(describeError(error));
      setAvatarMistressReply("The sacrifice ledger failed. Try again.");
    } finally {
      finishTaskAction(actionId);
    }
  };

  const handleSupport = async () => {
    if (blockIfTimedOut()) {
      return;
    }
    if (await markPetRulesFailed("support")) {
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
    } catch (error) {
      console.error("Failed to complete support mechanic", error);
      setAuthError(describeError(error));
      setAvatarMistressReply("The support ledger failed. Try again.");
    } finally {
      finishTaskAction(actionId);
    }
  };

  const handleSignInWithX = async () => {
    let oauthRedirectStarted = false;

    setIsAuthBusy(true);
    setAuthError("");
    authBootstrappedRef.current = false;
    setAuthBootstrapped(false);
    setIsProfileVerified(false);
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
        setIsAuthBusy(false);
        setIsAuthLoading(false);
      }
    }
  };

  const handleEnterPreviewMode = useCallback(() => {
    authProfileLoadInFlightRef.current = null;
    authProfileLoadedRef.current = null;
    setAuthError("");
    authBootstrappedRef.current = true;
    setAuthBootstrapped(true);
    setIsProfileVerified(false);
    setIsAuthBusy(false);
    setIsAuthLoading(false);
    setIsPreviewMode(true);
    previewModeRef.current = true;
    setIsGuestMode(true);
    setIsLoggedIn(true);
    setAuthUserId(null);
    profileIdRef.current = null;
    setIsDebtAutoPayEnabled(readDebtAutoPayEnabled(LOCAL_GUEST_USER_ID));
    setUsername("@preview");
    setCoins(0);
    setAffection(0);
    setTributeTotal(0);
    setLoyaltyStreak(0);
    setLastLoyaltyAt(null);
    setTimeoutUntil(null);
    timeoutUntilRef.current = null;
    setUnlockedGalleryIds([]);
    setPetScore(0);
    setOwnerLikeness(100);
    setPetUnlockedAt(null);
    setLastPetTaxAt(null);
    setPetDebtContract(null);
    setPetAffectionClaimed(false);
    setPetGalleryUnlockedIds([]);
    setOwnedCosmeticIds([DEFAULT_SPEECH_AVATAR_ID]);
    setEquippedCosmeticIds({ "speech-avatar": DEFAULT_SPEECH_AVATAR_ID });
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
    setActivePanel("tribute");
    setAvatarMistressReply("Preview Mode is read-only. Sign in to unlock progression.");
  }, [setAvatarMistressReply]);

  const handleLogout = async () => {
    if (!isGuestMode) {
      await supabase.auth.signOut();
    }
    authProfileLoadInFlightRef.current = null;
    authProfileLoadedRef.current = null;
    authBootstrappedRef.current = true;
    setAuthBootstrapped(true);
    setIsProfileVerified(false);
    setIsGuestMode(false);
    setIsPreviewMode(false);
    previewModeRef.current = false;
    setIsLoggedIn(false);
    setAuthUserId(null);
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
    setPetScore(0);
    setOwnerLikeness(100);
    setPetUnlockedAt(null);
    setLastPetTaxAt(null);
    setPetDebtContract(null);
    setIsDebtAutoPayEnabled(false);
    setPetTaskState(petTasks);
    setPetAffectionClaimed(false);
    setPetGalleryUnlockedIds([]);
    setOwnedCosmeticIds([DEFAULT_SPEECH_AVATAR_ID]);
    setEquippedCosmeticIds({ "speech-avatar": DEFAULT_SPEECH_AVATAR_ID });
    setOwnedTitleIds(["leadership-0"]);
    setEquippedTitleId("leadership-0");
    setIsTitleManuallySelected(false);
    setAvatarMistressReply("Back at the gate. The vault can wait.");
  };

  const handleTribute = async (amount: number) => {
    if (blockIfTimedOut()) {
      return;
    }
    if (await markPetRulesFailed("tribute")) {
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
    const nextCoins = Math.max(0, currentCoins - amount);
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
      emitSoundEvent("affection_level_up");
    }
    if (nextAffection >= 50) {
      completeTask("affection");
    }
    if (nextAffection >= 80) {
      completeTask("affection-80");
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
    if (await markPetRulesFailed("gallery")) {
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

    const nextCoins = Math.max(0, currentCoins - unlockCost);

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

      if (!isGuestMode) {
        const { error } = await supabase.from("user_cosmetics").upsert(
          {
            user_id: authUserId,
            item_id: item.id,
            item_type: item.type,
            equipped: false,
          },
          { onConflict: "user_id,item_id" },
        );

        if (error) {
          console.error("Failed to persist cosmetic purchase", error);
          throw error;
        }
      }

      setOwnedCosmeticIds((current) =>
        current.includes(item.id) ? current : [...current, item.id],
      );
      emitSoundEvent("cosmetic_purchased");
      setAvatarMistressReply(`${item.name} purchased. Cosmetic spend does not count as tribute.`);
      finishTaskAction(actionId);
    } catch (error) {
      console.error("Failed to purchase cosmetic", error);
      setAuthError(describeError(error));
      setAvatarMistressReply("The cosmetic ledger failed. Try again.");
      finishTaskAction(actionId);
    }
  };

  const handleEquipCosmetic = async (item: CosmeticItem) => {
    if (!ownedCosmeticIds.includes(item.id) && item.price > 0) {
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
      if (!isGuestMode) {
        const { error: clearError } = await supabase
          .from("user_cosmetics")
          .update({ equipped: false })
          .eq("user_id", authUserId)
          .eq("item_type", item.type);

        if (clearError) {
          console.error("Failed to clear equipped cosmetics", clearError);
          throw clearError;
        }

        const { error: equipError } = await supabase.from("user_cosmetics").upsert(
          {
            user_id: authUserId,
            item_id: item.id,
            item_type: item.type,
            equipped: true,
          },
          { onConflict: "user_id,item_id" },
        );

        if (equipError) {
          console.error("Failed to equip cosmetic", equipError);
          throw equipError;
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
      await persistProfileProgress(
        { coins: coinsRef.current - price, affection },
        "spend:title",
        {
          spendAmount: price,
          titleId: title.id,
          tributeTotalChanged: false,
        },
      );

      if (!isGuestMode) {
        const { error } = await supabase.from("user_titles").upsert(
          {
            user_id: authUserId,
            title_id: title.id,
            source: title.source,
            equipped: false,
          },
          { onConflict: "user_id,title_id" },
        );

        if (error) {
          console.error("Failed to persist title purchase", error);
          throw error;
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
        const { error: clearError } = await supabase
          .from("user_titles")
          .update({ equipped: false })
          .eq("user_id", authUserId);

        if (clearError) {
          console.error("Failed to clear equipped title", clearError);
          throw clearError;
        }

        const { error: equipError } = await supabase.from("user_titles").upsert(
          {
            user_id: authUserId,
            title_id: title.id,
            source: title.source,
            equipped: true,
          },
          { onConflict: "user_id,title_id" },
        );

        if (equipError) {
          console.error("Failed to equip title", equipError);
          throw equipError;
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
    const dailyCooldownActive =
      task.id === "daily-login" &&
      Boolean(task.cooldownUntil) &&
      new Date(task.cooldownUntil ?? "").getTime() > Date.now();

    if (!task.completed || (task.claimed && task.id !== "daily-login") || dailyCooldownActive) {
      return;
    }

    const actionId = `claim:${taskId}`;

    if (!beginTaskAction(actionId)) {
      return;
    }

    setCoins(nextCoins);
    coinsRef.current = nextCoins;
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
                  ? new Date(Date.now() + getEventCooldownMs(24 * 60 * 60 * 1000)).toISOString()
                  : entry.cooldownUntil,
            }
          : entry,
      ),
    );
    emitSoundEvent("task_completion");
    setAvatarMistressReply(
      `Fine. ${rewardCoins} coins added. Spend them carefully.`,
    );

    persistInBackground(
      (async () => {
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
          throw new Error(payload.error ?? "Task reward claim failed.");
        }

        rewardCoins = payload.rewardCoins ?? rewardCoins;
        applyProfileStats(payload.profile);
      }
      })(),
      "Failed to persist task reward",
      { onFinally: () => finishTaskAction(actionId) },
    );
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
        setAuthError(describeError(error));
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
        setAuthError(describeError(error));
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
    finishPetAction(actionId);
  };

  const handlePetConfessionSubmit = async (value: string) => {
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

    if (value.trim() !== sentence) {
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
          return;
        }
      }

      try {
        await persistPetTask(
        {
          task_id: task.id,
          completed_at: completed ? now : task.completedAt,
          reward_score: task.reward,
          status: completed ? "approved" : "available",
          reviewed_at: completed ? now : task.reviewedAt,
          metadata: {
            count: nextCount,
          },
        },
        );
      } catch (error) {
        console.error("Failed to persist Pet confession progress", error);
        setAuthError(describeError(error));
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

    if (coinsRef.current < PET_WEEKLY_TAX_COST) {
      setAvatarMistressReply(`Weekly tax requires ${PET_WEEKLY_TAX_COST} Principessa Coins.`);
      return;
    }

    const now = new Date().toISOString();
    const nextCoins = coinsRef.current - PET_WEEKLY_TAX_COST + eventPetTaskCoinReward;
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
            spendAmount: PET_WEEKLY_TAX_COST,
            rewardCoins: eventPetTaskCoinReward,
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
            cost: PET_WEEKLY_TAX_COST,
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
    setAvatarMistressReply(`Weekly tax accepted. +${task.reward} Pet Score, +${eventPetTaskCoinReward} coins.`);
  };

  const handleDebtContractSign = async ({
    debtAmount,
    durationPeriods,
    periodType,
    petName,
  }: {
    debtAmount: number;
    durationPeriods: number;
    periodType: "weekly" | "monthly";
    petName: string;
  }) => {
    if (blockIfTimedOut()) {
      return false;
    }

    const cleanAmount = Math.floor(debtAmount);
    const cleanDuration = Math.floor(durationPeriods);
    const cleanPetName = petName.trim();
    const minimum = periodType === "weekly" ? 10000 : 50000;
    const durationLimit =
      periodType === "weekly"
        ? { label: "weeks", max: 52, min: 1 }
        : { label: "months", max: 24, min: 1 };

    if (petDebtContract?.status === "active") {
      return false;
    }

    if (cleanPetName.length < 2) {
      setAvatarMistressReply("Choose a clear Pet name before signing.");
      return false;
    }

    if (
      !Number.isInteger(cleanAmount) ||
      cleanAmount < minimum ||
      cleanAmount % 1000 !== 0
    ) {
      setAvatarMistressReply(
        periodType === "weekly"
          ? "Weekly debt must be at least 10000 coins and a multiple of 1000."
          : "Monthly debt must be at least 50000 coins and a multiple of 1000.",
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
          debtAmount: cleanAmount,
          durationPeriods: cleanDuration,
          periodType,
          petName: cleanPetName,
        });

        if (result.contract) {
          setPetDebtContract(result.contract as PetDebtContract);
        }
      } catch (error) {
        console.error("Failed to create debt contract", error);
        setAuthError(describeError(error));
        return false;
      }
    }

    setAvatarMistressReply("Debt Contract signed. The schedule is now active.");
    emitSoundEvent("debt_contract_signed");
    return true;
  };

  const handleDebtAutoPayChange = (enabled: boolean) => {
    const debtAutoPayUserId = profileIdRef.current ?? authUserId ?? LOCAL_GUEST_USER_ID;

    setIsDebtAutoPayEnabled(enabled);
    writeDebtAutoPayEnabled(debtAutoPayUserId, enabled);
    setAvatarMistressReply(
      enabled
        ? "Debt Contract auto-payment enabled. Installments pay automatically when they open."
        : "Debt Contract auto-payment disabled. Missed debt collection still applies.",
    );
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

  const handlePetCaseOpen = async (caseItem: PetCaseItem) => {
    if (blockIfTimedOut()) {
      return;
    }

    const task = petTaskStateRef.current.find((entry) => entry.id === "pet-case-opening");
    const coolingDown =
      Boolean(task?.cooldownUntil) &&
      new Date(task?.cooldownUntil ?? "").getTime() > Date.now();

    if (!task || coolingDown) {
      return;
    }

    const now = new Date().toISOString();
    const reward = caseItem.value > 0 ? getEventTaskReward(caseItem.value) : caseItem.value;
    const nextCoins = Math.max(0, coinsRef.current + reward + eventPetTaskCoinReward);
    const nextPetScore = Math.min(1000, petScore + task.reward);

    if (!isGuestMode && authUserId) {
      try {
        await persistPetProfilePatch(
          { coins: nextCoins, pet_score: nextPetScore },
          "reward:pet-case-opening",
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
          metadata: { reward, tier: caseItem.tier },
        },
        );
      } catch (error) {
        console.error("Failed to persist Pet case opening", error);
        setAuthError(describeError(error));
        return;
      }
    } else {
      setCoins(nextCoins);
      setPetScore(nextPetScore);
    }

    setPetTaskStateOptimistic((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              caseReward: reward,
              caseSpunAt: now,
              completedAt: now,
              cooldownUntil: getPetTaskCooldownUntil(now),
              reviewedAt: now,
              status: "approved",
            }
          : entry,
      ),
    );
    setAvatarMistressReply(
      `${caseItem.tier.toUpperCase()} case result: ${reward > 0 ? "+" : ""}${reward + eventPetTaskCoinReward} coins. +${task.reward} Pet Score.`,
    );
  };

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
          completed_at: now.toISOString(),
          reward_score: task.reward,
          status: "available",
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
              completedAt: now.toISOString(),
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
  };

  const handlePetRulesAcknowledge = async (text: string) => {
    if (blockIfTimedOut()) {
      return;
    }

    const task = petTaskStateRef.current.find((entry) => entry.id === "pet-randomized-rules");

    if (!task || text.trim() !== "I understand") {
      return;
    }

    const now = new Date().toISOString();
    const banned = task.ruleBannedMechanics ?? getDailyPetRuleMechanics().map((rule) => rule.id);

    if (!isGuestMode && authUserId) {
      try {
        await persistPetProfilePatch(
          {
            coins: coinsRef.current + eventPetTaskCoinReward,
            pet_score: Math.min(1000, petScore + task.reward),
          },
          "reward:pet-randomized-rules",
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
            acknowledged: "true",
            banned,
            date: getDailyKey(),
          },
        },
        );
      } catch (error) {
        console.error("Failed to persist Pet randomized rules", error);
        setAuthError(describeError(error));
        return;
      }
    } else {
      setPetScore((value) => Math.min(1000, value + task.reward));
    }

    setPetTaskStateOptimistic((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              completedAt: now,
              cooldownUntil: getPetTaskCooldownUntil(now),
              reviewedAt: now,
              ruleAcknowledged: true,
              status: "approved",
            }
          : entry,
      ),
    );
    setAvatarMistressReply(`Rules accepted. Locked until reset. +${eventPetTaskCoinReward} coins.`);
  };

  const markPetRulesFailed = async (mechanicId: string) => {
    const task = petTaskStateRef.current.find((entry) => entry.id === "pet-randomized-rules");
    const banned = task?.ruleBannedMechanics ?? [];

    if (!task || !banned.includes(mechanicId)) {
      return false;
    }

    const label = getPetRuleMechanicLabel(mechanicId);

    if (task.ruleAcknowledged) {
      setAvatarMistressReply(`${label} is forbidden today. Randomized Rules locked it.`);
      return true;
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
          metadata: {
            acknowledged: "false",
            banned,
            date: getDailyKey(),
            failedBy: mechanicId,
          },
        },
        );
      } catch (error) {
        console.error("Failed to persist Pet randomized rules failure", error);
        setAuthError(describeError(error));
        return false;
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
            }
          : entry,
      ),
    );
    setAvatarMistressReply(`You used forbidden ${label}. Randomized Rules failed.`);
    return false;
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
    const correct = key === expectedKey;
    let nextProgress = Math.max(0, currentProgress + (correct ? 2 : -1));
    let nextStage = currentStage;
    let completed = false;
    const nextExpectedKey: "a" | "d" = expectedKey === "a" ? "d" : "a";

    if (nextProgress >= 99 && currentStage === 1) {
      nextProgress = 0;
      nextStage = 2;
      setAvatarMistressReply("So close. Did you really think it would be that easy?");
    } else if (nextProgress >= 100 && currentStage >= 2) {
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
              completedAt: completed ? now : entry.completedAt,
              cooldownUntil: completed ? getPetTaskCooldownUntil(now) : entry.cooldownUntil,
              falseHopeExpectedKey: nextExpectedKey,
              falseHopeProgress: nextProgress,
              falseHopeStage: nextStage,
              reviewedAt: null,
              status: "available" as const,
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
          completed_at: completed ? now : task.completedAt,
          reward_score: task.reward,
          status: "available",
          reviewed_at: null,
          metadata: {
            expectedKey: nextExpectedKey,
            progress: nextProgress,
            stage: nextStage,
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
    } else if (!(nextProgress === 0 && nextStage === 2)) {
      setAvatarMistressReply(correct ? "Correct. Keep alternating." : "Wrong order. Progress slips.");
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

        const approvedCount = petTaskState.filter((task) => task.status === "approved").length;

        if (approvedCount < 5 || petAffectionClaimed) {
            return;
        }

        const nextPetScore = petScore + 10;

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
                    metadata: {},
                },
              );
            } catch (error) {
                console.error("Failed to persist Pet score claim", error);
                setAuthError(describeError(error));
                return;
            }
        }

        setPetScore(nextPetScore);
        setPetAffectionClaimed(true);
        setAvatarMistressReply("Pet milestone claimed. +10 Pet Score.");
    };

  const runPetAction = useCallback(async (actionId: string, action: () => Promise<unknown> | unknown) => {
    if (!beginPetAction(actionId)) {
      return;
    }

    try {
      await action();
    } catch (error) {
      console.error("[action-error] caught pet action error", { actionId, error });
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

  if (!authBootstrapped || isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06030a] text-pink-100">
        <div className="rounded-[2rem] border border-pink-200/20 bg-black/55 px-6 py-5 shadow-[0_0_44px_rgba(236,72,153,0.16)]">
          Opening the vault...
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

  return (
    <main className="min-h-screen overflow-hidden bg-[#06030a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.22),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.2),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0),#06030a_78%)]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-[1.5rem] border border-fuchsia-300/15 bg-black/40 px-4 py-3 shadow-[0_0_40px_rgba(217,70,239,0.12)] backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-fuchsia-200/70">
              Vault Mistress
            </p>
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">
              Principessa&apos;s Premium Vault
            </h1>
            <p className="mt-1 text-sm text-pink-100/70">
              Signed in as{" "}
              <span className="font-bold text-pink-100" style={usernameStyle}>{username}</span>
            </p>
            {equippedTitle && (
              <p className="mt-1 text-xs font-black uppercase tracking-[0.22em] text-fuchsia-200/80">
                {equippedTitle.name}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
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
          </div>
        </header>

        <RecentTributesTicker
          currentUsername={username}
          topTributes={topTributes}
          tributes={recentTributes}
          usernameStyle={usernameStyle}
        />

        {activeEvent && (
          <section className="overflow-hidden rounded-[1.5rem] border border-yellow-200/35 bg-[linear-gradient(135deg,rgba(250,204,21,0.2),rgba(236,72,153,0.14),rgba(88,28,135,0.32),rgba(0,0,0,0.62))] px-4 py-4 shadow-[0_0_38px_rgba(250,204,21,0.16)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-yellow-100">
                  Active Vault Event
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">{activeEvent.name}</h2>
                <p className="mt-1 text-sm leading-6 text-yellow-50/80">
                  {activeEvent.description}
                </p>
              </div>
              <div className="rounded-2xl border border-yellow-100/25 bg-black/45 px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-yellow-100/70">
                  Ends In
                </p>
                <p className="mt-1 text-2xl font-black text-yellow-50">
                  {formatEventCountdown(currentTime > 0 ? new Date(activeEvent.ends_at).getTime() - currentTime : 0)}
                </p>
              </div>
            </div>
          </section>
        )}

        {isPreviewMode && (
          <section className="rounded-[1.5rem] border border-fuchsia-200/25 bg-[linear-gradient(135deg,rgba(217,70,239,0.16),rgba(236,72,153,0.1),rgba(0,0,0,0.55))] px-4 py-4 shadow-[0_0_34px_rgba(217,70,239,0.12)]">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-100">
              Preview Mode
            </p>
            <p className="mt-2 text-sm leading-6 text-pink-50">
              Read-only exploration is active. Sign in to unlock tasks, gallery progression,
              coins, debt contracts, and leaderboards.
            </p>
          </section>
        )}

        {isTimeoutActive && (
          <section className="rounded-[1.5rem] border border-yellow-200/35 bg-[linear-gradient(135deg,rgba(250,204,21,0.18),rgba(236,72,153,0.1),rgba(0,0,0,0.55))] px-4 py-4 shadow-[0_0_34px_rgba(250,204,21,0.14)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-yellow-100">
                  Timeout Active
                </p>
                <p className="mt-2 text-sm leading-6 text-yellow-50">
                  {timeoutMessage}
                </p>
              </div>
              <div className="rounded-2xl border border-yellow-100/25 bg-black/45 px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-yellow-100/70">
                  Time Remaining
                </p>
                <p className="mt-1 text-2xl font-black text-yellow-50">
                  {formatDuration(timeoutRemaining)}
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="flex flex-col gap-6">
            <CharacterCard
              dailyMessage={dailyMessage}
              evolutionStage={characterEvolutionStage}
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
            <TitleCollection
              equippedTitleId={equippedTitleId}
              ownedTitleIds={ownedTitleIds}
              titles={titleItems}
              onEquipTitle={handleEquipTitle}
            />
          </div>

          <div className="flex flex-col gap-6">
            <StatsPanel
              equippedTitleName={equippedTitle?.name}
              leadershipTop={leadershipTop}
              shameTop={shameTop}
              statValueStyle={equippedUsernameColor?.color ? { color: equippedUsernameColor.color } : undefined}
              stats={stats}
              username={username}
              usernameStyle={usernameStyle}
            />
          </div>
        </section>

        <nav className="grid grid-cols-2 gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-2 shadow-[0_0_28px_rgba(236,72,153,0.1)] md:grid-cols-5">
          {[
            ["tribute", "Tribute"],
            ["gallery", "Gallery"],
            ["tasks", "Tasks"],
            ["shop", "Cosmetics"],
            ["pet", "Principessa's Pet"],
          ].map(([key, label]) => (
            <button
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                activePanel === key
                  ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-[0_0_22px_rgba(236,72,153,0.35)]"
                  : key === "pet" && !isPetUnlocked
                    ? "border border-rose-200/10 bg-black/30 text-rose-100/45"
                    : "border border-white/10 bg-black/40 text-pink-100 hover:border-pink-300/40"
              }`}
              disabled={key === "pet" && !isPetUnlocked}
              key={key}
              onClick={() => setActivePanel(key as typeof activePanel)}
              type="button"
            >
              {label}
              {key === "pet" && !isPetUnlocked && (
                <span className="ml-2 text-xs text-rose-100/60">Locked</span>
              )}
            </button>
          ))}
        </nav>

        <section className="pb-10">
          {activePanel === "tribute" && (
            <TributePanel
              affection={affection}
              coins={coins}
              disabled={isTimeoutActive || isPreviewRestricted}
              pending={pendingTaskActionIds.some((id) => id.startsWith("tribute:"))}
              onTribute={handleTribute}
            />
          )}
          {activePanel === "gallery" && (
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
              jackpot={jackpot}
              jackpotError={jackpotError}
              currentUsername={username}
              mechanics={displayMechanics}
              pendingTaskActionIds={pendingTaskActionIds}
              tasks={tasks}
              usernameStyle={usernameStyle}
              onBeg={handleBeg}
              onClaim={handleClaimTask}
              onJackpotContribute={handleJackpotContribute}
              onHighLowPlay={handleHighLowPlay}
              highLowProfitCap={HIGH_LOW_PROFIT_LOCK}
              onIrlTaskSpin={handleIrlTaskSpin}
              onNumberPick={handleNumberPick}
              onSacrifice={handleSacrifice}
              onSupport={handleSupport}
              onTimeoutRisk={handleTimeoutRisk}
              onTypingProgress={handleTypingProgress}
              timeoutRiskChance={TIMEOUT_RISK_CHANCE}
              timeoutRiskEffectiveDays={effectiveTimeoutDays}
              timeoutRiskMaxDays={MAX_TIMEOUT_DAYS}
              timeoutRiskReward={eventSafeReward}
              onWaitObedientlyComplete={handleWaitObedientlyComplete}
              onWaitObedientlyFail={handleWaitObedientlyFail}
              onWaitObedientlyStart={handleWaitObedientlyStart}
            />
          )}
          {activePanel === "shop" && (
            <CosmeticShop
              coins={coins}
              disabled={isTimeoutActive || isPreviewRestricted}
              equippedCosmeticIds={equippedCosmeticIds}
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
          {activePanel === "pet" && isPetUnlocked && (
            <PetSection
              coins={coins}
              galleryItems={petGalleryItems}
              isGuest={isGuestMode}
              isDebtAutoPayEnabled={isDebtAutoPayEnabled}
              favorCoinReward={eventFavorCoinReward}
              nextTaxDueAt={nextPetTaxDueAt}
              ownerLikeness={ownerLikeness}
              petTaskCoinReward={eventPetTaskCoinReward}
              petDebtContract={petDebtContract}
              petGalleryUnlockedIds={petGalleryUnlockedIds}
              petScore={petScore}
              petAffectionClaimed={petAffectionClaimed}
              pendingPetActionIds={pendingPetActionIds}
              tasks={petTaskState}
              weeklyTaxCost={PET_WEEKLY_TAX_COST}
              onClaimAffection={() => runPetAction("pet-affection-claim", handlePetAffectionClaim)}
              onConfessionSubmit={(value) => runPetAction("pet-confession-dm", () => handlePetConfessionSubmit(value))}
              onCompleteTask={(taskId) => runPetAction(taskId, () => handlePetTaskComplete(taskId))}
              onFalseHopeKey={handlePetFalseHopeKey}
              onFavorPick={(index) => runPetAction("pet-favor-roulette", () => handlePetFavorPick(index))}
              onOpenCase={(caseItem) => runPetAction("pet-case-opening", () => handlePetCaseOpen(caseItem))}
              onDebtAutoPayChange={handleDebtAutoPayChange}
              onPayDebtPeriod={() => runPetAction("pet-debt-contract", handleDebtContractPayment)}
              onPayWeeklyTax={() => runPetAction("pet-weekly-throne-tax", handlePetWeeklyTax)}
              onPetEvilWaitComplete={() => runPetAction("pet-evil-wait", handlePetEvilWaitComplete)}
              onPetEvilWaitFail={() => runPetAction("pet-evil-wait", handlePetEvilWaitFail)}
              onPetEvilWaitStart={() => runPetAction("pet-evil-wait", handlePetEvilWaitStart)}
              onPerfectWritingProgress={handlePetPerfectWritingProgress}
              onRulesAcknowledge={(text) => runPetAction("pet-randomized-rules", () => handlePetRulesAcknowledge(text))}
              onSignDebtContract={handleDebtContractSign}
            />
          )}
        </section>
      </div>
      <FloatingDefneBubble
        avatarSrc={equippedSpeechAvatar?.image ?? "/character-icon.png"}
        message={mistressReply}
        messageStyle={equippedUsernameColor?.color ? { color: equippedUsernameColor.color } : undefined}
        onBubbleFullyHidden={handleBubbleFullyHidden}
      />
    </main>
  );
}



