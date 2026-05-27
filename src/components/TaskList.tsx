import { useEffect, useState } from "react";
import type { MechanicsState, TaskItem } from "@/lib/types";

type TaskListProps = {
  coins: number;
  mechanics: MechanicsState;
  tasks: TaskItem[];
  onBeg: () => void;
  onClaim: (taskId: string) => void;
  onHighLowPlay: (guess: "higher" | "lower", stake: number) => void;
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
  onSacrifice,
  onSupport,
  onTypingProgress,
  tasks,
}: TaskListProps) {
  const [now, setNow] = useState(0);
  const [typingValue, setTypingValue] = useState("");
  const [stake, setStake] = useState(10);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, []);

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
          ? "bg-emerald-400/15 text-emerald-100"
          : task.completed
            ? "bg-pink-500/20 text-pink-100"
            : "bg-white/10 text-zinc-300"
      }`}
    >
      {isCoolingDown ? "Cooldown" : task.claimed ? "Claimed" : task.completed ? "Ready" : "Open"}
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
          const isCoolingDown = cooldownRemaining > 0;
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
                    Display starts at 2-9. Result rolls 1-10. Two minute cooldown.
                  </p>
                  {task.lastResult && (
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
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-100">
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
