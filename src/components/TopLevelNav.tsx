import Link from "next/link";

export function TopLevelNav({ active }: { active: "feed" | "main" }) {
  return (
    <nav className="flex w-full items-center justify-center border-b border-white/10 bg-black/45 px-3 py-2 backdrop-blur-xl">
      <div className="grid w-full max-w-md grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
        <Link
          className={`rounded-full px-4 py-2 text-center text-xs font-black uppercase tracking-[0.14em] transition ${
            active === "main" ? "bg-pink-500 text-white shadow-[0_0_18px_rgba(236,72,153,0.3)]" : "text-zinc-400 hover:text-white"
          }`}
          href="/"
        >
          Main Page
        </Link>
        <Link
          className={`rounded-full px-4 py-2 text-center text-xs font-black uppercase tracking-[0.14em] transition ${
            active === "feed" ? "bg-pink-500 text-white shadow-[0_0_18px_rgba(236,72,153,0.3)]" : "text-zinc-400 hover:text-white"
          }`}
          href="/principessa-feed"
        >
          Principessa Feed
        </Link>
      </div>
    </nav>
  );
}

