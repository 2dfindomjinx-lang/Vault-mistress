"use client";

import { type ReactNode } from "react";
import c from "./CasinoExperience.module.css";

export function CasinoTableFrame({ children, controls, result, phase, label }: { children: ReactNode; controls: ReactNode; result?: ReactNode; phase: string; label: string }) {
  return <div className={c.tableInterior} data-phase={phase}><div className={c.playArea}><div className={c.stageLabel}><span>{label}</span><span className={c.phase}><i />{phase}</span></div>{children}</div><aside className={c.controls}>{controls}</aside><div aria-live="polite" className={c.resultDock}>{result ?? <p>The next verdict is waiting.</p>}</div></div>;
}

export function CasinoMetric({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return <div className={c.metric}><span>{label}</span><strong>{value}</strong>{detail ? <small>{detail}</small> : null}</div>;
}

const DOTS = [[4], [0,8], [0,4,8], [0,2,6,8], [0,2,4,6,8], [0,2,3,5,6,8]];
export function CasinoDie({ value, rolling }: { value: number; rolling: boolean }) {
  return <span aria-label={`Die ${value}`} className={c.die} data-rolling={rolling}>{Array.from({ length:9 }, (_, index) => <i data-dot={DOTS[Math.max(0, Math.min(5,value-1))].includes(index)} key={index} />)}</span>;
}

export function CasinoRunner({ running, color }: { running: boolean; color: string }) {
  return (
    <svg role="img" aria-label="Crawling contender" className={c.runner} data-running={running} viewBox="0 0 70 45">
      <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5">
        {/* Far limbs share the pelvis and shoulder line; draw them behind the torso. */}
        <g transform="translate(22 22)" opacity=".48"><path className={c.runnerRearLeg} d="M0 0 -4 12 -16 13" /></g>
        <g transform="translate(44 21)" opacity=".48"><path className={c.runnerRearArm} d="M0 0 -2 11 6 14" /></g>
        <path d="M23 23 C28 18 37 18 45 22 L50 16" />
        <circle cx="54" cy="11" r="6" fill={color} stroke="none" />
        <g transform="translate(23 24)"><path className={c.runnerLeg} d="M0 0 2 12 -10 12" /></g>
        <g transform="translate(45 23)"><path className={c.runnerArm} d="M0 0 7 8 5 14" /></g>
        <path d="m47 18 5 3" stroke="#f6d1e0" strokeWidth="2" />
      </g>
    </svg>
  );
}
