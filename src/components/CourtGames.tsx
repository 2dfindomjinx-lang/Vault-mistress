"use client";

import Image from "next/image";
import styles from "./CourtGamesExperience.module.css";
import { COURT_GAME_ART, CommandGesture, GameHearts, GameMetric, GamePresence, GameResult, GameStageShell, GameTimer, MemoryCard } from "./CourtGamePresentation";
import {postEconomyAction} from "@/lib/economy-client";
import {createCourtChallenge, CROWN_SYMBOLS, guardWaveDuration, type CourtAction} from "@/lib/court-game-challenges";
import { CourtGlyph } from "@/components/court/CourtVisuals";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CROWN_MATCH_MAX_MISTAKES,
  CROWN_MATCH_PREVIEW_MS,
  CROWN_MATCH_FLIP_MS,
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
  challengeSeed: number;
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
    eyebrow: "Nine hidden pairs",
    glyph: "♕",
    summary: "Nine pairs. Five lives. Take three seconds to remember the royal seals.",
  },
  "royal-guard": {
    eyebrow: "Eighteen waves",
    glyph: "⚔",
    summary: "Threats charge at Principessa. Cut them down before they reach her — and let her gifts through untouched.",
  },
};

const GAME_CARD_ART = COURT_GAME_ART;

function formatCooldown(value: string | null, now: number) {
  if (!value) return null;
  const milliseconds = new Date(value).getTime() - now;
  if (milliseconds <= 0) return null;
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`;
}

export function CourtGames({ coins, disabled = false, guestMode = false, onReward }: CourtGamesProps) {
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [error, setError] = useState("");
  const startingRef = useRef(false);
  const failureRequests = useRef(new Map<CourtGameId, Promise<void>>());
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
    if (startingRef.current) return;
    startingRef.current = true;
    setError("");
    setLoadingGameId(gameId);
    emitSoundEvent("button_click");
    try {
      if (guestMode) {
        setActiveGame({ gameId, sessionId: `guest-${gameId}`,challengeSeed:crypto.getRandomValues(new Uint32Array(1))[0] });
        return;
      }

      await failureRequests.current.get(gameId);
      const response = await fetch("/api/user/court-games", {
        body: JSON.stringify({ action: "start", gameId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { cooldownUntil?: string; error?: string; sessionId?: string; challengeSeed?: number }
        | null;
      if (!response.ok || !payload?.sessionId || !Number.isInteger(payload.challengeSeed)) {
        if (payload?.cooldownUntil) {
          setStatuses((current) => current.map((status) => status.gameId === gameId
            ? { ...status, cooldownUntil: payload.cooldownUntil ?? null }
            : status));
        }
        throw new Error(payload?.error ?? "The game could not begin.");
      }
      setActiveGame({ gameId, sessionId: payload.sessionId, challengeSeed:payload.challengeSeed! });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The game could not begin.");
    } finally {
      startingRef.current = false;
      setLoadingGameId(null);
    }
  }, [guestMode]);

  // Failed attempts can be retried; only a claimed reward starts the daily cooldown.
  const failGame = useCallback((gameId: CourtGameId, sessionId: string) => {
    if (guestMode) return;
    const failure = fetch("/api/user/court-games", {
      body: JSON.stringify({ action: "fail", gameId, sessionId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { cooldownUntil?: string } | null;
        if (payload?.cooldownUntil) {
          setStatuses((current) => current.map((status) => status.gameId === gameId
            ? { ...status, cooldownUntil: payload.cooldownUntil ?? null }
            : status));
        }
      })
      .catch(() => undefined);
    failureRequests.current.set(gameId, failure);
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

    const response = await postEconomyAction("/api/user/court-games", {action:"complete",gameId,metrics,sessionId});
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
        retrying: disabled || loadingGameId !== null,
        retryError: error,
        onRetry: () => void startGame(activeGame.gameId),
        challengeSeed:activeGame.challengeSeed,
        onClose: () => setActiveGame(null),
        onComplete: (metrics: CourtGameMetrics) => finishGame(activeGame.gameId, activeGame.sessionId, metrics),
        onFail: () => failGame(activeGame.gameId, activeGame.sessionId),
      }
    : null;

  return (
    <section className={`court-games-panel ${styles.arcade}`} aria-label="Court Games">
      <header className={styles.lobbyHeader}>
        <div>
          <p className={styles.eyebrow}>Play for her approval</p>
          <h2>Court Games</h2>
          <p>Listen. Remember. Protect her. Claim each game&apos;s Coin reward once per day.</p>
        </div>
        <div className={styles.dailyStamp}><strong>03</strong><span>Ways to impress her</span></div>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {activeGame && (
        <div>
          {activeGame.gameId === "principessa-says" && <PrincipessaSays key={activeGame.sessionId+":"+activeGame.challengeSeed} {...activeProps!} />}
          {activeGame.gameId === "crown-match" && <CrownMatch key={activeGame.sessionId+":"+activeGame.challengeSeed} {...activeProps!} />}
          {activeGame.gameId === "royal-guard" && <RoyalGuard key={activeGame.sessionId+":"+activeGame.challengeSeed} {...activeProps!} />}
        </div>
      )}
      {<div className={styles.lobbyGrid} data-testid="court-game-lobby">
          {COURT_GAME_IDS.map((gameId, index) => {
            const status = statuses.find((entry) => entry.gameId === gameId);
            const cooldown = guestClaimed.includes(gameId) ? "Today" : formatCooldown(status?.cooldownUntil ?? null, now);
            const copy = GAME_CARD_COPY[gameId];
            return (
              <article className={styles.lobbyCard} data-game={gameId} key={gameId}>
                <div className={styles.lobbyScene}>
                  <span className={styles.lobbyNumber}>GAME / 0{index+1}</span>
                  <div className={styles.lobbyPortrait}><Image src={GAME_CARD_ART[gameId]} alt="" fill sizes="(max-width: 760px) 90vw, 30vw" unoptimized/></div>
                  <span className={styles.lobbyGlyph}><CourtGlyph symbol={gameId === "principessa-says" ? "crown" : gameId === "crown-match" ? "seal" : "threat"}/></span>
                  <span className={styles.lobbyType}>{gameId === "principessa-says" ? "Listen" : gameId === "crown-match" ? "Remember" : "Protect"}</span>
                </div>
                <div className={styles.lobbyCardBody}>
                  <h3>{COURT_GAME_RULES[gameId].title}</h3>
                  <p className={styles.lobbyDescription}>{copy.summary}</p>
                  <div className={styles.lobbyFacts}><span>{copy.eyebrow}</span><strong>+{COURT_GAME_RULES[gameId].reward} Coins</strong></div>
                  <button className={styles.playButton} data-testid={`court-play-${gameId}`} disabled={disabled || Boolean(cooldown) || loadingGameId !== null} onClick={() => void startGame(gameId)} type="button">
                    <span>{loadingGameId === gameId ? "Entering..." : cooldown ? `Available ${cooldown === "Today" ? "tomorrow" : `in ${cooldown}`}` : disabled && guestMode ? "Sign in to play" : disabled ? "Timeout active" : `Play ${COURT_GAME_RULES[gameId].title}`}</span><span aria-hidden="true">↗</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>}
    </section>
  );
}

type MiniGameProps = {
  challengeSeed: number;
  disabled: boolean;
  onClose: () => void;
  onComplete: (metrics: CourtGameMetrics) => Promise<number>;
  onFail: () => void;
  onRetry: () => void;
  retrying: boolean;
  retryError: string;
};

function PrincipessaSays({ challengeSeed, disabled, onClose, onComplete, onFail, onRetry, retrying, retryError }: MiniGameProps) {
  const [rounds] = useState(() => createCourtChallenge(challengeSeed).says);
  const actionsRef=useRef<CourtAction[]>([]);
  const [startedAt]=useState(()=>Date.now());
  const [roundIndex, setRoundIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [remainingMs, setRemainingMs] = useState(rounds[0].timeMs);
  const [typingValue, setTypingValue] = useState("");
  const [visualAction, setVisualAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [result, setResult] = useState<"failed" | "reward" | null>(null);
  const [reward, setReward] = useState(0);
  const [saving, setSaving] = useState(false);
  const resolvedRef = useRef(false);
  const resolveRoundRef = useRef<(correct: boolean) => void>(() => undefined);
  const round = rounds[roundIndex];

  const resolveRound = useCallback((correct: boolean, action = "wait") => {
    if (resolvedRef.current || result) return;
    resolvedRef.current = true;
    actionsRef.current.push({action,atMs:Date.now()-startedAt});
    const nextScore = score + (correct ? 1 : 0);
    const nextMistakes = mistakes + (correct ? 0 : 1);
    setScore(nextScore);
    setMistakes(nextMistakes);
    setFeedback(correct ? "correct" : "wrong");
    setVisualAction(action);
    emitSoundEvent(correct ? "button_click" : "task_fail");

    window.setTimeout(() => {
      if (roundIndex < rounds.length - 1) {
        const nextIndex = roundIndex + 1;
        resolvedRef.current = false;
        setTypingValue("");
        setVisualAction(null);
        setFeedback(null);
        setRoundIndex(nextIndex);
        setRemainingMs(rounds[nextIndex].timeMs);
        return;
      }

      if (nextScore < COURT_GAME_RULES["principessa-says"].requiredScore) {
        setResult("failed");
        onFail();
        return;
      }

      setSaving(true);
      void onComplete({ mistakes: nextMistakes, roundsCompleted: rounds.length, score: nextScore, actions:actionsRef.current })
        .then((rewardCoins) => {
          setReward(rewardCoins);
          setResult("reward");
          emitSoundEvent("task_completion");
        })
        .catch(() => setResult("failed"))
        .finally(() => setSaving(false));
    }, 550);
  }, [mistakes, onComplete, onFail, result, roundIndex, rounds, score, startedAt]);

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
    resolveRound(!round.shouldObey ? false : round.action === action, action);
  };

  const submitText = () => {
    if (disabled || feedback || result) return;
    resolveRound(round.shouldObey && round.action === "type" && typingValue === round.expectedText, "type:"+typingValue);
  };

  return (
    <GameStageShell gameId="principessa-says" onClose={onClose} title="Principessa Says" subtitle={`Obey only commands beginning with “Principessa Says”. Otherwise, stay still. ${COURT_GAME_RULES["principessa-says"].requiredScore} correct responses out of ${rounds.length} earn the reward.`}>
      {result ? (
        <GameResult gameId="principessa-says" failed={result === "failed"} onClose={onClose} onRetry={onRetry} retrying={retrying} retryError={retryError} reward={reward} score={`${score}/${rounds.length}`} />
      ) : (
        <div className={styles.playLayout}>
          <GamePresence gameId="principessa-says" mood={feedback} message={feedback === "correct" ? "Good. You listened." : feedback === "wrong" ? "She caught that." : "Every word matters."}/>
          <div className={styles.board}>
            <div className={styles.hud}>
              <GameMetric label="Round" value={<>{roundIndex+1}<small> / {rounds.length}</small></>}/>
              <GameMetric label="Correct" value={score}/>
              <GameMetric label="Mistakes" value={mistakes}/>
            </div>
            <GameTimer remaining={remainingMs} total={round.timeMs}/>
            <div className={styles.command} data-testid="says-command" data-feedback={feedback ?? "waiting"} key={roundIndex}>
              <p>{round.command}</p>
            </div>
            <div className={styles.receipt} data-feedback={feedback ?? "waiting"} aria-live="polite">
              {feedback ? <><strong>{feedback === "correct" ? "✓ Correct response" : "× Wrong response"}</strong><span>{visualAction === "wait" ? (typingValue ? "You began typing." : "You held still.") : visualAction?.startsWith("type:") ? "Your answer was submitted." : visualAction === "kneel" ? "You knelt." : "You bowed."}</span></> : <span>Her words. Your judgement.</span>}
            </div>
            {round.action === "type" ? (
              <form className={styles.answerForm} onSubmit={(event) => { event.preventDefault(); submitText(); }}>
                <label htmlFor="says-answer">Your response</label>
                <div className={styles.answerLine}>
                <input
                  autoComplete="off"
                  id="says-answer"
                  disabled={disabled || Boolean(feedback) || saving}
                  onChange={(event) => {
                    setTypingValue(event.target.value);
                    if (!round.shouldObey && event.target.value.length > 0) resolveRound(false);
                  }}
                  placeholder="Your response…"
                  value={typingValue}
                />
                <button className={styles.primaryButton} disabled={disabled || Boolean(feedback) || !typingValue || saving} type="submit">Submit ↗</button>
                </div>
              </form>
            ) : (
              <div className={styles.commandControls}>
                <button className={styles.gestureButton} data-chosen={Boolean(feedback) && visualAction === "kneel"} disabled={disabled || Boolean(feedback) || saving} onClick={() => pressAction("kneel")} type="button"><CommandGesture action="kneel"/><span>Kneel</span></button>
                <button className={styles.gestureButton} data-chosen={Boolean(feedback) && visualAction === "bow"} disabled={disabled || Boolean(feedback) || saving} onClick={() => pressAction("bow")} type="button"><CommandGesture action="bow"/><span>Bow</span></button>
              </div>
            )}
            {saving && <p className={styles.saving} role="status">Recording her verdict…</p>}
          </div>
        </div>
      )}
    </GameStageShell>
  );
}


function CrownMatch({ challengeSeed, disabled, onClose, onComplete, onFail, onRetry, retrying, retryError }: MiniGameProps) {
  const [cards] = useState(() => createCourtChallenge(challengeSeed).cards);
  const actionsRef = useRef<CourtAction[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [phase, setPhase] = useState<"preview" | "conceal" | "play">("preview");
  const [previewCount, setPreviewCount] = useState(Math.ceil(CROWN_MATCH_PREVIEW_MS / 1000));
  const [open, setOpen] = useState<number[]>([]);
  const openRef = useRef<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [verdict, setVerdict] = useState<"correct" | "wrong" | null>(null);
  const judgedRef = useRef(false);
  const timers = useRef(new Set<number>());
  const [reward, setReward] = useState(0);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const finishedRef = useRef(false);
  const after = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => { timers.current.delete(timer); callback(); }, delay);
    timers.current.add(timer);
  };
  useEffect(() => {
    const pending = timers.current;
    for (let remaining = Math.ceil(CROWN_MATCH_PREVIEW_MS / 1000) - 1; remaining > 0; remaining--) {
      pending.add(window.setTimeout(() => setPreviewCount(remaining), CROWN_MATCH_PREVIEW_MS - remaining * 1000));
    }
    const previewTimer = window.setTimeout(() => {
      setPhase("conceal");
      const concealTimer = window.setTimeout(() => setPhase("play"), CROWN_MATCH_FLIP_MS);
      pending.add(concealTimer);
    }, CROWN_MATCH_PREVIEW_MS);
    pending.add(previewTimer);
    return () => { pending.forEach(window.clearTimeout); pending.clear(); };
  }, []);

  const judgePair = (pair: number[]) => {
    if (judgedRef.current || pair.length !== 2 || finishedRef.current) return;
    judgedRef.current = true;
    const [first, second] = pair;
    const correct = cards[first].symbol === cards[second].symbol;
    setVerdict(correct ? "correct" : "wrong");
    emitSoundEvent(correct ? "button_click" : "task_fail");
    const nextMistakes = mistakes + (correct ? 0 : 1);
    if (!correct) setMistakes(nextMistakes);
    after(() => {
      if (correct) setMatched(current => [...current, first, second]);
      setOpen([]);
      openRef.current = [];
      setVerdict(null);
      if (nextMistakes >= CROWN_MATCH_MAX_MISTAKES) {
        finishedRef.current = true;
        setFailed(true);
        onFail();
      }
    }, correct ? 380 : 650);
  };

  const chooseCard = (id: number) => {
    if (phase !== "play" || disabled || saving || finishedRef.current || openRef.current.length >= 2 || openRef.current.includes(id) || matched.includes(id)) return;
    emitSoundEvent("button_click");
    // eslint-disable-next-line react-hooks/purity -- This handler records a user click, never a render-time timestamp.
    actionsRef.current.push({action:String(id),atMs:Date.now()-startedAt});
    const pair = [...openRef.current, id];
    openRef.current = pair;
    setOpen(pair);
    if (pair.length !== 2) return;
    judgedRef.current = false;
    setMoves(value => value + 1);
    // The transition event is authoritative visually; the fallback also supports reduced motion.
    after(() => judgePair(pair), CROWN_MATCH_FLIP_MS + 80);
  };

  useEffect(() => {
    if (matched.length !== cards.length || finishedRef.current) return;
    finishedRef.current = true;
    setSaving(true);
    void onComplete({ mistakes: Math.max(0, moves-CROWN_SYMBOLS.length), roundsCompleted: CROWN_SYMBOLS.length, score: CROWN_SYMBOLS.length, actions:actionsRef.current })
      .then(setReward).catch(() => setFailed(true)).finally(() => setSaving(false));
  }, [cards.length, matched.length, moves, onComplete]);

  return <GameStageShell gameId="crown-match" onClose={onClose} title="Crown Match" subtitle="Nine pairs. Five lives. Remember the seals.">
    {reward > 0 || failed ? <GameResult gameId="crown-match" failed={failed} onClose={onClose} onRetry={onRetry} retrying={retrying} retryError={retryError} reward={reward} score={moves+" moves"}/> :
      <div className={styles.playLayout}>
        <GamePresence gameId="crown-match" countdown={phase === "preview" ? previewCount : undefined} mood={verdict} message={phase === "preview" ? "Three seconds. Remember them." : phase === "conceal" ? "Now, show me." : "Remember what she revealed."}/>
        <div className={styles.board}>
          <div className={styles.matchHud}><div className={styles.hud}><GameMetric label="Pairs" value={<>{matched.length/2}<small> / {CROWN_SYMBOLS.length}</small></>}/><GameMetric label="Moves" value={moves}/></div><GameHearts maximum={CROWN_MATCH_MAX_MISTAKES} remaining={CROWN_MATCH_MAX_MISTAKES-mistakes}/></div>
          <div className={styles.memoryGrid} data-testid="crown-memory-grid" data-phase={phase}>
            {cards.map(card => {
              const visible = phase === "preview" || open.includes(card.id) || matched.includes(card.id);
              return <MemoryCard id={card.id} symbol={card.symbol} key={card.id}
                state={matched.includes(card.id) ? "matched" : visible ? open.includes(card.id) && verdict === "wrong" ? "mismatch" : open.includes(card.id) && verdict === "correct" ? "matched" : "open" : "hidden"}
                disabled={phase !== "play" || disabled || saving || open.length >= 2 || open.includes(card.id) || matched.includes(card.id)}
                onClick={() => chooseCard(card.id)} onReveal={() => { if (phase === "play" && openRef.current[1] === card.id) judgePair(openRef.current); }}/>
            })}
          </div>
          {saving && <p className={styles.saving} role="status">Claiming your reward…</p>}
        </div>
      </div>}
  </GameStageShell>;
}

function RoyalGuard({ challengeSeed, disabled, onClose, onComplete, onFail, onRetry, retrying, retryError }: MiniGameProps) {
  const [phase, setPhase] = useState<"intro" | "play">("intro");
  const [targets] = useState(() => createCourtChallenge(challengeSeed).targets);
  const actionsRef=useRef<CourtAction[]>([]);
  const [startedAt]=useState(()=>Date.now());
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [locked, setLocked] = useState(false);
  const [outcome, setOutcome] = useState<"blocked" | "letPass" | "struckGift" | "reachedHer" | null>(null);
  const [reward, setReward] = useState(0);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const target = targets[index];
  const duration = guardWaveDuration(index);
  const resolveRef = useRef<(hit: boolean) => void>(() => undefined);

  const finish = useCallback((nextScore: number, nextMistakes: number) => {
    if (nextScore < COURT_GAME_RULES["royal-guard"].requiredScore) {
      setFailed(true);
      onFail();
      return;
    }
    setSaving(true);
    void onComplete({ mistakes: nextMistakes, roundsCompleted: targets.length, score: nextScore, actions:actionsRef.current })
      .then(setReward)
      .catch(() => setFailed(true))
      .finally(() => setSaving(false));
  }, [onComplete, onFail, targets.length]);

  const resolveTarget = useCallback((hit: boolean) => {
    if (locked || saving || !target || phase !== "play") return;
    setLocked(true);
    actionsRef.current.push({action:hit?"hit":"wait",atMs:Date.now()-startedAt});
    const correct = target.threat ? hit : !hit;
    // Four different endings, because "wrong" alone taught nobody anything:
    // the message says exactly what happened to her.
    setOutcome(target.threat ? (hit ? "blocked" : "reachedHer") : hit ? "struckGift" : "letPass");
    const nextScore = score + (correct ? 1 : 0);
    const nextMistakes = mistakes + (correct ? 0 : 1);
    setScore(nextScore);
    setMistakes(nextMistakes);
    emitSoundEvent(correct ? "button_click" : "task_fail");
    window.setTimeout(() => {
      setOutcome(null);
      if (index >= targets.length - 1) {
        finish(nextScore, nextMistakes);
      } else {
        setIndex((value) => value + 1);
        setLocked(false);
      }
    }, 460);
  }, [finish, index, locked, mistakes, phase, saving, score, target, targets.length, startedAt]);
  useEffect(() => {
    resolveRef.current = resolveTarget;
  }, [resolveTarget]);

  // The travel timer IS the wave: when it expires the target has reached her.
  useEffect(() => {
    if (phase !== "play" || failed || reward || saving || locked) return;
    const timer = window.setTimeout(() => resolveRef.current(false), duration);
    return () => window.clearTimeout(timer);
  }, [duration, failed, index, locked, phase, reward, saving]);

  const outcomeCopy: Record<NonNullable<typeof outcome>, { text: string; tone: "good" | "bad" }> = {
    blocked: { text: "Cut down before it reached her.", tone: "good" },
    letPass: { text: "Her gift arrived untouched.", tone: "good" },
    reachedHer: { text: "It reached her. You were too slow.", tone: "bad" },
    struckGift: { text: "You destroyed her gift.", tone: "bad" },
  };

  return (
    <GameStageShell gameId="royal-guard" onClose={onClose} title="Royal Guard" subtitle="Strike incoming threats. Leave gifts untouched. Your reaction decides what reaches her.">
      {reward > 0 || failed ? (
        <GameResult gameId="royal-guard" failed={failed} onClose={onClose} onRetry={onRetry} retrying={retrying} retryError={retryError} reward={reward} score={`${score}/${targets.length}`} />
      ) : phase === "intro" ? (
        <div className={styles.guardIntro}>
          <div className={styles.guardIntroArt}><Image src={COURT_GAME_ART["royal-guard"]} unoptimized alt="Principessa awaits her guard" fill sizes="(max-width: 760px) 90vw, 35vw"/><span>Nothing reaches her<br/>without you.</span></div>
          <div className={styles.guardBrief}>
            <h4>You are her last line.</h4>
            <div className={styles.guardRule} data-kind="threat"><div aria-hidden="true"><CourtGlyph symbol="threat"/><CourtGlyph symbol="bolt"/></div><div><strong>Threats: strike before they arrive</strong><p>Hit the moving target before it reaches her.</p></div></div>
            <div className={styles.guardRule} data-kind="gift"><div aria-hidden="true"><CourtGlyph symbol="gift"/><CourtGlyph symbol="gem"/><CourtGlyph symbol="letter"/></div><div><strong>Gifts: let them pass</strong><p>Do nothing until the gift reaches her.</p></div></div>
            <p>{targets.length} waves, getting faster. Guard {COURT_GAME_RULES["royal-guard"].requiredScore} correctly to earn your daily reward.</p>
            <button className={styles.primaryButton} data-testid="guard-start" onClick={() => setPhase("play")} type="button">Take your post <span aria-hidden="true">→</span></button>
          </div>
        </div>
      ) : (
        <div className={styles.playLayout}>
          <GamePresence gameId="royal-guard" mood={outcome ? (outcomeCopy[outcome].tone === "good" ? "correct" : "wrong") : null} message={outcome ? outcomeCopy[outcome].text : "Keep her court intact."}/>
          <div className={styles.board}>
            <div className={styles.hud}>
              <GameMetric label="Wave" value={<>{index+1}<small> / {targets.length}</small></>}/>
              <GameMetric label="Guarded" value={score}/>
              <GameMetric label="Missed" value={mistakes}/>
            </div>
            <div className={styles.guardTrack} data-testid="guard-track" data-guard-outcome={outcome ?? "approach"}>
              <span className={styles.guardTrackLabel}>Incoming · {index+1}</span>
              <div className={styles.guardGate} data-hit={outcome === "reachedHer"}><CourtGlyph symbol={outcome === "letPass" ? target.glyph : "crown"}/><span>Principessa</span></div>
              <div className={styles.guardTravel}>
                {!outcome ? <button className={styles.guardTarget} data-testid="guard-target" data-threat={target.threat} disabled={disabled || locked || saving} key={index} onClick={() => resolveTarget(true)} style={{animationDuration:duration+"ms"}} type="button"><CourtGlyph symbol={target.glyph}/><span>{target.label}</span></button> : null}
              </div>
              {outcome ? <div className={styles.guardImpact} data-good={outcomeCopy[outcome].tone === "good"}><CourtGlyph symbol={outcome === "letPass" ? target.glyph : outcome === "blocked" ? "star" : "threat"}/>{outcome === "blocked" && <span className={styles.strike}/>}</div> : null}
              <div className={styles.waveTime} role="progressbar" aria-label="Wave time" aria-valuemin={0} aria-valuemax={1} aria-valuenow={outcome?0:1} aria-valuetext={outcome ? "Resolved" : `Up to ${(duration/1000).toFixed(1)} seconds`}><span key={index} style={{animationDuration:duration+"ms",animationPlayState:outcome?"paused":"running"}}/></div>
              <p className={styles.waveCaption} aria-live="polite">{outcome ? outcomeCopy[outcome].text : target.threat ? "Intercept the threat" : "Let her gift pass"}</p>
            </div>

            {saving && <p className={styles.saving} role="status">Recording your guard duty…</p>}
          </div>
        </div>
      )}
    </GameStageShell>
  );
}
