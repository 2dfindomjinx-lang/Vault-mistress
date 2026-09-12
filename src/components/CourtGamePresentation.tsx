"use client";
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { CourtDialog } from "./CourtDialog";
import type { CourtGameId } from "@/lib/court-games";
import { CourtGlyph } from "@/components/court/CourtVisuals";
import styles from "./CourtGamesExperience.module.css";

export function GameStageShell({ children, gameId, onClose, subtitle, title }: {
  children: ReactNode; gameId: CourtGameId; onClose: () => void; subtitle: string; title: string;
}) {
  return <CourtDialog gameId={gameId} className={styles.gameDialog} label={title} onClose={onClose}>
    <section className={styles.stage} data-game-stage={gameId}>
      <header className={styles.stageHeader}>
        <div><h3>{title}</h3></div>
        <button className={styles.backButton} aria-label="Close game" onClick={onClose} type="button"><span aria-hidden="true">×</span></button>
      </header>
      <p className={styles.rules}>{subtitle}</p>
      {children}
    </section>
  </CourtDialog>;
}

export const COURT_GAME_ART: Record<CourtGameId, string> = {
  "principessa-says": "/principessa-ui/atelier/v4/says_v4.webp",
  "crown-match": "/principessa-ui/atelier/v4/match_v4.webp",
  "royal-guard": "/principessa-ui/atelier/v4/guard_v4.webp",
};

export function GamePresence({ gameId, mood, message, countdown }: {
  gameId: CourtGameId; mood: "correct" | "wrong" | null; message: string; countdown?: number;
}) {
  const art = COURT_GAME_ART[gameId];
  return <aside className={styles.presence} data-reaction={mood ?? "watching"} data-countdown={countdown !== undefined}>
    <div className={styles.presenceArt}><Image src={art} alt="Principessa watches your game" fill sizes="(min-width: 1000px) 220px, 90px" unoptimized/><span className={styles.presenceHalo} aria-hidden="true"/></div>
    <div className={styles.presenceCaption}><span className={styles.eyebrow}>Principessa</span><p key={message}>{message}</p><span className={styles.presenceVerdict}>{mood === "correct" ? "✓ Approved" : mood === "wrong" ? "× Displeased" : "Her attention is yours"}</span></div>
    {countdown !== undefined && <span className={styles.previewCountdown} role="timer" aria-label={`${countdown} seconds to remember the cards`} aria-live="polite" aria-atomic="true"><span key={countdown}>{countdown}</span></span>}
  </aside>;
}

export function GameMetric({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return <div className={styles.metric}><span>{label}</span><strong>{value}</strong>{children}</div>;
}

export function GameHearts({ remaining, maximum }: { remaining: number; maximum: number }) {
  return <div className={styles.hearts} role="status" aria-label={`${remaining} lives remaining`}>
    <span className={styles.eyebrow}>Lives</span><div aria-hidden="true">{Array.from({length:maximum},(_,i)=><span data-lost={i >= remaining} key={i}><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21 3.5 12.5C-2.5 6.5 5.5-1.5 12 5.2 18.5-1.5 26.5 6.5 20.5 12.5Z"/></svg></span>)}</div>
    <small>{remaining} / {maximum}</small>
  </div>;
}

export function GameTimer({ remaining, total }: { remaining: number; total: number }) {
  return <div className={styles.timer} data-urgent={remaining < 1500}>
    <div><span>Time to respond</span><strong>{Math.ceil(remaining / 1000)}<small>s</small></strong></div>
    <div className={styles.timerTrack} role="progressbar" aria-label="Time remaining" aria-valuemin={0} aria-valuemax={total} aria-valuenow={remaining}><span style={{transform:`scaleX(${Math.max(0,remaining / total)})`}}/></div>
  </div>;
}

export function CommandGesture({ action }: { action: "kneel" | "bow" }) {
  return <svg viewBox="0 0 80 72" fill="none" aria-hidden="true" className={styles.gesture}>
    <path d="M9 62H71" stroke="currentColor" opacity=".3" strokeWidth="2"/>
    {action === "kneel" ? <><circle cx="38" cy="15" r="7" fill="currentColor"/><path d="m37 27-5 17 15 4-1 12H31M35 30l14 9 9-5M32 43l-9 17H13" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></> : <><path d="M29 29 35 45 34 60H42M44 34 51 45 47 50" stroke="currentColor" opacity=".45" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/><path d="M27 60 26 44 28 29 46 34 51 38M27 60H19M45 35 43 47 35 49" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="58" cy="41" r="6.5" fill="currentColor"/></>}
  </svg>;
}

export function MemoryCard({ id, symbol, state, disabled, onClick, onReveal }: {
  id: number; symbol: string; state: "hidden" | "open" | "matched" | "mismatch";
  disabled: boolean; onClick: () => void; onReveal?: () => void;
}) {
  const revealed=state !== "hidden";
  return <button className={styles.memoryCard} type="button" data-card-id={id} data-card-state={state}
    aria-label={revealed ? `Card ${id+1} · ${symbol}${state === "matched" ? " · Matched" : ""}` : `Card ${id+1} · Hidden`}
    aria-pressed={revealed} disabled={disabled} onClick={onClick}>
    <span className={styles.cardRotor} onTransitionEnd={event => { if (event.target === event.currentTarget && event.propertyName === "transform" && state === "open") onReveal?.(); }}>
      <span className={styles.cardBack} aria-hidden="true"><span className={styles.cardCorner}>{String(id+1).padStart(2,"0")}</span><span className={styles.cardMonogram}>P<span>✦</span></span><small>THE COURT</small></span>
      <span className={styles.cardFront} aria-hidden="true"><span className={styles.cardCorner}>{state === "matched" ? "✓" : "✦"}</span><CourtGlyph symbol={symbol}/><small>{state === "matched" ? "Paired" : "Royal seal"}</small></span>
    </span>
  </button>;
}

export function GameResult({ gameId, failed, onClose, onRetry, retrying, retryError, reward, score }: {
  gameId: CourtGameId; failed: boolean; onClose: () => void; onRetry: () => void;
  retrying: boolean; retryError: string; reward: number; score: string;
}) {
  return <div className={styles.result} data-game-result={failed ? "failed" : "reward"} role="status">
    <div className={styles.resultArt}><Image src={COURT_GAME_ART[gameId]} alt="Principessa gives her verdict" fill sizes="(min-width: 900px) 300px, 140px" unoptimized/></div>
    <div className={styles.resultContent}>
      <div className={styles.resultEmblem}><CourtGlyph symbol={failed ? "threat" : "crown"}/>{!failed && <div className={styles.resultRays} aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i} style={{"--ray":i} as CSSProperties}/>)}</div>}</div>
      <h4>{failed ? "Her standard stands." : "You earned her approval."}</h4>
      <p className={styles.resultScore}>Final result <strong>{score}</strong></p>
      <div className={styles.resultReward}>{failed ? <span>No reward this time.</span> : <><strong>+{reward}</strong><span>Principessa Coins</span></>}</div>
      {retryError ? <p className={styles.error} role="alert">{retryError}</p> : null}
      <div className={styles.resultActions}>
        {failed ? <button className={styles.primaryButton} disabled={retrying} onClick={onRetry} type="button">{retrying ? "Starting…" : "Try again"}</button> : null}
        <button className={failed ? styles.backButton : styles.primaryButton} onClick={onClose} type="button">Back to Games</button>
      </div>
    </div>
  </div>;
}
