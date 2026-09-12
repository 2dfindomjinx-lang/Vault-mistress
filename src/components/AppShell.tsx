import type { ReactNode } from "react";
import { LiveChatWidget } from "@/components/LiveChatWidget";
import { SidebarNav, type DashboardPage, type SidebarNavItem } from "@/components/SidebarNav";
import styles from "./CourtChrome.module.css";

type AppShellProps = {
  activePage: DashboardPage;
  guestMode?: boolean;
  children: ReactNode;
  coins?: number;
  items: SidebarNavItem[];
  money?: number;
  onAddMoney?: () => void;
  onCoinsChange?: (coins: number) => void;
  onNavigate: (page: DashboardPage) => void;
};

export function AppShell({ guestMode = false, activePage, children, coins, items, money, onAddMoney, onCoinsChange, onNavigate }: AppShellProps) {
  return (
    <div className={`principessa-court-ui ${styles.shell}`} data-page={activePage}>
      <SidebarNav activePage={activePage} coins={coins} items={items} money={money} onAddMoney={onAddMoney} onSelect={onNavigate} />
      <div className={styles.content}>
        {children}
      </div>
      <LiveChatWidget guestMode={guestMode} onCoinsChange={onCoinsChange} />
    </div>
  );
}
