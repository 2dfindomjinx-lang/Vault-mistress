import styles from "./WheelFinish.module.css";

export function WheelVerdict({ kind, label }: { kind:"money"|"chastity"; label:string }) {
  return <div className={styles.verdictHost}><div className={styles.verdict} data-kind={kind} role="status">
    <div className={styles.verdictSeal} aria-hidden="true">{kind === "chastity" ? <svg viewBox="0 0 32 36" fill="none" stroke="currentColor" strokeWidth="2"><path className={styles.shackle} d="M8 16V10a8 8 0 0 1 16 0v6"/><rect x="4" y="16" width="24" height="17" rx="4"/><circle cx="16" cy="23" r="2"/><path d="M16 25v3"/></svg> : <svg viewBox="0 0 40 36" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 10 7 8 8-13 8 13 7-8-4 18H9Z"/><path d="M9 32h22"/><circle cx="20" cy="22" r="2"/></svg>}</div>
    <div><small>{kind === "chastity" ? "The lock is sealed" : "By Principessa’s authority"}</small><strong>{label}</strong><span>{kind === "chastity" ? "Added to your counter." : "Your order, recorded."}</span></div>
  </div></div>;
}
