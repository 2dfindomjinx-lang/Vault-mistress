import { CoinAmount } from "@/components/CoinAmount";
import { getDisplayNameOrUsername, getDisplayNameOrUsernamePlain } from "@/lib/display-name";
import {
  getLeadershipRank,
  type LeadershipEntry,
  type ShameEntry,
} from "@/lib/leadership";
import type { CSSProperties } from "react";

const THRONE_URL = "https://throne.com/principessa2dfd";

type StatsPanelProps = {
  stats: {
    coins: number;
    affection: number;
    loyaltyStreak: number;
    tributeTotal: number;
  };
  leadershipTop: LeadershipEntry[];
  shameTop: ShameEntry[];
  username: string;
  usernameStyle?: CSSProperties;
  statValueStyle?: CSSProperties;
  equippedTitleName?: string;
  topValuableInventories?: Array<{
    username: string;
    rawUsername?: string;
    displayName?: string | null;
    value: number;
    usernameStyle?: CSSProperties;
  }>;
};

export function StatsPanel({
  equippedTitleName,
  leadershipTop,
  shameTop,
  statValueStyle,
  stats,
  topValuableInventories = [],
  username,
  usernameStyle,
}: StatsPanelProps) {
  const leadership = getLeadershipRank(stats.tributeTotal);
  const statCards: Array<[string, string, string, number | null]> = [
    ["Coins", stats.coins.toLocaleString(), "Principessa Coin balance", stats.coins],
    ["Affection", `${stats.affection}/100`, "Principessa's current approval", null],
    ["Loyalty Streak", `${stats.loyaltyStreak} days`, "Prototype daily streak", null],
    ["Tribute Total", stats.tributeTotal.toLocaleString(), "Coins offered so far", stats.tributeTotal],
  ];

  return (
    <section className="grid grid-cols-2 gap-3">
      {statCards.map(([label, value, hint, coinAmount]) => (
        <div
          className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_0_28px_rgba(168,85,247,0.1)]"
          key={label}
        >
          <p className="text-xs uppercase tracking-[0.22em] text-fuchsia-200/70">{label}</p>
          <p className="mt-2 text-2xl font-black text-white sm:text-3xl" style={statValueStyle}>
            {coinAmount === null ? (
              value
            ) : (
              <CoinAmount amount={coinAmount} className="gap-2" iconSize={28} label="" />
            )}
          </p>
          <p className="mt-1 text-xs text-zinc-400">{hint}</p>
          {label === "Coins" && (
            <p className="mt-3 text-xs leading-5 text-pink-100">
              Need more Principessa Coins? Tribute through{" "}
              <a
                className="font-black uppercase tracking-[0.14em] text-pink-200 underline decoration-pink-300/50 underline-offset-4 transition hover:text-white"
                href={THRONE_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                Throne
              </a>
              .
            </p>
          )}
        </div>
      ))}

      <div className="col-span-2 rounded-[1.5rem] border border-pink-200/20 bg-pink-500/[0.08] p-4 shadow-[0_0_34px_rgba(236,72,153,0.14)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-fuchsia-200/70">Leadership</p>
            <p className="mt-2 text-2xl font-black text-white sm:text-3xl" style={statValueStyle}>
              {equippedTitleName ?? leadership.currentRank.title}
            </p>
          </div>
          <p
            className="rounded-full border border-pink-200/20 bg-black/35 px-3 py-1 text-xs font-bold text-pink-100"
            style={statValueStyle}
          >
            {stats.tributeTotal.toLocaleString()} prestige
          </p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/55">
          <div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-400 shadow-[0_0_18px_rgba(236,72,153,0.65)]"
            style={{ width: `${leadership.progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          {leadership.nextRank
            ? `${leadership.remaining.toLocaleString()} more Tribute Total to reach ${leadership.nextRank.title}.`
            : "Maximum leadership rank reached."}
        </p>
      </div>

      <div className="col-span-2 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
        <div className="flex h-full min-h-[26rem] flex-col rounded-[1.5rem] border border-fuchsia-200/15 bg-black/45 p-4 shadow-[0_0_28px_rgba(168,85,247,0.1)]">
          <div className="flex items-center justify-between gap-3">
            <p className="max-w-[7ch] text-xs uppercase leading-tight tracking-[0.22em] text-fuchsia-200/70">
              Top 5 Leadership
            </p>
            <p className="text-xs font-semibold text-zinc-500">By Tribute Total</p>
          </div>
          <div className="mt-3 flex flex-1 flex-col gap-2">
            {leadershipTop.slice(0, 5).length > 0 ? (
              leadershipTop.slice(0, 5).map((leader, index) => {
                const displayUsername = getDisplayNameOrUsernamePlain(
                  leader.displayName,
                  leader.rawUsername ?? leader.username,
                );
                const isCurrentUser =
                  leader.rawUsername === username ||
                  leader.username === username ||
                  displayUsername === username;

                return (
                  <div
                    className={`flex min-h-[4.25rem] items-center justify-between gap-3 rounded-2xl border px-3 py-2 ${
                      isCurrentUser ? "border-pink-200/30 bg-pink-500/10" : "border-white/10 bg-white/[0.035]"
                    }`}
                    key={leader.rawUsername ?? leader.username}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">
                        #{index + 1}{" "}
                        <span style={leader.usernameStyle ?? (isCurrentUser ? usernameStyle : undefined)}>
                          {displayUsername}
                        </span>
                      </p>
                      <p className="text-xs text-zinc-400">{leader.rankTitle}</p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-pink-100">
                      <CoinAmount amount={leader.tributeTotal} iconSize={16} label="" />
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-zinc-400">
                No leadership data yet.
              </p>
            )}
          </div>
        </div>

        <div className="flex h-full min-h-[26rem] flex-col rounded-[1.5rem] border border-amber-200/15 bg-black/45 p-4 shadow-[0_0_28px_rgba(168,85,247,0.1)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.22em] text-amber-100/75">Top 5 Valuable Inventories</p>
            <p className="text-xs font-semibold text-zinc-500">By Inventory Value</p>
          </div>
          <div className="mt-3 flex flex-1 flex-col gap-2">
            {topValuableInventories.slice(0, 5).length > 0 ? (
              topValuableInventories.slice(0, 5).map((entry, index) => (
                <div
                  className="flex min-h-[4.25rem] items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2"
                  key={entry.rawUsername ?? entry.username}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">
                      #{index + 1}{" "}
                      {getDisplayNameOrUsernamePlain(entry.displayName, entry.rawUsername ?? entry.username)}
                    </p>
                    <p className="text-xs text-zinc-400">Inventory value</p>
                  </div>
                  <p className="shrink-0 text-sm font-black text-amber-100">
                    <CoinAmount amount={entry.value} iconSize={16} label="" />
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-zinc-400">
                No valuable inventories yet.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="col-span-2 rounded-[1.5rem] border border-rose-200/15 bg-[linear-gradient(145deg,rgba(244,63,94,0.1),rgba(0,0,0,0.42))] p-4 shadow-[0_0_28px_rgba(244,63,94,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.22em] text-rose-100/75">Public Fail Board</p>
          <p className="text-xs font-semibold text-zinc-500">Failed IRL tasks</p>
        </div>
        <div className="mt-3 space-y-2">
          {shameTop.slice(0, 5).length > 0 ? (
            shameTop.slice(0, 5).map((entry, index) => {
              const displayUsername = getDisplayNameOrUsername(entry.displayName, entry.rawUsername ?? entry.username);
              const isCurrentUser =
                entry.rawUsername === username ||
                entry.username === username ||
                displayUsername === username;

              return (
                <div
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 ${
                    isCurrentUser ? "border-rose-200/30 bg-rose-500/10" : "border-white/10 bg-white/[0.035]"
                  }`}
                  key={entry.rawUsername ?? entry.username}
                >
                  <p className="min-w-0 truncate text-sm font-black text-white">
                    #{index + 1}{" "}
                    <span style={entry.usernameStyle ?? (isCurrentUser ? usernameStyle : undefined)}>
                      {displayUsername}
                    </span>
                  </p>
                  <p className="shrink-0 text-sm font-black text-rose-100">{entry.shameCount} fail</p>
                </div>
              );
            })
          ) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-zinc-400">
              Nobody has failed the wheel yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
