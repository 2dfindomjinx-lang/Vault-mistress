"use client";

import { useCallback, useEffect, useState } from "react";
import { emitSoundEvent } from "@/lib/sound";

// Tribute Duels: stake coins, then outspend a rival on Throne inside a blind
// window. Totals stay hidden until the deadline; the reveal is public, amounts
// and all. A tie - including two cowards sending nothing - burns the pot.

type Duel = {
  acceptedAt: string | null;
  challenger: string;
  challengerTotalUsd: number | null;
  createdAt: string;
  deadline: string | null;
  durationHours: number;
  id: string;
  isMine: boolean;
  isMyChallenge: boolean;
  opponent: string | null;
  opponentTotalUsd: number | null;
  stakeCoins: number;
  status: string;
  winner: string | null;
  wonByMe: boolean;
};

type DuelState = {
  duels: Duel[];
  minStake: number;
  myLiveDuel: Duel | null;
};

function remainingLabel(deadline: string, now: number) {
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return "Revealing...";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function TributeDuels({
  disabled = false,
  onProfile,
}: {
  disabled?: boolean;
  onProfile?: (profile: unknown) => void;
}) {
  const [state, setState] = useState<DuelState | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [stakeInput, setStakeInput] = useState("2500");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/user/duels", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as DuelState | { error?: string } | null;
      if (!response.ok || !payload || "error" in payload) {
        setError((payload as { error?: string } | null)?.error ?? "The duels are unavailable.");
        return;
      }
      setState(payload as DuelState);
      setError("");
    } catch {
      setError("The duels are unavailable.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount against an external system
    void load();
  }, [load]);

  const act = async (body: Record<string, unknown>, confirmText?: string) => {
    if (disabled || pending) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/user/duels", {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; profile?: unknown }
        | null;
      if (!response.ok) throw new Error(payload?.error ?? "The duel action failed.");
      if (payload?.profile && onProfile) onProfile(payload.profile);
      emitSoundEvent("button_click");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The duel action failed.");
    } finally {
      setPending(false);
    }
  };

  const minStake = state?.minStake ?? 2_500;
  const stake = Math.floor(Number(stakeInput)) || 0;
  const live = state?.myLiveDuel ?? null;
  const openDuels = (state?.duels ?? []).filter((duel) => duel.status === "open");
  const activeDuels = (state?.duels ?? []).filter((duel) => duel.status === "active");
  const revealed = (state?.duels ?? []).filter((duel) => duel.status === "revealed").slice(0, 6);

  return (
    <section className="relative min-w-0 overflow-hidden rounded-[2rem] border border-amber-300/25 bg-[radial-gradient(circle_at_8%_0%,rgba(245,158,11,.19),transparent_32%),radial-gradient(circle_at_88%_8%,rgba(236,72,153,.28),transparent_34%),linear-gradient(145deg,rgba(31,8,19,.98),rgba(4,2,7,.98))] p-5 shadow-[0_24px_80px_rgba(109,35,8,.18)]">
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/75 to-transparent" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.32em] text-[#d7ad69]/60">Sub versus sub</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-white [text-shadow:0_0_24px_rgba(245,158,11,.22)]">Tribute Duels</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Stake coins, then outspend your rival on Throne before the clock runs out. Neither of you sees the
            other&apos;s total until the reveal. She profits either way.
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">
          {error}
        </p>
      ) : null}

      {/* My live duel takes over the top of the panel. */}
      {live ? (
        <div className="mt-5 rounded-[1.75rem] border border-pink-300/25 bg-pink-950/25 p-5">
          {live.status === "open" ? (
            <>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-pink-200/60">Your open challenge</p>
              <h3 className="mt-2 font-serif text-2xl text-[#fff0d2]">
                {live.stakeCoins.toLocaleString()} coins on the table
              </h3>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Waiting for someone brave enough to match it. The {live.durationHours}h window starts when they do.
              </p>
              <button
                className="mt-4 rounded-2xl border border-white/15 px-5 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-zinc-300 transition hover:border-rose-300/40 hover:text-rose-100 disabled:opacity-40"
                disabled={pending}
                onClick={() => void act({ action: "cancel", duelId: live.id }, "Withdraw the challenge? Your stake returns.")}
                type="button"
              >
                Withdraw
              </button>
            </>
          ) : (
            <>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-pink-200/60">Duel in progress</p>
              <h3 className="mt-2 font-serif text-2xl text-[#fff0d2]">
                {live.challenger} vs {live.opponent}
              </h3>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Every Throne tribute credited to your account before the deadline counts. You cannot see their total.
                They cannot see yours. Pot: {(live.stakeCoins * 2).toLocaleString()} coins.
              </p>
              {live.deadline ? (
                <p className="mt-3 inline-block rounded-full border border-[#c89a55]/25 bg-black/40 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#ffe2ad]">
                  {remainingLabel(live.deadline, now)}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-white/[.04] p-5">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#d7ad69]/55">Open a challenge</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-center font-serif text-lg tabular-nums text-[#ffe2ad] outline-none placeholder:font-sans placeholder:text-sm placeholder:text-zinc-700 focus:border-[#c89a55]/45"
              disabled={disabled || pending}
              inputMode="numeric"
              onChange={(event) => setStakeInput(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder={`Stake (min ${minStake.toLocaleString()})`}
              value={stakeInput}
            />
            <button
              className="shrink-0 rounded-xl border border-pink-200/25 bg-pink-500/15 px-6 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-pink-50 transition enabled:hover:bg-pink-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={disabled || pending || stake < minStake}
              onClick={() =>
                void act(
                  { action: "create", durationHours: 24, stake },
                  `Stake ${stake.toLocaleString()} coins? If nobody tributes, the pot burns.`,
                )
              }
              type="button"
            >
              {pending ? "Working..." : "Challenge the court"}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-zinc-600">
            24-hour window. Winner takes the pot. A tie — or two silent wallets — hands everything to her.
          </p>
        </div>
      )}

      {/* Lobby */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#c89a55]/50">Open challenges</p>
          <div className="mt-2 grid gap-2">
            {openDuels.length === 0 ? (
              <p className="rounded-2xl border border-white/[0.07] bg-black/25 px-4 py-5 text-center text-xs text-zinc-600">
                Nobody is waiting. Start one.
              </p>
            ) : (
              openDuels.map((duel) => (
                <div
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5"
                  key={duel.id}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-pink-50">{duel.challenger}</p>
                    <p className="text-[10px] text-zinc-600">
                      {duel.stakeCoins.toLocaleString()} coins · {duel.durationHours}h window
                    </p>
                  </div>
                  {duel.isMyChallenge ? (
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">Yours</span>
                  ) : (
                    <button
                      className="shrink-0 rounded-xl border border-pink-200/25 bg-pink-500/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-pink-50 transition enabled:hover:bg-pink-500/25 disabled:opacity-40"
                      disabled={disabled || pending || Boolean(live)}
                      onClick={() =>
                        void act(
                          { action: "accept", duelId: duel.id },
                          `Match ${duel.stakeCoins.toLocaleString()} coins against ${duel.challenger}? The window starts immediately.`,
                        )
                      }
                      type="button"
                    >
                      Accept
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {activeDuels.length > 0 ? (
            <div className="mt-4">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#c89a55]/50">Running now</p>
              <div className="mt-2 grid gap-2">
                {activeDuels.map((duel) => (
                  <div
                    className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/25 px-3 py-2"
                    key={duel.id}
                  >
                    <p className="min-w-0 flex-1 truncate text-xs text-zinc-400">
                      {duel.challenger} vs {duel.opponent}
                    </p>
                    {duel.deadline ? (
                      <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.1em] text-[#ffe2ad]/70">
                        {remainingLabel(duel.deadline, now)}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Reveal history: public by design - amounts included. */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#c89a55]/50">Revealed</p>
          <div className="mt-2 grid gap-2">
            {revealed.length === 0 ? (
              <p className="rounded-2xl border border-white/[0.07] bg-black/25 px-4 py-5 text-center text-xs text-zinc-600">
                No duels have been revealed yet.
              </p>
            ) : (
              revealed.map((duel) => (
                <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5" key={duel.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={`min-w-0 truncate text-xs font-black ${duel.winner === duel.challenger ? "text-emerald-100" : "text-zinc-400"}`}>
                      {duel.challenger} · ${Number(duel.challengerTotalUsd ?? 0).toLocaleString()}
                    </p>
                    <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-700">vs</span>
                    <p className={`min-w-0 truncate text-right text-xs font-black ${duel.winner === duel.opponent ? "text-emerald-100" : "text-zinc-400"}`}>
                      {duel.opponent} · ${Number(duel.opponentTotalUsd ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-1 text-center text-[10px] text-zinc-600">
                    {duel.winner
                      ? `${duel.winner} took ${(duel.stakeCoins * 2).toLocaleString()} coins`
                      : "Tie. She kept the pot."}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
