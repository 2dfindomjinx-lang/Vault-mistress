"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CoinAmount } from "@/components/CoinAmount";
import { RARITY_HEX, getCrateItemImageUrl, type CrateRarity } from "@/lib/crates";
import {
  CRATE_UPGRADE_MAX_CHANCE,
  CRATE_UPGRADE_MULTIPLIERS,
  CRATE_UPGRADE_TARGET_EV,
  computeCrateUpgradeChance,
  listCrateUpgradeTargetItems,
  pickTargetForMultiplier,
  type CrateUpgradeTargetItem,
} from "@/lib/crate-upgrade";
import { emitSoundEvent } from "@/lib/sound";

// The Upgrader, laid out like a skin-upgrade site: your item in a diamond on
// the left, the target in a diamond on the right, and between them a diamond
// ring whose lit arc IS the printed chance. On confirm a marker runs laps
// around the ring and stops exactly on the server's real roll - inside the
// lit arc wins the target, outside burns your item. Opened from one inventory
// item; there is no separate "choose your item" step.

export type CrateUpgradeModalItem = {
  image_url?: string | null;
  item_id: string;
  name: string;
  rarity: CrateRarity;
  sell_value: number;
  variant: string;
};

type Phase = "picking" | "spinning" | "result";

type Props = {
  disabled?: boolean;
  item: CrateUpgradeModalItem;
  onClose: () => void;
  onNotice?: (message: string) => void;
  onUpgraded: () => void | Promise<void>;
};

const SPIN_MS = 4_600;
const LAPS = 4;
const RARITY_FILTERS: Array<CrateRarity | "all"> = ["all", "common", "uncommon", "rare", "epic", "legendary"];

// The ring is a diamond: top -> right -> bottom -> left -> top. A fraction of
// the perimeter maps to a point by walking its four equal sides.
const RING = { cx: 130, cy: 130, r: 104 };
const RING_POINTS = [
  [RING.cx, RING.cy - RING.r],
  [RING.cx + RING.r, RING.cy],
  [RING.cx, RING.cy + RING.r],
  [RING.cx - RING.r, RING.cy],
] as const;
const RING_PATH = `M${RING_POINTS[0].join(" ")} L${RING_POINTS[1].join(" ")} L${RING_POINTS[2].join(" ")} L${RING_POINTS[3].join(" ")} Z`;

function pointOnRing(fraction: number) {
  const f = ((fraction % 1) + 1) % 1;
  const scaled = f * 4;
  const side = Math.min(3, Math.floor(scaled));
  const t = scaled - side;
  const [x1, y1] = RING_POINTS[side];
  const [x2, y2] = RING_POINTS[(side + 1) % 4];
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
}

function easeOutQuart(t: number) {
  return 1 - Math.pow(1 - t, 4);
}

function formatChance(chance: number) {
  const percent = chance * 100;
  return `${percent.toFixed(percent < 1 ? 2 : percent < 10 ? 2 : 1)}%`;
}

function DiamondCard({
  caption,
  imageUrl,
  name,
  rarity,
  state,
  value,
  extra,
}: {
  caption: string;
  imageUrl: string | null;
  name: string | null;
  rarity: CrateRarity | null;
  state: "idle" | "won" | "lost" | "dim";
  value: number | null;
  extra?: string | null;
}) {
  const hex = rarity ? RARITY_HEX[rarity] : "#3f3f46";
  const frameColor = state === "won" ? "#34d399" : state === "lost" ? "#fb7185" : "#c89a55";
  return (
    <div className={`flex flex-col items-center transition-opacity duration-500 ${state === "dim" ? "opacity-40" : ""}`}>
      <div className="relative aspect-square w-[150px] sm:w-[200px]">
        <div
          className="absolute inset-[6%] rotate-45 rounded-[26%] border bg-[#110c14]"
          style={{ borderColor: `${frameColor}30` }}
        />
        <div
          className="absolute inset-[16%] rotate-45 rounded-[24%] border transition-[border-color,box-shadow] duration-500"
          style={{
            borderColor: `${frameColor}99`,
            boxShadow: state === "won" ? "0 0 40px rgba(52,211,153,.45)" : state === "lost" ? "0 0 32px rgba(251,113,133,.35)" : `0 0 30px ${hex}22`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={name ?? ""}
              className={`h-[52%] w-[52%] object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,.6)] transition-transform duration-500 ${state === "won" ? "scale-110" : ""} ${state === "lost" ? "grayscale" : ""}`}
              src={imageUrl}
            />
          ) : (
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-600">{caption}</span>
          )}
        </div>
        {state === "lost" ? (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-md border-2 border-rose-400/80 px-2 py-0.5 text-sm font-black uppercase tracking-[0.2em] text-rose-300">
            Burned
          </span>
        ) : null}
      </div>
      <div className="mt-2 w-full max-w-[240px] rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-600">{caption}</p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-black text-white">{name ?? "—"}</p>
          {value !== null ? <CoinAmount amount={value} className="shrink-0 text-xs font-black text-[#ffe2ad]" iconSize={12} label="" /> : null}
        </div>
        <div className="mt-0.5 flex items-baseline justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: hex }}>
            {rarity ?? ""}
          </p>
          {extra ? <p className="text-[10px] font-black text-[#e6ba73]">{extra}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function CrateUpgradeModal({ disabled = false, item, onClose, onNotice, onUpgraded }: Props) {
  const allTargets = useMemo(() => listCrateUpgradeTargetItems(), []);
  const eligible = useMemo(
    () => allTargets.filter((target) => target.sellValue > item.sell_value),
    [allTargets, item.sell_value],
  );

  const [target, setTarget] = useState<CrateUpgradeTargetItem | null>(() =>
    pickTargetForMultiplier(item.sell_value, 2, eligible),
  );
  const [activeMultiplier, setActiveMultiplier] = useState<number | null>(2);
  const [rarityFilter, setRarityFilter] = useState<CrateRarity | "all">("all");
  const [search, setSearch] = useState("");
  const [phase, setPhase] = useState<Phase>("picking");
  const [pointer, setPointer] = useState(0);
  const [won, setWon] = useState<boolean | null>(null);
  const [showRules, setShowRules] = useState(false);
  const frameRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const chance = target ? computeCrateUpgradeChance(item.sell_value, target.sellValue) : null;
  const multiplier = target ? target.sellValue / item.sell_value : null;
  const itemImage = getCrateItemImageUrl(item.item_id, item.image_url ?? null);
  // Always gold, never the target's rarity colour: a grey "common" arc read
  // as disabled rather than as the zone you are hoping to land in.
  const winHex = "#e6ba73";

  const visibleTargets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return eligible.filter(
      (entry) =>
        (rarityFilter === "all" || entry.rarity === rarityFilter) &&
        (!query || entry.name.toLowerCase().includes(query) || entry.crateName.toLowerCase().includes(query)),
    );
  }, [eligible, rarityFilter, search]);

  const chooseMultiplier = (value: number) => {
    if (phase !== "picking") return;
    const picked = pickTargetForMultiplier(item.sell_value, value, eligible);
    if (picked) {
      setTarget(picked);
      setActiveMultiplier(value);
    }
  };

  const animatePointer = (rollFraction: number, onDone: () => void) => {
    const end = LAPS + rollFraction;
    let lastNotch = -1;
    // The first frame's timestamp is the spin clock's zero.
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / SPIN_MS);
      const value = end * easeOutQuart(t);
      setPointer(value);
      // A click each time the marker passes one of the eight ring studs.
      const notch = Math.floor(value * 8);
      if (notch !== lastNotch) {
        lastNotch = notch;
        if (t < 0.97) emitSoundEvent("crate_reel_tick");
      }
      if (t < 1) {
        frameRef.current = window.requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
        onDone();
      }
    };
    frameRef.current = window.requestAnimationFrame(tick);
  };

  const confirm = async () => {
    if (disabled || phase !== "picking" || !target || chance === null) return;
    setPhase("spinning");
    setWon(null);
    setPointer(0);
    try {
      const response = await fetch("/api/user/crate-upgrade", {
        body: JSON.stringify({
          itemId: item.item_id,
          targetItemId: target.itemId,
          targetVariant: target.variant,
          variant: item.variant,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; rollPercent?: number; success?: boolean; won?: boolean }
        | null;
      if (!response.ok || !payload?.success) throw new Error(payload?.error ?? "Upgrade failed.");

      const didWin = payload.won === true;
      // The marker stops on the real roll. The lit arc starts at the top and
      // runs clockwise for exactly `chance` of the ring, so a roll under the
      // chance lands inside it - the picture and the outcome cannot disagree.
      const rollFraction = Math.max(0, Math.min(0.9999, (payload.rollPercent ?? (didWin ? chance * 50 : 50 + chance * 50)) / 100));
      animatePointer(rollFraction, () => {
        setWon(didWin);
        setPhase("result");
        emitSoundEvent(didWin ? "crate_legendary_reveal" : "task_fail");
        void onUpgraded();
      });
    } catch (error) {
      setPhase("picking");
      onNotice?.(error instanceof Error ? error.message : "Upgrade failed.");
    }
  };

  const marker = pointOnRing(pointer);
  const leftState = phase === "result" ? (won ? "dim" : "lost") : "idle";
  const rightState = phase === "result" ? (won ? "won" : "dim") : "idle";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 px-3 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto w-full max-w-5xl rounded-[2rem] border border-[#c89a55]/20 bg-[radial-gradient(circle_at_50%_30%,rgba(200,154,85,.08),transparent_45%),linear-gradient(160deg,#120d16,#07050a)] p-4 shadow-[0_30px_100px_rgba(0,0,0,.6)] sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <button
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg text-zinc-300 transition hover:text-white disabled:opacity-30"
            disabled={phase === "spinning"}
            onClick={onClose}
            type="button"
          >
            ‹
          </button>
          <h3 className="font-serif text-2xl font-semibold text-[#fff0d2]">Upgrader</h3>
          <button
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-black text-zinc-300 transition hover:text-white"
            onClick={() => setShowRules((current) => !current)}
            type="button"
          >
            ⓘ How it works
          </button>
        </div>
        {showRules ? (
          <p className="mx-auto mt-3 max-w-xl rounded-xl border border-[#c89a55]/20 bg-black/40 px-4 py-3 text-center text-xs leading-5 text-zinc-400">
            Your chance = {Math.round(CRATE_UPGRADE_TARGET_EV * 100)}% × your item&apos;s value ÷ the target&apos;s value,
            capped at {Math.round(CRATE_UPGRADE_MAX_CHANCE * 100)}%. The marker stops on a server-side roll: inside the lit
            arc, your item becomes the target. Outside it, your item is gone. The house keeps{" "}
            {Math.round((1 - CRATE_UPGRADE_TARGET_EV) * 100)}% - more on near-equal swaps that hit the cap - printed, never
            hidden.
          </p>
        ) : null}

        {/* Stage */}
        <div className="mt-6 grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
          <DiamondCard
            caption="Your item"
            imageUrl={itemImage}
            name={item.name}
            rarity={item.rarity}
            state={leftState}
            value={item.sell_value}
          />

          {/* The ring */}
          <div className="relative mx-auto aspect-square w-[240px] sm:w-[280px]">
            <svg className="h-full w-full overflow-visible" viewBox="0 0 260 260">
              <defs>
                <filter id="vm-upgrade-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* Outer hairline + studs */}
              <path
                d={`M130 6 L254 130 L130 254 L6 130 Z`}
                fill="none"
                stroke="#c89a55"
                strokeLinejoin="round"
                strokeOpacity="0.25"
                strokeWidth="1"
              />
              {Array.from({ length: 8 }, (_, index) => {
                const point = pointOnRing(index / 8);
                return <circle cx={point.x} cy={point.y} fill="#e6ba73" fillOpacity="0.85" key={index} r="3.5" />;
              })}
              {/* Track */}
              <path d={RING_PATH} fill="#0d0a10" stroke="#241d2a" strokeLinejoin="round" strokeWidth="18" />
              {/* Lit arc = the chance, starting at the top, clockwise */}
              {chance !== null ? (
                <path
                  d={RING_PATH}
                  fill="none"
                  filter="url(#vm-upgrade-glow)"
                  pathLength={100}
                  stroke={winHex}
                  strokeDasharray={`${(chance * 100).toFixed(3)} 100`}
                  strokeLinejoin="round"
                  strokeOpacity={phase === "result" && won === false ? 0.35 : 0.95}
                  strokeWidth="18"
                />
              ) : null}
              {/* Marker */}
              <g filter="url(#vm-upgrade-glow)">
                <circle cx={marker.x} cy={marker.y} fill="#fff7e6" r="9" />
                <circle cx={marker.x} cy={marker.y} fill={phase === "result" ? (won ? "#34d399" : "#fb7185") : "#e6ba73"} r="5" />
              </g>
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              {phase === "result" ? (
                <>
                  <p className={`font-serif text-3xl font-semibold ${won ? "text-emerald-300" : "text-rose-300"}`}>
                    {won ? "Upgraded" : "Lost"}
                  </p>
                  <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                    at {chance !== null ? formatChance(chance) : "—"}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-serif text-3xl font-semibold text-white tabular-nums">
                    {chance !== null ? formatChance(chance) : "—"}
                  </p>
                  <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">Upgrade chance</p>
                </>
              )}
            </div>
          </div>

          <DiamondCard
            caption="Target"
            extra={multiplier !== null ? `${multiplier.toFixed(2)}x` : null}
            imageUrl={target?.imageUrl ?? null}
            name={target?.name ?? null}
            rarity={target?.rarity ?? null}
            state={rightState}
            value={target?.sellValue ?? null}
          />
        </div>

        {/* Action bar */}
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 md:flex-row md:items-center">
          <div className="flex flex-wrap gap-1.5">
            {CRATE_UPGRADE_MULTIPLIERS.map((value) => (
              <button
                className={`h-11 min-w-[52px] rounded-xl border px-3 text-sm font-black transition disabled:opacity-40 ${
                  activeMultiplier === value
                    ? "border-[#e6ba73]/70 bg-[#c89a55]/20 text-[#ffe2ad]"
                    : "border-white/[0.08] bg-black/30 text-zinc-300 hover:border-white/20"
                }`}
                disabled={phase !== "picking"}
                key={value}
                onClick={() => chooseMultiplier(value)}
                type="button"
              >
                {value}x
              </button>
            ))}
          </div>
          <div className="flex flex-1 justify-center md:justify-end">
            {phase === "result" ? (
              // The item is spent either way, so there is nothing to retry
              // with here - closing returns to the refreshed inventory.
              <button
                className={`h-12 w-full rounded-xl border px-10 text-sm font-black uppercase tracking-[0.14em] transition md:w-auto md:min-w-[320px] ${
                  won ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100" : "border-white/15 text-zinc-200 hover:border-white/30"
                }`}
                onClick={onClose}
                type="button"
              >
                {won ? "Collect" : "Close"}
              </button>
            ) : (
              <button
                className="h-12 w-full rounded-xl bg-[linear-gradient(100deg,#e6ba73,#c89a55)] px-10 text-sm font-black uppercase tracking-[0.14em] text-[#1a1008] shadow-[0_10px_30px_rgba(200,154,85,.25)] transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 md:w-auto md:min-w-[320px]"
                disabled={disabled || phase !== "picking" || !target || chance === null}
                onClick={() => void confirm()}
                type="button"
              >
                {phase === "spinning" ? "Rolling..." : chance !== null ? `⇪ Upgrade · ${formatChance(chance)}` : "Pick a target"}
              </button>
            )}
          </div>
        </div>

        {/* Target browser */}
        {phase === "picking" ? (
          <div className="mt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {RARITY_FILTERS.map((value) => (
                  <button
                    className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] transition ${
                      rarityFilter === value ? "border-white/30 bg-white/10 text-white" : "border-white/[0.07] bg-black/30 text-zinc-500 hover:text-zinc-300"
                    }`}
                    key={value}
                    onClick={() => setRarityFilter(value)}
                    style={value !== "all" && rarityFilter !== value ? { color: RARITY_HEX[value] } : undefined}
                    type="button"
                  >
                    {value}
                  </button>
                ))}
              </div>
              <input
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-[#c89a55]/50 sm:w-56"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search items or cases"
                value={search}
              />
            </div>
            {visibleTargets.length === 0 ? (
              <p className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-6 text-center text-sm text-zinc-500">
                {eligible.length === 0 ? "Nothing on the shelves is worth more than this item." : "No items match."}
              </p>
            ) : (
              <div className="mt-3 grid max-h-[300px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-5">
                {visibleTargets.map((entry) => {
                  const entryChance = computeCrateUpgradeChance(item.sell_value, entry.sellValue);
                  const selected = target?.itemId === entry.itemId && target.variant === entry.variant;
                  return (
                    <button
                      className={`group flex flex-col items-center rounded-xl border bg-black/30 p-2 text-center transition ${
                        selected ? "bg-white/[0.06]" : "border-white/[0.07] hover:border-white/20"
                      }`}
                      key={`${entry.itemId}:${entry.variant}`}
                      onClick={() => {
                        setTarget(entry);
                        setActiveMultiplier(null);
                      }}
                      style={{
                        borderColor: selected ? RARITY_HEX[entry.rarity] : undefined,
                        boxShadow: selected ? `0 0 18px ${RARITY_HEX[entry.rarity]}40` : undefined,
                      }}
                      type="button"
                    >
                      <div className="h-px w-8 rounded-full" style={{ background: RARITY_HEX[entry.rarity] }} />
                      {entry.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" className="mt-1.5 h-14 w-14 object-contain transition group-hover:scale-105" loading="lazy" src={entry.imageUrl} />
                      ) : (
                        <div className="mt-1.5 h-14 w-14" />
                      )}
                      <p className="mt-1 w-full truncate text-[11px] font-bold text-zinc-100">{entry.name}</p>
                      <div className="mt-0.5 flex w-full items-center justify-between gap-1">
                        <CoinAmount amount={entry.sellValue} className="text-[10px] font-black text-[#ffe2ad]" iconSize={10} label="" />
                        <span className="text-[10px] font-black text-zinc-500">{entryChance !== null ? formatChance(entryChance) : ""}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
