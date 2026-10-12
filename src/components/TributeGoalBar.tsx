import styles from "./TributeGoalBar.module.css";

// All-time Throne tribute goal. The goal is a ladder ($3,500 -> $4,000 -> ...),
// so the bar shows progress inside the CURRENT step: previous target on the
// left, next target on the right. Palette and motion (flowing rainbow, light
// sweep) match the goal bar on the court site.

const usd = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;

export function TributeGoalBar({ floorUsd, goalUsd, raisedUsd }: { floorUsd: number; goalUsd: number; raisedUsd: number }) {
  const step = goalUsd - floorUsd;
  const progress = step > 0 ? Math.min(100, Math.max(0, ((raisedUsd - floorUsd) / step) * 100)) : 0;
  const percent = Math.round(progress);

  return (
    <section aria-label="All-time tribute goal" className={styles.card}>
      <div className={styles.heading}>
        <span className={styles.eyebrow}>All-Time Tributed</span>
        <strong className={styles.total}>
          {usd(raisedUsd)}
          <span>/ {usd(goalUsd)}</span>
        </strong>
      </div>
      <div className={styles.row}>
        <span className={styles.end}>{usd(floorUsd)}</span>
        <div className={styles.progress}>
          <div
            aria-label="Progress to the next target"
            aria-valuemax={goalUsd}
            aria-valuemin={floorUsd}
            aria-valuenow={Math.min(goalUsd, Math.max(floorUsd, raisedUsd))}
            className={styles.track}
            role="progressbar"
          >
            <span className={styles.fill} style={{ width: `${Math.max(2, progress)}%` }} />
          </div>
          <span aria-hidden="true" className={styles.knob} style={{ left: `clamp(8px, ${progress}%, calc(100% - 8px))` }} />
        </div>
        <span className={styles.end}>{usd(goalUsd)}</span>
      </div>
      <p className={styles.note}>
        {percent}% · <b>{usd(Math.max(0, goalUsd - raisedUsd))}</b> to go
      </p>
    </section>
  );
}
