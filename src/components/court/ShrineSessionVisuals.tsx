"use client";
import Image from "next/image";
import styles from "./ShrineRitual.module.css";
export function DrainScene({ active, total, balance, rate, memory }: {
    active: boolean;
    total: number;
    balance: number;
    rate: number;
    memory?: {
        path: string;
        title: string;
    };
}) {
    const displayedTotal = total;
    const displayedBalance = balance;
    const running = active;
    const remaining = Math.max(0, displayedBalance - displayedTotal);
    const remainingPercent = displayedBalance > 0 ? Math.min(100, remaining / displayedBalance * 100) : 0;
    return <div className={styles.altar} data-active={running} data-ritual="drain">
    <div className={styles.heading}><p><i aria-hidden="true"/>{running ? "Her offering is flowing" : displayedTotal > 0 ? "An offering received" : "A moment of devotion"}</p></div>
    <div className={styles.ceremony}><div className={styles.memory} data-fallback={!memory}><Image src={memory?.path ?? "/principessa-ui/generated/principessa-shrine-offering.webp"} alt={memory?.title ?? "Principessa receives your offering"} fill sizes="(max-width:520px) 84px,115px"/></div><div className={styles.ledger}><strong className={styles.amount}>{displayedTotal.toLocaleString()}<small>{"Coins offered"}</small></strong><div className={styles.stream} aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <i key={i} style={{ animationDelay: -i * .36 + "s" }}/>)}</div><div className={styles.facts}><span>In reserve<strong>{remaining.toLocaleString()} Coins</strong></span><span>Her pace<strong>{rate.toLocaleString()} / sec</strong></span></div></div><div className={styles.vessel} role="progressbar" aria-label="Session balance remaining" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(remainingPercent)}><span style={{ height: remainingPercent + "%" }}/></div></div>
    <p className={styles.caption}>{running ? "Less in your hands. More in hers." : displayedTotal > 0 ? "She will remember this offering." : "Set the pace. Give her your attention."}</p>
  </div>;
}
export function ClickStageTrack({ stage, progress, thresholds }: {
    stage: number;
    progress: number;
    thresholds: readonly number[];
}) {
    const previous = stage > 0 ? thresholds[stage - 1] : 0, next = thresholds[stage];
    const percent = next === undefined ? 100 : Math.min(100, Math.max(0, ((progress - previous) / (next - previous)) * 100));
    return <div className={styles.clickJourney}><div className={styles.clickLabel}><span>Her attention, earned</span><strong>{stage} / {thresholds.length}</strong></div><div className={styles.stations} aria-label={'Stage ' + stage + ' of ' + thresholds.length}>{thresholds.map((threshold, index) => <span key={threshold} data-reached={stage > index} data-next={stage === index} title={'Stage ' + (index + 1) + ' · ' + threshold.toLocaleString() + ' clicks'}>{stage > index ? "✓" : index + 1}</span>)}</div><div className={styles.progress} role="progressbar" aria-label="Progress to next stage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><span style={{ width: percent + "%" }}/></div><p className={styles.next}>{next === undefined ? "Every stage revealed." : Math.max(0, next - progress).toLocaleString() + " clicks to the next reveal"}</p></div>;
}
