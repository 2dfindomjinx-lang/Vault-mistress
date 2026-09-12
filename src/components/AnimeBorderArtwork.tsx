import type { CSSProperties } from "react";
import type { AnimeBorderDefinition } from "@/lib/anime-border-cosmetics";
import styles from "./AnimeBorderArtwork.module.css";

export function AnimeBorderArtwork({ border }: { border: AnimeBorderDefinition }) {
  const positions = border.layout === "crown"
    ? ["south", "nw", "ne"]
    : border.layout === "opposed" ? ["sw", "ne"] : ["nw", "se"];
  const artStyle = {
    "--anime-trim": 'url("/cosmetics/anime-borders/' + border.slug + '-trim.svg")',
    "--anime-crest": 'url("/cosmetics/anime-borders/' + border.slug + '-crest.svg")',
  } as CSSProperties;

  return (
    <div aria-hidden="true" className={styles.animeArt} data-anime-art={border.slug} data-motion={border.motion} style={artStyle}>
      <span className={styles.trim} />
      <span className={styles.shine} />
      {positions.map((position, index) => (
        <span className={styles.crest} data-position={position} data-small={border.layout === "crown" && index > 0 ? "true" : undefined} key={position} />
      ))}
    </div>
  );
}
