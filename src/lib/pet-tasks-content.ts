import {
  DEFAULT_ADDRESS_TERM,
  type AddressTerm,
} from "@/lib/address-term";
import { PET_THRONE_TASK_ID, PET_THRONE_URL } from "@/lib/pet-throne";
import type { PetTaskItem } from "@/lib/types";
import { getGmt3DayIndex } from "@/lib/time";

export const PET_TASK_REWARD = 10;
export const PET_WEEKLY_TAX_REWARD = 20;

const BOY_X_POST_URL =
  "https://x.com/intent/tweet?text=I%20belong%20to%20@VMPrincipessa.%20My%20small%20dick%20is%20completely%20hers.%20Every%20night%20I%E2%80%99m%20forced%20to%20fill%20my%20mandatory%20humiliation%20report%20like%20the%20pathetic%20pet%20I%20am.%0A%0ACraving%20the%20same%20shame%20and%20control%3F%0A%0AClick%20Here%20%E2%9C%85%0Ahttps%3A%2F%2Fvault-mistress.vercel.app%0A%0AWeak.%20Leaking.%20Addicted.%20%F0%9F%92%B8%F0%9F%94%97";

const GIRL_X_POST_URL =
  "https://x.com/intent/tweet?text=I%20belong%20to%20@VMPrincipessa.%20My%20needy%20pussy%20is%20completely%20hers.%20Every%20night%20I%E2%80%99m%20forced%20to%20fill%20my%20mandatory%20humiliation%20report%20like%20the%20pathetic%20pet%20I%20am.%0A%0ACraving%20the%20same%20shame%20and%20control%3F%0A%0AClick%20Here%20%E2%9C%85%0Ahttps%3A%2F%2Fvault-mistress.vercel.app%0A%0AWeak.%20Leaking.%20Addicted.%20%F0%9F%92%B8%F0%9F%94%97";

type GenderedTaskCopy = {
  title?: string;
  description?: string;
  actionUrl?: string;
};

const DAILY_REPORT_COPY: Record<AddressTerm, GenderedTaskCopy> = {
  sub: {
    title: "Small Dick Touching Journal",
    description:
      "Report in full detail how many times you touched and played with your small dick today. Include the exact number of sessions, how long each one lasted, and the times they occurred.",
  },
  femsub: {
    title: "Needy Pussy Touching Journal",
    description:
      "Report in full detail how many times you touched and played with your needy pussy today. Include the exact number of sessions, how long each one lasted, and the times they occurred.",
  },
};

const X_POST_COPY: Record<AddressTerm, GenderedTaskCopy> = {
  sub: { actionUrl: BOY_X_POST_URL },
  femsub: { actionUrl: GIRL_X_POST_URL },
};

function basePetTasks(): PetTaskItem[] {
  return [
    {
      id: "pet-confession-dm",
      title: "Confession Repetition",
      description: "Type the fixed confession sentence exactly 5 times.",
      reward: PET_TASK_REWARD,
      kind: "confession-writing",
    },
    {
      id: "pet-daily-report",
      title: DAILY_REPORT_COPY.sub.title!,
      description: DAILY_REPORT_COPY.sub.description!,
      reward: PET_TASK_REWARD,
      kind: "review",
    },
    {
      id: "pet-twitter-post",
      title: "X Post Assignment",
      description: "Open the prepared X post, publish it, then submit for review.",
      reward: PET_TASK_REWARD,
      actionLabel: "Open X Post",
      actionUrl: BOY_X_POST_URL,
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
      id: PET_THRONE_TASK_ID,
      title: "Throne Bonus",
      description:
        "Pick a Throne tribute amount, open the gift page, then upload the gift screen screenshot for approval.",
      reward: PET_TASK_REWARD,
      actionLabel: "Open Throne",
      actionUrl: PET_THRONE_URL,
      kind: "throne-tribute",
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
      description:
        "Write the longer gratitude sentence with no mistakes. One attempt only; DM proof for review.",
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
}

/** Default/boy task list (legacy import sites + initial state). */
export const petTasks: PetTaskItem[] = basePetTasks();

export function getPetTasks(addressTerm: AddressTerm = DEFAULT_ADDRESS_TERM): PetTaskItem[] {
  const term = addressTerm;
  const dailyReport = DAILY_REPORT_COPY[term];
  const xPost = X_POST_COPY[term];

  return basePetTasks().map((task) => {
    if (task.id === "pet-daily-report") {
      return {
        ...task,
        title: dailyReport.title ?? task.title,
        description: dailyReport.description ?? task.description,
      };
    }

    if (task.id === "pet-twitter-post") {
      return {
        ...task,
        actionUrl: xPost.actionUrl ?? task.actionUrl,
      };
    }

    return task;
  });
}

const boyPerfectWritingSentencePool = [
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

const girlPerfectWritingSentencePool = [
  "I am grateful to serve as Principessa's obedient Pet and I will prove it with perfect discipline.",
  "I am a pathetic and weak pet who is truly grateful to serve Principessa as Her obedient and denied little bitch, and I will prove my worthless devotion with perfect discipline, daily humiliation and total submission every single day.",
  "I am deeply grateful to serve as Principessa’s pathetic paypig and obedient pet. My needy pussy, my pleasure and my dignity belong to Her completely, and I will prove my devotion with strict discipline, endless edging and constant shame.",
  "I am grateful and honored to serve as Principessa’s obedient, locked and denied pet. I exist only for Her amusement and control, and I will prove it every day with perfect discipline, honesty and humiliating obedience.",
  "I am a desperate, dripping paypig who is truly grateful to serve Principessa as Her personal obedient pet, and I will prove my pathetic submission with perfect discipline, daily reports and total financial and sexual control.",
  "I am grateful to be allowed to serve as Principessa’s weak and inferior pet. My needy pussy is useless and belongs to Her, and I will prove my loyalty with perfect discipline, constant denial and shameful obedience.",
  "I am truly grateful to serve Principessa as her devoted and humiliated pet. I accept my place beneath Her and I will prove my complete submission with perfect discipline, daily confessions and endless worship.",
  "I am a pathetic needy pussy loser who is grateful to serve as Principessa’s obedient pet. I will prove my devotion every single day with strict discipline, total honesty and by giving up all control to her.",
  "I am grateful to serve Principessa as her owned, controlled and regularly humiliated pet, and I will prove my worthless existence with perfect discipline, aching denial and unconditional obedience.",
];

const boyConfessionSentencePool = [
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

const girlConfessionSentencePool = [
  "I am Principessa's pathetic little pet, and I obey every rule like the weak bitch I am.",
  "Principessa owns my needy pussy, my mind, my money, and my dignity.",
  "I crawl back to the vault because I’m too weak to resist Principessa’s control.",
  "I’m grateful to be trained and humiliated as Principessa’s obedient paypig.",
  "Principessa’s approval is everything. I will degrade myself daily to earn it.",
  "I accept my place: locked, denied, and used for Principessa’s amusement.",
  "My pathetic Pet score and my dripping needy pussy belong entirely to Principessa.",
  "I will not rush. I will edge and suffer properly like a good denied pet.",
  "Principessa’s pet waits, drips, reports, and begs for more humiliation.",
  "Excuses are for weak losers. I prove my devotion with discipline and shame.",
  "I exist to be broken and reshaped into Principessa’s perfect humiliated pet.",
];

/** Mostly gender-neutral already; kept as one pool for all terms. */
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

function pickFromPool(pool: string[]) {
  const dayIndex = getGmt3DayIndex();
  return pool[dayIndex % pool.length];
}

export function getDailyPetVoiceSentence(_addressTerm?: AddressTerm) {
  return pickFromPool(petVoiceSentencePool);
}

export function getDailyPetPerfectWritingSentence(addressTerm: AddressTerm = DEFAULT_ADDRESS_TERM) {
  if (addressTerm === "femsub") {
    return pickFromPool(girlPerfectWritingSentencePool);
  }
  return pickFromPool(boyPerfectWritingSentencePool);
}

export function getDailyPetConfessionSentence(addressTerm: AddressTerm = DEFAULT_ADDRESS_TERM) {
  if (addressTerm === "femsub") {
    return pickFromPool(girlConfessionSentencePool);
  }
  return pickFromPool(boyConfessionSentencePool);
}
