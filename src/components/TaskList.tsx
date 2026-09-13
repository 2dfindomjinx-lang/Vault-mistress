import ui from "./TaskExperience.module.css";
import { TaskExperienceCard, TaskProgress, TaskWaitDial, TaskInputSignal, taskExperienceState } from "./TaskExperience";
import { normalizeWritingText as normalizeWritingPreview } from "@/lib/writing-comparison";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {arrangeTaskCards} from "./task-layout";
import { CourtGlyph, WritingLine } from "@/components/court/CourtVisuals";
import { LevelDrainTransfer, type DrainVisualResult } from "@/components/court/LevelDrainTransfer";
import { CoinAmount } from "@/components/CoinAmount";
import { DisplayNameWithUsername } from "@/components/DisplayNameWithUsername";
import { DEFAULT_ADDRESS_TERM, type AddressTerm } from "@/lib/address-term";
import {
  getIrlTaskWheelSegments,
  IRL_TASK_WHEEL_COST,
  isFreeTaskFriday,
} from "@/lib/irl-task-wheel";
import { CASE_OPEN_REWARD_WEIGHTS } from "@/lib/server-task-actions";
import { useWheelSound } from "@/lib/use-animation-sound";
import { emitSoundEvent } from "@/lib/sound";
import type { TaskItem } from "@/lib/types";
import { useDeadlineClock } from "@/hooks/useDeadlineClock";

const CLICKABLE_COOLDOWN_BUTTON_CLASS =
  "cursor-not-allowed border-pink-400/35 bg-pink-950/55 text-zinc-500 shadow-none hover:border-pink-400/35 hover:bg-pink-950/55";
const CLICKABLE_COOLDOWN_TILE_CLASS = "cursor-not-allowed opacity-70";
const MOVEMENT_STAGE_IMAGES = [
  { min: 99, src: "/tasks/daily-motion/motion-99.webp" },
  { min: 75, src: "/tasks/daily-motion/motion-75.webp" },
  { min: 50, src: "/tasks/daily-motion/motion-50.webp" },
  { min: 25, src: "/tasks/daily-motion/motion-25.webp" },
  { min: 0, src: "/tasks/daily-motion/motion-0.webp" },
];
const MOVEMENT_COMPLETE_IMAGE = "/tasks/daily-motion/motion-complete.webp";
const MOVEMENT_STROKE_DISTANCE_PX = 80;
const GMT3_OFFSET_MS = 3 * 60 * 60 * 1000;
const CASE_OPEN_REEL_ITEM_WIDTH = 88;
const CASE_OPEN_REEL_ITEM_GAP = 10;
const CASE_OPEN_REEL_VISIBLE_COUNT = 5;
const CASE_OPEN_REEL_LANDING_INDEX = 24;
const CASE_OPEN_REEL_TAPE_LENGTH = 32;
const CASE_OPEN_ANIMATION_MS = 5000;

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
  addressTerm?: AddressTerm;
  coins: number;
  disabled?: boolean;
  disabledReason?: string;
  tasks: TaskItem[];
  pendingTaskActionIds?: string[];
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
  onClaim: (taskId: string) => void;
  onCaseOpen: () => Promise<number | null> | number | null;
  // Called once the reel animation actually lands on the reward, not when
  // onCaseOpen's API call resolves - keeps the speech-bubble reply from
  // spoiling the result before the reveal plays.
  onCaseOpenRevealed?: (reward: number) => void;
  onLevelDrain: () => DrainVisualResult | void | Promise<DrainVisualResult | void>;
  onIrlTaskSpin: (wheelIndex: number, useFreeFridaySpin?: boolean) => Promise<void> | void;
  onFreeFridaySpinConsumed?: () => void;
  onNumberPick: (selectedNumber: number) => void;
  onMovementFail: () => void;
  onMovementFinishFakeHope: () => void;
  onMovementProgress: (progress: number) => void;
  onMovementStart: () => void;
  onCooldownAttempt?: (message: string) => void;
  onTimeoutRisk: (multiplier: number) => Promise<"safe" | "timeout" | null> | void;
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


// The Risk My Freedom coin. Spins while the server decides, then lands on the
// face the ledger actually recorded - never on a guess. Shared by the grid
// card and the expanded card so the two can never drift apart.
function RiskCoin({ state }: { state: "idle" | "spin" | "safe" | "timeout" }) {
  return (
    <div className="mb-3 flex flex-col items-center" style={{ perspective: "640px" }}>
      <style>{`
        @keyframes vm-risk-coin-spin {
          from { transform: rotateX(0deg); }
          to   { transform: rotateX(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .vm-risk-coin { animation: none !important; transition: none !important; }
        }
      `}</style>
      <div
        className="vm-risk-coin relative h-20 w-20 [transform-style:preserve-3d]"
        style={
          state === "spin"
            ? { animation: "vm-risk-coin-spin 0.24s linear infinite" }
            : {
                transform: state === "timeout" ? "rotateX(1980deg)" : state === "safe" ? "rotateX(1800deg)" : "rotateX(0deg)",
                transition: state === "idle" ? "none" : "transform 900ms cubic-bezier(0.22, 0.9, 0.32, 1)",
              }
        }
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full border-2 border-yellow-200/60 bg-[radial-gradient(circle_at_35%_30%,#fde68a,#b45309_78%)] text-black [backface-visibility:hidden]">
          <span className="text-3xl leading-none">♛</span>
          <span className="mt-0.5 text-[8px] font-black uppercase tracking-[0.16em]">Free</span>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full border-2 border-rose-300/50 bg-[radial-gradient(circle_at_35%_30%,#4c0519,#180207_78%)] text-rose-100 [backface-visibility:hidden] [transform:rotateX(180deg)]">
          <span className="text-3xl leading-none">⛓</span>
          <span className="mt-0.5 text-[8px] font-black uppercase tracking-[0.16em]">Timeout</span>
        </div>
      </div>
      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-yellow-100/50">
        {state === "spin" ? "In the air..." : state === "safe" ? "She let you keep it" : state === "timeout" ? "She took your freedom" : "Her coin decides"}
      </p>
    </div>
  );
}

export function TaskList({
  addressTerm = DEFAULT_ADDRESS_TERM,
  coins,
  disabled = false,
  disabledReason = "Timeout active. This task is locked.",
  currentUsername,
  globalPrincipessaLevel,
  globalPrincipessaProgressPercent,
  globalPrincipessaRequirement,
  globalPrincipessaXp,
  onClaim,
  onCaseOpen,
  onCaseOpenRevealed,
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
  const now = useDeadlineClock(
    tasks.flatMap((task) => [task.cooldownUntil, task.timeoutUntil, task.assignedIrlDueAt]),
    30_000,
  );
  const [typingValue, setTypingValue] = useState("");
  const [drainVisual,setDrainVisual] = useState<(DrainVisualResult & {key:number}) | null>(null);
  // Risk My Freedom coin. "spin" while the server decides, then the coin lands
  // on the face the ledger actually recorded - never on a guess.
  const [riskFlip, setRiskFlip] = useState<"idle" | "spin" | "safe" | "timeout">("idle");
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
  const [caseOpenError, setCaseOpenError] = useState("");
  const [caseOpenRequestPending, setCaseOpenRequestPending] = useState(false);
  const caseOpenRequestRef = useRef(false);
  const [caseOpenTape, setCaseOpenTape] = useState<number[]>([]);
  const [caseOpenOffset, setCaseOpenOffset] = useState(0);
  const [caseOpenResolvedReward, setCaseOpenResolvedReward] = useState<number | null>(null);
  const [caseOpenActiveIndex, setCaseOpenActiveIndex] = useState<number | null>(null);
  const irlWheelTimerRef = useRef<number | null>(null);
  const caseOpenAnimationFrameRef = useRef<number | null>(null);
  const caseOpenAnimationRunRef = useRef(0);
  const caseOpenLastTickIndexRef = useRef(0);
  const isTaskActionPending = useCallback(
    (actionId: string) => pendingTaskActionIds.includes(actionId),
    [pendingTaskActionIds],
  );
  const monthlyResetRemaining = getNextGmt3MonthlyResetMs(now);
  const isClaimPending = (taskId: string) => isTaskActionPending(`claim:${taskId}`);
  const isCaseOpenPending = isTaskActionPending("case-opening");
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
  const stopCaseOpenAnimation = useCallback(() => {
    caseOpenAnimationRunRef.current += 1;
    if (caseOpenAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(caseOpenAnimationFrameRef.current);
      caseOpenAnimationFrameRef.current = null;
    }
  }, []);
  const resetCaseOpenDisplay = useCallback(() => {
    stopCaseOpenAnimation();
    setCaseOpenPhase("idle");
    setCaseOpenTape([]);
    setCaseOpenOffset(0);
    setCaseOpenResolvedReward(null);
    setCaseOpenActiveIndex(null);
  }, [stopCaseOpenAnimation]);
  const runCaseOpenAnimation = useCallback((reward: number) => {
    stopCaseOpenAnimation();
    const runId = caseOpenAnimationRunRef.current;
    const slotSize = caseOpenSlotSize;
    const totalDistance = CASE_OPEN_REEL_LANDING_INDEX * slotSize;
    let startTime: number | null = null;

    caseOpenLastTickIndexRef.current = 0;
    setCaseOpenPhase("rolling");
    setCaseOpenResolvedReward(null);
    setCaseOpenActiveIndex(0);
    setCaseOpenOffset(0);

    const easeOutQuart = (progress: number) => 1 - Math.pow(1 - progress, 4);

    const step = (timestamp: number) => {
      if (caseOpenAnimationRunRef.current !== runId) {
        return;
      }

      if (startTime === null) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / CASE_OPEN_ANIMATION_MS);
      const easedProgress = easeOutQuart(progress);
      const travelled = totalDistance * easedProgress;
      const activeIndex = Math.max(
        0,
        Math.min(CASE_OPEN_REEL_LANDING_INDEX, Math.round(travelled / slotSize)),
      );

      setCaseOpenOffset(-travelled);
      setCaseOpenActiveIndex(activeIndex);

      while (caseOpenLastTickIndexRef.current < activeIndex) {
        caseOpenLastTickIndexRef.current += 1;
        emitSoundEvent("crate_reel_tick");
      }

      if (progress < 1) {
        caseOpenAnimationFrameRef.current = window.requestAnimationFrame(step);
        return;
      }

      caseOpenAnimationFrameRef.current = null;
      setCaseOpenOffset(-totalDistance);
      setCaseOpenActiveIndex(CASE_OPEN_REEL_LANDING_INDEX);
      setCaseOpenResolvedReward(reward);
      setCaseOpenPhase("idle");
      onCaseOpenRevealed?.(reward);
    };

    caseOpenAnimationFrameRef.current = window.requestAnimationFrame(step);
  }, [caseOpenSlotSize, stopCaseOpenAnimation, onCaseOpenRevealed]);
  const handleCooldownAttempt = (message: string) => {
    emitSoundEvent("button_click");
    onCooldownAttempt?.(message);
  };

  useEffect(() => () => {
    if (irlWheelTimerRef.current) {
      window.clearTimeout(irlWheelTimerRef.current);
    }
    stopCaseOpenAnimation();
  }, [stopCaseOpenAnimation]);

  const movementTask = tasks.find((task) => task.kind === "movement");

  useEffect(() => {
    const handleVisibilityReset = () => {
      if (document.visibilityState === "hidden") {
        resetCaseOpenDisplay();
      }
    };

    const handlePageHide = () => {
      resetCaseOpenDisplay();
    };

    document.addEventListener("visibilitychange", handleVisibilityReset);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityReset);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [resetCaseOpenDisplay]);

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
    const wheelSegments = getIrlTaskWheelSegments(addressTerm, isFreeFridayEventActive);
    const selectedIndex = Math.floor(Math.random() * wheelSegments.length);
    const segmentDegrees = 360 / wheelSegments.length;
    const selectedCenter = selectedIndex * segmentDegrees;
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
  const wheelSegments = getIrlTaskWheelSegments(addressTerm, isFreeFridayEventActive);
  const isFreeFriday = isFreeFridayEventActive && isFreeFridaySpinAvailable;

  return (
    <section className={ui.list}>
      <div className={ui.sectionHeading} data-mark="III">
        <div>
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#d7ad69]/55">
          Daily rewards
        </p>
        <h2 className="mt-1 font-serif text-3xl font-semibold text-[#fff0d2]">Classic Games</h2>
        </div>
      </div>

      <TaskExperienceCard kind="level-drain" taskId="level-drain" title="Strengthen Principessa" state={drainVisual ? "complete" : isTaskActionPending("level-drain") ? "busy" : "ready"}>
<div className={ui.strength}>
          <div className={ui.strengthArt}><Image src="/principessa-ui/atelier/v4/strength_v4.webp" alt="Golden XP gathers in Principessa’s hand" fill sizes="(max-width:700px) 90vw, 38vw" unoptimized/><span>Yours, made hers.</span></div>
          <div className={ui.strengthBody}>
            <p className={ui.strengthLead}>Your devotion. Her power.</p>
            <p className={ui.strengthDescription}>Give her all your current XP. She receives one quarter.</p>
            <div className={ui.strengthTransfer}>
              <div><small>Your level</small><strong>{userLevel}</strong><span>{userXpRequiredForNext === null ? "MAX" : Math.floor(userXpIntoLevel).toLocaleString()+" / "+userXpRequiredForNext.toLocaleString()+" XP"}</span><div className={ui.strengthMeter}><i style={{width:userLevelProgressPercent+"%"}}/></div></div>
              <span className={ui.strengthArrow} aria-hidden="true">↗</span>
              <div><small>Principessa’s level</small><strong>{globalPrincipessaLevel}</strong><span>{globalPrincipessaRequirement === null ? "MAX" : globalPrincipessaXp.toLocaleString()+" / "+globalPrincipessaRequirement.toLocaleString()+" XP"}</span><div className={ui.strengthMeter}><i style={{width:globalPrincipessaProgressPercent+"%"}}/></div></div>
            </div>
            <div className={ui.strengthFooter}><button className={ui.strengthButton} disabled={disabled || userLevel < 2 || isTaskActionPending("level-drain")} onClick={async () => {emitSoundEvent("button_click");setDrainVisual(null);const result=await onLevelDrain();if(result)setDrainVisual({...result,key:Date.now()});}} type="button">{isTaskActionPending("level-drain") ? "Draining…" : userLevel < 2 ? "Requires Level 2" : "Give her all your XP"}<span aria-hidden="true">↗</span></button><span>Monthly reset <strong>{formatRemaining(monthlyResetRemaining)}</strong></span></div>
          </div>
        </div>
{drainVisual && <LevelDrainTransfer key={drainVisual.key} result={drainVisual}/>}
</TaskExperienceCard>

      <div className={ui.grid}>
        {arrangeTaskCards(visibleTasks).map((task) => {
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
                className={ui.group}
                key="risk-wheel-layout"
              >
                <div className={ui.group}>
          <TaskExperienceCard kind="timeout-risk" taskId={task.id} title={task.title} reward={<>{task.reward} Principessa Coins</>} status={renderStatus(task, false)} state={riskFlip === "spin" ? "active" : riskFlip === "safe" ? "won" : riskFlip === "timeout" ? "lost" : taskExperienceState(task, now, isTaskActionPending(task.id))}>
<div className={ui.stage}>
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
                            disabled={disabled || (task.timeoutRiskMultiplier ?? 1) >= 2}
                            onClick={() => onTimeoutRiskMultiplierChange("up")}
                            type="button"
                          >
                            ↑
                          </button>
                        </div>
                      </div>
                      <div className={ui.riskArena} data-outcome={riskFlip}><div><strong>{Math.round((1 - timeoutRiskChance) * 100)}<small>%</small></strong><span>Win Coins</span></div><RiskCoin state={riskFlip} /><div><strong>{Math.round(timeoutRiskChance * 100)}<small>%</small></strong><span>Timeout</span></div></div>
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

                          const runRiskFlip = async () => {
                            if (riskFlip !== "idle") return;
                            setRiskFlip("spin");
                            const outcome = await Promise.resolve(onTimeoutRisk(task.timeoutRiskMultiplier ?? 1));
                            if (outcome === "safe" || outcome === "timeout") {
                              setRiskFlip(outcome);
                              window.setTimeout(() => setRiskFlip("idle"), 2_400);
                            } else {
                              setRiskFlip("idle");
                            }
                          };
                          void runRiskFlip();
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
</TaskExperienceCard>

                  {waitTask && (
          <TaskExperienceCard kind="wait-obediently" taskId={waitTask.id} title={waitTask.title} reward={<>{waitTask.reward} Principessa Coins</>} status={renderStatus(waitTask, isWaitCoolingDown)} state={taskExperienceState(waitTask, now, isTaskActionPending(waitTask.id))} notice={<>{isWaitCoolingDown && <p>Available again in {formatRemaining(waitCooldownRemaining)}</p>}{disabled && <p>{disabledReason}</p>}</>}>
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
</TaskExperienceCard>
                  )}
                </div>

                {irlTask && (
          <TaskExperienceCard kind="irl-wheel" taskId={irlTask.id} title={irlTask.title} status={renderStatus(irlTask, isIrlCoolingDown)} state={isIrlWheelSpinning ? "active" : taskExperienceState(irlTask, now, isTaskActionPending(irlTask.id))} notice={<>{isIrlCoolingDown && <p>Available again in {formatRemaining(irlCooldownRemaining)}</p>}{disabled && <p>{disabledReason}</p>}</>}>
<div className={ui.stage}>
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
                      <div className={ui.wheelStage}>
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
                        <div className="court-assigned-order mt-3 rounded-2xl border border-pink-200/25 bg-pink-500/10 px-3 py-3">
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
</TaskExperienceCard>
                )}
              </div>
            );
          }

          if (isGroupedWheelLayoutKind(task.kind)) {
            return null;
          }

          return (
            <TaskExperienceCard key={task.id} kind={task.kind} taskId={task.id} title={task.title} reward={task.reward > 0 ? <>{task.kind === "number-pick" ? 100 : task.reward} Principessa Coins</> : undefined} status={renderStatus(task, isTimeoutRisk ? false : isCoolingDown)} state={task.kind === "case-open" && caseOpenPhase === "rolling" ? "active" : task.kind === "movement" && movementLocalActive ? "active" : taskExperienceState(task, now, isTaskActionPending(task.id))} wide={task.kind === "movement" && (movementLocalActive || task.movementState === "completed")} reaction={task.attemptsRemaining ?? task.lastResult ?? ""} notice={<>{isCoolingDown && <p>Available again in {formatRemaining(cooldownRemaining)}</p>}{disabled && <p>{disabledReason}</p>}</>}>
{task.kind === "typing" && (
                <div className={ui.stage}>
                  <p
                    className={ui.writingPrompt}
                    onContextMenu={(event) => event.preventDefault()}
                    onCopy={(event) => event.preventDefault()}
                    onCut={(event) => event.preventDefault()}
                  >
                    <WritingLine text={task.sentence ?? ""} value={typingValue} complete={task.completed}/>
                  </p>
                  <><TaskInputSignal count={task.attemptsRemaining ?? 3} total={3} label="Attempts left" /><TaskProgress value={typingValue.length} total={(task.sentence ?? "").length} label="Characters" /></>
                  <input
                    className={ui.writingInput + " px-4 py-3"}
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
                <div className={ui.stage}>
                  <p className="text-sm leading-6 text-zinc-400">
                    Open a luxury case and let the vault roll a random coin reward.
                  </p>
                  <div className={ui.reelWindow}>
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
                        className={ui.reelTrack + " flex items-center gap-[10px]"} data-rolling={caseOpenPhase === "rolling"}
                        style={{
                          paddingLeft: caseOpenTrackSidePadding,
                          paddingRight: caseOpenTrackSidePadding,
                          transform: `translateX(${caseOpenTape.length > 0 ? caseOpenOffset : -Math.floor(caseOpenPreviewValues.length / 2) * caseOpenSlotSize}px)`,
                          transition: "none",
                        }}
                      >
                        {(caseOpenTape.length > 0
                          ? caseOpenTape
                          : caseOpenPreviewValues
                        ).map((value, index) => (
                          <div
                            key={`${value}-${index}-${caseOpenPhase}`}
                            className={`flex h-16 shrink-0 items-center justify-center rounded-2xl border px-3 text-center shadow-[0_10px_30px_rgba(0,0,0,0.32)] transition ${
                              caseOpenPhase === "rolling" && index === caseOpenActiveIndex
                                ? "border-pink-100/60 bg-[linear-gradient(160deg,rgba(251,113,133,0.34),rgba(24,24,27,0.94))] shadow-[0_0_28px_rgba(244,114,182,0.22)]"
                                : "border-white/10 bg-[linear-gradient(160deg,rgba(236,72,153,0.18),rgba(24,24,27,0.92))]"
                            }`}
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
                    {caseOpenPhase === "idle" && caseOpenResolvedReward != null ? (
                      <p className="mt-4 rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-3 py-2 text-center text-sm font-semibold text-emerald-100">
                        <span className="court-number-reveal inline-flex items-center gap-2" key={caseOpenResolvedReward}><span className="h-5 w-5"><CourtGlyph symbol="coin"/></span>+{caseOpenResolvedReward} Principessa Coins</span>
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
                    disabled={disabled || isCoolingDown || isCaseOpenPending || caseOpenRequestPending || caseOpenPhase === "rolling"}
                    onClick={async () => {
                      if (caseOpenRequestRef.current) return;
                      if (isCoolingDown) {
                        handleCooldownAttempt(`Cooldown active. Available again in ${formatRemaining(cooldownRemaining)}.`);
                        return;
                      }

                      emitSoundEvent("button_click");
                      caseOpenRequestRef.current = true;
                      setCaseOpenRequestPending(true);
                      setCaseOpenError("");
                      setCaseOpenResolvedReward(null);
                      stopCaseOpenAnimation();
                      setCaseOpenTape([]);
                      setCaseOpenOffset(0);
                      setCaseOpenActiveIndex(null);
                      setCaseOpenPhase("idle");

                      try {
                        const reward = await onCaseOpen();
                        if (typeof reward !== "number") {
                          throw new Error("Case Opening is not available. Please try again.");
                        }
                        setCaseOpenTape(buildCaseOpenTape(reward));
                        setCaseOpenPhase("rolling");
                        window.requestAnimationFrame(() => runCaseOpenAnimation(reward));
                      } catch (error) {
                        setCaseOpenError(error instanceof Error ? error.message : "Case Opening failed. Please try again.");
                      } finally {
                        caseOpenRequestRef.current = false;
                        setCaseOpenRequestPending(false);
                      }
                    }}
                    type="button"
                  >
                    {isCaseOpenPending || caseOpenRequestPending || caseOpenPhase === "rolling" ? (
                      "Opening..."
                    ) : isCoolingDown ? (
                      <CooldownButtonContent label={`Available in ${formatRemaining(cooldownRemaining)}`} />
                    ) : (
                      "Open Case"
                    )}
                  </button>
                  {caseOpenError ? <p role="alert" className="mt-3 rounded-xl border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{caseOpenError}</p> : null}
                </div>
              )}
{task.kind === "number-pick" && (
                <div className={ui.stage}>
                  <p className="text-sm leading-6 text-zinc-400">
                    Pick the correct number in one try to win 100 Principessa Coins.
                  </p>
                  <div className={ui.numberTable}>
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
                          data-selected={isSelected}
                          className={ui.numberChoice + (isCoolingDown ? " " + CLICKABLE_COOLDOWN_TILE_CLASS : "")}
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
                         data-result={hasResult && isCorrect ? "win" : isWrongSelection || (hasResult && isSelected) ? "loss" : "ready"}><small>SEALED NUMBER</small>
                          <span className={hasResult ? "court-number-reveal block" : "block"} key={String(hasResult)}>{option}</span>
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
                    (task.numberPickAttemptsRemaining ?? 1) < 1 &&
                    (task.numberPickWrongSelections ?? []).length > 0 && (
                      <p className="mt-3 rounded-2xl border border-rose-200/20 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-100">
                        Wrong. Better luck tomorrow.
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
                      className={ui.stage}
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
                        <><div className={ui.motionIdle}><span aria-hidden="true">↕</span><small>QUICK, VERTICAL MOVEMENTS</small></div><p className="text-sm leading-6 text-zinc-400">
                          Press Start, then use quick medium-length vertical movements. Slow or tiny
                          movements do not count.
                        </p></>
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
                            <div className={ui.motionHud}><div><p>KEEP THE RHYTHM</p><strong>{Math.round(currentMovementProgress)}<small>%</small></strong></div><div><p>INACTIVITY LIMIT</p><strong>{inactivityRemaining}<small>s</small></strong></div></div>
                          )}
                          <TaskProgress value={Math.round(currentMovementProgress)} total={100} label="Motion" state={task.movementState ?? "ready"} />
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
                <div className={ui.stage}>
                  <div className={ui.riskArena} data-outcome={riskFlip}><div><strong>{Math.round((1 - timeoutRiskChance) * 100)}<small>%</small></strong><span>Win Coins</span></div><RiskCoin state={riskFlip} /><div><strong>{Math.round(timeoutRiskChance * 100)}<small>%</small></strong><span>Timeout</span></div></div>
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

                      const runRiskFlip = async () => {
                            if (riskFlip !== "idle") return;
                            setRiskFlip("spin");
                            const outcome = await Promise.resolve(onTimeoutRisk(task.timeoutRiskMultiplier ?? 1));
                            if (outcome === "safe" || outcome === "timeout") {
                              setRiskFlip(outcome);
                              window.setTimeout(() => setRiskFlip("idle"), 2_400);
                            } else {
                              setRiskFlip("idle");
                            }
                          };
                      void runRiskFlip();
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
                <div className={ui.stage}>
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
                  <div className={ui.wheelStage}>
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
                <div className={ui.claimStage}><span aria-hidden="true">P</span><p>{task.claimed ? "Your daily audience is recorded." : "A place in her court, every day."}</p><footer className={ui.action}><button
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
                      ? <><span className="court-claim-seal"><CourtGlyph symbol="seal"/></span>Reward Claimed</>
                      : "Claim Reward"}
                </button></footer></div>
              )}
</TaskExperienceCard>
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
  const wheelRef = useRef<HTMLDivElement>(null);
  useWheelSound(wheelRef, spinning, segmentCount);
  const safeSegmentCount = Math.max(1, segmentCount);
  const segmentDegrees = 360 / safeSegmentCount;
  const settledRotation =
    selectedIndex === null
      ? rotation
      : (360 - selectedIndex * segmentDegrees) % 360;
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
      <div data-spinning={spinning} className="court-wheel-pointer absolute -top-1 z-20 h-0 w-0 border-x-[12px] border-t-[22px] border-x-transparent border-t-pink-100 drop-shadow-[0_0_10px_rgba(244,114,182,0.9)]" />
      <div
        ref={wheelRef}
        onTransitionEnd={event => { if (event.target === event.currentTarget && event.propertyName === "transform") emitSoundEvent("wheel_verdict"); }}
        className="relative aspect-square w-full max-w-[18rem] rounded-full border border-pink-100/35 shadow-[0_0_34px_rgba(236,72,153,0.28)] transition-transform duration-[3600ms] ease-out"
        style={{
          background: `conic-gradient(from ${-segmentDegrees / 2}deg, ${wheelGradient})`,
          transform: `rotate(${displayRotation}deg)`,
        }}
      >
        <div className="absolute inset-2 rounded-full border border-black/35" />
        <div className="absolute inset-[42%] rounded-full border border-pink-100/40 bg-black shadow-[0_0_18px_rgba(0,0,0,0.6)]" />
        {Array.from({ length: safeSegmentCount }, (_, index) => {
          const angle = index * segmentDegrees;
          const radians = angle * Math.PI / 180;
          const isActive = activeIndex === index;

          return (
            <span
              className={`absolute flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                isActive
                  ? "bg-white text-pink-600 shadow-[0_0_14px_rgba(255,255,255,0.9)]"
                  : "bg-black/35 text-pink-50"
              }`}
              key={index}
              style={{
                left: `${50 + 43 * Math.sin(radians)}%`,
                top: `${50 - 43 * Math.cos(radians)}%`,
                transform: `translate(-50%, -50%) rotate(${-displayRotation}deg)`,
                transition: "transform 3600ms ease-out",
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
    <div className={ui.stage}>
      <p className="text-sm leading-6 text-zinc-400">
        Press Ready, survive a 3 second countdown, then avoid every input for 1 minute.
      </p>
      <TaskWaitDial seconds={phase === "countdown" ? countdown : waitRemaining} total={60} state={displayPhase} /><div className={ui.waitStatus}>
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
