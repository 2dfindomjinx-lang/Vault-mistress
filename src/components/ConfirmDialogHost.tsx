"use client";

import { useEffect, useRef, useState } from "react";
import { settleDialog, subscribeToDialogs, type DialogRequest } from "@/lib/confirm-dialog";

// Renders the site's confirm / alert dialogs (see src/lib/confirm-dialog.ts).
// Mounted once in the root layout. Shows one dialog at a time, oldest first.

export function ConfirmDialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const current = queue[0] ?? null;

  useEffect(() => subscribeToDialogs(setQueue), []);

  useEffect(() => {
    if (!current) return;
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        settleDialog(current.id, false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  if (!current) return null;

  const danger = current.tone === "danger";
  const isAlert = current.kind === "alert";
  const title = current.title ?? (isAlert ? "Notice" : danger ? "Are you sure?" : "Please confirm");

  return (
    <div
      aria-labelledby="site-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) settleDialog(current.id, false);
      }}
      role={isAlert ? "alertdialog" : "dialog"}
    >
      <div
        className={`relative w-full max-w-sm overflow-hidden rounded-[1.75rem] border bg-[radial-gradient(circle_at_50%_0%,rgba(236,72,153,.16),transparent_55%),linear-gradient(160deg,#1a0d17,#07050a)] p-6 shadow-[0_30px_90px_rgba(0,0,0,.65)] ${danger ? "border-rose-300/30" : "border-[#c89a55]/30"}`}
      >
        <div
          className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent to-transparent ${danger ? "via-rose-300/70" : "via-amber-200/75"}`}
        />
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border text-xl font-black ${danger ? "border-rose-300/40 bg-rose-500/10 text-rose-200" : "border-[#c89a55]/40 bg-[#c89a55]/10 text-[#ffe2ad]"}`}
        >
          {isAlert ? "i" : "?"}
        </div>
        <h2 className="mt-4 text-center font-serif text-xl font-semibold text-white" id="site-dialog-title">
          {title}
        </h2>
        <p className="mt-2 whitespace-pre-line text-center text-sm leading-6 text-zinc-300">{current.message}</p>
        <div className={`mt-6 grid gap-2 ${isAlert ? "" : "grid-cols-2"}`}>
          {isAlert ? null : (
            <button
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
              onClick={() => settleDialog(current.id, false)}
              type="button"
            >
              {current.cancelLabel ?? "Cancel"}
            </button>
          )}
          <button
            className={`rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] transition ${danger ? "bg-rose-500 text-white hover:bg-rose-400" : "bg-[linear-gradient(100deg,#e6ba73,#c89a55)] text-[#1a1008] hover:brightness-110"}`}
            onClick={() => settleDialog(current.id, true)}
            ref={confirmRef}
            type="button"
          >
            {current.confirmLabel ?? (isAlert ? "OK" : "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
