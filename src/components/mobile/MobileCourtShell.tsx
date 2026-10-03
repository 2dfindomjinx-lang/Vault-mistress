"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { AppShellProps } from "@/components/AppShell";
import { MobileCourtContext } from "@/lib/mobile-court-context";
import { CourtDialog } from "@/components/CourtDialog";
import { LiveChatWidget } from "@/components/LiveChatWidget";
import { getPathForPanel } from "@/components/SidebarNav";
import type { DashboardPage, SidebarNavItem } from "@/components/SidebarNav";
import { MobileGlyph } from "./MobileGlyph";
import styles from "./MobileCourt.module.css";

const primary: DashboardPage[] = ["home", "tasks", "crates", "tribute"];
const shortLabels: Partial<Record<DashboardPage, string>> = { tasks: "Games", tribute: "Shrine", wheels: "Casino", moneyShop: "Money Shop", debt: "Contracts", pet: "Pets" };

function subscribeNetwork(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => { window.removeEventListener("online", listener); window.removeEventListener("offline", listener); };
}

export function MobileCourtShell({ activePage, children, coins = 0, guestMode = false, items, money = 0,
  onAddMoney, onCoinsChange, onNavigate, mobileAccount, mobileNotifications }: AppShellProps) {
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const online = useSyncExternalStore(subscribeNetwork, () => navigator.onLine, () => true);
  const pageTitle = shortLabels[activePage] ?? items.find(item => item.key === activePage)?.label ?? "The Court";
  const isSecondary = !primary.includes(activePage);

  useEffect(() => {
    const closeOnBack = () => setDirectoryOpen(false);
    window.addEventListener("popstate", closeOnBack);
    return () => window.removeEventListener("popstate", closeOnBack);
  }, []);

  function closeDirectory() {
    setDirectoryOpen(false);
    if (window.history.state?.mobileCourtDirectory) window.history.back();
  }

  function openDirectory() {
    setQuery("");
    window.history.pushState({ ...window.history.state, mobileCourtDirectory: true }, "");
    setDirectoryOpen(true);
  }

  function select(item: SidebarNavItem) {
    // Remove only our overlay history entry before changing panel. Replace it
    // with the destination so browser Back returns to the previous panel.
    if (directoryOpen && window.history.state?.mobileCourtDirectory) {
      window.history.replaceState(null, "", getPathForPanel(item.key));
    }
    setDirectoryOpen(false);
    onNavigate(item.key);
  }

  return <MobileCourtContext.Provider value={true}><div className={`principessa-court-ui ${styles.shell}`} data-page={activePage}>
    <header className={styles.header}>
      {activePage === "home" ? <div className={styles.brand}><Image alt="" src="/brand/vault-mistress-mark.svg" width={28} height={34}/><div><strong>Vault Mistress</strong><small>Principessa’s court</small></div></div>
        : <div className={styles.pageHeading}><button type="button" aria-label="Return to Home" onClick={() => onNavigate("home")}><MobileGlyph name="back"/></button><div><small>Principessa’s court</small><h1>{pageTitle}</h1></div></div>}
      <div className={styles.headerActions}>{mobileNotifications}<button className={styles.account} type="button" aria-label="Your profile" onClick={() => onNavigate("profile")}>{mobileAccount ?? <MobileGlyph name="profile"/>}</button></div>
    </header>
    {activePage !== "home" && <div className={styles.miniWallet}><span><i/> {money.toLocaleString()} <small>PM</small></span><span>{coins.toLocaleString()} <small>Coins</small></span><button type="button" onClick={onAddMoney} aria-label="Add Money"><MobileGlyph name="plus"/></button></div>}
    {!online && <aside className={styles.offline} role="status">You’re offline. Reconnect to play and refresh your balance.</aside>}
    <div className={styles.content}>{children}</div>
    <nav className={styles.dock} aria-label="App navigation">
      {primary.map(key => {
        const item = items.find(entry => entry.key === key);
        return item ? <button key={key} type="button" aria-current={activePage === key ? "page" : undefined} disabled={item.disabled} onClick={() => onNavigate(key)}><MobileGlyph name={key}/><span>{shortLabels[key] ?? item.label}</span>{item.hasIndicator && <i/>}</button> : null;
      })}
      <button type="button" aria-label="All sections" aria-haspopup="dialog" aria-expanded={directoryOpen} data-active={isSecondary} onClick={openDirectory}><MobileGlyph name="more"/><span>More</span></button>
    </nav>
    {directoryOpen && <CourtDialog label="Mobile court directory" className={styles.sheet} onClose={closeDirectory}>
      <div className={styles.handle} aria-hidden="true"/>
      <header className={styles.sheetHeader}><div><h2>All sections</h2></div><button aria-label="Close all sections" type="button" onClick={closeDirectory}><MobileGlyph name="close"/></button></header>
      <label className={styles.search}><MobileGlyph name="more"/><input placeholder="Find a section" aria-label="Find a section" value={query} onChange={event => setQuery(event.target.value)}/></label>
      <nav className={styles.directory} aria-label="All app sections">
        {items.filter(item => `${item.label} ${shortLabels[item.key] ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())).map(item => <button type="button" key={item.key} disabled={item.disabled} aria-current={activePage === item.key ? "page" : undefined} onClick={() => select(item)} onFocus={item.onHover}><MobileGlyph name={item.key}/><span>{shortLabels[item.key] ?? item.label}<small>{item.badge ?? (activePage === item.key ? "You are here" : "")}</small></span>{item.hasIndicator ? <i className={styles.unread}/> : <MobileGlyph name="arrow"/>}</button>)}
      </nav>
      <footer className={styles.sheetFooter}><button type="button" onClick={() => { closeDirectory(); window.dispatchEvent(new Event("court:toggle-chat")); }}>Live Chat</button><Link href="/principessa-feed">Principessa Social ↗</Link></footer>
    </CourtDialog>}
    <LiveChatWidget guestMode={guestMode} onCoinsChange={onCoinsChange}/>
  </div></MobileCourtContext.Provider>;
}
