import Image from "next/image";
import { useMemo, useState } from "react";
import { CoinAmount } from "@/components/CoinAmount";
import type { GalleryItem, GalleryRarity, PetGalleryItem } from "@/lib/types";

type GalleryGridProps = {
  items: GalleryItem[];
  petItems: PetGalleryItem[];
  petScore: number;
  petUnlockedItemIds: string[];
  coins: number;
  disabled?: boolean;
  mood: number;
  newItemIds?: string[];
  pendingUnlockIds?: string[];
  onItemHover?: (itemId: string) => void;
  onUnlock: (itemId: string) => void;
};

type GalleryFilter = "All" | "Common" | "Rare" | "Divine" | "Secret" | "Sacrifice" | "Shrine";
type GalleryView = "vault" | "pet";

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
  petItems,
  petScore,
  petUnlockedItemIds,
  newItemIds = [],
  pendingUnlockIds = [],
  onItemHover,
  onUnlock,
}: GalleryGridProps) {
  const hasSecret = items.some((item) => item.rarity === "Secret");
  const hasSacrifice = items.some((item) => item.rarity === "Sacrifice");
  const hasShrine = items.some((item) => item.rarity === "Shrine");
  const [filter, setFilter] = useState<GalleryFilter>("All");
  const [view, setView] = useState<GalleryView>("vault");
  const [failedImagePaths, setFailedImagePaths] = useState<string[]>([]);
  const vaultUnlockedCount = items.filter((item) => item.unlocked).length;
  const petUnlockedCount = petItems.filter(
    (item) => petUnlockedItemIds.includes(item.id) || petScore >= item.unlockCost,
  ).length;

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
      className="court-feature-panel rounded-[1.5rem] border border-fuchsia-200/15 bg-black/50 p-3 shadow-[0_0_44px_rgba(217,70,239,0.12)] sm:rounded-[2rem] sm:p-5"
      data-allow-image-download
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-pink-200/70">
            The Court Archive
          </p>
          <h2 className="text-2xl font-black sm:text-3xl">Gallery</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Vault rewards and Pet Score memories live in separate wings of the archive.
          </p>
        </div>
        <div className="text-sm text-zinc-400">
          Balance: <CoinAmount amount={coins} className="font-bold text-pink-100" iconSize={16} label="" />
          <span className="mx-2 text-zinc-600">/</span>
          Mood: <span className="font-bold text-pink-100">{mood}</span>
        </div>
      </div>

      <div
        aria-label="Gallery collection"
        className="mt-5 grid gap-2 rounded-[1.3rem] border border-white/10 bg-black/45 p-1.5 sm:grid-cols-2"
        role="tablist"
      >
        <button
          aria-selected={view === "vault"}
          className={`group flex min-w-0 items-center justify-between gap-3 rounded-[1rem] border px-4 py-3 text-left transition ${
            view === "vault"
              ? "border-fuchsia-200/30 bg-[linear-gradient(120deg,rgba(217,70,239,0.2),rgba(236,72,153,0.1))] text-white shadow-[0_0_22px_rgba(217,70,239,0.12)]"
              : "border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/[0.035] hover:text-zinc-100"
          }`}
          onClick={() => setView("vault")}
          role="tab"
          type="button"
        >
          <span>
            <span className="block text-sm font-black uppercase tracking-[0.16em]">Vault Gallery</span>
            <span className="mt-1 block text-xs font-medium opacity-65">Coins, mood and Shrine memories</span>
          </span>
          <span className="shrink-0 rounded-full border border-current/20 px-2.5 py-1 text-xs font-black">
            {vaultUnlockedCount}/{items.length}
          </span>
        </button>
        <button
          aria-selected={view === "pet"}
          className={`group flex min-w-0 items-center justify-between gap-3 rounded-[1rem] border px-4 py-3 text-left transition ${
            view === "pet"
              ? "border-rose-200/30 bg-[linear-gradient(120deg,rgba(244,63,94,0.18),rgba(168,85,247,0.12))] text-white shadow-[0_0_22px_rgba(244,63,94,0.12)]"
              : "border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/[0.035] hover:text-zinc-100"
          }`}
          onClick={() => setView("pet")}
          role="tab"
          type="button"
        >
          <span>
            <span className="block text-sm font-black uppercase tracking-[0.16em]">Pet Gallery</span>
            <span className="mt-1 block text-xs font-medium opacity-65">Pet Score progression archive</span>
          </span>
          <span className="shrink-0 rounded-full border border-current/20 px-2.5 py-1 text-xs font-black">
            {petUnlockedCount}/{petItems.length}
          </span>
        </button>
      </div>

      {view === "vault" ? (
        <>
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

      <div className="court-grid court-grid--collection mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {filteredItems.map((item) => {
          const resolvedImage =
            failedImagePaths.includes(item.image) && item.fallbackImage
              ? item.fallbackImage
              : item.image;
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
              className={`court-feature-card court-grid-card court-grid-card--violet min-w-0 overflow-hidden rounded-[1.1rem] border bg-white/[0.045] transition hover:-translate-y-0.5 sm:rounded-[1.5rem] ${
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
                  onError={() => {
                    if (item.fallbackImage) {
                      setFailedImagePaths((current) =>
                        current.includes(item.image) ? current : [...current, item.image],
                      );
                    }
                  }}
                  unoptimized
                  sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                  src={resolvedImage}
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
                    href={resolvedImage}
                  >
                    Download Image
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>
        </>
      ) : (
        <div className="mt-5">
          <div className="court-feature-card court-grid-card court-grid-card--danger flex flex-col gap-3 rounded-[1.25rem] border border-rose-200/15 bg-[linear-gradient(120deg,rgba(136,19,55,0.22),rgba(88,28,135,0.12),rgba(0,0,0,0.34))] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-rose-100/70">Pet Score Collection</p>
              <p className="mt-1 text-sm text-zinc-300">Every score threshold reveals another private memory.</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
              <span className="rounded-full border border-rose-200/15 bg-black/30 px-3 py-2 text-rose-50">Score {petScore.toLocaleString()}</span>
              <span className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-zinc-300">{petUnlockedCount} revealed</span>
            </div>
          </div>

          <div className="court-grid court-grid--collection mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
            {petItems.map((item, index) => {
              const unlocked = petUnlockedItemIds.includes(item.id) || petScore >= item.unlockCost;
              const resolvedImage =
                failedImagePaths.includes(item.image) && item.fallbackImage
                  ? item.fallbackImage
                  : item.image;

              return (
                <article
                  className="court-feature-card court-grid-card court-grid-card--danger min-w-0 overflow-hidden rounded-[1.1rem] border border-rose-200/10 bg-[linear-gradient(160deg,rgba(136,19,55,0.16),rgba(0,0,0,0.54))] sm:rounded-[1.35rem]"
                  key={item.id}
                >
                  <div className="relative aspect-[3/4] bg-black">
                    <Image
                      alt={unlocked ? item.title : "Locked Pet Gallery memory"}
                      className={`object-cover transition duration-500 ${unlocked ? "" : "scale-105 blur-md grayscale opacity-45"}`}
                      fill
                      onError={() => {
                        if (item.fallbackImage) {
                          setFailedImagePaths((current) =>
                            current.includes(item.image) ? current : [...current, item.image],
                          );
                        }
                      }}
                      sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw"
                      src={resolvedImage}
                      unoptimized
                    />
                    <span className="absolute left-2.5 top-2.5 rounded-full border border-rose-100/20 bg-black/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-rose-50">
                      Memory {String(index + 1).padStart(2, "0")}
                    </span>
                    {!unlocked ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 px-3 text-center">
                        <span className="rounded-full border border-rose-200/25 bg-black/70 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-rose-50">Sealed</span>
                        <span className="mt-2 text-xs font-bold text-rose-100/70">{item.unlockCost.toLocaleString()} Pet Score</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="p-3 sm:p-4">
                    <p className="truncate text-sm font-black text-white">{item.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">{unlocked ? "Revealed by devotion" : `${item.unlockCost.toLocaleString()} score required`}</p>
                    {unlocked ? (
                      <a
                        className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-rose-200/20 bg-rose-500/10 px-3 py-2.5 text-xs font-bold text-rose-50 transition hover:border-rose-200/45 hover:bg-rose-500/20"
                        download
                        href={resolvedImage}
                      >
                        Download Image
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
