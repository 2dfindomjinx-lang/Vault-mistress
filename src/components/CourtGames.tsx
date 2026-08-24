"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  COURT_GAME_IDS,
  COURT_GAME_RULES,
  type CourtGameId,
  type CourtGameMetrics,
} from "@/lib/court-games";
import { emitSoundEvent } from "@/lib/sound";

type GameStatus = {
  cooldownUntil: string | null;
  gameId: CourtGameId;
  reward: number;
};

type ActiveGame = {
  gameId: CourtGameId;
  sessionId: string;
};

type CourtGamesProps = {
  coins: number;
  disabled?: boolean;
  guestMode?: boolean;
  onReward: (nextCoins: number, rewardCoins: number, gameTitle: string) => void;
};

const GAME_CARD_COPY: Record<CourtGameId, { eyebrow: string; glyph: string; summary: string }> = {
  "principessa-says": {
    eyebrow: "Eight deceptive rounds",
    glyph: "♛",
    summary: "Obey only when the order begins with “Principessa Says”. Buttons, timed writing and traps await.",
  },
  "crown-match": {
    eyebrow: "Six hidden pairs",
    glyph: "♕",
    summary: "Turn over the court seals and match every royal pair with as few mistakes as possible.",
  },
  "royal-guard": {
    eyebrow: "Protect her court",
    glyph: "⚔",
    summary: "Strike incoming threats and keep your hands off Principessa’s royal symbols.",
  },
};

function formatCooldown(value: string | null, now: number) {
  if (!value) return null;
  const milliseconds = new Date(value).getTime() - now;
  if (milliseconds <= 0) return null;
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`;
}

function shuffled<T>(items: readonly T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function CourtGames({ coins, disabled = false, guestMode = false, onReward }: CourtGamesProps) {
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [error, setError] = useState("");
  const [loadingGameId, setLoadingGameId] = useState<CourtGameId | null>(null);
  const [statuses, setStatuses] = useState<GameStatus[]>(
    COURT_GAME_IDS.map((gameId) => ({ cooldownUntil: null, gameId, reward: COURT_GAME_RULES[gameId].reward })),
  );
  const [guestClaimed, setGuestClaimed] = useState<CourtGameId[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (guestMode) return;
    let cancelled = false;
    void fetch("/api/user/court-games", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { games?: GameStatus[] } | null;
        if (!cancelled && response.ok && payload?.games) setStatuses(payload.games);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [guestMode]);

  const startGame = useCallback(async (gameId: CourtGameId) => {
    setError("");
    setLoadingGameId(gameId);
    emitSoundEvent("button_click");
    try {
      if (guestMode) {
        setActiveGame({ gameId, sessionId: `guest-${gameId}` });
        return;
      }

      const response = await fetch("/api/user/court-games", {
        body: JSON.stringify({ action: "start", gameId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { cooldownUntil?: string; error?: string; sessionId?: string }
        | null;
      if (!response.ok || !payload?.sessionId) {
        if (payload?.cooldownUntil) {
          setStatuses((current) => current.map((status) => status.gameId === gameId
            ? { ...status, cooldownUntil: payload.cooldownUntil ?? null }
            : status));
        }
        throw new Error(payload?.error ?? "The game could not begin.");
      }
      setActiveGame({ gameId, sessionId: payload.sessionId });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The game could not begin.");
    } finally {
      setLoadingGameId(null);
    }
  }, [guestMode]);

  const finishGame = useCallback(async (gameId: CourtGameId, sessionId: string, metrics: CourtGameMetrics) => {
    setError("");
    if (guestMode) {
      if (!guestClaimed.includes(gameId)) {
        const rewardCoins = COURT_GAME_RULES[gameId].reward;
        setGuestClaimed((current) => [...current, gameId]);
        onReward(coins + rewardCoins, rewardCoins, COURT_GAME_RULES[gameId].title);
      }
      return COURT_GAME_RULES[gameId].reward;
    }

    const response = await fetch("/api/user/court-games", {
      body: JSON.stringify({ action: "complete", gameId, metrics, sessionId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as
      | { cooldownUntil?: string; error?: string; profile?: { coins?: number }; rewardCoins?: number }
      | null;
    if (!response.ok || typeof payload?.rewardCoins !== "number" || typeof payload.profile?.coins !== "number") {
      throw new Error(payload?.error ?? "The reward could not be claimed.");
    }

    setStatuses((current) => current.map((status) => status.gameId === gameId
      ? { ...status, cooldownUntil: payload.cooldownUntil ?? null, reward: payload.rewardCoins ?? status.reward }
      : status));
    onReward(payload.profile.coins, payload.rewardCoins, COURT_GAME_RULES[gameId].title);
    return payload.rewardCoins;
  }, [coins, guestClaimed, guestMode, onReward]);

  const activeProps = activeGame
    ? {
        disabled,
        onClose: () => setActiveGame(null),
        onComplete: (metrics: CourtGameMetrics) => finishGame(activeGame.gameId, activeGame.sessionId, metrics),
      }
    : null;

  return (
    <section className="court-games-panel relative min-w-0 overflow-hidden rounded-[2rem] border border-[#d7ad69]/20 bg-[radial-gradient(circle_at_85%_0%,rgba(190,24,93,.24),transparent_32%),linear-gradient(145deg,rgba(17,6,13,.98),rgba(3,2,4,.98))] p-5 shadow-[0_0_48px_rgba(190,24,93,.13)]">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-[#d7ad69]/10 court-game-orbit" />
      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.32em] text-[#d7ad69]/60">Principessa&apos;s arcade</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-[#fff0d2]">Court Games</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Earn her approval. Clear each game once per day for its Coin reward.</p>
        </div>
        <div className="rounded-full border border-pink-200/15 bg-pink-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.16em] text-pink-100">
          3 daily games
        </div>
      </div>

      {error && <p className="relative mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">{error}</p>}

      {activeGame && activeProps ? (
        <div className="relative mt-5">
          {activeGame.gameId === "principessa-says" && <PrincipessaSays {...activeProps} />}
          {activeGame.gameId === "crown-match" && <CrownMatch {...activeProps} />}
          {activeGame.gameId === "royal-guard" && <RoyalGuard {...activeProps} />}
        </div>
      ) : (
        <div className="relative mt-5 grid gap-3 lg:grid-cols-3">
          {COURT_GAME_IDS.map((gameId) => {
            const status = statuses.find((entry) => entry.gameId === gameId);
            const cooldown = guestClaimed.includes(gameId) ? "Today" : formatCooldown(status?.cooldownUntil ?? null, now);
            const copy = GAME_CARD_COPY[gameId];
            return (
              <article className="court-game-card group relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[.045] p-4 transition hover:-translate-y-0.5 hover:border-pink-200/30" key={gameId}>
                <div className="pointer-events-none absolute -right-6 -top-8 text-[7rem] text-pink-300/[.035] transition group-hover:scale-110 group-hover:text-pink-300/[.07]">{copy.glyph}</div>
                <div className="relative flex items-start justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d7ad69]/25 bg-black/35 text-2xl text-[#efc880] shadow-[0_0_22px_rgba(215,173,105,.1)]">{copy.glyph}</span>
                  <span className="rounded-full border border-emerald-200/15 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-100">+{COURT_GAME_RULES[gameId].reward}</span>
                </div>
                <p className="relative mt-4 text-[9px] font-black uppercase tracking-[.2em] text-pink-200/50">{copy.eyebrow}</p>
                <h3 className="relative mt-1 font-serif text-2xl text-white">{COURT_GAME_RULES[gameId].title}</h3>
                <p className="relative mt-2 min-h-20 text-sm leading-6 text-zinc-400">{copy.summary}</p>
                <button
                  className="relative mt-4 w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-black text-pink-50 transition enabled:hover:border-pink-200/55 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={disabled || Boolean(cooldown) || loadingGameId !== null}
                  onClick={() => void startGame(gameId)}
                  type="button"
                >
                  {loadingGameId === gameId ? "Entering..." : cooldown ? `Available ${cooldown === "Today" ? "tomorrow" : `in ${cooldown}`}` : "Play"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

type MiniGameProps = {
  disabled: boolean;
  onClose: () => void;
  onComplete: (metrics: CourtGameMetrics) => Promise<number>;
};

type SaysRound = {
  action: "bow" | "kneel" | "still" | "type";
  command: string;
  expectedText?: string;
  shouldObey: boolean;
  timeMs: number;
};

const SAYS_ROUNDS: readonly SaysRound[] = [
  { action: "kneel", command: "Principessa Says: Kneel.", shouldObey: true, timeMs: 4_500 },
  { action: "bow", command: "Bow for Principessa.", shouldObey: false, timeMs: 4_000 },
  { action: "type", command: "Principessa Says: Type “Meow, Principessa.”", expectedText: "Meow, Principessa.", shouldObey: true, timeMs: 7_000 },
  { action: "type", command: "Principessa wants you to type “Woof!”", expectedText: "Woof!", shouldObey: false, timeMs: 5_000 },
  { action: "bow", command: "Principessa Says: Bow.", shouldObey: true, timeMs: 4_000 },
  { action: "still", command: "Principessa Says: Do not move.", shouldObey: true, timeMs: 4_000 },
  { action: "type", command: "Principessa Says: Type “Woof! Woof!”", expectedText: "Woof! Woof!", shouldObey: true, timeMs: 7_000 },
  { action: "kneel", command: "Kneel. Principessa is watching.", shouldObey: false, timeMs: 4_000 },
];

function PrincipessaSays({ disabled, onClose, onComplete }: MiniGameProps) {
  const [rounds] = useState(() => shuffled(SAYS_ROUNDS));
  const [roundIndex, setRoundIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [remainingMs, setRemainingMs] = useState(rounds[0].timeMs);
  const [typingValue, setTypingValue] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [result, setResult] = useState<"failed" | "reward" | null>(null);
  const [reward, setReward] = useState(0);
  const [saving, setSaving] = useState(false);
  const resolvedRef = useRef(false);
  const resolveRoundRef = useRef<(correct: boolean) => void>(() => undefined);
  const round = rounds[roundIndex];

  const resolveRound = useCallback((correct: boolean) => {
    if (resolvedRef.current || result) return;
    resolvedRef.current = true;
    const nextScore = score + (correct ? 1 : 0);
    const nextMistakes = mistakes + (correct ? 0 : 1);
    setScore(nextScore);
    setMistakes(nextMistakes);
    setFeedback(correct ? "correct" : "wrong");
    emitSoundEvent(correct ? "task_completion" : "task_fail");

    window.setTimeout(() => {
      if (roundIndex < rounds.length - 1) {
        const nextIndex = roundIndex + 1;
        resolvedRef.current = false;
        setTypingValue("");
        setFeedback(null);
        setRoundIndex(nextIndex);
        setRemainingMs(rounds[nextIndex].timeMs);
        return;
      }

      if (nextScore < COURT_GAME_RULES["principessa-says"].requiredScore) {
        setResult("failed");
        return;
      }

      setSaving(true);
      void onComplete({ mistakes: nextMistakes, roundsCompleted: rounds.length, score: nextScore })
        .then((rewardCoins) => {
          setReward(rewardCoins);
          setResult("reward");
          emitSoundEvent("task_completion");
        })
        .catch(() => setResult("failed"))
        .finally(() => setSaving(false));
    }, 550);
  }, [mistakes, onComplete, result, roundIndex, rounds, score]);

  useEffect(() => {
    resolveRoundRef.current = resolveRound;
  }, [resolveRound]);

  useEffect(() => {
    if (feedback || result) return;
    const deadline = Date.now() + round.timeMs;
    const interval = window.setInterval(() => setRemainingMs(Math.max(0, deadline - Date.now())), 100);
    const timer = window.setTimeout(() => {
      const correctToWait = !round.shouldObey || round.action === "still";
      resolveRoundRef.current(correctToWait);
    }, round.timeMs);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timer);
    };
  }, [feedback, result, round, roundIndex]);

  const pressAction = (action: "bow" | "kneel") => {
    if (disabled || feedback || result) return;
    resolveRound(!round.shouldObey ? false : round.action === action);
  };

  const submitText = () => {
    if (disabled || feedback || result) return;
    resolveRound(round.shouldObey && round.action === "type" && typingValue === round.expectedText);
  };

  return (
    <GameStageShell onClose={onClose} title="Principessa Says" subtitle="Obey only when she says the words.">
      {result ? (
        <GameResult failed={result === "failed"} onClose={onClose} reward={reward} score={`${score}/${rounds.length}`} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <PrincipessaStageImage mood={feedback} />
          <div className="min-w-0 rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
            <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[.18em] text-pink-100/60">
              <span>Round {roundIndex + 1}/{rounds.length}</span><span>{Math.ceil(remainingMs / 1000)}s</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/60"><div className="h-full bg-[linear-gradient(90deg,#d7ad69,#ec4899)] transition-[width]" style={{ width: `${(remainingMs / round.timeMs) * 100}%` }} /></div>
            <div className={`court-command-pop mt-5 rounded-2xl border px-4 py-5 text-center ${feedback === "correct" ? "border-emerald-300/35 bg-emerald-500/10" : feedback === "wrong" ? "border-rose-300/35 bg-rose-500/10" : "border-pink-200/20 bg-pink-500/10"}`}>
              <p className="font-serif text-xl leading-8 text-[#fff0d2]">{round.command}</p>
              {feedback && <p className={`mt-2 text-xs font-black uppercase tracking-[.2em] ${feedback === "correct" ? "text-emerald-200" : "text-rose-200"}`}>{feedback === "correct" ? "Good. You listened." : "Wrong. She caught you."}</p>}
            </div>
            {round.action === "type" ? (
              <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); submitText(); }}>
                <input
                  autoComplete="off"
                  autoFocus
                  className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none focus:border-pink-300/55"
                  disabled={disabled || Boolean(feedback) || saving}
                  onChange={(event) => {
                    setTypingValue(event.target.value);
                    if (!round.shouldObey && event.target.value.length > 0) resolveRound(false);
                  }}
                  placeholder="Type only if Principessa Says..."
                  value={typingValue}
                />
                <button className="rounded-2xl border border-pink-200/25 bg-pink-500/15 px-4 font-black text-pink-50 disabled:opacity-40" disabled={!typingValue || saving} type="submit">Submit</button>
              </form>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button className="court-action-button" disabled={disabled || Boolean(feedback) || saving} onClick={() => pressAction("kneel")} type="button"><span>♟</span>Kneel</button>
                <button className="court-action-button" disabled={disabled || Boolean(feedback) || saving} onClick={() => pressAction("bow")} type="button"><span>♜</span>Bow</button>
              </div>
            )}
            <p className="mt-4 text-center text-xs text-zinc-500">If she did not say “Principessa Says”, touch nothing and let the timer expire.</p>
          </div>
        </div>
      )}
    </GameStageShell>
  );
}

const CROWN_SYMBOLS = ["♛", "♦", "♥", "✦", "⚜", "◈"] as const;

function CrownMatch({ disabled, onClose, onComplete }: MiniGameProps) {
  const [cards] = useState(() => shuffled(CROWN_SYMBOLS.flatMap((symbol) => [symbol, symbol])).map((symbol, index) => ({ id: index, symbol })));
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [reward, setReward] = useState(0);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const finishedRef = useRef(false);

  const chooseCard = (id: number) => {
    if (disabled || saving || open.length >= 2 || open.includes(id) || matched.includes(id)) return;
    emitSoundEvent("button_click");
    const nextOpen = [...open, id];
    setOpen(nextOpen);
    if (nextOpen.length < 2) return;
    setMoves((value) => value + 1);
    const [first, second] = nextOpen;
    if (cards[first].symbol === cards[second].symbol) {
      window.setTimeout(() => {
        setMatched((current) => [...current, first, second]);
        setOpen([]);
        emitSoundEvent("task_completion");
      }, 350);
    } else {
      window.setTimeout(() => setOpen([]), 750);
    }
  };

  useEffect(() => {
    if (matched.length !== cards.length || finishedRef.current) return;
    finishedRef.current = true;
    setSaving(true);
    void onComplete({ mistakes: Math.max(0, moves - CROWN_SYMBOLS.length), roundsCompleted: CROWN_SYMBOLS.length, score: CROWN_SYMBOLS.length })
      .then(setReward)
      .catch(() => setFailed(true))
      .finally(() => setSaving(false));
  }, [cards.length, matched.length, moves, onComplete]);

  return (
    <GameStageShell onClose={onClose} title="Crown Match" subtitle="Reveal and pair every seal in Principessa’s court.">
      {reward > 0 || failed ? (
        <GameResult failed={failed} onClose={onClose} reward={reward} score={`${moves} moves`} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <PrincipessaStageImage mood={matched.length === cards.length ? "correct" : null} />
          <div className="rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-[.18em] text-pink-100/60"><span>{matched.length / 2}/6 pairs</span><span>{moves} moves</span></div>
            <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {cards.map((card) => {
                const visible = open.includes(card.id) || matched.includes(card.id);
                return (
                  <button
                    aria-label={visible ? `Revealed ${card.symbol}` : "Hidden court seal"}
                    className={`court-match-card aspect-[3/4] rounded-xl border text-2xl transition ${visible ? "court-match-card--open border-[#d7ad69]/45 bg-[radial-gradient(circle,#831843,#17060f)] text-[#ffe3a4]" : "border-pink-200/15 bg-[linear-gradient(145deg,#240713,#090306)] text-pink-200/25 hover:border-pink-200/40"}`}
                    disabled={disabled || saving || matched.includes(card.id)}
                    key={card.id}
                    onClick={() => chooseCard(card.id)}
                    type="button"
                  >
                    {visible ? card.symbol : "P"}
                  </button>
                );
              })}
            </div>
            {saving && <p className="mt-4 text-center text-sm font-black text-emerald-100">Principessa is granting your reward...</p>}
          </div>
        </div>
      )}
    </GameStageShell>
  );
}

type GuardTarget = { glyph: string; label: string; threat: boolean };
const GUARD_THREATS: readonly GuardTarget[] = [
  { glyph: "☠", label: "Intruder", threat: true },
  { glyph: "⚡", label: "Sabotage", threat: true },
  { glyph: "✖", label: "Threat", threat: true },
];
const GUARD_ROYALS: readonly GuardTarget[] = [
  { glyph: "♛", label: "Her Crown", threat: false },
  { glyph: "♥", label: "Her Favor", threat: false },
  { glyph: "✦", label: "Royal Seal", threat: false },
];

function RoyalGuard({ disabled, onClose, onComplete }: MiniGameProps) {
  const [targets] = useState(() => Array.from({ length: 18 }, (_, index) => {
    const pool = index % 3 === 0 ? GUARD_ROYALS : Math.random() > 0.46 ? GUARD_THREATS : GUARD_ROYALS;
    return pool[Math.floor(Math.random() * pool.length)];
  }));
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [locked, setLocked] = useState(false);
  const [reward, setReward] = useState(0);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const target = targets[index];
  const resolveRef = useRef<(hit: boolean) => void>(() => undefined);

  const finish = useCallback((nextScore: number, nextMistakes: number) => {
    if (nextScore < COURT_GAME_RULES["royal-guard"].requiredScore) {
      setFailed(true);
      return;
    }
    setSaving(true);
    void onComplete({ mistakes: nextMistakes, roundsCompleted: targets.length, score: nextScore })
      .then(setReward)
      .catch(() => setFailed(true))
      .finally(() => setSaving(false));
  }, [onComplete, targets.length]);

  const resolveTarget = useCallback((hit: boolean) => {
    if (locked || saving || !target) return;
    setLocked(true);
    const correct = target.threat ? hit : !hit;
    const nextScore = score + (correct ? 1 : 0);
    const nextMistakes = mistakes + (correct ? 0 : 1);
    setScore(nextScore);
    setMistakes(nextMistakes);
    emitSoundEvent(correct ? "button_click" : "task_fail");
    window.setTimeout(() => {
      if (index >= targets.length - 1) {
        finish(nextScore, nextMistakes);
      } else {
        setIndex((value) => value + 1);
        setLocked(false);
      }
    }, 180);
  }, [finish, index, locked, mistakes, saving, score, target, targets.length]);
  useEffect(() => {
    resolveRef.current = resolveTarget;
  }, [resolveTarget]);

  useEffect(() => {
    if (failed || reward || saving) return;
    const timer = window.setTimeout(() => resolveRef.current(false), 720);
    return () => window.clearTimeout(timer);
  }, [failed, index, reward, saving]);

  return (
    <GameStageShell onClose={onClose} title="Royal Guard" subtitle="Strike threats. Never strike her crown, favor or seal.">
      {reward > 0 || failed ? (
        <GameResult failed={failed} onClose={onClose} reward={reward} score={`${score}/${targets.length}`} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <PrincipessaStageImage mood={mistakes > 0 ? "wrong" : null} />
          <div className="rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-[.18em] text-pink-100/60"><span>Wave {index + 1}/{targets.length}</span><span>{score} guarded</span></div>
            <div className="relative mt-4 flex min-h-64 items-center justify-center overflow-hidden rounded-[1.5rem] border border-pink-200/15 bg-[radial-gradient(circle_at_center,rgba(190,24,93,.22),rgba(0,0,0,.75))]">
              <div className="court-guard-sweep absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-pink-300/10 to-transparent" />
              <button
                className={`court-guard-target relative flex h-36 w-36 flex-col items-center justify-center rounded-full border-2 ${target.threat ? "border-rose-300/55 bg-rose-950/70 text-rose-100" : "border-[#d7ad69]/55 bg-amber-950/50 text-[#ffe3a4]"}`}
                disabled={disabled || locked || saving}
                key={index}
                onClick={() => resolveTarget(true)}
                type="button"
              >
                <span className="text-6xl">{target.glyph}</span><span className="mt-2 text-[10px] font-black uppercase tracking-[.18em]">{target.label}</span>
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-zinc-500">Threats must be clicked before they pass. Royal symbols must pass untouched.</p>
          </div>
        </div>
      )}
    </GameStageShell>
  );
}

function GameStageShell({ children, onClose, subtitle, title }: { children: React.ReactNode; onClose: () => void; subtitle: string; title: string }) {
  return (
    <div className="rounded-[1.75rem] border border-pink-200/15 bg-black/40 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><p className="text-[9px] font-black uppercase tracking-[.25em] text-[#d7ad69]/60">Now playing</p><h3 className="font-serif text-2xl text-[#fff0d2]">{title}</h3><p className="mt-1 text-xs text-zinc-500">{subtitle}</p></div>
        <button aria-label="Close game" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-zinc-400 hover:border-pink-200/40 hover:text-white" onClick={onClose} type="button">×</button>
      </div>
      {children}
    </div>
  );
}

function PrincipessaStageImage({ mood }: { mood: "correct" | "wrong" | null }) {
  return (
    <div className={`court-principessa-stage relative min-h-72 overflow-hidden rounded-[1.5rem] border bg-[radial-gradient(circle_at_50%_25%,rgba(236,72,153,.2),rgba(0,0,0,.72))] ${mood === "correct" ? "border-emerald-300/30" : mood === "wrong" ? "border-rose-300/30 court-game-shake" : "border-pink-200/15"}`}>
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/25 to-transparent" />
      <Image alt="Principessa overseeing the game" className="object-contain object-bottom court-principessa-float" fill sizes="240px" src="/principessa-ui/generated/principessa-home-command.webp" />
      <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-black/65 px-3 py-2 text-center backdrop-blur">
        <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#d7ad69]/70">Under her gaze</p>
        <p className={`mt-1 text-sm font-black ${mood === "correct" ? "text-emerald-200" : mood === "wrong" ? "text-rose-200" : "text-pink-50"}`}>{mood === "correct" ? "Approved" : mood === "wrong" ? "Disappointed" : "Do not disappoint her"}</p>
      </div>
    </div>
  );
}

function GameResult({ failed, onClose, reward, score }: { failed: boolean; onClose: () => void; reward: number; score: string }) {
  return (
    <div className={`court-command-pop mx-auto max-w-xl rounded-[1.75rem] border p-6 text-center ${failed ? "border-rose-300/25 bg-rose-500/10" : "border-emerald-300/25 bg-emerald-500/10"}`}>
      <div className="text-5xl">{failed ? "✕" : "♛"}</div>
      <h4 className="mt-3 font-serif text-3xl text-white">{failed ? "Principessa is not impressed" : "Principessa approves"}</h4>
      <p className="mt-2 text-sm text-zinc-300">Score: {score}</p>
      <p className={`mt-3 text-lg font-black ${failed ? "text-rose-200" : "text-emerald-200"}`}>{failed ? "No reward. Try the game again." : `+${reward} Principessa Coins`}</p>
      <button className="mt-5 rounded-2xl border border-pink-200/25 bg-pink-500/15 px-6 py-3 text-sm font-black text-pink-50 hover:bg-pink-500/25" onClick={onClose} type="button">Back to Games</button>
    </div>
  );
}
