"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  SHRINE_BONUS_LEVEL_STEP,
  SHRINE_IMAGE_UNLOCK_COST,
  SHRINE_LEVEL_COIN_INTERVAL,
  SHRINE_PURCHASE_OPTIONS,
  type ShrineStatus,
} from "@/lib/shrine";
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
import { ThronePublicMessageNotice } from "@/components/ThronePublicMessageNotice";

type ClickGameLeaderboardData = {
  leaders: ClickGameLeaderboardEntry[];
  viewerEntry: ClickGameLeaderboardEntry | null;
  winHistory: ClickGameWinHistoryEntry[];
};

type TributePanelProps = {
  affection: number;
  coins: number;
  tributeCode?: string | null;
  petTributeCode?: string | null;
  // Gates the Pet code row in the Throne popup. The server enforces the same
  // rule independently (credit_throne_tribute ignores a PT- code from a
  // non-pet), so this is presentation, not the security boundary.
  isPetUnlocked?: boolean;
  disabled?: boolean;
  hideAffectionOffer?: boolean;
  pending?: boolean;
  shrine?: ShrineStatus | null;
  shrinePending?: boolean;
  onShrinePurchase?: (amount: number) => void;
  onTribute: (amount: number) => void;
  clickGame?: ClickGameStatus | null;
  clickGameLeaderboard?: ClickGameLeaderboardData | null;
  clickSealDisabled?: boolean;
  clickSealPending?: boolean;
  clickGameTogglePending?: boolean;
  onClickGameStart?: () => void;
  onClickGameStop?: () => void;
  onClickGameReset?: () => void;
  onClickGameClick?: (count: number, categoryId: ClickGameCategoryId) => void | Promise<void>;
  onCreateClickSeal?: () => void;
  clickGameVisible?: boolean;
  onClickGameCategoryChange?: (categoryId: ClickGameCategoryId) => void;
  clickGameStatusCategory?: ClickGameCategoryId | null;
  onDrainSessionSync?: (amount: number, isFinal?: boolean) => Promise<boolean>;
  drainLeaderboard?: Array<{ rank: number; userId: string; username: string; displayName: string | null; drained: number }>;
};

const tributeOptions = [
  { amount: 250, label: "Velvet Coin Drop", boost: "+1 affection" },
  { amount: 1000, label: "Gilded Offering", boost: "+5 affection" },
  { amount: 5000, label: "Vault Tribute", boost: "+30 affection" },
];

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

export function TributePanel({
  affection,
  coins,
  tributeCode = null,
  petTributeCode = null,
  isPetUnlocked = false,
  disabled = false,
  hideAffectionOffer = false,
  pending = false,
  shrine = null,
  shrinePending = false,
  onShrinePurchase,
  onTribute,
  clickGame = null,
  clickGameLeaderboard = null,
  clickSealDisabled = false,
  clickSealPending = false,
  clickGameTogglePending = false,
  onClickGameStart,
  onClickGameStop,
  onClickGameReset,
  onClickGameClick,
  onCreateClickSeal,
  clickGameVisible = false,
  onClickGameCategoryChange,
  clickGameStatusCategory = null,
  onDrainSessionSync,
  drainLeaderboard = [],
}: TributePanelProps) {
  const [showThroneCode, setShowThroneCode] = useState(false);
  const isMaxAffection = affection >= 100;

  const [clickGameCategory, setClickGameCategory] = useState<ClickGameCategoryId>(DEFAULT_CLICK_GAME_CATEGORY);
  const [categoryReady, setCategoryReady] = useState(true);
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
  const drainImagesRef = useRef(shrine?.revealedMemories ?? []);
  useEffect(() => {
    drainImagesRef.current = shrine?.revealedMemories ?? [];
  }, [shrine?.revealedMemories]);

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
      setCategoryReady(false);
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
    setCategoryReady(false);
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
  useEffect(() => {
    if (clickGame && clickGameStatusCategory === clickGameCategory) {
      setCategoryReady(true);
    }
  }, [clickGame, clickGameCategory, clickGameStatusCategory]);
  const displayedStageImagePath = categoryReady ? getClickGameStageImagePath(displayedStage, clickGameCategory) : null;

  return (
    <section className="court-feature-panel rounded-[2rem] border border-fuchsia-200/15 bg-black/50 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-pink-200/70">
            Tribute System
          </p>
          <h2 className="text-3xl font-black">{hideAffectionOffer ? "Shrine of Principessa" : "Offer Principessa Coins"}</h2>
        </div>
        <p className="rounded-full border border-pink-200/20 bg-pink-500/10 px-4 py-2 text-sm font-semibold text-pink-50">
          Balance: {coins.toLocaleString()} coins
        </p>
      </div>

      {/* Drain Session: its own top-level grid, same as Click Game below -
          not nested inside the Shrine grid/card. */}
      <div className="mt-5 rounded-[1.35rem] border border-rose-200/20 bg-black/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-rose-100/70">Drain Session</p>
          {drainActive && (
            <span className="rounded-full border border-rose-200/20 bg-rose-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-rose-50">
              Draining
            </span>
          )}
        </div>

        {(shrine?.revealedMemories?.length ?? 0) === 0 ? (
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

      {!hideAffectionOffer && (
        <>
      <div className="court-grid court-grid--shop mt-5 grid gap-4 md:grid-cols-3">
            {tributeOptions.map((option) => (
              <button
            className="court-grid-card court-grid-card--gold group rounded-[1.5rem] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(236,72,153,0.08),rgba(0,0,0,0.42))] p-5 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-pink-300/50 enabled:hover:shadow-[0_0_30px_rgba(236,72,153,0.2)] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={disabled || pending || isMaxAffection || coins < option.amount}
                key={option.amount}
                onClick={() => onTribute(option.amount)}
                type="button"
              >
                <p className="text-sm font-semibold text-fuchsia-100">
                  {option.label}
                </p>
                <p className="mt-4 text-4xl font-black text-white">
                  {option.amount}
                </p>
                <p className="mt-1 text-sm text-zinc-400">coins</p>
                <p className="mt-5 rounded-full border border-pink-200/20 bg-black/30 px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.2em] text-pink-100 group-hover:bg-pink-500/15">
                  {option.boost}
                </p>
              </button>
            ))}
          </div>

          <p className="mt-5 text-sm leading-6 text-zinc-400">
            {isMaxAffection
              ? "Principessa's mood is already at its peak. Ordinary tribute rests now, but the Shrine still welcomes offerings."
              : disabled
                ? "Timeout is active. Tribute actions are locked until the timer ends."
              : "Prototype note: tributes spend Principessa Coins only. This is where a future backend or Supabase ledger could record non-payment game events."}
          </p>
        </>
      )}

      {hideAffectionOffer && (
      <div className="court-feature-card court-grid-card court-grid-card--gold mt-5 rounded-[1.6rem] border border-amber-200/15 bg-[linear-gradient(155deg,rgba(120,53,15,0.28),rgba(88,28,135,0.16),rgba(0,0,0,0.5))] p-5 shadow-[0_0_34px_rgba(251,191,36,0.12)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.26em] text-amber-100/70">
                Sacred Offerings
              </p>
              <h3 className="mt-2 text-2xl font-black text-white">
                Deepen your devotion through sacred offerings.
              </h3>
              <p className="mt-2 text-sm leading-6 text-amber-50/80">
                Each offering increases your Tribute Score, grants Devotion, and contributes toward revealing new Shrine Memories.
                Every {SHRINE_IMAGE_UNLOCK_COST.toLocaleString()} shrine coins reveals a memory, and every {SHRINE_LEVEL_COIN_INTERVAL.toLocaleString()} coins raises Worship Level.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200/15 bg-black/30 px-4 py-3 text-sm text-amber-50/85">
              <p className="font-semibold">Offered at the Shrine: {shrine?.totalSpent.toLocaleString() ?? "0"} coins</p>
              <p className="mt-1">
                Memories Revealed: {shrine?.unlockedImageCount ?? 0}/{shrine?.availableImageCount ?? 0}
              </p>
              <p className="mt-1">
                Worship Level: {shrine?.level.toLocaleString() ?? "0"}
              </p>
            </div>
          </div>

          <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(16rem,0.55fr)]">
            <div className="grid gap-4">
            <div className="court-grid court-grid--shop grid items-start gap-3 md:grid-cols-3">
              {SHRINE_PURCHASE_OPTIONS.map((option) => (
                <button
                  className="court-grid-card court-grid-card--gold group flex h-full flex-col self-stretch overflow-hidden rounded-[1.25rem] border border-amber-200/15 bg-[linear-gradient(155deg,rgba(120,53,15,0.24),rgba(88,28,135,0.12),rgba(0,0,0,0.52))] text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-amber-200/40 enabled:hover:shadow-[0_0_24px_rgba(251,191,36,0.16)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={disabled || shrinePending || coins < option.amount}
                  key={option.amount}
                  onClick={() => onShrinePurchase?.(option.amount)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-amber-200/10 bg-amber-300/[0.035] px-4 py-3">
                    <p className="text-sm font-black text-amber-50">{option.label}</p>
                    <span className="rounded-full border border-amber-200/15 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100/75 transition group-enabled:group-hover:border-amber-200/35 group-enabled:group-hover:text-amber-50">
                      Offer
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-2xl font-black leading-none text-white">{option.amount.toLocaleString()}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">coins offered</p>
                    <p className="mt-3 min-h-10 text-xs leading-5 text-zinc-300">{option.description}</p>
                    <div className="mt-auto grid grid-cols-3 gap-1.5 border-t border-white/[0.06] pt-3 text-center">
                      <span className="rounded-lg bg-amber-300/[0.06] px-1.5 py-2">
                        <strong className="block text-xs text-amber-50">+{option.devotionReward}</strong>
                        <span className="mt-0.5 block text-[8px] font-black uppercase tracking-[0.12em] text-amber-100/50">Devotion</span>
                      </span>
                      <span className="rounded-lg bg-pink-300/[0.06] px-1.5 py-2">
                        <strong className="block truncate text-xs text-pink-50">+{option.amount.toLocaleString()}</strong>
                        <span className="mt-0.5 block text-[8px] font-black uppercase tracking-[0.12em] text-pink-100/50">Tribute</span>
                      </span>
                      <span className="rounded-lg bg-sky-300/[0.06] px-1.5 py-2">
                        <strong className="block text-xs text-sky-50">+{Math.floor(option.amount / SHRINE_LEVEL_COIN_INTERVAL)}</strong>
                        <span className="mt-0.5 block text-[8px] font-black uppercase tracking-[0.12em] text-sky-100/50">Worship</span>
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {shrine?.bonus ? (
              <div className="mt-7 rounded-[1.35rem] border border-pink-200/15 bg-black/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-pink-100/70">
                    Bonus Shrine Gallery
                  </p>
                  {shrine.bonus.nextUnlockLevel !== null ? (
                    <span className="rounded-full border border-pink-200/15 bg-pink-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-pink-50">
                      Level {shrine.bonus.nextUnlockLevel} to unlock next
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-200/15 bg-emerald-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-50">
                      All bonus images unlocked
                    </span>
                  )}
                </div>

                {shrine.bonus.images.length > 0 ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {shrine.bonus.images.map((image, index) => {
                      const isUnlocked = index < shrine.bonus!.unlockedCount;

                      return (
                        <div
                          className="relative aspect-[4/5] overflow-hidden rounded-xl border border-pink-200/10 bg-black/40"
                          key={image.fileName}
                        >
                          {isUnlocked ? (
                            <Image alt={image.title} className="object-cover" fill sizes="140px" src={image.path} />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-lg text-pink-100/30">
                              🔒
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    No bonus images placed yet. New ones unlock every {SHRINE_BONUS_LEVEL_STEP} Worship Levels.
                  </p>
                )}
              </div>
            ) : null}
            </div>

            <div className="grid gap-4">
          <div className="court-feature-card court-grid-card rounded-[1.35rem] border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-100/70">
                  Latest Shrine Memory
                </p>
                {shrine?.coinsUntilNextUnlock !== null ? (
                  <span className="rounded-full border border-amber-200/15 bg-amber-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-amber-50">
                    {shrine?.coinsUntilNextUnlock?.toLocaleString() ?? "0"} to next reveal
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-200/15 bg-emerald-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-50">
                    Every current memory revealed
                  </span>
                )}
              </div>

              <div className="mt-4 overflow-hidden rounded-[1.1rem] border border-amber-200/15 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),rgba(0,0,0,0.62))]">
                {shrine?.currentImagePath ? (
                  <div>
                    <Image
                      alt={shrine.currentMemory?.title ?? "Current Shrine Memory"}
                      className="h-40 w-full object-cover"
                      height={320}
                      src={shrine.currentImagePath}
                      width={480}
                    />
                    {shrine.currentMemory?.title ? (
                      <div className="border-t border-amber-200/10 bg-black/35 px-3 py-2.5">
                        <p className="text-sm font-semibold text-amber-50">{shrine.currentMemory.title}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-amber-100/60">
                          Full Shrine Memories now live in Gallery
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex min-h-[12rem] flex-col items-center justify-center px-5 py-8 text-center">
                    <p className="text-sm font-black uppercase tracking-[0.24em] text-amber-50/70">
                      Awaiting Shrine Memories
                    </p>
                    <p className="mt-3 max-w-xs text-sm leading-6 text-zinc-300">
                      Future Shrine Memories can be placed in `public/shrine`, and each new one will become part of the next revelation cycle.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/35">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b,#ec4899,#fde68a)] transition-[width]"
                  style={{
                    width: `${Math.max(
                      6,
                      Math.min(
                        100,
                        shrine?.coinsUntilNextUnlock === null
                          ? 100
                          : (((shrine?.totalSpent ?? 0) % SHRINE_IMAGE_UNLOCK_COST) / SHRINE_IMAGE_UNLOCK_COST) * 100,
                      ),
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {shrine?.availableImageCount
                  ? `${shrine?.unlockedImageCount ?? 0} of ${shrine?.availableImageCount ?? 0} Shrine Memories have been revealed. Browse the full collection in Gallery.`
                  : "No Shrine Memories have been placed yet, but your offerings are already being remembered."}
              </p>
            </div>

              <div className="rounded-[1.35rem] border border-amber-200/15 bg-black/30 p-4">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-100/70">
                  Top 3 Worshippers
                </p>
                <div className="mt-3 grid gap-2">
                  {(shrine?.topWorshippers ?? []).length > 0 ? (
                    shrine?.topWorshippers.map((worshipper, index) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2"
                        key={worshipper.userId}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">
                            #{index + 1} {worshipper.displayName || worshipper.username}
                          </p>
                          {worshipper.displayName ? (
                            <p className="truncate text-xs text-amber-100/55">{worshipper.username}</p>
                          ) : null}
                        </div>
                        <p className="shrink-0 text-sm font-black text-amber-50">
                          {worshipper.totalSpent.toLocaleString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-zinc-400">
                      No Shrine offerings yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click Game intentionally lives outside the affection-gated Shrine
          block above - it shouldn't require maxing out affection first. */}
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
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-pink-100/60">This Week&apos;s Cash Cows</p>
                  <button
                    className="shrink-0 rounded-full border border-amber-200/25 bg-amber-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-amber-50 transition hover:border-amber-200/45 hover:bg-amber-400/20 disabled:opacity-45"
                    disabled={clickSealDisabled}
                    onClick={onCreateClickSeal}
                    type="button"
                  >
                    {clickSealPending ? "Sealing..." : "Seal my rank"}
                  </button>
                </div>
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

      <div className="mt-6 rounded-[1.5rem] border border-pink-200/20 bg-[linear-gradient(145deg,rgba(236,72,153,0.12),rgba(0,0,0,0.34))] p-4 shadow-[0_0_28px_rgba(236,72,153,0.12)]">
        <button
          className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-3 text-center text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_0_24px_rgba(236,72,153,0.28)] transition hover:scale-[1.01] sm:w-auto"
          onClick={() => setShowThroneCode(true)}
          type="button"
        >
          Get Money / Tribute on Throne
        </button>
        <p className="mt-4 text-sm leading-6 text-pink-50">
          Use the code shown in the payment popup inside your Throne gift message.
        </p>
        <p className="mt-2 text-sm leading-6 text-pink-50">
          The matching code credits Principessa Money automatically. 1 USD = 1 Money = 1,000 coins.
        </p>
        <ThronePublicMessageNotice className="mt-3" />
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          If automation fails, DM @VMPrincipessa with your Throne receipt for manual help.
        </p>
      </div>
      {showThroneCode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-pink-200/25 bg-[#180812] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs uppercase tracking-[0.24em] text-pink-200/70">Throne payment</p><h3 className="mt-2 text-2xl font-black text-white">Choose your code</h3></div>
              <button className="text-2xl text-zinc-400 hover:text-white" onClick={() => setShowThroneCode(false)} type="button">×</button>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-300">
              {isPetUnlocked
                ? "Either code credits Principessa Money at 1 USD = 1 Money. The Pet code also files it as a Pet task, so it counts toward your Throne titles."
                : "Put this code in your Throne gift message and Principessa Money is credited automatically at 1 USD = 1 Money."}
            </p>
            <div className="mt-4 space-y-3">
              {(
                [
                  ["Money Add", tributeCode, "Principessa Money only"],
                  // The Pet code row is hidden until the Pet track is unlocked.
                  // Every profile has a PT- code seeded whether or not its owner
                  // is a pet, so showing it to everyone advertised a shortcut
                  // into Pet-track progress nobody had earned.
                  ...(isPetUnlocked
                    ? [["Pet Throne Bonus", petTributeCode, "Same Money + Throne title progress"] as const]
                    : []),
                ] as ReadonlyArray<readonly [string, string | null, string]>
              ).map(([label, code, detail]) => (
                <div className="rounded-2xl border border-pink-200/20 bg-black/35 p-3" key={label}>
                  <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-pink-100/70">{label}</p><p className="mt-1 text-xs text-zinc-500">{detail}</p></div><button className="rounded-xl border border-pink-200/25 px-3 py-2 text-xs font-black text-pink-50 disabled:opacity-40" disabled={!code} onClick={() => code && void navigator.clipboard?.writeText(code)} type="button">Copy</button></div>
                  <p className="mt-3 rounded-xl bg-black/40 px-3 py-2 text-center font-black tracking-[0.18em] text-pink-50">{code ?? "Code unavailable"}</p>
                </div>
              ))}
            </div>
            <a className="mt-4 block rounded-2xl bg-pink-500 px-4 py-3 text-center text-sm font-black text-white" href="https://throne.com/principessa2dfd" rel="noopener noreferrer" target="_blank">Open Throne</a>
          </div>
        </div>
      )}
    </section>
  );
}
