"use client";

import { useSyncExternalStore } from "react";
import { COLOR_MODE_KEY, type ColorMode } from "@/lib/color-mode";

function applyMode(mode: ColorMode) {
  document.documentElement.dataset.colorMode = mode;
  document.documentElement.style.colorScheme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", mode === "dark" ? "#181323" : "#d7eef0");
  window.dispatchEvent(new Event("vault:color-mode"));
}

function subscribe(listener: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const refresh = () => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(COLOR_MODE_KEY); } catch { /* Storage may be unavailable. */ }
    applyMode(saved === "light" || saved === "dark" ? saved : media.matches ? "dark" : "light");
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === COLOR_MODE_KEY || event.key === null) refresh();
  };
  window.addEventListener("vault:color-mode", listener);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", refresh);
  refresh();
  return () => {
    window.removeEventListener("vault:color-mode", listener);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", refresh);
  };
}

function getSnapshot(): ColorMode {
  return document.documentElement.dataset.colorMode === "dark" ? "dark" : "light";
}
const getServerSnapshot = (): ColorMode => "light";

export function ColorModeToggle() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const label = mode === "dark" ? "Switch to light mode" : "Switch to dark mode";
  function toggle() {
    const next = getSnapshot() === "dark" ? "light" : "dark";
    try { localStorage.setItem(COLOR_MODE_KEY, next); } catch { /* Still works for this page. */ }
    applyMode(next);
  }
  return <button className="bb-color-toggle" type="button" onClick={toggle} aria-label={label} title={label}>
    <svg className="bb-moon-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20.8 13.1A8.8 8.8 0 0 1 10.9 3.2a9 9 0 1 0 9.9 9.9Z"/></svg>
    <svg className="bb-sun-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>
  </button>;
}
