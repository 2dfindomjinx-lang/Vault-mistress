"use client";
import type {DashboardPage} from "./SidebarNav";
import {CourtCompanion} from "./CourtCompanion";
import styles from "./CourtIntegrated.module.css";
type CourtHomeStageProps={affection:number;coins:number;dailyMessage:string;displayName:string;money?:number;onNavigate:(page:DashboardPage)=>void};
export function CourtHomeStage({onNavigate}:CourtHomeStageProps) {
  return <section className={styles.home} aria-label="Principessa's court"><div className={styles.homeCopy}><p>The private court</p><h1>Make her notice.</h1><span>Your games. Your devotion. Her rules.</span></div><CourtCompanion>Let’s see what you’re worth today.</CourtCompanion><div className={styles.actions}><button type="button" onClick={()=>onNavigate("tasks")}>Play & earn ↗</button><button type="button" onClick={()=>onNavigate("tribute")}>Offer tribute</button></div></section>;
}