"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getBirthdayWindowState } from "@/lib/birthday";

function compactCountdown(ms: number) {
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function BirthdayCourtBanner() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- subscribing to wall-clock time
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (now === null) return null;
  const state = getBirthdayWindowState(now);
  if (state.hasEnded) return null;

  return (
    <section className="relative mx-4 mt-4 overflow-hidden rounded-[1.5rem] border border-[#e6ba73]/25 bg-[linear-gradient(110deg,rgba(22,7,16,.98),rgba(83,15,51,.92),rgba(8,4,8,.98))] shadow-[0_18px_55px_rgba(0,0,0,.42)] lg:mx-5">
      <Image
        alt=""
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-full w-56 object-cover object-[65%_25%] opacity-35 sm:w-80"
        height={360}
        sizes="320px"
        src="/birthday/principessa-birthday-court.png"
        width={640}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#120710] via-[#2d0b20]/90 to-transparent" />
      <div className="relative flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#e6ba73]/65">
            {state.isLive ? "The birthday court is open" : "Principessa summons her court"}
          </p>
          <h2 className="mt-1 font-serif text-2xl text-[#fff0d2] sm:text-3xl">Her 22nd Birthday · August 14</h2>
          <p className="mt-1 text-xs leading-5 text-pink-100/60">
            {state.isLive
              ? `1.5× base Money · guestbook, roses and candles · closes in ${compactCountdown(state.msUntilEnd)}`
              : `Opens in ${compactCountdown(state.msUntilStart)} · 48-hour 1.5× base Money event`}
          </p>
        </div>
        <Link
          className="shrink-0 rounded-full border border-[#e6ba73]/35 bg-[#e6ba73]/12 px-5 py-3 text-center text-[10px] font-black uppercase tracking-[0.16em] text-[#ffe4b2] transition hover:bg-[#e6ba73]/22"
          href="/birthday-2026"
        >
          Enter the celebration
        </Link>
      </div>
    </section>
  );
}
