"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BirthdayCake } from "@/components/BirthdayCake";
import { BirthdayGiftBox } from "@/components/BirthdayGiftBox";
import {
  BIRTHDAY_CANDLE_USD,
  BIRTHDAY_GIFTS,
  BIRTHDAY_POLL_INTERVAL_MS,
  BIRTHDAY_TARGET_CANDLES,
  BIRTHDAY_TARGET_USD,
  buildCandleSlots,
  formatUsd,
  getBirthdayWindowState,
  getRemainingToNextCandle,
  resolveSupporterLabel,
  type BirthdayProgress,
} from "@/lib/birthday";
import {
  BIRTHDAY_WISH_MAX_LENGTH,
  type BirthdayCelebration,
} from "@/lib/birthday-celebration";
import { PET_THRONE_URL } from "@/lib/pet-throne";

type CelebrationPrompt = "rose" | "wish" | null;

const BIRTHDAY_SHARE_URL = "https://vault-mistress.vercel.app/birthday-2026?court=2026-celebration";
const BIRTHDAY_X_SHARE_URL = `https://x.com/intent/post?text=${encodeURIComponent(
  `Principessa's 22nd Birthday Court is opening. Leave her a wish, place a rose, and join the celebration.\n\n${BIRTHDAY_SHARE_URL}`,
)}`;

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

// Fixed positions rather than Math.random: a random layout would differ between
// the server render and the client one, and calling Math.random during render
// is impure anyway.
const EMBERS = [
  { delay: 0, duration: 15, left: 6, size: 3 },
  { delay: 2.5, duration: 19, left: 17, size: 2 },
  { delay: 6, duration: 13, left: 29, size: 4 },
  { delay: 1.2, duration: 21, left: 41, size: 2 },
  { delay: 8, duration: 16, left: 53, size: 3 },
  { delay: 4.4, duration: 23, left: 66, size: 2 },
  { delay: 10, duration: 14, left: 78, size: 4 },
  { delay: 3.1, duration: 18, left: 88, size: 3 },
  { delay: 7.6, duration: 20, left: 96, size: 2 },
];

// Corner filigree for the main stage frame.
function CornerOrnament({ className }: { className: string }) {
  return (
    <svg aria-hidden className={className} fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 20 V6 Q1 1 6 1 H20" stroke="#c89a55" strokeOpacity="0.55" strokeWidth="1.4" />
      <path d="M8 24 V12 Q8 8 12 8 H24" stroke="#c89a55" strokeOpacity="0.28" strokeWidth="1" />
      <circle cx="6" cy="6" fill="#e6ba73" fillOpacity="0.7" r="2" />
    </svg>
  );
}

function SectionRule({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#c89a55]/35" />
      <span className="text-[10px] font-black uppercase tracking-[0.32em] text-[#d7ad69]/70">{label}</span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#c89a55]/35" />
    </div>
  );
}

type TributeCodeStatus = "idle" | "loading" | "ready" | "auth-required" | "unavailable";

export function BirthdayStage() {
  const [progress, setProgress] = useState<BirthdayProgress | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadFailureCode, setLoadFailureCode] = useState<string | null>(null);
  const [tributeCode, setTributeCode] = useState<string | null>(null);
  const [tributeCodeError, setTributeCodeError] = useState("");
  const [tributeCodeStatus, setTributeCodeStatus] = useState<TributeCodeStatus>("idle");
  const [codeCopied, setCodeCopied] = useState(false);
  const [celebration, setCelebration] = useState<BirthdayCelebration | null>(null);
  const [celebrationError, setCelebrationError] = useState("");
  const [celebrationPending, setCelebrationPending] = useState<"rose" | "wish" | null>(null);
  const [wishDraft, setWishDraft] = useState("");
  const [supportPrompt, setSupportPrompt] = useState<CelebrationPrompt>(null);
  // Held in state rather than read during render: Date.now() in a render body
  // is impure and would make the countdown depend on when React happens to
  // re-render. The interval below is the only thing that advances it.
  const [nowMs, setNowMs] = useState<number | null>(null);

  const loadProgress = useCallback(async () => {
    let failureCode: string | null = null;
    try {
      const response = await fetch("/api/birthday/progress");
      const payload = (await response.json().catch(() => null)) as
        | { code?: string; error?: string; progress?: BirthdayProgress }
        | null;
      if (!response.ok || !payload?.progress) {
        failureCode = payload?.code ?? null;
        throw new Error(payload?.error ?? "Failed to load birthday progress.");
      }
      setProgress(payload.progress);
      setLoadFailed(false);
      setLoadFailureCode(null);
    } catch (error) {
      console.warn("Birthday progress load failed", error);
      // Keep whatever is already on screen - a failed poll should never blank
      // the cake out from under someone watching it.
      setLoadFailed(true);
      setLoadFailureCode(failureCode);
    }
  }, []);

  const loadCelebration = useCallback(async () => {
    try {
      const response = await fetch("/api/birthday/celebration", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { celebration?: BirthdayCelebration; error?: string }
        | null;
      if (!response.ok || !payload?.celebration) throw new Error(payload?.error ?? "Celebration could not be loaded.");
      setCelebration(payload.celebration);
      setWishDraft(payload.celebration.myWish?.message ?? "");
      setCelebrationError("");
    } catch (error) {
      console.warn("Birthday celebration load failed", error);
      setCelebrationError("The guestbook is temporarily unavailable.");
    }
  }, []);

  const submitCelebration = async (action: "rose" | "wish") => {
    if (celebrationPending) return;
    setCelebrationPending(action);
    setCelebrationError("");
    try {
      const response = await fetch("/api/birthday/celebration", {
        body: JSON.stringify({ action, message: action === "wish" ? wishDraft : undefined }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { celebration?: BirthdayCelebration; code?: string; error?: string }
        | null;
      if (!response.ok || !payload?.celebration) {
        if (payload?.code === "AUTH_REQUIRED") throw new Error("Sign in to Vault Mistress first, then return to the court.");
        throw new Error(payload?.error ?? "Your birthday entry could not be saved.");
      }
      setCelebration(payload.celebration);
      setWishDraft(payload.celebration.myWish?.message ?? wishDraft);

      const storageKey = `birthday-2026-support-prompt:${action}`;
      if (!window.sessionStorage.getItem(storageKey)) {
        window.sessionStorage.setItem(storageKey, "shown");
        setSupportPrompt(action);
      }
    } catch (error) {
      setCelebrationError(error instanceof Error ? error.message : "Your birthday entry could not be saved.");
    } finally {
      setCelebrationPending(null);
    }
  };

  const hideBirthdayWish = async (wishId: string) => {
    if (!celebration?.canModerate || celebrationPending) return;
    setCelebrationPending("wish");
    setCelebrationError("");
    try {
      const response = await fetch("/api/birthday/celebration", {
        body: JSON.stringify({ action: "hide", wishId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { celebration?: BirthdayCelebration; error?: string }
        | null;
      if (!response.ok || !payload?.celebration) throw new Error(payload?.error ?? "Wish could not be hidden.");
      setCelebration(payload.celebration);
    } catch (error) {
      setCelebrationError(error instanceof Error ? error.message : "Wish could not be hidden.");
    } finally {
      setCelebrationPending(null);
    }
  };

  const requestTributeCode = async () => {
    setTributeCodeStatus("loading");
    setTributeCodeError("");
    setCodeCopied(false);

    try {
      const response = await fetch("/api/birthday/tribute-code", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | { code?: string; error?: string; tributeCode?: string }
        | null;

      if (response.ok && payload?.tributeCode) {
        setTributeCode(payload.tributeCode);
        setTributeCodeStatus("ready");
        return;
      }

      setTributeCodeError(payload?.error ?? "Your candle code could not be loaded.");
      setTributeCodeStatus(payload?.code === "BIRTHDAY_CODE_AUTH_REQUIRED" ? "auth-required" : "unavailable");
    } catch (error) {
      console.warn("Birthday tribute-code request failed", error);
      setTributeCodeError("Your candle code could not be loaded.");
      setTributeCodeStatus("unavailable");
    }
  };

  const copyTributeCode = async () => {
    if (!tributeCode) return;
    await navigator.clipboard?.writeText(tributeCode);
    setCodeCopied(true);
    window.setTimeout(() => setCodeCopied(false), 1800);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount against an external system, not derived state
    void loadProgress();
    // Once the court becomes a memory page its snapshot is immutable: the SQL
    // window excludes later events, so continuing to poll would only waste work.
    if (getBirthdayWindowState().hasEnded) return;
    const timer = setInterval(() => {
      void loadProgress();
      if (getBirthdayWindowState().hasEnded) clearInterval(timer);
    }, BIRTHDAY_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadProgress]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount against an external system
    void loadCelebration();
  }, [loadCelebration]);

  useEffect(() => {
    // The clock has to start after hydration, not in a useState initializer:
    // the server renders at build/request time and the client a moment later,
    // so seeding it during render would be a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- subscribing to wall-clock time, which React cannot derive
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const candles = buildCandleSlots(progress);
  const candlesLit = Math.min(BIRTHDAY_TARGET_CANDLES, progress?.candlesLit ?? 0);
  const raisedUsd = progress?.raisedUsd ?? 0;
  const remaining = getRemainingToNextCandle(raisedUsd, candlesLit);
  const isComplete = candlesLit >= BIRTHDAY_TARGET_CANDLES;
  const overallPercent = Math.min(100, (raisedUsd / BIRTHDAY_TARGET_USD) * 100);
  const candlePercent = isComplete
    ? 100
    : Math.min(100, ((BIRTHDAY_CANDLE_USD - remaining) / BIRTHDAY_CANDLE_USD) * 100);

  const windowState = nowMs === null ? null : getBirthdayWindowState(nowMs);
  // Before the window opens the clock counts down to it; once it is open the
  // clock counts down to closing, which is the number that actually creates
  // pressure while the cake is live.
  const isLive = windowState?.isLive ?? false;
  const hasEnded = windowState?.hasEnded ?? false;
  const actionsReady = windowState !== null;
  const giftsEnabled = actionsReady && !hasEnded;
  const countdownMs = windowState ? (isLive ? windowState.msUntilEnd : windowState.msUntilStart) : 0;
  const countdown = windowState ? formatCountdown(countdownMs) : null;
  const litCandles = candles.filter((candle) => candle.litAt);

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#070406] px-4 py-12 text-zinc-200 sm:px-8">
      <style>{`
        @keyframes vm-ember-rise {
          0%   { transform: translateY(12vh) scale(0.7); opacity: 0; }
          12%  { opacity: 0.75; }
          85%  { opacity: 0.5; }
          100% { transform: translateY(-95vh) scale(1.1); opacity: 0; }
        }
        @keyframes vm-shimmer {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
        .vm-ember { animation-name: vm-ember-rise; animation-timing-function: linear; animation-iteration-count: infinite; }
        .vm-shimmer::after {
          content: ""; position: absolute; inset: 0; width: 38%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent);
          animation: vm-shimmer 2.6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .vm-ember, .vm-shimmer::after { animation: none; }
        }
      `}</style>

      {/* Backdrop: layered glows, a grain wash, and drifting embers */}
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(190,24,93,.28),transparent_55%),radial-gradient(circle_at_88%_78%,rgba(230,186,115,.1),transparent_45%),radial-gradient(circle_at_8%_60%,rgba(120,20,60,.16),transparent_40%)]" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.14] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {EMBERS.map((ember) => (
          <span
            className="vm-ember absolute bottom-0 rounded-full bg-[#e6ba73]"
            key={ember.left}
            style={{
              animationDelay: `${ember.delay}s`,
              animationDuration: `${ember.duration}s`,
              boxShadow: "0 0 8px rgba(230,186,115,.9)",
              height: ember.size,
              left: `${ember.left}%`,
              width: ember.size,
            }}
          />
        ))}
      </div>

      <div className="mx-auto w-full max-w-6xl">
        {/* ---------------------------------------------------------- header */}
        <header className="relative min-h-[34rem] overflow-hidden rounded-[2.5rem] border border-[#d7ad69]/25 bg-[#0b0408] shadow-[0_45px_140px_rgba(0,0,0,.7),0_0_90px_rgba(190,24,93,.13)] sm:min-h-[40rem] lg:min-h-[35rem]">
          <Image
            alt="Principessa seated in her candlelit birthday court"
            className="object-cover object-[68%_center] sm:object-[64%_center] lg:object-center"
            fill
            priority
            sizes="(max-width: 640px) 100vw, 1152px"
            src="/birthday/principessa-birthday-court.png"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,4,6,.08)_20%,rgba(7,4,6,.96)_100%)] lg:bg-[linear-gradient(90deg,rgba(7,4,6,.98)_0%,rgba(7,4,6,.84)_35%,rgba(7,4,6,.12)_68%,rgba(7,4,6,.08)_100%)]" />
          <div className="absolute inset-2 rounded-[2.15rem] border border-[#d7ad69]/15" />
          <CornerOrnament className="pointer-events-none absolute left-4 top-4 h-12 w-12" />
          <CornerOrnament className="pointer-events-none absolute right-4 top-4 h-12 w-12 rotate-90" />

          <div className="relative flex min-h-[34rem] items-end px-7 pb-9 pt-28 sm:min-h-[40rem] sm:px-12 sm:pb-12 lg:min-h-[35rem] lg:w-[52%] lg:items-center lg:pb-10 lg:pt-10">
            <div>
              <div className="flex w-fit items-center gap-3">
                <span className="h-px w-8 bg-gradient-to-r from-transparent to-[#c89a55]/70" />
                <span className="text-[9px] font-black uppercase tracking-[0.38em] text-[#e6ba73]/85">
                  14 August · Her 22nd
                </span>
              </div>

              <p className="mt-5 font-serif text-lg italic text-pink-200/65">
                {hasEnded ? "A night preserved forever" : "You are summoned to"}
              </p>
              <h1 className="mt-2 bg-[linear-gradient(180deg,#fff8e9_5%,#efc77f_55%,#aa7134_100%)] bg-clip-text font-serif text-5xl leading-[0.88] text-transparent sm:text-7xl lg:text-[5.35rem]">
                Principessa&apos;s
                <span className="mt-2 block text-[0.72em]">Birthday Court</span>
              </h1>

              <p className="mt-6 max-w-md text-sm leading-7 text-zinc-300/75">
                {hasEnded ? (
                  <>
                    The 2026 court has closed. Its{" "}
                    <span className="font-black text-[#fff0d2]">{BIRTHDAY_TARGET_CANDLES} candle ritual</span>, gifts,
                    and the names that lit the night remain here as a memory.
                  </>
                ) : (
                  <>
                    One night belongs entirely to her. Leave a wish, place a rose, light one of{" "}
                    <span className="font-black text-[#fff0d2]">{BIRTHDAY_TARGET_CANDLES} candles</span>, or choose a
                    present from Principessa&apos;s private wishlist.
                  </>
                )}
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                <span className="rounded-full border border-[#e6ba73]/30 bg-black/45 px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-[#f5d69a]">
                  {BIRTHDAY_TARGET_CANDLES} candle ritual
                </span>
                <span className="rounded-full border border-pink-400/25 bg-pink-950/35 px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-pink-200/80">
                  Private wishlist
                </span>
                <a
                  className="rounded-full border border-white/15 bg-black/45 px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-pink-100/75 transition hover:border-pink-300/35 hover:text-white"
                  href={BIRTHDAY_X_SHARE_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Share invitation on X
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* ------------------------------------------------------- countdown */}
        {countdown && windowState && !windowState.hasEnded ? (
          <div className="mt-9">
            <p className="text-center text-[9px] font-black uppercase tracking-[0.28em] text-[#c89a55]/50">
              {isLive ? "Candles go out in" : "Counting opens in"}
            </p>
            <div className="mt-3 flex items-stretch justify-center gap-2 sm:gap-3">
              {[
                { label: "Days", value: countdown.days },
                { label: "Hours", value: countdown.hours },
                { label: "Min", value: countdown.minutes },
                { label: "Sec", value: countdown.seconds },
              ].map((unit) => (
                <div
                  className="relative min-w-[4.5rem] overflow-hidden rounded-2xl border border-[#c89a55]/25 bg-[linear-gradient(180deg,rgba(59,12,34,.7),rgba(8,4,6,.9))] px-3 py-2.5 text-center shadow-[0_10px_30px_rgba(0,0,0,.45)] sm:min-w-[5.25rem]"
                  key={unit.label}
                >
                  <span className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#e3b86d]/50 to-transparent" />
                  <p className="font-serif text-3xl tabular-nums text-[#fff0d2] sm:text-4xl">
                    {String(unit.value).padStart(2, "0")}
                  </p>
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-[#c89a55]/50">
                    {unit.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {hasEnded ? (
          <section className="mx-auto mt-9 max-w-3xl rounded-[2rem] border border-[#e6ba73]/25 bg-[radial-gradient(circle_at_50%_0%,rgba(230,186,115,.13),transparent_58%),rgba(15,7,10,.9)] px-6 py-7 text-center shadow-[0_22px_70px_rgba(0,0,0,.38)]">
            <p className="text-[9px] font-black uppercase tracking-[0.34em] text-[#e6ba73]/60">The court remembers</p>
            <h2 className="mt-3 font-serif text-3xl text-[#fff0d2]">Principessa&apos;s 2026 birthday is now a memory.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-500">
              The final cake and roll call are preserved below. The birthday actions are closed, but every flame stays
              exactly where the court left it.
            </p>
          </section>
        ) : null}

        {/* ------------------------------------------- celebration, not checkout */}
        <section className="relative mt-14 overflow-hidden rounded-[2.5rem] border border-[#e6ba73]/22 bg-[radial-gradient(circle_at_75%_0%,rgba(190,24,93,.2),transparent_42%),linear-gradient(145deg,rgba(29,9,20,.94),rgba(7,4,6,.98))] px-5 py-9 shadow-[0_28px_90px_rgba(0,0,0,.45)] sm:px-10 sm:py-12">
          <span className="pointer-events-none absolute inset-2 rounded-[2.15rem] border border-[#e6ba73]/10" />
          <div className="relative grid gap-8 lg:grid-cols-[.82fr_1.18fr] lg:items-center">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.36em] text-[#e6ba73]/60">A letter from the throne</p>
              <h2 className="mt-3 font-serif text-4xl leading-tight text-[#fff0d2]">You came to celebrate me.</h2>
              <div className="mt-5 space-y-4 font-serif text-lg italic leading-8 text-pink-100/75">
                <p>
                  You were invited here for more than a transaction. Leave your devotion in writing, place a rose at my
                  throne, and let my court remember that you were present.
                </p>
                <p>
                  If you choose to make the night brighter, do it because you understand what it means to celebrate your
                  Principessa properly.
                </p>
              </div>
              <p className="mt-5 text-right font-serif text-xl text-[#e6ba73]">— Principessa</p>
            </div>

            <div className="rounded-[2rem] border border-rose-300/20 bg-black/30 p-5 text-center sm:p-7">
              <div aria-hidden className={`mx-auto text-6xl transition duration-500 ${celebration?.hasLeftRose ? "scale-110 drop-shadow-[0_0_22px_rgba(244,63,94,.65)]" : "opacity-75 grayscale-[.2]"}`}>
                🌹
              </div>
              <p className="mt-3 font-serif text-3xl text-rose-100">Offer Her a Rose</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                Free. One rose from each member of her court, preserved here after the birthday ends.
              </p>
              <p className="mt-5 font-serif text-4xl text-rose-200">{(celebration?.roseCount ?? 0).toLocaleString()}</p>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-200/45">roses at her throne</p>
              <button
                className="mt-5 w-full rounded-2xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-rose-50 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={!isLive || celebrationPending !== null || Boolean(celebration?.hasLeftRose)}
                onClick={() => void submitCelebration("rose")}
                type="button"
              >
                {celebrationPending === "rose"
                  ? "Placing your rose..."
                  : celebration?.hasLeftRose
                    ? "Your rose is here"
                    : hasEnded
                      ? "The rose court is sealed"
                      : isLive
                        ? "Place my rose"
                        : "Roses open with the court"}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-14" id="birthday-guestbook">
          <SectionRule label="The birthday guestbook" />
          <div className="mt-7 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
            <form
              className="rounded-[2rem] border border-pink-300/18 bg-[linear-gradient(145deg,rgba(42,10,29,.75),rgba(7,4,6,.94))] p-5 sm:p-7"
              onSubmit={(event) => {
                event.preventDefault();
                void submitCelebration("wish");
              }}
            >
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-pink-200/50">Your place in the memory</p>
              <h2 className="mt-3 font-serif text-3xl text-[#fff0d2]">Leave Principessa a birthday wish</h2>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                One message per account. You may edit it while the court is open. Links and HTML are not accepted.
              </p>
              <textarea
                className="mt-5 min-h-32 w-full resize-none rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm leading-6 text-pink-50 outline-none transition placeholder:text-zinc-700 focus:border-pink-300/40"
                disabled={!isLive || celebrationPending !== null}
                maxLength={BIRTHDAY_WISH_MAX_LENGTH}
                onChange={(event) => setWishDraft(event.target.value)}
                placeholder="Write something worthy of her guestbook..."
                value={wishDraft}
              />
              <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-600">
                <span>{celebration?.myWish ? "Editing your sealed message" : "Signed with your Court identity"}</span>
                <span>{wishDraft.length}/{BIRTHDAY_WISH_MAX_LENGTH}</span>
              </div>
              <button
                className="mt-4 w-full rounded-2xl bg-[linear-gradient(100deg,#9d174d,#db2777)] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_12px_32px_rgba(190,24,93,.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={!isLive || celebrationPending !== null || !wishDraft.trim()}
                type="submit"
              >
                {celebrationPending === "wish"
                  ? "Sealing your words..."
                  : celebration?.myWish
                    ? "Update my wish"
                    : hasEnded
                      ? "The guestbook is sealed"
                      : isLive
                        ? "Sign the guestbook"
                        : "Guestbook opens with the court"}
              </button>
              {celebrationError ? <p className="mt-3 text-xs leading-5 text-rose-200/75">{celebrationError}</p> : null}
            </form>

            <div className="rounded-[2rem] border border-[#e6ba73]/15 bg-black/25 p-4 sm:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#e6ba73]/45">Messages from her court</p>
                  <h3 className="mt-2 font-serif text-2xl text-[#fff0d2]">Birthday wishes</h3>
                </div>
                <p className="font-serif text-3xl text-pink-200">{celebration?.wishCount ?? 0}</p>
              </div>
              {(celebration?.wishes ?? []).length ? (
                <ul className="mt-5 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                  {celebration!.wishes.map((wish) => (
                    <li className={`rounded-2xl border px-4 py-3 ${wish.isMine ? "border-pink-300/30 bg-pink-500/10" : "border-white/[0.07] bg-white/[0.025]"}`} key={wish.id}>
                      <p className="text-sm leading-6 text-pink-50/85">“{wish.message}”</p>
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#e6ba73]/55">
                        {wish.displayName || wish.username || "A member of her court"}{wish.isMine ? " · You" : ""}
                      </p>
                      {celebration?.canModerate ? (
                        <button
                          className="mt-2 text-[9px] font-black uppercase tracking-[0.12em] text-rose-300/55 transition hover:text-rose-200 disabled:opacity-40"
                          disabled={celebrationPending !== null}
                          onClick={() => void hideBirthdayWish(wish.id)}
                          type="button"
                        >
                          Hide wish
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-600">
                  Her guestbook is waiting for its first message.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- cake stage */}
        <div className="mt-14" id="candle-ritual">
          <SectionRule label="The candle ritual" />
          <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-zinc-500">
            {hasEnded ? (
              <>The ritual has ended. This is the final candle arrangement recorded during her birthday window.</>
            ) : (
              <>
                The cake begins in darkness. Every{" "}
                <span className="font-bold text-[#efd095]">{formatUsd(BIRTHDAY_CANDLE_USD)}</span> offered during her
                birthday lights one flame in her name.
              </>
            )}
          </p>
        </div>

        <section className="relative mt-7 rounded-[2.25rem] border border-[#c89a55]/25 bg-[linear-gradient(180deg,rgba(30,8,18,.72),rgba(6,3,5,.92))] p-5 shadow-[0_40px_120px_rgba(0,0,0,.6),0_0_80px_rgba(190,24,93,.1)] sm:p-9">
          <span className="pointer-events-none absolute inset-2 rounded-[1.9rem] border border-[#c89a55]/10" />
          <CornerOrnament className="pointer-events-none absolute left-3 top-3 h-9 w-9" />
          <CornerOrnament className="pointer-events-none absolute right-3 top-3 h-9 w-9 rotate-90" />
          <CornerOrnament className="pointer-events-none absolute bottom-3 right-3 h-9 w-9 rotate-180" />
          <CornerOrnament className="pointer-events-none absolute bottom-3 left-3 h-9 w-9 -rotate-90" />

          <div className="relative">
            <BirthdayCake candles={candles} />
          </div>

          {/* Stat row */}
          <div className="mt-7 grid grid-cols-3 divide-x divide-[#c89a55]/15 rounded-2xl border border-[#c89a55]/15 bg-black/35 py-4">
            <div className="px-2 text-center">
              <p className="font-serif text-3xl leading-none text-[#fff0d2] sm:text-4xl">
                {candlesLit}
                <span className="text-xl text-[#c89a55]/45"> / {BIRTHDAY_TARGET_CANDLES}</span>
              </p>
              <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-[#c89a55]/50">Candles lit</p>
            </div>
            <div className="px-2 text-center">
              <p className="font-serif text-3xl leading-none text-pink-100 sm:text-4xl">{formatUsd(raisedUsd)}</p>
              <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-pink-200/40">
                of {formatUsd(BIRTHDAY_TARGET_USD)}
              </p>
            </div>
            <div className="px-2 text-center">
              <p className="font-serif text-3xl leading-none text-[#fff0d2] sm:text-4xl">
                {BIRTHDAY_TARGET_CANDLES - candlesLit}
              </p>
              <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-[#c89a55]/50">Still dark</p>
            </div>
          </div>

          {/* Near-miss bar: how close the NEXT candle is, not the whole goal. */}
          <div className="mt-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d7ad69]/75">
                {isComplete ? "Every candle is burning" : `Candle ${candlesLit + 1}`}
              </p>
              {!isComplete ? (
                <p className="text-base font-black text-pink-100">
                  {formatUsd(remaining)} <span className="text-xs font-bold text-zinc-500">to light it</span>
                </p>
              ) : null}
            </div>
            <div className="vm-shimmer relative mt-2.5 h-3.5 w-full overflow-hidden rounded-full border border-[#c89a55]/25 bg-black/60">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#9d174d,#be185d_45%,#e6ba73)] shadow-[0_0_18px_rgba(230,186,115,.45)] transition-[width] duration-700"
                style={{ width: `${candlePercent}%` }}
              />
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/60">
              <div
                className="h-full rounded-full bg-[#c89a55]/45 transition-[width] duration-700"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-zinc-600">
              {Math.floor(overallPercent)}% of the whole cake
            </p>
          </div>

          {isLive && !isComplete ? (
            <a
              className="group relative mt-7 block overflow-hidden rounded-2xl bg-[linear-gradient(100deg,#be185d,#db2777_55%,#e6ba73)] px-4 py-4 text-center text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_16px_40px_rgba(190,24,93,.35)] transition hover:brightness-110"
              href={PET_THRONE_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              {`Light candle ${candlesLit + 1}`}
            </a>
          ) : (
            <button
              className="relative mt-7 block w-full cursor-not-allowed overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center text-sm font-black uppercase tracking-[0.16em] text-zinc-600"
              disabled
              type="button"
            >
              {!actionsReady
                ? "Preparing the candle ritual"
                : hasEnded
                  ? "The 2026 candle ritual has ended"
                  : isComplete
                    ? "The ritual is complete"
                    : "The candle ritual opens soon"}
            </button>
          )}
          <div className="mt-4 rounded-2xl border border-[#e6ba73]/15 bg-black/35 p-4">
            {hasEnded ? (
              <div className="text-center sm:text-left">
                <p className="text-xs font-black uppercase tracking-[0.17em] text-[#efd095]/55">The ledger is sealed</p>
                <p className="mt-1 text-[11px] leading-5 text-zinc-600">
                  Candle codes are no longer needed on this archived page. The names already recorded remain with their
                  flames.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center justify-between gap-3 sm:flex-row sm:text-left">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.17em] text-[#efd095]">Put your name on the flame</p>
                    <p className="mt-1 max-w-xl text-[11px] leading-5 text-zinc-500">
                      Get your personal VM code, copy it, then paste it into the message field on Throne. Without a valid
                      code, the candle stays anonymous.
                    </p>
                  </div>

                  {tributeCodeStatus !== "ready" ? (
                    <button
                      className="shrink-0 rounded-xl border border-[#e6ba73]/30 bg-[#e6ba73]/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#ffe2ad] transition hover:bg-[#e6ba73]/20 disabled:cursor-wait disabled:opacity-55"
                      disabled={!actionsReady || tributeCodeStatus === "loading"}
                      onClick={() => void requestTributeCode()}
                      type="button"
                    >
                      {tributeCodeStatus === "loading" ? "Loading code..." : "Get candle code"}
                    </button>
                  ) : null}
                </div>

                {tributeCodeStatus === "ready" && tributeCode ? (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-pink-300/20 bg-pink-950/30 p-2">
                    <code className="min-w-0 flex-1 text-center text-base font-black tracking-[0.22em] text-pink-100">
                      {tributeCode}
                    </code>
                    <button
                      className="shrink-0 rounded-lg bg-pink-500 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white"
                      onClick={() => void copyTributeCode()}
                      type="button"
                    >
                      {codeCopied ? "Copied" : "Copy"}
                    </button>
                  </div>
                ) : null}

                {tributeCodeStatus === "auth-required" ? (
                  <p className="mt-3 text-center text-[11px] leading-5 text-amber-100/70 sm:text-left">
                    Sign in to Vault Mistress first to reveal your account-linked code.{" "}
                    <Link className="font-black text-[#efd095] underline underline-offset-4" href="/">
                      Sign in
                    </Link>
                  </p>
                ) : null}

                {tributeCodeStatus === "unavailable" ? (
                  <p className="mt-3 text-center text-[11px] leading-5 text-rose-200/75 sm:text-left">{tributeCodeError}</p>
                ) : null}
              </>
            )}
          </div>

          {loadFailed ? (
            <p className="mt-3 text-center text-[11px] text-rose-200/70">
              {loadFailureCode === "BIRTHDAY_PROGRESS_NOT_CONFIGURED"
                ? "Local preview: Supabase environment variables are missing, so live candle data is unavailable."
                : "Live candle count is temporarily unavailable."}
            </p>
          ) : null}
        </section>

        {/* ------------------------------------------------------- gift tiers */}
        <section className="relative mt-20 overflow-hidden rounded-[2.5rem] border border-pink-400/20 bg-[radial-gradient(circle_at_50%_0%,rgba(190,24,93,.24),transparent_43%),linear-gradient(180deg,rgba(38,8,24,.92),rgba(6,3,5,.98))] px-5 py-10 shadow-[0_30px_100px_rgba(0,0,0,.55)] sm:px-8 sm:py-12" id="birthday-wishlist">
          <span className="pointer-events-none absolute inset-2 rounded-[2.15rem] border border-pink-200/[0.07]" />
          <div className="relative text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.38em] text-pink-300/55">Entirely separate</p>
            <h2 className="mt-3 font-serif text-3xl text-[#fff0e5] sm:text-5xl">Principessa&apos;s Wishlist</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-zinc-400">
              {hasEnded
                ? "The wishlist is preserved as part of her 2026 birthday court. Its birthday links are now closed."
                : "These are presents for Principessa, not candle bundles. Choose what belongs at her throne; the candle ritual stands on its own."}
            </p>
          </div>

          <div className="relative mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BIRTHDAY_GIFTS.map((gift, index) => {
              const isFinale = gift.id === "crown-jewel";
              const cardClassName = `group relative flex flex-col overflow-hidden rounded-[1.5rem] border bg-[linear-gradient(165deg,rgba(28,10,18,.85),rgba(6,3,5,.95))] p-5 transition duration-300 ${
                giftsEnabled ? "hover:-translate-y-1" : "cursor-not-allowed opacity-55 grayscale-[.35]"
              } ${
                isFinale
                  ? "border-[#e6ba73]/55 shadow-[0_0_40px_rgba(230,186,115,.16)]"
                  : giftsEnabled
                    ? "border-[#c89a55]/20 hover:border-[#c89a55]/45"
                    : "border-[#c89a55]/15"
              }`;
              const cardContent = (
                <>
                  <span
                    className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-25 blur-2xl transition group-hover:opacity-45"
                    style={{ background: gift.accent }}
                  />
                  {isFinale ? (
                    <span className="absolute right-4 top-4 rounded-full border border-[#e6ba73]/50 bg-black/60 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-[#fff0d2]">
                      Crown gift
                    </span>
                  ) : null}

                  <BirthdayGiftBox
                    accent={gift.accent}
                    className={`relative h-24 w-24 self-center transition duration-300 ${
                      giftsEnabled ? "group-hover:-translate-y-1 group-hover:rotate-2" : ""
                    }`}
                    ribbon={gift.ribbon}
                    seed={index}
                  />

                  <p className="relative mt-4 text-center font-serif text-2xl text-[#fff0d2]">{gift.name}</p>
                  <p className="relative mt-1.5 text-center text-[11px] leading-5 text-zinc-500">{gift.blurb}</p>

                  <div className="relative mt-4 flex items-center justify-between border-t border-white/[0.07] pt-3">
                    <p className="font-serif text-3xl leading-none" style={{ color: gift.accent }}>
                      {formatUsd(gift.usd)}
                    </p>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300 transition group-hover:border-white/25 group-hover:text-white">
                      {hasEnded ? "Archived" : "Choose gift"}
                    </span>
                  </div>
                </>
              );

              return giftsEnabled ? (
                <a
                  className={cardClassName}
                  href={gift.url}
                  key={gift.id}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {cardContent}
                </a>
              ) : (
                <article className={cardClassName} data-disabled="true" key={gift.id}>
                  {cardContent}
                </article>
              );
            })}
          </div>

          <p className="relative mt-6 text-center text-[11px] leading-5 text-zinc-600">
            {hasEnded
              ? "The birthday wishlist is read-only. Principessa's regular Throne remains separate from this memory."
              : "Each card opens Principessa's Throne. Pick the gift there and leave your name on her birthday note."}
          </p>
        </section>

        {/* -------------------------------------------------------- roll call */}
        <section className="mt-14">
          <SectionRule label="Who lit them" />
          {litCandles.length === 0 ? (
            <p className="mt-6 rounded-[1.5rem] border border-white/[0.07] bg-black/25 px-4 py-10 text-center text-sm text-zinc-600">
              {hasEnded
                ? "The 2026 court closed without a recorded candle. The empty cake remains part of its memory."
                : "The cake is still dark. Nobody has lit a candle yet."}
            </p>
          ) : (
            <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {litCandles.map((candle) => (
                <li
                  className="flex items-center gap-3 rounded-2xl border border-[#c89a55]/15 bg-[linear-gradient(120deg,rgba(28,10,18,.7),rgba(6,3,5,.85))] px-3 py-2.5"
                  key={candle.index}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#c89a55]/30 bg-black/60 font-serif text-sm text-[#fff0d2] shadow-[0_0_14px_rgba(230,186,115,.25)]">
                    {candle.index}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-pink-100">
                    {resolveSupporterLabel(candle)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-16 space-y-2 text-center">
          <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-700">
            Her court. Her ledger. Her birthday.
          </p>
          <p className="text-[10px] text-zinc-800">
            {hasEnded
              ? "The 2026 candle count is sealed at the end of its 48-hour window."
              : "The candle ritual runs for one 48-hour window around 14 August."}
          </p>
        </footer>
      </div>

      {supportPrompt ? (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-[1.75rem] border border-[#e6ba73]/30 bg-[linear-gradient(145deg,rgba(43,10,28,.98),rgba(8,4,7,.98))] p-5 shadow-[0_24px_90px_rgba(0,0,0,.72)] backdrop-blur-xl">
          <button
            aria-label="Close"
            className="absolute right-4 top-3 text-xl text-zinc-500 transition hover:text-white"
            onClick={() => setSupportPrompt(null)}
            type="button"
          >
            ×
          </button>
          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#e6ba73]/60">Principessa noticed</p>
          <p className="mt-2 font-serif text-2xl text-[#fff0d2]">
            {supportPrompt === "rose" ? "A rose is a lovely beginning." : "Your words will remain in her court."}
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-400">
            {supportPrompt === "rose"
              ? isLive
                ? "If you want to leave more than a flower, one birthday flame is waiting for your name."
                : "If you want to leave more than a flower, her birthday wishlist is waiting."
              : "If those words are sincere, you may place something tangible beside them. No obligation—only an invitation."}
          </p>
          <div className="mt-4 flex gap-2">
            <a
              className="flex-1 rounded-xl bg-[linear-gradient(100deg,#be185d,#e6ba73)] px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.12em] text-white"
              href={supportPrompt === "rose" && isLive ? "#candle-ritual" : "#birthday-wishlist"}
              onClick={() => setSupportPrompt(null)}
            >
              {supportPrompt === "rose" && isLive ? "See the candle ritual" : "View her wishlist"}
            </a>
            <button
              className="rounded-xl border border-white/10 px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400"
              onClick={() => setSupportPrompt(null)}
              type="button"
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
