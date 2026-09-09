"use client";

import type { DashboardPage } from "@/components/SidebarNav";
import Image from "next/image";
import { useState } from "react";
import styles from "./HomeCommandCenter.module.css";

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

const destinationArt: Partial<Record<DashboardPage, { image: string; tone: string; eyebrow: string; symbol: string }>> = {
  tasks: { image: "/principessa-ui/generated/principessa-panel-sit.webp", tone: "gold", eyebrow: "Earn her attention", symbol: "♛" },
  debt: { image: "/principessa-ui/generated/principessa-debt-contract.webp", tone: "gold", eyebrow: "A promise in writing", symbol: "✦" },
  wheels: { image: "/gamble/principessa-casino-hero.webp", tone: "violet", eyebrow: "The tables await", symbol: "♠" },
  crates: { image: "/crate-icons/couture-case.webp", tone: "pink", eyebrow: "Inside the collection", symbol: "◇" },
  tribute: { image: "/principessa-ui/generated/principessa-shrine-offering.webp", tone: "rose", eyebrow: "An offering to remember", symbol: "♛" },
  moneyShop: { image: "/principessa-money-icon.png", tone: "mint", eyebrow: "Something worth keeping", symbol: "✧" },
};

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
        <section className={styles.destinations} aria-labelledby="court-destinations-title">
          <div className={styles.heading}>
            <div>
              <p className={styles.eyebrow}>Explore the court</p>
              <h2 id="court-destinations-title">What should you do now?</h2>
            </div>
            <span className={styles.headingNote}>Your next chapter</span>
          </div>
          <div className={styles.grid}>
            {actions.map((item) => {
              const art = destinationArt[item.target];
              return (
                <button className={styles.card} data-tone={art?.tone} data-page={item.target} key={item.target} onClick={() => onNavigate(item.target)} type="button">
                  {art ? <Image alt="" className={styles.art} fill sizes="(max-width: 640px) 90vw, (max-width: 1200px) 45vw, 30vw" src={art.image} unoptimized /> : null}
                  <span className={styles.shade} aria-hidden="true" />
                  <span className={styles.cardEyebrow}><span aria-hidden="true">{art?.symbol}</span> {art?.eyebrow}</span>
                  <span className={styles.content}>
                    <span className={styles.title}>{item.label}</span>
                    <span className={styles.detail}>{item.detail}</span>
                    <span className={styles.cta}>{item.action}<span aria-hidden="true">↗</span></span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="relative overflow-hidden rounded-[1.5rem] border border-violet-200/20 bg-[linear-gradient(145deg,rgba(35,12,56,.42),rgba(5,3,8,.82))] p-4 shadow-[0_0_34px_rgba(168,85,247,.1)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-100/55">Court standings</p><h2 className="mt-1 text-xl font-black text-white">Leaderboard</h2></div>
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Top 5</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tabs.map(([key, label]) => <button className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] transition ${tab === key ? "border-pink-300/45 bg-pink-500/20 text-pink-50" : "border-white/10 bg-white/[.03] text-zinc-500 hover:text-zinc-200"}`} key={key} onClick={() => selectTab(key)} type="button">{label}</button>)}
        </div>
        <div className="mt-3 space-y-1.5">
          {entries.length > 0 ? entries.slice(0, 5).map((entry) => <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[.08] bg-white/[.03] px-3 py-2.5" key={`${entry.rank}-${entry.username ?? entry.name}`}><div className="min-w-0"><span className="mr-2 text-sm font-black text-pink-200/70">#{entry.rank}</span><span className="truncate text-sm font-bold text-white">{entry.name}</span>{entry.username ? <span className="ml-2 text-[10px] text-zinc-500">{entry.username}</span> : null}</div><span className="shrink-0 text-sm font-black text-pink-100">{entry.value}</span></div>) : <p className="rounded-xl border border-white/[.08] px-3 py-4 text-center text-xs text-zinc-500">No standings available yet.</p>}
        </div>
      </section>
    </div>
  );
}
