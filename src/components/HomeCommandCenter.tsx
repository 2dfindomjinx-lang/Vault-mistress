"use client";

import type { DashboardPage } from "@/components/SidebarNav";
import Image from "next/image";
import { useState } from "react";

export type HomeAction = {
  detail: string;
  label: string;
  target: DashboardPage;
  action: string;
};

export type HomeLeaderboardEntry = {
  name: string;
  value: string;
  username?: string;
  rank: number;
};

type HomeCommandCenterProps = {
  coins: number;
  devotionRank: number | null;
  petScore: number;
  streak: number;
  actions: HomeAction[];
  devotion: HomeLeaderboardEntry[];
  petScoreLeaders: HomeLeaderboardEntry[];
  leadership: HomeLeaderboardEntry[];
  shame: HomeLeaderboardEntry[];
  inventories: HomeLeaderboardEntry[];
  onNavigate: (page: DashboardPage) => void;
  onLeaderboardTabChange?: (tab: "devotion" | "pet" | "leadership" | "shame" | "inventory") => void;
};

const tabs = [
  ["devotion", "Devotion"],
  ["pet", "Pet Score"],
  ["leadership", "Leadership"],
  ["shame", "Shame"],
  ["inventory", "Inventory"],
] as const;

export function HomeCommandCenter({
  actions,
  coins,
  devotion,
  devotionRank,
  inventories,
  leadership,
  onLeaderboardTabChange,
  onNavigate,
  petScore,
  petScoreLeaders,
  shame,
  streak,
}: HomeCommandCenterProps) {
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("devotion");
  const entries = tab === "devotion" ? devotion : tab === "pet" ? petScoreLeaders : tab === "leadership" ? leadership : tab === "shame" ? shame : inventories;
  const selectTab = (next: (typeof tabs)[number][0]) => {
    setTab(next);
    onLeaderboardTabChange?.(next);
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="relative overflow-hidden rounded-[1.5rem] border border-[#c89a55]/25 bg-[radial-gradient(circle_at_88%_0%,rgba(190,24,93,.22),transparent_34%),linear-gradient(110deg,rgba(15,6,10,.96),rgba(48,11,35,.72),rgba(8,4,7,.96))] px-4 py-3 shadow-[0_0_34px_rgba(190,24,93,.1)]">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#e6ba73]/60 to-transparent" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Coins", coins.toLocaleString()],
            ["Devotion", devotionRank ? `#${devotionRank}` : "—"],
            ["Pet Score", petScore.toLocaleString()],
            ["Streak", `${streak} days`],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-pink-100/45">{label}</p>
              <p className="mt-1 text-lg font-black text-pink-50">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {actions.length > 0 ? (
        <section className="relative min-h-[12rem] overflow-hidden rounded-[1.5rem] border border-[#c89a55]/25 bg-[linear-gradient(110deg,rgba(45,10,22,.96),rgba(20,5,14,.76))] p-4 shadow-[0_0_34px_rgba(251,191,36,.08)]">
          <Image alt="Principessa" className="pointer-events-none absolute right-0 top-0 h-full w-2/5 object-cover object-top opacity-55" fill sizes="40vw" src="/home-principessa-court.png" unoptimized />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#220914] via-[#220914]/90 to-transparent" />
          <div className="pointer-events-none absolute right-5 top-4 text-4xl text-amber-200/[.08]">♛</div>
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-100/60">Court direction</p>
              <h2 className="mt-1 text-xl font-black text-white">What should you do now?</h2>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-100/45">{actions.length} ready</span>
          </div>
          <div className="relative z-10 mt-3 divide-y divide-white/[0.07]">
            {actions.map((item) => (
              <div className="flex items-center justify-between gap-3 py-3" key={`${item.label}-${item.detail}`}>
                <div className="min-w-0"><p className="truncate text-sm font-bold text-white">› {item.label}</p><p className="mt-0.5 truncate text-xs text-zinc-400">{item.detail}</p></div>
                <button className="shrink-0 rounded-full border border-amber-200/25 bg-amber-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-50 transition hover:border-amber-200/55" onClick={() => onNavigate(item.target)} type="button">{item.action}</button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="relative overflow-hidden rounded-[1.5rem] border border-violet-200/20 bg-[linear-gradient(145deg,rgba(35,12,56,.42),rgba(5,3,8,.82))] p-4 shadow-[0_0_34px_rgba(168,85,247,.1)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-100/55">Court standings</p><h2 className="mt-1 text-xl font-black text-white">Leaderboard</h2></div>
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Top 3</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tabs.map(([key, label]) => <button className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] transition ${tab === key ? "border-pink-300/45 bg-pink-500/20 text-pink-50" : "border-white/10 bg-white/[.03] text-zinc-500 hover:text-zinc-200"}`} key={key} onClick={() => selectTab(key)} type="button">{label}</button>)}
        </div>
        <div className="mt-3 space-y-1.5">
          {entries.length > 0 ? entries.slice(0, 3).map((entry) => <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[.08] bg-white/[.03] px-3 py-2.5" key={`${entry.rank}-${entry.username ?? entry.name}`}><div className="min-w-0"><span className="mr-2 text-sm font-black text-pink-200/70">#{entry.rank}</span><span className="truncate text-sm font-bold text-white">{entry.name}</span>{entry.username ? <span className="ml-2 text-[10px] text-zinc-500">{entry.username}</span> : null}</div><span className="shrink-0 text-sm font-black text-pink-100">{entry.value}</span></div>) : <p className="rounded-xl border border-white/[.08] px-3 py-4 text-center text-xs text-zinc-500">No standings available yet.</p>}
        </div>
      </section>
    </div>
  );
}
