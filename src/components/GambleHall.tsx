"use client";

import Image from "next/image";
import styles from "./ExperienceSurfaces.module.css";
import c from "./CasinoExperience.module.css";
import { CasinoTableFrame, CasinoMetric, CasinoDie, CasinoRunner } from "./CasinoTableFrame";
import { estimateGambleClock } from "@/lib/gamble-clock";
import { CourtGlyph } from "@/components/court/CourtVisuals";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSoundLoop } from "@/lib/use-animation-sound";
import { emitSoundEvent } from "@/lib/sound";
import {
  CRAWL_LANES,
  crashMultiplierAt,
  DOUBLE_OR_NOTHING_CHANCE,
  EUROPEAN_ROULETTE_ORDER,
  GAMBLE_MAX_BET,
  GAMBLE_MIN_BET,
  MINES_GRID,
  MINES_OPTIONS,
  MINES_MAX_MULTIPLIER,
  minesMultiplier,
  minesProfitPicks,
  PLINKO_MULTIPLIERS,
  PLINKO_ROWS,
  ROULETTE_BETS,
  ROULETTE_RED_NUMBERS,
  SLOT_SYMBOLS,
  type RouletteBetId,
} from "@/lib/gamble";

// The Gamble Hall. Seven tables stacked in one column, one shared bet, one
// shared rule printed everywhere: the edge is announced, never hidden. Every
// outcome arrives from the server before its animation starts - each table is
// a renderer that lands on a result it already knows.

type HallProps = { disabled?: boolean; onProfile?: (profile: unknown) => void };

const BET_CHIPS = [100, 250, 500, 1_000, 2_500, 5_000];

async function callGamble(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const sentAt = performance.now();
  const response = await fetch("/api/user/gamble", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) throw new Error((payload?.error as string) ?? "The table refused.");
  const receivedAt = performance.now();
  const serverSentAt = Number(payload?.serverNowMs);
  const serverReceivedAt = Number(payload?.serverReceivedAtMs);
  return { ...payload, receivedAt, estimatedServerNow: Number.isFinite(serverSentAt) ? estimateGambleClock(sentAt, receivedAt, Number.isFinite(serverReceivedAt) ? serverReceivedAt : serverSentAt, serverSentAt) : Date.now() };
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

  return <div className={c.doubleBox} data-state={state}><div><span className={c.doubleIcon} data-pending={state === "pending"}><CourtGlyph symbol={state === "lost" ? "lock" : "coin"} /></span><div><p>One more decision</p><small>{state === "pending" ? "The coin is turning." : "Keep your return or take the printed chance."}</small></div></div>{state === "idle" || state === "pending" ? <div className={c.doubleActions}><button className={c.action} disabled={state === "pending"} onClick={() => void play()} type="button">{state === "pending" ? "Flipping…" : `Double · ${Math.round(DOUBLE_OR_NOTHING_CHANCE*100)}%`}</button><button className={c.keepReturn} onClick={onDone} type="button">Keep {payout.toLocaleString()}</button></div> : <p className={c.result} data-tone={state === "won" ? "win" : "lose"}>{state === "won" ? `Doubled. +${(payout*2).toLocaleString()} total.` : "Gone. She laughs at you"}</p>}</div>;
}

type WinState = { payout: number; roundId: string } | null;
type Line = { text: string; tone: "win" | "lose" | "info" } | null;

function ResultLine({ text, tone }: { text: string; tone: "win" | "lose" | "info" }) {
  return (
    <p className={c.result} data-tone={tone}>
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
    const stop = () => emitSoundEvent("slot_stop");
    node.addEventListener("transitionend", stop);
    return () => node.removeEventListener("transitionend", stop);
  }, [duration, spinKey, strip]);

  return (
    <div
      className={`${c.reelCell} ${c.reelClip}`}
      style={{ height: REEL_CELL, width: REEL_CELL }}
    >
      <div ref={innerRef}>
        {strip.map((symbolIndex, cell) => (
          <div className={c.reelStripCell} aria-label={SLOT_SYMBOLS[symbolIndex].id} key={cell} style={{ height: REEL_CELL }}>
            <CourtGlyph className="court-reel-symbol" symbol={SLOT_SYMBOLS[symbolIndex].id}/>
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
    return () => {
      captured.forEach((id) => window.clearTimeout(id));
    };
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
      try {
        const result = await callGamble({ action: "slots", bet });
        if (result.profile && onProfile) onProfile(result.profile);
        const landed = result.reels as [number, number, number];
        setStrips(landed.map((symbolIndex, reel) => buildStrip(symbolIndex, reel)));
        setSpinKey((key) => key + 1);
        setPhase("sliding");
        timers.current.push(
          window.setTimeout(() => {
            setReels(landed);
            setPhase("idle");
            const payout = Number(result.payout) || 0;
            if (payout > 0) {
              setLine({ text: result.multiplier + "x · " + payout.toLocaleString() + " returned · " + (payout - bet >= 0 ? "+" : "") + (payout - bet).toLocaleString() + " net", tone: payout > bet ? "win" : "info" });
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

  const viewPhase = phase;
  const viewReels = reels;
  const viewStrips = strips;
  return (
    <CasinoTableFrame label="One payline · three reels" phase={spinning ? "Spinning" : line ? "Result" : "Ready"} result={<>{line ? <ResultLine {...line} /> : null}{win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}</>} controls={<>
      <CasinoMetric label="Your stake" value={bet.toLocaleString()} detail="Coins · one payline" />
      <p className={c.controlCopy}>Three matching symbols pay the triple value. Any pair pays its symbol’s pair value.</p>
      <button className={c.action} disabled={busy || spinning} onClick={play} type="button">{spinning ? "Spinning…" : "Pull the reels"}</button>

    </>}>
      <style>{`@keyframes vm-reel-loop { from { transform: translateY(0); } to { transform: translateY(-${REEL_CELL * SLOT_SYMBOLS.length}px); } }`}</style>
      <div className={c.cabinet} data-winning={viewPhase === "idle" && (Boolean(win && win.payout > bet))}>
        <div className={c.cabinetTop}><span>Her Reels</span><small>PRINCIPESSA · 03</small></div>
        <div className={c.reelWindow}>{[0, 1, 2].map(reel => viewPhase === "waiting" ? <div className={`${c.reelCell} ${c.reelClip}`} key={reel}><div style={{ animation: `vm-reel-loop ${0.42 + reel * 0.06}s linear infinite`, filter: "blur(1.5px)" }}>{[...SLOT_SYMBOLS, ...SLOT_SYMBOLS].map((symbol, cell) => <div className={c.reelStripCell} key={cell}><CourtGlyph className="court-reel-symbol" symbol={symbol.id} /></div>)}</div></div> : viewPhase === "sliding" && viewStrips ? <SlotReel duration={REEL_DURATIONS[reel]} key={reel} spinKey={spinKey} strip={viewStrips[reel]} /> : <div className={c.reelCell} key={reel}><CourtGlyph className="court-reel-symbol" symbol={SLOT_SYMBOLS[viewReels[reel]].id} /></div>)}</div>
        <div className={c.cabinetFoot}><span>Follow the centre line</span><div className={c.reelLamps}>{[0,1,2].map(index => <i data-lit={viewPhase === "idle"} key={index} />)}</div></div>
      </div>
      <div className={c.symbolLegend}>{SLOT_SYMBOLS.map(symbol => <span key={symbol.id}><CourtGlyph symbol={symbol.id} />{symbol.triplePays}× triple</span>)}</div>
    </CasinoTableFrame>
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

          }, 800),
        );
        timers.current.push(
          window.setTimeout(() => {
            if (tumble.current !== null) window.clearInterval(tumble.current);
            tumble.current = null;
            setShown({ hers, mine });
            lock("both", true);

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

  useSoundLoop("dice_roll", rolling && (!locked.mine || !locked.hers));
  const viewRolling = rolling;
  const viewLocked = locked;
  const viewShown = shown;
  return (
    <CasinoTableFrame label="A duel across the felt" phase={rolling ? "Rolling" : line ? "Result" : "Ready"} result={<>{line ? <ResultLine {...line} /> : null}{win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}</>} controls={<>
      <CasinoMetric label="Your stake" value={bet.toLocaleString()} detail="Coins · two dice each" />
      <p className={c.controlTitle}>Roll higher than her.</p><p className={c.controlCopy}>Your two dice settle first. Hers follow. A tie belongs to Principessa.</p>
      <button className={c.action} disabled={busy || rolling} onClick={play} type="button">{rolling ? "Rolling…" : "Roll the dice"}</button>

    </>}>
      <div className={c.diceArena}>{(["mine", "hers"] as const).map((side,index) => <div className={c.diceSide} data-side={side} key={side} style={{ gridColumn:index === 0 ? 1 : 3, gridRow:1 }}><p>{side === "mine" ? "Your hand" : "Principessa"}</p><div className={c.dicePair}>{viewShown[side].map((value, dieIndex) => <CasinoDie key={dieIndex} rolling={!viewLocked[side]} value={value} />)}</div><strong>{viewLocked[side] ? viewShown[side][0] + viewShown[side][1] : "—"}</strong><small>{viewLocked[side] ? "Total" : "Rolling"}</small></div>)}<span className={c.diceVersus} style={{ gridColumn:2,gridRow:1 }}>vs</span></div>
      <p className={c.diceRule}>{viewRolling ? "The dice are in motion." : "Two hands. One final word."}</p>
    </CasinoTableFrame>
  );
}

// ------------------------------------------------------------- Court Roulette
// European roulette: the server returns the exact 0-36 landing number and the
// wheel animates to that pocket. Bet names and colours follow the real table.
const ROULETTE_SEGMENT_DEGREES = 360 / EUROPEAN_ROULETTE_ORDER.length;

function RouletteTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [rouletteBet, setRouletteBet] = useState<RouletteBetId>("red");
  const [rotation, setRotation] = useState(0);
  const [landedNumber, setLandedNumber] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [line, setLine] = useState<Line>(null);
  const [win, setWin] = useState<WinState>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const captured = timers.current;
    return () => captured.forEach((id) => window.clearTimeout(id));
  }, []);

  const gradientStops = EUROPEAN_ROULETTE_ORDER.map((number, index) => {
    const color = number === 0 ? "#12633f" : ROULETTE_RED_NUMBERS.has(number) ? "#9f1734" : "#120d12";
    return `${color} ${index * ROULETTE_SEGMENT_DEGREES}deg ${(index + 1) * ROULETTE_SEGMENT_DEGREES}deg`;
  });

  const play = () =>
    onPlay(async () => {
      setLine(null);
      setWin(null);
      setLandedNumber(null);
      setPreparing(true);
      try {
        const result = await callGamble({ action: "roulette", bet, rouletteBet });
        if (result.profile && onProfile) onProfile(result.profile);
        const number = Number(result.number);
        const target = EUROPEAN_ROULETTE_ORDER.indexOf(number as (typeof EUROPEAN_ROULETTE_ORDER)[number]);
        const targetAngle = target * ROULETTE_SEGMENT_DEGREES + ROULETTE_SEGMENT_DEGREES / 2;
        setPreparing(false);
        setSpinning(true);
        setRotation((previous) => {
          const delta = (((-targetAngle - previous) % 360) + 360) % 360;
          return previous + 4 * 360 + delta;
        });

        timers.current.push(
          window.setTimeout(() => {
            setSpinning(false);
            setLandedNumber(number);
            const payout = Number(result.payout) || 0;
            if (result.win) {
              setLine({ text: `${number} — +${payout.toLocaleString()} coins`, tone: "win" });
              setWin({ payout, roundId: String(result.roundId) });
              emitSoundEvent("task_completion");
            } else {
              setLine({ text: `${number} — lost.`, tone: "lose" });
              emitSoundEvent("task_fail");
            }
          }, 3_400),
        );
      } catch (error) {
        setPreparing(false);
        setSpinning(false);
        setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
      }
    });

  useSoundLoop("roulette_roll", spinning);
  const viewSpinning = spinning;
  const viewNumber = landedNumber;

  const viewRotation = rotation;
  return (
    <CasinoTableFrame label="European roulette · 37 pockets" phase={preparing ? "Preparing" : spinning ? "Spinning" : line ? "Result" : "Place your bet"} result={<>{line ? <ResultLine {...line} /> : null}{win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}</>} controls={<>
      <CasinoMetric label="Your stake" value={bet.toLocaleString()} detail="Coins · select a colour" />
      <div className={c.choices}>{ROULETTE_BETS.map(entry => <button aria-pressed={rouletteBet === entry.id} disabled={preparing || spinning} key={entry.id} onClick={() => setRouletteBet(entry.id)} type="button"><i className={c.colorDot} data-color={entry.id} />{entry.label}<small>{entry.multiplier}×</small></button>)}</div>
      <p className={c.controlCopy}>The pocket map shows the wheel’s numbers. Your wager covers the selected colour.</p>
      <button className={c.action} disabled={busy || preparing || spinning} onClick={play} type="button">{preparing ? "Taking your bet…" : spinning ? "Wheel turning…" : "Spin the wheel"}</button>

    </>}>
      <div className={c.rouletteArena}><div className={c.rouletteInstrument}><span aria-hidden="true" className={c.roulettePointer} /><div className={c.rouletteDisk} style={{ background:`conic-gradient(from 0deg, ${gradientStops.join(",")})`,transform:`rotate(${viewRotation}deg)`,transition:viewSpinning ? "transform 3300ms cubic-bezier(0.12, 0.62, 0.1, 1)" : "none" }}>{EUROPEAN_ROULETTE_ORDER.map((number,index) => <span className={c.rouletteNumber} key={number} style={{ transform:`translate(-50%, -50%) rotate(${index * ROULETTE_SEGMENT_DEGREES + ROULETTE_SEGMENT_DEGREES / 2}deg) translateY(-96px)` }}>{number}</span>)}</div><div aria-hidden="true" className="court-roulette-ball-orbit" data-spinning={viewSpinning} /><div className={c.rouletteHub}><small>Landed pocket</small><strong>{viewNumber ?? "—"}</strong></div></div>
      <div aria-label="Pocket map. Bets are red, black or green." className={c.pocketMap}>{Array.from({length:37},(_,number) => {const color = number === 0 ? "green" : ROULETTE_RED_NUMBERS.has(number) ? "red" : "black";return <span data-color={color} data-landed={viewNumber === number} data-selected={rouletteBet === color} key={number}>{number}</span>;})}</div></div><p className={c.pocketCaption}>One zero. Red or black pays 1.68×. Green pays 30×.</p>
    </CasinoTableFrame>
  );
}

// --------------------------------------------------------------------- Plinko
// Board and buckets share one container, so a step on the board is exactly
// half a bucket wide and the ball lands where the highlight lights up.
const PLINKO_BUCKET_W = 100 / PLINKO_MULTIPLIERS.length;

function PlinkoTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [ball, setBall] = useState<{ x: number; y: number } | null>(null);
  const [trail, setTrail] = useState<Array<{ x: number; y: number }>>([]);
  const [landed, setLanded] = useState<number | null>(null);
  const [line, setLine] = useState<Line>(null);
  const [win, setWin] = useState<WinState>(null);
  const frame = useRef<number | null>(null);
  const mounted = useRef(true);
  const landingTimer = useRef<number | null>(null);
  const resolveAnimation = useRef<(() => void) | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (landingTimer.current !== null) clearTimeout(landingTimer.current);
      resolveAnimation.current?.();
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, []);

  const play = () =>
    onPlay(async () => {
      setLine(null);
      setWin(null);
      setLanded(null);
      setTrail([]);
      setBall({ x: 50, y: 2 });
      try {
        const result = await callGamble({ action: "plinko", bet });
        if (!mounted.current) return;
        if (result.profile && onProfile) onProfile(result.profile);
        const path = result.path as number[];
        if (!Array.isArray(path) || path.length !== PLINKO_ROWS || path.some(step => step !== 0 && step !== 1)) throw new Error("The ball could not be displayed. Please refresh your balance before playing again.");
        let offset = 0;
        const points = [{ x: 50, y: 2 }];
        path.forEach((step, row) => {
          offset += step === 1 ? 1 : -1;
          points.push({
            x: 50 + (offset * PLINKO_BUCKET_W) / 2,
            y: 7 + ((row + 1) / PLINKO_ROWS) * 84,
          });
        });
        points.push({ x: points.at(-1)?.x ?? 50, y: 98 });

        const hopMs = 155;
        const startedAt = performance.now();
        let lastPeg = -1;
        await new Promise<void>(resolve => {
        resolveAnimation.current = resolve;
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          if (frame.current !== null) cancelAnimationFrame(frame.current);
          if (landingTimer.current !== null) clearTimeout(landingTimer.current);
          frame.current = null;
          resolveAnimation.current = null;
          resolve();
          if (!mounted.current) return;
          setBall(null);
          setLanded(Number(result.bucket));
          const payout = Number(result.payout) || 0;
          if (payout > bet) {
            setLine({ text: `${result.multiplier}x — +${payout.toLocaleString()} coins`, tone: "win" });
            setWin({ payout, roundId: String(result.roundId) });
            emitSoundEvent("task_completion");
          } else if (payout > 0) {
            setLine({ text: `${result.multiplier}x — ${payout.toLocaleString()} back.`, tone: "lose" });
          } else {
            setLine({ text: "Lost.", tone: "lose" });
            emitSoundEvent("task_fail");
          }
        };
        const animate = (now: number) => {
          if (!mounted.current) { finish(); return; }
          const raw = Math.min(points.length - 1, (now - startedAt) / hopMs);
          const segment = Math.min(points.length - 2, Math.floor(raw));
          const local = Math.min(1, raw - segment);
          const from = points[segment];
          const to = points[segment + 1];
          const current = {
            x: from.x + (to.x - from.x) * local,
            y: from.y + (to.y - from.y) * local - Math.sin(local * Math.PI) * 1.8,
          };
          setBall(current);
          setTrail([...points.slice(0, segment + 1), current]);
          if (segment !== lastPeg && segment > 0) {
            lastPeg = segment;
            emitSoundEvent("plinko_hit");

          }
          if (raw < points.length - 1) {
            frame.current = window.requestAnimationFrame(animate);
          } else {
            frame.current = null;
            finish();
          }
        };
        landingTimer.current = window.setTimeout(finish, points.length * hopMs + 250);
        frame.current = window.requestAnimationFrame(animate);
        });
      } catch (error) {
        if (!mounted.current) return;
        setBall(null);
        setTrail([]);
        setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
      }
    });






  const viewBall = ball;
  const viewTrail = trail;
  const viewLanded = landed;
  return (
    <CasinoTableFrame label="Twelve rows · thirteen destinations" phase={ball ? "Falling" : line ? "Result" : "Ready"} result={<>{line ? <ResultLine {...line} /> : null}{win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}</>} controls={<>
      <CasinoMetric label="Your stake" value={bet.toLocaleString()} detail="Coins · one drop" />
      <CasinoMetric label="Landed multiplier" value={viewLanded === null ? "—" : `${PLINKO_MULTIPLIERS[viewLanded]}×`} detail="The outer buckets pay more." />
      <button className={c.action} disabled={busy || ball !== null} onClick={play} type="button">{ball !== null ? "Falling…" : "Release the ball"}</button>

    </>}>
      <div className={c.plinkoMachine}><div className={c.plinkoBoard}>{viewTrail.length > 1 ? <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100"><polyline fill="none" points={viewTrail.map(point => `${point.x},${point.y}`).join(" ")} stroke="#d2a9c56b" strokeWidth=".4" /></svg> : null}{Array.from({length:PLINKO_ROWS},(_,row) => Array.from({length:row+2},(_,peg) => <span className={c.peg} data-hit={viewBall !== null && Math.abs(viewBall.x-(50+(peg-(row+1)/2)*PLINKO_BUCKET_W)) < PLINKO_BUCKET_W/2 && Math.abs(viewBall.y-((row+.5)/PLINKO_ROWS)*92) < 4} key={`${row}-${peg}`} style={{left:`${50+(peg-(row+1)/2)*PLINKO_BUCKET_W}%`,top:`${((row+.5)/PLINKO_ROWS)*92}%`}} />))}{viewBall ? <span className={c.plinkoBall} style={{left:`${viewBall.x}%`,top:`${viewBall.y}%`}} /> : null}</div>
      <div className={c.buckets}>{PLINKO_MULTIPLIERS.map((multiplier,index) => <span data-high={multiplier >= 4} data-landed={viewLanded === index} key={index}>{multiplier}×</span>)}</div><div className={c.boardLegend}><span>Outer return</span><span>Centre risk</span><span>Outer return</span></div></div>
      <div className={c.resultTrack}><span>{viewLanded === null ? "Awaiting landing" : `Pocket ${viewLanded+1}`}</span><span>{viewLanded === null ? "One ball at a time" : `${PLINKO_MULTIPLIERS[viewLanded]}× return`}</span></div>
    </CasinoTableFrame>
  );
}

// -------------------------------------------------------------- Jewelry Box
function MinesTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [wager, setWager] = useState(bet);
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
        setWager(bet);
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
        emitSoundEvent("mine_bust");
      } else {
        setPicks(result.picks as number[]);
        emitSoundEvent("gem_found");
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
      setLine({ text: `${result.multiplier}x · ${payout.toLocaleString()} Coins returned · +${(payout - wager).toLocaleString()} net`, tone: payout > wager ? "win" : "info" });
      setWin({ payout, roundId });
      setRoundId(null);
      emitSoundEvent("casino_cashout");
    } catch (error) {
      setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
    } finally {
      setPending(false);
    }
  };

  const currentMultiplier = minesMultiplier(mineCount, picks.length);
  const remainingSafe = MINES_GRID - mineCount - picks.length;
  const nextMultiplier = remainingSafe > 0 && currentMultiplier < MINES_MAX_MULTIPLIER ? minesMultiplier(mineCount, picks.length + 1) : null;
  const netProfit = Math.floor(wager * currentMultiplier) - wager;

  const viewPicks = picks;
  const viewMines = mines;
  const viewBust = bustCell;
  const viewSafe = MINES_GRID - mineCount - viewPicks.length;
  return (
    <CasinoTableFrame label="Twenty-five sealed compartments" phase={pending ? "Opening" : roundId ? "Choose a box" : line ? "Result" : "Sealed"} result={<>{line ? <ResultLine {...line} /> : null}{win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}</>} controls={<>
      <CasinoMetric label={roundId ? "Round stake" : "Your stake"} value={(roundId ? wager : bet).toLocaleString()} detail="Coins · return includes your stake" />
      {!roundId ? <div><p className={c.controlTitle}>Choose the traps</p><div className={c.choices} style={{marginTop:10}}>{MINES_OPTIONS.map(option => <button aria-pressed={mineCount === option} disabled={pending || busy} key={option} onClick={() => {reset();setMineCount(option);setLine(null);}} type="button">{option}<small>traps</small></button>)}</div></div> : null}
      <p className={c.controlCopy}>Profit begins at {minesProfitPicks(mineCount)} safe {minesProfitPicks(mineCount) === 1 ? "box" : "boxes"}. Earlier takes return your stake. Maximum return {MINES_MAX_MULTIPLIER}×.</p>
      {roundId ? <><CasinoMetric label="Available return" value={picks.length > 0 ? `${currentMultiplier}×` : "Open a box"} detail={nextMultiplier !== null ? `Next gem: ${nextMultiplier}×` : currentMultiplier >= MINES_MAX_MULTIPLIER ? "Maximum reached" : "All gems found"} /><button className={c.action} disabled={pending || picks.length === 0} onClick={() => void cashout()} type="button">Take {Math.floor(wager*currentMultiplier).toLocaleString()}</button></> : <button className={c.action} disabled={busy || pending} onClick={open} type="button">Buy in · {bet.toLocaleString()} coins</button>}

    </>}>
      <div className={c.jewelTray}>{Array.from({length:MINES_GRID},(_,cell) => {const safe=viewPicks.includes(cell),trap=viewMines.includes(cell);return <button aria-label={trap ? "Trap "+(cell+1) : safe ? "Gem "+(cell+1) : "Open jewelry box "+(cell+1)} className={c.jewelCell} data-revealed={safe || trap} data-mine={trap} data-bust={cell === viewBust} disabled={!roundId || pending || safe || currentMultiplier >= MINES_MAX_MULTIPLIER} key={cell} onClick={() => void pick(cell)} type="button"><span className={c.jewelPrize}>{(safe || trap) && <CourtGlyph symbol={trap ? "threat" : "gem"} />}</span><span aria-hidden="true" className={c.jewelLid}><CourtGlyph symbol="seal" /></span><span className={c.jewelIndex}>{String(cell+1).padStart(2,"0")}</span></button>;})}</div>
      <div className={c.jewelSummary}><span><strong>{viewPicks.length}</strong> gems found</span><span><strong>{viewSafe}</strong> gems remain</span><span><strong>{mineCount}</strong> traps</span></div>
      {roundId && picks.length > 0 ? <p className={c.diceRule}>Net profit +{netProfit.toLocaleString()} Coins</p> : null}
    </CasinoTableFrame>
  );
}

// --------------------------------------------------------------- Her Patience
function CrashTable({ bet, busy, onPlay, onProfile }: TableProps) {
  const [roundId, setRoundId] = useState<string | null>(null);
  const [display, setDisplay] = useState(1);
  const [countdown, setCountdown] = useState(0);
  const [crashed, setCrashed] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);
  const [autoCashout, setAutoCashout] = useState("1.50");
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(false);
  const [activeTarget, setActiveTarget] = useState<number | null>(null);
  const [line, setLine] = useState<Line>(null);
  const [win, setWin] = useState<WinState>(null);
  const clock = useRef({ start: 0, server: 0, received: 0 });
  const activeRound = useRef<string | null>(null);
  const cashoutPending = useRef(false);
  const completed = useRef<string | null>(null);

  const acceptResult = useCallback((result: Record<string, unknown>, id: string) => {
    if (activeRound.current !== id || completed.current === id) return;
    completed.current = id;
    activeRound.current = null;
    cashoutPending.current = false;
    setRoundId(null);
    setCashingOut(false);
    setCountdown(0);
    if (result.profile && onProfile) onProfile(result.profile);
    if (result.survived) {
      const payout = Number(result.payout) || 0;
      const multiplier = Number(result.multiplier) || 1;
      setDisplay(multiplier);
      setLine({ text: `${multiplier.toFixed(2)}x — ${payout.toLocaleString()} Coins returned.`, tone: "win" });
      setWin({ payout, roundId: id });
      emitSoundEvent("casino_cashout");
    } else {
      const point = Number(result.crashPoint) || 1;
      setDisplay(point);
      setCrashed(true);
      setLine({ text: `Her patience ran out at ${point.toFixed(2)}x.`, tone: "lose" });
      emitSoundEvent("crash_break");
    }
  }, [onProfile]);

  useEffect(() => {
    if (!roundId || cashingOut) return;
    let cancelled = false;
    let frame = 0;
    let pollBusy = false;
    const tick = () => {
      const now = clock.current.server + performance.now() - clock.current.received;
      const elapsed = now - clock.current.start;
      setCountdown(Math.max(0, Math.ceil(-elapsed / 1000)));
      // An open status response can refine the clock, but cannot rewind it.
      setDisplay(current => Math.max(current, Math.min(activeTarget ?? 30, crashMultiplierAt(elapsed))));
      frame = requestAnimationFrame(tick);
    };
    const pollStatus = async () => {
      if (pollBusy || cashoutPending.current) return;
      pollBusy = true;
      try {
        const status = await callGamble({ action: "crash-status", roundId });
        if (cancelled || cashoutPending.current || activeRound.current !== roundId) return;
        if (status.settled || status.crashed) acceptResult(status, roundId);
        else {
          clock.current.server = Number(status.estimatedServerNow);
          clock.current.received = Number(status.receivedAt);
          if (typeof status.startsAtMs === "number") clock.current.start = status.startsAtMs;
        }
      } catch {
        // Keep the immutable target and the manual retry available after a lost poll.
      } finally { pollBusy = false; }
    };
    frame = requestAnimationFrame(tick);
    const timer = window.setInterval(() => void pollStatus(), 650);
    return () => { cancelled = true; cancelAnimationFrame(frame); clearInterval(timer); };
  }, [roundId, cashingOut, activeTarget, acceptResult]);

  useEffect(() => () => { activeRound.current = null; }, []);

  const open = () => onPlay(async () => {
    setLine(null);
    setWin(null);
    setCrashed(false);
    const target = autoCashoutEnabled ? Number(autoCashout) : null;
    if (target !== null && (!Number.isFinite(target) || target < 1.1 || target > 30)) {
      setLine({ text: "Choose a take point from 1.10x to 30x, or turn off automatic taking.", tone: "info" });
      return;
    }
    try {
      const result = await callGamble({ action: "crash-open", bet, autoCashout: target });
      if (result.profile && onProfile) onProfile(result.profile);
      const id = String(result.roundId);
      clock.current = { start: Number(result.startsAtMs), server: Number(result.estimatedServerNow), received: Number(result.receivedAt) };
      completed.current = null;
      cashoutPending.current = false;
      activeRound.current = id;
      setDisplay(1);
      setCountdown(Math.max(0, Math.ceil((clock.current.start - clock.current.server) / 1000)));
      setActiveTarget(typeof result.autoCashout === "number" ? result.autoCashout : result.resumed ? null : target);
      setCashingOut(false);
      setRoundId(id);
    } catch (error) {
      setLine({ text: error instanceof Error ? error.message : "The table refused.", tone: "info" });
    }
  });

  const cashout = async () => {
    if (!roundId || cashoutPending.current || countdown > 0) return;
    const id = roundId;
    cashoutPending.current = true;
    setCashingOut(true);
    setLine(null);
    try {
      const result = await callGamble({ action: "crash-cashout", requestedMultiplier: display, roundId: id });
      acceptResult(result, id);
    } catch (error) {
      cashoutPending.current = false;
      setCashingOut(false);
      setLine({ text: error instanceof Error ? error.message : "Connection interrupted. You can try taking again.", tone: "info" });
    }
  };

  const viewDisplay = display;
  const viewCountdown = countdown;
  const viewCrashed = crashed;
  const graphProgress = Math.min(1, Math.log(Math.max(1,viewDisplay)) / Math.log(30));
  return (
    <CasinoTableFrame label="The longer you wait, the higher the risk" phase={countdown ? "Get ready" : roundId ? "Live" : line ? "Result" : "Ready"} result={<>{line ? <ResultLine {...line} /> : null}{win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}</>} controls={<>
      <CasinoMetric label="Your stake" value={bet.toLocaleString()} detail="Coins · cash out before the crash" />
      {!roundId ? <><label className={c.autoControl}><input checked={autoCashoutEnabled} disabled={busy} onChange={event => setAutoCashoutEnabled(event.target.checked)} type="checkbox" />Take automatically</label>{autoCashoutEnabled ? <><label className={c.targetInput}><input aria-label="Automatic cashout multiplier" disabled={busy} max="30" min="1.10" onChange={event => setAutoCashout(event.target.value)} step="0.05" type="number" value={autoCashout} />×</label><input aria-label="Adjust automatic cashout" className={c.targetRange} disabled={busy} max="30" min="1.10" onChange={event => setAutoCashout(event.target.value)} step="0.05" type="range" value={autoCashout} /></> : null}</> : null}
      <p className={c.controlCopy}>{roundId ? "You can take earlier. A crash before your take point loses the stake." : autoCashoutEnabled ? "Your chosen take point applies to the next round." : "Manual play. Choose when to take your coins."}</p>
      {roundId ? <button className={c.action} disabled={cashingOut || countdown > 0} onClick={() => void cashout()} type="button">{cashingOut ? "Taking…" : countdown ? `Beginning in ${countdown}…` : `Cash out at ${display.toFixed(2)}×`}</button> : <button className={c.action} disabled={busy} onClick={open} type="button">Test her patience</button>}

    </>}>
      <div className={c.patienceStage} data-crashed={viewCrashed}><Image alt="Principessa watching the table" className={c.patiencePortrait} height={450} src="/principessa-ui/principessa-gaze.webp" width={360} /><svg aria-hidden="true" className={c.patienceGraph} preserveAspectRatio="none" viewBox="0 0 400 300"><path d="M0 250H400 M0 200H400 M0 150H400 M0 100H400" stroke="#c2a3bd22" strokeWidth=".5" /><path d="M15 280 Q170 275 380 25" fill="none" pathLength="1" stroke={viewCrashed ? "#d998b6" : "#d6b4cf"} strokeDasharray="1" strokeDashoffset={1-graphProgress} strokeWidth="3" /></svg><div className={c.patienceReadout}><p>{viewCountdown ? "Get ready" : viewCrashed ? "Her verdict" : win ? "Taken in time" : "Under her gaze"}</p><strong>{viewCountdown > 0 ? viewCountdown : `${viewDisplay.toFixed(2)}×`}</strong><small>{viewCrashed ? "Patience spent." : roundId && activeTarget ? `Taking at ${activeTarget.toFixed(2)}×` : roundId ? "Your decision." : "The table awaits."}</small></div></div>
    </CasinoTableFrame>
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

  const viewRacing = racing;
  const viewProgress = progress;
  const viewLane = lane;
  return (
    <CasinoTableFrame label="Four collars · one finish line" phase={racing ? "Racing" : raceId ? "Choose a collar" : line ? "Result" : "Ready"} result={<>{line ? <ResultLine {...line} /> : null}{win ? <DoubleBanner onDone={() => setWin(null)} onProfile={onProfile} payout={win.payout} roundId={win.roundId} /> : null}</>} controls={<>
      <CasinoMetric label="Your stake" value={bet.toLocaleString()} detail="Coins · odds appear on the race sheet" />
      <div className={c.laneChoices}>{CRAWL_LANES.map((entry,index) => <button aria-pressed={viewLane === index} disabled={!raceId || racing || busy} key={entry.id} onClick={() => void placeBet(index)} style={{color:entry.color}} type="button"><span>{entry.label}</span><small>{odds ? `${odds[index]}×` : "—"}</small></button>)}</div>
      {!raceId && !racing ? <button className={c.action} disabled={busy} onClick={draw} type="button">Draw a race sheet</button> : raceId ? <p className={c.controlCopy}>Pick a collar · {bet.toLocaleString()} coins</p> : null}

    </>}>
      <div className={c.raceField}><div className={c.raceBanner}><span>The starting line</span><span>Principessa awaits</span></div>{CRAWL_LANES.map((entry,index) => <div className={c.raceRow} data-selected={viewLane === index} data-winner={!viewRacing && viewProgress[index] >= 100} key={entry.id}><span className={c.raceBadge} style={{color:entry.color}}>{index+1}</span><div className={c.raceLane}><span aria-hidden="true" className={c.raceFinish} /><div className={c.runnerWrap} style={{left:"calc("+viewProgress[index]+"% - "+(viewProgress[index]*.65)+"px)"}}><CasinoRunner color={entry.color} audible={viewLane === index} running={viewRacing && viewProgress[index] < 100} /></div></div><span className="h-6 w-6 shrink-0 text-pink-200/60"><CourtGlyph /></span></div>)}<div className={c.raceFooter}><span>{viewRacing ? "Every collar is moving." : "Choose who you believe will reach her."}</span><span>Finish →</span></div></div>
    </CasinoTableFrame>
  );
}type TableProps = {
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
  { art: "/gamble/v5/slots.webp", blurb: "Three reels. Match her symbols.", edge: "RTP 81.7%", id: "slots", kicker: "The curtain rises", objectPosition: "center", symbol: "🎰", tag: "Popular", title: "Her Reels", tone: "pink" },
  { art: "/gamble/v5/dice.webp", blurb: "Roll higher than Principessa.", edge: "RTP 81.6%", id: "dice", kicker: "Challenge her", objectPosition: "center", symbol: "🎲", tag: "Hot", title: "Her Dice", tone: "violet" },
  { art: "/gamble/v5/roulette.webp", blurb: "European roulette. Choose your bet.", edge: "RTP 81.7%", id: "roulette", kicker: "Place your bet", objectPosition: "center", symbol: "◎", tag: "Classic", title: "Court Roulette", tone: "amber" },
  { art: "/gamble/v5/plinko.webp", blurb: "Drop through twelve rows of pegs.", edge: "RTP 81.4%", id: "plinko", kicker: "Drop for her", objectPosition: "center", symbol: "◆", tag: "Live", title: "Royal Plinko", tone: "cyan" },
  { art: "/gamble/v5/mines.webp", blurb: "Find gems. Avoid the traps.", edge: "RTP 82%", id: "mines", kicker: "Take what you dare", objectPosition: "center", symbol: "💎", tag: "Risk", title: "The Jewelry Box", tone: "emerald" },
  { art: "/gamble/v5/crash.webp", blurb: "Cash out before the crash.", edge: "RTP 82%", id: "crash", kicker: "Test her patience", objectPosition: "center", symbol: "♥", tag: "Push", title: "Her Patience", tone: "rose" },
  { art: "/gamble/v5/crawl.webp", blurb: "Back one collar to reach her first.", edge: "RTP 82%", id: "crawl", kicker: "The court watches", objectPosition: "center", symbol: "♛", tag: "Court", title: "The Crawl", tone: "violet" },
] as const;

function TableCard({ children, game }: { children: React.ReactNode; game: TablePresentation }) {
  return <div className={c.frame}><header className={c.frameHeader}><Image alt={game.title+" hosted by Principessa"} className={c.frameArt} height={90} src={game.art} style={{objectPosition:game.objectPosition}} width={90} /><div><p>{game.kicker}</p><h3>{game.title}</h3><small>{game.blurb}</small></div><span className={c.rtp}>{game.edge}</span></header>{children}</div>;
}

export function GambleHall({disabled=false,onProfile}:HallProps) {
  const [bet,setBet]=useState(250);
  const [busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  const [activeTable,setActiveTable]=useState<TableId>("slots");
  const [visited,setVisited]=useState<TableId[]>(["slots"]);
  const onPlay=useCallback((run:()=>Promise<void>)=>{
    if(disabled||busyRef.current)return;
    busyRef.current=true;
    setBusy(true);
    void run().finally(()=>{busyRef.current=false;setBusy(false);});
  },[disabled]);
  const tableProps:TableProps={bet,busy:busy||disabled,onPlay,onProfile};
  const select=(id:TableId)=>{
    setActiveTable(id);
    setVisited(current=>current.includes(id)?current:[...current,id]);
    requestAnimationFrame(()=>document.getElementById("table-"+id)?.scrollIntoView({block:"start",behavior:"instant"}));
  };
  const renderTable=(id:TableId)=>{
    switch(id){
      case "dice":return <DiceTable {...tableProps}/>;
      case "roulette":return <RouletteTable {...tableProps}/>;
      case "plinko":return <PlinkoTable {...tableProps}/>;
      case "mines":return <MinesTable {...tableProps}/>;
      case "crash":return <CrashTable {...tableProps}/>;
      case "crawl":return <CrawlTable {...tableProps}/>;
      default:return <SlotsTable {...tableProps}/>;
    }
  };
  return <section className={`${styles.surface} ${styles.casino} ${c.hall}`} id="gamble-tables">
    <div className={c.hallHeading}><h2>Gamble Hall</h2><p>Seven games · Maximum RTP 82%</p></div>
    <nav className={c.tableSwitcher} aria-label="Choose a casino game">
      {TABLE_PRESENTATIONS.map(game=><button key={game.id} type="button" aria-pressed={activeTable===game.id} aria-controls={"table-"+game.id} onClick={()=>select(game.id)} data-table-choice={game.id}>
        <Image src={game.art} alt="" width={240} height={140} sizes="(max-width:700px) 100px, 180px" quality={85} style={{objectPosition:game.objectPosition}}/><span>{game.title}</span>
      </button>)}
    </nav>
    {TABLE_PRESENTATIONS.filter(game=>visited.includes(game.id)).map(game=><div className={c.tablePanel} key={game.id} id={"table-"+game.id} hidden={activeTable!==game.id}>
      <TableCard game={game}>
        <div className={c.stakeBar}><span>Stake · Coins</span>{BET_CHIPS.map(chip=><button key={chip} type="button" disabled={busy||disabled} onClick={()=>setBet(chip)} aria-pressed={bet===chip}>{chip.toLocaleString()}</button>)}<input aria-label="Stake amount" disabled={busy||disabled} type="range" min={GAMBLE_MIN_BET} max={GAMBLE_MAX_BET} step={GAMBLE_MIN_BET} value={bet} onChange={event=>setBet(Number(event.target.value))}/><small>{GAMBLE_MIN_BET.toLocaleString()}–{GAMBLE_MAX_BET.toLocaleString()} per round</small></div>
        {renderTable(game.id)}
      </TableCard>
    </div>)}
  </section>;
}
