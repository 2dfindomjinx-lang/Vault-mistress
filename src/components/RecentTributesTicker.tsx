"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { CoinAmount } from "@/components/CoinAmount";
import { DisplayNameWithUsername } from "@/components/DisplayNameWithUsername";
import { getDisplayNameOrUsername } from "@/lib/display-name";
import type { CrateRarity } from "@/lib/crates";

export type RecentTribute = {
  id: string;
  username: string;
  rawUsername?: string;
  displayName?: string | null;
  avatarUrl: string | null;
  amount: number;
  createdAt: string;
  usernameStyle?: CSSProperties;
};

export type TopInventory = {
  id: string;
  username: string;
  rawUsername?: string;
  displayName?: string | null;
  avatarUrl: string | null;
  value: number;
  usernameStyle?: CSSProperties;
};

type RecentCaseOpening = {
  id: string;
  crateName: string;
  crateIconUrl: string | null;
  itemId: string;
  itemName: string;
  itemRarity: CrateRarity | "unknown";
  itemChancePercent: number | null;
  itemSellValue: number | null;
  itemImageUrl: string | null;
  openedAt: string;
};

type RecentCaseOpener = {
  id: string;
  username: string;
  rawUsername: string;
  displayName: string | null;
  avatarUrl: string | null;
  usernameStyle?: CSSProperties;
  lastOpenedAt: string;
  recentOpenings: RecentCaseOpening[];
};

type RecentCaseOpeningCard = RecentCaseOpening & {
  openerId: string;
  openerUsername: string;
  openerRawUsername: string;
  openerDisplayName: string | null;
  openerAvatarUrl: string | null;
  openerUsernameStyle?: CSSProperties;
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

function getRarityGlowClass(rarity: CrateRarity | "unknown") {
  switch (rarity) {
    case "legendary":
      return "border-amber-300/70 bg-[linear-gradient(145deg,rgba(120,53,15,0.86),rgba(245,158,11,0.26),rgba(0,0,0,0.74))] shadow-[0_0_28px_rgba(245,158,11,0.28)]";
    case "epic":
      return "border-violet-300/65 bg-[linear-gradient(145deg,rgba(88,28,135,0.86),rgba(168,85,247,0.22),rgba(0,0,0,0.74))] shadow-[0_0_24px_rgba(168,85,247,0.24)]";
    case "rare":
      return "border-sky-300/65 bg-[linear-gradient(145deg,rgba(12,74,110,0.86),rgba(56,189,248,0.18),rgba(0,0,0,0.74))] shadow-[0_0_22px_rgba(56,189,248,0.22)]";
    case "uncommon":
      return "border-emerald-300/60 bg-[linear-gradient(145deg,rgba(6,78,59,0.86),rgba(16,185,129,0.18),rgba(0,0,0,0.74))] shadow-[0_0_20px_rgba(16,185,129,0.18)]";
    case "common":
    default:
      return "border-white/10 bg-[linear-gradient(145deg,rgba(18,18,24,0.96),rgba(10,10,14,0.95),rgba(0,0,0,0.92))] shadow-[0_0_12px_rgba(255,255,255,0.05)]";
  }
}

function getRarityLabelClass(rarity: CrateRarity | "unknown") {
  switch (rarity) {
    case "legendary":
      return "text-amber-100";
    case "epic":
      return "text-violet-100";
    case "rare":
      return "text-sky-100";
    case "uncommon":
      return "text-emerald-100";
    case "common":
    default:
      return "text-fuchsia-100";
  }
}

function formatChancePercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export function RecentTributesTicker({
  currentUsername,
  usernameStyle,
  topTributes = [],
  tributes,
  topValuableInventories = [],
  showRecentOpenings = true,
}: {
  currentUsername?: string;
  usernameStyle?: CSSProperties;
  topTributes?: RecentTribute[];
  tributes: RecentTribute[];
  topValuableInventories?: TopInventory[];
  showRecentOpenings?: boolean;
}) {
  const [recentCaseOpenings, setRecentCaseOpenings] = useState<RecentCaseOpeningCard[]>([]);
  const [recentCaseOpeningsError, setRecentCaseOpeningsError] = useState("");
  const visibleTributes = useMemo(() => {
    // Simple rule for Recent Tributes section: always show the 5 most recent
    // (newest first). When a new tribute record arrives (new coin_transaction),
    // the oldest of these 5 naturally drops off the list returned by the
    // server query. We do not delete from coin_transactions (top tributors
    // / all-time aggregates and history depend on the full rows).
    return [...tributes]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [tributes]);
  const displayTributes = visibleTributes;

  useEffect(() => {
    if (!showRecentOpenings) {
      setRecentCaseOpenings([]);
      setRecentCaseOpeningsError("");
      return;
    }

    let mounted = true;

    const loadRecentCaseOpenings = async () => {
      try {
        const response = await fetch("/api/recent-case-openings");
        const payload = (await response.json()) as {
          error?: string;
          openers?: RecentCaseOpener[];
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Recent openings could not be loaded.");
        }

        const flattened = (payload.openers ?? [])
          .flatMap((opener) =>
            (opener.recentOpenings ?? []).map((opening) => ({
              ...opening,
              crateIconUrl: opening.crateIconUrl,
              openerId: opener.id,
              openerUsername: opener.username,
              openerRawUsername: opener.rawUsername,
              openerDisplayName: opener.displayName,
              openerAvatarUrl: opener.avatarUrl,
              openerUsernameStyle: opener.usernameStyle,
            })),
          )
          .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())
          .slice(0, 12);

        if (mounted) {
          setRecentCaseOpenings(flattened);
          setRecentCaseOpeningsError("");
        }
      } catch (error) {
        if (mounted) {
          setRecentCaseOpenings([]);
          setRecentCaseOpeningsError(error instanceof Error ? error.message : "Recent openings could not be loaded.");
        }
      }
    };

    void loadRecentCaseOpenings();

    return () => {
      mounted = false;
    };
  }, [showRecentOpenings]);

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
              All-Time Throne Top 3
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
                    <DisplayNameWithUsername
                      displayName={tribute.displayName}
                      primaryClassName="truncate text-xs font-black text-white"
                      primaryStyle={
                        tribute.usernameStyle ??
                        (tribute.rawUsername === currentUsername ||
                        tribute.username === currentUsername ||
                        getDisplayNameOrUsername(tribute.displayName, tribute.rawUsername ?? tribute.username) === currentUsername
                          ? usernameStyle
                          : undefined)
                      }
                      secondaryClassName="truncate text-[10px] font-semibold text-zinc-400"
                      username={tribute.rawUsername ?? tribute.username}
                    />
                    <p className="text-[11px] font-bold text-yellow-50">
                      <CoinAmount amount={tribute.amount} iconSize={14} label="Total" />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showRecentOpenings && (
      <div className="rounded-[1.35rem] border border-white/10 bg-black/35 px-3 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-zinc-200/80">
            Recent Openings
          </p>
          <p className="text-xs text-zinc-500">
            Latest case results in the vault
          </p>
        </div>
        {recentCaseOpeningsError ? (
          <p className="mt-3 rounded-2xl border border-rose-200/15 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {recentCaseOpeningsError}
          </p>
        ) : recentCaseOpenings.length > 0 ? (
          <div className="mt-3 flex max-w-full gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {recentCaseOpenings.map((opening) => (
              <article
                className={`group relative h-[228px] w-[168px] shrink-0 [perspective:1000px] sm:w-[182px] ${getRarityGlowClass(opening.itemRarity)}`}
                key={opening.id}
                tabIndex={0}
                title={`${opening.crateName} • ${formatChancePercent(opening.itemChancePercent) ?? "Unknown chance"} • ${getDisplayNameOrUsername(opening.openerDisplayName, opening.openerRawUsername)}`}
              >
                <div className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] group-focus-visible:[transform:rotateY(180deg)]">
                  <div className={`absolute inset-0 flex flex-col gap-2 overflow-hidden rounded-2xl border p-2 ${getRarityGlowClass(opening.itemRarity)} [backface-visibility:hidden]`}>
                    <div className="flex h-[132px] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/25 p-2">
                      {opening.itemImageUrl ? (
                        // Static crate item images are local and can be rendered with a plain img for simplicity.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={opening.itemName}
                          className="h-full w-full object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)] transition-transform duration-200 group-hover:scale-105"
                          src={opening.itemImageUrl}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-3xl text-white/70">
                          📦
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[12px] font-black leading-tight text-white">
                        {opening.itemName}
                      </p>
                      <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${getRarityLabelClass(opening.itemRarity)}`}>
                        {opening.itemRarity}
                      </p>
                    </div>
                    <p className="text-[10px] text-zinc-300">
                      Hover for opener details
                    </p>
                  </div>

                  <div className="absolute inset-0 flex h-full w-full flex-col overflow-hidden rounded-2xl border p-2 [transform:rotateY(180deg)] [backface-visibility:hidden]">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/35">
                        {opening.crateIconUrl ? (
                          // Static crate item images are local and can be rendered with a plain img for simplicity.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={opening.crateName}
                            className="h-full w-full object-contain p-1"
                            src={opening.crateIconUrl}
                          />
                        ) : (
                          <div className="text-sm text-white/70">📦</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-black text-white">
                          {opening.crateName}
                        </p>
                        <p className="text-[10px] font-semibold text-zinc-300">
                          {formatChancePercent(opening.itemChancePercent) ?? "Unknown chance"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex-1 rounded-xl border border-white/10 bg-black/25 p-2">
                      <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">Opener</p>
                      <div className="mt-1 min-w-0">
                        <DisplayNameWithUsername
                          displayName={opening.openerDisplayName}
                          primaryClassName="text-[11px] font-black text-white whitespace-normal break-words leading-tight"
                          primaryStyle={opening.openerUsernameStyle}
                          secondaryClassName="text-[10px] font-semibold text-zinc-400 whitespace-normal break-words"
                          username={opening.openerRawUsername}
                        />
                      </div>
                    </div>

                    <div className="mt-2 text-[9px] text-center uppercase tracking-[0.18em] text-fuchsia-100/70">
                      {formatChancePercent(opening.itemChancePercent) ?? "Unknown chance"}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-400">
            No recent openings yet.
          </p>
        )}
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
  const displayUsername = getDisplayNameOrUsername(tribute.displayName, tribute.rawUsername ?? tribute.username);
  const isCurrentUser =
    tribute.rawUsername === currentUsername ||
    tribute.username === currentUsername ||
    displayUsername === currentUsername;

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
          {getDisplayNameOrUsername(tribute.displayName, tribute.rawUsername ?? tribute.username)
            .replace("@", "")
            .slice(0, 1)
            .toUpperCase() || "P"}
        </div>
      )}
      <div className="min-w-0">
        <DisplayNameWithUsername
          displayName={tribute.displayName}
          primaryClassName="truncate text-sm font-black text-white"
          primaryStyle={tribute.usernameStyle ?? (isCurrentUser ? usernameStyle : undefined)}
          secondaryClassName="truncate text-[10px] font-semibold text-zinc-400"
          username={tribute.rawUsername ?? tribute.username}
        />
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
