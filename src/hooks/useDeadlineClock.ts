"use client";

import { useEffect, useMemo, useState } from "react";

type Deadline = number | string | null | undefined;

function parseDeadline(value: Deadline) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function useDeadlineClock(deadlines: Deadline[], cadenceMs: number) {
  const [now, setNow] = useState(() => Date.now());
  const deadlineKey = deadlines.map((deadline) => deadline ?? "").join("|");
  const parsedDeadlines = useMemo(
    () => deadlineKey.split("|").map(parseDeadline).filter((deadline): deadline is number => deadline !== null),
    [deadlineKey],
  );

  useEffect(() => {
    let timer: number | null = null;

    const schedule = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }

      const current = Date.now();
      const nextDeadline = parsedDeadlines
        .filter((deadline) => deadline > current)
        .reduce<number | null>((nearest, deadline) => nearest === null || deadline < nearest ? deadline : nearest, null);
      const deadlineDelay = nextDeadline === null ? cadenceMs : Math.max(250, nextDeadline - current + 50);
      const delay = Math.min(cadenceMs, deadlineDelay);

      timer = window.setTimeout(() => {
        if (document.visibilityState !== "hidden") {
          setNow(Date.now());
        }
        schedule();
      }, delay);
    };

    const refresh = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        schedule();
      }
    };

    const initialTimer = window.setTimeout(refresh, 0);
    document.addEventListener("visibilitychange", refresh);
    schedule();

    return () => {
      window.clearTimeout(initialTimer);
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [cadenceMs, parsedDeadlines]);

  return now;
}
