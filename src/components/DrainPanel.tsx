"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ShrineMemoryRecord } from "@/lib/shrine";
import {
  clampDrainSessionRate,
  DRAIN_SESSION_DEFAULT_RATE,
  DRAIN_SESSION_IMAGE_INTERVAL_MS,
  DRAIN_SESSION_IMAGE_LIFESPAN_MS,
  DRAIN_SESSION_MAX_CONCURRENT_IMAGES,
  DRAIN_SESSION_MAX_RATE,
  DRAIN_SESSION_MIN_RATE,
  DRAIN_SESSION_SYNC_INTERVAL_MS,
  DRAIN_SESSION_TICK_MS,
} from "@/lib/drain-session";
import {
  CLICK_GAME_BATCH_DEBOUNCE_MS,
  CLICK_GAME_BATCH_FORCE_FLUSH_SIZE,
  CLICK_GAME_BATCH_MAX_CLICKS,
  CLICK_GAME_BATCH_MAX_WAIT_MS,
  CLICK_GAME_CATEGORIES,
  CLICK_GAME_CATEGORY_STORAGE_KEY,
  DEFAULT_CLICK_GAME_CATEGORY,
  getClickGameStage,
  getClickGameStageImagePath,
  getNextClickGameWeeklyResetAt,
  isClickGameCategoryId,
  type ClickGameCategoryId,
  type ClickGameLeaderboardEntry,
  type ClickGameStatus,
  type ClickGameWinHistoryEntry,
} from "@/lib/click-game";

type ClickGameLeaderboardData = {
  leaders: ClickGameLeaderboardEntry[];
  viewerEntry: ClickGameLeaderboardEntry | null;
  winHistory: ClickGameWinHistoryEntry[];
};

type DrainPanelProps = {
  coins: number;
  disabled?: boolean;
  // Drain floaters cycle through the Shrine memories the viewer has already
  // unlocked, so this panel needs that slice of the Shrine status even though
  // the Shrine itself lives in TributePanel.
  revealedMemories?: ShrineMemoryRecord[];
  clickGame?: ClickGameStatus | null;
  clickGameLeaderboard?: ClickGameLeaderboardData | null;
  clickGameTogglePending?: boolean;
  onClickGameStart?: () => void;
  onClickGameStop?: () => void;
  onClickGameReset?: () => void;
  onClickGameClick?: (count: number, categoryId: ClickGameCategoryId) => void | Promise<void>;
  clickGameVisible?: boolean;
  onClickGameCategoryChange?: (categoryId: ClickGameCategoryId) => void;
  clickGameStatusCategory?: ClickGameCategoryId | null;
  onDrainSessionSync?: (amount: number, isFinal?: boolean) => Promise<boolean>;
  drainLeaderboard?: Array<{ rank: number; userId: string; username: string; displayName: string | null; drained: number }>;
};

type DrainFloater = { id: number; left: number; path: string; rotate: number; title: string; top: number };

function randomDrainTransform() {
  return {
    left: Math.random() * 65, // % of viewport width - keeps the image on-screen
    rotate: Math.random() * 90 - 45, // -45..45 degrees
    top: Math.random() * 70, // % of viewport height
  };
}

function formatCountdown(targetIso: string, nowMs: number) {
  const remainingMs = Math.max(0, new Date(targetIso).getTime() - nowMs);
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Click Game + Drain Session, split out of TributePanel so the Shrine panel is
// about offerings only. Both features are coin sinks driven by real-time local
// timers, which is why they share a home rather than a theme with the Shrine.
export function DrainPanel({
  coins,
  disabled = false,
  revealedMemories = [],
  clickGame = null,
  clickGameLeaderboard = null,
  clickGameTogglePending = false,
  onClickGameStart,
  onClickGameStop,
  onClickGameReset,
  onClickGameClick,
  clickGameVisible = false,
  onClickGameCategoryChange,
  clickGameStatusCategory = null,
  onDrainSessionSync,
  drainLeaderboard = [],
}: DrainPanelProps) {
  const [clickGameCategory, setClickGameCategory] = useState<ClickGameCategoryId>(DEFAULT_CLICK_GAME_CATEGORY);
  const [optimisticClicks, setOptimisticClicks] = useState(0);
  const pendingClicksRef = useRef(0);
  const pendingCategoryRef = useRef<ClickGameCategoryId>(DEFAULT_CLICK_GAME_CATEGORY);
  const inFlightRef = useRef(false);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timestamp the current unflushed batch was opened at - lets registerClickGameTap
  // force a flush once CLICK_GAME_BATCH_MAX_WAIT_MS has elapsed even while taps
  // keep arriving, so a steady (not-idle) clicking pace still gets batched
  // instead of resetting the idle-debounce timer forever.
  const batchOpenedAtRef = useRef<number | null>(null);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());

  const [drainActive, setDrainActive] = useState(false);
  const [drainRateInput, setDrainRateInput] = useState(String(DRAIN_SESSION_DEFAULT_RATE));
  const [drainTotal, setDrainTotal] = useState(0);
  const [drainFloaters, setDrainFloaters] = useState<DrainFloater[]>([]);
  const [drainError, setDrainError] = useState("");
  const [drainStartCoins, setDrainStartCoins] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-mount flag so the drain image portal only targets document.body after hydration
    setMounted(true);
  }, []);
  const drainStartCoinsRef = useRef(0);
  const drainRateRef = useRef(DRAIN_SESSION_DEFAULT_RATE);
  const drainTotalRef = useRef(0);
  const drainSyncedRef = useRef(0);
  const drainTickTimerRef = useRef<number | null>(null);
  const drainImageTimerRef = useRef<number | null>(null);
  const drainSyncTimerRef = useRef<number | null>(null);
  const drainSyncingRef = useRef(false);
  const drainFloaterIdRef = useRef(0);
  const drainFloaterTimeoutsRef = useRef(new Set<number>());
  // Kept in sync via effect (not during render) so the image-cycle interval,
  // created once in handleDrainStart, always sees the latest unlocked list
  // instead of a snapshot frozen at session start.
  const drainImagesRef = useRef(revealedMemories);
  useEffect(() => {
    drainImagesRef.current = revealedMemories;
  }, [revealedMemories]);

  const stopDrainTimers = () => {
    if (drainTickTimerRef.current) { window.clearInterval(drainTickTimerRef.current); drainTickTimerRef.current = null; }
    if (drainImageTimerRef.current) { window.clearInterval(drainImageTimerRef.current); drainImageTimerRef.current = null; }
    if (drainSyncTimerRef.current) { window.clearInterval(drainSyncTimerRef.current); drainSyncTimerRef.current = null; }
    drainFloaterTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    drainFloaterTimeoutsRef.current.clear();
    setDrainFloaters([]);
  };

  const spawnDrainFloater = () => {
    const images = drainImagesRef.current;
    if (images.length === 0) return;
    const image = images[Math.floor(Math.random() * images.length)];
    const id = drainFloaterIdRef.current++;
    const transform = randomDrainTransform();
    setDrainFloaters((current) => {
      const next = [...current, { id, path: image.path, title: image.title, ...transform }];
      return next.length > DRAIN_SESSION_MAX_CONCURRENT_IMAGES ? next.slice(next.length - DRAIN_SESSION_MAX_CONCURRENT_IMAGES) : next;
    });
    const timeoutId = window.setTimeout(() => {
      setDrainFloaters((current) => current.filter((floater) => floater.id !== id));
      drainFloaterTimeoutsRef.current.delete(timeoutId);
    }, DRAIN_SESSION_IMAGE_LIFESPAN_MS);
    drainFloaterTimeoutsRef.current.add(timeoutId);
  };

  // Reads drainTotalRef (not the drainTotal state) because this is invoked
  // from setInterval callbacks created once in handleDrainStart - closing
  // over the state value directly would freeze it at whatever it was when
  // the interval was created instead of seeing later ticks.
  const flushDrainSync = async (finalFlush: boolean) => {
    const unsynced = drainTotalRef.current - drainSyncedRef.current;
    if (unsynced <= 0 || !onDrainSessionSync || drainSyncingRef.current) return;
    drainSyncingRef.current = true;
    try {
      const ok = await onDrainSessionSync(unsynced, finalFlush);
      if (ok) {
        drainSyncedRef.current += unsynced;
      } else if (!finalFlush) {
        setDrainError("Drain session stopped - out of coins.");
        setDrainActive(false);
        stopDrainTimers();
      }
    } finally {
      drainSyncingRef.current = false;
    }
  };

  const handleDrainStart = () => {
    const rate = clampDrainSessionRate(Number(drainRateInput));
    if (coins < DRAIN_SESSION_MIN_RATE) {
      setDrainError(`Need at least ${DRAIN_SESSION_MIN_RATE} coins to start.`);
      return;
    }
    setDrainError("");
    setDrainRateInput(String(rate));
    drainRateRef.current = rate;
    drainStartCoinsRef.current = coins;
    setDrainStartCoins(coins);
    drainSyncedRef.current = 0;
    drainTotalRef.current = 0;
    setDrainTotal(0);
    setDrainFloaters([]);
    setDrainActive(true);
    spawnDrainFloater();

    drainTickTimerRef.current = window.setInterval(() => {
      const next = Math.min(drainStartCoinsRef.current, drainTotalRef.current + drainRateRef.current);
      drainTotalRef.current = next;
      setDrainTotal(next);
      if (next >= drainStartCoinsRef.current) {
        setDrainActive(false);
        stopDrainTimers();
        void flushDrainSync(true);
        setDrainError("Drain session stopped - balance reached 0.");
      }
    }, DRAIN_SESSION_TICK_MS);
    drainImageTimerRef.current = window.setInterval(spawnDrainFloater, DRAIN_SESSION_IMAGE_INTERVAL_MS);
    drainSyncTimerRef.current = window.setInterval(() => {
      void flushDrainSync(false);
    }, DRAIN_SESSION_SYNC_INTERVAL_MS);
  };

  const handleDrainStop = () => {
    setDrainActive(false);
    stopDrainTimers();
    void flushDrainSync(true);
  };

  useEffect(() => stopDrainTimers, []);

  useEffect(() => {
    const interval = window.setInterval(() => setCountdownNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(CLICK_GAME_CATEGORY_STORAGE_KEY);
    if (isClickGameCategoryId(stored)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage on mount, not derivable from props
      setClickGameCategory(stored);
      onClickGameCategoryChange?.(stored);
    }
  }, [onClickGameCategoryChange]);

  useEffect(() => {
    // Server response for a flushed batch replaces optimisticClicks with the
    // authoritative progress, so any not-yet-flushed optimistic taps made
    // since the last flush should be dropped once we resync.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resyncing local optimistic count when the external clickGame prop settles
    setOptimisticClicks(0);
  }, [clickGame?.progress]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  const selectClickGameCategory = (categoryId: ClickGameCategoryId) => {
    // Flush the previous category before switching. Any request already in
    // flight carries its own category so its response cannot overwrite the
    // newly selected category's state.
    flushClickGameNow();
    setClickGameCategory(categoryId);
    window.localStorage.setItem(CLICK_GAME_CATEGORY_STORAGE_KEY, categoryId);
    onClickGameCategoryChange?.(categoryId);
  };

  // Flushes whatever's pending right now, in one request. Safe to call while
  // another flush is already in flight - the in-flight one's `finally` will
  // notice the newly-queued clicks and schedule another round after it.
  // Plain function (not useCallback) - it's only ever invoked from onClick/
  // setTimeout callbacks below, never during render, so the Date.now() calls
  // inside are safe despite the generic purity lint warning.
  const flushClickGameNow = () => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (inFlightRef.current) {
      return;
    }

    // 300 is the maximum size of one request, not a maximum for the user's
    // whole click streak. Leave the remainder queued for the next request.
    const count = Math.min(pendingClicksRef.current, CLICK_GAME_BATCH_MAX_CLICKS);
    if (count <= 0) {
      return;
    }

    pendingClicksRef.current -= count;
    if (pendingClicksRef.current <= 0) {
      batchOpenedAtRef.current = null;
    }
    inFlightRef.current = true;
    const batchCategory = pendingCategoryRef.current;
    void Promise.resolve(onClickGameClick?.(count, batchCategory)).finally(() => {
      inFlightRef.current = false;
      if (pendingClicksRef.current <= 0) {
        pendingCategoryRef.current = clickGameCategory;
      } else if (batchOpenedAtRef.current === null) {
        // Leftover clicks beyond the per-request cap keep the batch open.
        batchOpenedAtRef.current = Date.now();
      }
      if (pendingClicksRef.current >= CLICK_GAME_BATCH_FORCE_FLUSH_SIZE) {
        // A lot piled up while that request was in flight - send it right
        // away instead of making it wait out another debounce window.
        flushClickGameNow();
      } else if (pendingClicksRef.current > 0) {
        scheduleClickGameFlush();
      }
    });
  };

  // Debounced: fires CLICK_GAME_BATCH_DEBOUNCE_MS after the user stops
  // tapping (each new tap restarts the timer), so a whole burst of spam
  // clicks turns into a single request once they actually pause.
  const scheduleClickGameFlush = () => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
    }
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushClickGameNow();
    }, CLICK_GAME_BATCH_DEBOUNCE_MS);
  };

  const registerClickGameTap = () => {
    if (disabled || !clickGame?.isActive) {
      return;
    }

    if (pendingClicksRef.current === 0) {
      pendingCategoryRef.current = clickGameCategory;
      // eslint-disable-next-line react-hooks/purity -- only runs inside this onClick handler, never during render
      batchOpenedAtRef.current = Date.now();
    }
    pendingClicksRef.current += 1;
    setOptimisticClicks((current) => current + 1);

    // Safety net: never let an uninterrupted spam session pile up an
    // unbounded unsent batch - force an early flush once it gets large.
    if (pendingClicksRef.current >= CLICK_GAME_BATCH_FORCE_FLUSH_SIZE) {
      flushClickGameNow();
      return;
    }

    // A steady (not necessarily fast) clicking pace never goes quiet long
    // enough for the idle debounce below to fire - bound the worst case so
    // it still gets batched instead of flushing on every single tap.
    // eslint-disable-next-line react-hooks/purity -- only runs inside this onClick handler, never during render
    if (batchOpenedAtRef.current !== null && Date.now() - batchOpenedAtRef.current >= CLICK_GAME_BATCH_MAX_WAIT_MS) {
      flushClickGameNow();
      return;
    }

    scheduleClickGameFlush();
  };

  const displayedProgress = (clickGame?.progress ?? 0) + optimisticClicks;
  const displayedStage = clickGame ? getClickGameStage(displayedProgress, clickGame.thresholds) : 0;
  // The status we hold belongs to whichever category the last response was for.
  // Until a fresh one arrives for the selected category, showing a stage image
  // would flash the previous category's art, so render the placeholder instead.
  const categoryReady = Boolean(clickGame) && clickGameStatusCategory === clickGameCategory;
  const displayedStageImagePath = categoryReady ? getClickGameStageImagePath(displayedStage, clickGameCategory) : null;

  return (
    <section className="court-feature-panel rounded-[2rem] border border-rose-200/15 bg-black/50 p-5 shadow-[0_0_44px_rgba(244,63,94,0.12)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-rose-200/70">Coin Sinks</p>
          <h2 className="text-3xl font-black">The Drain</h2>
        </div>
        <p className="rounded-full border border-rose-200/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-50">
          Balance: {coins.toLocaleString()} coins
        </p>
      </div>

      <div className="mt-5 rounded-[1.35rem] border border-rose-200/20 bg-black/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-rose-100/70">Drain Session</p>
          {drainActive && (
            <span className="rounded-full border border-rose-200/20 bg-rose-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-rose-50">
              Draining
            </span>
          )}
        </div>

        {revealedMemories.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Unlock a Shrine Memory to enable Drain Sessions.
          </p>
        ) : (
          <>
            {drainActive && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/50">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#fbbf24,#f43f5e)] transition-[width] duration-1000 ease-linear"
                  style={{
                    width: `${Math.max(0, 100 - (drainTotal / Math.max(1, drainStartCoins)) * 100)}%`,
                  }}
                />
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {drainActive ? (
                <>
                  <p className="animate-pulse text-sm text-zinc-300">
                    Drained: <span className="font-black text-rose-100">{drainTotal.toLocaleString()}</span>{" "}
                    / Remaining: <span className="font-black text-amber-100">{Math.max(0, drainStartCoins - drainTotal).toLocaleString()}</span> coins
                  </p>
                  <button
                    className="rounded-full border border-rose-200/30 bg-rose-500/15 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-rose-50 transition hover:border-rose-200/60 hover:bg-rose-500/25"
                    onClick={handleDrainStop}
                    type="button"
                  >
                    Stop
                  </button>
                </>
              ) : (
                <>
                  <input
                    className="w-28 rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-sm text-white outline-none focus:border-rose-200/40"
                    disabled={disabled}
                    min={DRAIN_SESSION_MIN_RATE}
                    max={DRAIN_SESSION_MAX_RATE}
                    onChange={(event) => setDrainRateInput(event.target.value)}
                    type="number"
                    value={drainRateInput}
                  />
                  <p className="text-xs text-zinc-500">coins/sec (min {DRAIN_SESSION_MIN_RATE})</p>
                  <button
                    className="rounded-full border border-rose-200/30 bg-rose-500/15 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-rose-50 transition enabled:hover:border-rose-200/60 enabled:hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={disabled || coins < DRAIN_SESSION_MIN_RATE}
                    onClick={handleDrainStart}
                    type="button"
                  >
                    Start Draining
                  </button>
                </>
              )}
            </div>
            {drainError && <p className="mt-2 text-xs text-rose-200/80">{drainError}</p>}
          </>
        )}

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-rose-100/60">Most Drained Subs</p>
          <div className="mt-2 grid gap-1.5">
            {drainLeaderboard.length > 0 ? (
              drainLeaderboard.map((entry) => (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-black/25 px-2.5 py-1.5" key={entry.userId}>
                  <p className="truncate text-xs font-bold text-white">
                    #{entry.rank} {entry.displayName || entry.username}
                  </p>
                  <p className="shrink-0 text-xs font-black text-rose-100">{entry.drained.toLocaleString()}</p>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-black/25 px-2.5 py-2 text-xs text-zinc-500">No one has drained yet.</p>
            )}
          </div>
        </div>
      </div>

      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed inset-0 z-[95]">
            {drainFloaters.map((floater) => (
              <div
                className="absolute w-[min(38vw,220px)]"
                key={floater.id}
                style={{
                  left: `${floater.left}%`,
                  top: `${floater.top}%`,
                  transform: `rotate(${floater.rotate}deg)`,
                }}
              >
                {/* animation duration must match DRAIN_SESSION_IMAGE_LIFESPAN_MS */}
                <Image
                  alt={floater.title}
                  className="w-full rounded-xl object-cover shadow-[0_12px_36px_rgba(0,0,0,0.6)] animate-[drainImagePop_5s_ease-in-out_both]"
                  height={280}
                  src={floater.path}
                  width={220}
                />
              </div>
            ))}
          </div>,
          document.body,
        )}

      <div className={clickGameVisible ? "mt-7 overflow-hidden rounded-[1.35rem] border border-pink-200/15 bg-black/30" : "hidden"}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 pb-0">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-pink-100/70">Click Game</p>
          <div className="flex flex-wrap gap-1.5">
            {CLICK_GAME_CATEGORIES.map((category) => (
              <button
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] transition ${
                  clickGameCategory === category.id
                    ? "border-pink-300/50 bg-pink-500/20 text-pink-50"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                }`}
                key={category.id}
                onClick={() => selectClickGameCategory(category.id)}
                type="button"
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-4 min-h-[28rem] w-full overflow-hidden bg-black/50 sm:min-h-[34rem]">
          {displayedStageImagePath ? (
            <Image
              alt={`Click Game stage ${displayedStage}`}
              className="object-contain p-3 transition-opacity"
              fill
              sizes="(max-width: 768px) 100vw, 700px"
              src={displayedStageImagePath}
            />
          ) : (
            <div className="flex h-full min-h-[28rem] w-full flex-col items-center justify-center px-5 text-center text-xs font-bold uppercase tracking-[0.14em] text-pink-100/40 sm:min-h-[34rem]">
              Loading category...
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.05)_30%,rgba(0,0,0,0.15)_65%,rgba(0,0,0,0.75)_100%)]" />

          <div className="pointer-events-none absolute left-4 top-4 right-4 flex flex-wrap items-start justify-between gap-2">
            <p className="rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-semibold text-pink-50/90 backdrop-blur-sm">
              {clickGame?.costPerClick ?? 1} coins / click
            </p>
            <div className="rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-pink-50 backdrop-blur-sm">
              Stage {displayedStage}/10
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 pb-12 pt-10">
            <button
              aria-label="Click the current stage"
              className="pointer-events-auto h-20 w-20 rounded-full border-2 border-pink-100/70 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,.95),rgba(236,72,153,.92)_38%,rgba(126,34,206,.92)_100%)] text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_0_0_6px_rgba(236,72,153,.14),0_0_24px_rgba(236,72,153,.7)] transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 sm:h-24 sm:w-24"
              disabled={disabled || !clickGame?.isActive}
              onClick={registerClickGameTap}
              type="button"
            >
              Click
            </button>
          </div>

          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-black/45">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#ec4899,#a855f7)] transition-[width]"
                style={{
                  width: `${Math.max(
                    4,
                    Math.min(
                      100,
                      clickGame?.nextThreshold ? (displayedProgress / clickGame.nextThreshold) * 100 : 100,
                    ),
                  )}%`,
                }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-pink-50/85 drop-shadow">
                {clickGame?.nextThreshold
                  ? `${displayedProgress.toLocaleString()} / ${clickGame.nextThreshold.toLocaleString()} to stage ${displayedStage + 1}`
                  : `${displayedProgress.toLocaleString()} progress - all 10 stages reached`}
              </p>

              <div className="flex items-center gap-1.5">
                {clickGame?.isActive ? (
                  <button
                    className="rounded-full border border-white/25 bg-black/45 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-pink-50 backdrop-blur-sm hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={disabled || clickGameTogglePending}
                    onClick={() => {
                      flushClickGameNow();
                      onClickGameStop?.();
                    }}
                    type="button"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    className="rounded-full border border-emerald-200/40 bg-emerald-500/25 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-50 backdrop-blur-sm hover:bg-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={disabled || clickGameTogglePending}
                    onClick={onClickGameStart}
                    type="button"
                  >
                    Start
                  </button>
                )}
                <button
                  className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-300 backdrop-blur-sm hover:bg-black/45 disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={disabled || clickGameTogglePending || !clickGame?.progress}
                  onClick={() => {
                    if (window.confirm("Reset your Click Game progress to 0? Your weekly/lifetime click totals will not be affected.")) {
                      onClickGameReset?.();
                    }
                  }}
                  type="button"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 px-4 py-3 text-xs text-pink-50/70">
          <p>Weekly clicks: <span className="font-black text-pink-50">{(clickGame?.weeklyClicks ?? 0).toLocaleString()}</span></p>
          <p>Lifetime clicks: <span className="font-black text-pink-50">{(clickGame?.lifetimeClicks ?? 0).toLocaleString()}</span></p>
          <p>
            Champion decided in{" "}
            <span className="font-black text-pink-50">
              {formatCountdown(getNextClickGameWeeklyResetAt(countdownNow).toISOString(), countdownNow)}
            </span>
          </p>
        </div>

        <div className="grid gap-3 p-4 pt-0 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-pink-100/60">This Week&apos;s Cash Cows</p>
            <div className="mt-2 grid gap-1.5">
              {(clickGameLeaderboard?.leaders ?? []).length > 0 ? (
                clickGameLeaderboard!.leaders.map((entry) => (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-black/25 px-2.5 py-1.5" key={entry.userId}>
                    <p className="truncate text-xs font-bold text-white">
                      #{entry.rank} {entry.displayName || entry.username}
                    </p>
                    <p className="shrink-0 text-xs font-black text-pink-100">{entry.weeklyClicks.toLocaleString()}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-black/25 px-2.5 py-2 text-xs text-zinc-500">No clicks logged this week yet.</p>
              )}
              {clickGameLeaderboard?.viewerEntry && !clickGameLeaderboard.leaders.some((entry) => entry.userId === clickGameLeaderboard.viewerEntry?.userId) ? (
                <div className="mt-1 flex items-center justify-between gap-3 rounded-xl border border-pink-200/20 bg-pink-500/10 px-2.5 py-1.5">
                  <p className="truncate text-xs font-bold text-pink-50">You - #{clickGameLeaderboard.viewerEntry.rank}</p>
                  <p className="shrink-0 text-xs font-black text-pink-100">{clickGameLeaderboard.viewerEntry.weeklyClicks.toLocaleString()}</p>
                </div>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-pink-100/60">Past Champions</p>
            <div className="mt-2 grid gap-1.5">
              {(clickGameLeaderboard?.winHistory ?? []).length > 0 ? (
                clickGameLeaderboard!.winHistory.map((entry) => (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-black/25 px-2.5 py-1.5" key={entry.userId}>
                    <p className="truncate text-xs font-bold text-white">{entry.displayName || entry.username}</p>
                    <p className="shrink-0 text-xs font-black text-amber-100">{entry.winCount}x</p>
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-black/25 px-2.5 py-2 text-xs text-zinc-500">Nothing here yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
