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
    <div className="relative min-h-screen w-full overflow-x-hidden lg:flex lg:items-start">
      <div className="lg:w-64 lg:shrink-0 lg:self-start">
        <SidebarNav activePage={activePage} items={items} onSelect={onNavigate} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
