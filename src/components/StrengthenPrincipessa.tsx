"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { PRINCIPESSA_PRESENCE_TIERS, getPrincipessaPresence } from "@/lib/principessa-presence";
import { emitSoundEvent } from "@/lib/sound";
import { PrincipessaPowerPortrait } from "./PrincipessaPowerPortrait";
import type { DrainVisualResult } from "./court/LevelDrainTransfer";
import styles from "./StrengthenPrincipessa.module.css";

export function StrengthenPrincipessa({ level, xp, requiredXp, progress, userLevel, userXp, disabled, pending, onGive }: {
  level: number; xp: number; requiredXp: number | null; progress: number;
  userLevel: number; userXp: number; disabled?: boolean; pending?: boolean;
  onGive: () => DrainVisualResult | void | Promise<DrainVisualResult | void>;
}) {
  const power = getPrincipessaPresence(level);
  const [receipt, setReceipt] = useState<DrainVisualResult | null>(null);
  const [sending, setSending] = useState(false);
  const busy = useRef(false);
  const available = userLevel >= 2;
  const transfer = available ? Math.max(1, Math.floor(userXp * .25)) : 0;
  const showReceipt = receipt !== null && !available;
  const give = async () => {
    if (busy.current || pending || disabled || !available) return;
    busy.current = true;
    setSending(true);
    setReceipt(null);
    emitSoundEvent("button_click");
    try {
      const result = await onGive();
      if (result) setReceipt(result);
    } finally { busy.current = false; setSending(false); }
  };

  return <section className={styles.panel} data-task-id="level-drain" data-task-kind="level-drain" aria-labelledby="strengthen-title">
    <header className={styles.header}>
      <div className={styles.art}><Image src="/principessa-ui/atelier/v4/strength_v4.webp" alt="" fill sizes="76px" className="object-cover" /></div>
      <div><p>Her monthly reign</p><h3 id="strengthen-title">Strengthen Principessa</h3><span>Your XP shapes her presence throughout the court.</span></div>
      <span className={styles.reset}>Resets on the 1st<small>Türkiye time</small></span>
    </header>

    <div className={styles.body}>
      <div className={styles.appearance} aria-label="Principessa appearance progression">
        <PrincipessaPowerPortrait level={level} />
        <div className={styles.appearanceCopy}>
          <span>Current presence</span><strong>{power.name}</strong><p>{power.detail}. Her portrait and speech carry this look across the site.</p>
          <div className={styles.progressLabel}><span>Level {power.currentLevel}</span><span>{requiredXp === null ? "Maximum level" : `${xp.toLocaleString()} / ${requiredXp.toLocaleString()} XP`}</span></div>
          <div className={styles.meter} role="progressbar" aria-label="Principessa level progress" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
        </div>
        {power.next && <div className={styles.next}><span>Next · Lv. {power.next.level}</span><PrincipessaPowerPortrait level={power.next.level} /><small>{power.next.detail}</small></div>}
      </div>
      <ol className={styles.milestones} aria-label="Presence milestones">{PRINCIPESSA_PRESENCE_TIERS.map((tier) => <li key={tier.id} data-reached={level >= tier.level} aria-current={power.id === tier.id ? "step" : undefined}><span>{tier.name}</span><strong>Lv. {tier.level}</strong></li>)}</ol>
    </div>

    <footer className={styles.footer}>
      <div className={styles.offering}>
        <div><span>{showReceipt ? "You gave" : "You give"}</span><strong>{Math.floor(showReceipt ? receipt.drainedUserXp ?? 0 : userXp).toLocaleString()} XP</strong><small>{showReceipt ? "Offering complete · Level 1" : available ? `Level ${userLevel} → Level 1` : "Available from Level 2"}</small></div>
        <span aria-hidden="true">→</span>
        <div><span>{showReceipt ? "She received" : "She receives"}</span><strong>+{(showReceipt ? receipt.transferredXp ?? 0 : transfer).toLocaleString()} XP</strong><small>{showReceipt ? "Added to Principessa’s XP" : "25% of your XP"}</small></div>
      </div>
      <button type="button" disabled={disabled || !available || pending || sending} onClick={() => void give()}>{pending || sending ? "Giving…" : available ? "Give her all your XP" : "Requires Level 2"}<span aria-hidden="true">↗</span></button>
    </footer>
    <p className={styles.receipt} role="status" aria-live="polite">{receipt ? `${(receipt.drainedUserXp ?? 0).toLocaleString()} XP given · +${(receipt.transferredXp ?? 0).toLocaleString()} XP received by Principessa.` : "Shared by the whole court. Your offering returns your level to 1."}</p>
  </section>;
}
