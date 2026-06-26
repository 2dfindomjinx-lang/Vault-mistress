import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { CoinAmount } from "@/components/CoinAmount";
import { DisplayNameWithUsername } from "@/components/DisplayNameWithUsername";
import {
  getIrlTaskWheelSegments,
  IRL_TASK_WHEEL_COST,
  isFreeTaskFriday,
} from "@/lib/irl-task-wheel";
import { JACKPOT_MIN_CONTRIBUTION, type LoyaltyJackpotState } from "@/lib/jackpot";
import { CASE_OPEN_REWARD_WEIGHTS } from "@/lib/server-task-actions";
import { emitSoundEvent } from "@/lib/sound";
import type { MechanicsState, TaskItem } from "@/lib/types";

const SACRIFICE_COST = 250;
const SUPPORT_COST = 2500;
const JACKPOT_HIDE_CONTRIBUTORS_STORAGE_KEY = "vault:jackpot-hide-contributors";
const CLICKABLE_COOLDOWN_BUTTON_CLASS =
  "cursor-not-allowed border-pink-400/35 bg-pink-950/55 text-zinc-500 shadow-none hover:border-pink-400/35 hover:bg-pink-950/55";
const CLICKABLE_COOLDOWN_TILE_CLASS = "cursor-not-allowed opacity-70";
const MOVEMENT_STAGE_IMAGES = [
  { min: 99, src: "/tasks/daily-motion/motion-99.png" },
  { min: 75, src: "/tasks/daily-motion/motion-75.png" },
  { min: 50, src: "/tasks/daily-motion/motion-50.png" },
  { min: 25, src: "/tasks/daily-motion/motion-25.png" },
  { min: 0, src: "/tasks/daily-motion/motion-0.png" },
];
const MOVEMENT_COMPLETE_IMAGE = "/tasks/daily-motion/motion-complete.png";
const MOVEMENT_STROKE_DISTANCE_PX = 80;
const LEVEL_DRAIN_IMAGE_PATH = "/pet/level-drain-principessa.png?v=2";
const GMT3_OFFSET_MS = 3 * 60 * 60 * 1000;
const CASE_OPEN_REEL_ITEM_WIDTH = 88;
const CASE_OPEN_REEL_ITEM_GAP = 10;
const CASE_OPEN_REEL_VISIBLE_COUNT = 5;
const CASE_OPEN_REEL_LANDING_INDEX = 24;
const CASE_OPEN_REEL_TAPE_LENGTH = 32;

function pickCaseOpenReward() {
  const totalWeight = CASE_OPEN_REWARD_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of CASE_OPEN_REWARD_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.value;
    }
  }

  return CASE_OPEN_REWARD_WEIGHTS[CASE_OPEN_REWARD_WEIGHTS.length - 1]?.value ?? 100;
}

function buildCaseOpenTape(finalReward: number) {
  const tape = Array.from({ length: CASE_OPEN_REEL_TAPE_LENGTH }, () => pickCaseOpenReward());
  tape[CASE_OPEN_REEL_LANDING_INDEX] = finalReward;

  for (let index = Math.max(0, CASE_OPEN_REEL_LANDING_INDEX - 2); index <= CASE_OPEN_REEL_LANDING_INDEX + 1; index += 1) {
    if (index !== CASE_OPEN_REEL_LANDING_INDEX && index < tape.length) {
      tape[index] = pickCaseOpenReward();
    }
  }

  return tape;
}

function getNextGmt3MonthlyResetMs(now: number) {
  if (now <= 0) {
    return 0;
  }

  const shifted = new Date(now + GMT3_OFFSET_MS);
  const nextResetUtc =
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1, 0, 0, 0) -
    GMT3_OFFSET_MS;

  return Math.max(0, nextResetUtc - now);
}

function isTaskKind(kind: TaskItem["kind"], expected: TaskItem["kind"]): boolean {
  return kind === expected;
}

function isGroupedWheelLayoutKind(kind: TaskItem["kind"]): boolean {
  return kind === "wait-obediently" || kind === "irl-wheel";
}

function isHiddenClaimedOneTimeTask(task: TaskItem) {
  return task.kind === "claim" && task.claimed && task.id !== "daily-login";
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

function getMovementStageImage(progress: number) {
  return MOVEMENT_STAGE_IMAGES.find((image) => progress >= image.min)?.src ?? MOVEMENT_STAGE_IMAGES[0].src;
}

function getMovementLastResult(task: TaskItem) {
  if (task.movementOutcome === "success") {
    return "Last result: completed successfully.";
  }

  if (task.movementOutcome === "fake_hope") {
    return "Last result: fake hope denial.";
  }

  if (task.movementOutcome === "instant_denial") {
    return "Last result: instant denial.";
  }

  if (task.movementState === "failed") {
    return "Last result: failed.";
  }

  if (task.movementState === "completed") {
    return "Last result: completed.";
  }

  return null;
}

function CooldownButtonContent({ label }: { label: string }) {
  return (
    <span>{label}</span>
  );
}

type TaskListProps = {
  coins: number;
  disabled?: boolean;
  mechanics: MechanicsState;
  tasks: TaskItem[];
  pendingTaskActionIds?: string[];
  isJackpotBusy?: boolean;
  jackpot: LoyaltyJackpotState | null;
  jackpotError?: string;
  currentUsername?: string;
  usernameStyle?: CSSProperties;
  globalPrincipessaLevel: number;
  globalPrincipessaProgressPercent: number;
  globalPrincipessaRequirement: number | null;
  globalPrincipessaXp: number;
  userLevel: number;
  userLevelProgressPercent: number;
  userXpIntoLevel: number;
  userXpRequiredForNext: number | null;
  onBeg: () => void;
  onClaim: (taskId: string) => void;
  onCaseOpen: () => Promise<number | null> | number | null;
  onJackpotContribute: (amount: number) => void;
  onLevelDrain: () => void;
  onIrlTaskSpin: (wheelIndex: number, useFreeFridaySpin?: boolean) => Promise<void> | void;
  onFreeFridaySpinConsumed?: () => void;
  onNumberPick: (selectedNumber: number) => void;
  onMovementFail: () => void;
  onMovementFinishFakeHope: () => void;
  onMovementProgress: (progress: number) => void;
  onMovementStart: () => void;
  onCooldownAttempt?: (message: string) => void;
  onSacrifice: () => void;
  onSupport: () => void;
  onTimeoutRisk: (multiplier: number) => void;
  onTimeoutRiskMultiplierChange: (direction: "up" | "down") => void;
  onTypingProgress: (value: string) => void;
  timeoutRiskChance: number;
  timeoutRiskEffectiveDays: number;
  timeoutRiskMaxDays: number;
  timeoutRiskTimeoutHours: number;
  timeoutRiskReward: number;
  onWaitObedientlyComplete: () => void;
  onWaitObedientlyFail: () => void;
  onWaitObedientlyStart: () => void;
  isFreeFridaySpinAvailable?: boolean;
};

export function TaskList({
  coins,
  disabled = false,
  isJackpotBusy = false,
  jackpot,
  jackpotError = "",
  currentUsername,
  globalPrincipessaLevel,
  globalPrincipessaProgressPercent,
  globalPrincipessaRequirement,
  globalPrincipessaXp,
  mechanics,
  onBeg,
  onClaim,
  onCaseOpen,
  onJackpotContribute,
  onLevelDrain,
  onIrlTaskSpin,
  onFreeFridaySpinConsumed,
  onNumberPick,
  onMovementFail,
  onMovementFinishFakeHope,
  onMovementProgress,
  onMovementStart,
  onCooldownAttempt,
  pendingTaskActionIds = [],
  onSacrifice,
  onSupport,
  onTimeoutRisk,
  onTimeoutRiskMultiplierChange,
  onTypingProgress,
  timeoutRiskChance,
  timeoutRiskEffectiveDays,
  timeoutRiskMaxDays,
  timeoutRiskTimeoutHours,
  timeoutRiskReward,
  userLevel,
  userLevelProgressPercent,
  userXpIntoLevel,
  userXpRequiredForNext,
  onWaitObedientlyComplete,
  onWaitObedientlyFail,
  onWaitObedientlyStart,
  isFreeFridaySpinAvailable = false,
  tasks,
  usernameStyle,
}: TaskListProps) {
  const [now, setNow] = useState(0);
  const [typingValue, setTypingValue] = useState("");
  const [stake, setStake] = useState(10);
  const [irlWheelRotation, setIrlWheelRotation] = useState(0);
  const [isIrlWheelSpinning, setIsIrlWheelSpinning] = useState(false);
  const [showIrlTaskList, setShowIrlTaskList] = useState(false);
  const [movementDisplayProgress, setMovementDisplayProgress] = useState(0);
  const [movementIdleRemaining, setMovementIdleRemaining] = useState(4);
  const [movementLastInputAt, setMovementLastInputAt] = useState(0);
  const [movementLastY, setMovementLastY] = useState<number | null>(null);
  const [movementLocalActive, setMovementLocalActive] = useState(false);
  const [movementDirection, setMovementDirection] = useState<"down" | "up" | null>(null);
  const [movementTravel, setMovementTravel] = useState(0);
  const [caseOpenPhase, setCaseOpenPhase] = useState<"idle" | "rolling">("idle");
  const [caseOpenTape, setCaseOpenTape] = useState<number[]>([]);
  const [caseOpenOffset, setCaseOpenOffset] = useState(0);
  const [caseOpenAnimating, setCaseOpenAnimating] = useState(false);
  const [caseOpenResolvedReward, setCaseOpenResolvedReward] = useState<number | null>(null);
  const irlWheelTimerRef = useRef<number | null>(null);
  const caseOpenTimerRef = useRef<number | null>(null);
  const caseOpenSoundTimerRefs = useRef<number[]>([]);
  const isTaskActionPending = useCallback(
    (actionId: string) => pendingTaskActionIds.includes(actionId),
    [pendingTaskActionIds],
  );
  const monthlyResetRemaining = getNextGmt3MonthlyResetMs(now);
  const isClaimPending = (taskId: string) => isTaskActionPending(`claim:${taskId}`);
  const isCaseOpenPending = isTaskActionPending("case-opening");
  const clearCaseOpenSoundTimers = useCallback(() => {
    caseOpenSoundTimerRefs.current.forEach((timer) => window.clearTimeout(timer));
    caseOpenSoundTimerRefs.current = [];
  }, []);
  const startCaseOpenSoundTicks = useCallback(() => {
    clearCaseOpenSoundTimers();

    let soundTick = 0;
    const maxSoundTicks = 42;

    const scheduleSoundTick = (delay: number) => {
      const timer = window.setTimeout(() => {
        if (soundTick >= maxSoundTicks) {
          return;
        }

        emitSoundEvent("crate_reel_tick");
        soundTick += 1;

        if (soundTick < maxSoundTicks) {
          const progress = soundTick / maxSoundTicks;
          const nextDelay = Math.floor(38 + (240 - 38) * Math.pow(progress, 1.7));
          scheduleSoundTick(nextDelay);
        }
      }, delay);

      caseOpenSoundTimerRefs.current.push(timer);
    };

    scheduleSoundTick(38);
  }, [clearCaseOpenSoundTimers]);
  const handleCooldownAttempt = (message: string) => {
    emitSoundEvent("button_click");
    onCooldownAttempt?.(message);
  };

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      if (irlWheelTimerRef.current) {
        window.clearTimeout(irlWheelTimerRef.current);
      }
      if (caseOpenTimerRef.current) {
        window.clearTimeout(caseOpenTimerRef.current);
      }
      clearCaseOpenSoundTimers();
    };
  }, [clearCaseOpenSoundTimers]);

  const movementTask = tasks.find((task) => task.kind === "movement");
  const caseOpenSlotSize = CASE_OPEN_REEL_ITEM_WIDTH + CASE_OPEN_REEL_ITEM_GAP;
  const caseOpenTrackSidePadding = `calc(50% - ${CASE_OPEN_REEL_ITEM_WIDTH / 2}px)`;
  const caseOpenPreviewValues = useMemo(
    () => {
      const weightCount = CASE_OPEN_REWARD_WEIGHTS.length;
      if (weightCount === 0) {
        return [100, 250, 250, 500, 500];
      }

      const visibleCount = Math.max(1, CASE_OPEN_REEL_VISIBLE_COUNT);
      return Array.from({ length: visibleCount }, (_, index) => {
        const normalizedIndex =
          visibleCount === 1
            ? 0
            : Math.round((index / (visibleCount - 1)) * (weightCount - 1));
        return CASE_OPEN_REWARD_WEIGHTS[normalizedIndex]?.value ?? 100;
      });
    },
    [],
  );

  useEffect(() => {
    if (movementTask?.movementState !== "fake_hope" || !movementTask.movementFailAt) {
      return;
    }

    const remaining = Math.max(0, 10000 - (Date.now() - new Date(movementTask.movementFailAt).getTime()));
    const timer = window.setTimeout(() => {
      onMovementFinishFakeHope();
    }, remaining);

    return () => window.clearTimeout(timer);
  }, [movementTask?.movementFailAt, movementTask?.movementState, onMovementFinishFakeHope]);

  useEffect(() => {
    if (movementTask?.movementState === "completed" || movementTask?.movementState === "failed" || movementTask?.cooldownUntil) {
      const timer = window.setTimeout(() => {
        setMovementLocalActive(false);
        setMovementLastInputAt(0);
        setMovementLastY(null);
        setMovementDirection(null);
        setMovementTravel(0);
        setMovementIdleRemaining(4);
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [movementTask?.cooldownUntil, movementTask?.movementState]);

  useEffect(() => {
    const task = movementTask;
    const movementResolved =
      isTaskActionPending("vertical-motion") ||
      task?.movementState === "failed" ||
      task?.movementState === "completed" ||
      Boolean(task?.cooldownUntil);
    const movementActive =
      !movementResolved &&
      (movementLocalActive || task?.movementState === "active" || task?.movementState === "fake_hope");

    if (!task || !movementActive) {
      return;
    }

    const timer = window.setInterval(() => {
      setMovementIdleRemaining((value) => Math.max(0, value - 0.25));
    }, 250);

    return () => window.clearInterval(timer);
  }, [isTaskActionPending, movementLocalActive, movementTask]);

  useEffect(() => {
    const movementActive =
      movementLocalActive ||
      movementTask?.movementState === "active" ||
      movementTask?.movementState === "fake_hope";

    if (!movementActive || movementIdleRemaining > 0 || isTaskActionPending("vertical-motion")) {
      return;
    }

    const timer = window.setTimeout(() => {
      setMovementLocalActive(false);
      onMovementFail();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isTaskActionPending, movementIdleRemaining, movementLocalActive, movementTask?.movementState, onMovementFail]);

  const handleIrlWheelSpinClick = () => {
    if (disabled || isIrlWheelSpinning) {
      return;
    }

    emitSoundEvent("button_click");

    const isFreeFridayEventActive = isFreeTaskFriday(now);
    const useFreeFridaySpin = isFreeFridayEventActive && isFreeFridaySpinAvailable;
    const wheelSegments = getIrlTaskWheelSegments(isFreeFridayEventActive);
    const selectedIndex = Math.floor(Math.random() * wheelSegments.length);
    const segmentDegrees = 360 / wheelSegments.length;
    const selectedCenter = selectedIndex * segmentDegrees + segmentDegrees / 2;
    const currentRotation = ((irlWheelRotation % 360) + 360) % 360;
    const targetRotation = (360 - selectedCenter) % 360;
    const rotationDelta = (targetRotation - currentRotation + 360) % 360;
    const finalRotation = irlWheelRotation + 360 * 6 + rotationDelta;

    setIsIrlWheelSpinning(true);
    setIrlWheelRotation(finalRotation);
    if (useFreeFridaySpin) {
      onFreeFridaySpinConsumed?.();
    }

    if (irlWheelTimerRef.current) {
      window.clearTimeout(irlWheelTimerRef.current);
    }

    irlWheelTimerRef.current = window.setTimeout(() => {
      void Promise.resolve(onIrlTaskSpin(selectedIndex, useFreeFridaySpin)).finally(() => {
        setIsIrlWheelSpinning(false);
      });
    }, 3600);
  };

  const formatRemaining = (milliseconds: number) => {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
  };

  const handleMovementInput = (clientY: number, task: TaskItem, inputAt: number) => {
    if (
      disabled ||
      isTaskActionPending("vertical-motion") ||
      task.movementState === "completed" ||
      task.movementState === "failed" ||
      task.movementState === "fake_hope" ||
      Boolean(task.cooldownUntil)
    ) {
      return;
    }

    if (!movementLocalActive && task.movementState !== "active") {
      return;
    }

    const lastY = movementLastY;
    const lastInputAt = movementLastInputAt || inputAt;
    setMovementLastY(clientY);
    setMovementLastInputAt(inputAt);

    if (lastY === null) {
      return;
    }

    const signedDelta = clientY - lastY;
    const delta = Math.abs(signedDelta);
    const elapsed = Math.max(1, inputAt - lastInputAt);
    const velocity = delta / elapsed;

    if (delta < 24 || velocity < 0.16) {
      return;
    }

    const direction = signedDelta > 0 ? "down" : "up";
    const nextTravel = movementDirection === direction ? movementTravel + delta : delta;

    setMovementDirection(direction);
    setMovementTravel(nextTravel);

    if (nextTravel < MOVEMENT_STROKE_DISTANCE_PX) {
      return;
    }

    setMovementTravel(0);
    setMovementIdleRemaining(4);
    const baseProgress = Math.max(movementDisplayProgress, task.movementProgress ?? 0);
    const nextProgress = Math.min(100, baseProgress + 1);
    setMovementDisplayProgress(nextProgress);

    if (nextProgress >= 99) {
      setMovementLocalActive(false);
      resetMovementPointer();

      onMovementProgress(nextProgress);
    }
  };

  const resetMovementPointer = () => {
    setMovementLastInputAt(0);
    setMovementLastY(null);
    setMovementDirection(null);
    setMovementTravel(0);
  };

  const handleMovementPointerDown = (clientY: number, inputAt: number) => {
    setMovementLastInputAt(inputAt);
    setMovementLastY(clientY);
  };

  const resetMovementAttempt = (task: TaskItem) => {
    setMovementLastY(null);
    setMovementDisplayProgress(task.movementProgress ?? 0);
    setMovementLastInputAt(0);
    setMovementIdleRemaining(4);
    setMovementLocalActive(true);
    setMovementDirection(null);
    setMovementTravel(0);
  };

  const renderStatus = (task: TaskItem, isCoolingDown: boolean) => (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        isCoolingDown
          ? "bg-yellow-400/15 text-yellow-100"
          : task.kind === "irl-wheel" && task.assignedIrlTask
            ? "bg-yellow-400/15 text-yellow-100"
          : task.completed
            ? "bg-pink-500/20 text-pink-100"
            : "bg-emerald-400/15 text-emerald-100"
      }`}
    >
      {isCoolingDown
        ? "Cooldown"
        : task.kind === "irl-wheel" && task.assignedIrlTask
          ? "Pending Review"
          : task.kind === "timeout-risk"
            ? "Risk"
          : task.kind === "wait-obediently" && task.waitState === "countdown"
            ? "Countdown"
          : task.kind === "wait-obediently" && task.waitState === "waiting"
            ? "Waiting"
          : task.kind === "wait-obediently" && task.waitState === "failed"
            ? "Failed"
          : task.kind === "movement" && task.movementState === "fake_hope"
            ? "Almost"
          : task.kind === "movement" && task.movementState === "failed"
            ? "Failed"
          : task.kind === "case-open"
            ? "Open"
          : task.claimed
            ? "Claimed"
            : task.completed
              ? "Ready"
              : "Open"}
    </span>
  );
  const visibleTasks = tasks.filter(
    (task) => !isHiddenClaimedOneTimeTask(task) && !task.id.startsWith("streak-bonus-"),
  );
  const isFreeFridayEventActive = isFreeTaskFriday(now);
  const wheelSegments = getIrlTaskWheelSegments(isFreeFridayEventActive);
  const isFreeFriday = isFreeFridayEventActive && isFreeFridaySpinAvailable;

  return (
    <section className="min-w-0 rounded-[2rem] border border-fuchsia-200/15 bg-black/50 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-pink-200/70">
          Tasks & Games
        </p>
        <h2 className="text-3xl font-black">Play the Vault</h2>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MechanicCard
          actionLabel="Beg"
          cooldownUntil={mechanics.begCooldownUntil}
          description="Ask for a tiny mercy. Most pleas are ignored; rarely, the vault drops 75 coins."
          disabled={disabled || isTaskActionPending("beg")}
          onAction={onBeg}
          onCooldownAttempt={handleCooldownAttempt}
          title="Beg"
          now={now}
          formatRemaining={formatRemaining}
        />
        <MechanicCard
          actionLabel={
            mechanics.sacrificeComplete
              ? "Collection Complete"
              : `Sacrifice ${SACRIFICE_COST} Coins`
          }
          cooldownUntil={mechanics.sacrificeCooldownUntil}
          description={`Burn ${SACRIFICE_COST} coins for a 50% chance to unlock a hidden Sacrifice Collection image. ${mechanics.sacrificeUnlockedCount}/${mechanics.sacrificeTotal} unlocked.`}
          disabled={disabled || isTaskActionPending("sacrifice") || mechanics.sacrificeComplete || coins < SACRIFICE_COST}
          lastResult={mechanics.sacrificeLastResult}
          onCooldownAttempt={handleCooldownAttempt}
          onAction={onSacrifice}
          title="Sacrifice"
          now={now}
          formatRemaining={formatRemaining}
        />
        <MechanicCard
          actionLabel={`Support ${SUPPORT_COST} Coins`}
          description={
            mechanics.supportUnlocked
              ? `Spend ${SUPPORT_COST} coins for a special dialogue moment. More rewards can be attached later.`
              : "Unlock every normal and Sacrifice Collection image to open this endgame mechanic."
          }
          disabled={disabled || isTaskActionPending("support") || !mechanics.supportUnlocked || coins < SUPPORT_COST}
          lastResult={mechanics.supportLastResult}
          onAction={onSupport}
          title="Support"
          now={now}
          formatRemaining={formatRemaining}
        />
      </div>

      <article className="mt-5 overflow-hidden rounded-[1.5rem] border border-pink-200/15 bg-[radial-gradient(circle_at_85%_20%,rgba(236,72,153,0.22),transparent_34%),linear-gradient(145deg,rgba(88,28,135,0.32),rgba(0,0,0,0.42))] p-4 shadow-[0_0_30px_rgba(236,72,153,0.12)]">
        <div className="grid gap-4 lg:grid-cols-[minmax(12rem,0.42fr)_minmax(0,1fr)] lg:items-stretch">
              <div className="mx-auto flex w-full max-w-[18rem] flex-col gap-2">
                <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[1.25rem] border border-pink-200/20 bg-black/45">
                  <Image
                    alt="Level Drain Principessa"
                    className="object-contain object-center opacity-90"
                    fill
                    sizes="280px"
                    src={LEVEL_DRAIN_IMAGE_PATH}
                    unoptimized
                  />
                </div>
                <div className="rounded-2xl border border-pink-100/25 bg-black/55 px-3 py-2 text-center shadow-[0_0_18px_rgba(236,72,153,0.22)] backdrop-blur">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-pink-100/65">
                    Principessa
                  </p>
                  <p className="text-base font-black text-white">Level {globalPrincipessaLevel}</p>
                </div>
              </div>
          <div className="flex min-w-0 flex-col">
            <p className="text-xs uppercase tracking-[0.24em] text-pink-200/70">
              Level Drain
            </p>
            <h3 className="mt-1 text-xl font-black text-white">Strengthen Principessa</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Sacrifice all current user XP at once. A quarter of the drained amount becomes Principessa XP.
            </p>
            <p className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-100">
              Monthly reset in {formatRemaining(monthlyResetRemaining)}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
                <div className="flex items-center justify-between text-sm font-bold text-pink-50">
                  <span>User Level {userLevel}</span>
                  <span>
                    {userXpRequiredForNext === null
                      ? "MAX"
                      : `${Math.floor(userXpIntoLevel).toLocaleString()} / ${userXpRequiredForNext.toLocaleString()} XP`}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/70">
                  <div className="h-full rounded-full bg-pink-400" style={{ width: `${userLevelProgressPercent}%` }} />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
                <div className="flex items-center justify-between text-sm font-bold text-fuchsia-50">
                  <span>Principessa Level {globalPrincipessaLevel}</span>
                  <span>
                    {globalPrincipessaRequirement === null
                      ? "MAX"
                      : `${globalPrincipessaXp.toLocaleString()} / ${globalPrincipessaRequirement.toLocaleString()} XP`}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/70">
                  <div className="h-full rounded-full bg-fuchsia-400" style={{ width: `${globalPrincipessaProgressPercent}%` }} />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <button
                className="w-full max-w-sm rounded-xl border border-pink-200/25 bg-pink-500/15 px-5 py-2 text-xs font-black uppercase tracking-[0.16em] text-pink-50 transition enabled:hover:border-pink-200/55 enabled:hover:bg-pink-500/25 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-56"
                disabled={disabled || userLevel < 2 || isTaskActionPending("level-drain")}
                onClick={() => {
                  emitSoundEvent("button_click");
                  onLevelDrain();
                }}
                type="button"
              >
                {isTaskActionPending("level-drain")
                  ? "Draining..."
                  : userLevel < 2
                    ? "Requires L2"
                    : "Drain All Your XP"}
              </button>
            </div>
          </div>
        </div>
      </article>

      <LoyaltyJackpotTaskCard
        coins={coins}
        disabled={disabled}
        error={jackpotError}
        isBusy={isJackpotBusy}
        jackpot={jackpot}
        currentUsername={currentUsername}
        now={now}
        onContribute={onJackpotContribute}
        usernameStyle={usernameStyle}
      />

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {visibleTasks.map((task) => {
          const isTimeoutRisk = task.kind === "timeout-risk";
          const cooldownRemaining = task.cooldownUntil
            ? new Date(task.cooldownUntil).getTime() - now
            : 0;
          const isCoolingDown = cooldownRemaining > 0;
          const isClaimable =
            task.kind === "claim" &&
            task.completed &&
            !isCoolingDown &&
            (!task.claimed || task.id === "daily-login");

          if (isTaskKind(task.kind, "timeout-risk")) {
            const waitTask = tasks.find((entry) => entry.kind === "wait-obediently");
            const irlTask = tasks.find((entry) => entry.kind === "irl-wheel");
            const waitCooldownRemaining = waitTask?.cooldownUntil
              ? new Date(waitTask.cooldownUntil).getTime() - now
              : 0;
            const isWaitCoolingDown = waitCooldownRemaining > 0;
            const irlCooldownRemaining = irlTask?.cooldownUntil
              ? new Date(irlTask.cooldownUntil).getTime() - now
              : 0;
            const isIrlCoolingDown = irlCooldownRemaining > 0;
            const irlWheelNeedsCoins = !isFreeFriday && coins < IRL_TASK_WHEEL_COST;
            const timeoutRiskLastResult =
              task.lastResult && !task.lastResult.startsWith("Safe wins today:")
                ? task.lastResult
                : null;

            return (
              <div
                className="min-w-0 grid gap-3 md:col-span-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)] lg:items-stretch"
                key="risk-wheel-layout"
              >
                <div className="flex min-h-full min-w-0 flex-col gap-3">
                  <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-black text-white">{task.title}</h3>
                        <p className="mt-1 text-sm text-zinc-400">
                          Reward: {task.reward} Principessa Coins
                        </p>
                      </div>
                      {renderStatus(task, false)}
                    </div>
                    <div className="mt-4 rounded-2xl border border-yellow-200/20 bg-[linear-gradient(145deg,rgba(250,204,21,0.12),rgba(236,72,153,0.08),rgba(0,0,0,0.4))] p-3">
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-100/70">
                            Risk Multiplier
                          </p>
                          <p className="mt-1 text-sm font-black text-white">
                            {task.timeoutRiskMultiplier ?? 1}x reward / timeout
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-black text-white transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={disabled || (task.timeoutRiskMultiplier ?? 1) <= 1}
                            onClick={() => onTimeoutRiskMultiplierChange("down")}
                            type="button"
                          >
                            ↓
                          </button>
                          <button
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-black text-white transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={disabled || (task.timeoutRiskMultiplier ?? 1) >= 3}
                            onClick={() => onTimeoutRiskMultiplierChange("up")}
                            type="button"
                          >
                            ↑
                          </button>
                        </div>
                      </div>
                      <p className="text-sm leading-6 text-zinc-300">
                        Risk is chance-based: {Math.round(timeoutRiskChance * 100)}% chance
                        to receive {timeoutRiskTimeoutHours * (task.timeoutRiskMultiplier ?? 1)} hours timeout,{" "}
                        {Math.round((1 - timeoutRiskChance) * 100)}% chance to win{" "}
                        {timeoutRiskReward * (task.timeoutRiskMultiplier ?? 1)} Principessa Coins.
                      </p>
                      {task.timeoutUntil && new Date(task.timeoutUntil).getTime() > now && (
                        <p className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-100">
                          Current timeout:{" "}
                          {formatRemaining(new Date(task.timeoutUntil).getTime() - now)}
                        </p>
                      )}
                      <p className="mt-3 text-xs leading-5 text-zinc-500">
                        Partial remaining days count as full days. Maximum effective timeout is{" "}
                        {timeoutRiskMaxDays} day.
                      </p>
                      <p className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-pink-50">
                        Safe wins today: {task.safeWinsToday ?? 0}/{2}
                      </p>
                      {timeoutRiskLastResult && (
                        <p className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-pink-50">
                          {timeoutRiskLastResult}
                        </p>
                      )}
                      {task.completed && (
                        <p className="mt-3 rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100">
                          Daily safe win limit reached. Come back tomorrow.
                        </p>
                      )}
                      {isCoolingDown && (
                        <p className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-100">
                          Available again in {formatRemaining(cooldownRemaining)}
                        </p>
                      )}
                      <button
                        aria-disabled={isCoolingDown || undefined}
                        className={`mt-3 w-full rounded-2xl border border-yellow-200/25 bg-yellow-400/10 px-4 py-3 text-sm font-black text-yellow-50 transition enabled:hover:border-yellow-100/60 enabled:hover:bg-yellow-400/20 disabled:cursor-not-allowed disabled:opacity-40 ${
                          isCoolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
                        }`}
                        disabled={disabled || task.completed || isTaskActionPending("timeout-risk") || timeoutRiskEffectiveDays > timeoutRiskMaxDays}
                        onClick={() => {
                          emitSoundEvent("button_click");
                          if (isCoolingDown) {
                            onCooldownAttempt?.(`Cooldown active. Available again in ${formatRemaining(cooldownRemaining)}.`);
                            return;
                          }

                          onTimeoutRisk(task.timeoutRiskMultiplier ?? 1);
                        }}
                        type="button"
                      >
                        {task.completed
                          ? "Daily limit reached"
                          : timeoutRiskEffectiveDays > timeoutRiskMaxDays
                            ? "Maximum timeout reached."
                            : "Attempt Risk"}
                      </button>
                    </div>
                  </article>

                  {waitTask && (
                    <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-black text-white">{waitTask.title}</h3>
                          <p className="mt-1 text-sm text-zinc-400">
                            Reward: {waitTask.reward} Principessa Coins
                          </p>
                          {isWaitCoolingDown && (
                            <p className="mt-2 text-sm font-semibold text-pink-100">
                              Available again in {formatRemaining(waitCooldownRemaining)}
                            </p>
                          )}
                          {disabled && (
                            <p className="mt-2 text-sm font-semibold text-yellow-100">
                              Timeout active. This task is locked.
                            </p>
                          )}
                        </div>
                        {renderStatus(waitTask, isWaitCoolingDown)}
                      </div>
                      <WaitObedientlyPanel
                        cooldownRemaining={waitCooldownRemaining}
                        formatRemaining={formatRemaining}
                        isCoolingDown={isWaitCoolingDown}
                        isGloballyDisabled={disabled}
                        isActionPending={isTaskActionPending("wait-obediently")}
                        onComplete={onWaitObedientlyComplete}
                        onCooldownAttempt={handleCooldownAttempt}
                        onFail={onWaitObedientlyFail}
                        onStart={onWaitObedientlyStart}
                        task={waitTask}
                      />
                    </article>
                  )}
                </div>

                {irlTask && (
                  <article className="flex min-h-full flex-col rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-black text-white">{irlTask.title}</h3>
                        {isIrlCoolingDown && (
                          <p className="mt-2 text-sm font-semibold text-pink-100">
                            Available again in {formatRemaining(irlCooldownRemaining)}
                          </p>
                        )}
                        {disabled && (
                          <p className="mt-2 text-sm font-semibold text-yellow-100">
                            Timeout active. This task is locked.
                          </p>
                        )}
                      </div>
                      {renderStatus(irlTask, isIrlCoolingDown)}
                    </div>
                    <div className="mt-4 flex flex-1 flex-col rounded-2xl border border-pink-200/15 bg-black/35 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <p className="text-sm leading-6 text-zinc-400">
                        {isFreeFridayEventActive
                          ? "Free Task Friday: one IRL wheel spin is free today."
                          : `Spin the wheel for ${IRL_TASK_WHEEL_COST} Principessa Coins. The result becomes your assigned IRL task.`}
                        </p>
                        <button
                          className="shrink-0 rounded-full border border-pink-200/20 bg-pink-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-pink-50 transition hover:border-pink-300/60 hover:bg-pink-500/20"
                          onClick={() => {
                            emitSoundEvent("button_click");
                            setShowIrlTaskList(true);
                          }}
                          type="button"
                        >
                          Task List
                        </button>
                      </div>
                      <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.14),rgba(0,0,0,0.5))] p-4">
                        {showIrlTaskList ? (
                          <IrlTaskWheelTaskList
                            onClose={() => setShowIrlTaskList(false)}
                            tasks={wheelSegments}
                          />
                        ) : (
                          <WheelSpinner
                            rotation={irlWheelRotation}
                            selectedIndex={irlTask.assignedIrlWheelIndex ?? null}
                            segmentCount={wheelSegments.length}
                            spinning={isIrlWheelSpinning}
                          />
                        )}
                      </div>
                      {irlTask.timeoutUntil && new Date(irlTask.timeoutUntil).getTime() > now && (
                        <p className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-100">
                          Timeout active:{" "}
                          {formatRemaining(new Date(irlTask.timeoutUntil).getTime() - now)}
                        </p>
                      )}
                      {irlTask.assignedIrlTask && (
                        <div className="mt-3 rounded-2xl border border-pink-200/25 bg-pink-500/10 px-3 py-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-200/70">
                            Assigned Task
                          </p>
                          {typeof irlTask.assignedIrlWheelIndex === "number" && (
                            <p className="mt-1 text-xs font-semibold text-pink-100/70">
                              Wheel segment #{irlTask.assignedIrlWheelIndex + 1}
                            </p>
                          )}
                          {irlTask.assignedIrlDueAt && (
                            <p className="mt-2 rounded-xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-100">
                              Complete before{" "}
                              {new Date(irlTask.assignedIrlDueAt).toLocaleString()}
                              <br />
                              {new Date(irlTask.assignedIrlDueAt).getTime() > now
                                ? `${formatRemaining(new Date(irlTask.assignedIrlDueAt).getTime() - now)} remaining`
                                : "Time is up. Await admin review."}
                            </p>
                          )}
                          <p className="mt-2 text-lg font-black text-white">
                            {irlTask.assignedIrlTask}
                          </p>
                          {irlTask.assignedIrlTaskDescription && (
                            <p className="mt-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm leading-6 text-zinc-200">
                              {irlTask.assignedIrlTaskDescription}
                            </p>
                          )}
                          <p className="mt-2 text-sm leading-6 text-pink-50">
                            DM this task result to @VMPrincipessa with your app username.
                          </p>
                          <p className="mt-2 text-xs leading-5 text-rose-100/80">
                            If this task is not completed in time, admin may apply a
                            manual timeout. Throne support can be reviewed manually
                            to clear the task without affection gain.
                          </p>
                        </div>
                      )}
                        <button
                          aria-disabled={isIrlCoolingDown || undefined}
                          className={`mt-auto w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40 ${
                            isIrlCoolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
                          }`}
                        disabled={
                          isIrlWheelSpinning ||
                          disabled ||
                          isTaskActionPending("irl-task-wheel") ||
                          irlWheelNeedsCoins ||
                          Boolean(irlTask.assignedIrlTask) ||
                          Boolean(irlTask.timeoutUntil && new Date(irlTask.timeoutUntil).getTime() > now)
                        }
                        onClick={() => {
                          if (isIrlCoolingDown) {
                            handleCooldownAttempt(`Cooldown active. Available again in ${formatRemaining(irlCooldownRemaining)}.`);
                            return;
                          }

                          handleIrlWheelSpinClick();
                        }}
                        type="button"
                      >
                        {isIrlWheelSpinning
                          ? "Spinning..."
                          : irlTask.assignedIrlTask
                            ? "Awaiting Admin Review"
                            : isFreeFriday
                              ? "Free Friday Spin"
                            : irlWheelNeedsCoins
                              ? `Need ${IRL_TASK_WHEEL_COST} Coins`
                              : `Spin — ${IRL_TASK_WHEEL_COST} Coins`}
                      </button>
                    </div>
                  </article>
                )}
              </div>
            );
          }

          if (isGroupedWheelLayoutKind(task.kind)) {
            return null;
          }

          return (
            <article
              className={`rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4 ${
                task.kind === "movement" &&
                (movementLocalActive || task.movementState === "active" || task.movementState === "fake_hope")
                  ? "md:col-span-2"
                  : ""
              }`}
              key={task.id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-white">{task.title}</h3>
                  {task.reward > 0 && (
                    <p className="mt-1 text-sm text-zinc-400">
                      {task.kind === "number-pick"
                        ? "Reward: 100 / 50 Principessa Coins"
                        : `Reward: ${task.reward} Principessa Coins`}
                    </p>
                  )}
                  {isCoolingDown && (
                    <p className="mt-2 text-sm font-semibold text-pink-100">
                      Available again in {formatRemaining(cooldownRemaining)}
                    </p>
                  )}
                  {disabled && !isTimeoutRisk && (
                    <p className="mt-2 text-sm font-semibold text-yellow-100">
                      Timeout active. This task is locked.
                    </p>
                  )}
                </div>
                {renderStatus(task, isCoolingDown)}
              </div>

              {task.kind === "typing" && (
                <div className="mt-4 rounded-2xl border border-pink-200/15 bg-black/35 p-3">
                  <p
                    className="select-none text-sm leading-6 text-pink-50"
                    onContextMenu={(event) => event.preventDefault()}
                    onCopy={(event) => event.preventDefault()}
                    onCut={(event) => event.preventDefault()}
                  >
                    {task.sentence}
                  </p>
                  <p className="mt-2 text-lg" aria-label={`${task.attemptsRemaining ?? 3} attempts remaining`}>
                    {"❤️".repeat(task.attemptsRemaining ?? 3)}
                    {"♡".repeat(Math.max(0, 3 - (task.attemptsRemaining ?? 3)))}
                  </p>
                  <input
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-300/60 disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={disabled || isCoolingDown || task.completed || isTaskActionPending("typing-accuracy")}
                    onCopy={(event) => event.preventDefault()}
                    onCut={(event) => event.preventDefault()}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setTypingValue(nextValue);
                      onTypingProgress(nextValue);

                      if (task.sentence && !writingPreviewStartsWith(task.sentence, nextValue)) {
                        setTypingValue("");
                      }
                    }}
                    onDrop={(event) => event.preventDefault()}
                    onPaste={(event) => event.preventDefault()}
                    placeholder="Type the sentence exactly"
                    value={typingValue}
                  />
                  {task.completed && !task.claimed && (
                    <button
                      className="mt-3 w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={
                          disabled ||
                          (!task.completed && !isCoolingDown) ||
                          task.claimed ||
                          isTaskActionPending("typing-accuracy") ||
                          isClaimPending(task.id)
                        }
                        onClick={() => {
                        if (isCoolingDown) {
                          handleCooldownAttempt(`Cooldown active. Available again in ${formatRemaining(cooldownRemaining)}.`);
                          return;
                        }

                        setTypingValue("");
                        emitSoundEvent("button_click");
                        onClaim(task.id);
                      }}
                      type="button"
                    >
                      Claim Reward
                    </button>
                  )}
                </div>
              )}

              {task.kind === "case-open" && (
                <div className="mt-4 rounded-2xl border border-pink-200/15 bg-black/35 p-3">
                  <p className="text-sm leading-6 text-zinc-400">
                    Open a luxury case and let the vault roll a random coin reward.
                  </p>
                  <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      {caseOpenPhase === "rolling" ? "Rolling reward" : "Case contents"}
                    </p>
                    <div className="relative mt-3 overflow-hidden">
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 left-1/2 z-10 flex w-[4.25rem] -translate-x-1/2 items-center justify-center"
                      >
                        <div className="absolute h-16 w-full rounded-2xl border border-pink-200/20 bg-pink-300/6 shadow-[0_0_18px_rgba(244,114,182,0.12)]" />
                        <div className="h-[4.75rem] w-px bg-gradient-to-b from-transparent via-pink-200/75 to-transparent" />
                      </div>
                      <div
                        className="flex items-center gap-[10px]"
                        style={{
                          paddingLeft: caseOpenTrackSidePadding,
                          paddingRight: caseOpenTrackSidePadding,
                          transform: `translateX(${caseOpenOffset}px)`,
                          transition: caseOpenAnimating
                            ? "transform 5s cubic-bezier(0.12,0.78,0.12,1)"
                            : "none",
                        }}
                      >
                        {(caseOpenPhase === "rolling"
                          ? caseOpenTape
                          : caseOpenPreviewValues
                        ).map((value, index) => (
                          <div
                            key={`${value}-${index}-${caseOpenPhase}`}
                            className="flex h-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(236,72,153,0.18),rgba(24,24,27,0.92))] px-3 text-center shadow-[0_10px_30px_rgba(0,0,0,0.32)]"
                            style={{ width: `${CASE_OPEN_REEL_ITEM_WIDTH}px` }}
                          >
                            <CoinAmount
                              amount={value}
                              className="justify-center gap-1.5 text-lg font-black text-pink-50"
                              iconClassName="drop-shadow-[0_0_8px_rgba(255,215,115,0.35)]"
                              iconSize={18}
                              label=""
                              prefix="+"
                            />
                          </div>
                          ))}
                      </div>
                    </div>
                    {caseOpenPhase === "idle" && (caseOpenResolvedReward ?? task.caseReward ?? null) != null ? (
                      <p className="mt-4 rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-3 py-2 text-center text-sm font-semibold text-emerald-100">
                        Last reward: +{caseOpenResolvedReward ?? task.caseReward ?? 0} Principessa Coins
                      </p>
                    ) : (
                      <p className="mt-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-pink-100/70">
                        {caseOpenPhase === "rolling" ? "Opening..." : "Preview of possible rewards"}
                      </p>
                    )}
                  </div>
                  <button
                    aria-disabled={isCoolingDown || undefined}
                    className={`mt-3 w-full rounded-2xl border border-pink-200/25 bg-pink-500/15 px-4 py-3 text-sm font-black text-pink-50 transition enabled:hover:border-pink-200/55 enabled:hover:bg-pink-500/25 disabled:cursor-not-allowed disabled:opacity-40 ${
                      isCoolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
                    }`}
                    disabled={disabled || isCoolingDown || isCaseOpenPending || caseOpenPhase === "rolling"}
                    onClick={async () => {
                      if (isCoolingDown) {
                        handleCooldownAttempt(`Cooldown active. Available again in ${formatRemaining(cooldownRemaining)}.`);
                        return;
                      }

                      emitSoundEvent("button_click");
                      setCaseOpenResolvedReward(null);
                      if (caseOpenTimerRef.current) {
                        window.clearTimeout(caseOpenTimerRef.current);
                        caseOpenTimerRef.current = null;
                      }
                      clearCaseOpenSoundTimers();

                      setCaseOpenPhase("rolling");
                      setCaseOpenAnimating(false);
                      setCaseOpenOffset(0);

                      const reward = await onCaseOpen();
                      if (typeof reward !== "number") {
                        clearCaseOpenSoundTimers();
                        setCaseOpenResolvedReward(null);
                        setCaseOpenAnimating(false);
                        setCaseOpenOffset(0);
                        setCaseOpenPhase("idle");
                        return;
                      }

                      const nextTape = buildCaseOpenTape(reward);
                      setCaseOpenTape(nextTape);
                      setCaseOpenAnimating(false);
                      setCaseOpenOffset(0);
                      setCaseOpenPhase("rolling");
                      startCaseOpenSoundTicks();

                      window.requestAnimationFrame(() => {
                        window.requestAnimationFrame(() => {
                          setCaseOpenAnimating(true);
                          setCaseOpenOffset(-(CASE_OPEN_REEL_LANDING_INDEX * caseOpenSlotSize));
                        });
                      });

                      caseOpenTimerRef.current = window.setTimeout(() => {
                        clearCaseOpenSoundTimers();
                        emitSoundEvent("crate_reel_tick");
                        setCaseOpenResolvedReward(reward);
                        setCaseOpenAnimating(false);
                        setCaseOpenOffset(0);
                        setCaseOpenPhase("idle");
                        caseOpenTimerRef.current = null;
                      }, 5000);
                    }}
                    type="button"
                  >
                    {isCoolingDown ? (
                      <CooldownButtonContent label={`Available in ${formatRemaining(cooldownRemaining)}`} />
                    ) : isCaseOpenPending || caseOpenPhase === "rolling" ? (
                      "Opening..."
                    ) : (
                      "Open Case"
                    )}
                  </button>
                </div>
              )}

              {task.kind === "number-pick" && (
                <div className="mt-4 rounded-2xl border border-pink-200/15 bg-black/35 p-3">
                  <p className="text-sm leading-6 text-zinc-400">
                    First correct pick pays 100 Principessa Coins. If you miss, the wrong number
                    locks red and one final pick can still pay 50.
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(task.numberPickOptions ?? []).map((option) => {
                      const isSelected = task.numberPickSelected === option;
                      const isCorrect = task.numberPickCorrect === option;
                      const hasResult = Boolean(task.numberPickResult);
                      const isWrongSelection = (task.numberPickWrongSelections ?? []).includes(
                        option,
                      );

                      return (
                        <button
                          aria-disabled={isCoolingDown || undefined}
                          className={`rounded-2xl border px-4 py-5 text-2xl font-black transition disabled:cursor-not-allowed disabled:opacity-70 ${
                            hasResult && isCorrect
                              ? "border-emerald-200/50 bg-emerald-400/15 text-emerald-100"
                              : isWrongSelection || (hasResult && isSelected)
                                ? "border-rose-200/45 bg-rose-400/15 text-rose-100"
                                : "border-pink-200/20 bg-pink-500/10 text-pink-50 enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20"
                          } ${isCoolingDown ? CLICKABLE_COOLDOWN_TILE_CLASS : ""}`}
                          disabled={disabled || isTaskActionPending("number-pick") || hasResult || isWrongSelection}
                          key={option}
                          onClick={() => {
                            emitSoundEvent("button_click");
                            if (isCoolingDown) {
                              onCooldownAttempt?.(`Cooldown active. Available again in ${formatRemaining(cooldownRemaining)}.`);
                              return;
                            }

                            onNumberPick(option);
                          }}
                          type="button"
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  {task.numberPickResult && (
                    <p className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold text-pink-50">
                      {task.numberPickResult === "win"
                        ? "Correct. Principessa Coins added."
                        : `Wrong. Correct number was ${task.numberPickCorrect}.`}
                    </p>
                  )}
                  {!task.numberPickResult &&
                    (task.numberPickAttemptsRemaining ?? 2) < 2 &&
                    (task.numberPickWrongSelections ?? []).length > 0 && (
                      <p className="mt-3 rounded-2xl border border-rose-200/20 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-100">
                        Wrong. One chance remains. Pick between the remaining numbers.
                      </p>
                    )}
                </div>
              )}

              {task.kind === "wait-obediently" && (
                <WaitObedientlyPanel
                  cooldownRemaining={cooldownRemaining}
                  formatRemaining={formatRemaining}
                  isCoolingDown={isCoolingDown}
                  isGloballyDisabled={disabled}
                  isActionPending={isTaskActionPending("wait-obediently")}
                  onComplete={onWaitObedientlyComplete}
                  onCooldownAttempt={handleCooldownAttempt}
                  onFail={onWaitObedientlyFail}
                  onStart={onWaitObedientlyStart}
                  task={task}
                />
              )}

              {task.kind === "movement" && (
                (() => {
                  const currentMovementProgress = Math.min(
                    100,
                    Math.max(task.movementProgress ?? 0, movementDisplayProgress),
                  );
                  const movementResolved =
                    task.movementState === "completed" ||
                    task.movementState === "failed" ||
                    isCoolingDown ||
                    isTaskActionPending("vertical-motion");
                  const movementInputActive =
                    !movementResolved &&
                    (movementLocalActive ||
                      task.movementState === "active");
                  const movementActive = movementInputActive || task.movementState === "fake_hope";
                  const completeRevealVisible =
                    task.movementState === "completed" &&
                    Boolean(task.movementResolvedAt) &&
                    now - new Date(task.movementResolvedAt ?? "").getTime() < 60 * 1000;
                  const movementStageImage = completeRevealVisible
                    ? MOVEMENT_COMPLETE_IMAGE
                    : getMovementStageImage(currentMovementProgress);
                  const inactivityRemaining = movementActive
                    ? Math.max(0, Math.ceil(movementIdleRemaining))
                    : 4;
                  const movementLastResult = getMovementLastResult(task);

                  return (
                    <div
                      className="mt-4 rounded-2xl border border-pink-200/15 bg-black/35 p-3"
                      onMouseLeave={resetMovementPointer}
                      onPointerDown={(event) => {
                        if (movementInputActive) {
                          handleMovementPointerDown(event.clientY, event.timeStamp);
                        }
                      }}
                      onPointerMove={(event) => {
                        if (movementInputActive) {
                          handleMovementInput(event.clientY, task, event.timeStamp);
                        }
                      }}
                      onPointerUp={resetMovementPointer}
                      onTouchMove={(event) => {
                        if (!movementInputActive) {
                          return;
                        }

                        event.preventDefault();
                        const touch = event.touches[0];

                        if (touch) {
                          handleMovementInput(touch.clientY, task, event.timeStamp);
                        }
                      }}
                      style={{ touchAction: movementInputActive ? "none" : "auto" }}
                    >
                      {!movementActive && !completeRevealVisible && (
                        <p className="text-sm leading-6 text-zinc-400">
                          Press Start, then use quick medium-length vertical movements. Slow or tiny
                          movements do not count.
                        </p>
                      )}
                      {(movementActive || completeRevealVisible) && (
                        <>
                          <div className="relative mx-auto mt-3 aspect-[1664/2432] max-h-[min(72vh,42rem)] w-full max-w-sm overflow-hidden rounded-2xl border border-pink-200/15 bg-black/45">
                            <Image
                              alt="Daily Motion stage"
                              className="object-contain"
                              fill
                              sizes="384px"
                              src={movementStageImage}
                              unoptimized
                            />
                          </div>
                          {movementActive && (
                            <div className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.18em] text-yellow-100">
                              No movement fail in {inactivityRemaining}s
                            </div>
                          )}
                          <div className="mt-3 h-4 overflow-hidden rounded-full border border-pink-200/15 bg-black/55">
                            <div
                              className="h-full rounded-full bg-pink-400 transition-all"
                              style={{ width: `${currentMovementProgress}%` }}
                            />
                          </div>
                          <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-pink-100/70">
                            {task.movementState === "fake_hope"
                              ? "So close. Keep going."
                              : task.movementState === "failed"
                                ? "Attempt failed"
                                : task.movementState === "completed"
                                  ? "Completed"
                                  : `${Math.round(currentMovementProgress)}%`}
                          </p>
                          {(task.movementState === "failed" || task.movementState === "completed") && (
                            <p className="mt-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-zinc-300">
                              {task.movementOutcome === "success"
                                ? "Outcome: success."
                                : task.movementOutcome === "fake_hope"
                                  ? "Outcome: fake hope."
                                  : task.movementOutcome === "instant_denial"
                                    ? "Outcome: instant denial."
                                    : "Outcome resolved."}
                              </p>
                          )}
                        </>
                      )}
                      {isCoolingDown && movementLastResult && (
                        <p className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-zinc-300">
                          {movementLastResult}
                        </p>
                      )}
                      <button
                        className="mt-3 w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={
                          disabled ||
                          movementActive ||
                          isTaskActionPending("vertical-motion") ||
                          task.movementState === "completed" ||
                          task.movementState === "failed" ||
                          isCoolingDown
                        }
                        onClick={() => {
                          emitSoundEvent("button_click");
                          resetMovementAttempt(task);
                          onMovementStart();
                        }}
                        type="button"
                      >
                        {isTaskActionPending("vertical-motion")
                          ? "Saving..."
                          : isCoolingDown
                            ? `Available in ${formatRemaining(cooldownRemaining)}`
                          : task.movementState === "active" || task.movementState === "fake_hope"
                            ? "Move Vertically"
                            : "Start"}
                      </button>
                    </div>
                  );
                })()
              )}

              {task.kind === "timeout-risk" && (
                <div className="mt-4 rounded-2xl border border-yellow-200/20 bg-[linear-gradient(145deg,rgba(250,204,21,0.12),rgba(236,72,153,0.08),rgba(0,0,0,0.4))] p-3">
                  <p className="text-sm leading-6 text-zinc-300">
                    Risk is chance-based: {Math.round(timeoutRiskChance * 100)}% chance
                    to receive {timeoutRiskTimeoutHours * (task.timeoutRiskMultiplier ?? 1)} hours timeout, {Math.round((1 - timeoutRiskChance) * 100)}%
                    chance to win {timeoutRiskReward * (task.timeoutRiskMultiplier ?? 1)} Principessa Coins.
                  </p>
                  {task.timeoutUntil && new Date(task.timeoutUntil).getTime() > now && (
                    <p className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-100">
                      Current timeout:{" "}
                      {formatRemaining(new Date(task.timeoutUntil).getTime() - now)}
                    </p>
                  )}
                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                    Partial remaining days count as full days. Maximum effective timeout is{" "}
                    {timeoutRiskMaxDays} day.
                  </p>
                  <p className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-pink-50">
                    Safe wins today: {task.safeWinsToday ?? 0}/{2}
                  </p>
                  {task.lastResult && (
                    <p className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-pink-50">
                      {task.lastResult}
                    </p>
                  )}
                  {task.completed && (
                    <p className="mt-3 rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100">
                      Daily safe win limit reached. Come back tomorrow.
                    </p>
                  )}
                  {isCoolingDown && (
                    <p className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-100">
                      Available again in {formatRemaining(cooldownRemaining)}
                    </p>
                  )}
                  <button
                    aria-disabled={isCoolingDown || undefined}
                    className={`mt-3 w-full rounded-2xl border border-yellow-200/25 bg-yellow-400/10 px-4 py-3 text-sm font-black text-yellow-50 transition enabled:hover:border-yellow-100/60 enabled:hover:bg-yellow-400/20 disabled:cursor-not-allowed disabled:opacity-40 ${
                      isCoolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
                    }`}
                    disabled={disabled || task.completed || isTaskActionPending("timeout-risk") || timeoutRiskEffectiveDays > timeoutRiskMaxDays}
                    onClick={() => {
                      if (isCoolingDown) {
                        handleCooldownAttempt(`Cooldown active. Available again in ${formatRemaining(cooldownRemaining)}.`);
                        return;
                      }

                      onTimeoutRisk(task.timeoutRiskMultiplier ?? 1);
                    }}
                    type="button"
                  >
                    {task.completed
                      ? "Daily limit reached"
                      : timeoutRiskEffectiveDays > timeoutRiskMaxDays
                      ? "Maximum timeout reached."
                      : "Attempt Risk"}
                  </button>
                </div>
              )}

              {task.kind === "irl-wheel" && (
                <div className="mt-4 rounded-2xl border border-pink-200/15 bg-black/35 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <p className="text-sm leading-6 text-zinc-400">
                      {isFreeFriday
                        ? "Free Task Friday: one non-Throne IRL wheel spin is free today."
                        : `Spin the wheel for ${IRL_TASK_WHEEL_COST} Principessa Coins. The result becomes your assigned IRL task.`}
                    </p>
                    <button
                      className="shrink-0 rounded-full border border-pink-200/20 bg-pink-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-pink-50 transition hover:border-pink-300/60 hover:bg-pink-500/20"
                      onClick={() => {
                        emitSoundEvent("button_click");
                        setShowIrlTaskList(true);
                      }}
                      type="button"
                    >
                      Task List
                    </button>
                  </div>
                  <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.14),rgba(0,0,0,0.5))] p-4">
                    {showIrlTaskList ? (
                      <IrlTaskWheelTaskList
                        onClose={() => setShowIrlTaskList(false)}
                        tasks={wheelSegments}
                      />
                    ) : (
                      <WheelSpinner
                        rotation={irlWheelRotation}
                        selectedIndex={task.assignedIrlWheelIndex ?? null}
                        segmentCount={wheelSegments.length}
                        spinning={isIrlWheelSpinning}
                      />
                    )}
                  </div>
                  {task.timeoutUntil && new Date(task.timeoutUntil).getTime() > now && (
                    <p className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-100">
                      Timeout active: {formatRemaining(new Date(task.timeoutUntil).getTime() - now)}
                    </p>
                  )}
                  {task.assignedIrlTask && (
                    <div className="mt-3 rounded-2xl border border-pink-200/25 bg-pink-500/10 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-200/70">
                        Assigned Task
                      </p>
                      {typeof task.assignedIrlWheelIndex === "number" && (
                        <p className="mt-1 text-xs font-semibold text-pink-100/70">
                          Wheel segment #{task.assignedIrlWheelIndex + 1}
                        </p>
                      )}
                      {task.assignedIrlDueAt && (
                        <p className="mt-2 rounded-xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-100">
                          Complete before{" "}
                          {new Date(task.assignedIrlDueAt).toLocaleString()}
                          <br />
                          {new Date(task.assignedIrlDueAt).getTime() > now
                            ? `${formatRemaining(new Date(task.assignedIrlDueAt).getTime() - now)} remaining`
                            : "Time is up. Await admin review."}
                        </p>
                      )}
                      <p className="mt-2 text-lg font-black text-white">
                        {task.assignedIrlTask}
                      </p>
                      {task.assignedIrlTaskDescription && (
                        <p className="mt-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm leading-6 text-zinc-200">
                          {task.assignedIrlTaskDescription}
                        </p>
                      )}
                      <p className="mt-2 text-sm leading-6 text-pink-50">
                        DM this task result to @VMPrincipessa with your app username.
                      </p>
                      <p className="mt-2 text-xs leading-5 text-rose-100/80">
                        If this task is not completed in time, admin may apply a
                        manual timeout. Throne support can be reviewed manually
                        to clear the task without affection gain.
                      </p>
                    </div>
                  )}
                  <button
                    aria-disabled={isCoolingDown || undefined}
                    className={`mt-3 w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40 ${
                      isCoolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
                    }`}
                    disabled={
                      isIrlWheelSpinning ||
                      disabled ||
                      isTaskActionPending("irl-task-wheel") ||
                      (!isFreeFriday && coins < IRL_TASK_WHEEL_COST) ||
                      Boolean(task.assignedIrlTask) ||
                      Boolean(task.timeoutUntil && new Date(task.timeoutUntil).getTime() > now)
                    }
                    onClick={() => {
                      if (isCoolingDown) {
                        handleCooldownAttempt(`Cooldown active. Available again in ${formatRemaining(cooldownRemaining)}.`);
                        return;
                      }

                      handleIrlWheelSpinClick();
                    }}
                    type="button"
                  >
                    {isIrlWheelSpinning ? "Spinning..." : task.assignedIrlTask
                      ? "Awaiting Admin Review"
                        : isFreeFriday
                          ? "Free Friday Spin"
                        : coins < IRL_TASK_WHEEL_COST
                          ? `Need ${IRL_TASK_WHEEL_COST} Coins`
                          : `Spin — ${IRL_TASK_WHEEL_COST} Coins`}
                  </button>
                </div>
              )}

              {task.kind === "claim" && (
                <button
                  aria-disabled={isCoolingDown || undefined}
                  className={`mt-4 w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40 ${
                    isCoolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
                  }`}
                  disabled={disabled || (!isClaimable && !isCoolingDown) || isClaimPending(task.id)}
                  onClick={() => {
                    emitSoundEvent("button_click");
                    if (isCoolingDown) {
                      onCooldownAttempt?.(`Cooldown active. Available again in ${formatRemaining(cooldownRemaining)}.`);
                      return;
                    }

                    onClaim(task.id);
                  }}
                  type="button"
                >
                  {isCoolingDown ? (
                    <CooldownButtonContent label={`Available in ${formatRemaining(cooldownRemaining)}`} />
                  ) : task.claimed
                      ? "Reward Claimed"
                      : "Claim Reward"}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function IrlTaskWheelTaskList({
  onClose,
  tasks,
}: {
  onClose: () => void;
  tasks: ReadonlyArray<{ description: string; title: string }>;
}) {
  return (
    <div className="relative">
      <button
        aria-label="Close task list"
        className="absolute right-0 top-0 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-sm font-black text-pink-50 transition hover:border-pink-200/60 hover:bg-pink-500/20"
        onClick={() => {
          emitSoundEvent("button_click");
          onClose();
        }}
        type="button"
      >
        X
      </button>
      <div className="pr-11">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-200/70">
          All Wheel Tasks
        </p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">
          Each wheel slice maps to one unique IRL task.
        </p>
      </div>
      <div className="mt-4 grid max-h-[24rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {tasks.map((task, index) => (
          <div
            className="rounded-2xl border border-white/10 bg-black/35 p-3"
            key={`${task.title}-${index}`}
          >
            <p className="text-[0.7rem] font-black uppercase tracking-[0.18em] text-pink-200/60">
              Task #{index + 1}
            </p>
            <p className="mt-1 text-sm font-black text-white">{task.title}</p>
            {task.description && (
              <p className="mt-2 text-xs leading-5 text-zinc-400">
                {task.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WheelSpinner({
  rotation,
  selectedIndex,
  segmentCount,
  spinning,
}: {
  rotation: number;
  selectedIndex: number | null;
  segmentCount: number;
  spinning: boolean;
}) {
  const safeSegmentCount = Math.max(1, segmentCount);
  const segmentDegrees = 360 / safeSegmentCount;
  const settledRotation =
    selectedIndex === null
      ? rotation
      : (360 - (selectedIndex * segmentDegrees + segmentDegrees / 2)) % 360;
  const displayRotation = rotation !== 0 ? rotation : settledRotation;
  const activeIndex = spinning ? null : selectedIndex;
  const wheelGradient = Array.from({ length: safeSegmentCount }, (_, index) => {
    const start = index * segmentDegrees;
    const end = (index + 1) * segmentDegrees;
    const color =
      index % 2 === 0
        ? "rgba(236,72,153,0.78)"
        : "rgba(126,34,206,0.82)";

    return `${color} ${start}deg ${end}deg`;
  }).join(", ");

  return (
    <div className="relative mx-auto flex max-w-[20rem] flex-col items-center">
      <div className="absolute -top-1 z-20 h-0 w-0 border-x-[12px] border-t-[22px] border-x-transparent border-t-pink-100 drop-shadow-[0_0_10px_rgba(244,114,182,0.9)]" />
      <div
        className="relative aspect-square w-full max-w-[18rem] rounded-full border border-pink-100/35 shadow-[0_0_34px_rgba(236,72,153,0.28)] transition-transform duration-[3600ms] ease-out"
        style={{
          background: `conic-gradient(from -9deg, ${wheelGradient})`,
          transform: `rotate(${displayRotation}deg)`,
        }}
      >
        <div className="absolute inset-2 rounded-full border border-black/35" />
        <div className="absolute inset-[42%] rounded-full border border-pink-100/40 bg-black shadow-[0_0_18px_rgba(0,0,0,0.6)]" />
        {Array.from({ length: safeSegmentCount }, (_, index) => {
          const angle = index * segmentDegrees + segmentDegrees / 2;
          const isActive = activeIndex === index;

          return (
            <span
              className={`absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-black ${
                isActive
                  ? "bg-white text-pink-600 shadow-[0_0_14px_rgba(255,255,255,0.9)]"
                  : "bg-black/35 text-pink-50"
              }`}
              key={index}
              style={{
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-6.45rem) rotate(${-angle}deg)`,
              }}
            >
              {index + 1}
            </span>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs uppercase tracking-[0.2em] text-fuchsia-200/70">
        {spinning ? "Wheel Spinning" : `${safeSegmentCount}-Segment IRL Wheel`}
      </p>
    </div>
  );
}

function LoyaltyJackpotTaskCard({
  coins,
  disabled,
  error,
  isBusy,
  jackpot,
  currentUsername,
  now,
  onContribute,
  usernameStyle,
}: {
  coins: number;
  currentUsername?: string;
  disabled: boolean;
  error: string;
  isBusy: boolean;
  jackpot: LoyaltyJackpotState | null;
  now: number;
  onContribute: (amount: number) => void;
  usernameStyle?: CSSProperties;
}) {
  const [amount, setAmount] = useState(String(JACKPOT_MIN_CONTRIBUTION));
  const [hideContributors, setHideContributors] = useState(false);
  const parsedAmount = Number(amount);
  const cleanAmount = Number.isInteger(parsedAmount) ? parsedAmount : 0;
  const jackpotWinners = jackpot?.currentWinners?.length
    ? jackpot.currentWinners
    : jackpot?.currentWinner
      ? [jackpot.currentWinner]
      : [];
  const previousJackpotWinners = jackpot?.previousWinners?.length
    ? jackpot.previousWinners
    : jackpot?.previousWinner
      ? [jackpot.previousWinner]
      : [];
  const phaseLabel =
    jackpot?.phase === "contribution"
      ? "Contribution Open"
      : jackpot?.phase === "winner"
        ? "Drawing Winners"
        : "Next Cycle Preparing";
  const phaseEndsAt = jackpot ? new Date(jackpot.phaseEndsAt).getTime() : 0;
  const remainingMs = Math.max(0, phaseEndsAt - now);
  const canContribute =
    Boolean(jackpot && jackpot.phase === "contribution" && !disabled) &&
    cleanAmount >= JACKPOT_MIN_CONTRIBUTION &&
    cleanAmount <= coins;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(JACKPOT_HIDE_CONTRIBUTORS_STORAGE_KEY);
      queueMicrotask(() => setHideContributors(stored === "true"));
    } catch {
      // A private browsing/storage failure should not break the jackpot card.
    }
  }, []);

  const handleHideContributorsChange = (checked: boolean) => {
    setHideContributors(checked);

    try {
      window.localStorage.setItem(JACKPOT_HIDE_CONTRIBUTORS_STORAGE_KEY, String(checked));
    } catch {
      // Keep the current in-memory preference even if persistence fails.
    }
  };

  return (
    <article className="mt-5 rounded-[1.5rem] border border-amber-200/20 bg-[linear-gradient(145deg,rgba(245,158,11,0.16),rgba(0,0,0,0.38))] p-4 shadow-[0_0_28px_rgba(245,158,11,0.12)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-100/70">
            Loyalty Jackpot
          </p>
          <h3 className="mt-1 text-2xl font-black text-white">
            {jackpot ? (
              <CoinAmount amount={jackpot.pool} iconSize={24} label="coins" />
            ) : (
              "Loading pool"
            )}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            3+ day loyalty streak users enter the draw automatically. Extra payment is
            not required to participate; contributions only increase the winners coin
            prize and do not count as tribute.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100/20 bg-black/30 px-4 py-3 text-sm text-amber-50">
          <p className="font-black">{phaseLabel}</p>
          <p className="mt-1 text-xs text-amber-100/70">
            {jackpot ? `${formatJackpotRemaining(remainingMs)} left` : "Checking vault..."}
          </p>
        </div>
      </div>

      {jackpot && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <JackpotStat label="Eligible" value={jackpot.eligibleCount.toLocaleString()} />
          <JackpotStat label="Contributors" value={jackpot.participantCount.toLocaleString()} />
          <JackpotStat label="Your Pool" value={jackpot.userContributionTotal.toLocaleString()} />
        </div>
      )}

      {jackpotWinners.length > 0 && (
        <div className="mt-4 rounded-2xl border border-emerald-200/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-50/80">
            Jackpot Winners
          </p>
          <div className="mt-3 grid gap-2">
            {jackpotWinners.map((winner, index) => (
              <div
                className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100/15 bg-black/25 px-3 py-2"
                key={`${winner.username}-${winner.selectedAt}-${index}`}
              >
                <span className="min-w-0 truncate">
                  {winner.place ? `${winner.place}${getOrdinalSuffix(winner.place)}` : `#${index + 1}`}{" "}
                  <StyledUsername
                    currentUsername={currentUsername}
                    displayName={winner.displayName}
                    displayUsernameStyle={winner.usernameStyle}
                    username={winner.username}
                    usernameStyle={usernameStyle}
                  />
                </span>
                <CoinAmount amount={winner.amount} className="shrink-0" iconSize={16} label="coins" />
              </div>
            ))}
          </div>
        </div>
      )}

      {previousJackpotWinners.length > 0 && jackpotWinners.length === 0 && (
        <div className="mt-4 text-sm text-zinc-400">
          <p className="font-bold text-zinc-300">Previous Jackpot Winners:</p>
          <div className="mt-2 grid gap-1.5">
            {previousJackpotWinners.map((winner, index) => (
              <p key={`${winner.username}-${winner.selectedAt}-${index}`}>
                {winner.place ? `${winner.place}${getOrdinalSuffix(winner.place)}` : `#${index + 1}`}{" "}
                <StyledUsername
                  currentUsername={currentUsername}
                  displayName={winner.displayName}
                  displayUsernameStyle={winner.usernameStyle}
                  username={winner.username}
                  usernameStyle={usernameStyle}
                />{" "}
                won <CoinAmount amount={winner.amount} iconSize={16} label="coins" />.
              </p>
            ))}
          </div>
        </div>
      )}

      {jackpot?.userProtected && (
        <p className="mt-4 rounded-2xl border border-fuchsia-200/20 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-100">
          You won recently, so this cycle protects the pool from repeat winners.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
            Contribution Amount
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-amber-100/20 bg-black/35 px-4 py-3 text-base font-bold text-amber-50 outline-none transition focus:border-amber-100/60 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled || isBusy || jackpot?.phase !== "contribution"}
            inputMode="numeric"
            min={JACKPOT_MIN_CONTRIBUTION}
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))}
            placeholder={`Minimum ${JACKPOT_MIN_CONTRIBUTION.toLocaleString()} coins`}
            type="text"
            value={amount}
          />
        </label>
        <button
          className="self-end rounded-2xl border border-amber-100/20 bg-amber-400/10 px-5 py-3 text-sm font-black text-amber-50 transition enabled:hover:border-amber-100/50 enabled:hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!canContribute || isBusy}
          onClick={() => {
            emitSoundEvent("button_click");
            onContribute(cleanAmount);
          }}
          type="button"
        >
          {isBusy
            ? "Adding..."
            : cleanAmount > 0 && cleanAmount < JACKPOT_MIN_CONTRIBUTION
              ? `Min ${JACKPOT_MIN_CONTRIBUTION.toLocaleString()} Coins`
            : cleanAmount > coins
              ? "Not Enough Coins"
              : "Add to Jackpot"}
        </button>
      </div>

      {jackpot?.recentContributors.length ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Recent Contributions
            </p>
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold text-zinc-300 transition hover:border-amber-100/30 hover:text-amber-50">
              <input
                checked={hideContributors}
                className="h-4 w-4 accent-amber-300"
                onChange={(event) => handleHideContributorsChange(event.target.checked)}
                type="checkbox"
              />
              Hide contributors
            </label>
          </div>
          {hideContributors ? (
            <p className="mt-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-zinc-400">
              Contributor names hidden.
            </p>
          ) : (
            <div className="mt-3 grid max-h-[8.75rem] gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
              {jackpot.recentContributors.map((contribution) => (
                <div
                  className="flex items-center justify-between rounded-2xl bg-black/25 px-3 py-2 text-sm"
                  key={`${contribution.username}-${contribution.createdAt}`}
                >
                  <span className="text-zinc-200">
                    <StyledUsername
                      currentUsername={currentUsername}
                      displayName={contribution.displayName}
                      displayUsernameStyle={contribution.usernameStyle}
                      username={contribution.username}
                      usernameStyle={usernameStyle}
                    />
                  </span>
                  <span className="font-black text-amber-100">
                    <CoinAmount amount={contribution.amount} iconSize={16} label="" prefix="+" />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {error && <p className="mt-4 text-sm text-rose-200">{error}</p>}
    </article>
  );
}

function StyledUsername({
  currentUsername,
  displayName,
  display_name,
  displayUsernameStyle,
  username,
  usernameStyle,
}: {
  currentUsername?: string;
  displayName?: string | null;
  display_name?: string | null;
  displayUsernameStyle?: CSSProperties;
  username: string;
  usernameStyle?: CSSProperties;
}) {
  const isCurrentUser =
    username === currentUsername ||
    displayName === currentUsername ||
    display_name === currentUsername;

  return (
    <DisplayNameWithUsername
      displayName={displayName ?? display_name}
      primaryClassName="truncate text-sm font-black text-white"
      primaryStyle={displayUsernameStyle ?? (isCurrentUser ? usernameStyle : undefined)}
      secondaryClassName="truncate text-[10px] font-semibold text-zinc-400"
      username={username}
    />
  );
}

function JackpotStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function getOrdinalSuffix(place: number) {
  if (place === 1) {
    return "st";
  }

  if (place === 2) {
    return "nd";
  }

  if (place === 3) {
    return "rd";
  }

  return "th";
}

function formatJackpotRemaining(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function WaitObedientlyPanel({
  cooldownRemaining,
  formatRemaining,
  isActionPending = false,
  isGloballyDisabled,
  isCoolingDown,
  onComplete,
  onCooldownAttempt,
  onFail,
  onStart,
  task,
}: {
  cooldownRemaining: number;
  formatRemaining: (milliseconds: number) => string;
  isActionPending?: boolean;
  isGloballyDisabled: boolean;
  isCoolingDown: boolean;
  onComplete: () => void;
  onCooldownAttempt?: (message: string) => void;
  onFail: () => void;
  onStart: () => void;
  task: TaskItem;
}) {
  const [phase, setPhase] = useState<
    "ready" | "countdown" | "waiting" | "failed" | "completed"
  >("ready");
  const [countdown, setCountdown] = useState(3);
  const [waitRemaining, setWaitRemaining] = useState(60);
  const finishedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onFailRef = useRef(onFail);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onFailRef.current = onFail;
  }, [onComplete, onFail]);

  useEffect(() => {
    let cancelled = false;
    const syncPhase = (nextPhase: typeof phase, finished: boolean, remaining?: number) => {
      queueMicrotask(() => {
        if (cancelled) {
          return;
        }

        setPhase(nextPhase);
        finishedRef.current = finished;

        if (typeof remaining === "number") {
          setWaitRemaining(remaining);
        }
      });
    };

    if (task.waitState === "countdown") {
      syncPhase("countdown", false);
      return () => {
        cancelled = true;
      };
    }

    if (task.waitState === "waiting") {
      syncPhase("waiting", false);
      return () => {
        cancelled = true;
      };
    }

    if (task.waitState === "completed") {
      syncPhase("completed", true, 0);
      return () => {
        cancelled = true;
      };
    }

    if (task.waitState === "failed") {
      syncPhase("failed", true);
      return () => {
        cancelled = true;
      };
    }

    if (task.waitState === "cooldown") {
      syncPhase("ready", true);
      return () => {
        cancelled = true;
      };
    }

    if (task.waitState === "ready") {
      syncPhase("ready", false);
    }

    return () => {
      cancelled = true;
    };
  }, [task.waitState]);

  const startChallenge = () => {
    if (isCoolingDown) {
      emitSoundEvent("button_click");
      onCooldownAttempt?.(`Cooldown active. Available again in ${formatRemaining(cooldownRemaining)}.`);
      return;
    }

    if (isGloballyDisabled || isActionPending || phase === "countdown" || phase === "waiting") {
      return;
    }

    emitSoundEvent("button_click");
    finishedRef.current = false;
    setCountdown(3);
    setWaitRemaining(60);
    setPhase("countdown");
    onStart();
  };

  useEffect(() => {
    if (phase !== "countdown" && phase !== "waiting") {
      return;
    }

    const failFromPageExit = () => {
      if (finishedRef.current) {
        return;
      }

      finishedRef.current = true;
      setPhase("failed");
      onFailRef.current();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        failFromPageExit();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", failFromPageExit);
    window.addEventListener("pagehide", failFromPageExit);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", failFromPageExit);
      window.removeEventListener("pagehide", failFromPageExit);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "countdown") {
      return;
    }

    const countdownEndsAt = task.waitCountdownEndsAt
      ? new Date(task.waitCountdownEndsAt).getTime()
      : Date.now() + 3 * 1000;
    const interval = window.setInterval(() => {
      setCountdown(Math.max(0, Math.ceil((countdownEndsAt - Date.now()) / 1000)));
    }, 200);
    const timer = window.setTimeout(() => {
      const waitEndsAt = task.waitEndsAt
        ? new Date(task.waitEndsAt).getTime()
        : Date.now() + 60 * 1000;
      setWaitRemaining(Math.max(0, Math.ceil((waitEndsAt - Date.now()) / 1000)));
      setPhase("waiting");
    }, Math.max(0, countdownEndsAt - Date.now()));

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timer);
    };
  }, [phase, task.waitCountdownEndsAt, task.waitEndsAt]);

  useEffect(() => {
    if (phase !== "waiting") {
      return;
    }

    const waitEndsAt = task.waitEndsAt
      ? new Date(task.waitEndsAt).getTime()
      : Date.now() + 60 * 1000;
    const remainingMs = waitEndsAt - Date.now();

    if (remainingMs <= 0) {
      finishedRef.current = true;
      queueMicrotask(() => {
        setWaitRemaining(0);
        setPhase("completed");
        onCompleteRef.current();
      });
      return;
    }

    const armedAt = Date.now() + 300;
    const fail = () => {
      if (finishedRef.current || Date.now() < armedAt) {
        return;
      }

      finishedRef.current = true;
      setPhase("failed");
      onFailRef.current();
    };
    const interval = window.setInterval(() => {
      setWaitRemaining(Math.max(0, Math.ceil((waitEndsAt - Date.now()) / 1000)));
    }, 250);
    const timer = window.setTimeout(() => {
      if (finishedRef.current) {
        return;
      }

      finishedRef.current = true;
      setWaitRemaining(0);
      setPhase("completed");
      onCompleteRef.current();
    }, remainingMs);
    const events: Array<keyof WindowEventMap> = [
      "click",
      "keydown",
      "mousedown",
      "mousemove",
      "pointermove",
      "scroll",
      "touchstart",
      "wheel",
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, fail);
    });

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timer);
      events.forEach((eventName) => {
        window.removeEventListener(eventName, fail);
      });
    };
  }, [phase, task.waitEndsAt]);

  const displayPhase = isCoolingDown && phase === "ready" ? "cooldown" : phase;

  return (
    <div className="mt-4 rounded-2xl border border-pink-200/15 bg-black/35 p-3">
      <p className="text-sm leading-6 text-zinc-400">
        Press Ready, survive a 3 second countdown, then avoid every input for 1 minute.
      </p>
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
        <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-200/70">
          State
        </p>
        <p
          className={`mt-1 text-2xl font-black ${
            displayPhase === "completed"
              ? "text-emerald-200"
              : displayPhase === "failed"
                ? "text-rose-200"
                : displayPhase === "cooldown"
                  ? "text-yellow-100"
                  : "text-white"
          }`}
        >
          {displayPhase === "cooldown"
            ? "Cooldown"
            : displayPhase === "countdown"
              ? `Countdown ${countdown}`
              : displayPhase === "waiting"
                ? `Waiting ${waitRemaining}s`
                : displayPhase === "completed"
                  ? "Completed"
                  : displayPhase === "failed"
                    ? "Failed"
                    : "Ready"}
        </p>
        {displayPhase === "cooldown" && (
          <p className="mt-2 text-sm font-semibold text-pink-100">
            Available again in {formatRemaining(cooldownRemaining)}
          </p>
        )}
        {phase === "completed" && (
          <p className="mt-2 text-sm font-semibold text-emerald-100">
            Stillness rewarded. {task.reward} Principessa Coins added.
          </p>
        )}
        {phase === "failed" && (
          <p className="mt-2 text-sm font-semibold text-rose-100">
            Input detected. No reward today.
          </p>
        )}
      </div>
      {isGloballyDisabled && (
        <p className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-100">
          Timeout active. Waiting challenge is locked.
        </p>
      )}
      <button
        aria-disabled={isCoolingDown || undefined}
        className={`mt-3 w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40 ${
          isCoolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
        }`}
        disabled={
          isGloballyDisabled || isActionPending || phase === "countdown" || phase === "waiting"
        }
        onClick={startChallenge}
        type="button"
      >
        {displayPhase === "cooldown" ? (
          <CooldownButtonContent label={`Available in ${formatRemaining(cooldownRemaining)}`} />
        ) : phase === "countdown" || phase === "waiting"
            ? "Do Not Move"
            : isActionPending
              ? "Saving..."
            : "Ready"}
      </button>
    </div>
  );
}

function MechanicCard({
  actionLabel,
  cooldownUntil,
  description,
  disabled = false,
  formatRemaining,
  lastResult,
  now,
  onAction,
  onCooldownAttempt,
  title,
}: {
  actionLabel: string;
  cooldownUntil?: string | null;
  description: string;
  disabled?: boolean;
  formatRemaining: (milliseconds: number) => string;
  lastResult?: string | null;
  now: number;
  onAction: () => void;
  onCooldownAttempt?: (message: string) => void;
  title: string;
}) {
  const cooldownRemaining = cooldownUntil
    ? new Date(cooldownUntil).getTime() - now
    : 0;
  const isCoolingDown = cooldownRemaining > 0;

  return (
    <article className="rounded-[1.5rem] border border-pink-200/15 bg-[linear-gradient(145deg,rgba(236,72,153,0.1),rgba(0,0,0,0.35))] p-4 shadow-[0_0_24px_rgba(236,72,153,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
        </div>
        {isCoolingDown && (
          <span className="rounded-full bg-yellow-400/15 px-3 py-1 text-xs font-bold text-yellow-100">
            Cooldown
          </span>
        )}
      </div>
      {isCoolingDown && (
        <p className="mt-3 text-sm font-semibold text-pink-100">
          Available in {formatRemaining(cooldownRemaining)}
        </p>
      )}
      {lastResult && (
        <p className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-pink-50">
          {lastResult}
        </p>
      )}
      <button
        aria-disabled={isCoolingDown || undefined}
        className={`mt-4 w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40 ${
          isCoolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
        }`}
        disabled={disabled}
        onClick={() => {
          emitSoundEvent("button_click");
          if (isCoolingDown) {
            onCooldownAttempt?.(`Cooldown active. Available again in ${formatRemaining(cooldownRemaining)}.`);
            return;
          }

          onAction();
        }}
        type="button"
      >
        {isCoolingDown ? (
          <CooldownButtonContent label={`Available in ${formatRemaining(cooldownRemaining)}`} />
        ) : (
          actionLabel
        )}
      </button>
    </article>
  );
}

