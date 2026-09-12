"use client";

import { useRef } from "react";
import styles from "./CourtChrome.module.css";
import Image from "next/image";
import { MoneyIcon } from "@/components/MoneyIcon";
import {
  DASHBOARD_PAGE_CODES,
  type DashboardPage,
} from "@/lib/dashboard-navigation";

export type { DashboardPage } from "@/lib/dashboard-navigation";

// Maps each dashboard panel to its own real URL (so refreshing / sharing a
// link lands back on the same panel instead of always resetting to home).
export const DASHBOARD_PANEL_PATHS: Record<DashboardPage, string> = {
  home: "/",
  tribute: "/tribute",
  tasks: "/games",
  wheels: "/wheels",
  pet: "/pet",
  debt: "/debt",
  devotion: "/devotion",
  shop: "/shop",
  moneyShop: "/money-shop",
  crates: "/cases",
  runway: "/runway",
  collection: "/collection",
  profile: "/profile",
};

const PATH_TO_PANEL: Partial<Record<string, DashboardPage>> =
  Object.fromEntries(
    (
      Object.entries(DASHBOARD_PANEL_PATHS) as Array<[DashboardPage, string]>
    ).map(([page, path]) => [path, page]),
  );

export function getPanelForPath(
  pathname: string | null | undefined,
): DashboardPage {
  if (!pathname) return "home";
  if (pathname === "/tasks") return "tasks";
  return PATH_TO_PANEL[pathname] ?? "home";
}

export function getPathForPanel(page: DashboardPage): string {
  return DASHBOARD_PANEL_PATHS[page] ?? "/";
}

export type SidebarNavItem = {
  key: DashboardPage;
  label: string;
  disabled?: boolean;
  badge?: string;
  hasIndicator?: boolean;
  onHover?: () => void;
};

type SidebarNavProps = {
  activePage: DashboardPage;
  coins?: number;
  // Principessa Money. "+ Add" now tops this up rather than coins: coins are no
  // longer purchasable directly, you buy PM and convert it down.
  money?: number;
  items: SidebarNavItem[];
  onAddMoney?: () => void;
  onSelect: (page: DashboardPage) => void;
};

// Codes run I..XIII in the order baseDashboardNavItems renders them in
// src/app/page.tsx. Keep the two in sync when a row moves - the numeral is
// decoration, but a sequence that visibly skips reads as a missing panel.
//
// This used to be a literal plus an Object.assign that rewrote most of the
// codes afterwards. The override was unchecked against Record<DashboardPage>,
// so a typo in it compiled clean and silently kept the stale number.
const navigationMeta: Record<DashboardPage, { code: string; glyph: string }> = {
  home: { code: DASHBOARD_PAGE_CODES.home, glyph: "◆" },
  runway: { code: DASHBOARD_PAGE_CODES.runway, glyph: "▲" },
  tribute: { code: DASHBOARD_PAGE_CODES.tribute, glyph: "♛" },
  tasks: { code: DASHBOARD_PAGE_CODES.tasks, glyph: "♠" },
  wheels: { code: DASHBOARD_PAGE_CODES.wheels, glyph: "◎" },
  pet: { code: DASHBOARD_PAGE_CODES.pet, glyph: "♙" },
  moneyShop: { code: DASHBOARD_PAGE_CODES.moneyShop, glyph: "❖" },
  shop: { code: DASHBOARD_PAGE_CODES.shop, glyph: "✦" },
  crates: { code: DASHBOARD_PAGE_CODES.crates, glyph: "▣" },
  debt: { code: DASHBOARD_PAGE_CODES.debt, glyph: "§" },
  collection: { code: DASHBOARD_PAGE_CODES.collection, glyph: "◈" },
  profile: { code: DASHBOARD_PAGE_CODES.profile, glyph: "◐" },
  // Not rendered as its own row today; kept so the Record stays exhaustive and
  // /devotion keeps resolving.
  devotion: { code: DASHBOARD_PAGE_CODES.devotion, glyph: "◇" },
};

export function SidebarNav({ activePage, coins = 0, items, money = 0, onAddMoney, onSelect }: SidebarNavProps) {
  const directoryRef = useRef<HTMLDialogElement>(null);
  const renderItem = (item: SidebarNavItem, mobile = false) => <button key={item.key} className={styles.navItem} aria-current={activePage === item.key ? "page" : undefined} disabled={item.disabled} onClick={() => { onSelect(item.key); if (mobile) directoryRef.current?.close(); }} onFocus={item.onHover} onMouseEnter={item.onHover} type="button"><span className={styles.glyph} aria-hidden="true">{navigationMeta[item.key].glyph}</span><span>{item.label}</span>{item.hasIndicator && <i className={styles.indicator} />}{item.badge && <small className={styles.badge}>{item.badge}</small>}</button>;
  return <aside className={styles.sidebar}>
    <div className={styles.desktop}>
      <div className={styles.brand}><Image src="/brand/vault-mistress-mark.svg" alt="" width={40} height={48} /><div><strong>Principessa</strong><small>Her private court</small></div></div>
      <div className={styles.wallet}><div className={styles.balance}><MoneyIcon height={14}/><strong>{money.toLocaleString()}</strong><small>PM</small><button aria-label="Add Money" title="Add Money" onClick={onAddMoney} type="button">+</button></div><div className={styles.walletCoins}><span>Coins</span><strong>{coins.toLocaleString()}</strong></div></div>
      <nav className={styles.directory} aria-label="Court navigation">{items.map(item => renderItem(item))}</nav>
      <div className={styles.sidebarFooter}>Her court. Her rules.</div>
    </div>
    <nav className={styles.mobileNav} aria-label="Main navigation">{items.filter(item => ["home","tasks","tribute","profile"].includes(item.key)).map(item => <button key={item.key} type="button" aria-current={activePage === item.key ? "page" : undefined} aria-label={item.label} disabled={item.disabled} onClick={() => onSelect(item.key)}><span aria-hidden="true">{navigationMeta[item.key].glyph}</span>{item.key === "tribute" ? "Shrine" : item.label}</button>)}<button type="button" aria-label="All court sections" onClick={() => directoryRef.current?.showModal()}><span aria-hidden="true">☰</span>More</button></nav>
    <dialog ref={directoryRef} aria-label="Court directory" className={styles.directoryDialog} onClick={e => {if(e.target === e.currentTarget) directoryRef.current?.close();}}><div className={styles.dialogHeading}><h2>The court</h2><button type="button" aria-label="Close directory" onClick={() => directoryRef.current?.close()}>×</button></div><div className={styles.dialogGrid}>{items.map(item => renderItem(item,true))}</div></dialog>
  </aside>;
}
