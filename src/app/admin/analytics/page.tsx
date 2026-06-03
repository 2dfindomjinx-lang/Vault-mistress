"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Overview = {
  activeDebtContracts: number;
  authRegisteredUsers: number;
  averageCoins: number;
  coinMetricScope?: "daily_gmt3" | string;
  dailyActiveUsers: number;
  missedDebtPeriods: number;
  nextResetAt?: string;
  ownerLikenessWarnings: number;
  newRegistrationsToday: number;
  profilesMissingFromAuthUsers: number;
  totalCoinsEarned: number;
  totalCoinsInCirculation: number;
  totalCoinsSpent: number;
  totalRegisteredUsers: number;
  totalTributeReceived: number;
};

type CountPoint = {
  count: number;
  day?: string;
  image?: string;
  key?: string;
  label?: string;
  title?: string;
  totalEligibleUsers?: number;
  unlockRate?: number;
};

type AmountPoint = {
  amount?: number;
  day: string;
  earned?: number;
  spent?: number;
};

type AnalyticsUser = {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  registrationDate: string | null;
  lastLogin: string | null;
  coins: number;
  affection: number;
  tributeTotal: number;
  loyaltyStreak: number;
  completedTasks: number;
  galleryProgress: number;
};

type Transaction = {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  amount: number;
  reason: string | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  createdAt: string;
};

type AnalyticsPayload = {
  overview: Overview;
  charts: {
    activeByDay: CountPoint[];
    affectionBuckets: CountPoint[];
    coinNetByDay: AmountPoint[];
    galleryStats: CountPoint[];
    leastUsedTasks: CountPoint[];
    registrationsByDay: CountPoint[];
    taskUsage: CountPoint[];
    tributeByDay: AmountPoint[];
  };
  matchedUsers: AnalyticsUser[];
  transactionHistory: Transaction[];
  users: AnalyticsUser[];
};

function number(value: number) {
  return value.toLocaleString();
}

function date(value: string | null) {
  return value ? new Date(value).toLocaleString() : "none";
}

function formatCountdown(target?: string) {
  if (!target) {
    return "unknown";
  }

  const remaining = Math.max(0, new Date(target).getTime() - Date.now());
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return `${hours}h ${minutes}m ${seconds}s`;
}

function BarChart({
  color = "from-fuchsia-500 to-pink-500",
  data,
  getLabel,
  getValue,
}: {
  color?: string;
  data: unknown[];
  getLabel: (entry: unknown) => string;
  getValue: (entry: unknown) => number;
}) {
  const max = Math.max(1, ...data.map(getValue));

  return (
    <div className="space-y-2">
      {data.map((entry, index) => {
        const value = getValue(entry);

        return (
          <div className="grid grid-cols-[5.25rem_minmax(0,1fr)_4rem] items-center gap-2 text-xs" key={index}>
            <span className="truncate text-zinc-400">{getLabel(entry)}</span>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${color}`}
                style={{ width: `${Math.max(4, (value / max) * 100)}%` }}
              />
            </div>
            <span className="text-right font-bold text-pink-50">{number(value)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [clockTick, setClockTick] = useState(0);

  const loadAnalytics = useCallback(async (search = "", userId?: string | null) => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("query", search.trim());
      }

      if (userId) {
        params.set("userId", userId);
      }

      const response = await fetch(`/api/admin/analytics${params.toString() ? `?${params.toString()}` : ""}`, { cache: "no-store" });
      const payload = (await response.json()) as AnalyticsPayload & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Analytics could not be loaded.");
      }

      setData(payload);
    } catch (loadError) {
      console.error("Admin analytics load failed", loadError);
      setError(loadError instanceof Error ? loadError.message : "Analytics failed.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAnalytics();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAnalytics]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick((value) => value + 1), 1000);

    return () => window.clearInterval(timer);
  }, []);

  const selectedUser = useMemo(
    () =>
      data?.matchedUsers.find((user) => user.id === selectedUserId) ??
      data?.users.find((user) => user.id === selectedUserId) ??
      null,
    [data, selectedUserId],
  );

  if (isLoading && !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06030a] text-pink-100">
        <div className="rounded-[2rem] border border-pink-200/20 bg-black/55 px-6 py-5">
          Loading analytics...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#06030a] px-4 py-8 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.22),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.2),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0),#06030a_78%)]" />
      <section className="relative mx-auto max-w-7xl space-y-5">
        <div className="rounded-[2rem] border border-fuchsia-200/15 bg-black/55 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-pink-200/70">
                Admin Analytics
              </p>
              <h1 className="mt-1 text-3xl font-black">Monitoring Dashboard</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Growth, retention, task usage, coin economy, and tribute movement.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-zinc-200" href="/">
                Dashboard
              </Link>
              <Link className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-zinc-200" href="/admin">
                Admin Console
              </Link>
            </div>
          </div>
          {error && (
            <p className="mt-4 rounded-2xl border border-rose-200/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </p>
          )}
        </div>

        {data && (
          <>
            <section className="rounded-[1.5rem] border border-yellow-200/20 bg-yellow-300/10 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-100">
                Daily Economy Window
              </p>
              <p className="mt-2 text-sm leading-6 text-yellow-50">
                Tribute Received, Coins Earned, and Coins Spent use today&apos;s GMT+3 window.
                Reset in {formatCountdown(data.overview.nextResetAt)}.
                <span className="sr-only">{clockTick}</span>
              </p>
            </section>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Auth Users", data.overview.authRegisteredUsers],
                ["Profile Users", data.overview.totalRegisteredUsers],
                ["Missing Profiles", data.overview.profilesMissingFromAuthUsers],
                ["Daily Active", data.overview.dailyActiveUsers],
                ["New Today", data.overview.newRegistrationsToday],
                ["Tribute Received Today", data.overview.totalTributeReceived],
                ["Coins Earned Today", data.overview.totalCoinsEarned],
                ["Coins Spent Today", data.overview.totalCoinsSpent],
                ["Circulating Coins", data.overview.totalCoinsInCirculation],
                ["Average Coins", data.overview.averageCoins],
                ["Active Debt", data.overview.activeDebtContracts],
                ["Missed Debt Periods", data.overview.missedDebtPeriods],
                ["Likeness Warnings", data.overview.ownerLikenessWarnings],
              ].map(([label, value]) => (
                <article className="rounded-[1.5rem] border border-pink-200/15 bg-black/50 p-4" key={label}>
                  <p className="text-xs uppercase tracking-[0.2em] text-pink-200/60">{label}</p>
                  <p className="mt-2 text-2xl font-black text-white">{number(Number(value))}</p>
                </article>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-[1.5rem] border border-fuchsia-200/15 bg-black/50 p-4">
                <h2 className="text-lg font-black">User Growth</h2>
                <div className="mt-4">
                  <BarChart
                    data={data.charts.registrationsByDay}
                    getLabel={(entry) => String((entry as CountPoint).day)}
                    getValue={(entry) => (entry as CountPoint).count}
                  />
                </div>
              </article>
              <article className="rounded-[1.5rem] border border-fuchsia-200/15 bg-black/50 p-4">
                <h2 className="text-lg font-black">Daily Activity</h2>
                <div className="mt-4">
                  <BarChart
                    color="from-cyan-400 to-fuchsia-500"
                    data={data.charts.activeByDay}
                    getLabel={(entry) => String((entry as CountPoint).day)}
                    getValue={(entry) => (entry as CountPoint).count}
                  />
                </div>
              </article>
              <article className="rounded-[1.5rem] border border-fuchsia-200/15 bg-black/50 p-4">
                <h2 className="text-lg font-black">Tribute Trends</h2>
                <div className="mt-4">
                  <BarChart
                    color="from-yellow-300 to-pink-500"
                    data={data.charts.tributeByDay}
                    getLabel={(entry) => String((entry as AmountPoint).day)}
                    getValue={(entry) => (entry as AmountPoint).amount ?? 0}
                  />
                </div>
              </article>
              <article className="rounded-[1.5rem] border border-fuchsia-200/15 bg-black/50 p-4">
                <h2 className="text-lg font-black">Coin Economy</h2>
                <div className="mt-4 space-y-3">
                  {data.charts.coinNetByDay.map((entry) => (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3" key={entry.day}>
                      <p className="text-xs text-zinc-400">{entry.day}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <span className="text-emerald-100">Earned {number(entry.earned ?? 0)}</span>
                        <span className="text-rose-100">Spent {number(entry.spent ?? 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <article className="rounded-[1.5rem] border border-fuchsia-200/15 bg-black/50 p-4">
                <h2 className="text-lg font-black">Most Used Tasks</h2>
                <div className="mt-4">
                  <BarChart
                    data={data.charts.taskUsage.slice(0, 10)}
                    getLabel={(entry) => String((entry as CountPoint).label ?? (entry as CountPoint).key)}
                    getValue={(entry) => (entry as CountPoint).count}
                  />
                </div>
              </article>
              <article className="rounded-[1.5rem] border border-fuchsia-200/15 bg-black/50 p-4">
                <h2 className="text-lg font-black">Least Used Tasks</h2>
                <div className="mt-4">
                  <BarChart
                    color="from-zinc-500 to-pink-500"
                    data={data.charts.leastUsedTasks}
                    getLabel={(entry) => String((entry as CountPoint).label ?? (entry as CountPoint).key)}
                    getValue={(entry) => (entry as CountPoint).count}
                  />
                </div>
              </article>
              <article className="rounded-[1.5rem] border border-fuchsia-200/15 bg-black/50 p-4">
                <h2 className="text-lg font-black">Affection Distribution</h2>
                <div className="mt-4">
                  <BarChart
                    color="from-rose-500 to-fuchsia-500"
                    data={data.charts.affectionBuckets}
                    getLabel={(entry) => String((entry as CountPoint).label)}
                    getValue={(entry) => (entry as CountPoint).count}
                  />
                </div>
              </article>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <article className="rounded-[1.5rem] border border-fuchsia-200/15 bg-black/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-black">User Profiles</h2>
                  <div className="flex gap-2">
                    <input
                      className="min-w-0 rounded-2xl border border-white/10 bg-black/45 px-4 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-pink-200/45"
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          setSelectedUserId(null);
                          void loadAnalytics(query);
                        }
                      }}
                      placeholder="Search username or email"
                      value={query}
                    />
                    <button
                      className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-2 text-sm font-black"
                      onClick={() => {
                        setSelectedUserId(null);
                        void loadAnalytics(query);
                      }}
                      type="button"
                    >
                      Search
                    </button>
                  </div>
                </div>
                <div className="mt-4 max-h-[34rem] overflow-y-auto pr-1 [scrollbar-width:thin]">
                  <div className="grid gap-3">
                    {data.matchedUsers.map((user) => (
                      <button
                        className={`rounded-2xl border p-3 text-left transition ${
                          selectedUserId === user.id
                            ? "border-pink-300/45 bg-pink-500/10"
                            : "border-white/10 bg-black/35 hover:border-pink-300/30"
                        }`}
                        key={user.id}
                        onClick={() => {
                          setSelectedUserId(user.id);
                          void loadAnalytics(query, user.id);
                        }}
                        type="button"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-black text-white">{user.username}</p>
                            <p className="mt-1 text-xs text-zinc-500">{user.email ?? "no email"} - registered {date(user.registrationDate)}</p>
                            <p className="mt-1 text-xs text-zinc-500">last login {date(user.lastLogin)}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                            <span>Coins {number(user.coins)}</span>
                            <span>Aff {user.affection}</span>
                            <span>Tribute {number(user.tributeTotal)}</span>
                            <span>Tasks {user.completedTasks}</span>
                            <span>Gallery {user.galleryProgress}</span>
                            <span>Streak {user.loyaltyStreak}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </article>

              <article className="rounded-[1.5rem] border border-fuchsia-200/15 bg-black/50 p-4">
                <h2 className="text-lg font-black">Transaction History</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {selectedUser ? `Showing recent entries for ${selectedUser.username}.` : "Select a user to view transaction history."}
                </p>
                <div className="mt-4 max-h-[34rem] overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {!selectedUser ? (
                    <p className="rounded-2xl border border-white/10 bg-black/35 px-4 py-5 text-sm text-zinc-400">
                      Select a user to view transaction history.
                    </p>
                  ) : data.transactionHistory.length === 0 ? (
                    <p className="rounded-2xl border border-white/10 bg-black/35 px-4 py-5 text-sm text-zinc-400">
                      No transactions found for {selectedUser.username}.
                    </p>
                  ) : (
                  <div className="grid gap-2">
                    {data.transactionHistory.map((entry) => (
                      <div className="rounded-2xl border border-white/10 bg-black/35 p-3 text-sm" key={entry.id}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-bold text-white">{entry.username}</span>
                          <span className={entry.amount >= 0 ? "font-black text-emerald-100" : "font-black text-rose-100"}>
                            {entry.amount >= 0 ? "+" : ""}{number(entry.amount)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {entry.reason ?? "unknown"} - {date(entry.createdAt)}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {entry.balanceBefore ?? "?"} → {entry.balanceAfter ?? "?"}
                        </p>
                      </div>
                    ))}
                  </div>
                  )}
                </div>
              </article>
            </div>

            <article className="rounded-[1.5rem] border border-fuchsia-200/15 bg-black/50 p-4">
              <h2 className="text-lg font-black">Gallery Unlock Statistics</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {data.charts.galleryStats.map((entry) => (
                  <article
                    className="overflow-hidden rounded-2xl border border-white/10 bg-black/35"
                    key={entry.key}
                  >
                    <div className="aspect-[4/5] bg-fuchsia-950/25">
                      {entry.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={`${entry.title ?? entry.key} preview`}
                          className="h-full w-full object-cover"
                          src={entry.image}
                        />
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-black text-white">
                        {entry.title ?? entry.key}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">{entry.key}</p>
                      <p className="mt-3 text-lg font-black text-pink-50">
                        {entry.unlockRate ?? 0}%
                      </p>
                      <p className="text-xs text-zinc-400">
                        {number(entry.count)} / {number(entry.totalEligibleUsers ?? 0)} users
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </>
        )}
      </section>
    </main>
  );
}
