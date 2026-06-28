"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  formatPetThroneAmount,
  getPetThroneRewardBreakdown,
  PET_THRONE_AMOUNTS,
  PET_THRONE_TASK_ID,
} from "@/lib/pet-throne";
import type { PetDebtContract, PetGalleryItem, PetTaskItem } from "@/lib/types";
import { emitSoundEvent } from "@/lib/sound";

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
const EVIL_DEBT_DURATION_MULTIPLIER = 2.5;
const EVIL_CONSENT_PRIMARY_TEXT =
  "I confirm that these images belong to me and I am sharing them with my own consent.";
const EVIL_CONSENT_SECONDARY_TEXT =
  "I consent that Principessa may use these images and I accept the consequences.";
const EVIL_DEBT_TIMEZONE_OPTIONS = Array.from({ length: 25 }, (_, index) => {
  const offset = index - 12;
  return `UTC${offset >= 0 ? "+" : ""}${offset}`;
});
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
  "Pay for stored cumming rights or consume one after cumming. Stored rights persist for two days.";
const RIGHTS_TASK_WARNING =
  "This task depends entirely on your honesty. It is impossible for me to verify every real-world use automatically.";
const RIGHTS_IMAGE_PATH_PREFIX = "/pet/rights/right";
const DAILY_RIGHT_PRICES = [1500, 2500, 5000, 7500, 10000] as const;
const RANDOM_WEBSITE_STATE_STORAGE_KEY = "vault:random-website-state";

function CooldownButtonContent({ label }: { label: string }) {
  return <span>{label}</span>;
}

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
	"https://x.com/xixi_lune/status/2062822482286141821?s=20",
	"https://x.com/blxssful22/status/2063336405573500934?s=20",
	"https://x.com/FemdomConte/status/2063521842183221667?s=20",
	"https://x.com/kan8setagaya/status/2063574182177431759?s=20",
	"https://x.com/FemdomConte/status/2063642889700491769?s=20",
	"https://x.com/onlyforfun_123/status/2063590272420950440?s=20",
	"https://x.com/Stacy_Locked/status/2063585922226999434?s=20",
	"https://x.com/onlyforfun_123/status/2063593360708047141?s=20",
	"https://x.com/zelden42/status/2063745403145601150?s=20",
	"https://x.com/onlyforfun_123/status/2063588701993914565?s=20",
	"https://x.com/kan8setagaya/status/2063319039385219334?s=20",
	"https://x.com/doloresCBT666/status/2063709290620170623?s=20",
	"https://x.com/FemdomConte/status/2063845726296432830?s=20",
	"https://x.com/damo0908/status/2063851624188330209?s=20",
	"https://x.com/TamyStarly/status/2063882745055514659?s=20",
	"https://x.com/MKelvin738/status/2063590453698560048?s=20",
	"https://x.com/ps152535/status/2063402956741894356?s=20",
	"https://x.com/psy_free_beta/status/2063275972485611717?s=20",
	"https://x.com/siu_lue75846/status/2064113359025586372?s=20",
	"https://x.com/yuki_9876543210/status/2063558110657343805?s=20",
	"https://x.com/bafeimoc/status/2063881930064666722?s=20",
	"https://x.com/JFBro401/status/2063421433448132906?s=20",
	"https://x.com/ynggu1078483/status/2063661906033033422?s=20",
	"https://x.com/cuckolds4u/status/2064028937659859129?s=20",
	"https://x.com/NFisher43460/status/2064124553488388199?s=20",
	"https://x.com/doloresCBT666/status/2064136395090723205?s=20",
	"https://x.com/Mulberry212/status/2064664417472565349?s=20",
	"https://x.com/onlyforfun_123/status/2064726587556147422?s=20",
	"https://x.com/Apenasumescravo/status/2065380491931668611?s=20",
	"https://x.com/tinyDwhiteboi77/status/2065383295471309023?s=20",
	"https://x.com/ymxi14/status/2065018522477252831?s=20",
	"https://x.com/BunnyElysia/status/2065174166135800022?s=20",
	"https://x.com/I5IN4I/status/2065738100693708839?s=20",
	"https://x.com/maya_lock/status/2065488074537123877?s=20",
	"https://x.com/I5IN4I/status/2066602550007083501?s=20",
	"https://x.com/Chastitybbgirl/status/2066188574022566239?s=20",
	"https://x.com/MOMMYFEEDIpbi/status/2066272053263479261?s=20",
	"https://x.com/FemdomConte/status/2066212823685030251?s=20",
	"https://x.com/dezmondzeg/status/2065921321943343161?s=20",
	"https://x.com/UnderAmberX/status/2066608058973770038?s=20",
	"https://x.com/BallbustingTom/status/2066596922211627290?s=20",
	"https://x.com/Apenasumescravo/status/2066423351338578332?s=20",
	"https://x.com/femdomfootbitch/status/2066320439635526131?s=20",
	"https://x.com/subbypetboy1312/status/2067185449601204662?s=20",
	"https://x.com/liana_mistress2/status/2066603670889025587?s=20",
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
    .replace(/\s+/g, " ")
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

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Image upload failed."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
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
  { value: 100, tier: "ice", weight: 90 },
  { value: 150, tier: "ice", weight: 82 },
  { value: 200, tier: "blue", weight: 64 },
  { value: 250, tier: "blue", weight: 56 },
  { value: 300, tier: "blue", weight: 44 },
  { value: 400, tier: "pink", weight: 30 },
  { value: 500, tier: "pink", weight: 20 },
  { value: 650, tier: "red", weight: 12 },
  { value: 800, tier: "red", weight: 6 },
  { value: 1000, tier: "gold", weight: 2 },
];

const EVIL_DISTRACTION_TEXTS = [
  "Confirm Obedience",
  "Click to Prove Loyalty",
  "Touch This",
  "Disobey?",
  "Claim Early",
  "Need Attention?",
];

function getPetTaskBadgeLabel(task: PetTaskItem, pending: boolean, approved: boolean, failed: boolean) {
  if (pending) {
    return "Review";
  }

  if (approved) {
    return "Approved";
  }

  if (failed) {
    return "Failed";
  }

  switch (task.kind) {
    case "confession-writing":
      return "Repetition";
    case "perfect-writing":
      return "Precision";
    case "high-low":
      return "High/Low";
    case "evil-wait":
      return "Stillness";
    case "false-hope":
      return "Sequence";
    case "favor-roulette":
      return "Roulette";
    case "throne-tribute":
      return "Throne";
    default:
      return "Task";
  }
}

export function PetSection({
  disabled = false,
  coins,
  favorCoinReward,
  galleryItems,
  isGuest,
  isDebtAutoPayEnabled = false,
  nextTaxDueAt,
  onCancelThroneTribute,
  onClaimAffection,
  onConfessionSubmit,
  onCompleteTask,
  onCooldownAttempt,
  onDebtAutoPayChange = () => {},
  onPayDebtPeriod = () => {},
  onBuyRight,
  onSignDebtContract = async () => false,
  onUseRight,
  onFalseHopeKey,
  onFavorPick,
  onHighLowPlay,
  onPetDailyClick,
  onPayWeeklyTax,
  onPetEvilWaitComplete,
  onPetEvilWaitFail,
  onPetEvilWaitStart,
  onPerfectWritingProgress,
  onSubmitThroneTribute,
  highLowAllowanceCap,
  highLowProfitCap,
  petGalleryUnlockedIds,
  pendingPetActionIds = [],
  ownerLikeness,
  petScore,
  petDebtContract = null,
  petAffectionClaimed,
  petReviewTaskCoinReward,
  petTaskCoinReward,
  storedRights,
  rightExpirations,
  dailyPurchaseCount,
  rightPurchaseDate,
  tasks,
  weeklyTaxCost,
}: {
  disabled?: boolean;
  coins: number;
  favorCoinReward: number;
  galleryItems: PetGalleryItem[];
  isGuest?: boolean;
  isDebtAutoPayEnabled?: boolean;
  nextTaxDueAt: string | null;
  onCancelThroneTribute: () => void;
  onClaimAffection: () => void;
  onConfessionSubmit: (value: string, options?: { cheated?: boolean }) => void;
  onCompleteTask: (taskId: string) => void;
  onCooldownAttempt?: (message: string) => void;
  onDebtAutoPayChange?: (enabled: boolean) => void;
  onPayDebtPeriod?: () => void;
  onBuyRight: () => void;
  onSignDebtContract?: (form: {
    age?: number | string;
    consentPrimary?: boolean;
    consentPrimaryText?: string;
    consentSecondary?: boolean;
    consentSecondaryText?: string;
    contractType?: "normal" | "evil";
    debtAmount: number;
    durationPeriods: number;
    fullName?: string;
    imageUrls?: string[];
    randomGenerated?: boolean;
    periodType: "weekly" | "monthly";
    petName: string;
    timezone?: string;
  }) => Promise<boolean> | boolean;
  onUseRight: () => void;
  onFalseHopeKey: (key: "a" | "d") => void;
  onFavorPick: (index: number) => void;
  onHighLowPlay: (guess: "higher" | "lower", stake: number) => void;
  onPetDailyClick: () => void;
  onPayWeeklyTax: () => void;
  onPetEvilWaitComplete: () => void;
  onPetEvilWaitFail: () => void;
  onPetEvilWaitStart: () => void;
  onPerfectWritingProgress: (value: string) => void;
  onSubmitThroneTribute: (submission: { amount: number; proofImage: string }) => void;
  petGalleryUnlockedIds: string[];
  pendingPetActionIds?: string[];
  ownerLikeness: number;
  petScore: number;
  petDebtContract?: PetDebtContract | null;
  petAffectionClaimed: boolean;
  petReviewTaskCoinReward: number;
  petTaskCoinReward: number;
  storedRights: number;
  rightExpirations: string[];
  dailyPurchaseCount: number;
  rightPurchaseDate: string | null;
  tasks: PetTaskItem[];
  highLowAllowanceCap: number;
  highLowProfitCap: number;
  weeklyTaxCost: number;
}) {
  const [now, setNow] = useState(0);
  const [highLowStake, setHighLowStake] = useState(10);
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
  const [confessionInput, setConfessionInput] = useState("");
  const [perfectInput, setPerfectInput] = useState("");
  const [selectedThroneAmount, setSelectedThroneAmount] = useState<number>(PET_THRONE_AMOUNTS[0]);
  const [throneProofError, setThroneProofError] = useState("");
  const [throneProofImage, setThroneProofImage] = useState("");
  const [debtPetName, setDebtPetName] = useState(DEBT_PET_NAMES[0]);
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDuration, setDebtDuration] = useState("");
  const [debtPeriodType, setDebtPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [debtMode, setDebtMode] = useState<"normal" | "evil">("normal");
  const [evilAge, setEvilAge] = useState("");
  const [evilFullName, setEvilFullName] = useState("");
  const [evilTimezone, setEvilTimezone] = useState("UTC+3");
  const [evilCustomNote, setEvilCustomNote] = useState("");
  const [evilConsentPrimary, setEvilConsentPrimary] = useState("");
  const [evilConsentSecondary, setEvilConsentSecondary] = useState("");
  const [evilImageUrls, setEvilImageUrls] = useState<string[]>([]);
  const [evilImageError, setEvilImageError] = useState("");
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
  const currentGmt3DateKey = getGmt3DateKey(now);
  const effectiveDailyPurchaseCount =
    rightPurchaseDate && getGmt3DateKey(rightPurchaseDate) === currentGmt3DateKey
      ? dailyPurchaseCount
      : 0;
  const nextRightPrice = getNextRightPrice(effectiveDailyPurchaseCount);
  const rank = getPetRank(petScore);
  const approvedCount = tasks.filter((task) => isPetTaskApprovedToday(task, now)).length;
  const canClaimAffection = approvedCount >= 5 && !petAffectionClaimed;
  const throneTask =
    tasks.find((task) => task.id === PET_THRONE_TASK_ID) ??
    ({
      id: PET_THRONE_TASK_ID,
      title: "Throne Bonus",
      description: "Pick a Throne tribute amount, upload the gift screen, and submit it for review.",
      reward: 0,
      kind: "throne-tribute",
      status: "available",
    } as PetTaskItem);
  const weeklyTaxTask = tasks.find((task) => task.kind === "weekly-tax");
  const weeklyTaxCoolingDown =
    Boolean(weeklyTaxTask?.cooldownUntil) &&
    new Date(weeklyTaxTask?.cooldownUntil ?? "").getTime() > now;
  const debtTask =
    tasks.find((task) => task.kind === "debt-contract") ??
    ({
      id: "pet-debt-contract",
      title: "Debt Contract",
      description: "Sign a recurring debt contract and pay the selected amount each period.",
      reward: 0,
      kind: "debt-contract",
      status: "available",
    } as PetTaskItem);
  const baseDebtDurationLimit = DEBT_DURATION_LIMITS[debtPeriodType];
  const debtDurationLimit = {
    ...baseDebtDurationLimit,
    min: debtMode === "evil" ? Math.ceil(baseDebtDurationLimit.min * EVIL_DEBT_DURATION_MULTIPLIER) : baseDebtDurationLimit.min,
  };
  const debtMinimumPayment =
    debtMode === "evil"
      ? debtPeriodType === "weekly"
        ? 50000
        : 200000
      : DEBT_MINIMUM_PAYMENTS[debtPeriodType];
  const debtAmountStep = debtMode === "evil" ? 5000 : DEBT_RANDOM_AMOUNT_STEPS[debtPeriodType];
  const activeDebtContractType = petDebtContract?.contract_type === "evil" ? "evil" : "normal";
  const hasOpenDebtContract = Boolean(
    petDebtContract && ["active", "pending"].includes(petDebtContract.status),
  );
  const debtPaymentDue =
    Boolean(petDebtContract) &&
    (petDebtContract?.paid_periods === 0 ||
      new Date(petDebtContract?.next_due_at ?? "").getTime() <= now);
  const debtInstallmentNumber = petDebtContract
    ? Math.min(petDebtContract.paid_periods + 1, petDebtContract.duration_periods)
    : 0;
  const remainingDebtBalance = petDebtContract
    ? Math.max(
        0,
        (Math.max(1, petDebtContract.current_installment_remaining || petDebtContract.debt_amount))
          + Math.max(0, petDebtContract.duration_periods - petDebtContract.paid_periods - 1) * petDebtContract.debt_amount,
      )
    : 0;
  const dailyClickTask = tasks.find((task) => task.kind === "daily-click");
  const throneCoolingDown =
    Boolean(throneTask.cooldownUntil) &&
    new Date(throneTask.cooldownUntil ?? "").getTime() > now;
  const thronePending = throneTask.status === "pending";
  const throneApproved = throneTask.status === "approved";
  const throneFailed = throneTask.status === "failed";
  const throneActionPending = isPetActionPending(throneTask.id);
  const throneRewardBreakdown = getPetThroneRewardBreakdown(selectedThroneAmount);
  const throneCoinEquivalent = throneRewardBreakdown.totalCoinAmount;
  const regularTasks = tasks.filter(
    (task) =>
      task.kind !== "debt-contract" &&
      task.kind !== "weekly-tax" &&
      task.kind !== "daily-click" &&
      task.kind !== "throne-tribute",
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
      if (event.repeat) {
        return;
      }

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
        if (evilWaitFinishedRef.current || Date.now() < armedAt || Date.now() >= waitEndsAt) {
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

  useEffect(() => {
    if (throneTask.throneAmount && throneTask.throneAmount > 0) {
      setSelectedThroneAmount(throneTask.throneAmount);
    }

    setThroneProofImage(throneTask.throneProofImage ?? "");
    setThroneProofError("");
  }, [throneTask.throneAmount, throneTask.throneProofImage]);

  function handlePerfectInput(value: string, sentence: string) {
    if (!writingPreviewStartsWith(sentence, value)) {
      setPerfectInput("");
      onPerfectWritingProgress(value);
      return;
    }

    setPerfectInput(value);
    onPerfectWritingProgress(value);
  }

  async function handleThroneProofChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith("image/")) {
      setThroneProofError("Please upload an image file.");
      return;
    }

    if (selectedFile.size > 4 * 1024 * 1024) {
      setThroneProofError("Image must stay under 4 MB.");
      return;
    }

    try {
      setThroneProofImage(await fileToDataUrl(selectedFile));
      setThroneProofError("");
    } catch {
      setThroneProofError("Image upload failed.");
    }
  }

  function handleClearThroneProof() {
    onCancelThroneTribute();
  }

  function showDebtSignedImage() {
    setShowDebtSigningImage(true);
    if (debtSignTimerRef.current !== null) {
      window.clearTimeout(debtSignTimerRef.current);
    }
    debtSignTimerRef.current = window.setTimeout(() => setShowDebtSigningImage(false), 4500);
  }

  async function signDebtContract(form: {
    age?: number | string;
    consentPrimary?: boolean;
    consentPrimaryText?: string;
    consentSecondary?: boolean;
    consentSecondaryText?: string;
    contractType?: "normal" | "evil";
    debtAmount: number;
    durationPeriods: number;
    fullName?: string;
    customNote?: string;
    imageUrls?: string[];
    randomGenerated?: boolean;
    periodType: "weekly" | "monthly";
    petName: string;
    timezone?: string;
  }) {
    const signed = await onSignDebtContract(form);

    if (signed && form.contractType !== "evil") {
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

  async function handleEvilDebtImages(files: FileList | null) {
    setEvilImageError("");
    const selectedFiles = Array.from(files ?? []).slice(0, 8);

    if (selectedFiles.length === 0) {
      setEvilImageUrls([]);
      return;
    }

    if (selectedFiles.some((file) => !file.type.startsWith("image/"))) {
      setEvilImageError("Only image files are accepted.");
      return;
    }

    if (selectedFiles.some((file) => file.size > 1_000_000)) {
      setEvilImageError("Each image must be 1MB or smaller.");
      return;
    }

    try {
      setEvilImageUrls(await Promise.all(selectedFiles.map(fileToDataUrl)));
    } catch {
      setEvilImageError("Images failed to load.");
    }
  }

  async function handleEvilDebtSign() {
    if (!window.confirm("Are you absolutely sure you want to sign the Evil Debt Contract?")) {
      return;
    }

    await signDebtContract({
      age: evilAge,
      consentPrimary: evilConsentPrimary.trim() === EVIL_CONSENT_PRIMARY_TEXT,
      consentPrimaryText: evilConsentPrimary.trim(),
      consentSecondary: evilConsentSecondary.trim() === EVIL_CONSENT_SECONDARY_TEXT,
      consentSecondaryText: evilConsentSecondary.trim(),
      contractType: "evil",
      debtAmount: Number(debtAmount),
      durationPeriods: Number(debtDuration),
      fullName: evilFullName,
      customNote: evilCustomNote,
      imageUrls: evilImageUrls,
      periodType: debtPeriodType,
      petName: "Evil Debt Contract",
      timezone: evilTimezone,
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
          <div
            className="rounded-[1.5rem] border border-rose-200/15 bg-black/45 p-4"
            data-allow-image-download
          >
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
        <div
          className="rounded-[1.5rem] border border-fuchsia-200/15 bg-black/40 p-4"
          data-allow-image-download
        >
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
              Tax amount: {weeklyTaxCost} Principessa Coins. Rule: 10% of your coins with a minimum of 2,500 and a maximum of 10,000. If it stays unpaid for 7 days, affection definitely drops.
            </p>
            <button
              aria-disabled={weeklyTaxCoolingDown || undefined}
              className={`mt-4 w-full rounded-2xl border border-yellow-200/25 bg-yellow-500/15 px-4 py-3 text-sm font-black text-yellow-50 transition enabled:hover:border-yellow-200/55 enabled:hover:bg-yellow-500/25 disabled:cursor-not-allowed disabled:opacity-40 ${
                weeklyTaxCoolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
              }`}
              disabled={disabled || coins < weeklyTaxCost || isPetActionPending("pet-weekly-throne-tax")}
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
              const approved =
                (task.kind === "review" || task.kind === "throne-tribute") && task.status === "approved";
              const failed = task.status === "failed";
              const sentence = task.sentence ?? "";
              const actionPending = isPetActionPending(task.id);

              return (
                <article
                  className={`flex min-h-0 min-w-0 flex-col rounded-[1.25rem] border border-red-300/20 bg-red-950/20 p-3 shadow-[0_0_22px_rgba(127,29,29,0.12)] sm:min-h-[22rem] sm:rounded-[1.5rem] sm:p-4 ${
                    task.kind === "high-low" ? "md:col-span-2" : ""
                  }`}
                  key={task.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-black text-white sm:text-lg">{task.title}</h3>
                    <span className="rounded-full border border-red-200/20 bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase text-red-50">
                      {getPetTaskBadgeLabel(task, pending, approved, failed)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{task.description}</p>
                  <p className="mt-3 text-xs font-bold text-red-100">
                    {task.kind === "review"
                      ? `Admin approve reward: +${task.reward} Pet Score, +${petReviewTaskCoinReward} Coins`
                      : task.kind === "throne-tribute"
                        ? "Admin approval only adds the selected Throne payout with both bonuses."
                      : task.kind === "high-low"
                        ? "Higher or Lower is now handled here. Coin stakes are separate from Pet Score."
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
                        disabled={disabled || coolingDown || task.status === "approved" || actionPending}
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
                        disabled={disabled || coolingDown || task.status === "approved" || actionPending || confessionInput.length === 0}
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
                          .map(() => "\u2764\uFE0F")
                          .join("") || "No hearts"}
                      </p>
                      <input
                        className="w-full rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none transition focus:border-red-200/55 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={disabled || coolingDown || pending || actionPending}
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

                  {task.kind === "high-low" && (
                    <div className="mt-auto flex flex-1 flex-col rounded-2xl border border-pink-200/15 bg-black/35 p-4">
                      {(() => {
                        const highLowBetAllowance =
                          task.highLowBetAllowance ??
                          Math.max(0, highLowAllowanceCap - Math.max(0, task.highLowDailyBetTotal ?? 0));
                        const highLowStakeMax = Math.max(0, Math.min(coins, highLowBetAllowance));
                        const highLowResetRemaining = task.highLowResetAt
                          ? new Date(task.highLowResetAt).getTime() - now
                          : 0;
                        const resultCoinDelta = task.resultCoinDelta ?? 0;
                        const resultBaseNumber = task.resultBaseNumber ?? task.currentNumber ?? "?";
                        const resultNumber = task.resultNumber ?? "?";
                        const resultLabel =
                          task.resultOutcome === "win"
                            ? "Win"
                            : task.resultOutcome === "loss"
                              ? "Loss"
                              : task.resultOutcome === "tie"
                                ? "Tie"
                                : "Waiting";

                        return (
                          <div className="flex h-full flex-col">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm text-zinc-400">Current number</p>
                                <p className="mt-1 text-5xl font-black text-white">
                                  {task.currentNumber ?? "?"}
                                </p>
                              </div>
                              <div className="min-w-[16rem] rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-pink-200/70">Last result</p>
                                <p
                                  className={`mt-2 text-2xl font-black ${
                                    resultLabel === "Win"
                                      ? "text-emerald-200"
                                      : resultLabel === "Loss"
                                        ? "text-rose-200"
                                        : resultLabel === "Tie"
                                          ? "text-yellow-100"
                                          : "text-white"
                                  }`}
                                >
                                  {task.lastResult ?? "No result yet."}
                                </p>
                                <p className="mt-2 text-sm text-zinc-400">
                                  {task.resultOutcome
                                    ? `${resultLabel} · ${resultBaseNumber} -> ${resultNumber} · ${resultCoinDelta > 0 ? "+" : ""}${resultCoinDelta} coins`
                                    : "Play once to reveal the next result here."}
                                </p>
                              </div>
                            </div>
                            <p className="mt-2 text-xs text-zinc-500">
                              Base rolls use 2-19. Result rolls use 1-25 and are weighted around the current number.
                            </p>
                            {task.highLowRoundAvailableAt && (
                              <p className="mt-2 text-sm font-semibold text-pink-100">
                                Next round in {formatRemaining(task.highLowRoundAvailableAt, now)}
                              </p>
                            )}

                            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">24h Net Profit</p>
                                <p
                                  className={`mt-1 text-lg font-black ${
                                    (task.highLowDailyProfit ?? 0) > 0
                                      ? "text-emerald-200"
                                      : (task.highLowDailyProfit ?? 0) < 0
                                        ? "text-rose-200"
                                        : "text-pink-50"
                                  }`}
                                >
                                  {(task.highLowDailyProfit ?? 0) > 0 ? "+" : ""}
                                  {task.highLowDailyProfit ?? 0}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Wins Today</p>
                                <p className="mt-1 text-lg font-black text-pink-50">
                                  {task.highLowDailyWins ?? 0}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Bet Allowance</p>
                                <p className="mt-1 text-lg font-black text-pink-50">
                                  {highLowBetAllowance.toLocaleString()}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Lock</p>
                                <p
                                  className={`mt-1 text-lg font-black ${
                                    task.highLowDailyLocked ? "text-yellow-100" : "text-emerald-200"
                                  }`}
                                >
                                  {task.highLowDailyLocked ? "Locked" : "Open"}
                                </p>
                              </div>
                            </div>

                            {task.highLowDailyLocked && (
                              <p className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-100">
                                Higher or Lower 24-hour profit or bet allowance limit reached.
                                {highLowResetRemaining > 0
                                  ? ` Available again in ${formatRemaining(task.highLowResetAt ?? null, now)}.`
                                  : " Available again after the current daily reset."}
                              </p>
                            )}
                            {!task.highLowDailyLocked && (
                              <p className="mt-3 text-xs font-semibold text-zinc-500">
                                Locks at {highLowProfitCap.toLocaleString()} net profit or after {highLowAllowanceCap.toLocaleString()} total coins are bet during the daily allowance period. Wins and losses consume allowance; ties charge a 25% play fee.
                              </p>
                            )}
                            {!task.highLowDailyLocked && highLowBetAllowance <= 0 && (
                              <p className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-100">
                                Higher or Lower bet allowance is depleted.
                              </p>
                            )}

                            <label className="mt-4 block">
                              <span className="text-xs uppercase tracking-[0.2em] text-fuchsia-200/70">
                                Stake
                              </span>
                              <input
                                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-300/60 disabled:cursor-not-allowed disabled:opacity-45"
                                disabled={disabled || coolingDown || task.highLowDailyLocked || highLowBetAllowance <= 0 || isPetActionPending("high-low")}
                                min={1}
                                max={highLowStakeMax}
                                onChange={(event) => setHighLowStake(Number(event.target.value))}
                                type="number"
                                value={highLowStake}
                              />
                            </label>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                              {(["higher", "lower"] as const).map((guess) => (
                                <button
                                  aria-disabled={coolingDown || undefined}
                                  className={`rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold capitalize text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40 ${
                                    coolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
                                  }`}
                                  disabled={
                                    disabled ||
                                    isPetActionPending("high-low") ||
                                    task.highLowDailyLocked ||
                                    highLowStake <= 0 ||
                                    highLowStake > coins ||
                                    highLowStake > highLowBetAllowance
                                  }
                                  key={guess}
                                  onClick={() => {
                                    if (coolingDown) {
                                      handleCooldownAttempt(`Cooldown active. Available again in ${formatRemaining(task.cooldownUntil ?? null, now)}.`);
                                      return;
                                    }

                                    emitSoundEvent("button_click");
                                    onHighLowPlay(guess, highLowStake);
                                  }}
                                  type="button"
                                >
                                  {coolingDown ? (
                                    <CooldownButtonContent label={`Available in ${formatRemaining(task.cooldownUntil ?? null, now)}`} />
                                  ) : (
                                    guess
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
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
                              disabled={disabled || actionPending}
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
                        disabled={disabled || actionPending || task.waitState === "countdown" || task.waitState === "waiting"}
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
                            disabled={disabled}
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
                    <div className="mt-auto flex flex-1 flex-col justify-center rounded-2xl border border-pink-200/15 bg-black/35 p-3 sm:p-4">
                      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                        {Array.from({ length: 5 }, (_, index) => {
                          const revealed = typeof task.favorPickedIndex === "number" && task.favorPickedIndex >= 0;
                          const picked = task.favorPickedIndex === index;
                          const winning = task.favorWinningIndex === index && task.favorResult !== "empty-day";
                          const label = !revealed
                            ? "?"
                            : winning
                              ? "FAVOR"
                              : "EMPTY";

                          return (
                            <button
                              className={`flex min-h-[6.75rem] min-w-0 items-center justify-center rounded-xl border px-1 py-3 text-center text-xs font-black uppercase tracking-[0.08em] transition sm:min-h-[8rem] sm:rounded-2xl md:min-h-[9.5rem] ${
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
                              disabled={disabled || revealed || actionPending}
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
                              <span aria-hidden="true" className="flex flex-col items-center justify-center leading-none text-pink-50/90">
                                {!revealed ? (
                                  "?"
                                ) : (
                                  label.split("").map((letter, letterIndex) => (
                                    <span className="block" key={`${label}-${letter}-${letterIndex}`}>
                                      {letter}
                                    </span>
                                  ))
                                )}
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
                        disabled={disabled || actionPending || task.status === "approved"}
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

                  {task.kind === "throne-tribute" && (
                    <div className="mt-auto space-y-3 rounded-2xl border border-red-200/15 bg-black/35 p-3">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {PET_THRONE_AMOUNTS.map((amount) => {
                          const active = selectedThroneAmount === amount;

                          return (
                            <button
                              className={`flex min-h-12 items-center justify-center rounded-2xl border px-3 py-2 text-center text-sm font-black leading-none transition ${
                                active
                                  ? "border-pink-200/60 bg-pink-500/20 text-pink-50"
                                  : "border-white/10 bg-black/35 text-zinc-300 hover:border-pink-200/35 hover:text-pink-50"
                              }`}
                              disabled={disabled || pending || actionPending}
                              key={amount}
                              onClick={() => setSelectedThroneAmount(amount)}
                              type="button"
                            >
                              {formatPetThroneAmount(amount)}
                            </button>
                          );
                        })}
                      </div>

                      <div className="rounded-2xl border border-pink-200/15 bg-black/30 px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-pink-200/70">
                          You Receive
                        </p>
                        <p className="mt-2 text-2xl font-black text-pink-50">
                          {formatPetThroneAmount(throneCoinEquivalent)}
                        </p>
                        <p className="mt-2 text-xs text-zinc-400">
                          Pick the gift amount, open the Throne page, then upload the gift screen screenshot.
                        </p>
                      </div>

                      <label className="block rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-300">
                        <span className="block text-xs uppercase tracking-[0.18em] text-zinc-500">
                          Throne screenshot
                        </span>
                        <input
                          accept="image/*"
                          className="mt-3 block w-full cursor-pointer text-sm text-zinc-200 file:mr-3 file:rounded-xl file:border-0 file:bg-pink-500/20 file:px-3 file:py-2 file:font-black file:text-pink-50"
                          disabled={disabled || actionPending}
                          onChange={handleThroneProofChange}
                          type="file"
                        />
                      </label>

                      {throneProofError && (
                        <p className="rounded-2xl border border-rose-200/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-100">
                          {throneProofError}
                        </p>
                      )}

                      {throneProofImage && (
                        <div className="overflow-hidden rounded-2xl border border-pink-200/15 bg-black/40">
                          {/* Keep the screenshot visible so users can verify what will be submitted. */}
                          <img
                            alt="Selected Throne proof"
                            className="max-h-56 w-full object-contain"
                            src={throneProofImage}
                          />
                        </div>
                      )}

                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          className={`rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40 ${
                            coolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
                          }`}
                          disabled={disabled || pending || actionPending || !throneProofImage}
                          onClick={() => {
                            if (coolingDown) {
                              handleCooldownAttempt(`Cooldown active. Available again in ${formatRemaining(task.cooldownUntil ?? null, now)}.`);
                              return;
                            }

                            onSubmitThroneTribute({
                              amount: selectedThroneAmount,
                              proofImage: throneProofImage,
                            });
                          }}
                          type="button"
                        >
                          {actionPending
                            ? "Saving..."
                            : pending
                              ? "Pending Review"
                              : "Submit for Review"}
                        </button>
                        <button
                          className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={disabled || actionPending || !pending}
                          onClick={onCancelThroneTribute}
                          type="button"
                        >
                          {actionPending ? "Saving..." : "Cancel Submission"}
                        </button>
                      </div>
                    </div>
                  )}

                  {task.kind === "review" && (
                    <button
                      aria-disabled={coolingDown || undefined}
                      className={`mt-auto w-full rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40 ${
                        coolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
                      }`}
                      disabled={disabled || pending || actionPending}
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
          </div>
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
            <div className="grid min-w-0 gap-3">
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
                    <span>{Math.min(5, effectiveDailyPurchaseCount)}/5</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-zinc-300">
                    <span>Next price today</span>
                    <span>
                      {nextRightPrice === null
                        ? `Resets in ${formatRemaining(nextDailyResetAt, now)}`
                        : `${nextRightPrice.toLocaleString()} Coins`}
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
                        disabled ||
                        isPetActionPending("rights:buy") ||
                        nextRightPrice === null ||
                        coins < (nextRightPrice ?? Number.POSITIVE_INFINITY)
                      }
                      onClick={onBuyRight}
                      type="button"
                    >
                    {isPetActionPending("rights:buy")
                      ? "Buying..."
                    : nextRightPrice === null
                      ? `Resets in ${formatRemaining(nextDailyResetAt, now)}`
                        : "Buy Right"}
                    </button>
                  <button
                    className="w-full rounded-2xl border border-pink-200/25 bg-pink-500/15 px-4 py-3 text-sm font-black text-pink-50 transition enabled:hover:border-pink-200/55 enabled:hover:bg-pink-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={disabled || isPetActionPending("rights:use") || displayedStoredRights <= 0}
                    onClick={onUseRight}
                    type="button"
                  >
                    {isPetActionPending("rights:use") ? "Using..." : "I Used My Right"}
                  </button>
                </div>
              </article>

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
                    Completion reward: +{dailyClickTask.reward} Pet Score. Click reward: up to 200 Coins.
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
                      disabled={disabled || dailyClickTask.status === "approved"}
                      onClick={onPetDailyClick}
                      type="button"
                    >
                      {dailyClickTask.status === "approved" ? "Completed Today" : "Click"}
                    </button>
                  </div>
                </article>
              )}
            </div>

            <div className="grid min-w-0 gap-3">
              <article className="flex min-h-full min-w-0 flex-col rounded-[1.5rem] border border-red-300/20 bg-red-950/20 p-4 shadow-[0_0_22px_rgba(127,29,29,0.12)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-white">{throneTask.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">{throneTask.description}</p>
                  </div>
                  <span className="rounded-full border border-red-200/20 bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase text-red-50">
                    {getPetTaskBadgeLabel(throneTask, thronePending, throneApproved, throneFailed)}
                  </span>
                </div>
                <p className="mt-3 text-xs font-bold text-red-100">
                  Admin approval adds the selected Throne payout with both bonuses only.
                </p>
                <div className="mt-auto space-y-3 rounded-2xl border border-red-200/15 bg-black/35 p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {PET_THRONE_AMOUNTS.map((amount) => {
                      const active = selectedThroneAmount === amount;

                      return (
                        <button
                          className={`flex min-h-12 items-center justify-center rounded-2xl border px-3 py-2 text-center text-sm font-black leading-none transition ${
                            active
                              ? "border-pink-200/60 bg-pink-500/20 text-pink-50"
                              : "border-white/10 bg-black/35 text-zinc-300 hover:border-pink-200/35 hover:text-pink-50"
                          }`}
                          disabled={disabled || thronePending || throneActionPending}
                          key={amount}
                          onClick={() => setSelectedThroneAmount(amount)}
                          type="button"
                        >
                          {formatPetThroneAmount(amount)}
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-2xl border border-pink-200/15 bg-black/30 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-pink-200/70">
                      You Receive
                    </p>
                    <p className="mt-2 text-2xl font-black text-pink-50">
                      {formatPetThroneAmount(throneCoinEquivalent)}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-pink-100/65">
                      Coin equivalent
                    </p>
                    <p className="mt-2 text-xs text-zinc-400">
                      Base {throneRewardBreakdown.baseCoinAmount.toLocaleString()} + give bonus {throneRewardBreakdown.giveBonusAmount.toLocaleString()} + task bonus {throneRewardBreakdown.taskBonusAmount.toLocaleString()}
                    </p>
                    <p className="mt-2 text-xs text-zinc-400">
                      Pick the Throne amount, open the Throne page, then upload the gift screen screenshot.
                    </p>
                  </div>

                  <label className="block rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-300">
                    <span className="block text-xs uppercase tracking-[0.18em] text-zinc-500">
                      Throne screenshot
                    </span>
                    <input
                      accept="image/*"
                      className="mt-3 block w-full cursor-pointer text-sm text-zinc-200 file:mr-3 file:rounded-xl file:border-0 file:bg-pink-500/20 file:px-3 file:py-2 file:font-black file:text-pink-50"
                      disabled={disabled || throneActionPending}
                      onChange={handleThroneProofChange}
                      type="file"
                    />
                    {throneProofError ? (
                      <span className="mt-2 block text-xs text-red-300">{throneProofError}</span>
                    ) : (
                      <span className="mt-2 block text-xs text-zinc-500">
                        Upload the Throne checkout or gift confirmation screen.
                      </span>
                    )}
                  </label>

                  {throneProofImage && (
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                      <Image
                        alt="Throne proof preview"
                        className="h-auto w-full"
                        height={960}
                        src={throneProofImage}
                        unoptimized
                        width={720}
                      />
                    </div>
                  )}

                  {throneCoolingDown && (
                    <p className="text-xs text-yellow-100">
                      Available in {formatRemaining(throneTask.cooldownUntil ?? null, now)}
                    </p>
                  )}

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      className={`rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40 ${
                        throneCoolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
                      }`}
                      disabled={disabled || thronePending || throneActionPending || !throneProofImage}
                      onClick={() => {
                        if (throneCoolingDown) {
                          handleCooldownAttempt(`Cooldown active. Available again in ${formatRemaining(throneTask.cooldownUntil ?? null, now)}.`);
                          return;
                        }

                        onSubmitThroneTribute({
                          amount: selectedThroneAmount,
                          proofImage: throneProofImage,
                        });
                      }}
                      type="button"
                    >
                      {throneActionPending
                        ? "Submitting..."
                        : thronePending
                          ? "Pending Review"
                          : "Submit Throne Bonus"}
                    </button>
                    <button
                      className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-black text-zinc-200 transition enabled:hover:border-white/20 enabled:hover:bg-black/45 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={disabled || throneActionPending || !throneProofImage}
                      onClick={handleClearThroneProof}
                      type="button"
                    >
                      Clear Screenshot
                    </button>
                  </div>
                </div>
              </article>

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
          </div>

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
              disabled={disabled || !canClaimAffection || isPetActionPending("pet-affection-claim")}
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
  disabled = false,
  enabled,
  onChange,
}: {
  disabled?: boolean;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      aria-pressed={enabled}
      className="flex w-full items-center gap-3 text-left"
      onClick={() => onChange(!enabled)}
      disabled={disabled}
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
