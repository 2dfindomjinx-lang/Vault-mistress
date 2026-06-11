"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { PetCaseItem, PetDebtContract, PetGalleryItem, PetTaskItem } from "@/lib/types";

const PET_RANKS = [
  { min: 0, title: "Unclaimed Stray" },
  { min: 100, title: "Collared Pet" },
  { min: 250, title: "Obedient Darling" },
  { min: 500, title: "Principessa's Property" },
  { min: 750, title: "Royal Favorite" },
  { min: 1000, title: "Principessa's Perfect Pet" },
];

const DEBT_PET_NAMES = ["Debt Piglet", "Wallet Worm", "Paypig Princess", "Debt Doll", "Tribute Toy", "Debt Addict", "Owned ATM", "Forever Indebted", "Drainlet", "Paywhore", "Cuckie"];
const DEBT_SIGNING_IMAGE_PATH = "/pet/debt-contract-signed.png";
const DEBT_DURATION_LIMITS = {
  monthly: { label: "Months", max: 24, min: 1 },
  weekly: { label: "Weeks", max: 52, min: 1 },
};
const DEBT_MINIMUM_PAYMENTS = {
  monthly: 50000,
  weekly: 10000,
};
const DEBT_RANDOM_AMOUNT_STEPS = {
  monthly: 10000,
  weekly: 5000,
};
const DEBT_RANDOM_AMOUNT_LIMITS = {
  monthly: { max: 200000, min: 50000 },
  weekly: { max: 30000, min: 10000 },
};
const DEBT_RANDOM_DURATION_LIMITS = {
  monthly: { label: "Months", max: 24, min: 4 },
  weekly: { label: "Weeks", max: 52, min: 8 },
};
const CLICKABLE_COOLDOWN_BUTTON_CLASS = "cursor-not-allowed opacity-40";
const CLICKABLE_COOLDOWN_TILE_CLASS = "cursor-not-allowed opacity-40";
const RIGHTS_TASK_TITLE = "Owned Orgasm Permission";
const RIGHTS_TASK_DESCRIPTION =
  "Pay for stored cumming rights or consume one after cumming. Stored rights persist for three day.";
const RIGHTS_TASK_WARNING =
  "This task depends entirely on your honesty. It is impossible for me to verify every real-world use automatically.";
const RIGHTS_IMAGE_PATH_PREFIX = "/pet/rights/right";
const DAILY_RIGHT_PRICES = [1500, 2500, 5000, 7500, 10000] as const;
const RANDOM_WEBSITE_STATE_STORAGE_KEY = "vault:random-website-state";
const RANDOM_WEBSITE_LINK_POOL: string[] = [
	"https://www.pornhub.com/view_video.php?viewkey=6a1f53942933a",
	"https://www.pornhub.com/view_video.php?viewkey=69f8c6731ca52",
	"https://www.pornhub.com/view_video.php?viewkey=666f2ae4f1f41",
	"https://www.pornhub.com/view_video.php?viewkey=6556c3724076e",
	"https://www.pornhub.com/view_video.php?viewkey=67db128b05fe7",
	"https://www.pornhub.com/view_video.php?viewkey=66d21b416e7c2",
	"https://www.pornhub.com/view_video.php?viewkey=6966454464c90",
	"https://www.pornhub.com/view_video.php?viewkey=6a1780573b173",
	"https://www.pornhub.com/view_video.php?viewkey=67f019b588cfc",
	"https://www.pornhub.com/view_video.php?viewkey=684150dcf1060",
	"https://www.pornhub.com/view_video.php?viewkey=67e43d3864d62",
	"https://www.pornhub.com/view_video.php?viewkey=685726b34361d",
	"https://www.pornhub.com/view_video.php?viewkey=678fee7886ea2",
	"https://www.pornhub.com/view_video.php?viewkey=68618783db7ae",
	"https://www.pornhub.com/view_video.php?viewkey=66591cfa857f7",
	"https://www.pornhub.com/view_video.php?viewkey=670a609a7ed90",
	"https://www.pornhub.com/view_video.php?viewkey=670a51ab06e55",
	"https://www.pornhub.com/view_video.php?viewkey=66a595ba6f060",
	"https://www.pornhub.com/view_video.php?viewkey=65de9989ee17f",
	"https://www.pornhub.com/view_video.php?viewkey=672a1bb01f946",
	"https://www.pornhub.com/view_video.php?viewkey=6509af7f38e37",
	"https://www.pornhub.com/view_video.php?viewkey=68ab2be30791f",
	"https://www.pornhub.com/view_video.php?viewkey=6533705d6565e",
	"https://www.pornhub.com/view_video.php?viewkey=654eebb6794c5",
	"https://www.pornhub.com/view_video.php?viewkey=660fbbbfb3252",
	"https://www.pornhub.com/view_video.php?viewkey=66ab6bb153441",
	"https://www.pornhub.com/view_video.php?viewkey=66abd8d5e6ee7",
	"https://www.pornhub.com/view_video.php?viewkey=66eacec376367",
	"https://www.pornhub.com/view_video.php?viewkey=ph6305078de3dd8",
	"https://www.pornhub.com/view_video.php?viewkey=6787823d1f3d5",
	"https://www.pornhub.com/view_video.php?viewkey=645bab1de3d43",
	"https://www.pornhub.com/view_video.php?viewkey=64956de900198",
	"https://www.pornhub.com/view_video.php?viewkey=660c8b359c8f9",
	"https://www.pornhub.com/view_video.php?viewkey=64c610a32505b",
	"https://www.pornhub.com/view_video.php?viewkey=65d87bb9822f9",
	"https://www.pornhub.com/view_video.php?viewkey=64922f8e63a69",
	"https://www.pornhub.com/view_video.php?viewkey=6859a816115eb",
	"https://www.pornhub.com/view_video.php?viewkey=662d1cbb379af",
	"https://www.pornhub.com/view_video.php?viewkey=699db47fea2c2",
	"https://www.pornhub.com/view_video.php?viewkey=672796900b71e",
	"https://www.pornhub.com/view_video.php?viewkey=69e2b269376cd",
	"https://www.pornhub.com/view_video.php?viewkey=6773c011a0024",
	"https://www.pornhub.com/view_video.php?viewkey=69e6651302318",
	"https://www.pornhub.com/view_video.php?viewkey=66ddeda55a909",
	"https://www.pornhub.com/view_video.php?viewkey=66c3db87108b3",
	"https://www.pornhub.com/view_video.php?viewkey=6849c93ee0633",
	"https://www.pornhub.com/view_video.php?viewkey=671541a037e44",
	"https://www.pornhub.com/view_video.php?viewkey=67081e511c8df",
	"https://www.pornhub.com/view_video.php?viewkey=6822cfdd25cbb",
	"https://www.pornhub.com/view_video.php?viewkey=678e7d61404da",
	"https://www.pornhub.com/view_video.php?viewkey=ph5fc3cc23d32d5",
	"https://www.pornhub.com/view_video.php?viewkey=646a7ab0bb318",
	"https://www.pornhub.com/view_video.php?viewkey=67a895a969607",
	"https://www.pornhub.com/view_video.php?viewkey=673de7e1425d8",
	"https://www.pornhub.com/view_video.php?viewkey=6506856d8449d",
	"https://www.pornhub.com/view_video.php?viewkey=67aa6991ab278",
	"https://www.pornhub.com/view_video.php?viewkey=ph636047816fd4b",
	"https://www.pornhub.com/view_video.php?viewkey=ph63365e7b0d1e8",
	"https://www.pornhub.com/view_video.php?viewkey=66c3a01c41488",
	"https://www.pornhub.com/view_video.php?viewkey=643e756bec400",
	"https://www.pornhub.com/view_video.php?viewkey=672a23e95d57e",
	"https://www.pornhub.com/view_video.php?viewkey=66da3ab7de6ca",
	"https://www.pornhub.com/view_video.php?viewkey=68de75b4e830e",
	"https://www.pornhub.com/view_video.php?viewkey=ph6202d02059f4f",
	"https://x.com/Apenasumescravo/status/2062477929226059860?s=20",
	"https://x.com/UnderAmberX/status/2061810916224585991?s=20",
	"https://x.com/Shrimpy2026/status/2060501928702857223?s=20",
	"https://x.com/doloresCBT666/status/2060448229339078697?s=20",
	"https://x.com/SuperiorWomen83/status/2059559907716911588?s=20",
	"https://x.com/MILKING_FARM/status/2058894058794217510?s=20",
	"https://x.com/UnderAmberX/status/2059016904220541378?s=20",
	"https://x.com/MILKING_FARM/status/2058438101278638282?s=20",
	"https://x.com/noorthw/status/2058250872061047118?s=20",
	"https://x.com/TightAndBright7/status/2057531031847162244?s=20",
	"https://x.com/BallbustingZone/status/2057226359588684034?s=20",
	"https://x.com/DominaFitness/status/2056744847495557322?s=20",
	"https://x.com/x_Latrina_x/status/2057228972711428236?s=20",
	"https://x.com/femdomBae/status/2056200844438073348?s=20",
	"https://x.com/kan8setagaya/status/2056278604083081572?s=20",
	"https://x.com/330_6459/status/2056436949196403130?s=20",
	"https://x.com/FemdomConte/status/2056269555161502065?s=20",
	"https://x.com/beastscage/status/2055947801226354973?s=20",
	"https://x.com/FemdomC0ntr0L/status/2055968552759509113?s=20",
	"https://x.com/kan8setagaya/status/2056278628825190423?s=20",
	"https://x.com/CBTRug/status/2056460670812537157?s=20",
	"https://x.com/Apenasumescravo/status/2055326088352665938?s=20",
	"https://x.com/x_Latrina_x/status/2054420471110861031?s=20",
	"https://x.com/G00N_OBSESSION/status/2053107062930854293?s=20",
	"https://x.com/SubbyGooner_/status/2030123146603323836?s=20",
	"https://x.com/SuperiorWomen83/status/2063374208185389279?s=20",
	"https://x.com/SuperiorWomen83/status/2062739015711764887?s=20",
	"https://x.com/Apenasumescravo/status/2063257388304736551?s=20",
	"https://x.com/Apenasumescravo/status/2063256972020134394?s=20",
	"https://x.com/Apenasumescravo/status/2062756340934811729?s=20",
	"https://x.com/Apenasumescravo/status/2062756120851333487?s=20",
	"https://x.com/Apenasumescravo/status/2062756020443869246?s=20",
	"https://x.com/Apenasumescravo/status/2062753690449219885?s=20",
	"https://x.com/Apenasumescravo/status/2062710071998771406?s=20",
	"https://nhentai.net/g/366392/",
	"https://nhentai.net/g/328759/",
	"https://nhentai.net/g/284243/",
	"https://nhentai.net/g/564007/",
	"https://nhentai.net/g/361964/",
	"https://nhentai.net/g/409775/",
	"https://nhentai.net/g/506794/",
	"https://nhentai.net/g/543216/",
	"https://nhentai.net/g/566293/",
	"https://nhentai.net/g/361003/",
	"https://nhentai.net/g/421001/",
	"https://nhentai.net/g/566294/",
	"https://nhentai.net/g/624163/",
	"https://nhentai.net/g/491537/",
	"https://nhentai.net/g/491539/",
	"https://nhentai.net/g/643570/",
	"https://rule34.xxx/index.php?page=post&s=view&id=16773324&tags=irelia_xan+webm+futanari+",
	"https://rule34.xxx/index.php?page=post&s=view&id=12418504&tags=femdom+webm+3d+longer_than_one_minute+league_of_legends+",
	"https://rule34.xxx/index.php?page=post&s=view&id=9409558&tags=femdom+webm+3d+longer_than_one_minute+league_of_legends+",
	"https://rule34.xxx/index.php?page=post&s=view&id=17155244&tags=femdom+webm+3d+longer_than_one_minute+",
	"https://x.com/I5IN4I/status/2063358629898502395?s=20",
	"https://x.com/doloresCBT666/status/2063154739567567178?s=20",
	"https://x.com/WPigdog85059/status/2062839815540785204?s=20",
	"https://x.com/zelden42/status/2063274250014740689?s=20",
	"https://x.com/UnderAmberX/status/2063020868918272328?s=20",
	"https://x.com/seasmallcock/status/2062759907615801801?s=20",
	"https://x.com/doloresCBT666/status/2062430993542234362?s=20",
	"https://x.com/mistressxalexis/status/2063014674405138543?s=20",
	"https://x.com/zelden42/status/2062893735076040884?s=20",
	"https://x.com/Ctfictionwriter/status/2063200352615166336?s=20",
	"https://x.com/Shrimpy2026/status/2062723162387644452?s=20",
	"https://x.com/doloresCBT666/status/2062754470493102133?s=20",
	"https://x.com/SGbbns/status/2063364524946678067?s=20",
	"https://x.com/kan8setagaya/status/2063038327197245515?s=20",
	"https://x.com/kan8setagaya/status/2063172730627981366?s=20",
	"https://x.com/slave_tom77/status/2063128107322642627?s=20",
	"https://x.com/gottin_der/status/2062890660751896876?s=20",
	"https://x.com/anzhai_1/status/2062852783762559182?s=20",
	"https://x.com/MommyCynthia69/status/2063204337443062065?s=20",
	"https://x.com/SnowBunBitch/status/2063240339910000872?s=20",
	"https://x.com/NTR_Cuckold_M/status/2062872247812100426?s=20",
	"https://x.com/MommyCynthia69/status/2063120016560595118?s=20",
	"https://x.com/MommyCynthia69/status/2061856113574764585?s=20",
	"https://x.com/BlackedTwoB/status/2063273780890275932?s=20",
	"https://x.com/kicks_kinks/status/2063228636396650575?s=20",
	"https://x.com/Ray_sub_6957/status/2062889969903968279?s=20",
	"https://x.com/Slave882294/status/2062856267303968925?s=20",
	"https://x.com/Ray_sub_6957/status/2062998865498784216?s=20",
	"https://x.com/butter72145/status/2063142449619341390?s=20",
	"https://x.com/TrainerCameron1/status/2063272187524428046?s=20",
	"https://x.com/Ray_sub_6957/status/2062854078409949613?s=20",
	"https://x.com/Bluebal82748283/status/2062077376217977107?s=20",
	"https://x.com/xoxoxogirl_69/status/2063213178436096115?s=20",
	"https://x.com/Ray_sub_6957/status/2062890602438549537?s=20",
	"https://x.com/CuckManl/status/2063054905980469565?s=20",
	"https://x.com/NTR_Cuckold_M/status/2062068247655297344?s=20",
	"https://x.com/CagedBratTamer/status/2062682347250589901?s=20",
	"https://x.com/DevilAlbedo/status/2063107753938244078?s=20",
	"https://x.com/godesscynthiia/status/2062804445725945875?s=20",
	"https://x.com/SubbyGooner_/status/2063226691896389907?s=20",
	"https://x.com/Loseph35/status/2062949713012240792?s=20",
	"https://x.com/Shrimpy2026/status/2063306116973330681?s=20",
	"https://x.com/kan8setagaya/status/2063172689196675118?s=20",
	"https://x.com/GoonaraEternal/status/2062451578989138283?s=20",
	"https://x.com/Blackdomin9ewo/status/2063021801970487498?s=20",
	"https://x.com/BallbustingTom/status/2062055717499007481?s=20",
	"https://x.com/BWCwhiteboynyc/status/2062803553052188693?s=20",
	"https://x.com/goddesselisaaa/status/2063131531992822080?s=20",
	"https://x.com/Evil__Woman_/status/2062852014736896347?s=20",
	"https://x.com/ShoeCashSlave/status/2063052497124565256?s=20",
	"https://x.com/aelyahgoddess/status/2063204246527279279?s=20",
	"https://x.com/6sjhg/status/2062734838352740389?s=20",
	"https://x.com/footmnijob/status/2062758962685173884?s=20",
];

type RandomWebsiteState = {
  currentLink: string | null;
  seenLinks: string[];
};

const PET_RANK_REWARDS = PET_RANKS.map((rank, index) => ({
  ...rank,
  image: `/pet-ranks/rank-${index + 1}.png`,
}));

function getPetRank(score: number) {
  const current = [...PET_RANKS].reverse().find((rank) => score >= rank.min) ?? PET_RANKS[0];
  const next = PET_RANKS.find((rank) => rank.min > score) ?? null;
  const nextMin = next?.min ?? 1000;
  const progress = next === null
    ? 100
    : Math.min(100, ((score - current.min) / (nextMin - current.min)) * 100);

  return { current, next, progress };
}

function normalizeWritingPreview(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "")
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u02BC\u02BB\uFF07\u00B4\u0060]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\uFF02]/g, '"')
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/\u2026/g, "...")
    .trim();
}

function writingPreviewStartsWith(target: string, input: string) {
  return normalizeWritingPreview(target).startsWith(normalizeWritingPreview(input));
}

function formatRemaining(target: string | null, now: number) {
  if (!target || now <= 0) {
    return "Not scheduled";
  }

  const totalMinutes = Math.max(0, Math.ceil((new Date(target).getTime() - now) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function getNextGmt3DailyReset(now: number) {
  if (now <= 0) {
    return null;
  }

  const shifted = new Date(now + 3 * 60 * 60 * 1000);
  const nextResetUtc =
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1, 0, 0, 0) -
    3 * 60 * 60 * 1000;

  return new Date(nextResetUtc).toISOString();
}

function getNextRightPrice(dailyPurchaseCount: number) {
  return DAILY_RIGHT_PRICES[dailyPurchaseCount] ?? null;
}

function getGmt3DateKey(date: Date | number | string) {
  return new Date(new Date(date).getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isPetTaskApprovedToday(task: PetTaskItem, now: number) {
  if (task.id === "pet-affection-claim" || task.status !== "approved" || now <= 0) {
    return false;
  }

  const today = getGmt3DateKey(now);
  const completedDate = task.completedAt ? getGmt3DateKey(task.completedAt) : null;
  const reviewedDate = task.reviewedAt ? getGmt3DateKey(task.reviewedAt) : null;
  const taskDate = task.clickDate ?? null;

  return completedDate === today || reviewedDate === today || taskDate === today;
}

function randomInteger(minimum: number, maximum: number) {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function randomPetName() {
  return DEBT_PET_NAMES[Math.floor(Math.random() * DEBT_PET_NAMES.length)] ?? DEBT_PET_NAMES[0];
}

function getRandomWebsiteState(): RandomWebsiteState {
  if (typeof window === "undefined") {
    return { currentLink: null, seenLinks: [] };
  }

  try {
    const stored = window.localStorage.getItem(RANDOM_WEBSITE_STATE_STORAGE_KEY);

    if (!stored) {
      return { currentLink: null, seenLinks: [] };
    }

    const parsed = JSON.parse(stored) as Partial<RandomWebsiteState>;
    const validLinks = new Set(RANDOM_WEBSITE_LINK_POOL);

    const currentLink =
      typeof parsed.currentLink === "string" && validLinks.has(parsed.currentLink)
        ? parsed.currentLink
        : null;
    const seenLinks = Array.isArray(parsed.seenLinks)
        ? parsed.seenLinks.filter((link): link is string => typeof link === "string" && validLinks.has(link))
        : [];

    return {
      currentLink,
      seenLinks: currentLink ? Array.from(new Set([...seenLinks, currentLink])) : seenLinks,
    };
  } catch {
    return { currentLink: null, seenLinks: [] };
  }
}

function writeRandomWebsiteState(state: RandomWebsiteState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(RANDOM_WEBSITE_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Mystery link state should never break the Pet section.
  }
}

function pickRandomWebsiteLink(state: RandomWebsiteState): RandomWebsiteState {
  if (RANDOM_WEBSITE_LINK_POOL.length === 0) {
    return { currentLink: null, seenLinks: [] };
  }

  const seenSet = new Set(state.seenLinks);
  let availableLinks = RANDOM_WEBSITE_LINK_POOL.filter(
    (link) => !seenSet.has(link) && link !== state.currentLink,
  );

  if (availableLinks.length === 0) {
    availableLinks = RANDOM_WEBSITE_LINK_POOL.filter((link) => link !== state.currentLink);
  }

  const selectedLink =
    availableLinks[Math.floor(Math.random() * availableLinks.length)] ??
    state.currentLink ??
    RANDOM_WEBSITE_LINK_POOL[0];
  const nextSeenLinks = Array.from(new Set([...state.seenLinks, selectedLink]));

  return {
    currentLink: selectedLink,
    seenLinks:
      nextSeenLinks.length >= RANDOM_WEBSITE_LINK_POOL.length
        ? [selectedLink]
        : nextSeenLinks,
  };
}

function randomWeightedWeeklyDebtDuration(amount: number) {
  const durationLimit = DEBT_RANDOM_DURATION_LIMITS.weekly;
  const amountLimit = DEBT_RANDOM_AMOUNT_LIMITS.weekly;
  const amountRange = amountLimit.max - amountLimit.min;
  const lowAmountBias =
    amountRange > 0 ? Math.max(0, (amountLimit.max - amount) / amountRange) : 0;
  const durationOptions = Array.from(
    { length: durationLimit.max - durationLimit.min + 1 },
    (_, index) => durationLimit.min + index,
  );
  const weightedOptions = durationOptions.map((duration) => {
    const durationRange = durationLimit.max - durationLimit.min;
    const highDurationBias =
      durationRange > 0 ? (duration - durationLimit.min) / durationRange : 0;

    return {
      duration,
      weight: 1 + lowAmountBias * highDurationBias * 5,
    };
  });
  const totalWeight = weightedOptions.reduce((sum, option) => sum + option.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const option of weightedOptions) {
    roll -= option.weight;

    if (roll <= 0) {
      return option.duration;
    }
  }

  return durationLimit.max;
}

function randomDebtPeriodType(): "weekly" | "monthly" {
  return Math.random() < 0.5 ? "weekly" : "monthly";
}

function getRandomDebtDraft(): {
  amount: number;
  duration: number;
  periodType: "weekly" | "monthly";
} {
  const periodType = randomDebtPeriodType();
  const durationLimit = DEBT_RANDOM_DURATION_LIMITS[periodType];
  const amountLimit = DEBT_RANDOM_AMOUNT_LIMITS[periodType];
  const amountStep = DEBT_RANDOM_AMOUNT_STEPS[periodType];
  const minimumMultiplier = amountLimit.min / amountStep;
  const maximumMultiplier = amountLimit.max / amountStep;
  const installmentAmount = randomInteger(minimumMultiplier, maximumMultiplier) * amountStep;
  const duration =
    periodType === "weekly"
      ? randomWeightedWeeklyDebtDuration(installmentAmount)
      : randomInteger(durationLimit.min, durationLimit.max);

  return {
    amount: installmentAmount,
    duration,
    periodType,
  };
}

const PET_CASE_DISPLAY_POOL = [
  { value: 100, tier: "ice", weight: 84 },
  { value: 150, tier: "ice", weight: 78 },
  { value: 200, tier: "blue", weight: 54 },
  { value: 300, tier: "blue", weight: 42 },
  { value: 500, tier: "pink", weight: 22 },
  { value: 750, tier: "pink", weight: 12 },
  { value: 1000, tier: "red", weight: 5 },
  { value: 1250, tier: "red", weight: 3 },
  { value: 1500, tier: "gold", weight: 1 },
];

const PET_CASE_DISPLAY_ITEMS = PET_CASE_DISPLAY_POOL.flatMap((item) =>
  Array.from({ length: item.weight }, () => ({ value: item.value, tier: item.tier })),
);

function randomCaseDisplayItem() {
  return PET_CASE_DISPLAY_ITEMS[Math.floor(Math.random() * PET_CASE_DISPLAY_ITEMS.length)];
}

const CASE_RESULT_INDEX = 20;
const EVIL_DISTRACTION_TEXTS = [
  "Confirm Obedience",
  "Click to Prove Loyalty",
  "Touch This",
  "Disobey?",
  "Claim Early",
  "Need Attention?",
];

function getCaseTierClass(tier: string) {
  switch (tier) {
    case "black":
      return "border-zinc-600/40 bg-black text-zinc-200 shadow-[0_0_14px_rgba(0,0,0,0.55)]";
    case "ice":
      return "border-cyan-200/35 bg-cyan-300/15 text-cyan-50";
    case "blue":
      return "border-blue-300/35 bg-blue-500/15 text-blue-50";
    case "pink":
      return "border-pink-300/40 bg-pink-500/18 text-pink-50";
    case "red":
      return "border-red-300/40 bg-red-600/18 text-red-50";
    case "gold":
      return "border-yellow-200/60 bg-yellow-300/20 text-yellow-50 shadow-[0_0_20px_rgba(250,204,21,0.3)]";
    default:
      return "border-pink-200/20 bg-pink-500/10 text-pink-50";
  }
}

export function PetSection({
  coins,
  favorCoinReward,
  galleryItems,
  isGuest,
  isDebtAutoPayEnabled,
  nextTaxDueAt,
  onClaimAffection,
  onConfessionSubmit,
  onCompleteTask,
  onCooldownAttempt,
  onDebtAutoPayChange,
  onPayDebtPeriod,
  onBuyRight,
  onSignDebtContract,
  onUseRight,
  onFalseHopeKey,
  onFavorPick,
  onOpenCase,
  onPetDailyClick,
  onPayWeeklyTax,
  onPetEvilWaitComplete,
  onPetEvilWaitFail,
  onPetEvilWaitStart,
  onPerfectWritingProgress,
  onRulesAcknowledge,
  petGalleryUnlockedIds,
  pendingPetActionIds = [],
  ownerLikeness,
  petScore,
  petDebtContract,
  petAffectionClaimed,
  petTaskCoinReward,
  storedRights,
  rightExpirations,
  dailyPurchaseCount,
  tasks,
  weeklyTaxCost,
}: {
  coins: number;
  favorCoinReward: number;
  galleryItems: PetGalleryItem[];
  isGuest?: boolean;
  isDebtAutoPayEnabled: boolean;
  nextTaxDueAt: string | null;
  onClaimAffection: () => void;
  onConfessionSubmit: (value: string, options?: { cheated?: boolean }) => void;
  onCompleteTask: (taskId: string) => void;
  onCooldownAttempt?: (message: string) => void;
  onDebtAutoPayChange: (enabled: boolean) => void;
  onPayDebtPeriod: () => void;
  onBuyRight: () => void;
  onSignDebtContract: (form: {
    debtAmount: number;
    durationPeriods: number;
    randomGenerated?: boolean;
    periodType: "weekly" | "monthly";
    petName: string;
  }) => Promise<boolean> | boolean;
  onUseRight: () => void;
  onFalseHopeKey: (key: "a" | "d") => void;
  onFavorPick: (index: number) => void;
  onOpenCase: (caseItem: PetCaseItem) => void;
  onPetDailyClick: () => void;
  onPayWeeklyTax: () => void;
  onPetEvilWaitComplete: () => void;
  onPetEvilWaitFail: () => void;
  onPetEvilWaitStart: () => void;
  onPerfectWritingProgress: (value: string) => void;
  onRulesAcknowledge: (text: string) => void;
  petGalleryUnlockedIds: string[];
  pendingPetActionIds?: string[];
  ownerLikeness: number;
  petScore: number;
  petDebtContract: PetDebtContract | null;
  petAffectionClaimed: boolean;
  petTaskCoinReward: number;
  storedRights: number;
  rightExpirations: string[];
  dailyPurchaseCount: number;
  tasks: PetTaskItem[];
  weeklyTaxCost: number;
}) {
  const [now, setNow] = useState(0);
  const [caseRolling, setCaseRolling] = useState(false);
  const [caseTrack, setCaseTrack] = useState<PetCaseItem[]>(() =>
    Array.from({ length: 34 }, () => randomCaseDisplayItem()),
  );
  const [caseTransform, setCaseTransform] = useState("translateX(0px)");
  const [caseResultVisible, setCaseResultVisible] = useState(false);
  const caseViewportRef = useRef<HTMLDivElement | null>(null);
  const caseResultRef = useRef<HTMLSpanElement | null>(null);
  const caseOpeningRef = useRef(false);
  const caseTimersRef = useRef<number[]>([]);
  const debtSignTimerRef = useRef<number | null>(null);
  const favorRevealTimerRef = useRef<number | null>(null);
  const [evilFloatingBoxes, setEvilFloatingBoxes] = useState<
    Array<{ id: number; left: string; rotate: string; text: string; top: string }>
  >([]);
  const [evilDistractionBoxes, setEvilDistractionBoxes] = useState<
    Array<{ id: number; left: string; rotate: string; text: string; top: string }>
  >([]);
  const [favorRevealing, setFavorRevealing] = useState(false);
  const [evilCountdown, setEvilCountdown] = useState(3);
  const [evilWaitRemaining, setEvilWaitRemaining] = useState(120);
  const [evilTeaseIndex, setEvilTeaseIndex] = useState(0);
  const [ruleInput, setRuleInput] = useState("");
  const [confessionInput, setConfessionInput] = useState("");
  const [perfectInput, setPerfectInput] = useState("");
  const [debtPetName, setDebtPetName] = useState(DEBT_PET_NAMES[0]);
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDuration, setDebtDuration] = useState("");
  const [debtPeriodType, setDebtPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [randomWebsiteLink, setRandomWebsiteLink] = useState<string | null>(null);
  const [showDebtSigningImage, setShowDebtSigningImage] = useState(false);
  const [falseHopeShaking, setFalseHopeShaking] = useState(false);
  const evilWaitFinishedRef = useRef(false);
  const onPetEvilWaitCompleteRef = useRef(onPetEvilWaitComplete);
  const onPetEvilWaitFailRef = useRef(onPetEvilWaitFail);
  const onFalseHopeKeyRef = useRef(onFalseHopeKey);
  const previousFalseHopeStageRef = useRef<number | null>(null);
  const isPetActionPending = (actionId: string) => pendingPetActionIds.includes(actionId);
  const nextDailyResetAt = getNextGmt3DailyReset(now);
  const handleCooldownAttempt = (message: string) => {
    onCooldownAttempt?.(message);
  };
  const activeRightExpirations = rightExpirations
    .filter((expiresAt) => now <= 0 || new Date(expiresAt).getTime() > now)
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());
  const displayedStoredRights = rightExpirations.length > 0 ? activeRightExpirations.length : storedRights;
  const rank = getPetRank(petScore);
  const approvedCount = tasks.filter((task) => isPetTaskApprovedToday(task, now)).length;
  const canClaimAffection = approvedCount >= 5 && !petAffectionClaimed;
  const weeklyTaxTask = tasks.find((task) => task.kind === "weekly-tax");
  const weeklyTaxCoolingDown =
    Boolean(weeklyTaxTask?.cooldownUntil) &&
    new Date(weeklyTaxTask?.cooldownUntil ?? "").getTime() > now;
  const debtTask = tasks.find((task) => task.kind === "debt-contract");
  const debtDurationLimit = DEBT_DURATION_LIMITS[debtPeriodType];
  const debtMinimumPayment = DEBT_MINIMUM_PAYMENTS[debtPeriodType];
  const debtPaymentDue =
    Boolean(petDebtContract) &&
    (petDebtContract?.paid_periods === 0 ||
      new Date(petDebtContract?.next_due_at ?? "").getTime() <= now);
  const debtInstallmentNumber = petDebtContract
    ? Math.min(petDebtContract.paid_periods + 1, petDebtContract.duration_periods)
    : 0;
  const remainingDebtBalance = petDebtContract
    ? Math.max(0, (petDebtContract.duration_periods - petDebtContract.paid_periods) * petDebtContract.debt_amount)
    : 0;
  const dailyClickTask = tasks.find((task) => task.kind === "daily-click");
  const regularTasks = tasks.filter(
    (task) => task.kind !== "debt-contract" && task.kind !== "weekly-tax" && task.kind !== "daily-click",
  );
  const evilWaitTask = tasks.find((task) => task.kind === "evil-wait");
  const falseHopeTask = tasks.find((task) => task.kind === "false-hope");
  const showFalseHopeWarning =
    falseHopeShaking &&
    falseHopeTask?.status !== "approved" &&
    falseHopeTask?.waitState !== "completed" &&
    !falseHopeTask?.cooldownUntil;

  useEffect(() => {
    onPetEvilWaitCompleteRef.current = onPetEvilWaitComplete;
    onPetEvilWaitFailRef.current = onPetEvilWaitFail;
  }, [onPetEvilWaitComplete, onPetEvilWaitFail]);

  useEffect(() => {
    onFalseHopeKeyRef.current = onFalseHopeKey;
  }, [onFalseHopeKey]);

  useEffect(() => () => {
    caseTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    if (debtSignTimerRef.current !== null) {
      window.clearTimeout(debtSignTimerRef.current);
    }
    if (favorRevealTimerRef.current !== null) {
      window.clearTimeout(favorRevealTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedState = getRandomWebsiteState();
      const nextState = storedState.currentLink ? storedState : pickRandomWebsiteLink(storedState);

      setRandomWebsiteLink(nextState.currentLink);
      writeRandomWebsiteState(nextState);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (isTypingTarget) {
        return;
      }

      if (key !== "a" && key !== "d") {
        return;
      }

      if (falseHopeTask?.cooldownUntil) {
        return;
      }

      onFalseHopeKeyRef.current(key);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [falseHopeTask?.cooldownUntil, falseHopeTask?.id]);

  useEffect(() => {
    const falseHopeTask = tasks.find((task) => task.kind === "false-hope");
    const stage = falseHopeTask?.falseHopeStage ?? 1;

    if (
      previousFalseHopeStageRef.current !== null &&
      stage > previousFalseHopeStageRef.current
    ) {
      setFalseHopeShaking(true);
      const timer = window.setTimeout(() => setFalseHopeShaking(false), 1600);
      previousFalseHopeStageRef.current = stage;
      return () => window.clearTimeout(timer);
    }

    previousFalseHopeStageRef.current = stage;
  }, [tasks]);

  useEffect(() => {
    if (evilWaitTask?.waitState !== "countdown") {
      return;
    }

    const endsAt = new Date(evilWaitTask.waitCountdownEndsAt ?? Date.now() + 3000).getTime();
    const interval = window.setInterval(() => {
      setEvilCountdown(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, 200);

    return () => window.clearInterval(interval);
  }, [evilWaitTask?.waitCountdownEndsAt, evilWaitTask?.waitState]);

  useEffect(() => {
    if (evilWaitTask?.waitState !== "countdown" && evilWaitTask?.waitState !== "waiting") {
      return;
    }

    let interval: number | null = null;
    let teaseInterval: number | null = null;
    let floatingTeaseInterval: number | null = null;
    let distractionTimer: number | null = null;
    let timer: number | null = null;
    let startTimer: number | null = null;
    let activeEvents: Array<keyof WindowEventMap> = [];
    let activeFail: (() => void) | null = null;
    let cleanupDistractions = false;

    const countdownEndsAt = evilWaitTask.waitCountdownEndsAt
      ? new Date(evilWaitTask.waitCountdownEndsAt).getTime()
      : Date.now();
    const waitEndsAt = new Date(evilWaitTask.waitEndsAt ?? Date.now() + 120000).getTime();
    const startDelay =
      evilWaitTask.waitState === "waiting"
        ? 0
        : Math.max(0, countdownEndsAt - Date.now());

    const startWaiting = () => {
      evilWaitFinishedRef.current = false;
      const remainingMs = waitEndsAt - Date.now();

      if (remainingMs <= 0) {
        evilWaitFinishedRef.current = true;
        queueMicrotask(() => {
          setEvilDistractionBoxes([]);
          setEvilWaitRemaining(0);
          onPetEvilWaitCompleteRef.current();
        });
        return;
      }

      setEvilWaitRemaining(Math.max(0, Math.ceil((waitEndsAt - Date.now()) / 1000)));

      const armedAt = Date.now() + 300;
      const fail = () => {
        if (evilWaitFinishedRef.current || Date.now() < armedAt) {
          return;
        }

        evilWaitFinishedRef.current = true;
        onPetEvilWaitFailRef.current();
      };

      interval = window.setInterval(() => {
        setEvilWaitRemaining(Math.max(0, Math.ceil((waitEndsAt - Date.now()) / 1000)));
      }, 250);
      teaseInterval = window.setInterval(() => {
        setEvilTeaseIndex((value) => value + 1);
      }, 5000);
      floatingTeaseInterval = window.setInterval(() => {
        const id = Date.now();
        setEvilFloatingBoxes((boxes) => [
          ...boxes.slice(-2),
          {
            id,
            left: `${Math.floor(Math.random() * 72) + 8}%`,
            rotate: `${Math.floor(Math.random() * 28) - 14}deg`,
            text: Math.random() > 0.35 ? "Confirm obedience" : "I accept",
            top: `${Math.floor(Math.random() * 58) + 16}%`,
          },
        ]);
        window.setTimeout(() => {
          setEvilFloatingBoxes((boxes) => boxes.filter((box) => box.id !== id));
        }, 4200);
      }, 13000);
      const spawnDistraction = () => {
        if (evilWaitFinishedRef.current) {
          return;
        }

        const elapsedRatio = Math.min(
          1,
          Math.max(0, 1 - (waitEndsAt - Date.now()) / 120000),
        );
        const id = Date.now() + Math.floor(Math.random() * 1000);
        const lifetime = Math.max(2200, 4200 - elapsedRatio * 1200);

        setEvilDistractionBoxes((boxes) => [
          ...boxes.slice(-3),
          {
            id,
            left: `${Math.floor(Math.random() * 68) + 8}%`,
            rotate: `${Math.floor(Math.random() * 34) - 17}deg`,
            text: EVIL_DISTRACTION_TEXTS[Math.floor(Math.random() * EVIL_DISTRACTION_TEXTS.length)],
            top: `${Math.floor(Math.random() * 54) + 14}%`,
          },
        ]);
        window.setTimeout(() => {
          setEvilDistractionBoxes((boxes) => boxes.filter((box) => box.id !== id));
        }, lifetime);
      };
      spawnDistraction();
      const getSpawnDelay = () => {
        const remaining = Math.max(0, Math.ceil((waitEndsAt - Date.now()) / 1000));
        return remaining < 35 ? 4200 : remaining < 75 ? 5600 : 7200;
      };
      const scheduleDistraction = () => {
        distractionTimer = window.setTimeout(() => {
          spawnDistraction();
          scheduleDistraction();
        }, getSpawnDelay());
      };
      scheduleDistraction();
      timer = window.setTimeout(() => {
        if (evilWaitFinishedRef.current) {
          return;
        }

        evilWaitFinishedRef.current = true;
        setEvilDistractionBoxes([]);
        onPetEvilWaitCompleteRef.current();
      }, remainingMs);
      activeEvents = [
        "click",
        "keydown",
        "mousedown",
        "mousemove",
        "pointermove",
        "scroll",
        "touchstart",
        "wheel",
      ];

      activeFail = fail;
      activeEvents.forEach((eventName) => window.addEventListener(eventName, fail));
      cleanupDistractions = true;
    };

    startTimer = window.setTimeout(startWaiting, startDelay);

    return () => {
      if (startTimer !== null) {
        window.clearTimeout(startTimer);
      }
      if (interval !== null) {
        window.clearInterval(interval);
      }
      if (teaseInterval !== null) {
        window.clearInterval(teaseInterval);
      }
      if (floatingTeaseInterval !== null) {
        window.clearInterval(floatingTeaseInterval);
      }
      if (distractionTimer !== null) {
        window.clearTimeout(distractionTimer);
      }
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      if (activeFail) {
        const listener = activeFail;
        activeEvents.forEach((eventName) => window.removeEventListener(eventName, listener));
      }
      if (cleanupDistractions) {
        setEvilDistractionBoxes([]);
      }
    };
  }, [evilWaitTask?.waitCountdownEndsAt, evilWaitTask?.waitEndsAt, evilWaitTask?.waitState]);

  function handlePerfectInput(value: string, sentence: string) {
    if (!writingPreviewStartsWith(sentence, value)) {
      setPerfectInput("");
      onPerfectWritingProgress(value);
      return;
    }

    setPerfectInput(value);
    onPerfectWritingProgress(value);
  }

  function showDebtSignedImage() {
    setShowDebtSigningImage(true);
    if (debtSignTimerRef.current !== null) {
      window.clearTimeout(debtSignTimerRef.current);
    }
    debtSignTimerRef.current = window.setTimeout(() => setShowDebtSigningImage(false), 4500);
  }

  async function signDebtContract(form: {
    debtAmount: number;
    durationPeriods: number;
    randomGenerated?: boolean;
    periodType: "weekly" | "monthly";
    petName: string;
  }) {
    const signed = await onSignDebtContract(form);

    if (signed) {
      showDebtSignedImage();
    }

    return signed;
  }

  async function handleDebtSign() {
    await signDebtContract({
      debtAmount: Number(debtAmount),
      durationPeriods: Number(debtDuration),
      periodType: debtPeriodType,
      petName: debtPetName,
    });
  }

  async function handleRandomDebtSign() {
    const draft = getRandomDebtDraft();
    const petName = randomPetName();

    setDebtPetName(petName);
    setDebtAmount(String(draft.amount));
    setDebtDuration(String(draft.duration));
    setDebtPeriodType(draft.periodType);
    await signDebtContract({
      debtAmount: draft.amount,
      durationPeriods: draft.duration,
      randomGenerated: true,
      periodType: draft.periodType,
      petName,
    });
  }

  function handleRandomWebsiteOpen() {
    if (!randomWebsiteLink) {
      return;
    }

    window.open(randomWebsiteLink, "_blank", "noopener,noreferrer");
    const nextState = pickRandomWebsiteLink(getRandomWebsiteState());

    setRandomWebsiteLink(nextState.currentLink);
    writeRandomWebsiteState(nextState);
  }

  function handleCaseOpen() {
    if (caseOpeningRef.current) {
      return;
    }

    caseOpeningRef.current = true;
    caseTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    caseTimersRef.current = [];
    const selectedCaseItem = randomCaseDisplayItem();
    const nextTrack = [
      ...Array.from({ length: CASE_RESULT_INDEX }, () => randomCaseDisplayItem()),
      selectedCaseItem,
      ...Array.from({ length: 10 }, () => randomCaseDisplayItem()),
    ];

    setCaseTrack(nextTrack);
    setCaseResultVisible(false);
    setCaseTransform("translateX(0px)");
    const alignTimer = window.setTimeout(() => {
      const viewport = caseViewportRef.current;
      const result = caseResultRef.current;

      if (viewport && result) {
        const viewportBox = viewport.getBoundingClientRect();
        const resultBox = result.getBoundingClientRect();
        const offset =
          viewportBox.left + viewportBox.width / 2 - (resultBox.left + resultBox.width / 2);
        setCaseTransform(`translateX(${Math.floor(offset)}px)`);
      }

      setCaseRolling(true);
    }, 50);
    const resultTimer = window.setTimeout(() => {
      try {
        onOpenCase(selectedCaseItem);
        setCaseResultVisible(true);
        const hideTimer = window.setTimeout(() => setCaseResultVisible(false), 10000);
        caseTimersRef.current.push(hideTimer);
      } finally {
        setCaseRolling(false);
        caseOpeningRef.current = false;
        caseTimersRef.current = caseTimersRef.current.filter((timer) => timer !== resultTimer);
      }
    }, 10000);
    caseTimersRef.current.push(alignTimer, resultTimer);
  }

  function handleFavorPick(index: number) {
    setFavorRevealing(true);
    onFavorPick(index);
    if (favorRevealTimerRef.current !== null) {
      window.clearTimeout(favorRevealTimerRef.current);
    }
    favorRevealTimerRef.current = window.setTimeout(() => setFavorRevealing(false), 900);
  }

  function handleConfessionSubmit() {
    onConfessionSubmit(confessionInput);
    setConfessionInput("");
  }

  function handleConfessionPasteAttempt() {
    setConfessionInput("");
    onConfessionSubmit("", { cheated: true });
  }

  const evilTeaseBoxes = [
    { left: "7%", top: "12%", text: "Confirm obedience" },
    { left: "42%", top: "35%", text: "Confirm obedience" },
    { left: "58%", top: "18%", text: "Download image" },
    { left: "27%", top: "48%", text: "Confirm obedience" },
    { left: "18%", top: "62%", text: "Almost yours" },
    { left: "63%", top: "66%", text: "Click to prove it" },
  ];

  return (
    <section className="rounded-[1.5rem] border border-rose-300/20 bg-[linear-gradient(145deg,rgba(0,0,0,0.84),rgba(76,5,25,0.48),rgba(20,0,28,0.86))] p-3 shadow-[0_0_54px_rgba(190,18,60,0.18)] sm:rounded-[2rem] sm:p-4">
      {isGuest && (
        <p className="mb-4 rounded-2xl border border-yellow-200/25 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100">
          Guest mode: Pet progression is local-only for development testing.
        </p>
      )}

      {evilFloatingBoxes.map((box) => (
        <div
          className="pointer-events-none fixed z-50 rounded-2xl border border-pink-100/40 bg-black/78 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-pink-50 shadow-[0_0_26px_rgba(236,72,153,0.42)] animate-[fadeOut_4.2s_linear_both]"
          key={box.id}
          style={{
            left: box.left,
            top: box.top,
            transform: `rotate(${box.rotate})`,
          }}
        >
          {box.text}
        </div>
      ))}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
        <div className="space-y-4">
          <div className="relative min-h-[20rem] overflow-hidden rounded-[1.25rem] border border-rose-200/15 bg-black sm:min-h-[24rem] sm:rounded-[1.5rem]">
            <Image
              alt="Evil Principessa"
              className="object-cover object-top opacity-82"
              fill
              sizes="(min-width: 1024px) 42vw, 100vw"
              src="/evil-principessa.png"
              unoptimized
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.82))]" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-rose-100/70">
                Principessa&apos;s Pet
              </p>
              <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">The darker vault opens.</h2>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-rose-200/15 bg-black/45 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-rose-200/70">
              Principessa&apos;s Thoughts
            </p>
            <p className="mt-3 text-sm leading-6 text-rose-50/80">
              A Pet is not promoted by noise. A Pet is shaped by proof, consistency,
              and review.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-[1.5rem] border border-rose-200/15 bg-black/45 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-rose-200/70">
                  Pet Rank
                </p>
                <h3 className="mt-1 text-2xl font-black text-white">{rank.current.title}</h3>
              </div>
              <p className="rounded-full border border-rose-200/20 bg-rose-500/10 px-3 py-1 text-xs font-black text-rose-50">
                {petScore}/1000
              </p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-700 via-pink-500 to-fuchsia-400 shadow-[0_0_20px_rgba(244,63,94,0.65)]"
                style={{ width: `${rank.progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              {rank.next
                ? `${Math.max(0, rank.next.min - petScore)} Pet Score to reach ${rank.next.title}.`
                : "Maximum Pet rank reached."}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-rose-200/15 bg-black/45 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-rose-200/70">
                  Owner Likeness
                </p>
                <h3 className="mt-1 text-2xl font-black text-white">{ownerLikeness}/100</h3>
              </div>
              {ownerLikeness <= 25 && (
                <span className="rounded-full border border-yellow-200/25 bg-yellow-400/10 px-3 py-1 text-xs font-black text-yellow-50">
                  Warning
                </span>
              )}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-700 via-yellow-400 to-emerald-300"
                style={{ width: `${Math.max(0, Math.min(100, ownerLikeness))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              Complete 6 Pet tasks per day to keep Owner Likeness stable.
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-rose-200/15 bg-black/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.24em] text-rose-200/70">
                Rank Gallery
              </p>
              <p className="text-xs font-semibold text-zinc-500">Download by rank</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
              {PET_RANK_REWARDS.map((reward) => {
                const unlocked = petScore >= reward.min;

                return (
                  <a
                    aria-disabled={!unlocked}
                    className={`group overflow-hidden rounded-2xl border bg-black/55 transition ${
                      unlocked
                        ? "border-pink-200/35 hover:border-pink-200/70 hover:shadow-[0_0_18px_rgba(236,72,153,0.22)]"
                        : "pointer-events-none border-white/10 opacity-45"
                    }`}
                    download
                    href={unlocked ? reward.image : undefined}
                    key={reward.title}
                    title={unlocked ? `${reward.title} icon` : `Requires ${reward.min} Pet Score`}
                  >
                    <div className="relative aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt=""
                        className={`h-full w-full object-cover ${unlocked ? "" : "blur-sm grayscale"}`}
                        src={reward.image}
                      />
                      {!unlocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-[10px] font-black uppercase tracking-[0.12em] text-rose-50">
                          {reward.min}
                        </div>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
        <div className="rounded-[1.5rem] border border-fuchsia-200/15 bg-black/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">
              Pet Gallery
            </p>
            <p className="text-xs font-semibold text-zinc-500">30-image Pet Score progression</p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 pr-1 sm:grid-cols-3 sm:gap-3">
            {galleryItems.map((item) => {
              const unlocked = petGalleryUnlockedIds.includes(item.id) || petScore >= item.unlockCost;

              return (
                <article
                  className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-black/45 sm:rounded-2xl"
                  key={item.id}
                >
                  <div className="relative aspect-[3/4] bg-black">
                    <Image
                      alt=""
                      className={`object-cover ${unlocked ? "" : "blur-md opacity-45"}`}
                      fill
                      sizes="180px"
                      src={item.image}
                      unoptimized
                    />
                    {!unlocked && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-center text-xs font-black uppercase tracking-[0.14em] text-rose-50">
                        <span>Locked</span>
                        <span className="mt-2 text-[10px] text-rose-100/70">
                          {item.unlockCost} score
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-2 sm:p-3">
                    <p className="truncate text-xs font-black text-white sm:text-sm">{item.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {unlocked ? "Unlocked" : `${item.unlockCost} Pet Score`}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-[1.5rem] border border-yellow-200/15 bg-yellow-400/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-yellow-100/70">
                  Weekly Tax
                </p>
                <p className="mt-1 text-sm text-yellow-50">
                  Due in: {formatRemaining(nextTaxDueAt, now)}
                </p>
              </div>
              <span className="rounded-full border border-yellow-100/20 bg-yellow-300/10 px-3 py-1 text-xs font-black text-yellow-50">
                +{weeklyTaxTask?.reward ?? 0} Pet Score
              </span>
            </div>
            <p className="mt-2 text-xs text-yellow-100/70">
              Pay {weeklyTaxCost} Principessa Coins within the daily window. Missing it may reduce affection.
            </p>
            <button
              aria-disabled={weeklyTaxCoolingDown || undefined}
              className={`mt-4 w-full rounded-2xl border border-yellow-200/25 bg-yellow-500/15 px-4 py-3 text-sm font-black text-yellow-50 transition enabled:hover:border-yellow-200/55 enabled:hover:bg-yellow-500/25 disabled:cursor-not-allowed disabled:opacity-40 ${
                weeklyTaxCoolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
              }`}
              disabled={coins < weeklyTaxCost || isPetActionPending("pet-weekly-throne-tax")}
              onClick={() => {
                if (weeklyTaxCoolingDown) {
                  handleCooldownAttempt(`Cooldown active. Available again in ${formatRemaining(weeklyTaxTask?.cooldownUntil ?? null, now)}.`);
                  return;
                }

                onPayWeeklyTax();
              }}
              type="button"
            >
              {isPetActionPending("pet-weekly-throne-tax")
                ? "Saving..."
                : weeklyTaxCoolingDown
                ? "Tax Paid"
                : coins < weeklyTaxCost
                  ? `Need ${weeklyTaxCost} Coins`
                  : `Pay ${weeklyTaxCost} Coins`}
            </button>
          </div>

          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            {regularTasks.map((task) => {
              const coolingDown =
                Boolean(task.cooldownUntil) &&
                new Date(task.cooldownUntil ?? "").getTime() > now;
              const pending = task.status === "pending";
              const approved = task.kind === "review" && task.status === "approved";
              const failed = task.status === "failed";
              const sentence = task.sentence ?? "";
              const actionPending = isPetActionPending(task.id);

              return (
                <article
                  className="flex min-h-0 min-w-0 flex-col rounded-[1.25rem] border border-red-300/20 bg-red-950/20 p-3 shadow-[0_0_22px_rgba(127,29,29,0.12)] sm:min-h-[22rem] sm:rounded-[1.5rem] sm:p-4"
                  key={task.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-black text-white sm:text-lg">{task.title}</h3>
                    <span className="rounded-full border border-red-200/20 bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase text-red-50">
                      {pending
                        ? "Review"
                        : approved
                          ? "Approved"
                          : failed
                            ? "Failed"
                            : task.kind === "confession-writing"
                              ? "Repetition"
                              : task.kind === "perfect-writing"
                                ? "Precision"
                                : task.kind === "case-open"
                                  ? "Case"
                                  : task.kind === "evil-wait"
                                    ? "Stillness"
                                    : task.kind === "randomized-rules"
                                      ? "Rules"
                                      : task.kind === "false-hope"
                                        ? "Sequence"
                                        : task.kind === "favor-roulette"
                                          ? "Roulette"
                                        : "Task"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{task.description}</p>
                  <p className="mt-3 text-xs font-bold text-red-100">
                    {task.kind === "review"
                      ? `Admin approve reward: +${task.reward} Pet Score, +${petTaskCoinReward} Coins`
                      : task.kind === "case-open"
                        ? `Completion reward: +${task.reward} Pet Score. Case reward only.`
                      : `Completion reward: +${task.reward} Pet Score, +${
                          task.kind === "favor-roulette" ? favorCoinReward : petTaskCoinReward
                        } Coins`}
                  </p>
                  {task.voiceSentence && (
                    <p className="mt-3 rounded-2xl border border-red-200/15 bg-black/35 p-3 text-sm leading-6 text-red-50">
                      {task.voiceSentence}
                    </p>
                  )}
                  {task.actionUrl && (
                    <a
                      className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-sky-200/25 bg-sky-500/10 px-4 py-3 text-sm font-black text-sky-50 transition hover:border-sky-200/55 hover:bg-sky-500/20"
                      href={task.actionUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {task.actionLabel ?? "Open Link"}
                    </a>
                  )}
                  {coolingDown && (
                    <p className="mt-2 text-xs text-yellow-100">
                      Available in {formatRemaining(task.cooldownUntil ?? null, now)}
                    </p>
                  )}

                  {task.kind === "confession-writing" && (
                    <div className="mt-auto space-y-3 rounded-2xl border border-red-200/15 bg-black/35 p-3">
                      <p className="rounded-2xl border border-red-200/10 bg-black/35 p-3 text-sm leading-6 text-red-50">
                      <span
                        className="block select-none"
                        onContextMenu={(event) => event.preventDefault()}
                      >
                        {task.sentence}
                      </span>
                      </p>
                      <div className="h-2 overflow-hidden rounded-full bg-black/70">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-red-700 via-pink-500 to-white transition-all"
                          style={{ width: `${((task.confessionCount ?? 0) / 5) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs font-bold text-red-100">
                        {task.confessionCount ?? 0}/5 exact repetitions
                      </p>
                      <input
                        className="w-full rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none transition focus:border-red-200/55 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={coolingDown || task.status === "approved" || actionPending}
                        onKeyDown={(event) => {
                          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
                            event.preventDefault();
                            handleConfessionPasteAttempt();
                          }
                        }}
                        onPaste={(event) => {
                          event.preventDefault();
                          handleConfessionPasteAttempt();
                        }}
                        onChange={(event) => setConfessionInput(event.target.value)}
                        placeholder="Type the sentence exactly..."
                        value={confessionInput}
                      />
                      <button
                        className="w-full rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={coolingDown || task.status === "approved" || actionPending || confessionInput.length === 0}
                        onClick={handleConfessionSubmit}
                        type="button"
                      >
                        Submit Line
                      </button>
                    </div>
                  )}

                  {task.kind === "perfect-writing" && (
                    <div className="mt-auto space-y-3">
                      <p
                        className="select-none rounded-2xl border border-red-200/10 bg-black/35 p-3 text-sm leading-6 text-red-50"
                        onContextMenu={(event) => event.preventDefault()}
                        onCopy={(event) => event.preventDefault()}
                        onCut={(event) => event.preventDefault()}
                      >
                        {sentence}
                      </p>
                      <p className="text-sm" aria-label="attempts remaining">
                        {Array.from({ length: Math.max(0, task.attemptsRemaining ?? 1) })
                          .map(() => "❤️")
                          .join("") || "No hearts"}
                      </p>
                      <input
                        className="w-full rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none transition focus:border-red-200/55 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={coolingDown || pending || actionPending}
                        onCopy={(event) => event.preventDefault()}
                        onCut={(event) => event.preventDefault()}
                        onChange={(event) => handlePerfectInput(event.target.value, sentence)}
                        onDrop={(event) => event.preventDefault()}
                        onPaste={(event) => event.preventDefault()}
                        placeholder="Type perfectly..."
                        value={perfectInput}
                      />
                    </div>
                  )}

                  {task.kind === "case-open" && (
                    <div className="mt-auto flex flex-1 flex-col rounded-2xl border border-pink-200/15 bg-black/35 p-3">
                      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/50 py-5" ref={caseViewportRef}>
                        <div className="pointer-events-none absolute left-1/2 top-1 z-10 -translate-x-1/2 text-lg font-black text-yellow-200 drop-shadow-[0_0_10px_rgba(250,204,21,0.7)]">
                          ↓
                        </div>
                        <div
                          className="flex gap-2 px-3 will-change-transform"
                          style={{
                            transform: caseTransform,
                            transition: caseRolling
                              ? "transform 10000ms cubic-bezier(0.04, 0.82, 0.16, 1)"
                              : "none",
                          }}
                        >
                          {caseTrack.map((item, index) => (
                            <span
                              className={`min-w-20 rounded-xl border px-2 py-2 text-center text-xs font-black sm:min-w-24 sm:px-3 sm:text-sm ${getCaseTierClass(item.tier)}`}
                              key={`${item.value}-${index}`}
                              ref={index === CASE_RESULT_INDEX ? caseResultRef : undefined}
                            >
                              {item.value > 0 ? `+${item.value}` : item.value}
                            </span>
                          ))}
                        </div>
                      </div>
                      {(typeof task.caseReward === "number" || caseResultVisible) && (
                        <p className="mt-3 rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100">
                          Last case: {(task.caseReward ?? 0) > 0 ? "+" : ""}{task.caseReward ?? 0} Principessa Coins
                        </p>
                      )}
                      <button
                        aria-disabled={coolingDown || undefined}
                        className={`mt-auto w-full rounded-2xl border border-pink-200/25 bg-pink-500/15 px-4 py-3 text-sm font-black text-pink-50 transition enabled:hover:border-pink-200/55 enabled:hover:bg-pink-500/25 disabled:cursor-not-allowed disabled:opacity-40 ${
                          coolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
                        }`}
                        disabled={caseRolling || actionPending}
                        onClick={() => {
                          if (coolingDown) {
                            handleCooldownAttempt(`Cooldown active. Available again in ${formatRemaining(task.cooldownUntil ?? null, now)}.`);
                            return;
                          }

                          handleCaseOpen();
                        }}
                        type="button"
                      >
                        {caseRolling || actionPending ? "Opening..." : coolingDown ? "Cooldown" : "Open Case"}
                      </button>
                    </div>
                  )}

                  {task.kind === "evil-wait" && (
                    <div className="mt-auto flex flex-1 flex-col rounded-2xl border border-red-200/15 bg-black/35 p-3">
                      <p className="text-sm leading-6 text-zinc-300">
                        Three second countdown, then 2 minutes with no input.
                      </p>
                      {(task.waitState === "waiting" ||
                        (task.waitState === "countdown" &&
                          task.waitCountdownEndsAt &&
                          new Date(task.waitCountdownEndsAt).getTime() <= now)) && (
                        <div className="relative mt-3 aspect-[16/10] overflow-hidden rounded-2xl border border-red-200/15 bg-black">
                          <Image
                            alt="Evil wait"
                            className="object-cover"
                            fill
                            sizes="360px"
                            src="/pet-wait-reveal.png"
                            unoptimized
                          />
                          {evilTeaseBoxes.map((box, index) => {
                            const activeBox = evilTeaseIndex % evilTeaseBoxes.length;
                            const showDownload =
                              evilWaitRemaining <= 25 && box.text === "Download image";

                            if (index !== activeBox && !showDownload) {
                              return null;
                            }

                            return (
                              <div
                                className="pointer-events-none absolute rounded-2xl border border-pink-100/40 bg-black/75 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-pink-50 shadow-[0_0_20px_rgba(236,72,153,0.35)] animate-[fadeOut_5s_linear_both]"
                                key={`${box.text}-${evilTeaseIndex}`}
                                style={{ left: box.left, top: box.top }}
                              >
                                {box.text}
                              </div>
                            );
                          })}
                          {evilDistractionBoxes.map((box) => (
                            <button
                              className="absolute z-20 rounded-2xl border border-pink-100/50 bg-black/82 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-pink-50 shadow-[0_0_22px_rgba(236,72,153,0.42)] animate-[fadeOut_4.2s_linear_both] sm:px-4 sm:py-3 sm:text-xs"
                              key={box.id}
                              disabled={actionPending}
                              onClick={onPetEvilWaitFail}
                              style={{
                                left: box.left,
                                top: box.top,
                                transform: `rotate(${box.rotate})`,
                              }}
                              type="button"
                            >
                              {box.text}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-black text-red-50">
                        {task.waitState === "countdown"
                          ? new Date(task.waitCountdownEndsAt ?? "").getTime() <= now
                            ? `Waiting ${evilWaitRemaining}s`
                            : `Countdown ${evilCountdown}`
                          : task.waitState === "waiting"
                            ? `Waiting ${evilWaitRemaining}s`
                            : task.waitState === "failed"
                              ? "Failed"
                              : task.waitState === "completed"
                                ? "Completed"
                                : coolingDown
                                  ? "Cooldown"
                                  : "Ready"}
                      </p>
                      <button
                        aria-disabled={coolingDown || undefined}
                        className={`mt-auto w-full rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40 ${
                          coolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
                        }`}
                        disabled={actionPending || task.waitState === "countdown" || task.waitState === "waiting"}
                        onClick={() => {
                          if (coolingDown) {
                            handleCooldownAttempt(`Cooldown active. Available again in ${formatRemaining(task.cooldownUntil ?? null, now)}.`);
                            return;
                          }

                          onPetEvilWaitStart();
                        }}
                        type="button"
                      >
                        {actionPending ? "Saving..." : coolingDown ? "Cooldown" : "Ready"}
                      </button>
                    </div>
                  )}

                  {task.kind === "randomized-rules" && (
                    <div className="mt-auto rounded-2xl border border-red-200/15 bg-black/35 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-red-100/70">
                        Forbidden Today
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(task.ruleBannedMechanics ?? []).map((mechanic) => (
                          <span
                            className="rounded-full border border-red-200/20 bg-red-500/15 px-3 py-1 text-xs font-black text-red-50"
                            key={mechanic}
                          >
                            {mechanic}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-xs leading-5 text-zinc-400">
                        Type exactly I understand. If you use a forbidden mechanic before accepting,
                        this task fails. After accepting, those mechanics stay locked until reset.
                      </p>
                      {task.status === "failed" && (
                        <p className="mt-3 rounded-2xl border border-rose-200/20 bg-rose-500/10 px-3 py-2 text-sm font-black text-rose-100">
                          Randomized rules failed.
                        </p>
                      )}
                      <input
                        className="mt-3 w-full rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none transition focus:border-red-200/55 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={coolingDown || task.ruleAcknowledged || actionPending}
                        onChange={(event) => setRuleInput(event.target.value)}
                        placeholder="I understand"
                        value={ruleInput}
                      />
                      <button
                        className="mt-3 w-full rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={coolingDown || task.ruleAcknowledged || actionPending || ruleInput !== "I understand"}
                        onClick={() => {
                          onRulesAcknowledge(ruleInput);
                          setRuleInput("");
                        }}
                        type="button"
                      >
                        {task.ruleAcknowledged ? "Locked Until Reset" : "Submit"}
                      </button>
                    </div>
                  )}

                  {task.kind === "false-hope" && (
                    <div
                      className={`mt-auto rounded-2xl border border-red-200/15 bg-black/35 p-3 ${
                        falseHopeShaking ? "animate-[pet-shake_1.4s_ease-in-out_both]" : ""
                      }`}
                    >
                      <div className="h-3 overflow-hidden rounded-full bg-black/70">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-red-700 via-pink-500 to-white transition-all"
                          style={{ width: `${task.falseHopeProgress ?? 0}%` }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-red-100/80">
                        <span>{task.falseHopeProgress ?? 0}%</span>
                        <span>Next: {(task.falseHopeExpectedKey ?? "a").toUpperCase()}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs font-bold text-rose-100">
                        <span>Wrong: {task.falseHopeWrongInputs ?? 0}/10</span>
                        <span>{Math.max(0, 10 - (task.falseHopeWrongInputs ?? 0))} mistakes left</span>
                      </div>
                      {showFalseHopeWarning && (
                        <p className="mt-3 rounded-2xl border border-pink-200/25 bg-pink-500/10 px-3 py-2 text-sm font-black text-pink-50">
                          So close. Did you really think it would be that easy?
                        </p>
                      )}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(["a", "d"] as const).map((key) => (
                          <button
                            aria-disabled={coolingDown || undefined}
                            className={`rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black uppercase text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40 ${
                              coolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
                            }`}
                            disabled={false}
                            key={key}
                            onClick={() => {
                              if (coolingDown) {
                                handleCooldownAttempt(`Cooldown active. Available again in ${formatRemaining(task.cooldownUntil ?? null, now)}.`);
                                return;
                              }

                              onFalseHopeKey(key);
                            }}
                            type="button"
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {task.kind === "favor-roulette" && (
                    <div className="mt-4 rounded-2xl border border-pink-200/15 bg-black/35 p-3">
                      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                        {Array.from({ length: 5 }, (_, index) => {
                          const revealed = typeof task.favorPickedIndex === "number" && task.favorPickedIndex >= 0;
                          const picked = task.favorPickedIndex === index;
                          const winning = task.favorWinningIndex === index && task.favorResult !== "empty-day";
                          const label = !revealed
                            ? "?"
                            : winning
                              ? "Special Favor"
                              : "Disappointment";

                          return (
                            <button
                              className={`flex aspect-[4/5] min-h-[4.75rem] min-w-0 items-center justify-center rounded-xl border px-1 py-3 text-center text-xs font-black uppercase tracking-[0.08em] transition sm:aspect-[5/4] sm:min-h-[5.5rem] sm:rounded-2xl ${
                                picked && task.favorResult === "win"
                                  ? "border-yellow-200/70 bg-yellow-300/15 shadow-[0_0_24px_rgba(250,204,21,0.35)]"
                                  : picked
                                    ? "border-pink-200/45 bg-pink-500/15"
                                    : revealed
                                      ? "border-white/10 bg-black/45"
                                      : "border-pink-200/20 bg-[linear-gradient(145deg,rgba(236,72,153,0.2),rgba(88,28,135,0.24))] hover:border-pink-200/55"
                              } ${favorRevealing && picked ? "scale-105" : ""} ${
                                coolingDown ? CLICKABLE_COOLDOWN_TILE_CLASS : ""
                              }`}
                              aria-disabled={coolingDown || undefined}
                              disabled={revealed || actionPending}
                              key={index}
                              onClick={() => {
                                if (coolingDown) {
                                  handleCooldownAttempt(`Cooldown active. Available again in ${formatRemaining(task.cooldownUntil ?? null, now)}.`);
                                  return;
                                }

                                handleFavorPick(index);
                              }}
                              type="button"
                            >
                              <span className="sr-only">{revealed ? label : `Hidden card ${index + 1}`}</span>
                              <span aria-hidden="true" className="leading-tight text-pink-50/90">
                                {!revealed ? "?" : winning ? "Favor" : "Empty"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {task.favorResult && (
                        <p
                          className={`mt-3 rounded-2xl border px-3 py-2 text-sm font-semibold ${
                            task.favorResult === "win"
                              ? "border-yellow-200/30 bg-yellow-300/10 text-yellow-50"
                              : "border-rose-200/20 bg-rose-500/10 text-rose-100"
                          }`}
                        >
                          {task.favorResult === "win"
                            ? `Special Favor. +${task.reward} Pet Score, +${favorCoinReward} Coins.`
                            : task.favorResult === "empty-day"
                              ? "No winning card existed today."
                              : "Disappointment."}
                        </p>
                      )}
                    </div>
                  )}

                  {task.kind === "daily-click" && (
                    <div className="mt-auto rounded-2xl border border-pink-200/15 bg-black/35 p-3">
                      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-pink-200/15 bg-black/45">
                        {(() => {
                          const clickRequirement = task.clickRequirement ?? 0;
                          const clickProgress = task.clickProgress ?? 0;
                          const revealProgress =
                            clickRequirement > 0
                              ? Math.min(1, Math.max(0, clickProgress / clickRequirement))
                              : 0;
                          const censorOpacity = Math.max(0, 1 - revealProgress);
                          const censorBlur = Math.round(18 * censorOpacity);

                          return (
                            <>
                              {task.clickImage ? (
                                <Image
                                  alt="Daily pet click"
                                  className="object-cover"
                                  fill
                                  sizes="360px"
                                  src={task.clickImage}
                                  unoptimized
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center px-4 text-center text-xs font-black uppercase tracking-[0.18em] text-pink-100/60">
                                  Image unlocks on first click
                                </div>
                              )}
                              {censorOpacity > 0 && (
                                <div
                                  className="absolute inset-0 border border-black/20 bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.94)_0_12px,rgba(236,72,153,0.72)_12px_20px),repeating-linear-gradient(-45deg,rgba(0,0,0,0.88)_0_10px,rgba(0,0,0,0.5)_10px_18px)] backdrop-blur-md transition-all"
                                  style={{
                                    backdropFilter: `blur(${censorBlur}px)`,
                                    opacity: censorOpacity,
                                  }}
                                />
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/70">
                        <div
                          className="h-full rounded-full bg-pink-400 transition-all"
                          style={{
                            width:
                              task.clickRequirement && task.clickRequirement > 0
                                ? `${Math.min(100, ((task.clickProgress ?? 0) / task.clickRequirement) * 100)}%`
                                : "0%",
                          }}
                        />
                      </div>
                      <p className="mt-2 text-xs font-bold text-pink-100/75">
                        {(task.clickProgress ?? 0).toLocaleString()} /{" "}
                        {task.status === "approved" && (task.clickRequirement ?? 0) > 0
                          ? task.clickRequirement?.toLocaleString()
                          : "???"} clicks
                      </p>
                      <button
                        className="mt-3 w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-black text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={actionPending || task.status === "approved"}
                        onClick={onPetDailyClick}
                        type="button"
                      >
                        {actionPending
                          ? "Saving..."
                          : task.status === "approved"
                            ? "Completed Today"
                            : "Click"}
                      </button>
                    </div>
                  )}

                  {task.kind === "review" && (
                    <button
                      aria-disabled={coolingDown || undefined}
                      className={`mt-auto w-full rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40 ${
                        coolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
                      }`}
                      disabled={pending || actionPending}
                      onClick={() => {
                        if (coolingDown) {
                          handleCooldownAttempt(`Cooldown active. Available again in ${formatRemaining(task.cooldownUntil ?? null, now)}.`);
                          return;
                        }

                        onCompleteTask(task.id);
                      }}
                      type="button"
                    >
                      {actionPending ? "Saving..." : pending ? "Pending Review" : coolingDown ? "Cooldown" : "Submit for Review"}
                    </button>
                  )}
                </article>
              );
            })}
            <article className="flex min-h-0 min-w-0 flex-col rounded-[1.25rem] border border-red-300/20 bg-red-950/20 p-3 shadow-[0_0_22px_rgba(127,29,29,0.12)] sm:min-h-[22rem] sm:rounded-[1.5rem] sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-red-100/70">
                    Rights
                  </p>
                  <h3 className="text-base font-black text-white sm:text-lg">{RIGHTS_TASK_TITLE}</h3>
                </div>
                <span className="rounded-full border border-red-200/20 bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase text-red-50">
                  Task
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{RIGHTS_TASK_DESCRIPTION}</p>
              <div
                className="mt-3 min-h-28 rounded-2xl border border-red-200/15 bg-black/35 bg-contain bg-center bg-no-repeat"
                style={{
                  backgroundImage: `url("${RIGHTS_IMAGE_PATH_PREFIX}-${Math.min(5, Math.max(0, displayedStoredRights))}.png")`,
                }}
              />
              <div className="mt-3 grid gap-2 rounded-2xl border border-red-200/15 bg-black/35 p-3 text-sm font-bold text-red-50">
                <div className="flex items-center justify-between gap-3">
                  <span>Stored rights</span>
                  <span>{displayedStoredRights.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-zinc-300">
                  <span>Daily purchases</span>
                  <span>{Math.min(5, dailyPurchaseCount)}/5</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-zinc-300">
                  <span>Next price today</span>
                  <span>
                    {getNextRightPrice(dailyPurchaseCount) === null
                      ? "Maxed"
                      : `${getNextRightPrice(dailyPurchaseCount)?.toLocaleString()} Coins`}
                  </span>
                </div>
                <div className="grid gap-1 border-t border-red-200/10 pt-2 text-xs text-zinc-300">
                  {activeRightExpirations.length > 0 ? (
                    activeRightExpirations.map((expiresAt, index) => (
                      <div className="flex items-center justify-between gap-3" key={`${expiresAt}-${index}`}>
                        <span>Right {index + 1}</span>
                        <span>{formatRemaining(expiresAt, now)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <span>No stored rights</span>
                      <span>--</span>
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-500/10 px-3 py-2 text-xs font-bold leading-5 text-yellow-50/85">
                {RIGHTS_TASK_WARNING}
              </p>
              <div className="mt-auto grid gap-2 pt-4">
                <button
                  className="w-full rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={
                    isPetActionPending("rights:buy") ||
                    getNextRightPrice(dailyPurchaseCount) === null ||
                    coins < (getNextRightPrice(dailyPurchaseCount) ?? Number.POSITIVE_INFINITY)
                  }
                  onClick={onBuyRight}
                  type="button"
                >
                  {isPetActionPending("rights:buy")
                    ? "Buying..."
                    : getNextRightPrice(dailyPurchaseCount) === null
                      ? "Daily Max Reached"
                      : "Buy Right"}
                </button>
                <button
                  className="w-full rounded-2xl border border-pink-200/25 bg-pink-500/15 px-4 py-3 text-sm font-black text-pink-50 transition enabled:hover:border-pink-200/55 enabled:hover:bg-pink-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={isPetActionPending("rights:use") || displayedStoredRights <= 0}
                  onClick={onUseRight}
                  type="button"
                >
                  {isPetActionPending("rights:use") ? "Using..." : "I Used My Right"}
                </button>
              </div>
            </article>
          </div>

          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(18rem,0.95fr)_minmax(14rem,0.7fr)]">
            {dailyClickTask && (
              <article className="flex min-h-0 min-w-0 flex-col rounded-[1.5rem] border border-red-300/20 bg-red-950/20 p-4 shadow-[0_0_22px_rgba(127,29,29,0.12)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-white">{dailyClickTask.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">{dailyClickTask.description}</p>
                  </div>
                  <span className="rounded-full border border-red-200/20 bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase text-red-50">
                    Task
                  </span>
                </div>
                <p className="mt-3 text-xs font-bold text-red-100">
                  Completion reward: +{dailyClickTask.reward} Pet Score. Click reward: up to 250 Coins.
                </p>
                <div className="mt-3 rounded-2xl border border-pink-200/15 bg-black/35 p-3">
                  <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-pink-200/15 bg-black/45">
                    {(() => {
                      const clickRequirement = dailyClickTask.clickRequirement ?? 0;
                      const clickProgress = dailyClickTask.clickProgress ?? 0;
                      const revealProgress =
                        clickRequirement > 0
                          ? Math.min(1, Math.max(0, clickProgress / clickRequirement))
                          : 0;
                      const censorOpacity = Math.max(0, 1 - revealProgress);
                      const censorBlur = Math.round(18 * censorOpacity);

                      return (
                        <>
                          {dailyClickTask.clickImage ? (
                            <Image
                              alt="Daily pet click"
                              className="object-cover"
                              fill
                              sizes="360px"
                              src={dailyClickTask.clickImage}
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center px-4 text-center text-xs font-black uppercase tracking-[0.18em] text-pink-100/60">
                              Image unlocks on first click
                            </div>
                          )}
                          {censorOpacity > 0 && (
                            <div
                              className="absolute inset-0 border border-black/20 bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.94)_0_12px,rgba(236,72,153,0.72)_12px_20px),repeating-linear-gradient(-45deg,rgba(0,0,0,0.88)_0_10px,rgba(0,0,0,0.5)_10px_18px)] backdrop-blur-md transition-all"
                              style={{
                                backdropFilter: `blur(${censorBlur}px)`,
                                opacity: censorOpacity,
                              }}
                            />
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/70">
                    <div
                      className="h-full rounded-full bg-pink-400 transition-all"
                      style={{
                        width:
                          dailyClickTask.clickRequirement && dailyClickTask.clickRequirement > 0
                            ? `${Math.min(100, ((dailyClickTask.clickProgress ?? 0) / dailyClickTask.clickRequirement) * 100)}%`
                            : "0%",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-bold text-pink-100/75">
                    {(dailyClickTask.clickProgress ?? 0).toLocaleString()} /{" "}
                    {dailyClickTask.status === "approved" && (dailyClickTask.clickRequirement ?? 0) > 0
                      ? dailyClickTask.clickRequirement?.toLocaleString()
                      : "???"} clicks
                  </p>
                  <button
                    className="mt-3 w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-black text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={dailyClickTask.status === "approved"}
                    onClick={onPetDailyClick}
                    type="button"
                  >
                    {dailyClickTask.status === "approved" ? "Completed Today" : "Click"}
                  </button>
                </div>
              </article>
            )}

            <article className="flex min-h-full min-w-0 flex-col rounded-[1.5rem] border border-pink-200/15 bg-black/45 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-pink-200/70">
                    Mystery Link
                  </p>
                  <h3 className="mt-1 text-lg font-black text-white">Random Website Generator</h3>
                </div>
                <span className="rounded-full border border-pink-200/20 bg-pink-500/10 px-2 py-1 text-[10px] font-black uppercase text-pink-50">
                  Mystery
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                Opens an unknown external destination. Each click prepares a different hidden link
                until the whole pool has been used.
              </p>
              <div className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-50/85">
                The destination may contain adult-oriented content. Be mindful of your surroundings
                before opening it.
              </div>
              <div className="mt-3 rounded-2xl border border-pink-200/10 bg-black/35 px-3 py-2 text-xs font-bold text-zinc-400">
                {randomWebsiteLink
                  ? "A mystery destination is ready."
                  : "No destination configured."}
              </div>
              <div className="mt-auto pt-4">
                <button
                  className="w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-black text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!randomWebsiteLink}
                  onClick={handleRandomWebsiteOpen}
                  type="button"
                >
                  {randomWebsiteLink ? "Click" : "No destination configured"}
                </button>
              </div>
            </article>
          </div>

          {debtTask && (
            <article className="rounded-[1.5rem] border border-red-300/20 bg-red-950/20 p-4 shadow-[0_0_22px_rgba(127,29,29,0.12)]">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-black text-white">{debtTask.title}</h3>
                <span className="rounded-full border border-red-200/20 bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase text-red-50">
                  Contract
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{debtTask.description}</p>
              {showDebtSigningImage && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-red-200/25 bg-black/45 shadow-[0_0_28px_rgba(248,113,113,0.18)]">
                  <div
                    className="flex min-h-28 items-center justify-center bg-cover bg-center px-4 py-8 text-center"
                    style={{ backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0.82), rgba(127,29,29,0.28)), url(${DEBT_SIGNING_IMAGE_PATH})` }}
                  >
                    <p className="text-sm font-black uppercase tracking-[0.24em] text-red-50">
                      Contract signed
                    </p>
                  </div>
                </div>
              )}
              {petDebtContract && petDebtContract.status === "active" ? (
                <div className="mt-4 rounded-2xl border border-red-200/15 bg-black/35 p-3">
                  <div className="grid gap-2 text-sm text-red-50 sm:grid-cols-2">
                    <span>Pet: {petDebtContract.pet_name}</span>
                    <span>{petDebtContract.period_type} debt</span>
                    <span>
                      Installment: {debtInstallmentNumber}/{petDebtContract.duration_periods}
                    </span>
                    <span>
                      Current payment: {petDebtContract.debt_amount.toLocaleString()} Coins
                    </span>
                    <span>
                      Next availability: {debtPaymentDue ? "Open now" : formatRemaining(petDebtContract.next_due_at, now)}
                    </span>
                    <span>
                      Remaining balance: {remainingDebtBalance.toLocaleString()} Coins
                    </span>
                    <span>Paid periods: {petDebtContract.paid_periods}</span>
                    <span>Missed: {petDebtContract.missed_periods}</span>
                  </div>
                  <p className="mt-3 rounded-2xl border border-red-200/10 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-50/80">
                    Future installments are locked. Only the current{" "}
                    {petDebtContract.period_type === "weekly" ? "week" : "month"} can be paid.
                  </p>
                  <div className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-500/10 px-3 py-3 text-xs font-bold text-yellow-50/85">
                    <AutoPaymentSwitch
                      enabled={isDebtAutoPayEnabled}
                      onChange={onDebtAutoPayChange}
                    />
                    <p className="mt-2 text-yellow-50/75">
                      When enabled, each installment is paid automatically as soon as it becomes
                      available.
                    </p>
                    <p className="mt-2 text-yellow-50/75">
                      If auto payment is off and an installment is missed, missed debt is still
                      collected from coin balance and can push balance below zero.
                    </p>
                    <p className="mt-2 text-yellow-50/75">
                      Debt contracts cannot be removed here. Only admin can delete or cancel debt
                      records.
                    </p>
                  </div>
                  <button
                    className="mt-4 w-full rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!debtPaymentDue || isPetActionPending("pet-debt-contract")}
                    onClick={onPayDebtPeriod}
                    type="button"
                  >
                    {isPetActionPending("pet-debt-contract")
                      ? "Saving..."
                      : !debtPaymentDue
                      ? "Next installment locked"
                      : `Pay installment ${debtInstallmentNumber}`}
                  </button>
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  <select
                    className="rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none transition focus:border-red-200/55"
                    onChange={(event) => setDebtPetName(event.target.value)}
                    value={debtPetName}
                  >
                    {DEBT_PET_NAMES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <p className="rounded-2xl border border-red-200/15 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-50">
                    Minimum Payment: {debtMinimumPayment.toLocaleString()} Coins per{" "}
                    {debtPeriodType === "weekly" ? "Week" : "Month"}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <select
                      className="rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
                      onChange={(event) => setDebtPeriodType(event.target.value as "weekly" | "monthly")}
                      value={debtPeriodType}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    <input
                      className="rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
                      inputMode="numeric"
                      min={debtMinimumPayment}
                      onChange={(event) => setDebtAmount(event.target.value)}
                      placeholder={`Min ${debtMinimumPayment.toLocaleString()}`}
                      value={debtAmount}
                    />
                    <input
                      className="rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
                      inputMode="numeric"
                      max={debtDurationLimit.max}
                      min={debtDurationLimit.min}
                      onChange={(event) => setDebtDuration(event.target.value)}
                      placeholder={`${debtDurationLimit.label} ${debtDurationLimit.min}-${debtDurationLimit.max}`}
                      value={debtDuration}
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    Duration must be {debtDurationLimit.min}-{debtDurationLimit.max}{" "}
                    {debtDurationLimit.label.toLowerCase()} for {debtPeriodType} contracts.
                  </p>
                  <button
                    className="rounded-2xl border border-red-200/20 bg-red-500/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-red-50 transition enabled:hover:border-red-200/50 enabled:hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={isPetActionPending("pet-debt-contract")}
                    onClick={handleRandomDebtSign}
                    type="button"
                  >
                    {isPetActionPending("pet-debt-contract") ? "Signing..." : "Sign Random Debt"}
                  </button>
                  <p className="rounded-2xl border border-red-200/15 bg-black/35 px-3 py-2 text-xs font-bold text-red-50/75">
                    Warning: Sign Random Debt immediately creates a debt contract with a random
                    Pet name, weekly/monthly type, amount, and duration.
                  </p>
                  <p className="rounded-2xl border border-yellow-200/20 bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-50/80">
                    Auto payment is off by default. Missed debt is still collected automatically
                    after the payment window is missed, and coin balance may go below zero. Debt
                    contracts can only be removed by admin.
                  </p>
                  <div className="rounded-2xl border border-red-200/15 bg-black/35 px-3 py-3 text-xs font-bold text-red-50/85">
                    <AutoPaymentSwitch
                      enabled={isDebtAutoPayEnabled}
                      onChange={onDebtAutoPayChange}
                    />
                  </div>
                  <button
                    className="rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition hover:border-red-200/55 hover:bg-red-600/25"
                    onClick={handleDebtSign}
                    type="button"
                  >
                    Sign Debt Contract
                  </button>
                </div>
              )}
            </article>
          )}

          <div className="rounded-[1.5rem] border border-pink-200/15 bg-black/45 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-pink-200/70">
              Pet Milestone
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
  		If at least 5 Pet tasks are approved,
  		claim +10 Pet Score.
		</p>
            <p className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-100">
              Daily reset in {formatRemaining(nextDailyResetAt, now)}
            </p>
            <button
              className="mt-4 rounded-2xl border border-pink-200/25 bg-pink-500/10 px-4 py-3 text-sm font-black text-pink-50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canClaimAffection || isPetActionPending("pet-affection-claim")}
              onClick={onClaimAffection}
              type="button"
            >
              {isPetActionPending("pet-affection-claim")
                ? "Saving..."
                : petAffectionClaimed
  		? "Already Claimed"
  		: canClaimAffection
   		 ? "Claim +10 Pet Score"
   		 : `${approvedCount}/5 approved`}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function AutoPaymentSwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      aria-pressed={enabled}
      className="flex w-full items-center gap-3 text-left"
      onClick={() => onChange(!enabled)}
      type="button"
    >
      <span className="min-w-0 flex-1">Auto payment</span>
      <span className="ml-auto inline-flex items-center gap-2">
        <span
          className={`relative h-7 w-14 rounded-full border transition ${
            enabled
              ? "border-emerald-200/40 bg-emerald-400/25"
              : "border-red-200/25 bg-black/55"
          }`}
        >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full transition ${
            enabled
              ? "left-7 bg-emerald-100 shadow-[0_0_14px_rgba(110,231,183,0.55)]"
              : "left-1 bg-red-100/80"
          }`}
        />
        </span>
        <span className={enabled ? "text-emerald-100" : "text-red-100/80"}>
          {enabled ? "ON" : "OFF"}
        </span>
      </span>
    </button>
  );
}
