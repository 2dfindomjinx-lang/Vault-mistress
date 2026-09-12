import Image from "next/image";
import styles from "./HomeCourtPanels.module.css";
export function AffectionRead({affection,message}:{affection:number;message:string}) {
 const score=Math.max(0,Math.min(100,affection));
 return <section className={styles.panel+" "+styles.mood} aria-label="Affection Read">
  <div className={styles.moodArt}><Image src="/principessa-ui/atelier/v4/affection_v4.webp" alt="Principessa considers your devotion" fill sizes="(min-width:1280px) 45vw,90vw" unoptimized/></div>
  <div className={styles.moodCopy}><p className={styles.kicker}>Affection Read</p><h2>Principessa’s mood</h2><blockquote>{message}</blockquote></div>
  <div className={styles.moodReadout}><svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="26" fill="none" stroke="currentColor" strokeOpacity=".15" strokeWidth="2"/><circle cx="30" cy="30" r="26" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="163.36" strokeDashoffset={163.36*(1-score/100)} transform="rotate(-90 30 30)"/><path d="M30 42 19 31C11 22 23 15 30 24 37 15 49 22 41 31Z" fill="currentColor"/></svg><div><strong>{score}<span style={{fontSize:13,opacity:.5}}> / 100</span></strong><small>Affection</small></div></div>
 </section>;
}
