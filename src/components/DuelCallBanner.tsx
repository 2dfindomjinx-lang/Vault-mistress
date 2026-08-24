"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Site-wide call to arms, in the birthday banner's spirit: whenever open
// challenges are waiting, every page says so. Hidden entirely when the lobby
// is quiet - an empty summons reads as a dead feature.

export function DuelCallBanner() {
  const [counts, setCounts] = useState<{ active: number; open: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/public/duels", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { active?: number; open?: number } | null;
        if (!cancelled && payload) setCounts({ active: payload.active ?? 0, open: payload.open ?? 0 });
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

  if (!counts || counts.open === 0) return null;

  return (
    <section className="relative mx-4 mt-4 overflow-hidden rounded-[1.5rem] border border-pink-300/25 bg-[linear-gradient(110deg,rgba(22,7,16,.98),rgba(83,15,51,.92),rgba(8,4,8,.98))] shadow-[0_18px_55px_rgba(0,0,0,.42)] lg:mx-5">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#120710] via-[#2d0b20]/90 to-transparent" />
      <div className="relative flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.32em] text-pink-300/60">Tribute duels</p>
          <p className="mt-1 font-serif text-xl text-[#fff0d2]">
            {counts.open === 1 ? "A challenger is waiting." : `${counts.open} challengers are waiting.`}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Match the stake, outspend them on Throne, and serve Principessa while you do it.
          </p>
        </div>
        <Link
          className="shrink-0 rounded-2xl border border-pink-200/25 bg-pink-500/15 px-6 py-3 text-center text-xs font-black uppercase tracking-[0.16em] text-pink-50 transition hover:bg-pink-500/25"
          href="/wheels"
        >
          Join the duel
        </Link>
      </div>
    </section>
  );
}
