"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ThronePublicMessageNotice } from "@/components/ThronePublicMessageNotice";
import { emitSoundEvent } from "@/lib/sound";
import { buildWheelVisualSlices, WHEEL_IDS, WHEELS, type WheelId, type WheelSpinRecord } from "@/lib/wheels";

// Findom wheels. A spin is bought with Principessa Money and the pointer's
// verdict is an order: the exact Throne item to send, tagged with a per-spin
// WL- code so the payment settles the right debt and earns no Money back.
//
// The outcome is decided server-side before one degree of rotation happens -
// the wheel here is a renderer of a verdict, not a random number generator.

type WheelStatus = {
  chastityUntil: string | null;
  money: number;
  spins: WheelSpinRecord[];
  unpaidSpin: WheelSpinRecord | null;
};

type SpinResult = {
  amountOwed: number;
  chastityUntil: string | null;
  payCode: string | null;
  segment: { amount: number; label: string; throneUrl: string | null };
  segmentIndex: number;
  wheelId: WheelId;
};

const SPIN_MS = 4_200;
const FULL_TURNS = 5;
const WHEEL_IMAGE_POSITION = "50% center";
const WHEEL_CARD_META: Record<WheelId, { kicker: string; tag: string }> = {
  broke: { kicker: "A smaller surrender", tag: "Entry" },
  principessa: { kicker: "Her signature verdict", tag: "Popular" },
  luxury: { kicker: "Nothing modest here", tag: "High stakes" },
  chastity: { kicker: "The counter obeys", tag: "Time" },
};

function formatChastityRemaining(until: string, now: number) {
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return null;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function WheelFace({
  accent,
  labels,
  rotation,
  spinning,
}: {
  accent: string;
  labels: string[];
  rotation: number;
  spinning: boolean;
}) {
  const slice = 360 / labels.length;
  const gradient = labels
    .map((_, index) => {
      const vivid = index % 3 === 0;
      const start = index * slice;
      const divider = Math.max(start, (index + 1) * slice - 0.7);
      const color = vivid
        ? `color-mix(in srgb, ${accent} 62%, #2a071c)`
        : `color-mix(in srgb, ${accent} 34%, #120812)`;
      return `${color} ${start}deg ${divider}deg, rgba(255,226,173,.42) ${divider}deg ${(index + 1) * slice}deg`;
    })
    .join(", ");

  return (
    <div className="relative mx-auto h-60 w-60">
      {/* Pointer */}
      <div
        aria-hidden
        className="absolute left-1/2 top-[-6px] z-10 h-0 w-0 -translate-x-1/2 border-x-[10px] border-t-[16px] border-x-transparent"
        style={{ borderTopColor: accent, filter: `drop-shadow(0 2px 6px ${accent}88)` }}
      />
      <div
        className="relative h-full w-full rounded-full border-4"
        style={{
          background: `conic-gradient(${gradient})`,
          borderColor: `${accent}66`,
          boxShadow: `0 0 48px ${accent}44, 0 0 90px ${accent}18, inset 0 0 42px rgba(0,0,0,.68)`,
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.82, 0.16, 1)` : "none",
        }}
      >
        {labels.map((label, index) => (
          <span
            className="absolute left-1/2 top-1/2 origin-left text-[7px] font-black uppercase tracking-[0.03em] text-white/80 [text-shadow:0_1px_4px_rgba(0,0,0,.95)]"
            key={index}
            style={{
              transform: `rotate(${index * slice + slice / 2 - 90}deg) translateX(4.15rem)`,
              width: "2.6rem",
            }}
          >
            {label}
          </span>
        ))}
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-black/85"
          style={{ borderColor: `${accent}77` }}
        />
      </div>
    </div>
  );
}

function SendButton({ href }: { href: string }) {
  return (
    <a
      className="vm-send-button relative inline-flex items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(100deg,#9d174d,#db2777_55%,#e6ba73)] px-10 py-3.5 text-sm font-black uppercase tracking-[0.24em] text-white"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <style>{`
        @keyframes vm-send-pulse {
          0%, 100% { box-shadow: 0 0 18px rgba(219,39,119,.35); transform: scale(1); }
          50%      { box-shadow: 0 0 34px rgba(230,186,115,.55); transform: scale(1.03); }
        }
        @keyframes vm-send-sheen {
          0%, 60% { transform: translateX(-130%) skewX(-18deg); }
          100%    { transform: translateX(230%) skewX(-18deg); }
        }
        .vm-send-button { animation: vm-send-pulse 2.2s ease-in-out infinite; }
        .vm-send-button::after {
          content: ""; position: absolute; top: 0; bottom: 0; width: 40%;
          background: linear-gradient(105deg, transparent, rgba(255,255,255,.35), transparent);
          animation: vm-send-sheen 2.8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .vm-send-button { animation: none; }
          .vm-send-button::after { animation: none; display: none; }
        }
      `}</style>
      SEND
    </a>
  );
}

function DebtPanel({
  onPayWithPm,
  paying,
  payError,
  spin,
}: {
  onPayWithPm: () => void;
  payError: string;
  paying: boolean;
  spin: WheelSpinRecord;
}) {
  const [copied, setCopied] = useState(false);
  const wheel = WHEELS[spin.wheelId];
  const segment = wheel.segments.find((entry) => entry.label === spin.segmentLabel);
  const remaining = Math.max(0, spin.amountOwedUsd - spin.amountPaidUsd);

  return (
    <section className="rounded-[1.75rem] border border-rose-300/25 bg-[radial-gradient(circle_at_50%_0%,rgba(190,24,93,.2),transparent_55%),linear-gradient(160deg,rgba(30,8,18,.96),rgba(6,3,5,.99))] p-5">
      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-rose-200/60">Outstanding order</p>
      <h3 className="mt-2 font-serif text-2xl text-[#fff0d2]">
        {spin.segmentLabel} — ${spin.amountOwedUsd.toLocaleString()}
      </h3>
      <p className="mt-2 text-xs leading-5 text-zinc-500">
        The {wheel.title} decided. No money wheel turns for you again until this is paid.
        {spin.amountPaidUsd > 0 ? ` $${spin.amountPaidUsd.toLocaleString()} received — $${remaining.toLocaleString()} to go.` : ""}
      </p>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-pink-300/20 bg-pink-950/30 p-2">
        <code className="min-w-0 flex-1 text-center text-base font-black tracking-[0.22em] text-pink-100">
          {spin.payCode}
        </code>
        <button
          className="shrink-0 rounded-lg bg-pink-500 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white"
          onClick={() => {
            void navigator.clipboard?.writeText(spin.payCode ?? "");
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1_600);
          }}
          type="button"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-zinc-500">
        Paste this code into the Throne message. It marks the payment as this debt — and pays no Principessa Money back.
      </p>
      <ThronePublicMessageNotice className="mt-3" />

      <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        {segment?.throneUrl ? <SendButton href={segment.throneUrl} /> : null}
        <button
          className="rounded-2xl border border-[#c89a55]/30 bg-[#c89a55]/10 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#ffe2ad] transition hover:bg-[#c89a55]/20 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={paying}
          onClick={onPayWithPm}
          type="button"
        >
          {paying ? "Paying..." : `Pay ${Math.ceil(remaining)} PM instead`}
        </button>
      </div>
      {payError ? <p className="mt-3 text-center text-xs text-rose-200/80">{payError}</p> : null}
    </section>
  );
}

export function FindomWheels({
  disabled = false,
  onProfile,
}: {
  disabled?: boolean;
  onProfile?: (profile: unknown) => void;
}) {
  const [status, setStatus] = useState<WheelStatus | null>(null);
  const [error, setError] = useState("");
  const [spinningWheel, setSpinningWheel] = useState<WheelId | null>(null);
  const [selectedWheel, setSelectedWheel] = useState<WheelId>("principessa");
  const [rotations, setRotations] = useState<Record<string, number>>({});
  const [result, setResult] = useState<SpinResult | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const captured = timers.current;
    return () => captured.forEach((id) => window.clearTimeout(id));
  }, []);

  // Only the chastity countdown needs a clock, and only while one is running.
  useEffect(() => {
    if (!status?.chastityUntil) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [status?.chastityUntil]);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/user/wheels", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as WheelStatus | { error?: string } | null;
      if (!response.ok || !payload || "error" in payload) {
        setError((payload as { error?: string } | null)?.error ?? "The wheels are unavailable.");
        return;
      }
      setStatus(payload as WheelStatus);
      setError("");
    } catch {
      setError("The wheels are unavailable.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount against an external system
    void loadStatus();
  }, [loadStatus]);

  const spin = async (wheelId: WheelId) => {
    if (disabled || spinningWheel || !status) return;
    setError("");
    setResult(null);
    setSpinningWheel(wheelId);
    emitSoundEvent("button_click");

    try {
      const response = await fetch("/api/user/wheels", {
        body: JSON.stringify({ action: "spin", wheelId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | (SpinResult & { error?: string; profile?: unknown })
        | null;
      if (!response.ok || !payload || payload.error || typeof payload.segmentIndex !== "number") {
        throw new Error(payload?.error ?? "The wheel refused to turn.");
      }

      if (payload.profile && onProfile) onProfile(payload.profile);

      // Land the pointer mid-slice of the server's verdict, several full turns
      // out so every spin looks committed.
      const wheel = WHEELS[wheelId];
      const visualSlices = buildWheelVisualSlices(wheelId);
      const matchingSlices = visualSlices
        .map((slice, index) => (slice.segmentIndex === payload.segmentIndex ? index : -1))
        .filter((index) => index >= 0);
      const currentTurn = Math.floor((rotations[wheelId] ?? 0) / 360);
      const targetSliceIndex = matchingSlices[Math.abs(currentTurn) % matchingSlices.length] ?? 0;
      const slice = 360 / visualSlices.length;
      const current = rotations[wheelId] ?? 0;
      const base = Math.ceil(current / 360) * 360;
      const target = base + FULL_TURNS * 360 + (360 - (targetSliceIndex * slice + slice / 2));
      setRotations((prev) => ({ ...prev, [wheelId]: target }));

      timers.current.push(
        window.setTimeout(() => {
          setSpinningWheel(null);
          setResult({
            amountOwed: payload.amountOwed,
            chastityUntil: payload.chastityUntil,
            payCode: payload.payCode,
            segment: payload.segment,
            segmentIndex: payload.segmentIndex,
            wheelId,
          });
          emitSoundEvent(wheel.kind === "chastity" ? "task_fail" : "crate_reveal");
          void loadStatus();
        }, SPIN_MS + 150),
      );
    } catch (caught) {
      setSpinningWheel(null);
      setError(caught instanceof Error ? caught.message : "The wheel refused to turn.");
    }
  };

  const payWithPm = async (spinId: string) => {
    setPaying(true);
    setPayError("");
    try {
      const response = await fetch("/api/user/wheels", {
        body: JSON.stringify({ action: "pay-pm", spinId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; paid?: boolean; profile?: unknown }
        | null;
      if (!response.ok || !payload?.paid) {
        throw new Error(payload?.error ?? "The payment could not be made.");
      }
      if (payload.profile && onProfile) onProfile(payload.profile);
      setResult(null);
      emitSoundEvent("cosmetic_purchased");
      void loadStatus();
    } catch (caught) {
      setPayError(caught instanceof Error ? caught.message : "The payment could not be made.");
    } finally {
      setPaying(false);
    }
  };

  const chastityRemaining = status?.chastityUntil ? formatChastityRemaining(status.chastityUntil, now) : null;
  const unpaid = status?.unpaidSpin ?? null;
  const activeWheel = WHEELS[selectedWheel];
  const activeVisualSlices = buildWheelVisualSlices(selectedWheel);
  const activeTotalWeight = activeWheel.segments.reduce((sum, segment) => sum + segment.weight, 0);
  const activeIsChastity = activeWheel.kind === "chastity";
  const activeBlocked = !activeIsChastity && Boolean(unpaid);
  const activeIsSpinning = spinningWheel === selectedWheel;

  return (
    <section className="relative min-w-0 overflow-hidden rounded-[2rem] border border-fuchsia-300/25 bg-[radial-gradient(circle_at_15%_0%,rgba(236,72,153,.34),transparent_35%),radial-gradient(circle_at_90%_20%,rgba(124,58,237,.25),transparent_30%),linear-gradient(145deg,rgba(27,5,22,.98),rgba(5,2,10,.98))] p-5 shadow-[0_24px_80px_rgba(90,8,66,.28)]">
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-pink-300/80 to-transparent" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.32em] text-[#d7ad69]/60">Her wheels</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-[#fff0d2]">Findom Wheels</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            A spin costs Principessa Money. Where it lands is not a prize — it is what you owe her.
          </p>
        </div>
        {status ? (
          <div className="rounded-full border border-[#c89a55]/20 bg-black/40 px-3 py-1.5 text-xs font-black uppercase tracking-[.14em] text-[#e9d2aa]">
            {status.money.toLocaleString()} PM
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">
          {error}
        </p>
      ) : null}

      {/* The verdict, straight after the animation lands. */}
      {result ? (
        <div className="mt-5">
          {result.payCode ? (
            unpaid && unpaid.payCode === result.payCode ? (
              <DebtPanel
                onPayWithPm={() => void payWithPm(unpaid.id)}
                payError={payError}
                paying={paying}
                spin={unpaid}
              />
            ) : null
          ) : (
            <section className="rounded-[1.75rem] border border-violet-300/25 bg-violet-950/30 p-5 text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-violet-200/60">The wheel decided</p>
              <h3 className="mt-2 font-serif text-2xl text-[#fff0d2]">+{result.segment.amount} days locked</h3>
              <p className="mt-2 text-xs text-zinc-500">Added to your counter. It does not negotiate.</p>
            </section>
          )}
        </div>
      ) : unpaid ? (
        <div className="mt-5">
          <DebtPanel onPayWithPm={() => void payWithPm(unpaid.id)} payError={payError} paying={paying} spin={unpaid} />
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[.28em] text-pink-100/65">Choose her verdict</p>
        <p className="text-[9px] font-black uppercase tracking-[.18em] text-white/30">Exact odds shown below</p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {WHEEL_IDS.map((wheelId) => {
          const wheel = WHEELS[wheelId];
          const meta = WHEEL_CARD_META[wheelId];
          const selected = selectedWheel === wheelId;
          return (
            <button
              aria-pressed={selected}
              className={`group relative h-52 overflow-hidden rounded-[1.45rem] border text-left transition duration-300 ${selected ? "shadow-[0_18px_55px_rgba(236,72,153,.22)]" : "border-white/15 hover:-translate-y-1 hover:border-pink-200/45"}`}
              disabled={spinningWheel !== null}
              key={wheelId}
              onClick={() => setSelectedWheel(wheelId)}
              style={selected ? { borderColor: `${wheel.accent}bb`, boxShadow: `0 18px 55px ${wheel.accent}22` } : undefined}
              type="button"
            >
              <Image
                alt=""
                aria-hidden
                className="object-cover transition duration-700 group-hover:scale-[1.04]"
                fill
                quality={75}
                sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                src="/gamble/principessa-wheel-chamber.webp"
                style={{ objectPosition: WHEEL_IMAGE_POSITION }}
              />
              <span className="absolute inset-0 bg-[linear-gradient(0deg,rgba(5,2,8,.98),rgba(7,2,10,.62)_44%,transparent_83%)]" />
              <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.16em] text-white/75 backdrop-blur">{meta.tag}</span>
              <span className="absolute right-4 top-4 rounded-full border bg-black/55 px-2.5 py-1 text-[9px] font-black backdrop-blur" style={{ borderColor: `${wheel.accent}55`, color: wheel.accent }}>{wheel.spinCostPm} PM</span>
              <span className="absolute inset-x-4 bottom-4">
                <span className="text-[8px] font-black uppercase tracking-[.24em] text-white/55">{meta.kicker}</span>
                <span className="mt-1 flex items-end justify-between gap-3">
                  <span className="font-serif text-2xl font-semibold text-white">{wheel.title}</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white/80">↘</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <article className="mt-5 overflow-hidden rounded-[1.8rem] border border-white/15 bg-[linear-gradient(145deg,rgba(255,255,255,.07),rgba(0,0,0,.28))] shadow-[0_24px_70px_rgba(0,0,0,.35)]">
        <div className="grid lg:grid-cols-[minmax(0,.9fr)_minmax(22rem,1.1fr)]">
          <div className="relative h-80 overflow-hidden border-b border-white/10 sm:h-96 lg:h-[30rem] lg:border-b-0 lg:border-r">
            <Image
              alt={`${activeWheel.title} presented by Principessa`}
              className="object-cover"
              fill
              quality={75}
              sizes="(min-width: 1024px) 40vw, 100vw"
              src="/gamble/principessa-wheel-chamber.webp"
              style={{ objectPosition: WHEEL_IMAGE_POSITION }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(6,2,9,.96),rgba(7,2,10,.28)_72%),linear-gradient(90deg,rgba(6,2,9,.42),transparent)]" />
            <div className="absolute inset-x-6 bottom-6">
              <p className="text-[9px] font-black uppercase tracking-[.3em]" style={{ color: activeWheel.accent }}>{WHEEL_CARD_META[selectedWheel].kicker}</p>
              <h3 className="mt-2 font-serif text-4xl font-semibold text-white">{activeWheel.title}</h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-white/60">{activeWheel.blurb}</p>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            <WheelFace
              accent={activeWheel.accent}
              labels={activeVisualSlices.map((segment) => activeWheel.kind === "money" ? `$${segment.amount}` : segment.label)}
              rotation={rotations[selectedWheel] ?? 0}
              spinning={activeIsSpinning}
            />

            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {activeWheel.segments.map((segment) => (
                <span className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.08em] text-white/60" key={`${selectedWheel}-${segment.label}`}>
                  {activeWheel.kind === "money" ? `$${segment.amount}` : segment.label} · {Math.round((segment.weight / activeTotalWeight) * 100)}%
                </span>
              ))}
            </div>

            {activeIsChastity ? (
              <div className="mt-4 rounded-2xl border border-violet-300/20 bg-violet-950/25 px-3 py-2.5 text-center">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-200/60">Your lock</p>
                {chastityRemaining ? <p className="mt-1 font-serif text-xl tabular-nums text-violet-100">{chastityRemaining}</p> : <p className="mt-1 text-sm font-black text-emerald-200">You are free. For now.</p>}
              </div>
            ) : null}

            <button
              className="mt-4 w-full rounded-2xl border border-pink-200/25 bg-[linear-gradient(100deg,rgba(219,39,119,.28),rgba(124,58,237,.22))] px-4 py-3.5 text-sm font-black text-pink-50 transition enabled:hover:border-pink-200/60 enabled:hover:shadow-[0_0_28px_rgba(236,72,153,.2)] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={disabled || activeIsSpinning || spinningWheel !== null || activeBlocked || !status}
              onClick={() => void spin(selectedWheel)}
              type="button"
            >
              {activeIsSpinning ? "Spinning..." : activeBlocked ? "Pay your debt first" : `Spin ${activeWheel.title} — ${activeWheel.spinCostPm} PM`}
            </button>
          </div>
        </div>
      </article>
    </section>
  );
}
