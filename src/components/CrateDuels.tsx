"use client";

import { confirmDialog } from "@/lib/confirm-dialog";
import { useCallback, useEffect, useState } from "react";
import { CourtGlyph } from "@/components/court/CourtVisuals";
import { Avatar, CrateDuelBattle, type BattleItem } from "@/components/CrateDuelBattle";
import { CRATE_TYPES, getCrateIconUrl } from "@/lib/crates";
import { groupLineup, lineupCost, lineupLabel } from "@/lib/crate-duel-lineup";
import { emitSoundEvent } from "@/lib/sound";

// Crate Duels: two subs each pay for N crates of the same type, each open
// their crates, and whoever's total value is higher takes the entire haul.
// Structured exactly like Tribute Duels (open challenge -> async accept ->
// reveal) so nobody needs to be online at the same moment as anybody else.
//
// The reveal (CrateDuelBattle) is dramatized client-side from stored data.
// The opponent gets it the instant they accept. The challenger, who is
// usually elsewhere when that happens, gets a "Watch" card instead of a
// surprise full-screen popup. Whether a reveal was watched is stored on the
// account, so it follows the player across devices; any revealed duel can be
// re-watched from the results list.
//
// One asymmetry from Tribute Duels on purpose: accepting here is instant and
// atomic (it settles the moment you click), so holding your own open
// challenge never blocks you from accepting someone else's - the two
// commitments cannot collide the way a blind Throne-tribute window could.

type Duel = {
  acceptedAt: string | null;
  challenger: string;
  challengerAvatar: string | null;
  challengerItems: BattleItem[];
  challengerTotal: number | null;
  crateName: string;
  crateType: string;
  crates: string[];
  createdAt: string;
  expiresAt: string;
  id: string;
  isMine: boolean;
  isMyChallenge: boolean;
  opponent: string | null;
  opponentAvatar: string | null;
  opponentItems: BattleItem[];
  opponentTotal: number | null;
  quantity: number;
  seenByMe: boolean;
  status: string;
  totalCost: number;
  winner: string | null;
  wonByMe: boolean;
};

type DuelState = {
  duels: Duel[];
  expiresHours: number;
  maxQuantity: number;
  myLiveDuel: Duel | null;
};

function remainingLabel(expiresAt: string, now: number) {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return "Expiring...";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m left to accept`;
  return `${minutes}m left to accept`;
}

const ENABLED_CRATES = Object.entries(CRATE_TYPES).filter(([, crate]) => crate.enabled);

export function CrateDuels({
  disabled = false,
  previewMode = false,
  onProfile,
}: {
  disabled?: boolean;
  previewMode?: boolean;
  onProfile?: (profile: unknown) => void;
}) {
  const [state, setState] = useState<DuelState | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [showRules, setShowRules] = useState(false);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [animatingDuel, setAnimatingDuel] = useState<Duel | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const load = useCallback(async (): Promise<DuelState | null> => {
    if (previewMode) return null;
    try {
      const response = await fetch("/api/user/crate-duels", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as DuelState | { error?: string } | null;
      if (!response.ok || !payload || "error" in payload) {
        setError((payload as { error?: string } | null)?.error ?? "The crate duels are unavailable.");
        return null;
      }
      const nextState = payload as DuelState;
      setState(nextState);
      setError("");
      return nextState;
    } catch {
      setError("The crate duels are unavailable.");
      return null;
    }
  }, [previewMode]);

  // Opens a reveal and, the first time this account watches it, records that
  // on the server so no other device offers it again.
  const watch = (duel: Duel) => {
    setAnimatingDuel(duel);
    if (duel.seenByMe || previewMode) return;
    setState((current) =>
      current
        ? { ...current, duels: current.duels.map((entry) => (entry.id === duel.id ? { ...entry, seenByMe: true } : entry)) }
        : current,
    );
    void fetch("/api/user/crate-duels", {
      body: JSON.stringify({ action: "seen", duelId: duel.id }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => undefined);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount against an external system
    void load();
    // Paused while the tab is hidden; coming back refreshes at most once a minute.
    let lastLoadAt = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastLoadAt < 60_000) return;
      lastLoadAt = Date.now();
      void load();
    };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  const act = async (body: Record<string, unknown>, confirmText?: string) => {
    if (disabled || pending) return;
    if (confirmText && !(await confirmDialog(confirmText))) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/user/crate-duels", {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; profile?: unknown } | null;
      if (!response.ok) throw new Error(payload?.error ?? "The duel action failed.");
      if (payload?.profile && onProfile) onProfile(payload.profile);
      emitSoundEvent("button_click");
      setPicks({});
      const fresh = await load();
      // Accepting settles the duel on the spot, so the accepter sees the
      // reveal right away - they are watching for exactly this.
      if (body.action === "accept" && fresh) {
        const accepted = fresh.duels.find((entry) => entry.id === body.duelId);
        if (accepted) watch(accepted);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The duel action failed.");
    } finally {
      setPending(false);
    }
  };

  const maxQuantity = state?.maxQuantity ?? 5;
  // Expanded in tile order, so a lineup always opens grouped by crate type.
  const pickedCrates = ENABLED_CRATES.flatMap(([crateType]) => Array.from({ length: picks[crateType] ?? 0 }, () => crateType));
  const pickedCount = pickedCrates.length;
  const changePick = (crateType: string, delta: number) =>
    setPicks((current) => {
      const next = Math.max(0, (current[crateType] ?? 0) + delta);
      const others = Object.entries(current).reduce((sum, [key, count]) => (key === crateType ? sum : sum + count), 0);
      return others + next > maxQuantity ? current : { ...current, [crateType]: next };
    });
  const live = state?.myLiveDuel ?? null;
  const openDuels = (state?.duels ?? []).filter((duel) => duel.status === "open");
  const revealed = (state?.duels ?? []).filter((duel) => duel.status === "revealed").slice(0, 6);
  const unwatched = (state?.duels ?? []).filter((duel) => duel.isMine && duel.status === "revealed" && !duel.seenByMe);

  return (
    <section className="relative min-w-0 overflow-hidden rounded-[2rem] border border-amber-300/25 bg-[radial-gradient(circle_at_8%_0%,rgba(245,158,11,.19),transparent_32%),radial-gradient(circle_at_88%_8%,rgba(236,72,153,.28),transparent_34%),linear-gradient(145deg,rgba(31,8,19,.98),rgba(4,2,7,.98))] p-5 shadow-[0_24px_80px_rgba(109,35,8,.18)]">
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/75 to-transparent" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.32em] text-[#d7ad69]/60">Sub versus sub</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-white [text-shadow:0_0_24px_rgba(245,158,11,.22)]">Crate Duels</h2>
        </div>
        <button
          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-black text-zinc-300 transition hover:text-white"
          onClick={() => setShowRules((current) => !current)}
          type="button"
        >
          ⓘ How it works
        </button>
      </div>
      {showRules ? (
        <p className="mt-3 max-w-2xl rounded-xl border border-[#c89a55]/20 bg-black/40 px-4 py-3 text-xs leading-5 text-zinc-400">
          Pick up to {maxQuantity} crates, any mix, and pay the normal prices. Your crates open right away and the
          result stays sealed - nobody sees it, you included - until someone accepts. They open the same crates, both
          hauls are revealed round by round, and the higher total takes every item. A tie leaves each side with their
          own. Odds are each crate&apos;s listed ones, no discounts; the Principessa Case keeps its Bad Luck Protection.
          If nobody accepts within {state?.expiresHours ?? 48} hours, or you withdraw, you keep your haul.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="court-duel-seal" aria-hidden="true"><CourtGlyph symbol="seal" /><span>vs</span><CourtGlyph symbol="crown" /></div>

      {animatingDuel ? <CrateDuelBattle duel={animatingDuel} onClose={() => setAnimatingDuel(null)} /> : null}

      {unwatched.map((duel) => {
        const rival = duel.isMyChallenge ? duel.opponent : duel.challenger;
        return (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#c89a55]/35 bg-[#c89a55]/10 px-4 py-3" key={duel.id}>
            <Avatar name={rival ?? "?"} size={40} src={duel.isMyChallenge ? duel.opponentAvatar : duel.challengerAvatar} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-white">Duel vs {rival} is settled</p>
              <p className="text-[11px] text-zinc-400">
                {duel.crateName}
              </p>
            </div>
            <button
              className="shrink-0 rounded-xl bg-[linear-gradient(100deg,#e6ba73,#c89a55)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#1a1008]"
              onClick={() => watch(duel)}
              type="button"
            >
              ▶ Watch
            </button>
          </div>
        );
      })}

      {/* Keep a live challenge visible without letting it crowd the public lobby. */}
      {live ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-pink-300/20 bg-pink-950/20 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-pink-200/60">Your open challenge <span className="text-zinc-500">· Sealed</span></p>
            <p className="mt-1 truncate text-sm font-black text-[#fff0d2]">{live.crateName}</p>
          </div>
          <p className="rounded-full border border-[#c89a55]/25 bg-black/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#ffe2ad]">
            {remainingLabel(live.expiresAt, now)}
          </p>
          <button
            className="rounded-xl border border-white/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-300 transition hover:border-rose-300/40 hover:text-rose-100 disabled:opacity-40"
            disabled={pending}
            onClick={() => void act({ action: "cancel", duelId: live.id }, "Withdraw? You keep your haul.")}
            type="button"
          >
            Withdraw
          </button>
        </div>
      ) : (
        <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-white/[.04] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#d7ad69]/55">New duel</p>
            <p className="text-[11px] font-black text-zinc-400">
              <span className={pickedCount > 0 ? "text-[#ffe2ad]" : undefined}>{pickedCount}</span> / {maxQuantity} crates
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ENABLED_CRATES.map(([crateType, crate]) => {
              const count = picks[crateType] ?? 0;
              return (
                <div
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 transition ${count > 0 ? "border-[#e6ba73]/55 bg-[#c89a55]/10" : "border-white/10 bg-black/30"}`}
                  key={crateType}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    className="h-12 w-12 object-contain"
                    height={48}
                    loading="lazy"
                    src={getCrateIconUrl(crateType, crate.icon_url) ?? undefined}
                    width={48}
                  />
                  <p className="w-full truncate text-center text-[11px] font-black text-zinc-200">{crate.name}</p>
                  <p className="text-[10px] text-zinc-500">{crate.cost.toLocaleString()}</p>
                  <div className="flex items-center gap-2">
                    <button
                      aria-label={`Remove ${crate.name}`}
                      className="h-7 w-7 rounded-lg border border-white/10 bg-black/40 text-sm font-black text-zinc-300 transition enabled:hover:text-white disabled:opacity-30"
                      disabled={count === 0}
                      onClick={() => changePick(crateType, -1)}
                      type="button"
                    >
                      −
                    </button>
                    <span className="w-4 text-center text-xs font-black text-[#ffe2ad]">{count}</span>
                    <button
                      aria-label={`Add ${crate.name}`}
                      className="h-7 w-7 rounded-lg border border-white/10 bg-black/40 text-sm font-black text-zinc-300 transition enabled:hover:text-white disabled:opacity-30"
                      disabled={pickedCount >= maxQuantity}
                      onClick={() => changePick(crateType, 1)}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            className="mt-3 w-full rounded-xl border border-pink-200/25 bg-pink-500/15 px-6 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-pink-50 transition enabled:hover:bg-pink-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={disabled || pending || pickedCount === 0}
            onClick={() =>
              void act(
                { action: "create", crates: pickedCrates },
                `Open ${lineupLabel(pickedCrates)} for ${lineupCost(pickedCrates).toLocaleString()} coins?`,
              )
            }
            type="button"
          >
            {pickedCount === 0 ? "Pick crates" : `Start duel · ${lineupCost(pickedCrates).toLocaleString()} coins`}
          </button>
        </div>
      )}

      {/* Lobby */}
      <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#c89a55]/50">Open challenges</p>
          <div className="mt-2 grid gap-2.5">
            {openDuels.length === 0 ? (
              <p className="rounded-2xl border border-white/[0.07] bg-black/25 px-4 py-5 text-center text-xs text-zinc-600">
                No open duels.
              </p>
            ) : (
              openDuels.map((duel) => (
                <div
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5"
                  key={duel.id}
                >
                  {/* Rounds = crates per player, like the round hexagon in a battle lobby. */}
                  <div
                    className="flex h-10 w-9 shrink-0 items-center justify-center bg-[#c89a55]/35 text-sm font-black text-[#ffe2ad]"
                    style={{ clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" }}
                    title={`${duel.quantity} crate${duel.quantity === 1 ? "" : "s"} each`}
                  >
                    {duel.quantity}
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex shrink-0 gap-2">
                      {groupLineup(duel.crates).slice(0, 3).map((group) => (
                        <div className="relative" key={group.crateType}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={group.name}
                            className="h-11 w-11 rounded-lg border border-white/10 bg-black/60 object-contain"
                            height={44}
                            loading="lazy"
                            src={getCrateIconUrl(group.crateType, CRATE_TYPES[group.crateType]?.icon_url) ?? undefined}
                            width={44}
                          />
                          {group.count > 1 ? (
                            <span className="absolute -bottom-1 -right-1 rounded-md bg-[#c89a55] px-1 text-[9px] font-black leading-4 text-[#1a1008]">
                              ×{group.count}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-[#fff0d2]">{duel.crateName}</p>
                      <p className="text-[10px] text-zinc-600">{remainingLabel(duel.expiresAt, now)}</p>
                    </div>
                  </div>
                  <p className="rounded-md border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-[11px] font-black text-amber-100">
                    {duel.totalCost.toLocaleString()}
                  </p>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-full bg-black/40 p-1">
                      <Avatar name={duel.challenger} ring="#c89a55" size={32} src={duel.challengerAvatar} />
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-[#c89a55]/50 text-base font-black text-[#c89a55]/70"
                        title="Open slot"
                      >
                        +
                      </span>
                    </div>
                    {duel.isMyChallenge ? (
                      <span className="w-16 text-center text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">Yours</span>
                    ) : (
                      <button
                        className="shrink-0 rounded-xl border border-pink-200/25 bg-pink-500/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-pink-50 transition enabled:hover:bg-pink-500/25 disabled:opacity-40"
                        disabled={disabled || pending}
                        onClick={() =>
                          void act(
                            { action: "accept", duelId: duel.id },
                            `Open ${duel.crateName} for ${duel.totalCost.toLocaleString()} coins against ${duel.challenger}?`,
                          )
                        }
                        type="button"
                      >
                        Join
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Reveal history: public by design - items and values included. */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#c89a55]/50">Results</p>
          <div className="mt-2 grid gap-2.5">
            {revealed.length === 0 ? (
              <p className="rounded-2xl border border-white/[0.07] bg-black/25 px-4 py-5 text-center text-xs text-zinc-600">
                No results yet.
              </p>
            ) : (
              revealed.map((duel) => (
                <div className="court-duel-reveal rounded-2xl border border-white/10 bg-black/30 px-3.5 py-3" key={duel.id}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar
                        name={duel.challenger}
                        ring={duel.winner === duel.challenger ? "#34d399" : undefined}
                        size={36}
                        src={duel.challengerAvatar}
                      />
                      <p className={`min-w-0 truncate text-xs font-black ${duel.winner === duel.challenger ? "text-emerald-100" : "text-zinc-400"}`}>
                        {(duel.challengerTotal ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-700">vs</span>
                    <div className="flex min-w-0 flex-row-reverse items-center gap-2">
                      <Avatar
                        name={duel.opponent ?? "?"}
                        ring={duel.winner === duel.opponent ? "#34d399" : undefined}
                        size={36}
                        src={duel.opponentAvatar}
                      />
                      <p className={`min-w-0 truncate text-right text-xs font-black ${duel.winner === duel.opponent ? "text-emerald-100" : "text-zinc-400"}`}>
                        {(duel.opponentTotal ?? 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[10px] text-zinc-600">
                      {duel.crateName} ·{" "}
                      {duel.winner ? `${duel.winner} won` : "Tie"}
                    </p>
                    <button
                      className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400 transition hover:border-pink-300/40 hover:text-pink-100"
                      onClick={() => watch(duel)}
                      type="button"
                    >
                      ▶ Watch
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
