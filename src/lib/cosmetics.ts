import { LEADERSHIP_RANKS } from "@/lib/leadership";
import {
  footballInspiredRotatingBorders,
  type ProfileBorderStyle,
} from "@/lib/profile-border-cosmetics";
import {
  rotatingProfileFrameCosmeticItems,
  type ProfileFrameCosmeticType,
} from "@/lib/profile-frame-cosmetics";
import { avatarBackgroundCosmeticItems } from "@/lib/avatar-background-cosmetics";
import { DEFAULT_SPEECH_AVATAR_ID, RANDOM_SPEECH_AVATAR_ID } from "@/lib/speech-bubble-types";

export type CosmeticType =
  | "speech-avatar"
  | "avatar-background"
  | "username-color"
  | "username-glow"
  | "display-name-change"
  | "profile-border"
  | ProfileFrameCosmeticType;

export type CosmeticItem = {
  id: string;
  name: string;
  description: string;
  type: CosmeticType;
  price: number;
  image?: string;
  color?: string;
  glow?: string;
  borderPalette?: [string, string, string?];
  borderStyle?: ProfileBorderStyle;
  backgroundPath?: string | null;
  backgroundOverlayPath?: string | null;
  backgroundFallback?: string;
  isArchived?: boolean;
};

export type SpendBadgeTierId = "bronze" | "silver" | "gold" | "emerald" | "diamond";

export type SpendBadgeTier = {
  id: SpendBadgeTierId;
  label: string;
  minSpentCoins: number;
  imagePath: string;
};

export type SpendBadge = {
  current: SpendBadgeTier;
  currentLabel: string;
  currentSpentCoins: number;
  imagePath: string;
  isEarned: boolean;
  next: SpendBadgeTier | null;
  nextLabel: string | null;
  nextThreshold: number | null;
  progress: number;
  summary: string;
  tooltip: string;
};

export type TitleItem = {
  id: string;
  name: string;
  description: string;
  source: "progression" | "shop" | "throne" | "admin" | "pet" | "crate" | "inventory";
  minTribute?: number;
  minThroneCoins?: number;
  minPetScore?: number;
  minCrateLegendaries?: number;
  minInventoryValue?: number;
  requiresAllLegendaries?: boolean;
  price?: number;
};

export const permanentCosmeticItems: CosmeticItem[] = [
  {
    id: DEFAULT_SPEECH_AVATAR_ID,
    name: "Principessa Classic",
    description: "The default speech bubble avatar.",
    type: "speech-avatar",
    price: 0,
    image: "/character-icon.png",
  },
  {
    id: RANDOM_SPEECH_AVATAR_ID,
    name: "Random",
    description: "Uses a random speech bubble persona each time.",
    type: "speech-avatar",
    price: 50000,
    image: "/character-icon.png",
  },
  {
    id: "avatar-catgirl",
    name: "Catgirl",
    description: "Playful, sharp, and smug.",
    type: "speech-avatar",
    price: 15000,
    image: "/cosmetics/avatar-catgirl.png",
  },
  {
    id: "avatar-goth",
    name: "Goth Girl",
    description: "Darker, colder, and more expensive.",
    type: "speech-avatar",
    price: 7500,
    image: "/cosmetics/avatar-goth.png",
  },
  {
    id: "avatar-tsundere",
    name: "Tsundere",
    description: "Dismissive, then barely pleased.",
    type: "speech-avatar",
    price: 5000,
    image: "/cosmetics/avatar-tsundere.png",
  },
  {
    id: "avatar-yandere",
    name: "Yandere",
    description: "Possessive, intense, and locked on.",
    type: "speech-avatar",
    price: 5000,
    image: "/cosmetics/avatar-yandere.png",
  },
  {
    id: "avatar-lovely",
    name: "Lovely",
    description: "A softer presentation.",
    type: "speech-avatar",
    price: 15000,
    image: "/cosmetics/avatar-lovely.png",
  },
  {
    id: "avatar-arrogant",
    name: "Arrogant",
    description: "Superior, polished, and impossible to ignore.",
    type: "speech-avatar",
    price: 2500,
    image: "/cosmetics/avatar-arrogant.png",
  },
  {
    id: "avatar-maid",
    name: "Maid",
    description: "Polished service with strict expectations.",
    type: "speech-avatar",
    price: 5000,
    image: "/cosmetics/avatar-maid.png",
  },
  {
    id: "avatar-debtcollector",
    name: "Debt Collector",
    description: "Ledger-focused, cold, and exacting.",
    type: "speech-avatar",
    price: 5000,
    image: "/cosmetics/avatar-debtcollector.png",
  },
  {
    id: "avatar-egirl",
    name: "Egirl",
    description: "Online, teasing, and notification-ready.",
    type: "speech-avatar",
    price: 15000,
    image: "/cosmetics/avatar-egirl.png",
  },
  {
    id: "avatar-himedere",
    name: "Himedere",
    description: "Royal, demanding, and impossible to please.",
    type: "speech-avatar",
    price: 10000,
    image: "/cosmetics/avatar-himedere.png",
  },
  {
    id: "avatar-strictteacher",
    name: "Strict Teacher",
    description: "Disciplined lessons with expensive standards.",
    type: "speech-avatar",
    price: 5000,
    image: "/cosmetics/avatar-strictteacher.png",
  },
  {
    id: "avatar-custom-1",
    name: "Cuckold",
    description: "Spoiled wife who fucks better men while you pay.",
    type: "speech-avatar",
    price: 15000,
    image: "/cosmetics/avatar-cuckold.png",
  },
  {
    id: "avatar-custom-2",
    name: "Keyholder",
    description: "Your pleasure is locked. Your wallet is not.",
    type: "speech-avatar",
    price: 10000,
    image: "/cosmetics/avatar-keyholder.png",
  },
  {
    id: "avatar-hypnotist",
    name: "Hypnotist",
    description: "Pixel trance, mind control, and financial surrender.",
    type: "speech-avatar",
    price: 15000,
    image: "/cosmetics/avatar-hypnotist.png",
  },
  {
    id: "avatar-succubus",
    name: "Succubus",
    description: "Hungry, seductive, and ruinously expensive.",
    type: "speech-avatar",
    price: 15000,
    image: "/cosmetics/avatar-succubus.png",
  },
  {
    id: "avatar-bully",
    name: "Bully",
    description: "Cruel, bratty, and impossible to ignore.",
    type: "speech-avatar",
    price: 7500,
    image: "/cosmetics/avatar-bully.png",
  },
  {
    id: "avatar-petowner",
    name: "Pet Owner",
    description: "Strict owner energy for obedient pets.",
    type: "speech-avatar",
    price: 10000,
    image: "/cosmetics/avatar-petowner.png",
  },
  {
    id: "avatar-blackmail",
    name: "Blackmail",
    description: "Exposure pressure with a cruel smile.",
    type: "speech-avatar",
    price: 20000,
    image: "/cosmetics/avatar-blackmail.png",
  },
  {
    id: "avatar-denialqueen",
    name: "Denial Queen",
    description: "No release, no mercy, only obedience.",
    type: "speech-avatar",
    price: 15000,
    image: "/cosmetics/avatar-denialqueen.png",
  },
  {
    id: "avatar-edging-coach",
    name: "Edging Coach",
    description: "Teasing control with strict timing.",
    type: "speech-avatar",
    price: 15000,
    image: "/cosmetics/avatar-edging-coach.png",
  },
  {
    id: "username-pink",
    name: "Hot Pink Name",
    description: "A vivid pink username color.",
    type: "username-color",
    price: 5000,
    color: "#f472b6",
  },
  {
    id: "username-purple",
    name: "Royal Purple Name",
    description: "A rich purple username color.",
    type: "username-color",
    price: 3000,
    color: "#c084fc",
  },
  {
    id: "username-gold",
    name: "Gold Name",
    description: "A premium gold username color.",
    type: "username-color",
    price: 5000,
    color: "#facc15",
  },
  {
    id: "username-emerald",
    name: "Emerald Name",
    description: "A sharp emerald username color.",
    type: "username-color",
    price: 2000,
    color: "#34d399",
  },
  {
    id: "username-cyan",
    name: "Electric Cyan Name",
    description: "A bright cyan username color.",
    type: "username-color",
    price: 2000,
    color: "#22d3ee",
  },
  {
    id: "username-crimson",
    name: "Crimson Name",
    description: "A bold red username color.",
    type: "username-color",
    price: 2000,
    color: "#fb7185",
  },
  {
    id: "username-silver",
    name: "Silver Name",
    description: "A clean silver username color.",
    type: "username-color",
    price: 2000,
    color: "#e5e7eb",
  },
  {
    id: "username-ice-blue",
    name: "Ice Blue Name",
    description: "A pale blue username color.",
    type: "username-color",
    price: 2000,
    color: "#93c5fd",
  },
  {
    id: "username-lavender",
    name: "Lavender Name",
    description: "A soft lavender username color.",
    type: "username-color",
    price: 2000,
    color: "#ddd6fe",
  },
  {
    id: "glow-pink",
    name: "Pink Glow",
    description: "A soft pink username glow.",
    type: "username-glow",
    price: 1000,
    glow: "0 0 16px rgba(244,114,182,0.9)",
  },
  {
    id: "glow-purple",
    name: "Purple Glow",
    description: "A deeper violet username glow.",
    type: "username-glow",
    price: 1000,
    glow: "0 0 18px rgba(192,132,252,0.9)",
  },
  {
    id: "glow-gold",
    name: "Gold Glow",
    description: "A prestigious gold username glow.",
    type: "username-glow",
    price: 1000,
    glow: "0 0 20px rgba(250,204,21,0.95)",
  },
  {
    id: "glow-emerald",
    name: "Emerald Glow",
    description: "A clean green username glow.",
    type: "username-glow",
    price: 1000,
    glow: "0 0 18px rgba(52,211,153,0.9)",
  },
  {
    id: "glow-cyan",
    name: "Cyan Glow",
    description: "A bright electric username glow.",
    type: "username-glow",
    price: 1000,
    glow: "0 0 18px rgba(34,211,238,0.9)",
  },
  {
    id: "glow-crimson",
    name: "Crimson Glow",
    description: "A dramatic red username glow.",
    type: "username-glow",
    price: 1000,
    glow: "0 0 18px rgba(251,113,133,0.9)",
  },
  {
    id: "glow-white",
    name: "White Glow",
    description: "A bright clean username glow.",
    type: "username-glow",
    price: 1000,
    glow: "0 0 18px rgba(255,255,255,0.85)",
  },
  {
    id: "glow-ice-blue",
    name: "Ice Blue Glow",
    description: "A cold pale blue username glow.",
    type: "username-glow",
    price: 1000,
    glow: "0 0 18px rgba(147,197,253,0.9)",
  },
  {
    id: "glow-lavender",
    name: "Lavender Glow",
    description: "A soft violet-white username glow.",
    type: "username-glow",
    price: 1000,
    glow: "0 0 18px rgba(221,214,254,0.9)",
  },
  {
    id: "display-name-change",
    name: "Display Name Change",
    description: "Change your public-facing display name. @username stays your permanent identity.",
    type: "display-name-change",
    price: 2500,
    image: "/icons/coin.png",
  },
  ...avatarBackgroundCosmeticItems,
  {
    id: "profile-border-rainbow-animated",
    name: "Rainbow Animated Border",
    description: "A flashy rainbow frame that keeps moving around your avatar.",
    type: "profile-border",
    price: 10000,
  },
  {
    id: "profile-border-popular-pink",
    name: "Pink Border",
    description: "A simple solid pink profile header frame.",
    type: "profile-border",
    price: 5000,
    color: "#ec4899",
  },
  {
    id: "profile-border-popular-purple",
    name: "Purple Border",
    description: "A simple solid purple profile header frame.",
    type: "profile-border",
    price: 5000,
    color: "#a855f7",
  },
  {
    id: "profile-border-popular-emerald",
    name: "Emerald Border",
    description: "A simple solid emerald profile header frame.",
    type: "profile-border",
    price: 5000,
    color: "#10b981",
  },
  {
    id: "profile-border-popular-gold",
    name: "Gold Border",
    description: "A simple solid gold profile header frame.",
    type: "profile-border",
    price: 5000,
    color: "#f59e0b",
  },
  {
    id: "profile-border-popular-ice",
    name: "Ice Border",
    description: "A simple solid ice-blue profile header frame.",
    type: "profile-border",
    price: 5000,
    color: "#38bdf8",
  },
];

export const rotatingCosmeticItems: CosmeticItem[] = [
  {
    id: "profile-border-rotating-vaultfire",
    name: "Vaultfire Border",
    description: "A molten gold frame that feels pulled from the community vault.",
    type: "profile-border",
    price: 7000,
    color: "#f59e0b",
  },
  {
    id: "profile-border-rotating-solar-flare",
    name: "Solar Flare Border",
    description: "A radiant event frame with a bright late-summer glow.",
    type: "profile-border",
    price: 7000,
    color: "#fb7185",
  },
  {
    id: "profile-border-rotating-gilded-noir",
    name: "Gilded Noir Border",
    description: "Dark lacquer with a gold rim for colder prestige.",
    type: "profile-border",
    price: 7000,
    color: "#facc15",
  },
  {
    id: "profile-border-rotating-afterglow",
    name: "Afterglow Border",
    description: "A soft neon frame that lingers like expensive attention.",
    type: "profile-border",
    price: 7000,
    color: "#a855f7",
  },
  ...footballInspiredRotatingBorders,
  {
    id: "username-color-rotating-sunset",
    name: "Sunset Name",
    description: "A warm coral-gold username reserved for the rotating vault.",
    type: "username-color",
    price: 5000,
    color: "#fb7185",
  },
  {
    id: "username-color-rotating-lagoon",
    name: "Lagoon Name",
    description: "A cool tropical teal username color from the rotating vault.",
    type: "username-color",
    price: 5000,
    color: "#2dd4bf",
  },
  {
    id: "username-glow-rotating-embers",
    name: "Ember Glow",
    description: "A hot orange halo for public recognition.",
    type: "username-glow",
    price: 5000,
    glow: "0 0 22px rgba(251,146,60,0.95)",
  },
  {
    id: "username-glow-rotating-aurora",
    name: "Aurora Glow",
    description: "A shifting mint-cyan glow that reads instantly on public cards.",
    type: "username-glow",
    price: 3000,
    glow: "0 0 22px rgba(45,212,191,0.95)",
  },
  {
    id: "username-glow-rotating-frostline",
    name: "Frostline Glow",
    description: "A cold silver-blue highlight for polished prestige.",
    type: "username-glow",
    price: 3000,
    glow: "0 0 22px rgba(186,230,253,0.95)",
  },
  {
    id: "username-color-event-summer-2026",
    name: "Summer Support Name",
    description: "A summer-limited coral shimmer available only during the seasonal rotation.",
    type: "username-color",
    price: 7000,
    color: "#f97316",
  },
  {
    id: "username-glow-event-summer-2026",
    name: "Summer Heat Glow",
    description: "A seasonal rotating glow with bright amber heat.",
    type: "username-glow",
    price: 3000,
    glow: "0 0 24px rgba(251,191,36,0.95)",
  },
  ...rotatingProfileFrameCosmeticItems,
];

export const cosmeticItems: CosmeticItem[] = [...permanentCosmeticItems, ...rotatingCosmeticItems];

export const titleItems: TitleItem[] = [
  ...LEADERSHIP_RANKS.map((rank) => ({
    id: `leadership-${rank.min}`,
    name: rank.title,
    description: `Unlocked at ${rank.min.toLocaleString()} Tribute Total.`,
    source: "progression" as const,
    minTribute: rank.min,
  })),
  {
    id: "premium-vault-royalty",
    name: "Principessa's Leaking Toy",
    description: "A premium title bought from the cosmetic shop.",
    source: "shop",
    price: 50000,
  },
  {
    id: "throne-10000",
    name: "Soft Denied Worm",
    description: "Unlocked after 10,000 manually granted Throne coins.",
    source: "throne",
    minThroneCoins: 10000,
  },
  {
    id: "throne-25000",
    name: "Shining Desperation Toy",
    description: "Unlocked after 25,000 manually granted Throne coins.",
    source: "throne",
    minThroneCoins: 25000,
  },
  {
    id: "throne-100000",
    name: "Drained Wallet",
    description: "Unlocked after 100,000 manually granted Throne coins.",
    source: "throne",
    minThroneCoins: 100000,
  },
  {
    id: "admin-principessas-chosen",
    name: "Principessa's Broken Favorite",
    description: "A manual admin-granted high-prestige title.",
    source: "admin",
  },
  {
    id: "pet-score-250",
    name: "Collared Devotion",
    description: "Unlocked at 250 Pet Score.",
    source: "pet",
    minPetScore: 250,
  },
  {
    id: "pet-score-500",
    name: "Owned Little Pet",
    description: "Unlocked at 500 Pet Score.",
    source: "pet",
    minPetScore: 500,
  },
  {
    id: "pet-score-1000",
    name: "Perfect Pet",
    description: "Unlocked at 1,000 Pet Score.",
    source: "pet",
    minPetScore: 1000,
  },
  // Crate legendary pull title
  {
    id: "crate-legendary",
    name: "Exalted Golden Pet",
    description: "Unlocked by pulling a Legendary item straight from cases.",
    source: "crate",
    minCrateLegendaries: 1,
  },
  // Inventory value milestone titles
  {
    id: "inventory-50000",
    name: "Valuable Rising Pet",
    description: "Unlocked when your inventory value reaches 50,000 coins.",
    source: "inventory",
    minInventoryValue: 50000,
  },
  {
    id: "inventory-100000",
    name: "Elite Cherished Pet",
    description: "Unlocked when your inventory value reaches 100,000 coins.",
    source: "inventory",
    minInventoryValue: 100000,
  },
  {
    id: "inventory-250000",
    name: "Luxury Owned Pet",
    description: "Unlocked when your inventory value reaches 250,000 coins.",
    source: "inventory",
    minInventoryValue: 250000,
  },
  {
    id: "inventory-1000000",
    name: "Millionaire Milked Pet",
    description: "Unlocked when your inventory value reaches 1,000,000 coins.",
    source: "inventory",
    minInventoryValue: 1000000,
  },
  // Premium: own every single legendary item (very exclusive)
  {
    id: "inventory-all-legendaries",
    name: "The Ultimate Owned Pet",
    description: "Unlocked by owning every Legendary item in your inventory. True premium devotion.",
    source: "inventory",
    requiresAllLegendaries: true,
  },
];

export const spendBadgeTiers: SpendBadgeTier[] = [
  {
    id: "bronze",
    label: "Bronze Badge",
    minSpentCoins: 10_000,
    imagePath: "/badges/bronze.png",
  },
  {
    id: "silver",
    label: "Silver Badge",
    minSpentCoins: 50_000,
    imagePath: "/badges/silver.png",
  },
  {
    id: "gold",
    label: "Gold Badge",
    minSpentCoins: 150_000,
    imagePath: "/badges/gold.png",
  },
  {
    id: "emerald",
    label: "Emerald Badge",
    minSpentCoins: 500_000,
    imagePath: "/badges/emerald.png",
  },
  {
    id: "diamond",
    label: "Diamond Badge",
    minSpentCoins: 1_000_000,
    imagePath: "/badges/diamond.png",
  },
];

export function getCosmeticItem(id: string) {
  return cosmeticItems.find((item) => item.id === id) ?? null;
}

export function getTitleItem(id: string) {
  return titleItems.find((item) => item.id === id) ?? null;
}

export function getUnlockedPetTitleIds(petScore: number) {
  return titleItems
    .filter((item) => item.source === "pet" && (item.minPetScore ?? Infinity) <= petScore)
    .map((item) => item.id);
}

export function getUnlockedCrateTitleIds(hasLegendary: boolean) {
  return titleItems
    .filter((item) => item.source === "crate" && (item.minCrateLegendaries ?? 0) <= (hasLegendary ? 1 : 0))
    .map((item) => item.id);
}

export function getUnlockedInventoryTitleIds(inventoryValue: number, hasAllLegendaries: boolean = false) {
  return titleItems
    .filter((item) => {
      if (item.source !== "inventory") return false;
      if (inventoryValue < (item.minInventoryValue ?? 0)) return false;
      if (item.requiresAllLegendaries && !hasAllLegendaries) return false;
      return true;
    })
    .map((item) => item.id);
}

export function getSpendBadge(lifetimeSpentCoins: number): SpendBadge {
  const spentCoins = Math.max(0, Math.floor(lifetimeSpentCoins));
  const currentIndex = [...spendBadgeTiers]
    .reverse()
    .find((tier) => spentCoins >= tier.minSpentCoins);
  const currentTier = currentIndex ?? spendBadgeTiers[0];
  const currentTierIndex = spendBadgeTiers.findIndex((tier) => tier.id === currentTier.id);
  const nextTier = spendBadgeTiers[currentTierIndex + 1] ?? null;
  const nextThreshold = nextTier?.minSpentCoins ?? null;
  const isEarned = spentCoins >= currentTier.minSpentCoins;
  const progress = nextThreshold
    ? Math.min(1, Math.max(0, (spentCoins - currentTier.minSpentCoins) / (nextThreshold - currentTier.minSpentCoins)))
    : 1;
  const currentSpentCoins = spentCoins;
  const nextLabel = nextTier ? `${nextTier.label} at ${nextTier.minSpentCoins.toLocaleString()} all time coin spendings` : null;
  const summary = !isEarned
    ? `${currentTier.label} · ${spentCoins.toLocaleString()} / ${currentTier.minSpentCoins.toLocaleString()} all time coin spendings`
    : nextTier
      ? `${currentTier.label} · ${spentCoins.toLocaleString()} / ${nextTier.minSpentCoins.toLocaleString()} all time coin spendings`
      : `${currentTier.label} · Max tier reached at ${spentCoins.toLocaleString()} all time coin spendings`;
  const tooltip = !isEarned
    ? `${currentTier.label} unlocks at ${currentTier.minSpentCoins.toLocaleString()} all time coin spendings.`
    : nextTier
      ? `${currentTier.label} — ${currentTier.minSpentCoins.toLocaleString()}+ all time coin spendings. Next: ${nextTier.label} at ${nextTier.minSpentCoins.toLocaleString()}`
      : `${currentTier.label} — ${currentTier.minSpentCoins.toLocaleString()}+ all time coin spendings. Highest badge reached.`;

  return {
    current: currentTier,
    currentLabel: currentTier.label,
    currentSpentCoins,
    imagePath: currentTier.imagePath,
    isEarned,
    next: nextTier,
    nextLabel,
    nextThreshold,
    progress,
    summary,
    tooltip,
  };
}

