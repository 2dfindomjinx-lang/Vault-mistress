"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CourtGlyph } from "@/components/court/CourtVisuals";
import { CRATE_TYPES, RARITY_COLORS, type CrateRarity } from "@/lib/crates";
import { emitSoundEvent } from "@/lib/sound";

// Crate Duels: two subs each pay for N crates of the same type, each open
// their crates, and whoever's total value is higher takes the entire haul.
// Structured exactly like Tribute Duels (open challenge -> async accept ->
// reveal) so nobody needs to be online at the same moment as anybody else.
//
// The reveal is dramatized client-side, round by round, for whoever is
// looking at it - the opponent sees it the instant they accept, and the
// challenger sees the identical replay the next time this panel loads and
// notices a duel of theirs went from open to revealed. Neither is watching
// the other type it out live - that would require both online at once,
// exactly what this feature exists to avoid - but each gets the full
// dramatized experience independently, once, the first time they see it.
//
// One asymmetry from Tribute Duels on purpose: accepting here is instant and
// atomic (it settles the moment you click), so holding your own open
// challenge never blocks you from accepting someone else's - the two
// commitments cannot collide the way a blind Throne-tribute window could.

const SEEN_REVEALS_STORAGE_KEY = "vm-crate-duel-seen-reveals";
const ROUND_MS = 900;

type DuelItem = { itemId: string; name: string; rarity: CrateRarity | null; sellValue: number; variant: string };

type Duel = {
  acceptedAt: string | null;
  challenger: string;
  challengerItems: DuelItem[];
  challengerTotal: number | null;
  crateCost: number;
  crateName: string;
  crateType: string;
  createdAt: string;
  expiresAt: string;
  id: string;
  isMine: boolean;
  isMyChallenge: boolean;
  opponent: string | null;
  opponentItems: DuelItem[];
  opponentTotal: number | null;
  quantity: number;
  status: string;
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

function loadSeenReveals(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_REVEALS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.filter((entry) => typeof entry === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function markRevealSeen(seen: Set<string>, duelId: string) {
  seen.add(duelId);
  try {
    // Cap what's stored - this is a "don't replay the same animation twice"
    // marker, not a history, so only the most recent ones matter.
    const trimmed = Array.from(seen).slice(-50);
    window.localStorage.setItem(SEEN_REVEALS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Best effort. Worst case a reveal replays once more than it should.
  }
}

const ENABLED_CRATES = Object.entries(CRATE_TYPES).filter(([, crate]) => crate.enabled);

function ItemSlot({ item, revealed }: { item: DuelItem | undefined; revealed: boolean }) {
  if (!revealed || !item) {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-black/50 text-lg text-zinc-700">
        ?
      </div>
    );
  }
  return (
    <div
      className="flex h-14 w-14 flex-col items-center justify-center rounded-xl border bg-black/60 text-center"
      style={{ animation: "vm-crate-duel-flip 0.35s ease-out", borderColor: item.rarity ? `${RARITY_COLORS[item.rarity]}55` : undefined }}
      title={item.name}
    >
      <span className="text-[9px] font-black tabular-nums" style={{ color: item.rarity ? RARITY_COLORS[item.rarity] : "#fff" }}>
        {item.sellValue.toLocaleString()}
      </span>
    </div>
  );
}

function RevealAnimation({ duel, onDone }: { duel: Duel; onDone: () => void }) {
  const [round, setRound] = useState(0);
  const timerRef = useRef<number | null>(null);

  const myItems = duel.isMyChallenge ? duel.challengerItems : duel.opponentItems;
  const myTotal = duel.isMyChallenge ? duel.challengerTotal : duel.opponentTotal;
  const theirItems = duel.isMyChallenge ? duel.opponentItems : duel.challengerItems;
  const theirTotal = duel.isMyChallenge ? duel.opponentTotal : duel.challengerTotal;
  const theirName = duel.isMyChallenge ? duel.opponent ?? "Opponent" : duel.challenger;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the reveal to round 0 whenever a new duel starts animating
    setRound(0);
    const advance = () => {
      setRound((current) => {
        const next = current + 1;
        if (next >= duel.quantity) {
          if (timerRef.current !== null) window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        emitSoundEvent("crate_reel_tick");
        return next;
      });
    };
    timerRef.current = window.setInterval(advance, ROUND_MS);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [duel.id, duel.quantity]);

  const finished = round >= duel.quantity;
  const runningMine = myItems.slice(0, round).reduce((sum, item) => sum + item.sellValue, 0);
  const runningTheirs = theirItems.slice(0, round).reduce((sum, item) => sum + item.sellValue, 0);

  return (
    <div className="mt-5 rounded-[1.75rem] border border-pink-300/25 bg-pink-950/25 p-5">
      <style>{`@keyframes vm-crate-duel-flip { from { transform: scale(0.4) rotateY(90deg); opacity: 0; } to { transform: scale(1) rotateY(0); opacity: 1; } }`}</style>
      <p className="text-center text-[9px] font-black uppercase tracking-[0.3em] text-pink-200/60">
        {duel.crateName} · {duel.quantity}x
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="text-center">
          <p className="text-xs font-black text-pink-50">You</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {Array.from({ length: duel.quantity }, (_, i) => (
              <ItemSlot item={myItems[i]} key={i} revealed={i < round} />
            ))}
          </div>
          <p className="mt-2 font-serif text-lg text-[#ffe2ad] tabular-nums">{runningMine.toLocaleString()}</p>
        </div>
        <div className="text-center">
          <p className="truncate text-xs font-black text-pink-50">{theirName}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {Array.from({ length: duel.quantity }, (_, i) => (
              <ItemSlot item={theirItems[i]} key={i} revealed={i < round} />
            ))}
          </div>
          <p className="mt-2 font-serif text-lg text-[#ffe2ad] tabular-nums">{runningTheirs.toLocaleString()}</p>
        </div>
      </div>

      {finished ? (
        <div className="mt-4 text-center">
          <p className={`text-sm font-black ${duel.wonByMe ? "text-emerald-200" : duel.winner ? "text-rose-200" : "text-zinc-300"}`}>
            {duel.winner ? (duel.wonByMe ? "You took the whole haul." : `${theirName} took the whole haul.`) : "Tie. Each kept their own."}
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            {(myTotal ?? runningMine).toLocaleString()} vs {(theirTotal ?? runningTheirs).toLocaleString()}
          </p>
          <button
            className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-300"
            onClick={onDone}
            type="button"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}

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
  const [pickingCrate, setPickingCrate] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [animatingDuel, setAnimatingDuel] = useState<Duel | null>(null);
  const seenRevealsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    if (previewMode) return;
    try {
      const response = await fetch("/api/user/crate-duels", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as DuelState | { error?: string } | null;
      if (!response.ok || !payload || "error" in payload) {
        setError((payload as { error?: string } | null)?.error ?? "The crate duels are unavailable.");
        return;
      }
      const nextState = payload as DuelState;
      setState(nextState);
      setError("");

      // The first time THIS browser sees one of my duels go from open to
      // revealed, play the round-by-round reveal - whether I was the
      // challenger who has been waiting, or the opponent who just accepted.
      if (seenRevealsRef.current === null) seenRevealsRef.current = loadSeenReveals();
      const seen = seenRevealsRef.current;
      const unseenReveal = nextState.duels.find((duel) => duel.isMine && duel.status === "revealed" && !seen.has(duel.id));
      if (unseenReveal) {
        markRevealSeen(seen, unseenReveal.id);
        setAnimatingDuel(unseenReveal);
      }
    } catch {
      setError("The crate duels are unavailable.");
    }
  }, [previewMode]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount against an external system
    void load();
    const timer = window.setInterval(() => void load(), 45_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const act = async (body: Record<string, unknown>, confirmText?: string) => {
    if (disabled || pending) return;
    if (confirmText && !window.confirm(confirmText)) return;
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
      setPickingCrate(false);
      setQuantity(1);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The duel action failed.");
    } finally {
      setPending(false);
    }
  };

  const maxQuantity = state?.maxQuantity ?? 5;
  const live = state?.myLiveDuel ?? null;
  const openDuels = (state?.duels ?? []).filter((duel) => duel.status === "open");
  const revealed = (state?.duels ?? []).filter((duel) => duel.status === "revealed").slice(0, 6);

  return (
    <section className="relative min-w-0 overflow-hidden rounded-[2rem] border border-amber-300/25 bg-[radial-gradient(circle_at_8%_0%,rgba(245,158,11,.19),transparent_32%),radial-gradient(circle_at_88%_8%,rgba(236,72,153,.28),transparent_34%),linear-gradient(145deg,rgba(31,8,19,.98),rgba(4,2,7,.98))] p-5 shadow-[0_24px_80px_rgba(109,35,8,.18)]">
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/75 to-transparent" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.32em] text-[#d7ad69]/60">Sub versus sub</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-white [text-shadow:0_0_24px_rgba(245,158,11,.22)]">Crate Duels</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Pick a crate and how many, pay the price, and it opens instantly - sealed, unseen by anyone including
            you. Whoever accepts opens the same crates; the higher total takes the whole haul.
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="court-duel-seal" aria-hidden="true"><CourtGlyph symbol="seal" /><span>vs</span><CourtGlyph symbol="crown" /></div>

      {animatingDuel ? <RevealAnimation duel={animatingDuel} onDone={() => setAnimatingDuel(null)} /> : null}

      {/* My live challenge takes over the top of the panel. */}
      {live ? (
        <div className="mt-5 rounded-[1.75rem] border border-pink-300/25 bg-pink-950/25 p-5">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-pink-200/60">Your open challenge</p>
          <h3 className="mt-2 font-serif text-2xl text-[#fff0d2]">
            {live.quantity}x {live.crateName} - waiting for an opponent
          </h3>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Already opened and sealed. Nobody can see the haul, including you, until someone accepts.
          </p>
          <p className="mt-3 inline-block rounded-full border border-[#c89a55]/25 bg-black/40 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#ffe2ad]">
            {remainingLabel(live.expiresAt, now)}
          </p>
          <button
            className="mt-4 block rounded-2xl border border-white/15 px-5 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-zinc-300 transition hover:border-rose-300/40 hover:text-rose-100 disabled:opacity-40"
            disabled={pending}
            onClick={() => void act({ action: "cancel", duelId: live.id }, "Withdraw this challenge? You'll get the haul you already rolled.")}
            type="button"
          >
            Withdraw - claim the sealed haul
          </button>
        </div>
      ) : (
        <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-white/[.04] p-5">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#d7ad69]/55">Open a challenge</p>
          {pickingCrate ? (
            <>
              <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">How many crates?</p>
              <div className="mt-1.5 flex gap-1.5">
                {Array.from({ length: maxQuantity }, (_, i) => i + 1).map((n) => (
                  <button
                    className={`h-9 w-9 rounded-lg border text-xs font-black transition ${quantity === n ? "border-[#e6ba73]/60 bg-[#c89a55]/15 text-[#ffe2ad]" : "border-white/10 bg-black/30 text-zinc-400"}`}
                    key={n}
                    onClick={() => setQuantity(n)}
                    type="button"
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {ENABLED_CRATES.map(([crateType, crate]) => (
                  <button
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-left text-xs font-black text-zinc-200 transition enabled:hover:border-pink-300/40 disabled:opacity-40"
                    disabled={disabled || pending}
                    key={crateType}
                    onClick={() =>
                      void act(
                        { action: "create", crateType, quantity },
                        `Open ${quantity}x ${crate.name} for ${(crate.cost * quantity).toLocaleString()} coins and seal it into a duel?`,
                      )
                    }
                    type="button"
                  >
                    {crate.name}
                    <span className="block text-[10px] font-normal text-zinc-500">
                      {(crate.cost * quantity).toLocaleString()} coins for {quantity}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button
              className="mt-3 rounded-xl border border-pink-200/25 bg-pink-500/15 px-6 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-pink-50 transition enabled:hover:bg-pink-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={disabled || pending}
              onClick={() => setPickingCrate(true)}
              type="button"
            >
              Choose a crate to duel with
            </button>
          )}
          <p className="mt-2 text-[11px] leading-5 text-zinc-600">
            You pay the crates&apos; normal price and they open right away - the odds are the crate&apos;s plain
            listed ones, no discounts either side.
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
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5" key={duel.id}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-pink-50">{duel.challenger}</p>
                    <p className="text-[10px] text-zinc-600">
                      {duel.quantity}x {duel.crateName} · {(duel.crateCost * duel.quantity).toLocaleString()} coins ·{" "}
                      {remainingLabel(duel.expiresAt, now)}
                    </p>
                  </div>
                  {duel.isMyChallenge ? (
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">Yours</span>
                  ) : (
                    <button
                      className="shrink-0 rounded-xl border border-pink-200/25 bg-pink-500/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-pink-50 transition enabled:hover:bg-pink-500/25 disabled:opacity-40"
                      disabled={disabled || pending}
                      onClick={() =>
                        void act(
                          { action: "accept", duelId: duel.id },
                          `Open ${duel.quantity}x ${duel.crateName} for ${(duel.crateCost * duel.quantity).toLocaleString()} coins against ${duel.challenger}? Higher total takes the whole haul.`,
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
        </div>

        {/* Reveal history: public by design - items and values included. */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#c89a55]/50">Revealed</p>
          <div className="mt-2 grid gap-2">
            {revealed.length === 0 ? (
              <p className="rounded-2xl border border-white/[0.07] bg-black/25 px-4 py-5 text-center text-xs text-zinc-600">
                No crate duels have been revealed yet.
              </p>
            ) : (
              revealed.map((duel) => (
                <div className="court-duel-reveal rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5" key={duel.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={`min-w-0 truncate text-xs font-black ${duel.winner === duel.challenger ? "text-emerald-100" : "text-zinc-400"}`}>
                      {duel.challenger} · {(duel.challengerTotal ?? 0).toLocaleString()}
                    </p>
                    <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-700">vs</span>
                    <p className={`min-w-0 truncate text-right text-xs font-black ${duel.winner === duel.opponent ? "text-emerald-100" : "text-zinc-400"}`}>
                      {duel.opponent} · {(duel.opponentTotal ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-1 text-center text-[10px] text-zinc-600">
                    {duel.quantity}x {duel.crateName} ·{" "}
                    {duel.winner ? `${duel.winner} won the crate duel` : "Tie. Each kept their own."}
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
