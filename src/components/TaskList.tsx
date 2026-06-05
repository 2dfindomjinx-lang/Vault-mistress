import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { CoinAmount } from "@/components/CoinAmount";
import { IRL_TASK_WHEEL_COST, irlTaskWheelSegments } from "@/lib/irl-task-wheel";
import { JACKPOT_MIN_CONTRIBUTION, type LoyaltyJackpotState } from "@/lib/jackpot";
import type { MechanicsState, TaskItem } from "@/lib/types";

const SACRIFICE_COST = 250;
const SUPPORT_COST = 1000;
const JACKPOT_HIDE_CONTRIBUTORS_STORAGE_KEY = "vault:jackpot-hide-contributors";

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
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u00B4\u0060]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"');
}

function writingPreviewStartsWith(target: string, input: string) {
  return normalizeWritingPreview(target).startsWith(normalizeWritingPreview(input));
}

type TaskListProps = {
  coins: number;
  disabled?: boolean;
  mechanics: MechanicsState;
  tasks: TaskItem[];
  pendingTaskActionIds?: string[];
  highLowAllowanceCap: number;
  highLowProfitCap: number;
  isJackpotBusy?: boolean;
  jackpot: LoyaltyJackpotState | null;
  jackpotError?: string;
  currentUsername?: string;
  usernameStyle?: CSSProperties;
  onBeg: () => void;
  onClaim: (taskId: string) => void;
  onJackpotContribute: (amount: number) => void;
  onHighLowPlay: (guess: "higher" | "lower", stake: number) => void;
  onIrlTaskSpin: (wheelIndex: number) => Promise<void> | void;
  onNumberPick: (selectedNumber: number) => void;
  onRebrandProfile: () => void;
  onSacrifice: () => void;
  onSupport: () => void;
  onTimeoutRisk: () => void;
  onTypingProgress: (value: string) => void;
  timeoutRiskChance: number;
  timeoutRiskEffectiveDays: number;
  timeoutRiskMaxDays: number;
  timeoutRiskReward: number;
  onWaitObedientlyComplete: () => void;
  onWaitObedientlyFail: () => void;
  onWaitObedientlyStart: () => void;
};

export function TaskList({
  coins,
  disabled = false,
  highLowAllowanceCap,
  highLowProfitCap,
  isJackpotBusy = false,
  jackpot,
  jackpotError = "",
  currentUsername,
  mechanics,
  onBeg,
  onClaim,
  onJackpotContribute,
  onHighLowPlay,
  onIrlTaskSpin,
  onNumberPick,
  onRebrandProfile,
  pendingTaskActionIds = [],
  onSacrifice,
  onSupport,
  onTimeoutRisk,
  onTypingProgress,
  timeoutRiskChance,
  timeoutRiskEffectiveDays,
  timeoutRiskMaxDays,
  timeoutRiskReward,
  onWaitObedientlyComplete,
  onWaitObedientlyFail,
  onWaitObedientlyStart,
  tasks,
  usernameStyle,
}: TaskListProps) {
  const [now, setNow] = useState(0);
  const [typingValue, setTypingValue] = useState("");
  const [stake, setStake] = useState(10);
  const [irlWheelRotation, setIrlWheelRotation] = useState(0);
  const [isIrlWheelSpinning, setIsIrlWheelSpinning] = useState(false);
  const [showIrlTaskList, setShowIrlTaskList] = useState(false);
  const irlWheelTimerRef = useRef<number | null>(null);
  const isTaskActionPending = (actionId: string) => pendingTaskActionIds.includes(actionId);
  const isClaimPending = (taskId: string) => isTaskActionPending(`claim:${taskId}`);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      if (irlWheelTimerRef.current) {
        window.clearTimeout(irlWheelTimerRef.current);
      }
    };
  }, []);

  const handleIrlWheelSpinClick = () => {
    if (disabled || isIrlWheelSpinning) {
      return;
    }

    const selectedIndex = Math.floor(Math.random() * irlTaskWheelSegments.length);
    const segmentDegrees = 360 / irlTaskWheelSegments.length;
    const selectedCenter = selectedIndex * segmentDegrees + segmentDegrees / 2;
    const currentRotation = ((irlWheelRotation % 360) + 360) % 360;
    const targetRotation = (360 - selectedCenter) % 360;
    const rotationDelta = (targetRotation - currentRotation + 360) % 360;
    const finalRotation = irlWheelRotation + 360 * 6 + rotationDelta;

    setIsIrlWheelSpinning(true);
    setIrlWheelRotation(finalRotation);

    if (irlWheelTimerRef.current) {
      window.clearTimeout(irlWheelTimerRef.current);
    }

    irlWheelTimerRef.current = window.setTimeout(() => {
      void Promise.resolve(onIrlTaskSpin(selectedIndex)).finally(() => {
        setIsIrlWheelSpinning(false);
      });
    }, 3600);
  };

  const formatRemaining = (milliseconds: number) => {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
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
          : task.kind === "high-low"
            ? "Open"
          : task.claimed
            ? "Claimed"
            : task.completed
              ? "Ready"
              : "Open"}
    </span>
  );
  const visibleTasks = tasks.filter((task) => !isHiddenClaimedOneTimeTask(task));

  return (
    <section className="rounded-[2rem] border border-fuchsia-200/15 bg-black/50 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-pink-200/70">
          Tasks & Games
        </p>
        <h2 className="text-3xl font-black">Play the Vault</h2>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MechanicCard
          actionLabel="Beg"
          cooldownUntil={mechanics.begCooldownUntil}
          description="Ask for a tiny mercy. Most pleas are ignored; rarely, the vault drops 75 coins."
          disabled={disabled || isTaskActionPending("beg")}
          onAction={onBeg}
          title="Beg"
          now={now}
          formatRemaining={formatRemaining}
        />
        <MechanicCard
          actionLabel="Rebrand Profile"
          description="Consent-only profile rebrand preparation. No coin reward, no cooldown."
          disabled={disabled || isTaskActionPending("rebrand-profile")}
          onAction={onRebrandProfile}
          title="Rebrand for Principessa"
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
          const nextBaseRevealRemaining = task.nextBaseRevealAt
            ? new Date(task.nextBaseRevealAt).getTime() - now
            : 0;
          const isCoolingDown = cooldownRemaining > 0;
          const isWaitingForNextBase = nextBaseRevealRemaining > 0;
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

            return (
              <div
                className="grid gap-3 md:col-span-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)] lg:items-stretch"
                key="risk-wheel-layout"
              >
                <div className="flex min-h-full flex-col gap-3">
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
                      <p className="text-sm leading-6 text-zinc-300">
                        Risk is chance-based: {Math.round(timeoutRiskChance * 100)}% chance
                        to receive 12 hours timeout,{" "}
                        {Math.round((1 - timeoutRiskChance) * 100)}% chance to win{" "}
                        {timeoutRiskReward} Principessa Coins.
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
                        className="mt-3 w-full rounded-2xl border border-yellow-200/25 bg-yellow-400/10 px-4 py-3 text-sm font-black text-yellow-50 transition enabled:hover:border-yellow-100/60 enabled:hover:bg-yellow-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={task.completed || isTaskActionPending("timeout-risk") || timeoutRiskEffectiveDays >= timeoutRiskMaxDays}
                        onClick={onTimeoutRisk}
                        type="button"
                      >
                        {task.completed
                          ? "Daily limit reached"
                          : timeoutRiskEffectiveDays >= timeoutRiskMaxDays
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
                          Spin the wheel for {IRL_TASK_WHEEL_COST} Principessa Coins. The result becomes
                          your assigned IRL task.
                        </p>
                        <button
                          className="shrink-0 rounded-full border border-pink-200/20 bg-pink-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-pink-50 transition hover:border-pink-300/60 hover:bg-pink-500/20"
                          onClick={() => setShowIrlTaskList(true)}
                          type="button"
                        >
                          Task List
                        </button>
                      </div>
                      <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.14),rgba(0,0,0,0.5))] p-4">
                        {showIrlTaskList ? (
                          <IrlTaskWheelTaskList onClose={() => setShowIrlTaskList(false)} />
                        ) : (
                          <WheelSpinner
                            rotation={irlWheelRotation}
                            selectedIndex={irlTask.assignedIrlWheelIndex ?? null}
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
                            DM this task result to @Principessa2dfd with your app username.
                          </p>
                          <p className="mt-2 text-xs leading-5 text-rose-100/80">
                            If this task is not completed in time, admin may apply a
                            manual timeout. Throne support can be reviewed manually
                            to clear the task without affection gain.
                          </p>
                        </div>
                      )}
                      <button
                        className="mt-auto w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={
                          isIrlWheelSpinning ||
                          disabled ||
                          isTaskActionPending("irl-task-wheel") ||
                          coins < IRL_TASK_WHEEL_COST ||
                          Boolean(irlTask.assignedIrlTask) ||
                          Boolean(irlTask.timeoutUntil && new Date(irlTask.timeoutUntil).getTime() > now)
                        }
                        onClick={handleIrlWheelSpinClick}
                        type="button"
                      >
                        {isIrlWheelSpinning
                          ? "Spinning..."
                          : irlTask.assignedIrlTask
                            ? "Awaiting Admin Review"
                            : coins < IRL_TASK_WHEEL_COST
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
              className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4"
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
                        !task.completed ||
                        task.claimed ||
                        isTaskActionPending("typing-accuracy") ||
                        isClaimPending(task.id)
                      }
                      onClick={() => {
                        setTypingValue("");
                        onClaim(task.id);
                      }}
                      type="button"
                    >
                      Claim Reward
                    </button>
                  )}
                </div>
              )}

              {task.kind === "high-low" && (
                <div className="mt-4 rounded-2xl border border-pink-200/15 bg-black/35 p-3">
                  {(() => {
                    const highLowBetAllowance =
                      task.highLowBetAllowance ??
                      Math.max(0, highLowAllowanceCap - Math.max(0, task.highLowDailyBetTotal ?? 0));
                    const highLowStakeMax = Math.max(0, Math.min(coins, highLowBetAllowance));

                    return (
                      <>
                  <p className="text-sm text-zinc-400">Current number</p>
                  <p className="mt-1 text-4xl font-black text-white">
                    {task.currentNumber}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Display starts at 2-9. Result rolls 1-10. New base appears in 10s; replay cooldown is 15s.
                  </p>
                  {isWaitingForNextBase && (
                    <p className="mt-2 text-sm font-semibold text-pink-100">
                      Next base number in {formatRemaining(nextBaseRevealRemaining)}
                    </p>
                  )}
                  {task.resultOutcome && task.resultNumber ? (
                    <div className="mt-4 rounded-2xl border border-pink-200/25 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.18),rgba(0,0,0,0.42))] p-4 shadow-[0_0_24px_rgba(236,72,153,0.16)] animate-pulse">
                      <p className="text-xs uppercase tracking-[0.22em] text-fuchsia-200/70">
                        Result Reveal
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <ResultCell
                          label="Base Number"
                          value={task.resultBaseNumber ?? task.currentNumber ?? 0}
                        />
                        <ResultCell
                          label="Result Number"
                          value={task.resultNumber}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-3 py-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                            Outcome
                          </p>
                          <p
                            className={`mt-1 text-xl font-black ${
                              task.resultOutcome === "win"
                                ? "text-emerald-200"
                                : task.resultOutcome === "tie"
                                  ? "text-yellow-100"
                                  : "text-rose-200"
                            }`}
                          >
                            {task.resultOutcome === "tie"
                              ? "TIE"
                              : task.resultOutcome.toUpperCase()}
                          </p>
                        </div>
                        <p
                          className={`text-lg font-black ${
                            (task.resultCoinDelta ?? 0) > 0
                              ? "text-emerald-200"
                              : (task.resultCoinDelta ?? 0) < 0
                                ? "text-rose-200"
                                : "text-yellow-100"
                          }`}
                        >
                          {task.resultOutcome === "tie"
                            ? "Stake refunded"
                            : `${(task.resultCoinDelta ?? 0) > 0 ? "+" : ""}${task.resultCoinDelta ?? 0} Principessa Coins`}
                        </p>
                      </div>
                    </div>
                  ) : task.lastResult && (
                    <p className="mt-2 text-sm font-semibold text-pink-100">
                      {task.lastResult}
                    </p>
                  )}
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                        Daily Net Profit
                      </p>
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
                      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                        Wins Today
                      </p>
                      <p className="mt-1 text-lg font-black text-pink-50">
                        {task.highLowDailyWins ?? 0}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                        Bet Allowance
                      </p>
                      <p className="mt-1 text-lg font-black text-pink-50">
                        {highLowBetAllowance.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                        Lock
                      </p>
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
                      Higher or Lower daily profit or bet allowance limit reached.
                    </p>
                  )}
                  {!task.highLowDailyLocked && (
                    <p className="mt-3 text-xs font-semibold text-zinc-500">
                      Locks at {highLowProfitCap.toLocaleString()} daily net profit or after {highLowAllowanceCap.toLocaleString()} total coins are bet during the allowance period. Wins and losses consume allowance; ties refund and do not count.
                    </p>
                  )}
                  {!task.highLowDailyLocked && highLowBetAllowance <= 0 && (
                    <p className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-100">
                      Higher or Lower bet allowance is depleted.
                    </p>
                  )}
                  <label className="mt-3 block">
                    <span className="text-xs uppercase tracking-[0.2em] text-fuchsia-200/70">
                      Stake
                    </span>
                    <input
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-300/60 disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={disabled || isCoolingDown || task.highLowDailyLocked || highLowBetAllowance <= 0 || isTaskActionPending("high-low")}
                      min={1}
                      max={highLowStakeMax}
                      onChange={(event) => setStake(Number(event.target.value))}
                      type="number"
                      value={stake}
                    />
                  </label>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(["higher", "lower"] as const).map((guess) => (
                      <button
                      className="rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold capitalize text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={
                          disabled ||
                          isCoolingDown ||
                          isTaskActionPending("high-low") ||
                          task.highLowDailyLocked ||
                          stake <= 0 ||
                          stake > coins ||
                          stake > highLowBetAllowance
                        }
                        key={guess}
                        onClick={() => onHighLowPlay(guess, stake)}
                        type="button"
                      >
                        {guess}
                      </button>
                    ))}
                  </div>
                      </>
                    );
                  })()}
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
                          className={`rounded-2xl border px-4 py-5 text-2xl font-black transition disabled:cursor-not-allowed disabled:opacity-70 ${
                            hasResult && isCorrect
                              ? "border-emerald-200/50 bg-emerald-400/15 text-emerald-100"
                              : isWrongSelection || (hasResult && isSelected)
                                ? "border-rose-200/45 bg-rose-400/15 text-rose-100"
                                : "border-pink-200/20 bg-pink-500/10 text-pink-50 enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20"
                          }`}
                          disabled={disabled || isCoolingDown || isTaskActionPending("number-pick") || hasResult || isWrongSelection}
                          key={option}
                          onClick={() => onNumberPick(option)}
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
                  onFail={onWaitObedientlyFail}
                  onStart={onWaitObedientlyStart}
                  task={task}
                />
              )}

              {task.kind === "timeout-risk" && (
                <div className="mt-4 rounded-2xl border border-yellow-200/20 bg-[linear-gradient(145deg,rgba(250,204,21,0.12),rgba(236,72,153,0.08),rgba(0,0,0,0.4))] p-3">
                  <p className="text-sm leading-6 text-zinc-300">
                    Risk is chance-based: {Math.round(timeoutRiskChance * 100)}% chance
                    to receive 12 hours timeout, {Math.round((1 - timeoutRiskChance) * 100)}%
                    chance to win {timeoutRiskReward} Principessa Coins.
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
                    className="mt-3 w-full rounded-2xl border border-yellow-200/25 bg-yellow-400/10 px-4 py-3 text-sm font-black text-yellow-50 transition enabled:hover:border-yellow-100/60 enabled:hover:bg-yellow-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={task.completed || isTaskActionPending("timeout-risk") || timeoutRiskEffectiveDays >= timeoutRiskMaxDays}
                    onClick={onTimeoutRisk}
                    type="button"
                  >
                    {task.completed
                      ? "Daily limit reached"
                      : timeoutRiskEffectiveDays >= timeoutRiskMaxDays
                      ? "Maximum timeout reached."
                      : "Attempt Risk"}
                  </button>
                </div>
              )}

              {task.kind === "irl-wheel" && (
                <div className="mt-4 rounded-2xl border border-pink-200/15 bg-black/35 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <p className="text-sm leading-6 text-zinc-400">
                      Spin the wheel for {IRL_TASK_WHEEL_COST} Principessa Coins. The result becomes
                      your assigned IRL task.
                    </p>
                    <button
                      className="shrink-0 rounded-full border border-pink-200/20 bg-pink-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-pink-50 transition hover:border-pink-300/60 hover:bg-pink-500/20"
                      onClick={() => setShowIrlTaskList(true)}
                      type="button"
                    >
                      Task List
                    </button>
                  </div>
                  <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.14),rgba(0,0,0,0.5))] p-4">
                    {showIrlTaskList ? (
                      <IrlTaskWheelTaskList onClose={() => setShowIrlTaskList(false)} />
                    ) : (
                      <WheelSpinner
                        rotation={irlWheelRotation}
                        selectedIndex={task.assignedIrlWheelIndex ?? null}
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
                        DM this task result to @Principessa2dfd with your app username.
                      </p>
                      <p className="mt-2 text-xs leading-5 text-rose-100/80">
                        If this task is not completed in time, admin may apply a
                        manual timeout. Throne support can be reviewed manually
                        to clear the task without affection gain.
                      </p>
                    </div>
                  )}
                  <button
                    className="mt-3 w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={
                      isIrlWheelSpinning ||
                      disabled ||
                      isTaskActionPending("irl-task-wheel") ||
                      coins < IRL_TASK_WHEEL_COST ||
                      Boolean(task.assignedIrlTask) ||
                      Boolean(task.timeoutUntil && new Date(task.timeoutUntil).getTime() > now)
                    }
                    onClick={handleIrlWheelSpinClick}
                    type="button"
                  >
                    {isIrlWheelSpinning ? "Spinning..." : task.assignedIrlTask
                      ? "Awaiting Admin Review"
                        : coins < IRL_TASK_WHEEL_COST
                          ? `Need ${IRL_TASK_WHEEL_COST} Coins`
                          : `Spin — ${IRL_TASK_WHEEL_COST} Coins`}
                  </button>
                </div>
              )}

              {task.kind === "claim" && (
                <button
                  className="mt-4 w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={disabled || !isClaimable || isClaimPending(task.id)}
                  onClick={() => onClaim(task.id)}
                  type="button"
                >
                  {isCoolingDown
                    ? `Available in ${formatRemaining(cooldownRemaining)}`
                    : task.claimed
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

function IrlTaskWheelTaskList({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative">
      <button
        aria-label="Close task list"
        className="absolute right-0 top-0 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-sm font-black text-pink-50 transition hover:border-pink-200/60 hover:bg-pink-500/20"
        onClick={onClose}
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
        {irlTaskWheelSegments.map((task, index) => (
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
  spinning,
}: {
  rotation: number;
  selectedIndex: number | null;
  spinning: boolean;
}) {
  const segmentDegrees = 360 / 20;
  const settledRotation =
    selectedIndex === null
      ? rotation
      : (360 - (selectedIndex * segmentDegrees + segmentDegrees / 2)) % 360;
  const displayRotation = rotation !== 0 ? rotation : settledRotation;
  const activeIndex = spinning ? null : selectedIndex;
  const wheelGradient = Array.from({ length: 20 }, (_, index) => {
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
        {Array.from({ length: 20 }, (_, index) => {
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
        {spinning ? "Wheel Spinning" : "20-Segment IRL Wheel"}
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
          onClick={() => onContribute(cleanAmount)}
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
  username,
  usernameStyle,
}: {
  currentUsername?: string;
  username: string;
  usernameStyle?: CSSProperties;
}) {
  return <span style={username === currentUsername ? usernameStyle : undefined}>{username}</span>;
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

function ResultCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-center">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-1 text-4xl font-black text-white">{value}</p>
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
    if (isGloballyDisabled || isCoolingDown || isActionPending || phase === "countdown" || phase === "waiting") {
      return;
    }

    finishedRef.current = false;
    setCountdown(3);
    setWaitRemaining(60);
    setPhase("countdown");
    onStart();
  };

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
        className="mt-3 w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={
          isGloballyDisabled || isCoolingDown || isActionPending || phase === "countdown" || phase === "waiting"
        }
        onClick={startChallenge}
        type="button"
      >
        {displayPhase === "cooldown"
          ? `Available in ${formatRemaining(cooldownRemaining)}`
          : phase === "countdown" || phase === "waiting"
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
        className="mt-4 w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={disabled || isCoolingDown}
        onClick={onAction}
        type="button"
      >
        {isCoolingDown ? `Available in ${formatRemaining(cooldownRemaining)}` : actionLabel}
      </button>
    </article>
  );
}

