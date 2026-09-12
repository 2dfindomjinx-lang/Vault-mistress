import type {ReactNode} from "react";
import styles from "./GamesWorkspace.module.css";
export function GamesWorkspace({courtGames,rituals,jigsaws}:{courtGames:ReactNode;rituals:ReactNode;jigsaws:ReactNode}) {
  return <div className={styles.workspace}>
    <section id="court-games" aria-label="Court games">{courtGames}</section>
    <section id="jigsaws" className={styles.jigsaws} aria-label="Jigsaws">{jigsaws}</section>
    <section id="daily-games" aria-label="Daily games">{rituals}</section>
  </div>;
}
