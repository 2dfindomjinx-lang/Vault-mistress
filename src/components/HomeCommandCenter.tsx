"use client";

import type { DashboardPage } from "@/components/SidebarNav";
import Image from "next/image";
import { useState } from "react";
import styles from "./HomeCommandCenter.module.css";
import panels from "./HomeCourtPanels.module.css";
import {CourtGlyph} from "./court/CourtVisuals";

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
  tasks: { image: "/principessa-ui/atelier/v4/games_v4.webp", tone: "gold", eyebrow: "Earn her attention", symbol: "♛" },
  debt: { image: "/principessa-ui/generated/principessa-debt-contract.webp", tone: "gold", eyebrow: "A promise in writing", symbol: "✦" },
  wheels: { image: "/gamble/principessa-casino-hero.webp", tone: "violet", eyebrow: "The tables await", symbol: "♠" },
  crates: { image: "/crate-icons/couture-case.webp", tone: "pink", eyebrow: "Inside the collection", symbol: "◇" },
  tribute: { image: "/principessa-ui/atelier/v4/shrine_v4.webp", tone: "rose", eyebrow: "An offering to remember", symbol: "♛" },
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
  const currentEntries = tab === "devotion" ? devotion : tab === "pet" ? petScoreLeaders : tab === "leadership" ? leadership : tab === "shame" ? shame : inventories;
  const entries = currentEntries;
  const selectTab = (next: (typeof tabs)[number][0]) => {
    setTab(next);
    onLeaderboardTabChange?.(next);
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="home-stats relative overflow-hidden rounded-[1.5rem] border border-[#c89a55]/25 bg-[radial-gradient(circle_at_88%_0%,rgba(190,24,93,.22),transparent_34%),linear-gradient(110deg,rgba(15,6,10,.96),rgba(48,11,35,.72),rgba(8,4,7,.96))] px-4 py-3 shadow-[0_0_34px_rgba(190,24,93,.1)]">
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
              <h2 id="court-destinations-title">Choose your obsession.</h2>
            </div>
            <span className={styles.headingNote}>Make it worth her attention.</span>
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

      <section className={panels.panel} aria-label="Leaderboard">
        <header className={panels.panelHeader}><div><p className={panels.kicker}>Court standings</p><h2>Leaderboard</h2></div><span>Her leading five</span></header>
        <div className={panels.tabs} aria-label="Leaderboard category">{tabs.map(([key,label])=><button aria-pressed={tab===key} key={key} onClick={()=>selectTab(key)} type="button">{label}</button>)}</div>
        {entries.length ? <div className={panels.standings}>
          <article className={panels.champion}><CourtGlyph symbol="crown"/><small>First in {tabs.find(([key])=>key===tab)?.[1]}</small><h3>{entries[0].name}</h3><span>{entries[0].username}</span><strong>{entries[0].value}</strong></article>
          <div className={panels.ranks}>{entries.slice(1,5).map(entry=><div className={panels.rankRow} key={entry.rank}><span>{String(entry.rank).padStart(2,"0")}</span><span className={panels.initial} aria-hidden="true">{entry.name.slice(0,1)}</span><div><p>{entry.name}</p>{entry.username&&<small>{entry.username}</small>}</div><strong>{entry.value}</strong></div>)}</div>
        </div> : <p className={panels.empty}>No standings available yet.</p>}
      </section>
    </div>
  );
}
