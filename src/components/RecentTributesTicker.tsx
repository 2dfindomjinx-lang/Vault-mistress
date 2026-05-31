"use client";

import { useMemo } from "react";

export type RecentTribute = {
  id: string;
  username: string;
  avatarUrl: string | null;
  amount: number;
  createdAt: string;
};

function getRelativeTime(createdAt: string) {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return `${Math.floor(diffHours / 24)}d ago`;
}

function getGlowClass(amount: number) {
  if (amount >= 30000) {
    return "border-yellow-200/70 bg-[linear-gradient(135deg,rgba(250,204,21,0.24),rgba(236,72,153,0.24),rgba(0,0,0,0.7))] shadow-[0_0_30px_rgba(250,204,21,0.32)]";
  }

  if (amount >= 20000) {
    return "border-yellow-200/50 bg-[linear-gradient(135deg,rgba(250,204,21,0.18),rgba(236,72,153,0.18),rgba(0,0,0,0.68))] shadow-[0_0_24px_rgba(250,204,21,0.24)]";
  }

  if (amount >= 10000) {
    return "border-fuchsia-200/45 bg-[linear-gradient(135deg,rgba(168,85,247,0.22),rgba(236,72,153,0.18),rgba(0,0,0,0.68))] shadow-[0_0_22px_rgba(217,70,239,0.25)]";
  }

  if (amount >= 5000) {
    return "border-pink-200/40 bg-pink-500/14 shadow-[0_0_18px_rgba(236,72,153,0.22)]";
  }

  if (amount >= 1000) {
    return "border-pink-200/25 bg-pink-500/10 shadow-[0_0_14px_rgba(236,72,153,0.16)]";
  }

  return "border-white/10 bg-white/[0.05] shadow-[0_0_10px_rgba(255,255,255,0.06)]";
}

export function RecentTributesTicker({ tributes }: { tributes: RecentTribute[] }) {
  const visibleTributes = useMemo(() => {
    const sorted = [...tributes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const kept: RecentTribute[] = [];
    let smallRemovedBeforeLarge = 0;

    sorted.forEach((tribute) => {
      if (kept.length < 10) {
        kept.push(tribute);
        return;
      }

      const lowestIndex = kept
        .map((entry, index) => ({ amount: entry.amount, index }))
        .filter((entry) => entry.index >= 6)
        .sort((a, b) => a.amount - b.amount)[0]?.index;

      if (
        lowestIndex !== undefined &&
        tribute.amount > kept[lowestIndex].amount &&
        (tribute.amount < 10000 || smallRemovedBeforeLarge >= 3)
      ) {
        if (kept[lowestIndex].amount < 10000) {
          smallRemovedBeforeLarge += 1;
        }
        kept[lowestIndex] = tribute;
      }
    });

    return kept
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [tributes]);

  return (
    <section className="rounded-[1.5rem] border border-fuchsia-200/15 bg-black/40 px-3 py-3 shadow-[0_0_34px_rgba(217,70,239,0.1)] backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-200/70">
            Recent Tributes
          </p>
          <p className="mt-1 text-xs text-pink-100/60">
            Live Throne coin grants
          </p>
        </div>
        <span className="rounded-full border border-pink-200/20 bg-pink-500/10 px-3 py-1 text-xs font-bold text-pink-100">
          Live
        </span>
      </div>
      <div className="overflow-hidden">
        <div className="flex touch-pan-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleTributes.length > 0 ? (
            visibleTributes.map((tribute, index) => (
              <article
                className={`flex min-w-[210px] items-center gap-3 rounded-2xl border px-3 py-2 transition ${getGlowClass(tribute.amount)} ${
                  index === 0 ? "animate-tribute-slide-in" : ""
                }`}
                key={tribute.id}
              >
                {tribute.avatarUrl ? (
                  // External OAuth avatars are not known at build time, so a plain
                  // image keeps the ticker compatible without remote image config.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="h-10 w-10 rounded-full border border-pink-200/25 object-cover"
                    src={tribute.avatarUrl}
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-pink-200/25 bg-gradient-to-br from-fuchsia-500/35 to-pink-500/20 text-sm font-black text-pink-50">
                    {tribute.username.replace("@", "").slice(0, 1).toUpperCase() || "P"}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">
                    {tribute.username}
                  </p>
                  <p className="text-xs font-bold text-pink-100">
                    +{tribute.amount.toLocaleString()} Principessa Coins
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {getRelativeTime(tribute.createdAt)}
                  </p>
                </div>
              </article>
            ))
          ) : (
            <p className="min-w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-400">
              No recent tributes yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
