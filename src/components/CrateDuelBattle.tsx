"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CoinAmount } from "@/components/CoinAmount";
import { CRATE_TYPES, RARITY_HEX, SAMPLE_CRATE_ITEMS, getCrateIconUrl, getCrateItemImageUrl, type CrateRarity } from "@/lib/crates";
import { lineupLabel } from "@/lib/crate-duel-lineup";
import { emitSoundEvent } from "@/lib/sound";

// The Crate Duel reveal, case-battle style: both players side by side with
// their avatars, and every round each of them spins ONE crate reel that lands
// on the item they really rolled. The running totals and the lead update
// after each round; the winner is only announced once the last reel stops.
// Everything shown here is stored data - the duel was settled server-side the
// moment it was accepted - so the filler around each winning card is drawn
// from a PRNG seeded by the duel id, which keeps a replay identical and keeps
// rendering pure.

export type BattleItem = {
  imageUrl?: string | null;
  itemId: string;
  name: string;
  rarity: CrateRarity | null;
  sellValue: number;
  variant: string;
};

export type BattleDuel = {
  challenger: string;
  challengerAvatar?: string | null;
  challengerItems: BattleItem[];
  challengerTotal: number | null;
  crateName: string;
  crateType: string;
  /** One crate type per round, in opening order. */
  crates?: string[];
  id: string;
  isMine: boolean;
  isMyChallenge: boolean;
  opponent: string | null;
  opponentAvatar?: string | null;
  opponentItems: BattleItem[];
  opponentTotal: number | null;
  quantity: number;
  winner: string | null;
  wonByMe: boolean;
};

const SPIN_MS = 2_600;
const SETTLE_MS = 260;
const HOLD_MS = 900;
const CARD = 104;
const GAP = 10;
const STEP = CARD + GAP;
const VIEW_H = 312;
const STRIP_LEN = 34;
const WIN_INDEX = 29;

type StripCard = { imageUrl: string | null; itemId: string; rarity: CrateRarity };

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStrip(crateType: string, landed: BattleItem | undefined, seedKey: string) {
  const random = mulberry32(hashString(seedKey));
  const drops = CRATE_TYPES[crateType]?.drops ?? [];
  const total = drops.reduce((sum, drop) => sum + drop.weight, 0);
  const pick = (): StripCard => {
    let cursor = random() * total;
    for (const drop of drops) {
      cursor -= drop.weight;
      if (cursor < 0) {
        const def = SAMPLE_CRATE_ITEMS[drop.item_id];
        return {
          imageUrl: getCrateItemImageUrl(drop.item_id, def?.image_url ?? null),
          itemId: drop.item_id,
          rarity: def?.rarity ?? "common",
        };
      }
    }
    return { imageUrl: null, itemId: "unknown", rarity: "common" };
  };
  const cards = Array.from({ length: STRIP_LEN }, pick);
  if (landed) {
    cards[WIN_INDEX] = {
      imageUrl: landed.imageUrl ?? getCrateItemImageUrl(landed.itemId, null),
      itemId: landed.itemId,
      rarity: landed.rarity ?? "common",
    };
  }
  // Land a little off-centre first, then settle - real reels never stop dead
  // on the middle pixel.
  const jitter = (random() - 0.5) * 0.55 * CARD;
  return { cards, jitter };
}

export function Avatar({ name, src, size = 56, ring }: { name: string; ring?: string; size?: number; src?: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full border-2 bg-[#1a1220]"
      style={{ borderColor: ring ?? "rgba(255,255,255,.15)", height: size, width: size }}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} referrerPolicy="no-referrer" src={src} />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-serif text-lg text-[#ffe2ad]">
          {name.replace(/^@/, "").charAt(0).toUpperCase() || "?"}
        </span>
      )}
    </div>
  );
}

function BattleReel({ cards, jitter }: { cards: StripCard[]; jitter: number }) {
  const stripRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = stripRef.current;
    if (!node) return;
    const centre = VIEW_H / 2 - CARD / 2;
    const startY = centre - 2 * STEP;
    const endY = centre - WIN_INDEX * STEP;
    node.style.transition = "none";
    node.style.transform = `translateY(${startY}px)`;
    void node.offsetHeight;
    node.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.1, 0.72, 0.16, 1)`;
    node.style.transform = `translateY(${endY + jitter}px)`;
    const settle = window.setTimeout(() => {
      node.style.transition = `transform ${SETTLE_MS}ms ease-out`;
      node.style.transform = `translateY(${endY}px)`;
    }, SPIN_MS);
    return () => window.clearTimeout(settle);
  }, [cards, jitter]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#09060c]" style={{ height: VIEW_H }}>
      <div className="absolute left-1/2 top-0 flex -translate-x-1/2 flex-col will-change-transform" ref={stripRef} style={{ gap: GAP }}>
        {cards.map((card, index) => (
          <div
            className="flex shrink-0 items-center justify-center rounded-xl border bg-black/60"
            key={index}
            style={{
              borderColor: `${RARITY_HEX[card.rarity]}55`,
              boxShadow: `inset 0 -18px 30px -18px ${RARITY_HEX[card.rarity]}55`,
              height: CARD,
              width: CARD,
            }}
          >
            {card.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="h-[74%] w-[74%] object-contain" draggable={false} src={card.imageUrl} />
            ) : null}
          </div>
        ))}
      </div>
      {/* Centre marker + top/bottom fades */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#09060c] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#09060c] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#e6ba73]/70 shadow-[0_0_10px_rgba(230,186,115,.8)]" />
      <div className="pointer-events-none absolute left-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[7px] border-l-[9px] border-y-transparent border-l-[#e6ba73]" />
      <div className="pointer-events-none absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[7px] border-r-[9px] border-y-transparent border-r-[#e6ba73]" />
    </div>
  );
}

export function CrateDuelBattle({ duel, onClose }: { duel: BattleDuel; onClose: () => void }) {
  // Seat order: whoever is watching sits on the left. A neutral replay of
  // someone else's duel puts the challenger left.
  const iAmOpponent = duel.isMine && !duel.isMyChallenge;
  const sides = useMemo(() => {
    const challenger = {
      avatar: duel.challengerAvatar ?? null,
      items: duel.challengerItems,
      key: "challenger",
      name: duel.challenger,
      isMe: duel.isMine && duel.isMyChallenge,
    };
    const opponent = {
      avatar: duel.opponentAvatar ?? null,
      items: duel.opponentItems,
      key: "opponent",
      name: duel.opponent ?? "Opponent",
      isMe: iAmOpponent,
    };
    return iAmOpponent ? [opponent, challenger] : [challenger, opponent];
  }, [duel, iAmOpponent]);

  const rounds = duel.quantity;
  const roundCrates = useMemo(
    () => Array.from({ length: rounds }, (_, round) => duel.crates?.[round] ?? duel.crateType),
    [duel.crateType, duel.crates, rounds],
  );
  const strips = useMemo(
    () =>
      Array.from({ length: rounds }, (_, round) =>
        sides.map((side) => buildStrip(roundCrates[round], side.items[round], `${duel.id}:${side.key}:${round}`)),
      ),
    [duel.id, roundCrates, rounds, sides],
  );

  const [round, setRound] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [done, setDone] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const scheduled = timers.current;
    emitSoundEvent("crate_reel_tick");
    for (let r = 0; r < rounds; r += 1) {
      const startAt = r * (SPIN_MS + SETTLE_MS + HOLD_MS);
      if (r > 0) {
        scheduled.push(
          window.setTimeout(() => {
            setRound(r);
            emitSoundEvent("crate_reel_tick");
          }, startAt),
        );
      }
      scheduled.push(
        window.setTimeout(() => {
          setRevealed(r + 1);
          const best = sides
            .map((side) => side.items[r]?.rarity)
            .some((rarity) => rarity === "legendary" || rarity === "ultimate");
          emitSoundEvent(best ? "crate_legendary_reveal" : "crate_reel_tick");
        }, startAt + SPIN_MS + SETTLE_MS),
      );
    }
    scheduled.push(
      window.setTimeout(
        () => {
          setDone(true);
          if (duel.isMine) emitSoundEvent(duel.wonByMe ? "task_completion" : duel.winner ? "task_fail" : "button_click");
        },
        rounds * (SPIN_MS + SETTLE_MS + HOLD_MS) - HOLD_MS + 500,
      ),
    );
    return () => scheduled.forEach((id) => window.clearTimeout(id));
  }, [duel.isMine, duel.winner, duel.wonByMe, rounds, sides]);

  const skip = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setRound(rounds - 1);
    setRevealed(rounds);
    setDone(true);
  };

  const totals = sides.map((side) => side.items.slice(0, revealed).reduce((sum, item) => sum + item.sellValue, 0));
  const leaderIndex = totals[0] === totals[1] ? -1 : totals[0] > totals[1] ? 0 : 1;
  const winnerIndex = duel.winner === null ? -1 : sides.findIndex((side) => side.name === duel.winner);
  const currentCrate = roundCrates[Math.min(round, rounds - 1)] ?? duel.crateType;
  const crateIcon = getCrateIconUrl(currentCrate, CRATE_TYPES[currentCrate]?.icon_url);
  const crateName = lineupLabel(roundCrates);
  const currentCrateName = CRATE_TYPES[currentCrate]?.name ?? duel.crateName;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 px-3 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-[2rem] border border-[#c89a55]/20 bg-[radial-gradient(circle_at_50%_0%,rgba(236,72,153,.14),transparent_45%),linear-gradient(160deg,#130d17,#07050a)] p-4 shadow-[0_30px_100px_rgba(0,0,0,.6)] sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {crateIcon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="h-9 w-9 object-contain" src={crateIcon} />
            ) : null}
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#d7ad69]/60">Crate duel</p>
              <p className="text-sm font-black text-white">
                {crateName}
              </p>
              {new Set(roundCrates).size > 1 ? (
                <p className="text-[10px] text-zinc-500">Now opening: {currentCrateName}</p>
              ) : null}
            </div>
          </div>
          <p className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[#ffe2ad]">
            {done ? "Final" : `Round ${round + 1} / ${rounds}`}
          </p>
          {done ? (
            <button
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-black text-zinc-300 hover:text-white"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          ) : (
            <button
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-black text-zinc-400 hover:text-white"
              onClick={skip}
              type="button"
            >
              Skip ›
            </button>
          )}
        </div>

        {/* Players */}
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-5">
          {sides.map((side, index) => {
            const leading = leaderIndex === index;
            const isWinner = done && winnerIndex === index;
            const isLoser = done && winnerIndex !== -1 && winnerIndex !== index;
            const ring = isWinner ? "#34d399" : leading ? "#e6ba73" : "rgba(255,255,255,.15)";
            const landedItem = revealed > round ? side.items[round] : undefined;
            const column = (
              <div className={`min-w-0 transition-opacity duration-500 ${isLoser ? "opacity-50" : ""}`} key={side.key}>
                <div className={`flex items-center gap-3 ${index === 1 ? "flex-row-reverse text-right" : ""}`}>
                  <Avatar name={side.name} ring={ring} src={side.avatar} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{side.name}</p>
                    <div className={`mt-0.5 flex items-center gap-1.5 ${index === 1 ? "justify-end" : ""}`}>
                      {side.isMe ? (
                        <span className="rounded-full bg-pink-500/20 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.12em] text-pink-200">You</span>
                      ) : null}
                      {leading && !done ? (
                        <span className="rounded-full bg-[#c89a55]/20 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.12em] text-[#ffe2ad]">Leading</span>
                      ) : null}
                      {isWinner ? (
                        <span className="rounded-full bg-emerald-500/20 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.12em] text-emerald-200">Winner</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div
                  className={`mt-3 rounded-xl border px-3 py-2 ${index === 1 ? "text-right" : ""}`}
                  style={{
                    borderColor: leading ? "rgba(230,186,115,.45)" : "rgba(255,255,255,.06)",
                    background: leading ? "rgba(200,154,85,.08)" : "rgba(0,0,0,.25)",
                  }}
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Haul</p>
                  <CoinAmount amount={totals[index]} className="font-serif text-xl text-[#ffe2ad] tabular-nums" iconSize={16} label="" />
                </div>
                <div className="mt-3">
                  <BattleReel cards={strips[round][index].cards} jitter={strips[round][index].jitter} key={`${side.key}-${round}`} />
                </div>
                <div className={`mt-2 h-10 ${index === 1 ? "text-right" : ""}`}>
                  {landedItem ? (
                    <>
                      <p className="truncate text-xs font-black" style={{ color: landedItem.rarity ? RARITY_HEX[landedItem.rarity] : "#fff" }}>
                        {landedItem.name}
                      </p>
                      <CoinAmount amount={landedItem.sellValue} className="text-[11px] font-black text-zinc-300" iconSize={11} label="" prefix="+" />
                    </>
                  ) : (
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-600">Opening...</p>
                  )}
                </div>
                {/* Round history */}
                <div className={`mt-2 flex flex-wrap gap-1 ${index === 1 ? "justify-end" : ""}`}>
                  {side.items.map((item, itemIndex) => {
                    const shown = itemIndex < revealed;
                    const current = itemIndex === round && !shown;
                    return (
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-md border bg-black/50 ${current ? "animate-pulse" : ""}`}
                        key={itemIndex}
                        style={{ borderColor: shown && item.rarity ? `${RARITY_HEX[item.rarity]}aa` : "rgba(255,255,255,.08)" }}
                        title={shown ? `${item.name} · ${item.sellValue}` : undefined}
                      >
                        {shown && item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt="" className="h-6 w-6 object-contain" src={item.imageUrl} />
                        ) : (
                          <span className="text-[10px] text-zinc-700">{itemIndex + 1}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
            if (index === 0) {
              return (
                <div className="contents" key={side.key}>
                  {column}
                  <div className="flex flex-col items-center pt-4">
                    <span className="rounded-full border border-[#c89a55]/40 bg-black/60 px-2.5 py-1 font-serif text-sm text-[#ffe2ad] shadow-[0_0_20px_rgba(200,154,85,.25)]">
                      VS
                    </span>
                  </div>
                </div>
              );
            }
            return column;
          })}
        </div>

        {/* Lead line */}
        {!done && revealed > 0 ? (
          <p className="mt-4 text-center text-xs font-black text-zinc-400">
            {leaderIndex === -1
              ? "Tied."
              : `${sides[leaderIndex].isMe ? "You lead" : `${sides[leaderIndex].name} leads`} by ${Math.abs(totals[0] - totals[1]).toLocaleString()}.`}
          </p>
        ) : null}

        {/* Final banner */}
        {done ? (
          <div className="mt-5 flex flex-col items-center rounded-[1.5rem] border border-[#c89a55]/30 bg-[radial-gradient(circle_at_50%_0%,rgba(230,186,115,.18),transparent_60%),rgba(0,0,0,.4)] px-4 py-5 text-center">
            {winnerIndex === -1 ? (
              <>
                <p className="font-serif text-2xl text-white">Tie</p>
                <p className="mt-1 text-xs text-zinc-400">Each keeps their own.</p>
              </>
            ) : (
              <>
                <span className="text-2xl" aria-hidden="true">👑</span>
                <Avatar name={sides[winnerIndex].name} ring="#34d399" size={72} src={sides[winnerIndex].avatar} />
                <p className="mt-3 font-serif text-2xl text-white">
                  {sides[winnerIndex].isMe ? "You win" : `${sides[winnerIndex].name} wins`}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {totals[winnerIndex].toLocaleString()} vs {totals[1 - winnerIndex].toLocaleString()}
                </p>
              </>
            )}
            <button
              className="mt-4 rounded-xl bg-[linear-gradient(100deg,#e6ba73,#c89a55)] px-8 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#1a1008]"
              onClick={onClose}
              type="button"
            >
              Done
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
