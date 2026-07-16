import Image from "next/image";

export type DashboardPage =
  | "home"
  | "tasks"
  | "devotion"
  | "pet"
  | "debt"
  | "crates"
  | "puzzle"
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

const navigationMeta: Record<DashboardPage, { code: string; glyph: string }> = {
  home: { code: "I", glyph: "◆" },
  tribute: { code: "II", glyph: "♛" },
  tasks: { code: "III", glyph: "✓" },
  pet: { code: "IV", glyph: "♙" },
  debt: { code: "V", glyph: "§" },
  devotion: { code: "VI", glyph: "◇" },
  shop: { code: "VII", glyph: "✦" },
  crates: { code: "VIII", glyph: "▣" },
  puzzle: { code: "IX", glyph: "⌘" },
  collection: { code: "X", glyph: "◈" },
  profile: { code: "XI", glyph: "◐" },
};

export function SidebarNav({ activePage, items, onSelect }: SidebarNavProps) {
  return (
    <aside className="fixed inset-x-0 bottom-0 z-[90] border-t border-[#c89a55]/20 bg-[#080406]/95 lg:inset-y-0 lg:left-0 lg:right-auto lg:w-[304px] lg:border-r lg:border-t-0 lg:bg-[#080406]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_7%,rgba(190,24,93,.18),transparent_24%),linear-gradient(180deg,rgba(255,255,255,.018),transparent_24%)]" />

      <div className="relative hidden h-full flex-col lg:flex">
        <header className="relative min-h-[150px] overflow-hidden border-b border-[#c89a55]/15 px-6 pb-4 pt-5">
          <div className="absolute -right-11 -top-12 h-52 w-52 overflow-hidden rounded-full border border-[#c89a55]/20 opacity-75 [mask-image:linear-gradient(to_bottom,black_65%,transparent)]">
            <Image alt="Principessa watching over the court" className="object-cover object-center" fill priority sizes="208px" src="/principessa-ui/principessa-gaze.jpeg" />
          </div>
          <div className="relative z-10">
            <p className="text-[9px] font-black uppercase tracking-[0.36em] text-[#d7ad69]/65">Private domain</p>
            <h1 className="mt-3 max-w-[9rem] font-serif text-3xl leading-[.92] text-[#fff0d2]">Principessa&apos;s Court</h1>
            <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-pink-200/35">You enter by her permission.</p>
          </div>
        </header>

        <nav className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-4 py-2">
          <p className="mb-2 px-3 text-[8px] font-black uppercase tracking-[0.34em] text-[#c89a55]/40">Court directory</p>
          {items.map((item) => {
            const meta = navigationMeta[item.key];
            const isActive = activePage === item.key;
            return (
              <div key={item.key}>
                <button
                  className={`group relative flex w-full items-center gap-3 border-y border-transparent px-3 py-1.5 text-left transition ${isActive ? "border-[#c89a55]/20 bg-[linear-gradient(90deg,rgba(190,24,93,.2),rgba(190,24,93,.025))] text-[#fff0d2]" : item.disabled ? "cursor-not-allowed text-zinc-700" : "text-zinc-500 hover:bg-white/[.025] hover:text-pink-100"}`}
                  disabled={item.disabled}
                  onClick={() => onSelect(item.key)}
                  onFocus={() => item.onHover?.()}
                  onMouseEnter={() => item.onHover?.()}
                  type="button"
                >
                  {isActive ? <span className="absolute inset-y-1 left-0 w-px bg-[#e6ba73] shadow-[0_0_10px_rgba(230,186,115,.75)]" /> : null}
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center border text-xs ${isActive ? "border-[#c89a55]/30 bg-black/35 text-pink-300" : "border-white/[.06] bg-black/20 text-zinc-700 group-hover:text-pink-300/70"}`}>{meta.glyph}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[8px] font-black uppercase tracking-[0.22em] text-[#c89a55]/35">{meta.code}</span>
                    <span className="block truncate font-serif text-[15px]">{item.label}</span>
                  </span>
                  {item.hasIndicator ? <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_9px_#fbbf24]" /> : null}
                  {item.badge ? <span className="text-[8px] font-black uppercase tracking-wider text-zinc-700">{item.badge}</span> : null}
                </button>
              </div>
            );
          })}
        </nav>

        <footer className="border-t border-[#c89a55]/12 px-6 py-4 text-[9px] uppercase tracking-[0.22em] text-zinc-700">
          Her court. Her ledger. Her rules.
        </footer>
      </div>

      <nav className="court-scrollbar relative flex gap-1 overflow-x-auto px-2 py-2 lg:hidden">
        {items.map((item) => {
          const meta = navigationMeta[item.key];
          const isActive = activePage === item.key;
          return (
            <button
              aria-label={item.label}
              className={`relative flex min-w-[4.45rem] shrink-0 flex-col items-center gap-1 px-2 py-2 text-[9px] font-black uppercase tracking-[.08em] transition ${isActive ? "text-[#ffe8bd]" : item.disabled ? "text-zinc-800" : "text-zinc-600"}`}
              disabled={item.disabled}
              key={item.key}
              onClick={() => onSelect(item.key)}
              onPointerDown={() => item.onHover?.()}
              type="button"
            >
              {isActive ? <span className="absolute inset-x-3 -top-2 h-px bg-[#e6ba73] shadow-[0_0_10px_#e6ba73]" /> : null}
              <span className="text-sm text-pink-300/80">{meta.glyph}</span>
              <span className="max-w-[4rem] truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
