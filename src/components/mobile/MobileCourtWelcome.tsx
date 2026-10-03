"use client";

import Image from "next/image";
import styles from "./MobileCourt.module.css";

export function MobileCourtWelcome({ error, isBusy, onEnterPreviewMode, onSignInWithX }: {
  error: string; isBusy: boolean; onEnterPreviewMode: () => void; onSignInWithX: () => void;
}) {
  return <main className={styles.welcome} data-mobile-court="true">
    <div className={styles.welcomeArt}><Image alt="Principessa" src="/principessa-ui/atelier/v4/games_v4.webp" fill sizes="600px" priority unoptimized/><span/></div>
    <div className={styles.welcomeBrand}><Image alt="" src="/brand/vault-mistress-mark.svg" width={30} height={38}/><span>VAULT MISTRESS</span></div>
    <div className={styles.welcomeCopy}><p>Principessa’s private court</p><h1>All hers.<br/><em>Including you.</em></h1><span>Play. Collect. Devote.</span>
      {error && <p className={styles.signInError} role="alert">{error}</p>}
      <button className={styles.signIn} type="button" disabled={isBusy} onClick={onSignInWithX}>{isBusy ? "Opening…" : "Enter with X"}<span>↗</span></button>
      <button className={styles.explore} type="button" disabled={isBusy} onClick={onEnterPreviewMode}>Take a look inside</button>
      <footer><span>18+ · Her court. Her rules.</span></footer>
    </div>
  </main>;
}
