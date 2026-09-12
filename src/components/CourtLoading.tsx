import Image from "next/image";
import styles from "./CourtLoading.module.css";

export function CourtLoading() {
  return (
    <main className={styles.screen} aria-busy="true" aria-label="Principessa’s court is loading">
      <div className={styles.entrance}>
        <div className={styles.seal} aria-hidden="true">
          <Image src="/brand/vault-mistress-mark.svg" alt="" width={88} height={88} unoptimized />
        </div>
        <p className={styles.eyebrow}>Her private court</p>
        <h1 className={styles.name}>Principessa</h1>
        <div className={styles.rule} aria-hidden="true"><span /></div>
        <p className={styles.status} role="status">Opening the court…</p>
      </div>
    </main>
  );
}
