import {Children,type ReactNode} from "react";
import { MobileActivityTabs } from "./mobile/MobileActivityTabs";
import {CourtCompanion} from "./CourtCompanion";
import styles from "./CourtIntegrated.module.css";
export function GambleWheelsLobby({children,mobileLayout=false}:{children:ReactNode;mobileLayout?:boolean}) {
  if (mobileLayout) {
    const rooms=Children.toArray(children);
    return <MobileActivityTabs entries={[
      {key:"games",label:"Games",content:rooms[0]},
      {key:"wheels",label:"Wheels",content:rooms[1]},
      {key:"duels",label:"Duels",content:rooms[2]},
    ]}/>;
  }
  return <section><header className={styles.casinoIntro}><div><h2>Gamble & Wheels</h2><nav aria-label="Casino rooms"><a href="#gamble-tables">Coin games ↓</a><a href="#verdict-wheels">Verdict wheels ↓</a></nav></div><CourtCompanion>Pick your temptation.</CourtCompanion></header>{children}</section>;
}
