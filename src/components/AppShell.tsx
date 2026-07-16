import type { ReactNode } from "react";
import { LiveChatWidget } from "@/components/LiveChatWidget";
import { SidebarNav, type DashboardPage, type SidebarNavItem } from "@/components/SidebarNav";

type AppShellProps = {
  activePage: DashboardPage;
  children: ReactNode;
  items: SidebarNavItem[];
  onCoinsChange?: (coins: number) => void;
  onNavigate: (page: DashboardPage) => void;
};

export function AppShell({ activePage, children, items, onCoinsChange, onNavigate }: AppShellProps) {
  return (
    <div className="principessa-court-ui relative min-h-screen w-full overflow-x-hidden bg-[#060305]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_4%,rgba(88,16,47,.2),transparent_28%),linear-gradient(115deg,#060305,#0b0508_55%,#050304)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[.18] [background-image:linear-gradient(rgba(215,166,94,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(215,166,94,.035)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" />
      <SidebarNav activePage={activePage} items={items} onSelect={onNavigate} />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-5 px-3 pb-28 pt-3 sm:px-5 lg:ml-[304px] lg:px-7 lg:pb-8 lg:pt-5 xl:px-10">
        {children}
      </div>
      <LiveChatWidget onCoinsChange={onCoinsChange} />
    </div>
  );
}
