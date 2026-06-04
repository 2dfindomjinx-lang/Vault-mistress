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

const DEBT_PET_NAMES = ["Velvet Pet", "Little Offering", "Vault Darling", "Debt Doll", "Owned Devotee"];
const DEBT_SIGNING_IMAGE_PATH = "/pet/debt-contract-signed.png";
const DEBT_DURATION_LIMITS = {
  monthly: { label: "Months", max: 24, min: 1 },
  weekly: { label: "Weeks", max: 52, min: 1 },
};
const DEBT_MINIMUM_PAYMENTS = {
  monthly: 50000,
  weekly: 10000,
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
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u00B4\u0060]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"');
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
  onDebtAutoPayChange,
  onPayDebtPeriod,
  onSignDebtContract,
  onFalseHopeKey,
  onFavorPick,
  onOpenCase,
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
  onConfessionSubmit: (value: string) => void;
  onCompleteTask: (taskId: string) => void;
  onDebtAutoPayChange: (enabled: boolean) => void;
  onPayDebtPeriod: () => void;
  onSignDebtContract: (form: {
    debtAmount: number;
    durationPeriods: number;
    periodType: "weekly" | "monthly";
    petName: string;
  }) => Promise<boolean> | boolean;
  onFalseHopeKey: (key: "a" | "d") => void;
  onFavorPick: (index: number) => void;
  onOpenCase: (caseItem: PetCaseItem) => void;
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
  const [showDebtSigningImage, setShowDebtSigningImage] = useState(false);
  const [falseHopeShaking, setFalseHopeShaking] = useState(false);
  const evilWaitFinishedRef = useRef(false);
  const onPetEvilWaitCompleteRef = useRef(onPetEvilWaitComplete);
  const onPetEvilWaitFailRef = useRef(onPetEvilWaitFail);
  const onFalseHopeKeyRef = useRef(onFalseHopeKey);
  const previousFalseHopeStageRef = useRef<number | null>(null);
  const isPetActionPending = (actionId: string) => pendingPetActionIds.includes(actionId);
  const rank = getPetRank(petScore);
  const approvedCount = tasks.filter((task) => task.status === "approved").length;
 const canClaimAffection = approvedCount >= 5 &&!petAffectionClaimed;
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
  const regularTasks = tasks.filter(
    (task) => task.kind !== "debt-contract" && task.kind !== "weekly-tax",
  );
  const evilWaitTask = tasks.find((task) => task.kind === "evil-wait");
  const falseHopeTask = tasks.find((task) => task.kind === "false-hope");

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
    const countdownOver =
      evilWaitTask?.waitState === "countdown" &&
      Boolean(evilWaitTask.waitCountdownEndsAt) &&
      new Date(evilWaitTask.waitCountdownEndsAt ?? "").getTime() <= Date.now();

    if (evilWaitTask?.waitState !== "waiting" && !countdownOver) {
      return;
    }

    evilWaitFinishedRef.current = false;
    const waitEndsAt = new Date(evilWaitTask.waitEndsAt ?? Date.now() + 120000).getTime();
    const fail = () => {
      if (evilWaitFinishedRef.current) {
        return;
      }

      evilWaitFinishedRef.current = true;
      onPetEvilWaitFailRef.current();
    };
    const interval = window.setInterval(() => {
      setEvilWaitRemaining(Math.max(0, Math.ceil((waitEndsAt - Date.now()) / 1000)));
    }, 250);
    const teaseInterval = window.setInterval(() => {
      setEvilTeaseIndex((value) => value + 1);
    }, 5000);
    const floatingTeaseInterval = window.setInterval(() => {
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
    let distractionTimer: number | null = null;
    const scheduleDistraction = () => {
      distractionTimer = window.setTimeout(() => {
        spawnDistraction();
        scheduleDistraction();
      }, getSpawnDelay());
    };
    scheduleDistraction();
    const timer = window.setTimeout(() => {
      if (evilWaitFinishedRef.current) {
        return;
      }

      evilWaitFinishedRef.current = true;
      setEvilDistractionBoxes([]);
      onPetEvilWaitCompleteRef.current();
    }, Math.max(0, waitEndsAt - Date.now()));
    const events: Array<keyof WindowEventMap> = [
      "click",
      "keydown",
      "mousedown",
      "mousemove",
      "scroll",
      "touchstart",
      "wheel",
    ];

    events.forEach((eventName) => window.addEventListener(eventName, fail));

    return () => {
      window.clearInterval(interval);
      window.clearInterval(teaseInterval);
      window.clearInterval(floatingTeaseInterval);
      if (distractionTimer !== null) {
        window.clearTimeout(distractionTimer);
      }
      window.clearTimeout(timer);
      events.forEach((eventName) => window.removeEventListener(eventName, fail));
      setEvilDistractionBoxes([]);
    };
  }, [evilWaitTask?.waitCountdownEndsAt, evilWaitTask?.waitEndsAt, evilWaitTask?.waitState]);

  useEffect(() => {
    if (evilWaitTask?.waitState !== "countdown") {
      return;
    }

    const delay = Math.max(0, new Date(evilWaitTask.waitCountdownEndsAt ?? Date.now() + 3000).getTime() - Date.now());
    const timer = window.setTimeout(() => {
      setEvilWaitRemaining(120);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [evilWaitTask?.waitCountdownEndsAt, evilWaitTask?.waitState]);

  function handlePerfectInput(value: string, sentence: string) {
    if (!writingPreviewStartsWith(sentence, value)) {
      setPerfectInput("");
      onPerfectWritingProgress(value);
      return;
    }

    setPerfectInput(value);
    onPerfectWritingProgress(value);

    if (value === sentence) {
      window.setTimeout(() => setPerfectInput(""), 0);
    }
  }

  async function handleDebtSign() {
    const signed = await onSignDebtContract({
      debtAmount: Number(debtAmount),
      durationPeriods: Number(debtDuration),
      periodType: debtPeriodType,
      petName: debtPetName,
    });

    if (signed) {
      setShowDebtSigningImage(true);
      if (debtSignTimerRef.current !== null) {
        window.clearTimeout(debtSignTimerRef.current);
      }
      debtSignTimerRef.current = window.setTimeout(() => setShowDebtSigningImage(false), 4500);
    }
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
              className="mt-4 w-full rounded-2xl border border-yellow-200/25 bg-yellow-500/15 px-4 py-3 text-sm font-black text-yellow-50 transition enabled:hover:border-yellow-200/55 enabled:hover:bg-yellow-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={weeklyTaxCoolingDown || coins < weeklyTaxCost || isPetActionPending("pet-weekly-throne-tax")}
              onClick={onPayWeeklyTax}
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
                        className="mt-auto w-full rounded-2xl border border-pink-200/25 bg-pink-500/15 px-4 py-3 text-sm font-black text-pink-50 transition enabled:hover:border-pink-200/55 enabled:hover:bg-pink-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={caseRolling || coolingDown || actionPending}
                        onClick={handleCaseOpen}
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
                        className="mt-auto w-full rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={coolingDown || actionPending || task.waitState === "countdown" || task.waitState === "waiting"}
                        onClick={onPetEvilWaitStart}
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
                      {falseHopeShaking && (
                        <p className="mt-3 rounded-2xl border border-pink-200/25 bg-pink-500/10 px-3 py-2 text-sm font-black text-pink-50">
                          So close. Did you really think it would be that easy?
                        </p>
                      )}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(["a", "d"] as const).map((key) => (
                          <button
                            className="rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black uppercase text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={coolingDown}
                            key={key}
                            onClick={() => onFalseHopeKey(key)}
                            type="button"
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {task.kind === "favor-roulette" && (
                    <div className="mt-auto rounded-2xl border border-pink-200/15 bg-black/35 p-3">
                      <div className="grid grid-cols-5 gap-2">
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
                              className={`min-h-16 rounded-xl border px-2 py-3 transition sm:min-h-24 sm:rounded-2xl ${
                                picked && task.favorResult === "win"
                                  ? "border-yellow-200/70 bg-yellow-300/15 shadow-[0_0_24px_rgba(250,204,21,0.35)]"
                                  : picked
                                    ? "border-pink-200/45 bg-pink-500/15"
                                    : revealed
                                      ? "border-white/10 bg-black/45"
                                      : "border-pink-200/20 bg-[linear-gradient(145deg,rgba(236,72,153,0.2),rgba(88,28,135,0.24))] hover:border-pink-200/55"
                              } ${favorRevealing && picked ? "scale-105" : ""}`}
                              disabled={coolingDown || revealed || actionPending}
                              key={index}
                              onClick={() => handleFavorPick(index)}
                              type="button"
                            >
                              <span className="sr-only">{revealed ? label : `Hidden card ${index + 1}`}</span>
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

                  {task.kind === "review" && (
                    <button
                      className="mt-auto w-full rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={coolingDown || pending || actionPending}
                      onClick={() => onCompleteTask(task.id)}
                      type="button"
                    >
                      {actionPending ? "Saving..." : pending ? "Pending Review" : coolingDown ? "Cooldown" : "Submit for Review"}
                    </button>
                  )}
                </article>
              );
            })}
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
                    <label className="flex items-center justify-between gap-3">
                      <span>Auto payment</span>
                      <input
                        checked={isDebtAutoPayEnabled}
                        className="h-4 w-4 accent-red-500"
                        onChange={(event) => onDebtAutoPayChange(event.target.checked)}
                        type="checkbox"
                      />
                    </label>
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
                  <p className="rounded-2xl border border-yellow-200/20 bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-50/80">
                    Auto payment is off by default. Missed debt is still collected automatically
                    after the payment window is missed, and coin balance may go below zero. Debt
                    contracts can only be removed by admin.
                  </p>
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-red-200/15 bg-black/35 px-3 py-3 text-xs font-bold text-red-50/85">
                    <span>Auto payment</span>
                    <input
                      checked={isDebtAutoPayEnabled}
                      className="h-4 w-4 accent-red-500"
                      onChange={(event) => onDebtAutoPayChange(event.target.checked)}
                      type="checkbox"
                    />
                  </label>
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
