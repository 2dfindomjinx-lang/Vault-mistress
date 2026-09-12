"use client";
import styles from "./ShrineRitual.module.css";
import { useEffect, useState, type CSSProperties } from "react";
export type DrainVisualResult = {
  drainedUserXp?: number;
  transferredXp?: number;
};
export function LevelDrainTransfer({ result }: { result: DrainVisualResult }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame: number;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const start = performance.now();
    const tick = (now: number) => {
      const p = reduced ? 1 : Math.min(1, (now - start) / 1400);
      setProgress(p);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  const drained = result.drainedUserXp ?? 0,
    received = result.transferredXp ?? 0;
  return (
    <div className={styles.xpReceipt}>
      <div className="court-drain-transfer" data-settled={progress === 1}>
        <div>
          Your offering
          <strong>
            {Math.round(drained * (1 - progress)).toLocaleString()}
          </strong>
          XP remaining
        </div>
        <span className="court-drain-stream" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <i key={i} style={{ "--delay": i * 0.12 + "s" } as CSSProperties} />
          ))}
        </span>
        <div>
          Principessa receives
          <strong>+{Math.round(received * progress).toLocaleString()}</strong>XP
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-amber-100/70" role="status">
        {progress === 1
          ? drained.toLocaleString() +
            " XP offered · " +
            received.toLocaleString() +
            " XP received (25%)"
          : "Your offering reaches her."}
      </p>
    </div>
  );
}
