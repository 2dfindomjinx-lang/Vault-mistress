"use client";

import Image from "next/image";
import styles from "./ExperienceSurfaces.module.css";
import c from "./CasinoExperience.module.css";
import { CasinoMetric } from "./CasinoTableFrame";
import { CourtGlyph } from "@/components/court/CourtVisuals";
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

type WheelDebtor = {
  amountUsd: number;
  createdAt: string;
  label: string;
  name: string;
  spinId: string;
};

type WheelStatus = {
  chastityUntil: string | null;
  debtors: WheelDebtor[];
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
  material,
  labels,
  rotation,
  spinning,
}: {
  accent: string;
  material: WheelId;
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

  return <div className={c.wheelFace}><span aria-hidden="true" className={c.wheelPointer} data-spinning={spinning} /><div className={c.wheelBody} data-material={material} style={{background:`conic-gradient(${gradient})`,transform:`rotate(${rotation}deg)`,transition:spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.82, 0.16, 1)` : "none"}}><svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 240 240">{labels.map((label,index) => {const angle=index*slice+slice/2-90;const radians=angle*Math.PI/180;const x=120+108*Math.cos(radians),y=120+108*Math.sin(radians);return <text dominantBaseline="central" fill="#f0dceb" fontSize="7" fontWeight="600" key={index} textAnchor="end" transform={`rotate(${angle} ${x} ${y})`} x={x} y={y}>{label}</text>;})}</svg></div><span aria-hidden="true" className={c.wheelHub}><CourtGlyph symbol={material === "chastity" ? "lock" : "crown"} /></span></div>;
}

function SendButton({ href }: { href: string }) {
  return (
    <a
      className={styles.sendAction}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      Send through Throne ↗
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
    <section className={c.orderPanel}>
      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-rose-200/60">Outstanding order</p>
      <h3 className="mt-2 font-serif text-2xl text-[#fff0d2]">
        {spin.segmentLabel} — ${spin.amountOwedUsd.toLocaleString()}
      </h3>
      <p className="mt-2 text-xs leading-5 text-zinc-500">
        The {wheel.title} decided. No money wheel turns for you again until this is paid.
        {spin.amountPaidUsd > 0 ? ` $${spin.amountPaidUsd.toLocaleString()} received — $${remaining.toLocaleString()} to go.` : ""}
      </p>

      <div className={c.paymentCode}>
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
  previewMode = false,
  onProfile,
}: {
  disabled?: boolean;
  previewMode?: boolean;
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
    if (previewMode) return;
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
  }, [previewMode]);

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



  const viewSpinning = activeIsSpinning;

  return (
    <section className={`${styles.surface} ${styles.wheels}`} id="verdict-wheels">
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-pink-300/80 to-transparent" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.32em] text-[#d7ad69]/60">Her wheels</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-[#fff0d2]">Findom Wheels</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Pay to spin. The result is an obligation: Money owed or time locked.
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
        <div className="court-wheel-result mt-5">
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
            <section className={c.orderPanel}>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-violet-200/60">The wheel decided</p>
              <div className="mx-auto mb-3 h-12 w-12 text-violet-200"><CourtGlyph symbol="lock"/></div><h3 className="mt-2 font-serif text-2xl text-[#fff0d2]">+{result.segment.amount}h locked</h3>
              <p className="mt-2 text-xs text-zinc-500">Added to your counter. It does not negotiate.</p>
            </section>
          )}
        </div>
      ) : unpaid ? (
        <div className="mt-5">
          <DebtPanel onPayWithPm={() => void payWithPm(unpaid.id)} payError={payError} paying={paying} spin={unpaid} />
        </div>
      ) : null}

      <div className={c.wheelTabs}>{WHEEL_IDS.map(wheelId => {const wheel=WHEELS[wheelId];return <button aria-pressed={selectedWheel === wheelId} disabled={spinningWheel !== null} key={wheelId} onClick={() => {setSelectedWheel(wheelId);}} type="button"><small>{WHEEL_CARD_META[wheelId].tag}</small><strong>{wheel.title}</strong><span>{wheel.spinCostPm} PM per spin</span></button>;})}</div>

      <article className={c.wheelChamber} data-phase={viewSpinning ? "spinning" : "ready"}>
        <div className={c.wheelPlay}><Image alt="" aria-hidden="true" className={c.wheelPortrait} height={600} src="/gamble/principessa-wheel-chamber.webp" style={{objectPosition:WHEEL_IMAGE_POSITION}} width={400} /><div className={c.stageLabel}><span>{WHEEL_CARD_META[selectedWheel].kicker}</span><span className={c.phase}><i />{viewSpinning ? "The verdict is turning" : "Her wheel awaits"}</span></div>
          <WheelFace accent={activeWheel.accent} labels={activeVisualSlices.map(segment => activeWheel.kind === "money" ? `$${segment.amount}` : segment.label)} material={selectedWheel} rotation={rotations[selectedWheel] ?? 0} spinning={viewSpinning} />
          <div aria-live="polite" className={c.wheelOutcome}>{activeIsSpinning ? "Wait for her final word." : result?.wheelId === selectedWheel ? <>The wheel decided<strong>{result.segment.label}</strong></> : "A fixed pointer. Her final decision."}</div>
        </div>
        <aside className={c.controls}><div><p className={c.controlTitle}>Her verdict wheel</p><h3 className={c.wheelControlTitle} style={{marginTop:10}}>{activeWheel.title}</h3></div><CasinoMetric label="Price per spin" value={activeWheel.spinCostPm+" PM"} detail={activeIsChastity ? "Result adds hours to your lock" : "Result becomes an order to pay"} /><p className={c.controlCopy}>{activeWheel.blurb}</p>
          <details className={c.oddsDisclosure}><summary>View every outcome & chance</summary><div className={c.wheelOdds}>{activeWheel.segments.map(segment => <span key={selectedWheel+segment.label}>{activeWheel.kind === "money" ? `$${segment.amount}` : segment.label}<small>{Math.round(segment.weight/activeTotalWeight*100)}%</small></span>)}</div></details>
          {activeIsChastity ? <CasinoMetric label="Your lock" value={chastityRemaining ?? "Free for now"} /> : null}
          <button className={c.action} disabled={disabled || activeIsSpinning || spinningWheel !== null || activeBlocked || !status} onClick={() => void spin(selectedWheel)} type="button">{activeIsSpinning ? "Spinning…" : activeBlocked ? "Pay your debt first" : `Spin · ${activeWheel.spinCostPm} PM`}</button>

        </aside>
      </article>

      {status?.debtors?.length ? (
        <article className="mt-4 rounded-[1.75rem] border border-amber-200/20 bg-black/35 p-5">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-200/70">The wheel remembers</p>
          <h3 className="mt-1 font-serif text-lg text-amber-50">Open debts</h3>
          <p className="mt-1 text-[11px] text-white/45">
            Clear anyone&apos;s order from your own Principessa Money. It still counts as their tribute.
          </p>
          <ul className="mt-3 space-y-2">
            {status.debtors.map((debtor) => (
              <li className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5" key={debtor.spinId}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white/85">{debtor.name}</p>
                  <p className="truncate text-[10px] text-white/40">{debtor.label}</p>
                </div>
                <span className="font-serif text-base tabular-nums text-amber-100">{debtor.amountUsd.toLocaleString()} PM</span>
                <button
                  className="rounded-xl border border-amber-200/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-black text-amber-100 transition enabled:hover:border-amber-200/60 disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={paying || disabled || (status?.money ?? 0) < debtor.amountUsd}
                  onClick={() => void payWithPm(debtor.spinId)}
                  type="button"
                >
                  {(status?.money ?? 0) < debtor.amountUsd ? "Not enough PM" : "Pay it"}
                </button>
              </li>
            ))}
          </ul>
          {payError ? <p className="mt-2 text-[11px] font-bold text-rose-300">{payError}</p> : null}
        </article>
      ) : null}
    </section>
  );
}
