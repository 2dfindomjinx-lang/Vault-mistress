"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CRATE_TYPES, getCrateIconUrl } from "@/lib/crates";
import { groupLineup, lineupLabel } from "@/lib/crate-duel-lineup";

// Site-wide call to arms, in the birthday banner's spirit: whenever open
// challenges are waiting, every page says so. Hidden entirely when the lobby
// is quiet - an empty summons reads as a dead feature. Covers both duel
// families: Tribute Duels (Throne spending, blind reveal) and Crate Duels (a
// sealed crate roll, instant reveal on accept). Each gets its own card, shown
// only when it actually has someone waiting; the crate card previews what is
// being offered (crates and cost), never who opened it.

type CrateDuelPreview = { crates: string[]; expiresAt: string; totalCost: number };
type Counts = { active: number; crateDuels: CrateDuelPreview[]; crateOpen: number; open: number };

function SwordsIcon() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" x2="19" y1="19" y2="13" />
      <line x1="16" x2="20" y1="16" y2="20" />
      <line x1="19" x2="21" y1="21" y2="19" />
      <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
      <line x1="5" x2="9" y1="14" y2="18" />
      <line x1="7" x2="4" y1="17" y2="20" />
      <line x1="3" x2="5" y1="19" y2="21" />
    </svg>
  );
}

function timeLeft(expiresAt: string, now: number) {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return "ending";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

function LiveBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-100">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300/70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
      </span>
      {label}
    </span>
  );
}

export function DuelCallBanner() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/public/duels", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as Partial<Counts> | null;
        if (!cancelled && payload) {
          setCounts({
            active: payload.active ?? 0,
            crateDuels: payload.crateDuels ?? [],
            crateOpen: payload.crateOpen ?? 0,
            open: payload.open ?? 0,
          });
          setNow(Date.now());
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

  const cardClass =
    "group relative flex flex-col gap-4 overflow-hidden rounded-[1.4rem] border p-4 sm:p-5";
  const ctaClass =
    "mt-auto inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-center text-[11px] font-black uppercase tracking-[0.16em] transition";

  return (
    <section className="relative mx-4 mt-4 overflow-hidden rounded-[1.75rem] border border-pink-300/25 bg-[linear-gradient(110deg,rgba(22,7,16,.98),rgba(83,15,51,.92),rgba(8,4,8,.98))] p-4 shadow-[0_18px_55px_rgba(0,0,0,.42)] sm:p-5 lg:mx-5">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-pink-200/60 to-transparent" />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[9px] font-black uppercase tracking-[0.32em] text-pink-300/70">Duels are open</p>
        <LiveBadge label="Live" />
      </div>

      <div className={`mt-3 grid gap-3 ${counts.open > 0 && counts.crateOpen > 0 ? "md:grid-cols-2" : ""}`}>
        {counts.open > 0 ? (
          <div className={`${cardClass} border-pink-300/25 bg-[radial-gradient(circle_at_0%_0%,rgba(236,72,153,.22),transparent_55%),rgba(0,0,0,.35)]`}>
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-pink-300/30 bg-pink-500/15 text-pink-100">
                <SwordsIcon />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.24em] text-pink-200/70">Tribute duel</p>
                  <span className="rounded-full bg-pink-500 px-2 py-0.5 text-[10px] font-black text-white">{counts.open} waiting</span>
                </div>
                <p className="mt-1 font-serif text-lg leading-snug text-[#fff0d2]">
                  {counts.open === 1 ? "A challenger wants a rival." : `${counts.open} challengers want a rival.`}
                </p>
                <p className="mt-1 text-xs text-zinc-400">Free to accept. Whoever sends more on Throne wins.</p>
              </div>
            </div>
            <Link className={`${ctaClass} border border-pink-200/30 bg-pink-500/20 text-pink-50 hover:bg-pink-500/35`} href="/wheels">
              Take the challenge →
            </Link>
          </div>
        ) : null}

        {counts.crateOpen > 0 ? (
          <div className={`${cardClass} border-[#c89a55]/30 bg-[radial-gradient(circle_at_0%_0%,rgba(245,158,11,.2),transparent_55%),rgba(0,0,0,.35)]`}>
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#c89a55]/35 bg-[#c89a55]/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  className="h-10 w-10 object-contain"
                  height={40}
                  src={getCrateIconUrl(counts.crateDuels[0]?.crates[0] ?? "principessa_case", CRATE_TYPES[counts.crateDuels[0]?.crates[0] ?? "principessa_case"]?.icon_url) ?? undefined}
                  width={40}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#d7ad69]/80">Crate duel</p>
                  <span className="rounded-full bg-[#c89a55] px-2 py-0.5 text-[10px] font-black text-[#1a1008]">{counts.crateOpen} waiting</span>
                </div>
                <p className="mt-1 font-serif text-lg leading-snug text-[#fff0d2]">
                  {counts.crateOpen === 1 ? "A sealed haul is waiting for you." : `${counts.crateOpen} sealed hauls are waiting for you.`}
                </p>
                <p className="mt-1 text-xs text-zinc-400">Open the same crates. The higher total takes both hauls.</p>
              </div>
            </div>

            {counts.crateDuels.length > 0 ? (
              <ul className="grid gap-1.5">
                {counts.crateDuels.map((duel, index) => (
                  <li className="flex items-center gap-2.5 rounded-xl bg-black/35 px-2.5 py-1.5" key={`${duel.expiresAt}:${index}`}>
                    <div className="flex shrink-0 gap-1.5">
                      {groupLineup(duel.crates).slice(0, 3).map((group) => (
                        <div className="relative" key={group.crateType}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={group.name}
                            className="h-8 w-8 rounded-md border border-white/10 bg-black/60 object-contain"
                            height={32}
                            loading="lazy"
                            src={getCrateIconUrl(group.crateType, CRATE_TYPES[group.crateType]?.icon_url) ?? undefined}
                            width={32}
                          />
                          {group.count > 1 ? (
                            <span className="absolute -bottom-1 -right-1 rounded bg-[#c89a55] px-0.5 text-[8px] font-black leading-3 text-[#1a1008]">
                              ×{group.count}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-zinc-200">{lineupLabel(duel.crates)}</p>
                    <p className="shrink-0 text-right text-[10px] leading-tight text-zinc-500">
                      <span className="block font-black text-amber-100">{duel.totalCost.toLocaleString()}</span>
                      {timeLeft(duel.expiresAt, now)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}

            <Link className={`${ctaClass} bg-[linear-gradient(100deg,#e6ba73,#c89a55)] text-[#1a1008] hover:brightness-110`} href="/cases">
              Open the crates →
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
