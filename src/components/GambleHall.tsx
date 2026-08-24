"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { emitSoundEvent } from "@/lib/sound";
import {
  CRAWL_LANES,
  crashMultiplierAt,
  DOUBLE_OR_NOTHING_CHANCE,
  GAMBLE_MAX_BET,
  GAMBLE_MIN_BET,
  MINES_GRID,
  MINES_OPTIONS,
  minesMultiplier,
  PLINKO_MULTIPLIERS,
  PLINKO_ROWS,
  ROULETTE_RINGS,
  SLOT_SYMBOLS,
} from "@/lib/gamble";

// The Gamble Hall. Seven tables stacked in one column, one shared bet, one
// shared rule printed everywhere: the edge is announced, never hidden. Every
// outcome arrives from the server before its animation starts - each table is
// a renderer that lands on a result it already knows.

type HallProps = { disabled?: boolean; onProfile?: (profile: unknown) => void };

const BET_CHIPS = [100, 250, 500, 1_000, 2_500, 5_000];

async function callGamble(body: Record<string, unknown>) {
  const response = await fetch("/api/user/gamble", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) throw new Error((payload?.error as string) ?? "The table refused.");
  return payload ?? {};
}

// --------------------------------------------------------- double or nothing
function DoubleBanner({
  onDone,
  onProfile,
  payout,
  roundId,
}: {
  onDone: () => void;
  onProfile?: (profile: unknown) => void;
  payout: number;
  roundId: string;
}) {
  const [state, setState] = useState<"idle" | "pending" | "won" | "lost">("idle");

  const play = async () => {
    setState("pending");
    try {
      const result = await callGamble({ action: "double", roundId });
      if (result.profile && onProfile) onProfile(result.profile);
      setState(result.won ? "won" : "lost");
      emitSoundEvent(result.won ? "task_completion" : "task_fail");
    } catch {
      setState("idle");
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-[#c89a55]/25 bg-black/40 p-3 text-center">
      {state === "idle" || state === "pending" ? (
        <>
          <button
            className="w-full rounded-xl bg-[linear-gradient(100deg,#a02c0c,#f0821e)] px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white disabled:opacity-50"
            disabled={state === "pending"}
            onClick={() => void play()}
            type="button"
          >
            {state === "pending" ? "Flipping..." : `Double it — ${Math.round(DOUBLE_OR_NOTHING_CHANCE * 100)}%. She keeps the rest.`}
          </button>
          <button className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-300" onClick={onDone} type="button">
            Keep {payout.toLocaleString()}
          </button>
        </>
      ) : (
        <p className={`text-sm font-black ${state === "won" ? "text-emerald-200" : "text-rose-200"}`}>
          {state === "won" ? `Doubled. +${(payout * 2).toLocaleString()} total.` : "Gone. She thanks you."}
        </p>
      )}
    </div>
  );
}

type WinState = { payout: number; roundId: string } | null;
type Line = { text: string; tone: "win" | "lose" | "info" } | null;

function ResultLine({ text, tone }: { text: string; tone: "win" | "lose" | "info" }) {
  return (
    <p className={`mt-3 text-center text-sm font-black ${tone === "win" ? "text-emerald-200" : tone === "lose" ? "text-rose-200" : "text-zinc-400"}`}>
      {text}
    </p>
  );
}

// ------------------------------------------------------------------ Her Reels
// A real slot spin: each reel is a vertical strip of symbols sliding past a
// window and decelerating onto the known result, stops staggered left to
// right. The strip's last cell IS the server's symbol.
const REEL_CELL = 80;
const REEL_DURATIONS = [1_050, 1_500, 1_950];

function SlotReel({ duration, spinKey, strip }: { duration: number; spinKey: number; strip: number[] }) {
  const innerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = innerRef.current;
    if (!node || strip.length <= 1) return;
    // Reset to the top instantly, force a reflow, then let the transition
    // carry the strip down onto its final cell.
    node.style.transition = "none";
    node.style.transform = "translateY(0)";
    void node.offsetHeight;
    node.style.transition = `transform ${duration}ms cubic-bezier(0.16, 0.7, 0.18, 1)`;
    node.style.transform = `translateY(-${(strip.length - 1) * REEL_CELL}px)`;
  }, [duration, spinKey, strip]);

  return (
    <div
      className="overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(180deg,#1c0a14,#090306)]"
      style={{ height: REEL_CELL, width: REEL_CELL }}
    >
      <div ref={innerRef}>
        {strip.map((symbolIndex, cell) => (
          <div className="flex items-center justify-center text-4xl" key={cell} style={{ height: REEL_CELL }}>
            {SLOT_SYMBOLS[symbolIndex].glyph}
          </div>
        ))}
      </div>
    </div>
  );
}

function SlotsTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [reels, setReels] = useState<[number, number, number]>([0, 2, 4]);
  const [phase, setPhase] = useState<"idle" | "waiting" | "sliding">("idle");
  const [strips, setStrips] = useState<number[][] | null>(null);
  const [spinKey, setSpinKey] = useState(0);
  const [line, setLine] = useState<Line>(null);
  const [win, setWin] = useState<WinState>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const captured = timers.current;
    return () => captured.forEach((id) => window.clearTimeout(id));
  }, []);

  const buildStrip = (finalIndex: number, reel: number) => {
    const length = 14 + reel * 4;
    const cells = Array.from({ length }, (_, cell) => (cell * 5 + reel * 2 + finalIndex + 1) % SLOT_SYMBOLS.length);
    cells[length - 1] = finalIndex;
    return cells;
  };

  const play = () =>
    onPlay(async () => {
      setLine(null);
      setWin(null);
      setPhase("waiting");
      emitSoundEvent("crate_reel_tick");
      try {
        const result = await callGamble({ action: "slots", bet });
        if (result.profile && onProfile) onProfile(result.profile);
        const landed = result.reels as [number, number, number];
        setStrips(landed.map((symbolIndex, reel) => buildStrip(symbolIndex, reel)));
        setSpinKey((key) => key + 1);
        setPhase("sliding");
        REEL_DURATIONS.forEach((duration) => {
          timers.current.push(window.setTimeout(() => emitSoundEvent("crate_reel_tick"), duration));
        });
        timers.current.push(
          window.setTimeout(() => {
            setReels(landed);
            setPhase("idle");
            const payout = Number(result.payout) || 0;
            if (payout > 0) {
              setLine({ text: `${result.multiplier}x — +${payout.toLocaleString()} coins`, tone: "win" });
              setWin({ payout, roundId: String(result.roundId) });
              emitSoundEvent("task_completion");
            } else {
              setLine({ text: "Nothing. She smiles.", tone: "lose" });
              emitSoundEvent("task_fail");
            }
          }, REEL_DURATIONS[2] + 80),
        );
      } catch (error) {
        setPhase("idle");
        setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
      }
    });

  const spinning = phase !== "idle";

  return (
    <div>
      <style>{`
        @keyframes vm-reel-loop { from { transform: translateY(0); } to { transform: translateY(-${REEL_CELL * SLOT_SYMBOLS.length}px); } }
      `}</style>
      <div className="mx-auto flex w-fit gap-2 rounded-2xl border border-[#c89a55]/30 bg-black/60 p-3">
        {[0, 1, 2].map((reel) =>
          phase === "waiting" ? (
            // The server hasn't answered yet: free-spin blur until it does.
            <div
              className="overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(180deg,#1c0a14,#090306)]"
              key={reel}
              style={{ height: REEL_CELL, width: REEL_CELL }}
            >
              <div style={{ animation: `vm-reel-loop ${0.42 + reel * 0.06}s linear infinite`, filter: "blur(1.5px)" }}>
                {[...SLOT_SYMBOLS, ...SLOT_SYMBOLS].map((symbol, cell) => (
                  <div className="flex items-center justify-center text-4xl" key={cell} style={{ height: REEL_CELL }}>
                    {symbol.glyph}
                  </div>
                ))}
              </div>
            </div>
          ) : phase === "sliding" && strips ? (
            <SlotReel duration={REEL_DURATIONS[reel]} key={reel} spinKey={spinKey} strip={strips[reel]} />
          ) : (
            <div
              className="flex items-center justify-center rounded-xl border border-white/10 bg-[linear-gradient(180deg,#1c0a14,#090306)] text-4xl"
              key={reel}
              style={{ height: REEL_CELL, width: REEL_CELL }}
            >
              {SLOT_SYMBOLS[reels[reel]].glyph}
            </div>
          ),
        )}
      </div>
      <button className="vm-table-button" disabled={busy || spinning} onClick={play} type="button">
        {spinning ? "Spinning..." : `Pull — ${bet.toLocaleString()} coins`}
      </button>
      {line ? <ResultLine {...line} /> : null}
      {win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}
    </div>
  );
}

// ------------------------------------------------------------------- Her Dice
// The dice tumble (faces cycling fast), then land one side at a time: yours
// first, hers a beat later. The landed faces are the server's rolls.
function DiceTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [shown, setShown] = useState<{ hers: [number, number]; mine: [number, number] }>({ hers: [1, 1], mine: [1, 1] });
  const [locked, setLocked] = useState<{ hers: boolean; mine: boolean }>({ hers: true, mine: true });
  const [rolling, setRolling] = useState(false);
  const [line, setLine] = useState<Line>(null);
  const [win, setWin] = useState<WinState>(null);
  const timers = useRef<number[]>([]);
  const tumble = useRef<number | null>(null);
  // The tumbling interval outlives its render, so it reads lock state from a
  // ref - the closure would otherwise freeze on stale values.
  const lockedRef = useRef({ hers: true, mine: true });

  useEffect(() => {
    const captured = timers.current;
    return () => {
      captured.forEach((id) => window.clearTimeout(id));
      if (tumble.current !== null) window.clearInterval(tumble.current);
    };
  }, []);

  const lock = (side: "hers" | "mine" | "both", value: boolean) => {
    if (side === "both") {
      lockedRef.current = { hers: value, mine: value };
      setLocked({ hers: value, mine: value });
      return;
    }
    lockedRef.current = { ...lockedRef.current, [side]: value };
    setLocked((current) => ({ ...current, [side]: value }));
  };

  const play = () =>
    onPlay(async () => {
      setLine(null);
      setWin(null);
      setRolling(true);
      lock("both", false);
      const die = () => (1 + Math.floor(Math.random() * 6)) as number;
      tumble.current = window.setInterval(() => {
        setShown((current) => ({
          hers: lockedRef.current.hers ? current.hers : [die(), die()],
          mine: lockedRef.current.mine ? current.mine : [die(), die()],
        }));
      }, 85);
      try {
        const result = await callGamble({ action: "dice", bet });
        if (result.profile && onProfile) onProfile(result.profile);
        const mine = result.mine as [number, number];
        const hers = result.hers as [number, number];
        timers.current.push(
          window.setTimeout(() => {
            setShown((current) => ({ ...current, mine }));
            lock("mine", true);
            emitSoundEvent("crate_reel_tick");
          }, 800),
        );
        timers.current.push(
          window.setTimeout(() => {
            if (tumble.current !== null) window.clearInterval(tumble.current);
            tumble.current = null;
            setShown({ hers, mine });
            lock("both", true);
            emitSoundEvent("crate_reel_tick");
          }, 1_350),
        );
        timers.current.push(
          window.setTimeout(() => {
            setRolling(false);
            const payout = Number(result.payout) || 0;
            if (result.win) {
              setLine({ text: `You rolled higher. +${payout.toLocaleString()} coins`, tone: "win" });
              setWin({ payout, roundId: String(result.roundId) });
              emitSoundEvent("task_completion");
            } else {
              const tie = mine[0] + mine[1] === hers[0] + hers[1];
              setLine({ text: tie ? "A tie. Ties are hers." : "She rolled higher.", tone: "lose" });
              emitSoundEvent("task_fail");
            }
          }, 1_500),
        );
      } catch (error) {
        if (tumble.current !== null) window.clearInterval(tumble.current);
        tumble.current = null;
        setRolling(false);
        lock("both", true);
        setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
      }
    });

  const face = (value: number) => ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][value] ?? "?";

  return (
    <div>
      <div className="mx-auto grid w-fit grid-cols-2 gap-8">
        {(["mine", "hers"] as const).map((side) => {
          const settled = locked[side] && !rolling;
          const sum = shown[side][0] + shown[side][1];
          return (
            <div className="text-center" key={side}>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">{side === "mine" ? "Yours" : "Hers"}</p>
              <div className={`mt-2 flex justify-center gap-2 text-5xl ${side === "hers" ? "text-pink-200" : "text-[#ffe2ad]"}`}>
                {[0, 1].map((index) => (
                  <span
                    className={locked[side] ? "" : "opacity-80 blur-[1px]"}
                    key={index}
                    style={locked[side] && rolling ? { animation: "vm-die-land 0.28s ease-out" } : undefined}
                  >
                    {face(shown[side][index])}
                  </span>
                ))}
              </div>
              <p className={`mt-1 text-xs font-black tabular-nums ${settled ? "text-zinc-400" : "text-transparent"}`}>= {sum}</p>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes vm-die-land { 0% { transform: scale(1.35); } 100% { transform: scale(1); } }
      `}</style>
      <p className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-[#c89a55]/60">Ties are hers. That is the whole edge.</p>
      <button className="vm-table-button" disabled={busy || rolling} onClick={play} type="button">
        {rolling ? "Rolling..." : `Roll — ${bet.toLocaleString()} coins`}
      </button>
      {line ? <ResultLine {...line} /> : null}
      {win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}
    </div>
  );
}

// ------------------------------------------------------------- Court Roulette
// A classic wheel: 24 slices, the gold ones are your ring, and the wheel
// spins under a fixed pointer until it dies on a slice that matches the
// server's verdict. Which gold slice is theatre; win or lose is not.
const ROULETTE_SEGMENTS = 24;
const RING_SEGMENT_COUNTS: Record<string, number> = { inner: 3, middle: 7, outer: 14 };

function rouletteWinSet(ringId: string) {
  const count = RING_SEGMENT_COUNTS[ringId] ?? 12;
  const set = new Set<number>();
  for (let index = 0; index < count; index += 1) {
    set.add(Math.round((index * ROULETTE_SEGMENTS) / count) % ROULETTE_SEGMENTS);
  }
  return set;
}

function RouletteTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [ring, setRing] = useState<string>("outer");
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [line, setLine] = useState<Line>(null);
  const [win, setWin] = useState<WinState>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const captured = timers.current;
    return () => captured.forEach((id) => window.clearTimeout(id));
  }, []);

  const winSet = rouletteWinSet(ring);
  const gradientStops: string[] = [];
  for (let index = 0; index < ROULETTE_SEGMENTS; index += 1) {
    const color = winSet.has(index) ? "#c89a55" : index % 2 ? "#170912" : "#26121e";
    gradientStops.push(`${color} ${index * 15}deg ${(index + 1) * 15}deg`);
  }

  const play = () =>
    onPlay(async () => {
      setLine(null);
      setWin(null);
      setSpinning(true);
      try {
        const result = await callGamble({ action: "roulette", bet, ring });
        if (result.profile && onProfile) onProfile(result.profile);
        const pool = Array.from({ length: ROULETTE_SEGMENTS }, (_, index) => index).filter((index) =>
          result.win ? winSet.has(index) : !winSet.has(index),
        );
        const target = pool[Math.floor(Math.random() * pool.length)];
        const targetAngle = target * 15 + 7.5;
        setRotation((previous) => {
          const delta = (((-targetAngle - previous) % 360) + 360) % 360;
          return previous + 4 * 360 + delta;
        });
        emitSoundEvent("crate_reel_tick");
        timers.current.push(
          window.setTimeout(() => {
            setSpinning(false);
            const payout = Number(result.payout) || 0;
            if (result.win) {
              setLine({ text: `The ball died on your ring. +${payout.toLocaleString()} coins`, tone: "win" });
              setWin({ payout, roundId: String(result.roundId) });
              emitSoundEvent("task_completion");
            } else {
              setLine({ text: "The ball died on her side. She keeps it.", tone: "lose" });
              emitSoundEvent("task_fail");
            }
          }, 3_400),
        );
      } catch (error) {
        setSpinning(false);
        setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
      }
    });

  return (
    <div>
      <div className="relative mx-auto h-56 w-56">
        {/* Fixed pointer */}
        <div className="absolute -top-0.5 left-1/2 z-10 -translate-x-1/2">
          <div className="mx-auto h-0 w-0 border-x-[7px] border-t-[12px] border-x-transparent border-t-[#ffe2ad] drop-shadow-[0_0_4px_rgba(230,186,115,.8)]" />
        </div>
        {/* Wheel */}
        <div
          className="h-full w-full rounded-full border-4 border-[#c89a55]/40 shadow-[inset_0_0_24px_rgba(0,0,0,.7)]"
          style={{
            background: `conic-gradient(from 0deg, ${gradientStops.join(",")})`,
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? "transform 3300ms cubic-bezier(0.12, 0.62, 0.1, 1)" : "none",
          }}
        />
        {/* Hub */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#c89a55]/40 bg-[#0b0409] text-2xl shadow-[0_0_18px_rgba(0,0,0,.8)]">
          👑
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.14em] text-[#c89a55]/60">
        Gold slices are your ring. The pointer decides.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ROULETTE_RINGS.map((entry) => (
          <button
            className={`rounded-xl border px-2 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition disabled:opacity-50 ${ring === entry.id ? "border-[#e6ba73]/60 bg-[#c89a55]/15 text-[#ffe2ad]" : "border-white/10 bg-black/30 text-zinc-500 hover:text-zinc-300"}`}
            disabled={spinning}
            key={entry.id}
            onClick={() => setRing(entry.id)}
            type="button"
          >
            {entry.label}
            <span className="block text-zinc-500">{entry.multiplier}x · {Math.round(entry.winChance * 100)}%</span>
          </button>
        ))}
      </div>
      <button className="vm-table-button" disabled={busy || spinning} onClick={play} type="button">
        {spinning ? "The wheel is turning..." : `Spin — ${bet.toLocaleString()} coins`}
      </button>
      {line ? <ResultLine {...line} /> : null}
      {win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}
    </div>
  );
}

// --------------------------------------------------------------------- Plinko
// Board and buckets share one container, so a step on the board is exactly
// half a bucket wide and the ball lands where the highlight lights up.
const PLINKO_BUCKET_W = 100 / PLINKO_MULTIPLIERS.length;

function PlinkoTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [ball, setBall] = useState<{ step: number; x: number } | null>(null);
  const [landed, setLanded] = useState<number | null>(null);
  const [line, setLine] = useState<Line>(null);
  const [win, setWin] = useState<WinState>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const captured = timers.current;
    return () => captured.forEach((id) => window.clearTimeout(id));
  }, []);

  const play = () =>
    onPlay(async () => {
      setLine(null);
      setWin(null);
      setLanded(null);
      try {
        const result = await callGamble({ action: "plinko", bet });
        if (result.profile && onProfile) onProfile(result.profile);
        const path = result.path as number[];
        setBall({ step: 0, x: 0 });
        let x = 0;
        path.forEach((step, row) => {
          timers.current.push(
            window.setTimeout(() => {
              x += step === 1 ? 1 : -1;
              setBall({ step: row + 1, x });
              emitSoundEvent("crate_reel_tick");
            }, 170 * (row + 1)),
          );
        });
        timers.current.push(
          window.setTimeout(() => {
            setBall(null);
            setLanded(Number(result.bucket));
            const payout = Number(result.payout) || 0;
            if (payout > bet) {
              setLine({ text: `${result.multiplier}x — +${payout.toLocaleString()} coins`, tone: "win" });
              setWin({ payout, roundId: String(result.roundId) });
              emitSoundEvent("task_completion");
            } else if (payout > 0) {
              setLine({ text: `${result.multiplier}x — ${payout.toLocaleString()} back. The centre grinds.`, tone: "lose" });
            } else {
              setLine({ text: "Swallowed whole.", tone: "lose" });
              emitSoundEvent("task_fail");
            }
          }, 170 * (path.length + 1) + 180),
        );
      } catch (error) {
        setBall(null);
        setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
      }
    });

  return (
    <div>
      <div className="mx-auto w-full max-w-xl">
        <div className="relative h-64 w-full overflow-hidden rounded-t-2xl border border-b-0 border-white/10 bg-black/40">
          {Array.from({ length: PLINKO_ROWS }, (_, row) =>
            Array.from({ length: row + 2 }, (_, peg) => (
              <span
                className="absolute h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/25"
                key={`${row}-${peg}`}
                style={{
                  left: `${50 + (peg - (row + 1) / 2) * PLINKO_BUCKET_W}%`,
                  top: `${((row + 0.5) / PLINKO_ROWS) * 92}%`,
                }}
              />
            )),
          )}
          {ball ? (
            <span
              className="absolute h-3 w-3 -translate-x-1/2 rounded-full bg-[#ffe2ad] shadow-[0_0_10px_rgba(230,186,115,.9)] transition-all duration-150 ease-in"
              style={{
                left: `${50 + (ball.x * PLINKO_BUCKET_W) / 2}%`,
                top: `${(ball.step / PLINKO_ROWS) * 92}%`,
              }}
            />
          ) : null}
        </div>
        <div className="flex rounded-b-2xl border border-t-0 border-white/10 bg-black/40 pb-1 text-center">
          {PLINKO_MULTIPLIERS.map((multiplier, index) => (
            <span
              className={`flex-1 rounded px-0.5 py-1.5 text-[9px] font-black tabular-nums ${landed === index ? "bg-[#c89a55]/40 text-[#ffe2ad] shadow-[0_0_10px_rgba(230,186,115,.4)]" : multiplier >= 4 ? "text-emerald-200/70" : "text-zinc-600"}`}
              key={index}
            >
              {multiplier}x
            </span>
          ))}
        </div>
      </div>
      <button className="vm-table-button" disabled={busy || ball !== null} onClick={play} type="button">
        {ball !== null ? "Falling..." : `Drop — ${bet.toLocaleString()} coins`}
      </button>
      {line ? <ResultLine {...line} /> : null}
      {win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}
    </div>
  );
}

// -------------------------------------------------------------- Jewelry Box
function MinesTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [mineCount, setMineCount] = useState<number>(MINES_OPTIONS[0]);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [picks, setPicks] = useState<number[]>([]);
  const [mines, setMines] = useState<number[]>([]);
  const [bustCell, setBustCell] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [line, setLine] = useState<Line>(null);
  const [win, setWin] = useState<WinState>(null);

  const reset = () => {
    setRoundId(null);
    setPicks([]);
    setMines([]);
    setBustCell(null);
  };

  const open = () =>
    onPlay(async () => {
      setLine(null);
      setWin(null);
      reset();
      setPending(true);
      try {
        const result = await callGamble({ action: "mines-open", bet, mines: mineCount });
        if (result.profile && onProfile) onProfile(result.profile);
        setRoundId(String(result.roundId));
      } catch (error) {
        setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
      } finally {
        setPending(false);
      }
    });

  const pick = async (cell: number) => {
    if (!roundId || pending || picks.includes(cell)) return;
    setPending(true);
    try {
      const result = await callGamble({ action: "mines-pick", cell, roundId });
      if (result.bust) {
        setMines(result.mines as number[]);
        setBustCell(cell);
        setRoundId(null);
        setLine({ text: "A mine. Everything on the table is hers.", tone: "lose" });
        emitSoundEvent("task_fail");
      } else {
        setPicks(result.picks as number[]);
        emitSoundEvent("button_click");
      }
    } catch (error) {
      setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
    } finally {
      setPending(false);
    }
  };

  const cashout = async () => {
    if (!roundId || pending || picks.length === 0) return;
    setPending(true);
    try {
      const result = await callGamble({ action: "mines-cashout", roundId });
      if (result.profile && onProfile) onProfile(result.profile);
      const payout = Number(result.payout) || 0;
      setLine({ text: `${result.multiplier}x — +${payout.toLocaleString()} coins`, tone: "win" });
      setWin({ payout, roundId });
      setRoundId(null);
      emitSoundEvent("task_completion");
    } catch (error) {
      setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
    } finally {
      setPending(false);
    }
  };

  const currentMultiplier = minesMultiplier(mineCount, picks.length);
  const nextMultiplier = minesMultiplier(mineCount, picks.length + 1);

  return (
    <div>
      {!roundId && bustCell === null ? (
        <div className="mb-3 flex justify-center gap-2">
          {MINES_OPTIONS.map((option) => (
            <button
              className={`rounded-xl border px-4 py-2 text-xs font-black transition ${mineCount === option ? "border-[#e6ba73]/60 bg-[#c89a55]/15 text-[#ffe2ad]" : "border-white/10 bg-black/30 text-zinc-500"}`}
              key={option}
              onClick={() => setMineCount(option)}
              type="button"
            >
              {option} mines
            </button>
          ))}
        </div>
      ) : null}

      <div className="mx-auto grid w-fit grid-cols-5 gap-1.5">
        {Array.from({ length: MINES_GRID }, (_, cell) => {
          const revealedSafe = picks.includes(cell);
          const revealedMine = mines.includes(cell);
          return (
            <button
              className={`h-11 w-11 rounded-lg border text-lg transition ${
                revealedMine
                  ? cell === bustCell
                    ? "border-rose-300/70 bg-rose-600/40"
                    : "border-rose-300/30 bg-rose-950/50"
                  : revealedSafe
                    ? "border-[#e6ba73]/50 bg-[#c89a55]/20"
                    : "border-white/10 bg-black/40 hover:border-pink-200/35"
              }`}
              disabled={!roundId || pending || revealedSafe}
              key={cell}
              onClick={() => void pick(cell)}
              type="button"
            >
              {revealedMine ? "☠" : revealedSafe ? "💎" : ""}
            </button>
          );
        })}
      </div>

      {roundId ? (
        <div className="mt-3 flex items-center justify-center gap-3">
          <span className="text-xs font-black text-[#ffe2ad] tabular-nums">
            {picks.length > 0 ? `${currentMultiplier}x locked` : "Open a box"} · next {nextMultiplier}x
          </span>
          <button
            className="rounded-xl border border-emerald-300/40 bg-emerald-500/15 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-100 disabled:opacity-40"
            disabled={pending || picks.length === 0}
            onClick={() => void cashout()}
            type="button"
          >
            Take {Math.floor(bet * currentMultiplier).toLocaleString()}
          </button>
        </div>
      ) : (
        <button className="vm-table-button" disabled={busy || pending} onClick={open} type="button">
          {`Buy in — ${bet.toLocaleString()} coins`}
        </button>
      )}
      {line ? <ResultLine {...line} /> : null}
      {win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}
    </div>
  );
}

// --------------------------------------------------------------- Her Patience
// The climb is a pure function of server time, and the client now polls the
// server while the round runs: the moment her patience actually runs out the
// display stops AT the crash point. What you see is always what happened -
// including the 1.00x instant busts.
function CrashTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [roundId, setRoundId] = useState<string | null>(null);
  const [display, setDisplay] = useState(1);
  const [crashed, setCrashed] = useState(false);
  const [line, setLine] = useState<Line>(null);
  const [win, setWin] = useState<WinState>(null);
  const startedAt = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const poll = useRef<number | null>(null);
  const pollBusy = useRef(false);

  const stopLoops = () => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    frame.current = null;
    if (poll.current !== null) window.clearInterval(poll.current);
    poll.current = null;
    startedAt.current = null;
  };

  useEffect(() => stopLoops, []);

  const bust = useCallback((crashPoint: number) => {
    stopLoops();
    setRoundId(null);
    setDisplay(crashPoint);
    setCrashed(true);
    setLine({ text: `Too slow. Her patience ran out at ${crashPoint.toFixed(2)}x.`, tone: "lose" });
    emitSoundEvent("task_fail");
  }, []);

  const open = () =>
    onPlay(async () => {
      setLine(null);
      setWin(null);
      setCrashed(false);
      try {
        const result = await callGamble({ action: "crash-open", bet });
        if (result.profile && onProfile) onProfile(result.profile);
        const id = String(result.roundId);
        setRoundId(id);
        startedAt.current = Date.now() - (Number(result.elapsedMs) || 0);
        setDisplay(1);
        const tick = () => {
          if (startedAt.current === null) return;
          setDisplay(crashMultiplierAt(Date.now() - startedAt.current));
          frame.current = window.requestAnimationFrame(tick);
        };
        frame.current = window.requestAnimationFrame(tick);
        // The crash point lives on the server; polling is the only honest way
        // for the display to learn the round already died.
        poll.current = window.setInterval(() => {
          if (pollBusy.current) return;
          pollBusy.current = true;
          callGamble({ action: "crash-status", roundId: id })
            .then((status) => {
              if (status.crashed) bust(Number(status.crashPoint) || 1);
              else if (typeof status.elapsedMs === "number") startedAt.current = Date.now() - status.elapsedMs;
            })
            .catch(() => undefined)
            .finally(() => {
              pollBusy.current = false;
            });
        }, 650);
      } catch (error) {
        setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
      }
    });

  const cashout = async () => {
    if (!roundId) return;
    const id = roundId;
    stopLoops();
    setRoundId(null);
    try {
      const result = await callGamble({ action: "crash-cashout", roundId: id });
      if (result.profile && onProfile) onProfile(result.profile);
      const payout = Number(result.payout) || 0;
      if (result.survived) {
        setDisplay(Number(result.multiplier) || 1);
        setLine({ text: `Out at ${result.multiplier}x — +${payout.toLocaleString()} coins. She crashed at ${result.crashPoint}x.`, tone: "win" });
        setWin({ payout, roundId: id });
        emitSoundEvent("task_completion");
      } else {
        bust(Number(result.crashPoint) || 1);
      }
    } catch (error) {
      setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
    }
  };

  return (
    <div>
      <div className={`mx-auto flex h-32 w-full max-w-sm items-center justify-center rounded-2xl border bg-black/50 ${roundId ? "border-[#f0821e]/40" : crashed ? "border-rose-400/40" : "border-white/10"}`}>
        <span className={`font-serif text-6xl tabular-nums ${roundId ? "text-[#ffe2ad]" : crashed ? "text-rose-300" : "text-zinc-700"}`}>
          {display.toFixed(2)}x
        </span>
      </div>
      <p className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-[#c89a55]/60">
        Cash out before her patience runs out. It can run out at 1.00x.
      </p>
      {roundId ? (
        <button
          className="vm-table-button !border-emerald-300/40 !bg-emerald-500/15 !text-emerald-100"
          onClick={() => void cashout()}
          type="button"
        >
          Cash out at {display.toFixed(2)}x
        </button>
      ) : (
        <button className="vm-table-button" disabled={busy} onClick={open} type="button">
          {`Test her — ${bet.toLocaleString()} coins`}
        </button>
      )}
      {line ? <ResultLine {...line} /> : null}
      {win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}
    </div>
  );
}

// ------------------------------------------------------------------ The Crawl
// A requestAnimationFrame race: each lane gets a finish time (the winner's is
// shortest) and a lurch pattern, and progress is a smooth function of time
// instead of eight visible jumps. The winner already exists server-side.
function CrawlTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [raceId, setRaceId] = useState<string | null>(null);
  const [odds, setOdds] = useState<number[] | null>(null);
  const [lane, setLane] = useState<number | null>(null);
  const [progress, setProgress] = useState<number[]>([0, 0, 0, 0]);
  const [racing, setRacing] = useState(false);
  const [line, setLine] = useState<Line>(null);
  const [win, setWin] = useState<WinState>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, []);

  const draw = () =>
    onPlay(async () => {
      setLine(null);
      setWin(null);
      setLane(null);
      setProgress([0, 0, 0, 0]);
      try {
        const result = await callGamble({ action: "crawl-race" });
        setRaceId(String(result.raceId));
        setOdds(result.odds as number[]);
      } catch (error) {
        setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
      }
    });

  const runRace = (winner: number, payout: number, roundId: string, won: boolean) => {
    setRacing(true);
    const finishes = [0, 1, 2, 3].map((index) =>
      index === winner ? 5_200 + Math.random() * 500 : 6_100 + Math.random() * 2_400,
    );
    const phases = [0, 1, 2, 3].map(() => Math.random() * Math.PI * 2);
    const freqs = [0, 1, 2, 3].map(() => 1.4 + Math.random() * 1.6);
    const winnerFinish = finishes[winner];

    // The first animation frame's timestamp is the race clock's zero.
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const t = now - start;
      setProgress(
        [0, 1, 2, 3].map((index) => {
          const base = Math.min(1, t / finishes[index]);
          // Lurching crawl: the wobble only ever holds a pet back, never
          // pushes it past its schedule, so the winner still wins on time.
          const lurch = Math.max(0, Math.sin((t / 1_000) * freqs[index] + phases[index])) * 0.035 * (1 - base);
          return Math.max(0, Math.min(100, (base - lurch) * 100));
        }),
      );
      if (t < winnerFinish + 250) {
        frame.current = window.requestAnimationFrame(tick);
        return;
      }
      setProgress((current) => current.map((value, index) => (index === winner ? 100 : Math.min(value, 96))));
      setRacing(false);
      if (won) {
        setLine({ text: `${CRAWL_LANES[winner].label} reached her first. +${payout.toLocaleString()} coins`, tone: "win" });
        setWin({ payout, roundId });
        emitSoundEvent("task_completion");
      } else {
        setLine({ text: `${CRAWL_LANES[winner].label} reached her first. Yours crawled for nothing.`, tone: "lose" });
        emitSoundEvent("task_fail");
      }
    };
    frame.current = window.requestAnimationFrame(tick);
  };

  const placeBet = async (laneIndex: number) => {
    if (!raceId || racing) return;
    setLane(laneIndex);
    try {
      const result = await callGamble({ action: "crawl-bet", bet, lane: laneIndex, roundId: raceId });
      if (result.profile && onProfile) onProfile(result.profile);
      setRaceId(null);
      runRace(Number(result.winner), Number(result.payout) || 0, String(result.roundId), result.win === true);
    } catch (error) {
      setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
    }
  };

  return (
    <div>
      <div className="grid gap-1.5">
        {CRAWL_LANES.map((entry, index) => (
          <div className="flex items-center gap-2" key={entry.id}>
            <button
              className={`w-32 shrink-0 rounded-lg border px-2 py-1.5 text-left text-[10px] font-black transition disabled:cursor-not-allowed ${lane === index ? "border-[#e6ba73]/60 bg-[#c89a55]/15" : "border-white/10 bg-black/30 hover:border-white/30"}`}
              disabled={!raceId || racing || busy}
              onClick={() => void placeBet(index)}
              style={{ color: entry.color }}
              type="button"
            >
              {entry.label}
              {odds ? <span className="block text-zinc-500">{odds[index]}x</span> : null}
            </button>
            <div className="relative h-5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/40">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: `${entry.color}55`, width: `${progress[index]}%` }}
              />
              <span className="absolute top-1/2 -translate-y-1/2 text-xs" style={{ left: `calc(${progress[index]}% - 8px)` }}>
                🐩
              </span>
            </div>
            <span className="shrink-0 text-sm">👑</span>
          </div>
        ))}
      </div>
      {!raceId && !racing ? (
        <button className="vm-table-button" disabled={busy} onClick={draw} type="button">
          Draw a race sheet
        </button>
      ) : raceId ? (
        <p className="mt-3 text-center text-[10px] font-black uppercase tracking-[0.16em] text-[#c89a55]/60">
          Odds are pinned. Pick a collar to bet {bet.toLocaleString()} coins.
        </p>
      ) : null}
      {line ? <ResultLine {...line} /> : null}
      {win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}
    </div>
  );
}

type TableProps = {
  bet: number;
  busy: boolean;
  onPlay: (run: () => Promise<void>) => void;
  onProfile?: (profile: unknown) => void;
};

// ---------------------------------------------------------------------- hall
type TableTone = "amber" | "cyan" | "emerald" | "pink" | "rose" | "violet";
type TableId = "slots" | "dice" | "roulette" | "plinko" | "mines" | "crash" | "crawl";
type TablePresentation = {
  art: string;
  blurb: string;
  edge: string;
  id: TableId;
  kicker: string;
  objectPosition: string;
  symbol: string;
  tag: string;
  title: string;
  tone: TableTone;
};

const TABLE_PRESENTATIONS: readonly TablePresentation[] = [
  { art: "/gamble/principessa-reels-dice.webp", blurb: "Three reels. Pairs pay small, her portrait pays 180x.", edge: "House keeps ~12%", id: "slots", kicker: "The curtain rises", objectPosition: "68% center", symbol: "🎰", tag: "Popular", title: "Her Reels", tone: "pink" },
  { art: "/gamble/principessa-reels-dice.webp", blurb: "Two dice each. Higher sum takes the round.", edge: "Ties are hers", id: "dice", kicker: "Challenge her", objectPosition: "22% center", symbol: "🎲", tag: "Hot", title: "Her Dice", tone: "violet" },
  { art: "/gamble/principessa-risk-table.webp", blurb: "Pick a ring. Gold slices are yours if she allows it.", edge: "House keeps 10%", id: "roulette", kicker: "Pick a ring", objectPosition: "42% 68%", symbol: "◎", tag: "Classic", title: "Court Roulette", tone: "amber" },
  { art: "/gamble/principessa-risk-table.webp", blurb: "Twelve rows of pegs. The rim pays; the centre grinds.", edge: "House keeps ~10%", id: "plinko", kicker: "Drop for her", objectPosition: "18% 70%", symbol: "◆", tag: "Live", title: "Royal Plinko", tone: "cyan" },
  { art: "/gamble/principessa-risk-table.webp", blurb: "Open her jewelry box and leave before you find a trap.", edge: "5% per box", id: "mines", kicker: "Take what you dare", objectPosition: "76% center", symbol: "💎", tag: "Risk", title: "The Jewelry Box", tone: "emerald" },
  { art: "/gamble/principessa-casino-hero.webp", blurb: "The multiplier climbs until her patience runs out.", edge: "House keeps 6%", id: "crash", kicker: "Test her patience", objectPosition: "68% center", symbol: "♥", tag: "Push", title: "Her Patience", tone: "rose" },
  { art: "/gamble/principessa-casino-hero.webp", blurb: "Four collared pets crawl toward the throne. Back one.", edge: "House keeps 10%", id: "crawl", kicker: "The court watches", objectPosition: "91% center", symbol: "♛", tag: "Court", title: "The Crawl", tone: "violet" },
] as const;

function TableCard({
  children,
  game,
}: {
  children: React.ReactNode;
  game: TablePresentation;
}) {
  const toneClasses = {
    amber: "border-amber-300/25 bg-[radial-gradient(circle_at_100%_0%,rgba(245,158,11,.19),transparent_34%),linear-gradient(145deg,rgba(42,20,7,.82),rgba(10,5,10,.94))] shadow-[0_18px_55px_rgba(245,158,11,.08)]",
    cyan: "border-cyan-300/25 bg-[radial-gradient(circle_at_100%_0%,rgba(34,211,238,.17),transparent_34%),linear-gradient(145deg,rgba(4,27,35,.82),rgba(8,5,14,.94))] shadow-[0_18px_55px_rgba(34,211,238,.08)]",
    emerald: "border-emerald-300/25 bg-[radial-gradient(circle_at_100%_0%,rgba(16,185,129,.18),transparent_34%),linear-gradient(145deg,rgba(4,31,24,.82),rgba(8,5,13,.94))] shadow-[0_18px_55px_rgba(16,185,129,.08)]",
    pink: "border-pink-300/25 bg-[radial-gradient(circle_at_100%_0%,rgba(236,72,153,.22),transparent_34%),linear-gradient(145deg,rgba(48,8,31,.82),rgba(10,5,13,.94))] shadow-[0_18px_55px_rgba(236,72,153,.1)]",
    rose: "border-rose-300/25 bg-[radial-gradient(circle_at_100%_0%,rgba(244,63,94,.2),transparent_34%),linear-gradient(145deg,rgba(48,8,18,.82),rgba(10,5,11,.94))] shadow-[0_18px_55px_rgba(244,63,94,.09)]",
    violet: "border-violet-300/25 bg-[radial-gradient(circle_at_100%_0%,rgba(139,92,246,.22),transparent_34%),linear-gradient(145deg,rgba(27,10,49,.84),rgba(8,5,13,.94))] shadow-[0_18px_55px_rgba(139,92,246,.1)]",
  } as const;
  return (
    <div className={`relative overflow-hidden rounded-[1.85rem] border ${toneClasses[game.tone]}`}>
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
      <div className="relative h-52 overflow-hidden border-b border-white/10 sm:h-60">
        <Image
          alt={`${game.title} hosted by Principessa`}
          className="object-cover transition duration-700"
          fill
          quality={75}
          sizes="(min-width: 1280px) 60vw, (min-width: 768px) 80vw, 100vw"
          src={game.art}
          style={{ objectPosition: game.objectPosition }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,2,8,.96),rgba(7,2,9,.62)_44%,rgba(7,2,9,.08)_78%),linear-gradient(0deg,rgba(5,2,8,.9),transparent_62%)]" />
        <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3 sm:inset-x-7">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[.3em] text-pink-200/75">{game.kicker}</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-black/45 text-xl backdrop-blur">{game.symbol}</span>
              <div>
                <h3 className="font-serif text-2xl font-semibold text-white sm:text-3xl">{game.title}</h3>
                <p className="mt-1 max-w-xl text-xs leading-5 text-white/55">{game.blurb}</p>
              </div>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-[#ffd68a]/30 bg-black/55 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#ffe2ad] backdrop-blur">
            {game.edge}
          </span>
        </div>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

export function GambleHall({ disabled = false, onProfile }: HallProps) {
  const [bet, setBet] = useState(250);
  const [busy, setBusy] = useState(false);
  const [activeTable, setActiveTable] = useState<TableId>("slots");

  const onPlay = useCallback(
    (run: () => Promise<void>) => {
      if (disabled || busy) return;
      setBusy(true);
      void run().finally(() => setBusy(false));
    },
    [busy, disabled],
  );

  const tableProps: TableProps = { bet, busy: busy || disabled, onPlay, onProfile };
  const activeGame = TABLE_PRESENTATIONS.find((game) => game.id === activeTable) ?? TABLE_PRESENTATIONS[0];

  const renderActiveTable = () => {
    switch (activeTable) {
      case "dice": return <DiceTable {...tableProps} />;
      case "roulette": return <RouletteTable {...tableProps} />;
      case "plinko": return <PlinkoTable {...tableProps} />;
      case "mines": return <MinesTable {...tableProps} />;
      case "crash": return <CrashTable {...tableProps} />;
      case "crawl": return <CrawlTable {...tableProps} />;
      case "slots":
      default: return <SlotsTable {...tableProps} />;
    }
  };

  return (
    <section className="relative min-w-0 overflow-hidden rounded-[2rem] border border-pink-300/30 bg-[radial-gradient(circle_at_10%_0%,rgba(255,28,151,.34),transparent_30%),radial-gradient(circle_at_92%_8%,rgba(124,58,237,.28),transparent_28%),linear-gradient(145deg,rgba(27,5,25,.98),rgba(5,2,10,.98))] p-5 shadow-[0_26px_90px_rgba(104,8,78,.3)] sm:p-6">
      <style>{`
        .vm-table-button {
          margin-top: 0.9rem; display: block; width: 100%; border-radius: 1rem;
          border: 1px solid rgba(244,194,255,.3); background: linear-gradient(100deg,rgba(219,39,119,.24),rgba(124,58,237,.2));
          padding: 0.8rem 1rem; font-size: .875rem; font-weight: 900; color: #fce7f3;
          text-transform: none; transition: background .15s, border-color .15s;
        }
        .vm-table-button:enabled:hover { background: linear-gradient(100deg,rgba(236,72,153,.4),rgba(124,58,237,.34)); border-color: rgba(244,194,255,.62); box-shadow: 0 0 26px rgba(236,72,153,.18); }
        .vm-table-button:disabled { opacity: .45; cursor: not-allowed; }
        @media (prefers-reduced-motion: reduce) {
          .vm-table-button { transition: none; }
        }
      `}</style>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.32em] text-pink-200/70">The hall is rigged. It says so.</p>
          <h2 className="mt-1 font-serif text-4xl font-semibold text-white [text-shadow:0_0_28px_rgba(236,72,153,.3)]">Gamble Hall</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-pink-50/55">
            Coins in, coins out, and every table prints her cut before you play. There is no daily loss ceiling.
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[.28em] text-pink-100/65">Choose tonight&apos;s table</p>
        <p className="text-[9px] font-black uppercase tracking-[.18em] text-white/30">7 games · one shared stake</p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TABLE_PRESENTATIONS.map((game, index) => {
          const selected = activeTable === game.id;
          return (
            <button
              aria-pressed={selected}
              className={`group relative h-56 overflow-hidden rounded-[1.45rem] border text-left transition duration-300 ${index === 0 ? "sm:col-span-2 xl:col-span-2" : ""} ${selected ? "border-pink-200/75 shadow-[0_0_0_1px_rgba(244,114,182,.2),0_22px_55px_rgba(219,39,119,.24)]" : "border-white/15 hover:-translate-y-1 hover:border-pink-200/45 hover:shadow-[0_18px_45px_rgba(118,10,82,.22)]"}`}
              key={game.id}
              onClick={() => setActiveTable(game.id)}
              type="button"
            >
              <Image
                alt=""
                aria-hidden
                className="object-cover transition duration-700 group-hover:scale-[1.04]"
                fill
                quality={75}
                sizes={index === 0 ? "(min-width: 1280px) 50vw, (min-width: 640px) 100vw, 100vw" : "(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"}
                src={game.art}
                style={{ objectPosition: game.objectPosition }}
              />
              <span className="absolute inset-0 bg-[linear-gradient(0deg,rgba(5,2,8,.98)_0%,rgba(8,2,11,.72)_38%,rgba(7,2,9,.04)_78%),linear-gradient(90deg,rgba(6,2,8,.52),transparent_68%)]" />
              <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.18em] text-white/80 backdrop-blur">
                {game.tag}
              </span>
              {selected ? (
                <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-pink-200/35 bg-pink-500/20 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.16em] text-pink-50 backdrop-blur">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pink-200" /> On stage
                </span>
              ) : null}
              <span className="absolute inset-x-4 bottom-4">
                <span className="text-[8px] font-black uppercase tracking-[.28em] text-pink-200/70">{game.kicker}</span>
                <span className="mt-1 flex items-end justify-between gap-3">
                  <span>
                    <span className="block font-serif text-2xl font-semibold text-white">{game.title}</span>
                    <span className="mt-1 block text-[10px] font-black uppercase tracking-[.12em] text-[#ffe2ad]/70">{game.edge}</span>
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-pink-200/30 bg-pink-500/15 text-pink-100 transition group-hover:bg-pink-500/30">↘</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 scroll-mt-24" id={`table-${activeTable}`}>
        <TableCard game={activeGame}>
          <div className="sticky top-2 z-20 mb-5 flex flex-wrap items-center gap-1.5 rounded-2xl border border-pink-200/20 bg-[#120712]/90 p-3 shadow-[0_16px_35px_rgba(0,0,0,.28)] backdrop-blur-xl">
            <span className="mr-1 text-[9px] font-black uppercase tracking-[0.2em] text-pink-200/60">Table bet</span>
            {BET_CHIPS.map((chip) => (
              <button
                className={`rounded-full border px-3 py-1.5 text-xs font-black tabular-nums transition ${bet === chip ? "border-pink-200/65 bg-pink-500/25 text-white shadow-[0_0_20px_rgba(236,72,153,.24)]" : "border-white/10 bg-black/30 text-white/45 hover:border-pink-200/30 hover:text-pink-100"}`}
                key={chip}
                onClick={() => setBet(chip)}
                type="button"
              >
                {chip.toLocaleString()}
              </button>
            ))}
            <span className="ml-1 text-[9px] text-zinc-600">
              {GAMBLE_MIN_BET}–{GAMBLE_MAX_BET.toLocaleString()} per round
            </span>
          </div>
          {renderActiveTable()}
        </TableCard>
      </div>
    </section>
  );
}
