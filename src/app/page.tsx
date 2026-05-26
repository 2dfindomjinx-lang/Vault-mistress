"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { AdminConsole } from "@/components/AdminConsole";
import { CharacterCard } from "@/components/CharacterCard";
import { FloatingDefneBubble } from "@/components/FloatingDefneBubble";
import { GalleryGrid } from "@/components/GalleryGrid";
import { LoginScreen } from "@/components/LoginScreen";
import { StatsPanel } from "@/components/StatsPanel";
import { TaskList } from "@/components/TaskList";
import { TributePanel } from "@/components/TributePanel";
import type { GalleryItem, TaskItem } from "@/lib/types";

type PrototypeUser = {
  handle: string;
  coins: number;
};

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
  title: "Defne's Final Favor",
  rarity: "Secret",
  moodRequired: 100,
  tag: "Luxury",
  image: "/gallery/secret-1.png",
  unlocked: false,
};

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

const startingTasks: TaskItem[] = [
  {
    id: "daily-login",
    title: "Log in today",
    reward: 15,
    completed: true,
    claimed: false,
  },
  {
    id: "x-connect",
    title: "Connect with X",
    reward: 20,
    completed: true,
    claimed: false,
  },
  {
    id: "tribute",
    title: "Send one tribute",
    reward: 20,
    completed: false,
    claimed: false,
  },
  {
    id: "gallery",
    title: "Unlock one gallery image",
    reward: 25,
    completed: false,
    claimed: false,
  },
  {
    id: "affection",
    title: "Reach 50 affection",
    reward: 40,
    completed: false,
    claimed: false,
  },
];

const dailyTeases = [
  "The vault noticed you came back. Try to look useful today.",
  "Defne is inspecting the ledger. Impress her with discipline.",
  "A little loyalty opens heavier doors. The question is whether you have any.",
];

const affectionMoodLines = [
  { min: 0, text: "Defne barely acknowledges you. Even the vault feels colder." },
  { min: 5, text: "Defne notices your presence, but only enough to judge it." },
  { min: 10, text: "Defne gives you a slow glance. Not approval. Curiosity." },
  { min: 15, text: "Defne seems mildly amused by your persistence." },
  { min: 20, text: "Defne's mood softens just enough to unlock a rare glance." },
  { min: 25, text: "Defne lets the silence linger, then rewards you with attention." },
  { min: 30, text: "Defne is entertained. That is more than most deserve." },
  { min: 35, text: "Defne's smile looks expensive, and somehow you earned a fraction of it." },
  { min: 40, text: "Defne is pleased enough to let you see a little more of the vault." },
  { min: 45, text: "Defne watches you like an investment that might finally pay off." },
  { min: 50, text: "Defne approves. Barely. But from her, barely is dangerous." },
  { min: 55, text: "Defne's attention lingers longer than usual. Do not waste it." },
  { min: 60, text: "Defne's mood turns divine. The vault begins to open deeper." },
  { min: 65, text: "Defne looks satisfied, as if your loyalty is becoming useful." },
  { min: 70, text: "Defne rewards devotion with a colder smile and a richer prize." },
  { min: 75, text: "Defne seems almost proud. Almost." },
  { min: 80, text: "Defne's approval feels rare, polished, and impossible to ignore." },
  { min: 85, text: "Defne treats your devotion like property already marked as hers." },
  { min: 90, text: "Defne's mood is dangerously high. The final divine doors open." },
  { min: 95, text: "Defne is indulgent now, but only because you have proven useful." },
  { min: 100, text: "Defne is fully pleased. The secret reward reveals itself." },
];

function getAffectionMoodLine(affection: number) {
  return [...affectionMoodLines]
    .reverse()
    .find((line) => affection >= line.min)?.text ?? affectionMoodLines[0].text;
}

export default function Home() {
  const { data: session, status } = useSession();
  const sessionName = session?.user?.name ?? "X User";
  const currentHandle = `@${sessionName
    .replace(/^@/, "")
    .replace(/\s+/g, "")
    .toLowerCase()}`;
  const [users, setUsers] = useState<PrototypeUser[]>([]);
  const usersRef = useRef(users);
  const [affection, setAffection] = useState(10);
  const [loyaltyStreak] = useState(3);
  const [tributeTotal, setTributeTotal] = useState(0);
  const [unlockedGalleryIds, setUnlockedGalleryIds] = useState<string[]>([]);
  const [tasks, setTasks] = useState(startingTasks);
  const [activePanel, setActivePanel] = useState<"tribute" | "gallery" | "tasks" | "admin">("tribute");
  const [mistressReply, setMistressReply] = useState(
    "The vault is waiting. Try to look composed.",
  );

  const dailyMessage = dailyTeases[new Date().getDay() % dailyTeases.length];
  const coins = users.find((user) => user.handle === currentHandle)?.coins ?? 100;
  const galleryItems =
    affection >= 100
      ? [...visibleGalleryItems, secretGalleryItem]
      : visibleGalleryItems;
  const visibleGallery = galleryItems.map((item) => ({
    ...item,
    unlocked: unlockedGalleryIds.includes(item.id),
  }));

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

      if (shouldAnnounceSecret) {
        setMistressReply(
          "You reached 100 mood. Fine... one secret reward is yours.",
        );
      }
    }, 0);

    return () => {
      window.clearTimeout(unlockTimer);
    };
  }, [affection, unlockedGalleryIds]);

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
  };

  const handleLogout = () => {
    setMistressReply("Back at the gate. The vault can wait.");
    signOut();
  };

  const updateUserCoins = (
    handle: string,
    update: number | ((currentCoins: number) => number),
  ) => {
    const existingUser = usersRef.current.find((user) => user.handle === handle);
    const userFound = Boolean(existingUser) || handle === currentHandle;
    const getNextCoins = (currentCoins: number) =>
      typeof update === "function" ? update(currentCoins) : currentCoins + update;

    if (!existingUser && handle === currentHandle) {
      const nextUsers = [
        ...usersRef.current,
        { handle, coins: getNextCoins(100) },
      ];

      usersRef.current = nextUsers;
      setUsers(nextUsers);
      return true;
    }

    const nextUsers = usersRef.current.map((user) => {
        if (user.handle !== handle) {
          return user;
        }

        return {
          ...user,
          coins: getNextCoins(user.coins),
        };
      });

    usersRef.current = nextUsers;
    setUsers(nextUsers);

    return userFound;
  };

  const handleTribute = (amount: number) => {
    const currentCoins =
      usersRef.current.find((user) => user.handle === currentHandle)?.coins ?? 100;

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

    updateUserCoins(currentHandle, (value) => Math.max(0, value - amount));
    setAffection(nextAffection);
    setTributeTotal((value) => value + amount);
    completeTask("tribute");
    if (nextAffection >= 50) {
      completeTask("affection");
    }
    setMistressReply(
      amount >= 500
        ? "Good. At least you know where your coins belong."
        : amount >= 100
          ? "Acceptable. The vault noticed your little offering."
          : "Small, but you placed it correctly.",
    );
  };

  const handleUnlock = (itemId: string) => {
    const item = visibleGalleryItems.find((entry) => entry.id === itemId);

    if (!item || item.rarity !== "Common" || unlockedGalleryIds.includes(item.id)) {
      return;
    }

    const currentCoins =
      usersRef.current.find((user) => user.handle === currentHandle)?.coins ?? 100;

    const unlockCost = item.unlockCost ?? 75;

    if (currentCoins < unlockCost) {
      setMistressReply(
        "Too poor for that one? How predictable.",
      );
      return;
    }

    updateUserCoins(currentHandle, (value) => Math.max(0, value - unlockCost));
    setUnlockedGalleryIds((current) =>
      current.includes(item.id) ? current : [...current, item.id],
    );
    const nextAffection = Math.min(100, affection + 8);

    setAffection(nextAffection);
    completeTask("gallery");
    if (nextAffection >= 50) {
      completeTask("affection");
    }
    setMistressReply(
      "You unlocked a little more of my attention.",
    );
  };

  const handleClaimTask = (taskId: string) => {
    const task = tasks.find((entry) => entry.id === taskId);

    if (!task || !task.completed || task.claimed) {
      return;
    }

    updateUserCoins(currentHandle, task.reward);
    setTasks((current) =>
      current.map((entry) =>
        entry.id === taskId ? { ...entry, claimed: true } : entry,
      ),
    );
    setMistressReply(
      `Fine. ${task.reward} coins added. Spend them carefully.`,
    );
  };

  const handleAdminAddCoins = (handle: string, amount: number) => {
    const added = updateUserCoins(handle, amount);

    if (added) {
      setMistressReply("Coins added. Try not to waste my generosity.");
    }

    return added;
  };

  const stats = {
    coins,
    affection,
    loyaltyStreak,
    tributeTotal,
  };

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06030a] text-pink-50">
        Loading the vault...
      </main>
    );
  }

  if (!session) {
    return <LoginScreen />;
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
              Defne&apos;s Premium Vault
            </h1>
            <p className="mt-1 text-sm text-pink-100/70">
              Signed in as{" "}
              <span className="font-bold text-pink-100">{sessionName}</span>
              <span className="ml-2 text-xs text-zinc-500">{currentHandle}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            {session.user?.image && (
              <div
                aria-label={`${sessionName} avatar`}
                className="h-9 w-9 rounded-full border border-pink-200/40 bg-cover bg-center shadow-[0_0_20px_rgba(236,72,153,0.25)]"
                style={{ backgroundImage: `url(${session.user.image})` }}
              />
            )}
            <div className="rounded-full border border-pink-300/30 bg-pink-500/10 px-3 py-1 text-sm font-semibold text-pink-100">
              SFW Prototype
            </div>
            <button
              className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-sm font-semibold text-zinc-200 transition hover:border-pink-300/40 hover:text-white"
              onClick={handleLogout}
              type="button"
            >
              Logout
            </button>
            <button
              className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                activePanel === "admin"
                  ? "border-pink-300/50 bg-pink-500/20 text-pink-50"
                  : "border-white/10 bg-white/[0.06] text-zinc-200 hover:border-pink-300/40 hover:text-white"
              }`}
              onClick={() => setActivePanel("admin")}
              type="button"
            >
              Admin
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
              <h2 className="mt-1 text-2xl font-black">Defne&apos;s Mood</h2>
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
            <TributePanel coins={coins} onTribute={handleTribute} />
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
            <TaskList tasks={tasks} onClaim={handleClaimTask} />
          )}
          {activePanel === "admin" && (
            <AdminConsole
              currentUsername={currentHandle}
              onAddCoins={handleAdminAddCoins}
            />
          )}
        </section>
      </div>
      <FloatingDefneBubble message={mistressReply} />
    </main>
  );
}
