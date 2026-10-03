"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import styles from "./MobileCourt.module.css";

/** Keep visited panels mounted: returning must not reset a running task. */
export function MobileActivityTabs({ entries }: { entries: { key: string; label: string; content: ReactNode }[] }) {
  const id = useId();
  const [active, setActive] = useState(entries[0].key);
  const [visited, setVisited] = useState([entries[0].key]);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function select(key: string) {
    setActive(key);
    setVisited(previous => previous.includes(key) ? previous : [...previous, key]);
  }
  return <div className={styles.activityWorkspace}>
    <div role="tablist" aria-label="Choose an activity" className={styles.activityTabs}>
      {entries.map((entry, index) => <button key={entry.key} ref={node => { refs.current[index] = node; }} type="button" role="tab" id={`${id}-${entry.key}-tab`} aria-controls={`${id}-${entry.key}`} aria-selected={active === entry.key} tabIndex={active === entry.key ? 0 : -1}
        onClick={() => select(entry.key)} onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (index + 1) % entries.length : event.key === "ArrowLeft" ? (index + entries.length - 1) % entries.length : event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : -1;
          if (next < 0) return;
          event.preventDefault(); select(entries[next].key); refs.current[next]?.focus();
        }}>{entry.label}</button>)}
    </div>
    {entries.map(entry => <section key={entry.key} role="tabpanel" id={`${id}-${entry.key}`} aria-labelledby={`${id}-${entry.key}-tab`} hidden={active !== entry.key}>{visited.includes(entry.key) ? entry.content : null}</section>)}
  </div>;
}
