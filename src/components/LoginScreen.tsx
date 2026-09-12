"use client";

import Image from "next/image";
import { CourtActivityFeed } from "./CourtActivityFeed";
import styles from "./CourtChrome.module.css";

type LoginScreenProps = {
  error?: string;
  isBusy?: boolean;
  onEnterPreviewMode: () => void;
  onSignInWithX: () => Promise<void>;
};

export function LoginScreen({ error, isBusy = false, onEnterPreviewMode, onSignInWithX }: LoginScreenProps) {
  return (
    <main className={styles.login}>
      <section className={styles.loginStage}>
        <div className={styles.loginBrand}>
          <Image src="/brand/vault-mistress-mark.svg" alt="" width={35} height={40} />
          PRINCIPESSA
        </div>
        <div className={styles.loginArt}>
          <Image src="/principessa-ui/generated/principessa-home-command.webp" fill preload sizes="(max-width:640px) 80vw, 55vw" alt="Principessa awaits your arrival" />
        </div>
        <h1>Her world.<br /><em>Your place.</em></h1>
      </section>
      <section className={styles.loginPanel}>
        <p className={styles.eyebrow}>The private court of Principessa</p>
        <h2>Some attention<br />has to be earned.</h2>
        <p>Games, tributes, coveted collections.<br />All under her command.</p>
        <button className={styles.primary} disabled={isBusy} onClick={() => void onSignInWithX()} type="button">
          {isBusy ? "Opening…" : "Sign in with X ↗"}
        </button>
        <button className={styles.secondary} disabled={isBusy} onClick={onEnterPreviewMode} type="button">Explore the court</button>
        {error && <p className={styles.loginError} role="alert">{error}</p>}
        <p className={styles.loginSecurity}>Sign in securely with X. This app never asks for your X password.</p>
        <CourtActivityFeed className={styles.loginActivity} />
        <details className={styles.loginDetails}>
          <summary>New to the court?</summary>
          <p>Earn Coins in Games, explore the collection, or leave a tribute. Your profile holds your titles, outfits and progress.</p>
          <p>Coins are earned in play. Principessa Money is purchased. Rewards and costs are shown before you choose.</p>
        </details>
      </section>
    </main>
  );
}
