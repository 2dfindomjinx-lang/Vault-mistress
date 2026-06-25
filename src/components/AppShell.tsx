import type { ReactNode } from "react";
import { SidebarNav, type DashboardPage, type SidebarNavItem } from "@/components/SidebarNav";

type AppShellProps = {
  activePage: DashboardPage;
  children: ReactNode;
  items: SidebarNavItem[];
  onNavigate: (page: DashboardPage) => void;
};

export function AppShell({ activePage, children, items, onNavigate }: AppShellProps) {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      <SidebarNav activePage={activePage} items={items} onSelect={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col gap-5 px-4 pb-5 pt-[96px] sm:px-6 sm:pt-[104px] lg:ml-[280px] lg:px-8 lg:pb-8 lg:pt-5">
        {children}
      </div>
    </div>
  );
}
