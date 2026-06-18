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
      <div className="flex w-full min-w-0 flex-col gap-5 px-4 pb-5 pt-[9.5rem] sm:px-6 sm:pt-[10rem] lg:ml-64 lg:w-[calc(100%-16rem)] lg:px-8 lg:pb-5 lg:pt-5">
        {children}
      </div>
    </div>
  );
}
