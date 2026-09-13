"use client";

import { type CSSProperties, type ReactNode } from "react";
import ui from "./TaskExperience.module.css";

const identities: Record<string, { label: string; mark: string; instruction: string }> = {
  claim: { label: "Daily audience", mark: "01", instruction: "Your place in her court." },
  typing: { label: "The writing desk", mark: "Aa", instruction: "Every character matters." },
  "confession-writing": { label: "The confession desk", mark: "Aa", instruction: "Write it. Mean it. Repeat it." },
  "ownership-oath": { label: "The oath", mark: "Aa", instruction: "Her words. Your promise." },
  "perfect-writing": { label: "The precision test", mark: "Aa", instruction: "A perfect line, from beginning to end." },
  "number-pick": { label: "A single choice", mark: "03", instruction: "Three numbers. One decision." },
  "case-open": { label: "The reward vault", mark: "▣", instruction: "Break the seal. Watch it land." },
  "timeout-risk": { label: "The risk table", mark: "½", instruction: "Your reward. Your risk." },
  "wait-obediently": { label: "The stillness room", mark: "60", instruction: "Stay with her. Touch nothing." },
  "evil-wait": { label: "The patience test", mark: "120", instruction: "She will try to distract you." },
  movement: { label: "The motion room", mark: "↕", instruction: "Follow the rhythm. Keep moving." },
  "irl-wheel": { label: "Her next instruction", mark: "◎", instruction: "The wheel chooses your assignment." },
  "favor-roulette": { label: "The favor table", mark: "V", instruction: "Five sealed cards. Choose your fate." },
  "high-low": { label: "The card table", mark: "↗", instruction: "Read the number. Choose the direction." },
  "false-hope": { label: "The obedience console", mark: "AD", instruction: "Follow her next command." },
  worship: { label: "A private offering", mark: "✧", instruction: "An offering made in her name." },
  review: { label: "Her approval", mark: "✓", instruction: "Complete the task. Submit your proof." },
  "daily-click": { label: "The daily reveal", mark: "+", instruction: "Every click brings you closer." },
  "throne-tribute": { label: "A tribute to her", mark: "P", instruction: "Your offering, recorded." },
  rights: { label: "Privileges", mark: "§", instruction: "Your rights, on her terms." },
  website: { label: "Her selection", mark: "↗", instruction: "Let her choose your next destination." },
  "level-drain": { label: "The transfer", mark: "↗", instruction: "Your experience becomes her strength." },
};

type VisualTask = {
  completed?: boolean;
  claimed?: boolean;
  status?: string;
  cooldownUntil?: string | null;
  waitState?: string | null;
  movementState?: string | null;
  favorResult?: string | null;
  numberPickResult?: string | null;
  resultOutcome?: string | null;
};

export function taskExperienceState(task: VisualTask, now: number, pending = false) {
  if (pending) return "busy";
  const outcome = task.favorResult || task.numberPickResult || task.resultOutcome;
  if (outcome === "win") return "won";
  if (outcome === "loss" || outcome === "lose" || outcome === "empty-day") return "lost";
  if (outcome === "tie") return "tie";
  const phase = task.waitState || task.movementState;
  if (phase === "waiting" || phase === "active" || phase === "countdown" || phase === "fake_hope") return "active";
  if (phase === "failed" || task.status === "failed") return "lost";
  if (task.claimed || task.status === "approved" || phase === "completed") return "complete";
  if (task.completed) return "claimable";
  if (task.status === "pending") return "review";
  if (task.cooldownUntil && Date.parse(task.cooldownUntil) > now) return "cooldown";
  return "ready";
}

export function TaskExperienceCard({ kind, taskId, title, reward, status, notice, state = "ready", wide = false, reaction, children }: {
  kind: string; taskId: string; title: ReactNode; reward?: ReactNode; status?: ReactNode;
  notice?: ReactNode; rules?: ReactNode; state?: string; wide?: boolean;
  reaction?: string | number; children: ReactNode;
}) {
  const identity = identities[kind] ?? identities.review;
  return (
    <article className={`${ui.card} ${wide ? ui.wide : ""}`} data-task-id={taskId} data-task-kind={kind} data-task-state={state}>
      <div className={ui.reaction} key={`${state}-${reaction ?? ""}`} aria-hidden="true" />
      <header className={ui.cardHeader}>
        <div className={ui.identityMark} aria-hidden="true"><span>{identity.mark}</span><i /><i /></div>
        <div className={ui.identityCopy}><p>{identity.label}</p><h3>{title}</h3></div>
        <div className={ui.status}>{status ?? <span>{state}</span>}</div>
      </header>
      {reward && <div className={ui.reward}><span className={ui.rewardLabel}>At stake</span><div>{reward}</div></div>}
      {notice && <div className={ui.notice}>{notice}</div>}
      <div className={ui.cardBody}>{children}</div>

    </article>
  );
}

export function TaskProgress({ value, total, label, state = "active" }: { value: number; total: number; label: string; state?: string }) {
  const percent = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  return <div className={ui.progress} data-state={state}>
    <div><span>{label}</span><strong>{value}<small> / {total}</small></strong></div>
    <div className={ui.progressTrack} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(total, Math.max(0, value))}><span style={{ width: `${percent}%` }} /></div>
  </div>;
}

export function TaskWaitDial({ seconds, total, state }: { seconds: number; total: number; state: string }) {
  const remaining = Math.max(0, Math.ceil(seconds));
  const progress = state === "countdown" ? 0 : Math.max(0, Math.min(100, (1 - remaining / Math.max(1, total)) * 100));
  const active = state === "waiting" || state === "countdown";
  return <div className={ui.waitInstrument} data-state={state}>
    <div className={ui.waitDial} style={{ "--dial-progress": `${progress}%` } as CSSProperties}>
      <div><span key={`${state}-${state === "countdown" ? remaining : "time"}`}>{active ? String(remaining).padStart(2, "0") : state === "completed" ? "✓" : state === "failed" ? "×" : String(total)}</span><small>{active ? "seconds remaining" : state === "completed" ? "Stillness rewarded" : state === "failed" ? "Input detected" : "seconds of stillness"}</small></div>
    </div>
    <div className={ui.waitSignals}><span data-on={active}>Hands off</span><span data-on={active}>No keys</span><span data-on={active}>Stay here</span></div>
  </div>;
}

export function TaskCardFace({ open, matched = false, selected = false, index, children }: { open: boolean; matched?: boolean; selected?: boolean; index?: number; children: ReactNode }) {
  return <span className={ui.cardFace} data-open={open} data-matched={matched} data-selected={selected}>
    <span className={ui.cardFlip}>
      <span className={ui.cardBack} aria-hidden="true"><small>PRINCIPESSA</small><b>P</b><i>{index === undefined ? "HER COURT" : String(index + 1).padStart(2, "0")}</i></span>
      <span className={ui.cardFront}>{children}</span>
    </span>
  </span>;
}

export function TaskInputSignal({ count, label, total }: { count: number; label: string; total: number }) {
  return <div className={ui.inputSignal} data-state={count < total ? "mistake" : "ready"} key={count}>
    <span>{label}</span><div>{Array.from({ length: total }, (_, i) => <i key={i} data-remaining={i < count} />)}</div><strong>{count}/{total}</strong>
  </div>;
}


