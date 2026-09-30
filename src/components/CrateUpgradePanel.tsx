"use client";

import { useMemo, useState } from "react";
import {
  RARITY_COLORS,
  RARITY_ORDER,
  getCrateItemImageUrl,
  SAMPLE_CRATE_ITEMS,
  type CrateRarity,
} from "@/lib/crates";
import { CRATE_UPGRADE_TARGET_EV, computeCrateUpgradeChance, listCrateUpgradeTargets } from "@/lib/crate-upgrade";
import { emitSoundEvent } from "@/lib/sound";

// The Upgrade table. One owned item risked, any crate + rarity above it named
// as the target, one coin flip. The chance shown here is computed from the
// exact same shared module the server uses to settle the attempt - nothing
// is approximated for display and re-decided for real.

export type CrateUpgradeInventoryItem = {
  item_id: string;
  name: string;
  image_url?: string | null;
  rarity: CrateRarity;
  sell_value: number;
  variant: string;
  quantity: number;
};

type UpgradeResult = {
  won: boolean;
  chancePercent: number;
  rewardItemId: string | null;
  rewardVariant: string | null;
};

type Props = {
  disabled?: boolean;
  inventory: CrateUpgradeInventoryItem[];
  onNotice?: (message: string) => void;
  onUpgraded: () => void | Promise<void>;
};

export function CrateUpgradePanel({ disabled = false, inventory, onNotice, onUpgraded }: Props) {
  const targets = useMemo(() => listCrateUpgradeTargets(), []);
  const [fodderKey, setFodderKey] = useState<string | null>(null);
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<UpgradeResult | null>(null);

  const eligibleFodder = useMemo(
    () =>
      inventory
        .filter((item) => item.item_id !== "classic" && item.sell_value > 0 && item.quantity > 0)
        .sort((a, b) => b.sell_value - a.sell_value),
    [inventory],
  );

  const selectedFodder = useMemo(
    () => eligibleFodder.find((item) => `${item.item_id}:${item.variant}` === fodderKey) ?? null,
    [eligibleFodder, fodderKey],
  );

  const eligibleTargets = useMemo(() => {
    if (!selectedFodder) return [];
    return targets.filter((target) => target.avgSellValue > selectedFodder.sell_value);
  }, [selectedFodder, targets]);

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

  const chance =
    selectedFodder && selectedTarget
      ? computeCrateUpgradeChance(selectedFodder.sell_value, selectedTarget.avgSellValue)
      : null;

  const selectFodder = (item: CrateUpgradeInventoryItem) => {
    setFodderKey(`${item.item_id}:${item.variant}`);
    setTargetKey(null);
    setResult(null);
  };

  const attempt = async () => {
    if (disabled || pending || !selectedFodder || !selectedTarget || chance === null) return;
    setPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/user/crate-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedFodder.item_id,
          variant: selectedFodder.variant,
          toCrateType: selectedTarget.crateType,
          toRarity: selectedTarget.rarity,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string; won?: boolean; chancePercent?: number; rewardItemId?: string | null; rewardVariant?: string | null }
        | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Upgrade failed.");
      }
      const won = payload.won === true;
      setResult({
        won,
        chancePercent: payload.chancePercent ?? chance * 100,
        rewardItemId: payload.rewardItemId ?? null,
        rewardVariant: payload.rewardVariant ?? null,
      });
      emitSoundEvent(won ? "crate_legendary_reveal" : "task_fail");
      setFodderKey(null);
      setTargetKey(null);
      await onUpgraded();
    } catch (error) {
      onNotice?.(error instanceof Error ? error.message : "Upgrade failed.");
    } finally {
      setPending(false);
    }
  };

  const rewardDef = result?.rewardItemId ? SAMPLE_CRATE_ITEMS[result.rewardItemId] : null;

  return (
    <section className="mt-4 rounded-[1.5rem] border border-[#c89a55]/25 bg-[radial-gradient(circle_at_50%_0%,rgba(190,24,93,.12),transparent_40%),linear-gradient(145deg,rgba(17,6,13,.98),rgba(3,2,4,.98))] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#d7ad69]/60">Risk it for something better</p>
          <h3 className="mt-1 font-serif text-2xl font-semibold text-[#fff0d2]">Upgrade</h3>
        </div>
        <span className="rounded-full border border-[#c89a55]/25 bg-black/40 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#e9d2aa]">
          House keeps {Math.round((1 - CRATE_UPGRADE_TARGET_EV) * 100)}%
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-zinc-400">
        Feed one item in, name any crate and rarity above its worth as the target, and flip once. The chance is
        exactly the target&apos;s average value divided into what you risked, at the printed edge - a cheap item
        chasing a legendary is a real lottery ticket; an adjacent-tier swap is close to a coin flip.
      </p>

      {/* Step 1: pick the item to risk */}
      <div className="mt-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">1. Item to risk</p>
        {eligibleFodder.length === 0 ? (
          <p className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-400">
            Nothing in your inventory is worth enough to risk yet.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {eligibleFodder.map((item) => {
              const key = `${item.item_id}:${item.variant}`;
              const active = key === fodderKey;
              return (
                <button
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${active ? "border-[#e6ba73]/60 bg-[#c89a55]/15" : "border-white/10 bg-black/30 hover:border-white/30"}`}
                  disabled={disabled || pending}
                  key={key}
                  onClick={() => selectFodder(item)}
                  type="button"
                >
                  {getCrateItemImageUrl(item.item_id, item.image_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="h-8 w-8 rounded-lg object-cover" src={getCrateItemImageUrl(item.item_id, item.image_url) ?? undefined} />
                  ) : null}
                  <span>
                    <span className="block text-xs font-bold text-white">{item.name}</span>
                    <span className="block text-[10px]" style={{ color: RARITY_COLORS[item.rarity] }}>
                      {item.rarity} · {item.sell_value.toLocaleString()}
                      {item.quantity > 1 ? ` · x${item.quantity}` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 2: pick the target */}
      {selectedFodder ? (
        <div className="mt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
            2. Target - worth more than {selectedFodder.sell_value.toLocaleString()}
          </p>
          {targetsByCrate.size === 0 ? (
            <p className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-400">
              Nothing outranks this item&apos;s value. Pick something cheaper to risk.
            </p>
          ) : (
            <div className="mt-2 grid gap-3">
              {Array.from(targetsByCrate.entries()).map(([crateType, bucket]) => (
                <div className="rounded-xl border border-white/10 bg-black/25 p-2.5" key={crateType}>
                  <p className="px-1 text-xs font-black text-[#e9d2aa]">{bucket.crateName}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {RARITY_ORDER.filter((rarity) => bucket.rarities.some((target) => target.rarity === rarity)).map((rarity) => {
                      const target = bucket.rarities.find((entry) => entry.rarity === rarity)!;
                      const key = `${crateType}:${rarity}`;
                      const active = key === targetKey;
                      const targetChance = computeCrateUpgradeChance(selectedFodder.sell_value, target.avgSellValue);
                      return (
                        <button
                          className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-black transition ${active ? "border-[#e6ba73]/60 bg-[#c89a55]/15 text-[#ffe2ad]" : "border-white/10 bg-black/30 text-zinc-400 hover:text-zinc-200"}`}
                          disabled={disabled || pending}
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
        </div>
      ) : null}

      {/* Step 3: attempt */}
      {selectedFodder && selectedTarget && chance !== null ? (
        <button
          className="vm-table-button mt-4 block w-full rounded-xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-black text-pink-50 transition hover:border-pink-300/40 hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={disabled || pending}
          onClick={() => void attempt()}
          type="button"
        >
          {pending
            ? "Flipping..."
            : `Attempt — ${(chance * 100).toFixed(chance < 0.01 ? 2 : 1)}% to win, lose ${selectedFodder.name} on a miss`}
        </button>
      ) : null}

      {result ? (
        <div className={`mt-4 rounded-2xl border p-3 text-center ${result.won ? "border-emerald-300/30 bg-emerald-500/10" : "border-rose-300/30 bg-rose-500/10"}`}>
          {result.won ? (
            <p className="text-sm font-black text-emerald-200">
              {(result.chancePercent).toFixed(result.chancePercent < 1 ? 2 : 1)}% hit. {rewardDef ? `You won ${rewardDef.name}.` : "You won."}
            </p>
          ) : (
            <p className="text-sm font-black text-rose-200">
              {(result.chancePercent).toFixed(result.chancePercent < 1 ? 2 : 1)}% missed. She keeps it.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
