import Image from "next/image";
import type { CSSProperties } from "react";
import { getPrincipessaPresence } from "@/lib/principessa-presence";
import styles from "./PrincipessaPower.module.css";

export function PrincipessaPowerPortrait({ level, avatarSrc = "/character-icon.webp", showLabel = true }: { level: number; avatarSrc?: string; showLabel?: boolean }) {
  const power = getPrincipessaPresence(level);
  return <span className={styles.portrait} data-power-tier={power.id} data-rank={power.rank} style={{ "--power-accent": power.accent } as CSSProperties}>
    <span className={styles.image}><Image src={avatarSrc} alt="Principessa" fill sizes="80px" unoptimized className="object-cover object-top" /></span>
    <svg className={styles.insignia} viewBox="0 0 120 140" fill="none" aria-hidden="true">
      <circle cx="60" cy="66" r="43" stroke="currentColor" strokeWidth="1.5"/>
      {power.rank >= 1 && <><circle cx="60" cy="66" r="48" stroke="currentColor" strokeWidth=".8" opacity=".6"/>{[0, 90, 180, 270].map((angle) => <path key={angle} d="m60 13 4 5-4 5-4-5Z" fill="currentColor" transform={`rotate(${angle} 60 66)`}/>)}</>}
      {power.rank >= 2 && <g stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="m40 22-3-15 13 7L60 1l10 13 13-7-3 15Z" fill="#21101c"/><path d="M41 26h38"/><path d="m60 9 3 5-3 4-3-4Z" fill="currentColor"/></g>}
      {power.rank >= 3 && <g stroke="currentColor" strokeWidth="1.4" fill="currentColor"><path d="M23 102C4 86 3 54 17 37M97 102c19-16 20-48 6-65" fill="none"/>{[0,1,2,3].map((i) => <g key={i}><ellipse cx={10 + i * 2} cy={48 + i * 13} rx="2.5" ry="6" transform={`rotate(-24 ${10 + i * 2} ${48 + i * 13})`}/><ellipse cx={110 - i * 2} cy={48 + i * 13} rx="2.5" ry="6" transform={`rotate(24 ${110 - i * 2} ${48 + i * 13})`}/></g>)}</g>}
      {power.rank >= 4 && <><path d="m60 27 5 7-5 6-5-6Z" fill="#de547a" stroke="#ffcfda"/><path d="m24 29-5-7m82 0-5 7" stroke="currentColor"/></>}
      {power.rank >= 5 && <path d="M8 20 2 13m13 1-2-8m99 14 6-7m-13 1 2-8M2 108l9-5m107 5-9-5" stroke="currentColor" strokeWidth="1.4"/>}
      {power.rank >= 6 && <><path d="M29 116 20 128l17-3 5 10 9-17m40-2 9 12-17-3-5 10-9-17" fill="#64354b" stroke="currentColor"/><path d="m32 8-5-5m61 5 5-5" stroke="currentColor"/></>}
    </svg>
    <span className={styles.level}>Lv. {power.currentLevel}</span>
    {showLabel && <span className={styles.rank}>{power.name}</span>}
  </span>;
}
