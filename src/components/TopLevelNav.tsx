import Link from "next/link";

export function TopLevelNav({ active }: { active: "feed" | "main" }) {
  return (
    <nav className="relative isolate w-full overflow-hidden border-b border-[#f4c06a]/20 bg-[#090309] px-3 text-white shadow-[0_14px_40px_rgba(0,0,0,.45)]">
      <div className="absolute inset-0 -z-20 bg-[url('/principessa-feed/branding/principessa-feed-hero.png')] bg-cover bg-[center_24%] opacity-20" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,2,9,.99)_0%,rgba(20,4,15,.9)_46%,rgba(8,2,9,.92)_100%)]" />
      <div className="mx-auto flex min-h-[76px] w-full max-w-7xl items-center justify-between gap-4">
        <div className="hidden items-center gap-3 sm:flex">
          <div className="h-11 w-11 rounded-full border border-[#f4c06a]/50 bg-[url('/principessa-feed/branding/principessa-feed-hero.png')] bg-cover bg-[72%_28%] shadow-[0_0_24px_rgba(236,72,153,.3)]" />
          <div>
            <p className="font-serif text-lg tracking-[0.08em] text-[#ffe3b0]">Principessa</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-pink-300/60">The Velvet Network</p>
          </div>
        </div>
        <div className="grid w-full max-w-md grid-cols-2 self-stretch sm:w-auto sm:min-w-[390px]">
        <Link
          className={`relative flex items-center justify-center px-4 text-center text-[11px] font-black uppercase tracking-[0.18em] transition ${
            active === "main" ? "text-[#ffe7bb]" : "text-zinc-500 hover:bg-white/[0.03] hover:text-white"
          }`}
          href="/"
        >
          Main Page
          {active === "main" ? <span className="absolute inset-x-5 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-[#f4c06a] to-transparent shadow-[0_0_12px_#ec4899]" /> : null}
        </Link>
        <Link
          className={`relative flex items-center justify-center px-4 text-center text-[11px] font-black uppercase tracking-[0.18em] transition ${
            active === "feed" ? "text-[#ffe7bb]" : "text-zinc-500 hover:bg-white/[0.03] hover:text-white"
          }`}
          href="/principessa-feed"
        >
          Principessa Feed
          {active === "feed" ? <span className="absolute inset-x-5 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-pink-400 to-transparent shadow-[0_0_12px_#ec4899]" /> : null}
        </Link>
        </div>
      </div>
    </nav>
  );
}
