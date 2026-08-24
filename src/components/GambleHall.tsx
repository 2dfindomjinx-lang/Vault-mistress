"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { emitSoundEvent } from "@/lib/sound";
import {
  CRAWL_LANES,
  crashMultiplierAt,
  DOUBLE_OR_NOTHING_CHANCE,
  GAMBLE_DAILY_LOSS_CAP,
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

// The Gamble Hall. Seven tables, one shared bet, one shared rule printed
// everywhere: the edge is announced, never hidden. Every outcome arrives from
// the server before its animation starts - each table is a renderer.

type HallProps = { disabled?: boolean; onProfile?: (profile: unknown) => void };

type TableId = "slots" | "dice" | "roulette" | "plinko" | "mines" | "crash" | "crawl";

const TABLES: Array<{ blurb: string; edge: string; id: TableId; title: string }> = [
  { blurb: "Three reels. Pairs pay small, her portrait pays 180x.", edge: "House keeps ~12%", id: "slots", title: "Her Reels" },
  { blurb: "Two dice each, higher sum doubles the bet.", edge: "Ties are hers", id: "dice", title: "Her Dice" },
  { blurb: "Three rings around her. Pick one, the ball answers.", edge: "House keeps 10%", id: "roulette", title: "Court Roulette" },
  { blurb: "Twelve rows of pegs. The rim pays, the centre grinds.", edge: "House keeps ~10%", id: "plinko", title: "Plinko" },
  { blurb: "25 boxes, your choice of mines. Stop while you still can.", edge: "5% per box", id: "mines", title: "The Jewelry Box" },
  { blurb: "The multiplier climbs until her patience runs out.", edge: "House keeps 6%", id: "crash", title: "Her Patience" },
  { blurb: "Four collared pets crawl to her feet. Back one.", edge: "House keeps 10%", id: "crawl", title: "The Crawl" },
];

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

function ResultLine({ text, tone }: { text: string; tone: "win" | "lose" | "info" }) {
  return (
    <p className={`mt-3 text-center text-sm font-black ${tone === "win" ? "text-emerald-200" : tone === "lose" ? "text-rose-200" : "text-zinc-400"}`}>
      {text}
    </p>
  );
}

// -------------------------------------------------------------------- tables
function SlotsTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [reels, setReels] = useState<[number, number, number]>([0, 2, 4]);
  const [spinning, setSpinning] = useState(false);
  const [line, setLine] = useState<{ text: string; tone: "win" | "lose" | "info" } | null>(null);
  const [win, setWin] = useState<WinState>(null);

  const play = () =>
    onPlay(async () => {
      setLine(null);
      setWin(null);
      setSpinning(true);
      emitSoundEvent("crate_reel_tick");
      try {
        const result = await callGamble({ action: "slots", bet });
        if (result.profile && onProfile) onProfile(result.profile);
        window.setTimeout(() => {
          setReels(result.reels as [number, number, number]);
          setSpinning(false);
          const payout = Number(result.payout) || 0;
          if (payout > 0) {
            setLine({ text: `${result.multiplier}x — +${payout.toLocaleString()} coins`, tone: "win" });
            setWin({ payout, roundId: String(result.roundId) });
            emitSoundEvent("task_completion");
          } else {
            setLine({ text: "Nothing. She smiles.", tone: "lose" });
            emitSoundEvent("task_fail");
          }
        }, 1_200);
      } catch (error) {
        setSpinning(false);
        setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
      }
    });

  return (
    <div>
      <style>{`
        @keyframes vm-reel-blur { 0%,100% { transform: translateY(-4px); } 50% { transform: translateY(4px); } }
      `}</style>
      <div className="mx-auto flex w-fit gap-2 rounded-2xl border border-[#c89a55]/30 bg-black/60 p-3">
        {reels.map((symbolIndex, reel) => (
          <div
            className="flex h-20 w-20 items-center justify-center rounded-xl border border-white/10 bg-[linear-gradient(180deg,#1c0a14,#090306)] text-4xl"
            key={reel}
            style={spinning ? { animation: `vm-reel-blur ${0.12 + reel * 0.03}s linear infinite`, filter: "blur(2px)" } : undefined}
          >
            {spinning ? SLOT_SYMBOLS[(symbolIndex + reel + 1) % SLOT_SYMBOLS.length].glyph : SLOT_SYMBOLS[symbolIndex].glyph}
          </div>
        ))}
      </div>
      <button className="vm-table-button" disabled={busy || spinning} onClick={play} type="button">
        {spinning ? "Spinning..." : `Pull — ${bet.toLocaleString()} coins`}
      </button>
      {line ? <ResultLine {...line} /> : null}
      {win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}
    </div>
  );
}

function DiceTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [dice, setDice] = useState<{ hers: [number, number]; mine: [number, number] } | null>(null);
  const [rolling, setRolling] = useState(false);
  const [line, setLine] = useState<{ text: string; tone: "win" | "lose" | "info" } | null>(null);
  const [win, setWin] = useState<WinState>(null);

  const play = () =>
    onPlay(async () => {
      setLine(null);
      setWin(null);
      setRolling(true);
      try {
        const result = await callGamble({ action: "dice", bet });
        if (result.profile && onProfile) onProfile(result.profile);
        window.setTimeout(() => {
          setDice({ hers: result.hers as [number, number], mine: result.mine as [number, number] });
          setRolling(false);
          const payout = Number(result.payout) || 0;
          if (result.win) {
            setLine({ text: `You rolled higher. +${payout.toLocaleString()} coins`, tone: "win" });
            setWin({ payout, roundId: String(result.roundId) });
            emitSoundEvent("task_completion");
          } else {
            const tie = !result.win && payout === 0 && result.mine && result.hers &&
              (result.mine as number[]).reduce((a, b) => a + b, 0) === (result.hers as number[]).reduce((a, b) => a + b, 0);
            setLine({ text: tie ? "A tie. Ties are hers." : "She rolled higher.", tone: "lose" });
            emitSoundEvent("task_fail");
          }
        }, 900);
      } catch (error) {
        setRolling(false);
        setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
      }
    });

  const face = (value: number) => ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][value] ?? "?";

  return (
    <div>
      <div className="mx-auto grid w-fit grid-cols-2 gap-6">
        {(["mine", "hers"] as const).map((side) => (
          <div className="text-center" key={side}>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">{side === "mine" ? "Yours" : "Hers"}</p>
            <div className={`mt-2 flex gap-2 text-5xl ${rolling ? "animate-pulse" : ""} ${side === "hers" ? "text-pink-200" : "text-[#ffe2ad]"}`}>
              <span>{dice ? face(dice[side][0]) : "⚀"}</span>
              <span>{dice ? face(dice[side][1]) : "⚀"}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-[#c89a55]/60">Ties are hers. That is the whole edge.</p>
      <button className="vm-table-button" disabled={busy || rolling} onClick={play} type="button">
        {rolling ? "Rolling..." : `Roll — ${bet.toLocaleString()} coins`}
      </button>
      {line ? <ResultLine {...line} /> : null}
      {win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}
    </div>
  );
}

function RouletteTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [ring, setRing] = useState<string>("outer");
  const [pending, setPending] = useState(false);
  const [line, setLine] = useState<{ text: string; tone: "win" | "lose" | "info" } | null>(null);
  const [win, setWin] = useState<WinState>(null);

  const play = () =>
    onPlay(async () => {
      setLine(null);
      setWin(null);
      setPending(true);
      try {
        const result = await callGamble({ action: "roulette", bet, ring });
        if (result.profile && onProfile) onProfile(result.profile);
        window.setTimeout(() => {
          setPending(false);
          const payout = Number(result.payout) || 0;
          if (result.win) {
            setLine({ text: `The ball chose your ring. +${payout.toLocaleString()} coins`, tone: "win" });
            setWin({ payout, roundId: String(result.roundId) });
            emitSoundEvent("task_completion");
          } else {
            setLine({ text: "The ball went elsewhere. She keeps it.", tone: "lose" });
            emitSoundEvent("task_fail");
          }
        }, 1_400);
      } catch (error) {
        setPending(false);
        setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
      }
    });

  return (
    <div>
      <div className="relative mx-auto h-44 w-44">
        {ROULETTE_RINGS.map((entry, index) => (
          <button
            className={`absolute rounded-full border-2 transition ${ring === entry.id ? "border-[#e6ba73]" : "border-white/15 hover:border-white/35"}`}
            key={entry.id}
            onClick={() => setRing(entry.id)}
            style={{ inset: `${index * 26}px` }}
            type="button"
          />
        ))}
        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl">👑</span>
        {pending ? (
          <span className="pointer-events-none absolute left-1/2 top-0 h-2.5 w-2.5 animate-[spin_0.7s_linear_infinite] rounded-full bg-pink-200 [transform-origin:0_88px]" />
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ROULETTE_RINGS.map((entry) => (
          <button
            className={`rounded-xl border px-2 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition ${ring === entry.id ? "border-[#e6ba73]/60 bg-[#c89a55]/15 text-[#ffe2ad]" : "border-white/10 bg-black/30 text-zinc-500 hover:text-zinc-300"}`}
            key={entry.id}
            onClick={() => setRing(entry.id)}
            type="button"
          >
            {entry.label}
            <span className="block text-zinc-500">{entry.multiplier}x · {Math.round(entry.winChance * 100)}%</span>
          </button>
        ))}
      </div>
      <button className="vm-table-button" disabled={busy || pending} onClick={play} type="button">
        {pending ? "The ball is rolling..." : `Drop the ball — ${bet.toLocaleString()} coins`}
      </button>
      {line ? <ResultLine {...line} /> : null}
      {win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}
    </div>
  );
}

function PlinkoTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [ballRow, setBallRow] = useState<number | null>(null);
  const [ballX, setBallX] = useState(0);
  const [landed, setLanded] = useState<number | null>(null);
  const [line, setLine] = useState<{ text: string; tone: "win" | "lose" | "info" } | null>(null);
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
        let x = 0;
        path.forEach((step, row) => {
          timers.current.push(
            window.setTimeout(() => {
              x += step === 1 ? 1 : -1;
              setBallRow(row);
              setBallX(x);
              emitSoundEvent("crate_reel_tick");
            }, 140 * (row + 1)),
          );
        });
        timers.current.push(
          window.setTimeout(() => {
            setBallRow(null);
            setBallX(0);
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
          }, 140 * (path.length + 1) + 150),
        );
      } catch (error) {
        setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
      }
    });

  return (
    <div>
      <div className="relative mx-auto h-44 w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        {Array.from({ length: PLINKO_ROWS }, (_, row) => (
          <div className="absolute inset-x-0 flex justify-center gap-3" key={row} style={{ top: `${(row / PLINKO_ROWS) * 88 + 4}%` }}>
            {Array.from({ length: row + 2 }, (_, peg) => (
              <span className="h-1 w-1 rounded-full bg-white/25" key={peg} />
            ))}
          </div>
        ))}
        {ballRow !== null ? (
          <span
            className="absolute h-2.5 w-2.5 rounded-full bg-[#ffe2ad] shadow-[0_0_8px_rgba(230,186,115,.8)] transition-all duration-150"
            style={{ left: `calc(50% + ${ballX * 9}px)`, top: `${(ballRow / PLINKO_ROWS) * 88 + 4}%` }}
          />
        ) : null}
      </div>
      <div className="mt-1 flex justify-between gap-0.5 text-center">
        {PLINKO_MULTIPLIERS.map((multiplier, index) => (
          <span
            className={`flex-1 rounded px-0.5 py-1 text-[8px] font-black tabular-nums ${landed === index ? "bg-[#c89a55]/30 text-[#ffe2ad]" : multiplier >= 4 ? "text-emerald-200/70" : "text-zinc-600"}`}
            key={index}
          >
            {multiplier}x
          </span>
        ))}
      </div>
      <button className="vm-table-button" disabled={busy || ballRow !== null} onClick={play} type="button">
        {ballRow !== null ? "Falling..." : `Drop — ${bet.toLocaleString()} coins`}
      </button>
      {line ? <ResultLine {...line} /> : null}
      {win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}
    </div>
  );
}

function MinesTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [mineCount, setMineCount] = useState<number>(MINES_OPTIONS[0]);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [picks, setPicks] = useState<number[]>([]);
  const [mines, setMines] = useState<number[]>([]);
  const [bustCell, setBustCell] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [line, setLine] = useState<{ text: string; tone: "win" | "lose" | "info" } | null>(null);
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

function CrashTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [roundId, setRoundId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [display, setDisplay] = useState(1);
  const [line, setLine] = useState<{ text: string; tone: "win" | "lose" | "info" } | null>(null);
  const [win, setWin] = useState<WinState>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (startedAt === null) return;
    const tick = () => {
      setDisplay(crashMultiplierAt(Date.now() - startedAt));
      frame.current = window.requestAnimationFrame(tick);
    };
    frame.current = window.requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, [startedAt]);

  const open = () =>
    onPlay(async () => {
      setLine(null);
      setWin(null);
      try {
        const result = await callGamble({ action: "crash-open", bet });
        if (result.profile && onProfile) onProfile(result.profile);
        setRoundId(String(result.roundId));
        setStartedAt(Date.now());
        setDisplay(1);
      } catch (error) {
        setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
      }
    });

  const cashout = async () => {
    if (!roundId) return;
    const id = roundId;
    setRoundId(null);
    setStartedAt(null);
    try {
      const result = await callGamble({ action: "crash-cashout", roundId: id });
      if (result.profile && onProfile) onProfile(result.profile);
      const payout = Number(result.payout) || 0;
      if (result.survived) {
        setLine({ text: `Out at ${result.multiplier}x — +${payout.toLocaleString()} coins. She crashed at ${result.crashPoint}x.`, tone: "win" });
        setWin({ payout, roundId: id });
        emitSoundEvent("task_completion");
      } else {
        setLine({ text: `Too slow. Her patience ran out at ${result.crashPoint}x.`, tone: "lose" });
        emitSoundEvent("task_fail");
      }
    } catch (error) {
      setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
    }
  };

  return (
    <div>
      <div className={`mx-auto flex h-32 w-full max-w-sm items-center justify-center rounded-2xl border bg-black/50 ${roundId ? "border-[#f0821e]/40" : "border-white/10"}`}>
        <span className={`font-serif text-6xl tabular-nums ${roundId ? "text-[#ffe2ad]" : "text-zinc-700"}`}>
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

function CrawlTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [raceId, setRaceId] = useState<string | null>(null);
  const [odds, setOdds] = useState<number[] | null>(null);
  const [lane, setLane] = useState<number | null>(null);
  const [progress, setProgress] = useState<number[]>([0, 0, 0, 0]);
  const [racing, setRacing] = useState(false);
  const [line, setLine] = useState<{ text: string; tone: "win" | "lose" | "info" } | null>(null);
  const [win, setWin] = useState<WinState>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const captured = timers.current;
    return () => captured.forEach((id) => window.clearTimeout(id));
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
    const steps = 24;
    // Drama is client-side garnish; the winner already exists. Everyone
    // wobbles, the winner is guaranteed to finish first.
    const speeds = [0, 1, 2, 3].map((index) => (index === winner ? 1 : 0.65 + Math.random() * 0.25));
    for (let step = 1; step <= steps; step += 1) {
      timers.current.push(
        window.setTimeout(() => {
          setProgress((current) =>
            current.map((value, index) => {
              const wobble = Math.random() * 3;
              const target = (step / steps) * 100 * speeds[index];
              return Math.min(100, Math.max(value, target - wobble));
            }),
          );
          if (step === steps) {
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
          }
        }, step * 260),
      );
    }
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
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                style={{ background: `${entry.color}55`, width: `${progress[index]}%` }}
              />
              <span className="absolute top-1/2 -translate-y-1/2 text-xs transition-all duration-300" style={{ left: `calc(${progress[index]}% - 8px)` }}>
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
export function GambleHall({ disabled = false, onProfile }: HallProps) {
  const [table, setTable] = useState<TableId>("slots");
  const [bet, setBet] = useState(250);
  const [busy, setBusy] = useState(false);

  const onPlay = useCallback(
    (run: () => Promise<void>) => {
      if (disabled || busy) return;
      setBusy(true);
      void run().finally(() => setBusy(false));
    },
    [busy, disabled],
  );

  const active = TABLES.find((entry) => entry.id === table)!;
  const tableProps: TableProps = { bet, busy: busy || disabled, onPlay, onProfile };

  return (
    <section className="relative min-w-0 overflow-hidden rounded-[2rem] border border-[#d7ad69]/20 bg-[radial-gradient(circle_at_50%_0%,rgba(190,24,93,.18),transparent_40%),linear-gradient(145deg,rgba(17,6,13,.98),rgba(3,2,4,.98))] p-5">
      <style>{`
        .vm-table-button {
          margin-top: 0.9rem; display: block; width: 100%; border-radius: 1rem;
          border: 1px solid rgba(244,194,255,.2); background: rgba(236,72,153,.1);
          padding: 0.8rem 1rem; font-size: .875rem; font-weight: 900; color: #fce7f3;
          text-transform: none; transition: background .15s, border-color .15s;
        }
        .vm-table-button:enabled:hover { background: rgba(236,72,153,.2); border-color: rgba(244,194,255,.5); }
        .vm-table-button:disabled { opacity: .45; cursor: not-allowed; }
      `}</style>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.32em] text-[#d7ad69]/60">The hall is rigged. It says so.</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-[#fff0d2]">Gamble Hall</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Coins in, coins out, and she keeps her printed cut of everything. Daily loss cap:{" "}
            {GAMBLE_DAILY_LOSS_CAP.toLocaleString()} coins — when it is reached, the hall closes on you until tomorrow.
          </p>
        </div>
      </div>

      {/* Shared bet */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Bet</span>
        {BET_CHIPS.map((chip) => (
          <button
            className={`rounded-full border px-3 py-1.5 text-xs font-black tabular-nums transition ${bet === chip ? "border-[#e6ba73]/60 bg-[#c89a55]/15 text-[#ffe2ad]" : "border-white/10 bg-black/30 text-zinc-500 hover:text-zinc-300"}`}
            key={chip}
            onClick={() => setBet(chip)}
            type="button"
          >
            {chip.toLocaleString()}
          </button>
        ))}
        <span className="ml-1 text-[9px] text-zinc-700">
          {GAMBLE_MIN_BET}–{GAMBLE_MAX_BET.toLocaleString()} per round
        </span>
      </div>

      {/* Table picker */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {TABLES.map((entry) => (
          <button
            className={`rounded-xl border px-3 py-2 text-[11px] font-black transition ${table === entry.id ? "border-pink-200/50 bg-pink-500/15 text-pink-50" : "border-white/10 bg-black/30 text-zinc-500 hover:text-zinc-300"}`}
            key={entry.id}
            onClick={() => setTable(entry.id)}
            type="button"
          >
            {entry.title}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/[.03] p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className="text-xs text-zinc-500">{active.blurb}</p>
          <span className="shrink-0 rounded-full border border-[#c89a55]/25 bg-black/40 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#e9d2aa]">
            {active.edge}
          </span>
        </div>
        {table === "slots" ? <SlotsTable {...tableProps} /> : null}
        {table === "dice" ? <DiceTable {...tableProps} /> : null}
        {table === "roulette" ? <RouletteTable {...tableProps} /> : null}
        {table === "plinko" ? <PlinkoTable {...tableProps} /> : null}
        {table === "mines" ? <MinesTable {...tableProps} /> : null}
        {table === "crash" ? <CrashTable {...tableProps} /> : null}
        {table === "crawl" ? <CrawlTable {...tableProps} /> : null}
      </div>
    </section>
  );
}
