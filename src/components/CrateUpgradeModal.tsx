"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RARITY_COLORS, RARITY_ORDER, SAMPLE_CRATE_ITEMS, type CrateRarity } from "@/lib/crates";
import { CRATE_UPGRADE_TARGET_EV, computeCrateUpgradeChance, listCrateUpgradeTargets } from "@/lib/crate-upgrade";
import { emitSoundEvent } from "@/lib/sound";

// The Upgrade popup: opened from a single inventory item, never its own
// section. Pick a target, see the exact chance, confirm or walk away - the
// item itself is already decided, there is no separate "choose fodder" step
// here, that step was the click that opened this.
//
// The reveal is the classic upgrade-contract bar (CS2/skin-upgrader style):
// a horizontal meter where the win zone's width IS the printed chance, and a
// marker slides across it and lands exactly on the server's real outcome
// roll - never an approximation of "somewhere in the right half."

export type CrateUpgradeModalItem = {
  item_id: string;
  name: string;
  rarity: CrateRarity;
  sell_value: number;
  variant: string;
};

type SpinPhase = "picking" | "spinning" | "result";

type UpgradeResult = {
  won: boolean;
  chancePercent: number;
  rollPercent: number;
  rewardItemId: string | null;
  rewardVariant: string | null;
};

type Props = {
  disabled?: boolean;
  item: CrateUpgradeModalItem;
  onClose: () => void;
  onNotice?: (message: string) => void;
  onUpgraded: () => void | Promise<void>;
};

const SPIN_MS = 1900;

export function CrateUpgradeModal({ disabled = false, item, onClose, onNotice, onUpgraded }: Props) {
  const targets = useMemo(() => listCrateUpgradeTargets(), []);
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [phase, setPhase] = useState<SpinPhase>("picking");
  const [markerPercent, setMarkerPercent] = useState(0);
  const [result, setResult] = useState<UpgradeResult | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const captured = timers.current;
    return () => captured.forEach((id) => window.clearTimeout(id));
  }, []);

  const eligibleTargets = useMemo(
    () => targets.filter((target) => target.avgSellValue > item.sell_value),
    [item.sell_value, targets],
  );

  const targetsByCrate = useMemo(() => {
    const grouped = new Map<string, { crateName: string; rarities: typeof eligibleTargets }>();
    for (const target of eligibleTargets) {
      const bucket = grouped.get(target.crateType) ?? { crateName: target.crateName, rarities: [] };
      bucket.rarities.push(target);
      grouped.set(target.crateType, bucket);
    }
    return grouped;
  }, [eligibleTargets]);

  const selectedTarget = useMemo(
    () => eligibleTargets.find((target) => `${target.crateType}:${target.rarity}` === targetKey) ?? null,
    [eligibleTargets, targetKey],
  );

  const chance = selectedTarget ? computeCrateUpgradeChance(item.sell_value, selectedTarget.avgSellValue) : null;
  const chancePercent = chance !== null ? chance * 100 : 0;

  const confirm = async () => {
    if (disabled || phase !== "picking" || !selectedTarget || chance === null) return;
    setPhase("spinning");
    setMarkerPercent(0);
    emitSoundEvent("crate_reel_tick");
    try {
      const response = await fetch("/api/user/crate-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.item_id,
          variant: item.variant,
          toCrateType: selectedTarget.crateType,
          toRarity: selectedTarget.rarity,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: string;
            won?: boolean;
            chancePercent?: number;
            rollPercent?: number;
            rewardItemId?: string | null;
            rewardVariant?: string | null;
          }
        | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Upgrade failed.");
      }
      const won = payload.won === true;
      const landedAt = payload.rollPercent ?? (won ? chancePercent / 2 : (chancePercent + 100) / 2);

      // Reset to 0 and force a reflow before setting the real target, the
      // same trick the reel transforms use elsewhere - otherwise the browser
      // can coalesce both writes and skip the animation entirely.
      timers.current.push(
        window.setTimeout(() => setMarkerPercent(landedAt), 20),
      );
      timers.current.push(
        window.setTimeout(() => {
          setResult({
            won,
            chancePercent: payload.chancePercent ?? chancePercent,
            rollPercent: landedAt,
            rewardItemId: payload.rewardItemId ?? null,
            rewardVariant: payload.rewardVariant ?? null,
          });
          setPhase("result");
          emitSoundEvent(won ? "crate_legendary_reveal" : "task_fail");
        }, SPIN_MS),
      );
      await onUpgraded();
    } catch (error) {
      setPhase("picking");
      onNotice?.(error instanceof Error ? error.message : "Upgrade failed.");
    }
  };

  const rewardDef = result?.rewardItemId ? SAMPLE_CRATE_ITEMS[result.rewardItemId] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true">
      <style>{`
        .vm-upgrade-marker { transition: left ${SPIN_MS}ms cubic-bezier(0.1, 0.65, 0.15, 1); }
      `}</style>
      <div className="w-full max-w-md rounded-[1.75rem] border border-[#c89a55]/30 bg-[linear-gradient(145deg,rgba(17,6,13,.98),rgba(3,2,4,.98))] p-5 shadow-[0_24px_80px_rgba(0,0,0,.5)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#d7ad69]/60">Risk it for something better</p>
            <h3 className="mt-1 font-serif text-2xl font-semibold text-[#fff0d2]">Upgrade</h3>
          </div>
          {phase === "picking" ? (
            <button
              className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-zinc-300 hover:text-white"
              onClick={onClose}
              type="button"
            >
              ✕
            </button>
          ) : null}
        </div>

        {/* Your item -> target item, CS2-upgrader style two-sided preview */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <span className="text-xs font-bold text-white">{item.name}</span>
            <span className="text-[10px]" style={{ color: RARITY_COLORS[item.rarity] }}>
              {item.sell_value.toLocaleString()}
            </span>
          </div>
          <span className="shrink-0 text-zinc-600">→</span>
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/20 px-3 py-2 text-center">
            {selectedTarget ? (
              <span className="text-[10px] font-black uppercase tracking-[0.1em]" style={{ color: RARITY_COLORS[selectedTarget.rarity] }}>
                {selectedTarget.rarity} · {selectedTarget.crateName}
              </span>
            ) : (
              <span className="text-[10px] text-zinc-600">pick a target</span>
            )}
          </div>
        </div>

        {phase !== "picking" ? (
          <div className="mt-5">
            {/* The bar: win zone width = the printed chance, marker lands on the real roll */}
            <div className="relative h-8 overflow-hidden rounded-full border border-white/10 bg-black/50">
              <div
                className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#10b981,#34d399)]"
                style={{ width: `${chancePercent}%` }}
              />
              <div
                className="absolute inset-y-0 bg-[linear-gradient(90deg,#4c0519,#7f1d1d)]"
                style={{ left: `${chancePercent}%`, right: 0 }}
              />
              <div
                className="vm-upgrade-marker absolute top-1/2 h-6 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,.9)]"
                style={{ left: `${markerPercent}%` }}
              />
            </div>
            <p className="mt-1.5 text-center text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">
              {phase === "spinning" ? "Flipping..." : result?.won ? "Landed in the green." : "Landed in the red."}
            </p>
          </div>
        ) : null}

        {phase === "result" && result ? (
          <div className={`mt-4 rounded-2xl border p-3 text-center ${result.won ? "border-emerald-300/30 bg-emerald-500/10" : "border-rose-300/30 bg-rose-500/10"}`}>
            {result.won ? (
              <p className="text-sm font-black text-emerald-200">
                {result.chancePercent.toFixed(result.chancePercent < 1 ? 2 : 1)}% hit. {rewardDef ? `You won ${rewardDef.name}.` : "You won."}
              </p>
            ) : (
              <p className="text-sm font-black text-rose-200">
                {result.chancePercent.toFixed(result.chancePercent < 1 ? 2 : 1)}% missed. She keeps it.
              </p>
            )}
            <button
              className="mt-3 rounded-xl border border-white/15 px-5 py-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-200 hover:border-white/30"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        ) : null}

        {phase === "picking" ? (
          <>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
              Target - worth more than {item.sell_value.toLocaleString()}
            </p>
            {targetsByCrate.size === 0 ? (
              <p className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-400">
                Nothing outranks this item&apos;s value.
              </p>
            ) : (
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                {Array.from(targetsByCrate.entries()).map(([crateType, bucket]) => (
                  <div className="rounded-xl border border-white/10 bg-black/25 p-2.5" key={crateType}>
                    <p className="px-1 text-xs font-black text-[#e9d2aa]">{bucket.crateName}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {RARITY_ORDER.filter((rarity) => bucket.rarities.some((target) => target.rarity === rarity)).map((rarity) => {
                        const target = bucket.rarities.find((entry) => entry.rarity === rarity)!;
                        const key = `${crateType}:${rarity}`;
                        const active = key === targetKey;
                        const targetChance = computeCrateUpgradeChance(item.sell_value, target.avgSellValue);
                        return (
                          <button
                            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-black transition ${active ? "border-[#e6ba73]/60 bg-[#c89a55]/15 text-[#ffe2ad]" : "border-white/10 bg-black/30 text-zinc-400 hover:text-zinc-200"}`}
                            key={key}
                            onClick={() => setTargetKey(key)}
                            style={active ? undefined : { color: RARITY_COLORS[rarity] }}
                            type="button"
                          >
                            {rarity}
                            <span className="ml-1 text-zinc-500">
                              {targetChance !== null ? `${(targetChance * 100).toFixed(targetChance < 0.01 ? 2 : 1)}%` : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-zinc-300 hover:border-white/30"
                onClick={onClose}
                type="button"
              >
                Never mind
              </button>
              <button
                className="flex-1 rounded-xl border border-pink-200/25 bg-pink-500/15 px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-pink-50 transition enabled:hover:bg-pink-500/25 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={disabled || !selectedTarget || chance === null}
                onClick={() => void confirm()}
                type="button"
              >
                {chance !== null ? `Upgrade — ${(chance * 100).toFixed(chance < 0.01 ? 2 : 1)}%` : "Pick a target"}
              </button>
            </div>
            <p className="mt-2 text-center text-[9px] text-zinc-600">Printed edge: house keeps {Math.round((1 - CRATE_UPGRADE_TARGET_EV) * 100)}%</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
