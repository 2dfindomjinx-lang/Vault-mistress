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
    <aside className="z-40 w-full border-b border-white/10 bg-black/55 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
      <div className="flex h-full max-h-[100dvh] flex-col gap-5 p-4 sm:p-5 lg:max-h-screen">
        <div className="rounded-[1.35rem] border border-fuchsia-200/15 bg-[linear-gradient(150deg,rgba(236,72,153,0.14),rgba(0,0,0,0.48))] px-4 py-4 shadow-[0_0_34px_rgba(236,72,153,0.12)]">
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-fuchsia-200/70">
            Vault Mistress
          </p>
          <h1 className="mt-2 text-xl font-black leading-tight text-white">
            Principessa&apos;s Vault
          </h1>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-[1.35rem] border border-white/10 bg-transparent p-0 shadow-none">
          {items.map((item) => {
            const isActive = activePage === item.key;

            return (
              <button
                className={`group flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left text-sm font-black transition ${
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
