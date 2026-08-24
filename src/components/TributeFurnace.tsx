"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { postSealToX } from "@/lib/share-seal";
import {
  FURNACE_CONFIRM_THRESHOLD,
  FURNACE_MAX_BURN,
  FURNACE_MIN_BURN,
  getFurnaceProgressToNext,
  getFurnaceRank,
  getNextFurnaceRank,
  type FurnaceLeaderboardEntry,
} from "@/lib/tribute-furnace";

// Deliberately borrows a furnace's interface grammar - fuel slot, flame,
// progress arrow, yield slot - because it reads instantly and because the empty
// yield slot states the whole idea without a line of copy. It is built in the
// site's own materials rather than pixel art: burning real money should not
// look like a joke.
//
// The yield is not permanently empty. Ash forms, holds for a beat, then falls
// apart. A slot that never fills is a rule; a slot that fills and then empties
// is a small loss you watch happen.

type BurnPhase = "idle" | "burning" | "ash" | "crumbling";

const BURN_MS = 1400;
const ASH_HOLD_MS = 900;
const CRUMBLE_MS = 900;

function Slot({
  children,
  className = "",
  label,
}: {
  children?: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border-2 border-[#c89a55]/35 bg-[linear-gradient(160deg,rgba(28,18,12,.95),rgba(8,5,4,.98))] shadow-[inset_0_2px_6px_rgba(0,0,0,.8)] ${className}`}
      >
        {children}
      </div>
      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[#c89a55]/45">{label}</span>
    </div>
  );
}

export function TributeFurnace({
  burnedTotal,
  disabled = false,
  error,
  isBurning,
  money,
  onBurn,
}: {
  burnedTotal: number;
  disabled?: boolean;
  error?: string;
  isBurning: boolean;
  money: number;
  onBurn: (amount: number) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<BurnPhase>("idle");
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [leaders, setLeaders] = useState<FurnaceLeaderboardEntry[]>([]);
  const [shareError, setShareError] = useState("");
  const timers = useRef<number[]>([]);

  const parsed = Math.floor(Number(amount));
  const isValid =
    Number.isFinite(parsed) && parsed >= FURNACE_MIN_BURN && parsed <= Math.min(FURNACE_MAX_BURN, money);

  const rank = getFurnaceRank(burnedTotal);
  const nextRank = getNextFurnaceRank(burnedTotal);
  const progress = getFurnaceProgressToNext(burnedTotal);

  // Flame height tracks what is about to be destroyed, not what already was:
  // the fire should react to the decision in front of you.
  const flameScale = useMemo(() => {
    if (phase === "burning") return 1;
    if (!isValid) return 0.32;
    return 0.32 + Math.min(1, parsed / 100) * 0.5;
  }, [isValid, parsed, phase]);

  useEffect(() => {
    const captured = timers.current;
    return () => captured.forEach((id) => window.clearTimeout(id));
  }, []);

  const loadLeaders = async () => {
    try {
      const response = await fetch("/api/furnace/leaderboard", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { leaders?: FurnaceLeaderboardEntry[] }
        | null;
      setLeaders(payload?.leaders ?? []);
    } catch {
      // The board is decoration for the act itself - a failed load must never
      // stop anyone burning.
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount against an external system
    void loadLeaders();
  }, []);

  const runBurn = async () => {
    if (!isValid || isBurning || disabled) return;
    setPendingConfirm(false);
    setPhase("burning");

    // The bar starts filling on the click and the request runs underneath it,
    // so a fast server costs BURN_MS rather than BURN_MS plus a round trip.
    // Only the remainder is waited out; a slow server just means the bar sat
    // full for a moment, which reads as the furnace working.
    const startedAt = Date.now();
    const ok = await onBurn(parsed);
    if (!ok) {
      setPhase("idle");
      return;
    }

    setAmount("");
    void loadLeaders();

    const remaining = Math.max(0, BURN_MS - (Date.now() - startedAt));
    timers.current.push(
      window.setTimeout(() => setPhase("ash"), remaining),
      window.setTimeout(() => setPhase("crumbling"), remaining + ASH_HOLD_MS),
      window.setTimeout(() => setPhase("idle"), remaining + ASH_HOLD_MS + CRUMBLE_MS),
    );
  };

  const handleSubmit = () => {
    if (!isValid) return;
    if (parsed >= FURNACE_CONFIRM_THRESHOLD && !pendingConfirm) {
      setPendingConfirm(true);
      return;
    }
    void runBurn();
  };

  const maxBurnable = Math.min(FURNACE_MAX_BURN, Math.max(0, money));

  return (
    <section className="rounded-[1.75rem] border border-[#c89a55]/22 bg-[radial-gradient(circle_at_50%_0%,rgba(190,70,20,.12),transparent_58%),linear-gradient(165deg,rgba(20,12,9,.95),rgba(6,4,4,.98))] p-5 sm:p-6">
      <style>{`
        @keyframes vm-furnace-flicker {
          0%, 100% { transform: scaleY(1) scaleX(1); opacity: .92; }
          33%      { transform: scaleY(1.12) scaleX(.93); opacity: 1; }
          66%      { transform: scaleY(.94) scaleX(1.06); opacity: .86; }
        }
        @keyframes vm-ash-fall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(26px) rotate(22deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .vm-flame, .vm-ash { animation: none !important; }
        }
      `}</style>

      <div className="text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.32em] text-[#e6ba73]/60">Nothing comes back</p>
        <h3 className="mt-2 font-serif text-2xl text-[#fff0d2]">The Tribute Furnace</h3>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-zinc-500">
          Money in, nothing out. No coins, no items, no keys. Only the number under your name.
        </p>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4 sm:gap-6">
        <Slot label="Fuel">
          {isValid && phase === "idle" ? (
            <span className="font-serif text-xl tabular-nums text-[#ffe2ad]">{parsed}</span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-700">Empty</span>
          )}
        </Slot>

        <div className="flex flex-col items-center gap-3">
          <div className="relative flex h-12 w-12 items-end justify-center">
            <span
              aria-hidden
              className="vm-flame origin-bottom transition-transform duration-500"
              style={{
                animation: "vm-furnace-flicker 1.1s ease-in-out infinite",
                filter: `drop-shadow(0 0 ${8 + flameScale * 18}px rgba(255,150,40,${0.3 + flameScale * 0.5}))`,
                transform: `scale(${flameScale})`,
              }}
            >
              <svg fill="none" height="40" viewBox="0 0 28 40" width="28" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M14 0C16 9 22 11 22 20a8 8 0 0 1-16 0c0-4 2-6 3-9 1 3 3 4 3 7 2-4-1-11 2-18Z"
                  fill="url(#vm-furnace-flame)"
                />
                <path d="M14 14c1.5 4 4 5 4 9a4 4 0 0 1-8 0c0-3 2-4 4-9Z" fill="#ffe9b0" opacity=".9" />
                <defs>
                  <linearGradient id="vm-furnace-flame" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#ffd166" />
                    <stop offset="55%" stopColor="#f0821e" />
                    <stop offset="100%" stopColor="#a02c0c" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </div>

          <div className="relative h-2.5 w-16 overflow-hidden rounded-full border border-[#c89a55]/25 bg-black/60">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#a02c0c,#f0821e,#ffd166)]"
              style={{
                transition: phase === "burning" ? `width ${BURN_MS}ms linear` : "width 240ms ease-out",
                width: phase === "burning" || phase === "ash" ? "100%" : "0%",
              }}
            />
          </div>
        </div>

        <Slot className={phase === "ash" ? "border-[#c89a55]/55" : ""} label="Yield">
          {phase === "ash" || phase === "crumbling" ? (
            <span
              aria-hidden
              className="vm-ash flex items-end gap-0.5"
              style={
                phase === "crumbling" ? { animation: `vm-ash-fall ${CRUMBLE_MS}ms ease-in forwards` } : undefined
              }
            >
              {[0, 1, 2, 3, 4].map((index) => (
                <span
                  className="block rounded-[1px] bg-[#8a8078]"
                  key={index}
                  style={{
                    height: `${3 + (index % 3) * 2}px`,
                    opacity: 0.5 + (index % 3) * 0.2,
                    width: `${3 + (index % 2) * 2}px`,
                  }}
                />
              ))}
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-800">&mdash;</span>
          )}
        </Slot>
      </div>

      <div className="mt-6">
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-center font-serif text-lg tabular-nums text-[#ffe2ad] outline-none transition placeholder:font-sans placeholder:text-sm placeholder:text-zinc-700 focus:border-[#c89a55]/45"
            disabled={disabled || isBurning}
            inputMode="numeric"
            onChange={(event) => {
              setAmount(event.target.value.replace(/[^0-9]/g, ""));
              setPendingConfirm(false);
            }}
            placeholder={`How much (max ${maxBurnable})`}
            value={amount}
          />
          <button
            className={`shrink-0 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
              pendingConfirm
                ? "bg-[linear-gradient(100deg,#a02c0c,#f0821e)] text-white"
                : "border border-[#c89a55]/35 bg-[#c89a55]/12 text-[#ffe2ad] hover:bg-[#c89a55]/22"
            }`}
            disabled={!isValid || isBurning || disabled}
            onClick={handleSubmit}
            type="button"
          >
            {isBurning ? "Burning" : pendingConfirm ? "Yes. Burn it." : "Burn"}
          </button>
        </div>

        {pendingConfirm ? (
          <p className="mt-2 text-center text-[11px] leading-5 text-[#f0821e]/85">
            {parsed} Principessa Money, gone. You get nothing for it.
          </p>
        ) : null}
        {error ? <p className="mt-2 text-center text-[11px] leading-5 text-rose-200/80">{error}</p> : null}
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/30 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#c89a55]/50">Your ash</p>
            <p className="mt-0.5 font-serif text-2xl tabular-nums text-[#fff0d2]">{burnedTotal.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="font-serif text-lg text-[#e6ba73]">{rank.name}</p>
            <p className="text-[10px] leading-4 text-zinc-600">{rank.blurb}</p>
          </div>
        </div>

        {nextRank ? (
          <>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-black/60">
              <div
                className="h-full rounded-full bg-[#c89a55]/50 transition-[width] duration-700"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-zinc-600">
              {(nextRank.min - burnedTotal).toLocaleString()} more to {nextRank.name}
            </p>
          </>
        ) : null}

        {/* The receipt is the advert: a signed card saying this person paid
            for nothing. Only offered once there is something to show. */}
        {burnedTotal > 0 ? (
          <button
            className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 transition hover:border-[#c89a55]/35 hover:text-[#ffe2ad]"
            onClick={() => {
              setShareError("");
              void postSealToX("furnace").then((message) => {
                if (message) setShareError(message);
              });
            }}
            type="button"
          >
            Post my ash on X
          </button>
        ) : null}
        {shareError ? <p className="mt-2 text-center text-[10px] text-rose-200/75">{shareError}</p> : null}
      </div>

      {leaders.length > 0 ? (
        <div className="mt-4">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#c89a55]/45">Burned the most</p>
          <ul className="mt-2 space-y-1">
            {leaders.slice(0, 5).map((entry) => (
              <li
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-1.5"
                key={`${entry.rank}-${entry.username ?? "anon"}`}
              >
                <span className="w-5 shrink-0 text-center font-serif text-sm tabular-nums text-[#c89a55]/70">
                  {entry.rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-bold text-pink-100">
                  {entry.displayName || entry.username || "Anonymous"}
                </span>
                <span className="shrink-0 font-serif text-sm tabular-nums text-[#ffe2ad]">
                  {entry.burned.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
