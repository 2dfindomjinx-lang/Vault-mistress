import Image from "next/image";
import { useMemo, useState } from "react";
import { CoinAmount } from "@/components/CoinAmount";
import type { GalleryItem, GalleryRarity } from "@/lib/types";

type GalleryGridProps = {
  items: GalleryItem[];
  coins: number;
  disabled?: boolean;
  mood: number;
  newItemIds?: string[];
  pendingUnlockIds?: string[];
  onItemHover?: (itemId: string) => void;
  onUnlock: (itemId: string) => void;
};

type GalleryFilter = "All" | "Common" | "Rare" | "Divine" | "Secret" | "Sacrifice" | "Shrine";

const rarityStyles: Record<GalleryRarity, string> = {
  Common: "border-zinc-300/30 text-zinc-100",
  Rare: "border-fuchsia-300/40 text-fuchsia-100",
  Divine: "border-yellow-200/50 text-yellow-100",
  Secret: "border-pink-200/70 text-pink-50 shadow-[0_0_22px_rgba(236,72,153,0.28)]",
  Sacrifice: "border-red-200/60 text-red-100 shadow-[0_0_22px_rgba(248,113,113,0.22)]",
  Shrine: "border-amber-200/60 text-amber-50 shadow-[0_0_22px_rgba(251,191,36,0.24)]",
};

export function GalleryGrid({
  coins,
  disabled = false,
  items,
  mood,
  newItemIds = [],
  pendingUnlockIds = [],
  onItemHover,
  onUnlock,
}: GalleryGridProps) {
  const hasSecret = items.some((item) => item.rarity === "Secret");
  const hasSacrifice = items.some((item) => item.rarity === "Sacrifice");
  const hasShrine = items.some((item) => item.rarity === "Shrine");
  const [filter, setFilter] = useState<GalleryFilter>("All");

  const filters = useMemo<GalleryFilter[]>(() => {
    const base: GalleryFilter[] = ["All"];

    if (hasSacrifice) {
      base.push("Sacrifice");
    }

    base.push("Common", "Rare", "Divine");

    if (hasShrine) {
      base.push("Shrine");
    }

    if (hasSecret) {
      base.push("Secret");
    }

    return base;
  }, [hasSacrifice, hasSecret, hasShrine]);

  const filteredItems =
    filter === "All" ? items : items.filter((item) => item.rarity === filter);

  return (
    <section
      className="rounded-[1.5rem] border border-fuchsia-200/15 bg-black/50 p-3 shadow-[0_0_44px_rgba(217,70,239,0.12)] sm:rounded-[2rem] sm:p-5"
      data-allow-image-download
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-pink-200/70">
            Gallery Unlock
          </p>
          <h2 className="text-2xl font-black sm:text-3xl">The Vault Gallery</h2>
        <p className="mt-2 text-sm text-zinc-400">
          {disabled
            ? "Timeout is active. Gallery unlocks are locked until the timer ends."
            : "Common cards use coins. Rare and Divine cards obey Principessa's mood. Shrine Memories gather here once revealed."}
        </p>
      </div>
        <div className="text-sm text-zinc-400">
          Balance: <CoinAmount amount={coins} className="font-bold text-pink-100" iconSize={16} label="" />
          <span className="mx-2 text-zinc-600">/</span>
          Mood: <span className="font-bold text-pink-100">{mood}</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {filters.map((option) => (
          <button
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${
              filter === option
                ? "border-pink-300/50 bg-pink-500/20 text-pink-50"
                : "border-white/10 bg-black/35 text-zinc-300 hover:border-pink-300/40"
            }`}
            key={option}
            onClick={() => setFilter(option)}
            type="button"
          >
            {option === "Sacrifice"
              ? "Sacrifice Collection"
              : option === "Shrine"
                ? "Shrine Memories"
                : option}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {filteredItems.map((item) => {
          const isCommon = item.rarity === "Common";
          const isSecret = item.rarity === "Secret";
          const isSacrifice = item.rarity === "Sacrifice";
          const isShrineMemory = item.rarity === "Shrine" || item.isShrineMemory;
          const isPending = pendingUnlockIds.includes(item.id);
          const isNew = item.unlocked && newItemIds.includes(item.id);
          const canAfford = isCommon && coins >= (item.unlockCost ?? 0);
          const lockedText = isCommon
            ? "Locked"
            : `Requires Mood ${item.moodRequired}`;
          const buttonText = item.unlocked
            ? "Unlocked"
            : isPending
              ? "Unlocking..."
            : disabled && isCommon
              ? "Timeout Active"
            : isCommon
              ? canAfford
                ? `Unlock — ${item.unlockCost} coins`
                : `Need ${item.unlockCost} coins`
              : `Requires Mood ${item.moodRequired}`;

          return (
            <article
              className={`min-w-0 overflow-hidden rounded-[1.1rem] border bg-white/[0.045] transition hover:-translate-y-0.5 sm:rounded-[1.5rem] ${
                isSecret || isSacrifice || isShrineMemory
                  ? "border-pink-200/60 shadow-[0_0_34px_rgba(236,72,153,0.24)]"
                  : "border-white/10 hover:border-pink-300/30"
              }`}
              key={item.id}
              onMouseEnter={() => {
                if (isNew) {
                  onItemHover?.(item.id);
                }
              }}
            >
              <div className="relative aspect-[4/5] bg-fuchsia-950/30">
                <Image
                  alt={`${item.title} gallery placeholder`}
                  className={`object-cover transition duration-500 ${
                    item.unlocked ? "" : "scale-105 blur-md grayscale"
                  } ${isSecret || isSacrifice || isShrineMemory ? "saturate-150 contrast-125" : ""}`}
                  fill
                  unoptimized
                  sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                  src={item.image}
                />
                {isNew ? (
                  <div className="absolute right-3 top-3 z-10 rounded-full border border-amber-200/30 bg-black/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.35)]">
                    New
                  </div>
                ) : null}
                {!item.unlocked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/68 text-center">
                    <div className="rounded-full border border-pink-200/30 bg-black/70 px-4 py-2 text-sm font-black uppercase tracking-[0.25em] text-pink-100">
                      Locked
                    </div>
                    <p className="mt-3 max-w-40 text-sm text-zinc-300">
                      {lockedText}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-white sm:text-lg">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-400 sm:text-sm">{item.tag}</p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-1 text-[10px] font-bold sm:px-2.5 sm:text-xs ${
                      rarityStyles[item.rarity]
                    }`}
                  >
                    {item.rarity}
                  </span>
                </div>

                <button
                  className={`mt-4 w-full rounded-xl px-3 py-3 text-xs font-bold transition sm:rounded-2xl sm:px-4 sm:text-sm ${
                    item.unlocked
                      ? "border border-emerald-200/20 bg-emerald-400/10 text-emerald-100"
                      : isCommon && canAfford
                        ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white hover:shadow-[0_0_22px_rgba(236,72,153,0.35)]"
                        : "border border-white/10 bg-white/[0.04] text-zinc-400"
                  }`}
                  disabled={disabled || isPending || item.unlocked || !isCommon || !canAfford}
                  onClick={() => onUnlock(item.id)}
                  type="button"
                >
                  {!item.unlocked && isCommon && !disabled && !isPending ? (
                    canAfford ? (
                      <CoinAmount
                        amount={item.unlockCost ?? 0}
                        className="justify-center"
                        iconSize={16}
                        label="coins"
                        prefix="Unlock - "
                      />
                    ) : (
                      <CoinAmount
                        amount={item.unlockCost ?? 0}
                        className="justify-center"
                        iconSize={16}
                        label="coins"
                        prefix="Need "
                      />
                    )
                  ) : (
                    buttonText
                  )}
                </button>
                {item.unlocked && (
                  <a
                    className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-pink-200/20 bg-pink-500/10 px-3 py-3 text-xs font-bold text-pink-50 transition hover:border-pink-300/50 hover:bg-pink-500/20 sm:rounded-2xl sm:px-4 sm:text-sm"
                    download
                    href={item.image}
                  >
                    Download Image
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
