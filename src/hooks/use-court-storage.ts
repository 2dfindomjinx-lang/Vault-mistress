"use client";
import { useCallback, useSyncExternalStore } from "react";
const eventName = "court:local-state";
const subscribe = (listener: () => void) => {
  window.addEventListener("storage", listener);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(eventName, listener);
  };
};
export function useCourtStorage(key: string) {
  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  }, [key]);
  const value = useSyncExternalStore(subscribe, getSnapshot, () => "");
  const setValue = useCallback(
    (next: string) => {
      try {
        localStorage.setItem(key, next);
        window.dispatchEvent(new Event(eventName));
      } catch {
        /* Browser storage can be unavailable. */
      }
    },
    [key],
  );
  return [value, setValue] as const;
}
