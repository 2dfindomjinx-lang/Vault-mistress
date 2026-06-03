"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { CoinAmount } from "@/components/CoinAmount";

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

export function RecentTributesTicker({
  currentUsername,
  usernameStyle,
  topTributes = [],
  tributes,
}: {
  currentUsername?: string;
  usernameStyle?: CSSProperties;
  topTributes?: RecentTribute[];
  tributes: RecentTribute[];
}) {
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
  const displayTributes = visibleTributes.slice(0, 6);

  return (
    <section className="space-y-3">
      <div className="rounded-[1.5rem] border border-fuchsia-200/15 bg-black/40 px-3 py-3 shadow-[0_0_34px_rgba(217,70,239,0.1)] backdrop-blur">
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
            {displayTributes.length > 0 ? (
              displayTributes.map((tribute, index) => (
                <TributeCard
                  key={tribute.id}
                  currentUsername={currentUsername}
                  tribute={tribute}
                  isNewest={index === 0}
                  usernameStyle={usernameStyle}
                />
              ))
            ) : (
              <p className="min-w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-400">
                No recent tributes yet.
              </p>
            )}
          </div>
        </div>
      </div>
      {topTributes.length > 0 && (
        <div className="rounded-[1.25rem] border border-yellow-200/15 bg-black/35 px-3 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-100/75">
              Top 3 Tributes
            </p>
            <div className="flex touch-pan-x gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {topTributes.map((tribute, index) => (
                <div
                  className={`flex min-w-[180px] items-center gap-2 rounded-xl border px-3 py-2 ${getGlowClass(tribute.amount)}`}
                  key={tribute.id}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-yellow-100/25 bg-yellow-300/10 text-xs font-black text-yellow-50">
                    #{index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-white">
                      <span style={tribute.username === currentUsername ? usernameStyle : undefined}>
                        {tribute.username}
                      </span>
                    </p>
                    <p className="text-[11px] font-bold text-yellow-50">
                      <CoinAmount amount={tribute.amount} iconSize={14} label="Coins" prefix="+" />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function TributeCard({
  currentUsername,
  isNewest = false,
  tribute,
  usernameStyle,
}: {
  currentUsername?: string;
  isNewest?: boolean;
  tribute: RecentTribute;
  usernameStyle?: CSSProperties;
}) {
  return (
    <article
      className={`flex min-w-[210px] items-center gap-3 rounded-2xl border px-3 py-2 transition ${getGlowClass(tribute.amount)} ${
        isNewest ? "animate-tribute-slide-in" : ""
      }`}
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
          <span style={tribute.username === currentUsername ? usernameStyle : undefined}>
            {tribute.username}
          </span>
        </p>
        <p className="text-xs font-bold text-pink-100">
          <CoinAmount amount={tribute.amount} iconSize={15} label="Principessa Coins" prefix="+" />
        </p>
        <p className="text-[11px] text-zinc-400">
          {getRelativeTime(tribute.createdAt)}
        </p>
      </div>
    </article>
  );
}
