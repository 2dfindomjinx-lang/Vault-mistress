import Image from "next/image";
import type {ReactNode} from "react";
import styles from "./CourtIntegrated.module.css";
export function CourtCompanion({children}:{children:ReactNode}) {
  return <div className={styles.companion}><div className={styles.companionArt}><Image alt="Principessa" src="/principessa-ui/atelier/v4/companion_cutout_v4.webp" fill sizes="72px" loading="eager" unoptimized/></div><p><small>Principessa</small>{children}</p></div>;
}