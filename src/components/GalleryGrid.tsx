import Image from "next/image";
import { useMemo, useState } from "react";
import type { GalleryItem, GalleryRarity } from "@/lib/types";

type GalleryGridProps = {
  items: GalleryItem[];
  coins: number;
  mood: number;
  onUnlock: (itemId: string) => void;
};

type GalleryFilter = "All" | "Common" | "Rare" | "Divine" | "Secret" | "Sacrifice";

const rarityStyles: Record<GalleryRarity, string> = {
  Common: "border-zinc-300/30 text-zinc-100",
  Rare: "border-fuchsia-300/40 text-fuchsia-100",
  Divine: "border-yellow-200/50 text-yellow-100",
  Secret: "border-pink-200/70 text-pink-50 shadow-[0_0_22px_rgba(236,72,153,0.28)]",
  Sacrifice: "border-red-200/60 text-red-100 shadow-[0_0_22px_rgba(248,113,113,0.22)]",
};

export function GalleryGrid({ coins, items, mood, onUnlock }: GalleryGridProps) {
  const hasSecret = items.some((item) => item.rarity === "Secret");
  const hasSacrifice = items.some((item) => item.rarity === "Sacrifice");
  const [filter, setFilter] = useState<GalleryFilter>("All");

  const filters = useMemo<GalleryFilter[]>(() => {
    const base: GalleryFilter[] = ["All", "Common", "Rare", "Divine"];

    if (hasSacrifice) {
      base.unshift("Sacrifice");
    }

    if (hasSecret) {
      base.push("Secret");
    }

    return base;
  }, [hasSacrifice, hasSecret]);

  const filteredItems =
    filter === "All" ? items : items.filter((item) => item.rarity === filter);

  return (
    <section className="rounded-[2rem] border border-fuchsia-200/15 bg-black/50 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-pink-200/70">
            Gallery Unlock
          </p>
          <h2 className="text-3xl font-black">The Vault Gallery</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Common cards use coins. Rare and Divine cards obey Principessa&apos;s mood.
          </p>
        </div>
        <div className="text-sm text-zinc-400">
          Balance: <span className="font-bold text-pink-100">{coins}</span>
          <span className="mx-2 text-zinc-600">/</span>
          Mood: <span className="font-bold text-pink-100">{mood}</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {filters.map((option) => (
          <button
            className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
              filter === option
                ? "border-pink-300/50 bg-pink-500/20 text-pink-50"
                : "border-white/10 bg-black/35 text-zinc-300 hover:border-pink-300/40"
            }`}
            key={option}
            onClick={() => setFilter(option)}
            type="button"
          >
            {option === "Sacrifice" ? "Sacrifice Collection" : option}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {filteredItems.map((item) => {
          const isCommon = item.rarity === "Common";
          const isSecret = item.rarity === "Secret";
          const isSacrifice = item.rarity === "Sacrifice";
          const canAfford = isCommon && coins >= (item.unlockCost ?? 0);
          const lockedText = isCommon
            ? "Locked"
            : `Requires Mood ${item.moodRequired}`;
          const buttonText = item.unlocked
            ? "Unlocked"
            : isCommon
              ? canAfford
                ? `Unlock — ${item.unlockCost} coins`
                : `Need ${item.unlockCost} coins`
              : `Requires Mood ${item.moodRequired}`;

          return (
            <article
              className={`overflow-hidden rounded-[1.5rem] border bg-white/[0.045] transition hover:-translate-y-0.5 ${
                isSecret || isSacrifice
                  ? "border-pink-200/60 shadow-[0_0_34px_rgba(236,72,153,0.24)]"
                  : "border-white/10 hover:border-pink-300/30"
              }`}
              key={item.id}
            >
              <div className="relative aspect-[4/5] bg-fuchsia-950/30">
                <Image
                  alt={`${item.title} gallery placeholder`}
                  className={`object-cover transition duration-500 ${
                    item.unlocked ? "" : "scale-105 blur-md grayscale"
                  } ${isSecret || isSacrifice ? "saturate-150 contrast-125" : ""}`}
                  fill
                  unoptimized
                  sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                  src={item.image}
                />
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
                    <h3 className="text-lg font-black text-white">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-400">{item.tag}</p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                      rarityStyles[item.rarity]
                    }`}
                  >
                    {item.rarity}
                  </span>
                </div>

                <button
                  className={`mt-4 w-full rounded-2xl px-4 py-3 text-sm font-bold transition ${
                    item.unlocked
                      ? "border border-emerald-200/20 bg-emerald-400/10 text-emerald-100"
                      : isCommon && canAfford
                        ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white hover:shadow-[0_0_22px_rgba(236,72,153,0.35)]"
                        : "border border-white/10 bg-white/[0.04] text-zinc-400"
                  }`}
                  disabled={item.unlocked || !isCommon || !canAfford}
                  onClick={() => onUnlock(item.id)}
                  type="button"
                >
                  {buttonText}
                </button>
                {item.unlocked && (
                  <a
                    className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold text-pink-50 transition hover:border-pink-300/50 hover:bg-pink-500/20"
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
