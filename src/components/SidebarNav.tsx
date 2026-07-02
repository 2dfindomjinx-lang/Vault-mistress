export type DashboardPage =
  | "home"
  | "tasks"
  | "devotion"
  | "pet"
  | "debt"
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
  hasIndicator?: boolean;
  onHover?: () => void;
};

type SidebarNavProps = {
  activePage: DashboardPage;
  items: SidebarNavItem[];
  onSelect: (page: DashboardPage) => void;
};

export function SidebarNav({ activePage, items, onSelect }: SidebarNavProps) {
  return (
    <aside className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[rgba(6,3,10,0.88)] backdrop-blur-xl lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:w-[280px] lg:border-b-0 lg:border-r">
      <div className="flex h-full max-h-[100dvh] flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4 lg:max-h-none lg:gap-5 lg:p-5">
        <div className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-fuchsia-200/15 bg-[linear-gradient(150deg,rgba(236,72,153,0.14),rgba(0,0,0,0.48))] px-4 py-3 shadow-[0_0_34px_rgba(236,72,153,0.12)] lg:hidden">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-fuchsia-200/70">
              Vault Mistress
            </p>
            <h1 className="mt-1 text-sm font-black leading-tight text-white">
              Principessa&apos;s Vault
            </h1>
          </div>
          <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-pink-100">
            {items.find((item) => item.key === activePage)?.label ?? "Home"}
          </div>
        </div>

        <div className="hidden rounded-[1.35rem] border border-fuchsia-200/15 bg-[linear-gradient(150deg,rgba(236,72,153,0.14),rgba(0,0,0,0.48))] px-4 py-4 shadow-[0_0_34px_rgba(236,72,153,0.12)] lg:block">
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-fuchsia-200/70">
            Vault Mistress
          </p>
          <h1 className="mt-2 text-xl font-black leading-tight text-white">
            Principessa&apos;s Vault
          </h1>
        </div>

        <nav className="flex min-h-0 flex-1 gap-2 overflow-x-auto overflow-y-hidden rounded-[1.35rem] border border-white/10 bg-transparent p-0 shadow-none lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto">
          {items.map((item) => {
            const isActive = activePage === item.key;

            return (
              <button
                className={`group flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-full border px-4 py-2 text-left text-sm font-black transition lg:w-full lg:rounded-2xl lg:px-3 lg:py-2 ${
                  isActive
                    ? "border-pink-200/45 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-[0_0_22px_rgba(236,72,153,0.32)]"
                    : item.disabled
                      ? "cursor-not-allowed border-white/5 bg-black/30 text-zinc-600"
                      : "border-white/10 bg-black/35 text-pink-100 hover:border-pink-300/40 hover:bg-pink-500/10"
                }`}
                disabled={item.disabled}
                key={item.key}
                onFocus={() => item.onHover?.()}
                onMouseEnter={() => item.onHover?.()}
                onClick={() => onSelect(item.key)}
                type="button"
              >
                <span className="flex items-center gap-2 whitespace-nowrap">
                  {item.label}
                  {item.hasIndicator ? (
                    <span
                      aria-hidden="true"
                      className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.95)]"
                    />
                  ) : null}
                </span>
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
