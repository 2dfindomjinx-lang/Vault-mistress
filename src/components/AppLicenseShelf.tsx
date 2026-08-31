"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { MoneyIcon } from "@/components/MoneyIcon";
import type { Profile } from "@/lib/supabase/client";

// Her Android programs, bought with Principessa Money.
//
// This shelf and the Court's Links page sell the same thing through the same
// shared licence table, so a program bought on either site shows as owned on
// both, and the one-per-account rule spans them without either side checking
// for the other.
//
// The panel keeps its own state instead of threading a dozen props through the
// page: nothing else on the screen depends on which programs you own, and the
// only thing that escapes is the new balance after a purchase.

type Program = {
  slug: string;
  title: string;
  description: string;
  link: string;
  pricePm: number;
  /** The activation code, once this account owns one. */
  code: string | null;
  /** True once an install has redeemed the code and taken it for good. */
  bound: boolean;
  deviceName: string | null;
};

type AppLicenseShelfProps = {
  disabled?: boolean;
  money: number;
  onPurchased: (profile: Profile) => void;
};

// Art copied from the Court so the same program looks the same on both sites.
const PROGRAM_ART: Record<string, string> = {
  discipline: "/programs/principessas_discipline.webp",
  wallpaper: "/programs/principessa_wallpaper.webp",
};

export function AppLicenseShelf({ disabled = false, money, onPurchased }: AppLicenseShelfProps) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Owning a program is shared state: it can change in the Court, in another
  // tab, or from an admin reset, and none of that reaches this page on its own.
  // Realtime is not an option here - subscriptions are subject to RLS and the
  // licence table deliberately has no policies, so a client would receive
  // nothing. Re-reading when the tab comes back into focus covers every one of
  // those cases for the price of one request, which is the same fallback the
  // vault already uses for the profile row.
  //
  // A stale card is never wrong, only behind: unlocking something already owned
  // returns the existing code and charges nothing.
  useEffect(() => {
    let alive = true;

    const load = (initial: boolean) => {
      fetch("/api/user/app-licenses", { cache: "no-store" })
        .then((response) => response.json())
        .then((payload: { error?: string; programs?: Program[] }) => {
          if (!alive) return;
          if (!payload?.programs) throw new Error(payload?.error ?? "Could not load her programs.");
          setPrograms(payload.programs);
          setError("");
        })
        .catch((cause: unknown) => {
          // A failed background refresh leaves the shelf exactly as it was; only
          // the first load has nothing to fall back on.
          if (!alive || !initial) return;
          setError(cause instanceof Error ? cause.message : "Could not load her programs.");
        })
        .finally(() => {
          if (alive && initial) setIsLoading(false);
        });
    };

    load(true);

    const onVisible = () => {
      if (document.visibilityState === "visible") load(false);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const buy = useCallback(
    async (program: Program) => {
      setPendingSlug(program.slug);
      try {
        const response = await fetch("/api/user/app-licenses", {
          body: JSON.stringify({ slug: program.slug }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json().catch(() => null)) as
          | { code?: string; error?: string; profile?: Profile }
          | null;
        if (!response.ok || !payload?.code || !payload.profile) {
          throw new Error(payload?.error ?? "That did not go through.");
        }
        const code = payload.code;
        setPrograms((current) =>
          current.map((entry) => (entry.slug === program.slug ? { ...entry, code } : entry)),
        );
        onPurchased(payload.profile);
        setError("");
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : "That did not go through.");
      } finally {
        setPendingSlug(null);
      }
    },
    [onPurchased],
  );

  const copy = useCallback(async (program: Program) => {
    if (!program.code) return;
    try {
      await navigator.clipboard.writeText(program.code);
      setCopiedSlug(program.slug);
      window.setTimeout(() => setCopiedSlug((current) => (current === program.slug ? null : current)), 1600);
    } catch {
      // Clipboard access can be refused outright; the code is on screen anyway.
    }
  }, []);

  if (!isLoading && !error && programs.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#d7ad69]/70">Yours to keep</p>
          <h3 className="mt-1 text-2xl font-black text-white">Her Programs</h3>
        </div>
        <p className="text-[11px] text-zinc-500">One per account. The code locks to the first phone that uses it.</p>
      </div>

      {error ? (
        <p className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-50/90">{error}</p>
      ) : null}

      {isLoading ? (
        <p className="mt-4 rounded-2xl border border-white/10 px-3 py-6 text-center text-sm text-zinc-500">
          Loading her programs...
        </p>
      ) : (
        <div className="court-grid mt-4 grid gap-3 sm:grid-cols-2">
          {programs.map((program) => {
            const isPending = pendingSlug === program.slug;
            const canAfford = money >= program.pricePm;
            const art = PROGRAM_ART[program.slug];

            return (
              <article
                className="court-grid-card court-grid-card--gold flex min-w-0 flex-col gap-3 overflow-hidden rounded-[1.25rem] border border-[#c89a55]/20 bg-[linear-gradient(155deg,rgba(120,53,15,0.22),rgba(0,0,0,0.55))] p-4"
                key={program.slug}
              >
                <div className="flex items-center gap-3">
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-[#c89a55]/25 bg-black/40">
                    {art ? <Image alt="" className="object-cover" fill sizes="44px" src={art} /> : null}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{program.title}</p>
                    <p className="flex items-center gap-1.5 text-lg font-black leading-none text-[#fff0d2]">
                      <MoneyIcon height={16} />
                      {program.pricePm.toLocaleString()}
                    </p>
                  </div>
                </div>

                <p className="text-[11px] leading-5 text-zinc-400">{program.description}</p>

                {program.code ? (
                  <div className="rounded-xl border border-[#c89a55]/25 bg-[#e6ba73]/[0.07] p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#d7ad69]/70">
                      Your activation code
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <code className="min-w-0 break-all font-mono text-[13px] font-bold tracking-wide text-[#fff0d2]">
                        {program.code}
                      </code>
                      <button
                        className="shrink-0 rounded-lg border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-300 transition hover:border-white/25"
                        onClick={() => void copy(program)}
                        type="button"
                      >
                        {copiedSlug === program.slug ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="mt-2 text-[10px] leading-4 text-zinc-500">
                      {program.bound
                        ? `Already redeemed on ${program.deviceName ?? "your device"}. It stays with that phone.`
                        : "Enter it once in the app. It locks to that phone and cannot be moved."}
                    </p>
                  </div>
                ) : (
                  <button
                    className="rounded-xl border border-[#c89a55]/30 bg-[#e6ba73]/15 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#fff0d2] transition enabled:hover:border-[#c89a55]/60 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={disabled || isPending || !canAfford}
                    onClick={() => void buy(program)}
                    type="button"
                  >
                    {isPending ? "Working..." : canAfford ? "Unlock" : "Not enough Money"}
                  </button>
                )}

                <a
                  className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-300 transition hover:border-white/25"
                  href={program.link}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Download the app
                </a>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
