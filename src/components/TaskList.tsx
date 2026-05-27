import { useEffect, useRef, useState } from "react";
import type { MechanicsState, TaskItem } from "@/lib/types";

type TaskListProps = {
  coins: number;
  mechanics: MechanicsState;
  tasks: TaskItem[];
  onBeg: () => void;
  onClaim: (taskId: string) => void;
  onHighLowPlay: (guess: "higher" | "lower", stake: number) => void;
  onIrlTaskSpin: (wheelIndex: number) => Promise<void> | void;
  onSacrifice: () => void;
  onSupport: () => void;
  onTypingProgress: (value: string) => void;
};

export function TaskList({
  coins,
  mechanics,
  onBeg,
  onClaim,
  onHighLowPlay,
  onIrlTaskSpin,
  onSacrifice,
  onSupport,
  onTypingProgress,
  tasks,
}: TaskListProps) {
  const [now, setNow] = useState(0);
  const [typingValue, setTypingValue] = useState("");
  const [stake, setStake] = useState(10);
  const [irlWheelRotation, setIrlWheelRotation] = useState(0);
  const [isIrlWheelSpinning, setIsIrlWheelSpinning] = useState(false);
  const [pendingIrlWheelIndex, setPendingIrlWheelIndex] = useState<number | null>(null);
  const irlWheelTimerRef = useRef<number | null>(null);

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
    if (isIrlWheelSpinning) {
      return;
    }

    const selectedIndex = Math.floor(Math.random() * 20);
    const segmentDegrees = 360 / 20;
    const selectedCenter = selectedIndex * segmentDegrees + segmentDegrees / 2;
    const currentRotation = ((irlWheelRotation % 360) + 360) % 360;
    const targetRotation = (360 - selectedCenter) % 360;
    const rotationDelta = (targetRotation - currentRotation + 360) % 360;
    const finalRotation = irlWheelRotation + 360 * 6 + rotationDelta;

    setPendingIrlWheelIndex(selectedIndex);
    setIsIrlWheelSpinning(true);
    setIrlWheelRotation(finalRotation);

    if (irlWheelTimerRef.current) {
      window.clearTimeout(irlWheelTimerRef.current);
    }

    irlWheelTimerRef.current = window.setTimeout(() => {
      void onIrlTaskSpin(selectedIndex);
      setIsIrlWheelSpinning(false);
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
          : task.claimed
            ? "Claimed"
            : task.completed
              ? "Ready"
              : "Open"}
    </span>
  );

  return (
    <section className="rounded-[2rem] border border-fuchsia-200/15 bg-black/50 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-pink-200/70">
          Daily Tasks
        </p>
        <h2 className="text-3xl font-black">Earn Principessa Coins</h2>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <MechanicCard
          actionLabel="Beg"
          cooldownUntil={mechanics.begCooldownUntil}
          description="Ask for a tiny mercy. Most pleas are ignored; rarely, the vault drops 25 coins."
          onAction={onBeg}
          title="Beg"
          now={now}
          formatRemaining={formatRemaining}
        />
        <MechanicCard
          actionLabel={mechanics.sacrificeComplete ? "Collection Complete" : "Sacrifice 50 Coins"}
          cooldownUntil={mechanics.sacrificeCooldownUntil}
          description={`Burn 50 coins for a 50% chance to unlock a hidden Sacrifice Collection image. ${mechanics.sacrificeUnlockedCount}/${mechanics.sacrificeTotal} unlocked.`}
          disabled={mechanics.sacrificeComplete || coins < 50}
          lastResult={mechanics.sacrificeLastResult}
          onAction={onSacrifice}
          title="Sacrifice"
          now={now}
          formatRemaining={formatRemaining}
        />
        <MechanicCard
          actionLabel="Support 100 Coins"
          description={
            mechanics.supportUnlocked
              ? "Spend 100 coins for a special dialogue moment. More rewards can be attached later."
              : "Unlock every normal and Sacrifice Collection image to open this endgame mechanic."
          }
          disabled={!mechanics.supportUnlocked || coins < 100}
          lastResult={mechanics.supportLastResult}
          onAction={onSupport}
          title="Support"
          now={now}
          formatRemaining={formatRemaining}
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {tasks.map((task) => {
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
                      Reward: {task.reward} Principessa Coins
                    </p>
                  )}
                  {isCoolingDown && (
                    <p className="mt-2 text-sm font-semibold text-pink-100">
                      Available again in {formatRemaining(cooldownRemaining)}
                    </p>
                  )}
                </div>
                {renderStatus(task, isCoolingDown)}
              </div>

              {task.kind === "typing" && (
                <div className="mt-4 rounded-2xl border border-pink-200/15 bg-black/35 p-3">
                  <p className="text-sm leading-6 text-pink-50">
                    {task.sentence}
                  </p>
                  <p className="mt-2 text-lg" aria-label={`${task.attemptsRemaining ?? 3} attempts remaining`}>
                    {"❤️".repeat(task.attemptsRemaining ?? 3)}
                    {"♡".repeat(Math.max(0, 3 - (task.attemptsRemaining ?? 3)))}
                  </p>
                  <input
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-300/60 disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={isCoolingDown || task.completed}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setTypingValue(nextValue);
                      onTypingProgress(nextValue);

                      if (task.sentence && !task.sentence.startsWith(nextValue)) {
                        setTypingValue("");
                      }
                    }}
                    placeholder="Type the sentence exactly"
                    value={typingValue}
                  />
                  {task.completed && !task.claimed && (
                    <button
                      className="mt-3 w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold text-pink-50 transition hover:border-pink-300/60 hover:bg-pink-500/20"
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
                  <label className="mt-3 block">
                    <span className="text-xs uppercase tracking-[0.2em] text-fuchsia-200/70">
                      Stake
                    </span>
                    <input
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-300/60 disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={isCoolingDown || task.claimed}
                      min={1}
                      max={coins}
                      onChange={(event) => setStake(Number(event.target.value))}
                      type="number"
                      value={stake}
                    />
                  </label>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(["higher", "lower"] as const).map((guess) => (
                      <button
                      className="rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold capitalize text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={isCoolingDown || stake <= 0 || stake > coins}
                        key={guess}
                        onClick={() => onHighLowPlay(guess, stake)}
                        type="button"
                      >
                        {guess}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {task.kind === "irl-wheel" && (
                <div className="mt-4 rounded-2xl border border-pink-200/15 bg-black/35 p-3">
                  <p className="text-sm leading-6 text-zinc-400">
                    Spin the wheel for 1000 Principessa Coins. The result becomes
                    your assigned IRL task.
                  </p>
                  <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.14),rgba(0,0,0,0.5))] p-4">
                    <WheelSpinner
                      pendingIndex={pendingIrlWheelIndex}
                      rotation={irlWheelRotation}
                      selectedIndex={task.assignedIrlWheelIndex ?? null}
                      spinning={isIrlWheelSpinning}
                    />
                    <div className="hidden">
                      {Array.from({ length: 20 }, (_, index) => {
                        const isSelected = task.assignedIrlWheelIndex === index;

                        return (
                          <div
                            className={`aspect-square rounded-full border text-center text-[0.65rem] font-black leading-8 transition ${
                              isSelected
                                ? "border-pink-200 bg-pink-500 text-white shadow-[0_0_18px_rgba(236,72,153,0.65)]"
                                : "border-white/10 bg-black/45 text-pink-100/60"
                            }`}
                            key={index}
                          >
                            {index + 1}
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-center text-xs uppercase tracking-[0.2em] text-fuchsia-200/70">
                      20-Segment IRL Wheel
                    </p>
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
                      coins < 1000 ||
                      Boolean(task.assignedIrlTask) ||
                      Boolean(task.timeoutUntil && new Date(task.timeoutUntil).getTime() > now)
                    }
                    onClick={handleIrlWheelSpinClick}
                    type="button"
                  >
                    {isIrlWheelSpinning ? "Spinning..." : task.assignedIrlTask
                      ? "Awaiting Admin Review"
                      : coins < 1000
                        ? "Need 1000 Coins"
                        : "Spin — 1000 Coins"}
                  </button>
                </div>
              )}

              {task.kind === "claim" && (
                <button
                  className="mt-4 w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!isClaimable}
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

function WheelSpinner({
  pendingIndex,
  rotation,
  selectedIndex,
  spinning,
}: {
  pendingIndex: number | null;
  rotation: number;
  selectedIndex: number | null;
  spinning: boolean;
}) {
  const segmentDegrees = 360 / 20;
  const settledRotation =
    selectedIndex === null
      ? rotation
      : (360 - (selectedIndex * segmentDegrees + segmentDegrees / 2)) % 360;
  const displayRotation = spinning ? rotation : settledRotation;
  const activeIndex = spinning ? pendingIndex : selectedIndex;
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

function ResultCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-center">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-1 text-4xl font-black text-white">{value}</p>
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
