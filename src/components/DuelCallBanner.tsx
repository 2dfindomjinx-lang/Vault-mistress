"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Site-wide call to arms, in the birthday banner's spirit: whenever open
// challenges are waiting, every page says so. Hidden entirely when the lobby
// is quiet - an empty summons reads as a dead feature. Covers both duel
// families: Tribute Duels (Throne spending, blind reveal) and Crate Duels (a
// sealed crate roll, instant reveal on accept) - each gets its own line and
// link only when it actually has someone waiting.

export function DuelCallBanner() {
  const [counts, setCounts] = useState<{ active: number; crateOpen: number; open: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/public/duels", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { active?: number; crateOpen?: number; open?: number }
          | null;
        if (!cancelled && payload) {
          setCounts({ active: payload.active ?? 0, crateOpen: payload.crateOpen ?? 0, open: payload.open ?? 0 });
        }
      } catch {
        // The banner is decoration; a failed load just means no banner.
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!counts || (counts.open === 0 && counts.crateOpen === 0)) return null;

  return (
    <section className="relative mx-4 mt-4 overflow-hidden rounded-[1.5rem] border border-pink-300/25 bg-[linear-gradient(110deg,rgba(22,7,16,.98),rgba(83,15,51,.92),rgba(8,4,8,.98))] shadow-[0_18px_55px_rgba(0,0,0,.42)] lg:mx-5">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#120710] via-[#2d0b20]/90 to-transparent" />
      <div className="relative flex flex-col gap-3 px-5 py-4 sm:px-7">
        <p className="text-[9px] font-black uppercase tracking-[0.32em] text-pink-300/60">Duels</p>
        {counts.open > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-serif text-xl text-[#fff0d2]">
                {counts.open === 1 ? "A tribute challenger is waiting." : `${counts.open} tribute challengers are waiting.`}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Accept for free. The higher Throne tribute total wins.</p>
            </div>
            <Link
              className="shrink-0 rounded-2xl border border-pink-200/25 bg-pink-500/15 px-6 py-3 text-center text-xs font-black uppercase tracking-[0.16em] text-pink-50 transition hover:bg-pink-500/25"
              href="/wheels"
            >
              Join the duel
            </Link>
          </div>
        ) : null}
        {counts.crateOpen > 0 ? (
          <div className="flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between first:border-t-0 first:pt-0">
            <div>
              <p className="font-serif text-xl text-[#fff0d2]">
                {counts.crateOpen === 1 ? "A crate duel is waiting to be opened." : `${counts.crateOpen} crate duels are waiting to be opened.`}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Open the same crate. Whoever pulls the higher value takes both.
              </p>
            </div>
            <Link
              className="shrink-0 rounded-2xl border border-pink-200/25 bg-pink-500/15 px-6 py-3 text-center text-xs font-black uppercase tracking-[0.16em] text-pink-50 transition hover:bg-pink-500/25"
              href="/cases"
            >
              Accept the crate duel
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
