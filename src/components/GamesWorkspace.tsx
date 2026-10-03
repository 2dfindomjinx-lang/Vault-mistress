import type {ReactNode} from "react";
import { MobileActivityTabs } from "./mobile/MobileActivityTabs";
import styles from "./GamesWorkspace.module.css";
export function GamesWorkspace({courtGames,rituals,jigsaws,mobileLayout=false}:{courtGames:ReactNode;rituals:ReactNode;jigsaws:ReactNode;mobileLayout?:boolean}) {
  if (mobileLayout) return <MobileActivityTabs entries={[
    {key:"daily",label:"Daily",content:rituals},
    {key:"court",label:"Court games",content:courtGames},
    {key:"jigsaws",label:"Jigsaws",content:jigsaws},
  ]}/>;
  return <div className={styles.workspace}>
    <section id="court-games" aria-label="Court games">{courtGames}</section>
    <section id="jigsaws" className={styles.jigsaws} aria-label="Jigsaws">{jigsaws}</section>
    <section id="daily-games" aria-label="Daily games">{rituals}</section>
  </div>;
}
