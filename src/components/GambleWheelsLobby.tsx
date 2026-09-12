import type {ReactNode} from "react";
import {CourtCompanion} from "./CourtCompanion";
import styles from "./CourtIntegrated.module.css";
export function GambleWheelsLobby({children}:{children:ReactNode}) {
  return <section><header className={styles.casinoIntro}><div><h2>Gamble & Wheels</h2><nav aria-label="Casino rooms"><a href="#gamble-tables">Coin games ↓</a><a href="#verdict-wheels">Verdict wheels ↓</a></nav></div><CourtCompanion>Pick your temptation.</CourtCompanion></header>{children}</section>;
}