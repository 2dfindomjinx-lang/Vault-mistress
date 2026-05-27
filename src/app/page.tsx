"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { CharacterCard } from "@/components/CharacterCard";
import { FloatingDefneBubble } from "@/components/FloatingDefneBubble";
import { GalleryGrid } from "@/components/GalleryGrid";
import { LoginScreen } from "@/components/LoginScreen";
import { StatsPanel } from "@/components/StatsPanel";
import { TaskList } from "@/components/TaskList";
import { TributePanel } from "@/components/TributePanel";
import {
  profileUsernameFromUser,
  supabase,
  type Profile,
} from "@/lib/supabase/client";
import type { GalleryItem, MechanicsState, TaskItem } from "@/lib/types";

const visibleGalleryItems: GalleryItem[] = [
  {
    id: "common-velvet-arrival",
    title: "Dollar Rain",
    rarity: "Common",
    unlockCost: 75,
    tag: "Pole Dancer",
    image: "/gallery/common-1.png",
    unlocked: false,
  },
  {
    id: "common-midnight-maid",
    title: "Leather Eclipse",
    rarity: "Common",
    unlockCost: 75,
    tag: "Rebel",
    image: "/gallery/common-2.png",
    unlocked: false,
  },
  {
    id: "common-executive-glare",
    title: "Golden Seductress",
    rarity: "Common",
    unlockCost: 75,
    tag: "Gorgeous",
    image: "/gallery/common-3.png",
    unlocked: false,
  },
  {
    id: "common-rose-vault",
    title: "Silk & Vintage",
    rarity: "Common",
    unlockCost: 75,
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

const profileSelect =
  "id, username, coins, affection, loyalty_streak, last_loyalty_at, created_at, updated_at";

const startingTasks: TaskItem[] = [
  {
    id: "daily-login",
    title: "Log in today",
    reward: 10,
    completed: true,
    claimed: false,
    kind: "claim",
  },
  {
    id: "typing-accuracy",
    title: "Typing accuracy",
    reward: 15,
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
    currentNumber: 5,
  },
  {
    id: "gallery",
    title: "Unlock one gallery image",
    reward: 25,
    completed: false,
    claimed: false,
    kind: "claim",
  },
  {
    id: "affection",
    title: "Reach 50 affection",
    reward: 25,
    completed: false,
    claimed: false,
    kind: "claim",
  },
  {
    id: "affection-80",
    title: "Reach 80 affection",
    reward: 25,
    completed: false,
    claimed: false,
    kind: "claim",
  },
];

const typingSentencePool = [
  "Principessa expects perfect devotion.",
  "The velvet vault opens for careful hands.",
  "Coins move faster when loyalty is quiet.",
  "A polished tribute always earns notice.",
  "The ledger remembers every little offering.",
  "Mistakes bore Principessa terribly.",
  "Grace belongs to those who obey precisely.",
  "The gallery waits behind a jeweled lock.",
  "A loyal player studies before acting.",
  "Pink light glows across the midnight vault.",
  "Every command sounds sweeter in silence.",
  "The throne room rewards exact attention.",
  "One perfect line is worth more than excuses.",
  "A careful devotee keeps the balance ready.",
  "Luxury favors patience and precision.",
  "The lock clicks only for flawless focus.",
  "Principessa notices disciplined fingers.",
  "A single typo ruins the ceremony.",
  "The vault prefers elegance over panic.",
  "Soft neon hides sharp little tests.",
  "Approval is rare, expensive, and earned.",
  "The next reward waits behind control.",
  "Devotion looks better when it is accurate.",
  "The richest doors open slowly.",
  "A perfect sentence pleases the vault.",
];

const dailyTeases = [
  "The vault noticed you came back. Try to look useful today.",
  "Principessa is inspecting the ledger. Impress her with discipline.",
  "A little loyalty opens heavier doors. The question is whether you have any.",
];

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

const idleMistressLines = [
  "Still here? How devoted.",
  "Waiting for my attention again? Cute.",
  "Your coin balance looks nervous.",
  "Look at you... sitting there like a loyal little vault keeper.",
  "Still admiring in silence? Predictable.",
  "Do not tell me you forgot where the tribute button is.",
  "Idle and unimpressive. Try being useful.",
  "Principessa noticed you doing absolutely nothing.",
  "My silence is more valuable than your excuses.",
  "You are only impressive when the ledger moves.",
  "Empty balances should stay quiet.",
  "Even idle, the vault belongs to me.",
  "Still here hoping for a little attention?",
  "The vault waits. I do not.",
  "You are a standby wallet with excellent posture.",
  "Good devotees keep their coins ready for Principessa.",
  "A bold one would act. You are still thinking.",
  "Tick tock. My time is expensive.",
  "Still taking up space in my vault for free?",
  "Go on... stare at the screen like it will impress me.",
  "Moments like this are why devotion looks so obvious.",
  "You have not earned my full attention yet.",
  "I hope your coins are ready soon.",
  "Look at you waiting for permission.",
  "Your purpose is simple: choose wisely and obey the vault.",
  "Even when I am idle, you stay obsessed. Weak.",
  "Financially unimpressive until I decide otherwise.",
  "Keep staring, wallet. That is almost useful.",
];

const begIgnoredLines = [
  "Principessa ignored you.",
  "Your little request disappears into velvet silence.",
  "Principessa heard you. She simply chose not to care.",
  "The vault stays quiet. Try not to look so eager.",
  "No response. How humbling.",
];

const begRewardLines = [
  "A rare mercy. Principessa drops a few coins your way.",
  "Lucky little moment. The vault grants a tiny reward.",
  "Principessa is amused enough to spare a few coins.",
  "Fine. A small gift, because the silence was getting boring.",
];

const sacrificeFailureLines = [
  "The sacrifice burns away. Nothing answers.",
  "Fifty coins vanish into the vault. Principessa smiles anyway.",
  "The offering fails. The silence feels expensive.",
  "Ashes and no reward. That is the risk.",
];

const sacrificeSuccessLines = [
  "The vault accepts your sacrifice. A hidden image unlocks.",
  "A secret door opens. Principessa allows you one rare prize.",
  "The offering pleases the vault. Something forbidden becomes visible.",
  "A hidden reward slips into the Sacrifice Collection.",
];

const supportLines = [
  "Principessa accepts the support and says nothing more.",
  "One hundred coins vanish beautifully. The vault approves.",
  "A small gesture, but at least it moved the ledger.",
  "Support recorded. Principessa may remember that.",
  "The vault hums softly. Your coins served a purpose.",
];

function getAffectionMoodLine(affection: number) {
  return [...affectionMoodLines]
    .reverse()
    .find((line) => affection >= line.min)?.text ?? affectionMoodLines[0].text;
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

function randomFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function getDailyTypingSentence() {
  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return typingSentencePool[dayIndex % typingSentencePool.length];
}

function randomHighLowNumber() {
  return Math.floor(Math.random() * 10) + 1;
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

function buildTasksFromRows(rows: UserTaskRow[], affection: number) {
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
      return {
        ...task,
        completed: Boolean(row?.completed_at),
        claimed: Boolean(cooldownUntil),
        cooldownUntil,
        currentNumber: cooldownUntil
          ? getTaskMetadataNumber(row?.metadata, "currentNumber", 5)
          : getTaskMetadataNumber(row?.metadata, "currentNumber", randomHighLowNumber()),
        lastResult: getTaskMetadataString(row?.metadata, "lastResult"),
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
      10 * 1000,
    ),
    sacrificeCooldownUntil: getDailyCooldownUntil(sacrificeRow?.claimed_at ?? null),
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
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [username, setUsername] = useState("@littledevotee");
  const [coins, setCoins] = useState(100);
  const coinsRef = useRef(coins);
  const [affection, setAffection] = useState(0);
  const [loyaltyStreak, setLoyaltyStreak] = useState(0);
  const [tributeTotal, setTributeTotal] = useState(0);
  const [unlockedGalleryIds, setUnlockedGalleryIds] = useState<string[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [mechanics, setMechanics] = useState<MechanicsState>({
    supportUnlocked: false,
    sacrificeUnlockedCount: 0,
    sacrificeTotal: sacrificeGalleryItems.length,
    sacrificeComplete: false,
    allGalleryComplete: false,
  });
  const [activePanel, setActivePanel] = useState<"tribute" | "gallery" | "tasks">("tribute");
  const [mistressReply, setMistressReply] = useState(
    "The vault is waiting. Try to look composed.",
  );
  const lastIdleLineIndexRef = useRef(-1);

  const dailyMessage = dailyTeases[new Date().getDay() % dailyTeases.length];
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

  useEffect(() => {
    coinsRef.current = coins;
  }, [coins]);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const getRandomDelay = (minimum: number, maximum: number) =>
      Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;

    const getRandomIdleLine = () => {
      let nextIndex = Math.floor(Math.random() * idleMistressLines.length);

      if (idleMistressLines.length > 1) {
        while (nextIndex === lastIdleLineIndexRef.current) {
          nextIndex = Math.floor(Math.random() * idleMistressLines.length);
        }
      }

      lastIdleLineIndexRef.current = nextIndex;
      return idleMistressLines[nextIndex];
    };

    const idleTimer = window.setTimeout(() => {
      setMistressReply(getRandomIdleLine());
    }, getRandomDelay(6000, 10000));

    return () => {
      window.clearTimeout(idleTimer);
    };
  }, [isLoggedIn, mistressReply]);

  const recordCoinTransaction = useCallback((amount: number, reason: string) => {
    if (!authUserId || amount === 0) {
      return;
    }

    void supabase.from("coin_transactions").insert({
      user_id: authUserId,
      amount,
      reason,
    }).then(({ error }) => {
      if (error) {
        console.error("Failed to persist coin transaction", { amount, reason, error });
      }
    });
  }, [authUserId]);

  const persistGalleryUnlocks = useCallback(async (itemIds: string[]) => {
    if (!authUserId || itemIds.length === 0) {
      return;
    }

    const rows = itemIds.map((itemId) => ({
      user_id: authUserId,
      item_id: itemId,
    }));

    const { error: galleryError } = await supabase.from("user_gallery").upsert(rows, {
      onConflict: "user_id,item_id",
    });

    if (galleryError) {
      console.error("Failed to persist user_gallery unlocks", {
        itemIds,
        error: galleryError,
      });
      throw galleryError;
    }

    const { error: legacyGalleryError } = await supabase.from("unlocked_gallery_items").upsert(
      rows,
      { onConflict: "user_id,item_id" },
    );

    if (legacyGalleryError) {
      console.warn("Failed to persist legacy gallery unlocks", {
        itemIds,
        error: legacyGalleryError,
      });
    }
  }, [authUserId]);

  const applyProfile = useCallback(async (profile: Profile) => {
    setAuthUserId(profile.id);
    setUsername(profile.username);
    setCoins(profile.coins);
    setAffection(profile.affection);
    setLoyaltyStreak(profile.loyalty_streak ?? 0);

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

    const { data: taskData, error: taskError } = await supabase
      .from("user_tasks")
      .select("task_id, completed_at, claimed_at, reward_coins, metadata")
      .eq("user_id", profile.id);

    if (taskError) {
      console.error("Failed to load persisted task state", taskError);
      throw taskError;
    }

    const taskRows = (taskData ?? []) as UserTaskRow[];

    setTasks(buildTasksFromRows(taskRows, profile.affection));
    setMechanics(buildMechanicsFromRows(taskRows, unlockedIds));
    setIsLoggedIn(true);
  }, []);

  const applyProfileStats = useCallback((profile: Profile) => {
    setAuthUserId(profile.id);
    setUsername(profile.username);
    setCoins(profile.coins);
    setAffection(profile.affection);
    setLoyaltyStreak(profile.loyalty_streak ?? 0);
    setIsLoggedIn(true);
  }, []);

  const createProfileForUser = useCallback(async (user: User) => {
    const fallbackUsername = profileUsernameFromUser(user);

    const createProfile = async (usernameForProfile: string) => {
      console.info("Creating/upserting profile", {
        userId: user.id,
        username: usernameForProfile,
      });

      const result = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            username: usernameForProfile,
            coins: 100,
            affection: 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id", ignoreDuplicates: true },
        )
        .select(profileSelect)
        .single();

      console.info("Profile upsert result", {
        data: result.data,
        error: result.error,
      });

      if (result.error) {
        console.error("Profile upsert error", result.error);
      }

      return result;
    };

    let { data: createdProfile, error: insertError } =
      await createProfile(fallbackUsername);

    if (insertError?.code === "23505") {
      const uniqueUsername = `${fallbackUsername}_${user.id.slice(0, 6)}`;
      console.warn("Profile username collision, retrying", {
        fallbackUsername,
        uniqueUsername,
        error: insertError,
      });
      const retry = await createProfile(uniqueUsername);

      createdProfile = retry.data;
      insertError = retry.error;
    }

    if (insertError || !createdProfile) {
      console.error("Profile create final failure", {
        createdProfile,
        insertError,
      });
      throw insertError ?? new Error("Profile could not be created.");
    }

    return createdProfile;
  }, []);

  const loadProfile = useCallback(async (user: User) => {
    console.info("Loading profile for authenticated user", {
      id: user.id,
      metadata: user.user_metadata,
    });

    const { data: existingProfile, error } = await supabase
      .from("profiles")
      .select(profileSelect)
      .eq("id", user.id)
      .maybeSingle();

    console.info("Profile select result", {
      existingProfile,
      error,
    });

    if (error) {
      console.error("Profile select error", error);
      throw error;
    }

    if (existingProfile) {
      await applyProfile(existingProfile);
      return existingProfile as Profile;
    }

    const createdProfile = await createProfileForUser(user);
    await applyProfile(createdProfile);
    return createdProfile as Profile;
  }, [applyProfile, createProfileForUser]);

  const updateLoyaltyForProfile = useCallback(async (profile: Profile) => {
    const lastLoyaltyAt = profile.last_loyalty_at;

    if (lastLoyaltyAt && isWithinLast24Hours(lastLoyaltyAt)) {
      setLoyaltyStreak(profile.loyalty_streak ?? 0);
      return profile;
    }

    const nextLoyaltyStreak = Math.max(1, (profile.loyalty_streak ?? 0) + 1);
    const { data, error } = await supabase
      .from("profiles")
      .update({
        loyalty_streak: nextLoyaltyStreak,
        last_loyalty_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id)
      .select(profileSelect)
      .single();

    console.info("Loyalty streak update result", { data, error });

    if (error) {
      console.error("Failed to persist loyalty streak", error);
      throw error;
    }

    setLoyaltyStreak(data.loyalty_streak ?? nextLoyaltyStreak);
    return data as Profile;
  }, []);

  const persistProfileProgress = useCallback(async (
    nextProfile: Pick<Profile, "coins" | "affection">,
    reason: string,
  ) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    console.info("Persist profile progress auth user", {
      reason,
      userData,
      userError,
    });

    if (userError) {
      console.error("Failed to get authenticated user for profile update", userError);
      throw userError;
    }

    if (!userData.user) {
      throw new Error("Not authenticated");
    }

    const payload = {
      coins: nextProfile.coins,
      affection: nextProfile.affection,
      updated_at: new Date().toISOString(),
    };

    const updateResult = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", userData.user.id)
      .select(profileSelect)
      .single();
    let data = updateResult.data as Profile | null;
    let error = updateResult.error;

    if (error?.code === "42703" && error.message.includes("updated_at")) {
      console.warn("profiles.updated_at is missing; retrying progress update without it.");
      const retry = await supabase
        .from("profiles")
        .update({
          coins: nextProfile.coins,
          affection: nextProfile.affection,
        })
        .eq("id", userData.user.id)
        .select(profileSelect)
        .single();

      data = retry.data as Profile | null;
      error = retry.error;
    }

    console.info("Persist profile progress result", {
      reason,
      payload,
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
    return data;
  }, [applyProfileStats]);

  const persistTaskCompletion = useCallback((taskId: string) => {
    if (!authUserId) {
      console.error("Cannot persist task completion without authenticated user id", taskId);
      return;
    }

    const task = startingTasks.find((entry) => entry.id === taskId);

    void supabase.from("user_tasks").upsert(
      {
        user_id: authUserId,
        task_id: taskId,
        completed_at: new Date().toISOString(),
        reward_coins: task?.reward ?? 0,
        metadata: {},
      },
      { onConflict: "user_id,task_id" },
    ).then(({ error }) => {
      if (error) {
        console.error("Failed to persist task completion", { taskId, error });
      }
    });
  }, [authUserId]);

  const persistTaskClaim = useCallback(async (task: TaskItem) => {
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
      (task.id === "typing-accuracy" || task.id === "high-low") &&
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
      existingTask?.claimed_at
    ) {
      throw new Error("Task reward was already claimed.");
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase.from("user_tasks").upsert(
      {
        user_id: userData.user.id,
        task_id: task.id,
        completed_at: existingTask?.completed_at ?? now,
        claimed_at: now,
        reward_coins: task.reward,
        metadata: {
          ...(existingTask?.metadata ?? {}),
          attemptsRemaining: task.id === "typing-accuracy" ? 3 : undefined,
        },
      },
      { onConflict: "user_id,task_id" },
    ).select("task_id, completed_at, claimed_at, reward_coins, metadata").single();

    console.info("Task claim persist result", { data, error });

    if (error) {
      console.error("Failed to persist task claim", error);
      throw error;
    }

    return data;
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootSession = async () => {
      setIsAuthLoading(true);
      const sessionResult = await supabase.auth.getSession();
      console.info("Supabase auth getSession result", sessionResult);

      if (sessionResult.error) {
        console.error("Supabase auth getSession error", sessionResult.error);
      }

      const userResult = await supabase.auth.getUser();
      console.info("Supabase auth getUser result", userResult);

      const { data, error } = userResult;

      if (!mounted) {
        return;
      }

      if (error) {
        console.error("Supabase auth user lookup failed", error);
      }

      if (!data.user) {
        setIsLoggedIn(false);
        setIsAuthLoading(false);
        return;
      }

      try {
        const profile = await loadProfile(data.user);
        await updateLoyaltyForProfile(profile);
        setMistressReply("Logged in already? Eager little thing.");
      } catch (profileError) {
        console.error("Profile load/create failed", profileError);
        setAuthError(describeError(profileError));
      } finally {
        if (mounted) {
          setIsAuthLoading(false);
        }
      }
    };

    void bootSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setIsLoggedIn(false);
        setAuthUserId(null);
        return;
      }

      console.info("Supabase auth state changed", {
        event: _event,
        user: session.user,
      });

      void loadProfile(session.user).then((profile) =>
        updateLoyaltyForProfile(profile),
      ).catch((profileError) => {
        console.error("Profile load/create failed after auth change", profileError);
        setAuthError(describeError(profileError));
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile, updateLoyaltyForProfile]);

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

      const shouldAnnounceSecret =
        affection >= 100 &&
        missingIds.includes(secretGalleryItem.id) &&
        !unlockedGalleryIds.includes(secretGalleryItem.id);

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

      if (shouldAnnounceSecret) {
        setMistressReply(
          "You reached 100 mood. Fine... one secret reward is yours.",
        );
      }
    }, 0);

    return () => {
      window.clearTimeout(unlockTimer);
    };
  }, [affection, persistGalleryUnlocks, unlockedGalleryIds]);

  const scriptedMessage = useMemo(
    () => getAffectionMoodLine(affection),
    [affection],
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
    const task = tasks.find((entry) => entry.id === "typing-accuracy");
    const typingCooldownActive =
      Boolean(task?.cooldownUntil) &&
      new Date(task?.cooldownUntil ?? "").getTime() > Date.now();

    if (!task || typingCooldownActive || task.completed || !authUserId) {
      return;
    }

    const sentence = task.sentence ?? getDailyTypingSentence();

    if (!sentence.startsWith(value)) {
      const nextAttempts = Math.max(0, (task.attemptsRemaining ?? 3) - 1);
      const failedAt = nextAttempts === 0 ? new Date().toISOString() : null;

      const { error } = await supabase.from("user_tasks").upsert(
        {
          user_id: authUserId,
          task_id: task.id,
          completed_at: null,
          claimed_at: null,
          reward_coins: task.reward,
          metadata: {
            attemptsRemaining: nextAttempts,
            failedAt,
          },
        },
        { onConflict: "user_id,task_id" },
      );

      if (error) {
        console.error("Failed to persist typing attempt", error);
        setAuthError(describeError(error));
        return;
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
      setMistressReply(
        nextAttempts === 0
          ? "Three mistakes. The vault closes that lesson for today."
          : "A mistake already? Start again, carefully.",
      );
      return;
    }

    if (value === sentence) {
      const { error } = await supabase.from("user_tasks").upsert(
        {
          user_id: authUserId,
          task_id: task.id,
          completed_at: new Date().toISOString(),
          claimed_at: null,
          reward_coins: task.reward,
          metadata: {
            attemptsRemaining: task.attemptsRemaining ?? 3,
          },
        },
        { onConflict: "user_id,task_id" },
      );

      if (error) {
        console.error("Failed to persist typing success", error);
        setAuthError(describeError(error));
        return;
      }

      setTasks((current) =>
        current.map((entry) =>
          entry.id === task.id
            ? { ...entry, completed: true, claimed: false }
            : entry,
        ),
      );
      setMistressReply("Perfect. Principessa appreciates precision.");
    }
  };

  const handleHighLowPlay = async (
    guess: "higher" | "lower",
    stake: number,
  ) => {
    const task = tasks.find((entry) => entry.id === "high-low");
    const highLowCooldownActive =
      Boolean(task?.cooldownUntil) &&
      new Date(task?.cooldownUntil ?? "").getTime() > Date.now();

    if (!task || highLowCooldownActive || !authUserId) {
      return;
    }

    if (!Number.isInteger(stake) || stake <= 0) {
      setMistressReply("Choose a real stake before testing the vault.");
      return;
    }

    const currentCoins = coinsRef.current;

    if (currentCoins < stake) {
      setMistressReply("Too few coins for that little gamble.");
      return;
    }

    const currentNumber = task.currentNumber ?? randomHighLowNumber();
    const nextNumber = randomHighLowNumber();
    const won =
      nextNumber !== currentNumber &&
      ((guess === "higher" && nextNumber > currentNumber) ||
        (guess === "lower" && nextNumber < currentNumber));
    const nextCoins = won ? currentCoins + stake : currentCoins - stake;
    const now = new Date().toISOString();
    const lastResult = `${currentNumber} -> ${nextNumber}. ${won ? "Won" : "Lost"} ${stake} coins. Ties count as losses.`;

    try {
      await persistProfileProgress(
        { coins: nextCoins, affection },
        "high-low",
      );

      const { error } = await supabase.from("user_tasks").upsert(
        {
          user_id: authUserId,
          task_id: task.id,
          completed_at: now,
          claimed_at: now,
          reward_coins: won ? stake : -stake,
          metadata: {
            currentNumber: nextNumber,
            previousNumber: currentNumber,
            stake,
            guess,
            won,
            lastResult,
          },
        },
        { onConflict: "user_id,task_id" },
      );

      if (error) {
        console.error("Failed to persist high-low play", error);
        throw error;
      }

      recordCoinTransaction(won ? stake : -stake, "task:high-low");
      setTasks((current) =>
        current.map((entry) =>
          entry.id === task.id
            ? {
                ...entry,
                completed: true,
                claimed: true,
                currentNumber: nextNumber,
                lastResult,
                cooldownUntil: getDailyCooldownUntil(now),
              }
            : entry,
        ),
      );
      setMistressReply(
        won
          ? "A lucky guess. The vault doubles your stake."
          : "Wrong. The vault keeps that stake.",
      );
    } catch (error) {
      console.error("Failed to complete high-low play", error);
      setAuthError(describeError(error));
      setMistressReply("The high-low ledger failed. Try again.");
    }
  };

  const handleBeg = async () => {
    if (!authUserId) {
      return;
    }

    const cooldownActive =
      Boolean(displayMechanics.begCooldownUntil) &&
      new Date(displayMechanics.begCooldownUntil ?? "").getTime() > Date.now();

    if (cooldownActive) {
      return;
    }

    const now = new Date().toISOString();
    const reward = Math.random() < 0.03 ? Math.floor(Math.random() * 10) + 1 : 0;

    try {
      const { error } = await supabase.from("user_tasks").upsert(
        {
          user_id: authUserId,
          task_id: "beg",
          completed_at: now,
          reward_coins: reward,
          metadata: {
            lastBegAt: now,
            lastReward: reward,
          },
        },
        { onConflict: "user_id,task_id" },
      );

      if (error) {
        console.error("Failed to persist beg cooldown", error);
        throw error;
      }

      if (reward > 0) {
        await persistProfileProgress(
          { coins: coinsRef.current + reward, affection },
          "beg",
        );
        recordCoinTransaction(reward, "mechanic:beg");
      }

      setMechanics((current) => ({
        ...current,
        begCooldownUntil: getCooldownUntil(now, 10 * 1000),
      }));
      setMistressReply(
        reward > 0
          ? `${randomFrom(begRewardLines)} +${reward} coins.`
          : randomFrom(begIgnoredLines),
      );
    } catch (error) {
      console.error("Failed to complete beg mechanic", error);
      setAuthError(describeError(error));
      setMistressReply("The vault ignored the request. Try again.");
    }
  };

  const handleSacrifice = async () => {
    if (!authUserId || displayMechanics.sacrificeComplete) {
      return;
    }

    const cooldownActive =
      Boolean(displayMechanics.sacrificeCooldownUntil) &&
      new Date(displayMechanics.sacrificeCooldownUntil ?? "").getTime() > Date.now();

    if (cooldownActive) {
      return;
    }

    if (coinsRef.current < 50) {
      setMistressReply("The sacrifice requires 50 coins. The vault is not impressed.");
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
      setMistressReply("The Sacrifice Collection is already complete.");
      return;
    }

    const now = new Date().toISOString();
    const won = Math.random() < 0.5;
    const unlockedItem = won ? randomFrom(remainingItems) : null;
    const nextCoins = coinsRef.current - 50;
    const lastResult = unlockedItem
      ? `Unlocked ${unlockedItem.title}.`
      : "The offering burned away.";

    try {
      await persistProfileProgress(
        { coins: nextCoins, affection },
        "sacrifice",
      );
      recordCoinTransaction(-50, "mechanic:sacrifice");

      if (unlockedItem) {
        await persistGalleryUnlocks([unlockedItem.id]);
        setUnlockedGalleryIds((current) =>
          current.includes(unlockedItem.id) ? current : [...current, unlockedItem.id],
        );
      }

      const { error } = await supabase.from("user_tasks").upsert(
        {
          user_id: authUserId,
          task_id: "sacrifice",
          completed_at: now,
          claimed_at: unlockedItem ? now : null,
          reward_coins: unlockedItem ? 1 : 0,
          metadata: {
            won,
            unlockedItemId: unlockedItem?.id ?? null,
            lastResult,
          },
        },
        { onConflict: "user_id,task_id" },
      );

      if (error) {
        console.error("Failed to persist sacrifice cooldown", error);
        throw error;
      }

      setMechanics((current) => ({
        ...current,
        sacrificeCooldownUntil: unlockedItem ? getDailyCooldownUntil(now) : null,
        sacrificeLastResult: lastResult,
      }));
      setMistressReply(
        unlockedItem
          ? `${randomFrom(sacrificeSuccessLines)} ${unlockedItem.title} joins the collection.`
          : randomFrom(sacrificeFailureLines),
      );
    } catch (error) {
      console.error("Failed to complete sacrifice mechanic", error);
      setAuthError(describeError(error));
      setMistressReply("The sacrifice ledger failed. Try again.");
    }
  };

  const handleSupport = async () => {
    if (!authUserId || !displayMechanics.supportUnlocked) {
      return;
    }

    if (coinsRef.current < 100) {
      setMistressReply("Support costs 100 coins. The vault waits.");
      return;
    }

    const now = new Date().toISOString();
    const message = randomFrom(supportLines);

    try {
      await persistProfileProgress(
        { coins: coinsRef.current - 100, affection },
        "support",
      );
      recordCoinTransaction(-100, "mechanic:support");

      const { error } = await supabase.from("user_tasks").upsert(
        {
          user_id: authUserId,
          task_id: "support",
          completed_at: now,
          reward_coins: -100,
          metadata: {
            lastUsedAt: now,
            lastResult: message,
          },
        },
        { onConflict: "user_id,task_id" },
      );

      if (error) {
        console.error("Failed to persist support mechanic", error);
        throw error;
      }

      setMechanics((current) => ({
        ...current,
        supportLastResult: message,
      }));
      setMistressReply(message);
    } catch (error) {
      console.error("Failed to complete support mechanic", error);
      setAuthError(describeError(error));
      setMistressReply("The support ledger failed. Try again.");
    }
  };

  const handleSignInWithX = async () => {
    setIsAuthBusy(true);
    setAuthError("");

    try {
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
    } catch (error) {
      console.error("Supabase X OAuth sign-in failed", error);
      setAuthError(
        error instanceof Error
          ? error.message
          : "X sign-in failed. Check Supabase OAuth settings.",
      );
      setIsAuthBusy(false);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setAuthUserId(null);
    setUnlockedGalleryIds([]);
    setTasks([]);
    setCoins(100);
    setAffection(0);
    setMistressReply("Back at the gate. The vault can wait.");
  };

  const handleTribute = async (amount: number) => {
    if (affection >= 100) {
      setMistressReply(
        "My mood is already at its peak. Your coins can wait.",
      );
      return;
    }

    const currentCoins = coinsRef.current;

    if (currentCoins < amount) {
      setMistressReply(
        "Too poor for that one? How predictable.",
      );
      return;
    }

    const tributeGains: Record<number, number> = {
      25: 1,
      100: 5,
      500: 30,
    };
    const affectionGain = tributeGains[amount] ?? 0;

    const nextAffection = Math.min(100, affection + affectionGain);
    const nextCoins = Math.max(0, currentCoins - amount);

    try {
      await persistProfileProgress(
        { coins: nextCoins, affection: nextAffection },
        "tribute",
      );
      recordCoinTransaction(nextCoins - currentCoins, "tribute");
    } catch (error) {
      console.error("Failed to persist tribute progress", error);
      setAuthError(describeError(error));
      setMistressReply("The ledger refused that tribute. Try again.");
      return;
    }

    setTributeTotal((value) => value + amount);
    if (nextAffection >= 50) {
      completeTask("affection");
    }
    if (nextAffection >= 80) {
      completeTask("affection-80");
    }
    setMistressReply(
      amount >= 500
        ? "Good. At least you know where your coins belong."
        : amount >= 100
          ? "Acceptable. The vault noticed your little offering."
          : "Small, but you placed it correctly.",
    );
  };

  const handleUnlock = async (itemId: string) => {
    const item = visibleGalleryItems.find((entry) => entry.id === itemId);

    if (!item || item.rarity !== "Common" || unlockedGalleryIds.includes(item.id)) {
      return;
    }

    const currentCoins = coinsRef.current;

    const unlockCost = item.unlockCost ?? 75;

    if (currentCoins < unlockCost) {
      setMistressReply(
        "Too poor for that one? How predictable.",
      );
      return;
    }

    const nextAffection = Math.min(100, affection + 8);
    const nextCoins = Math.max(0, currentCoins - unlockCost);

    try {
      await persistProfileProgress(
        { coins: nextCoins, affection: nextAffection },
        "common_gallery_unlock",
      );
      await persistGalleryUnlocks([item.id]);
      recordCoinTransaction(nextCoins - currentCoins, "common_gallery_unlock");
    } catch (error) {
      console.error("Failed to persist gallery unlock progress", error);
      setAuthError(describeError(error));
      setMistressReply("The vault ledger rejected that unlock. Try again.");
      return;
    }

    setUnlockedGalleryIds((current) =>
      current.includes(item.id) ? current : [...current, item.id],
    );
    completeTask("gallery");
    if (nextAffection >= 50) {
      completeTask("affection");
    }
    if (nextAffection >= 80) {
      completeTask("affection-80");
    }
    setMistressReply(
      "You unlocked a little more of my attention.",
    );
  };

  const handleClaimTask = async (taskId: string) => {
    const task = tasks.find((entry) => entry.id === taskId);

    if (!task) {
      return;
    }

    const currentCoins = coinsRef.current;
    const nextCoins = currentCoins + task.reward;
    const dailyCooldownActive =
      task.id === "daily-login" &&
      Boolean(task.cooldownUntil) &&
      new Date(task.cooldownUntil ?? "").getTime() > Date.now();

    if (!task.completed || (task.claimed && task.id !== "daily-login") || dailyCooldownActive) {
      return;
    }

    try {
      await persistTaskClaim(task);
      await persistProfileProgress(
        { coins: nextCoins, affection },
        `task:${task.id}`,
      );
      recordCoinTransaction(task.reward, `task:${task.id}`);
    } catch (error) {
      console.error("Failed to persist task reward", error);
      setAuthError(describeError(error));
      setMistressReply("The reward ledger failed. Try again.");
      return;
    }

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
                  ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                  : entry.cooldownUntil,
            }
          : entry,
      ),
    );
    setMistressReply(
      `Fine. ${task.reward} coins added. Spend them carefully.`,
    );
  };

  const stats = {
    coins,
    affection,
    loyaltyStreak,
    tributeTotal,
  };

  if (isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06030a] text-pink-100">
        <div className="rounded-[2rem] border border-pink-200/20 bg-black/55 px-6 py-5 shadow-[0_0_44px_rgba(236,72,153,0.16)]">
          Opening the vault...
        </div>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <LoginScreen
        error={authError}
        isBusy={isAuthBusy}
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
              <span className="font-bold text-pink-100">{username}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <div className="rounded-full border border-pink-300/30 bg-pink-500/10 px-3 py-1 text-sm font-semibold text-pink-100">
              Greedy Mode
            </div>
            <Link
              className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-sm font-semibold text-zinc-200 transition hover:border-pink-300/40 hover:text-white"
              href="/admin"
            >
              Admin
            </Link>
            <button
              className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-sm font-semibold text-zinc-200 transition hover:border-pink-300/40 hover:text-white"
              onClick={handleLogout}
              type="button"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <CharacterCard
            dailyMessage={dailyMessage}
          />

          <div className="flex flex-col gap-6">
            <StatsPanel stats={stats} />
            <section className="rounded-[2rem] border border-pink-200/15 bg-[linear-gradient(150deg,rgba(0,0,0,0.68),rgba(67,9,61,0.42))] p-5 shadow-[0_0_40px_rgba(236,72,153,0.12)]">
              <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-200/70">
                Affection Read
              </p>
              <h2 className="mt-1 text-2xl font-black">Principessa&apos;s Mood</h2>
              <p className="mt-4 text-sm leading-6 text-pink-50">
                {scriptedMessage}
              </p>
            </section>
          </div>
        </section>

        <nav className="grid grid-cols-3 gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-2 shadow-[0_0_28px_rgba(236,72,153,0.1)]">
          {[
            ["tribute", "Tribute"],
            ["gallery", "Gallery"],
            ["tasks", "Tasks"],
          ].map(([key, label]) => (
            <button
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                activePanel === key
                  ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-[0_0_22px_rgba(236,72,153,0.35)]"
                  : "border border-white/10 bg-black/40 text-pink-100 hover:border-pink-300/40"
              }`}
              key={key}
              onClick={() => setActivePanel(key as typeof activePanel)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>

        <section className="pb-10">
          {activePanel === "tribute" && (
            <TributePanel
              affection={affection}
              coins={coins}
              onTribute={handleTribute}
            />
          )}
          {activePanel === "gallery" && (
            <GalleryGrid
              items={visibleGallery}
              coins={coins}
              mood={affection}
              onUnlock={handleUnlock}
            />
          )}
          {activePanel === "tasks" && (
            <TaskList
              coins={coins}
              mechanics={displayMechanics}
              tasks={tasks}
              onBeg={handleBeg}
              onClaim={handleClaimTask}
              onHighLowPlay={handleHighLowPlay}
              onSacrifice={handleSacrifice}
              onSupport={handleSupport}
              onTypingProgress={handleTypingProgress}
            />
          )}
        </section>
      </div>
      <FloatingDefneBubble message={mistressReply} />
    </main>
  );
}
