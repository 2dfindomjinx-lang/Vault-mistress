import Link from "next/link";

export function TopLevelNav({ active }: { active: "feed" | "main" }) {
  return (
    <nav className="relative isolate border-y border-[#c89a55]/15 bg-black/25 text-white">
      <div className="absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-[#c89a55]/20 to-transparent" />
      <div className="mx-auto flex min-h-14 w-full max-w-[1500px] items-center justify-between gap-1 px-2 sm:gap-4 sm:px-4">
        <div className="min-w-0 pl-1 max-[480px]:hidden">
          <p className="truncate font-serif text-base tracking-[.08em] text-[#ffe7b8]">Principessa</p>
          <p className="hidden text-[8px] font-black uppercase tracking-[.3em] text-pink-200/35 sm:block">Court authority online</p>
        </div>
        <div className="flex self-stretch max-[480px]:w-full">
          <Link className={`relative flex items-center justify-center px-2 text-[8px] font-black uppercase tracking-[.12em] transition max-[480px]:flex-1 sm:px-6 sm:text-[9px] sm:tracking-[.22em] ${active === "main" ? "text-[#ffe8bd]" : "text-zinc-700 hover:text-zinc-300"}`} href="/">
            The Court
            {active === "main" ? <span className="absolute inset-x-4 bottom-0 h-px bg-[#e6ba73] shadow-[0_0_9px_#e6ba73]" /> : null}
          </Link>
          <Link className={`relative flex items-center justify-center px-2 text-[8px] font-black uppercase tracking-[.12em] transition max-[480px]:flex-1 sm:px-6 sm:text-[9px] sm:tracking-[.22em] ${active === "feed" ? "text-[#ffe8bd]" : "text-zinc-700 hover:text-zinc-300"}`} href="/principessa-feed">
            Velvet Network
            {active === "feed" ? <span className="absolute inset-x-4 bottom-0 h-px bg-pink-400 shadow-[0_0_9px_#ec4899]" /> : null}
          </Link>
        </div>
      </div>
    </nav>
  );
}
