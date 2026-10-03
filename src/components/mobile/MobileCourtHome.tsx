"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type { DashboardPage } from "@/lib/dashboard-navigation";
import { MobileGlyph } from "./MobileGlyph";
import styles from "./MobileCourt.module.css";

const shortcuts: { page: DashboardPage; label: string }[] = [
  { page: "wheels", label: "Casino" }, { page: "tribute", label: "Shrine" },
  { page: "shop", label: "Shop" }, { page: "debt", label: "Contracts" },
];

export function MobileCourtHome({ displayName, coins, money, affection, devotion, streak, avatar, onNavigate, onAddMoney }: {
  displayName: string; coins: number; money: number; affection: number; devotion: number; streak: number;
  avatar: ReactNode; onNavigate: (page: DashboardPage) => void; onAddMoney: () => void;
}) {
  return <div className={styles.home}>
    <div className={styles.compactGreeting}><h1>{displayName.replace(/^@/, "")}</h1>{streak > 0 && <span>{streak} day streak</span>}</div>
    <section className={styles.balanceStrip} aria-label="Your balance">
      <div><small>PM</small><strong>{money.toLocaleString()}</strong></div>
      <div><small>Coins</small><strong>{coins.toLocaleString()}</strong></div>
      <button type="button" aria-label="Add Money" onClick={onAddMoney}><MobileGlyph name="plus"/></button>
    </section>
    <button type="button" className={styles.dailyEntry} onClick={() => onNavigate("tasks")}>
      <span className={styles.dailyIcon}><MobileGlyph name="tasks"/></span>
      <span><strong>Daily rewards</strong><small>View today’s games & rewards</small></span><MobileGlyph name="arrow"/>
    </button>
    <div className={styles.launchGrid} aria-label="Quick access">
      {shortcuts.map(({ page, label }) => <button type="button" key={page} onClick={() => onNavigate(page)}><MobileGlyph name={page}/><span>{label}</span></button>)}
    </div>
    <div className={styles.compactPresence}><Image alt="Principessa" src="/character-icon.webp" width={36} height={36} unoptimized/><p>My court. Your move.</p><span aria-hidden="true">♛</span></div>
    <div className={styles.compactFeatures}>
      <button type="button" onClick={() => onNavigate("crates")}><Image src="/crate-icons/couture-case.webp" alt="" width={76} height={76} unoptimized/><span><strong>Cases</strong><small>Open · Upgrade · Duel</small></span><MobileGlyph name="arrow"/></button>
      <button type="button" onClick={() => onNavigate("runway")}><span className={styles.compactAvatar}>{avatar}</span><span><strong>Wardrobe</strong><small>Dress for her</small></span><MobileGlyph name="arrow"/></button>
    </div>
    <button type="button" className={styles.loyaltyStrip} onClick={() => onNavigate("profile")}><span>Affection <b>{affection}/100</b></span><span>Devotion <b>{devotion.toLocaleString()}</b></span><MobileGlyph name="arrow"/></button>
  </div>;
}
