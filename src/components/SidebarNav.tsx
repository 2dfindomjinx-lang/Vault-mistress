export type DashboardPage =
  | "home"
  | "tasks"
  | "pet"
  | "crates"
  | "shop"
  | "collection"
  | "tribute"
  | "profile";

export type SidebarNavItem = {
  key: DashboardPage;
  label: string;
  disabled?: boolean;
  badge?: string;
};

type SidebarNavProps = {
  activePage: DashboardPage;
  items: SidebarNavItem[];
  onSelect: (page: DashboardPage) => void;
};

export function SidebarNav({ activePage, items, onSelect }: SidebarNavProps) {
  return (
    <aside className="fixed left-0 right-0 top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl lg:inset-y-0 lg:right-auto lg:w-64 lg:border-b-0 lg:border-r lg:bg-black/55">
      <div className="flex h-full max-h-[100dvh] flex-col gap-3 p-3 lg:gap-5 lg:p-5">
        <div className="rounded-[1.2rem] border border-fuchsia-200/15 bg-[linear-gradient(150deg,rgba(236,72,153,0.14),rgba(0,0,0,0.48))] px-4 py-3 shadow-[0_0_34px_rgba(236,72,153,0.12)] lg:rounded-[1.35rem] lg:p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-fuchsia-200/70">
            Vault Mistress
          </p>
          <h1 className="mt-1 text-lg font-black leading-tight text-white lg:mt-2 lg:text-xl">
            Principessa&apos;s Vault
          </h1>
        </div>

        <nav className="flex gap-2 overflow-x-auto rounded-[1.2rem] border border-white/10 bg-white/[0.035] p-2 shadow-[0_0_24px_rgba(236,72,153,0.08)] lg:flex-1 lg:flex-col lg:overflow-visible lg:rounded-[1.35rem] lg:bg-transparent lg:p-0 lg:shadow-none">
          {items.map((item) => {
            const isActive = activePage === item.key;

            return (
              <button
                className={`group flex min-h-12 shrink-0 items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left text-sm font-black transition lg:w-full ${
                  isActive
                    ? "border-pink-200/45 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-[0_0_22px_rgba(236,72,153,0.32)]"
                    : item.disabled
                      ? "cursor-not-allowed border-white/5 bg-black/30 text-zinc-600"
                      : "border-white/10 bg-black/35 text-pink-100 hover:border-pink-300/40 hover:bg-pink-500/10"
                }`}
                disabled={item.disabled}
                key={item.key}
                onClick={() => onSelect(item.key)}
                type="button"
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-pink-50">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
