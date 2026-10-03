"use client";

import { useSyncExternalStore } from "react";

// Small screens use the touch layout. Larger touch tablets keep it in landscape;
// a desktop browser or laptop retains the desktop court at the same width.
const QUERY = "(max-width: 1024px), (max-width: 1366px) and (pointer: coarse)";
function subscribe(listener: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
export function useMobileCourtLayout() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
