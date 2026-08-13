"use client";

import { useEffect, useState } from "react";

// One-time pop-up on /birthday-2026. Two states behind one door: someone who
// already left a rose is handed their slice, someone who has not is invited to
// leave one. It is deliberately cosmetic - no item, no currency, nothing the
// economy has to know about.
//
// "Seen" lives in localStorage rather than in a table. The pop-up is a nudge,
// not a reward that has to reach a specific person, so a second showing on a
// second device costs nothing and this ships without a migration during a live
// event. The post-event thank-you slice is the opposite case and will need a
// server-side flag.
const SEEN_STORAGE_KEY = "vm:birthday-2026:slice-popup-seen";

function CakeSlice() {
  return (
    <svg
      aria-hidden
      className="mx-auto h-auto w-40 drop-shadow-[0_10px_30px_rgba(0,0,0,.6)]"
      fill="none"
      viewBox="0 0 200 170"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="vm-slice-sponge" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#5d1f3c" />
          <stop offset="55%" stopColor="#48162d" />
          <stop offset="100%" stopColor="#2c0d1c" />
        </linearGradient>
        <linearGradient id="vm-slice-cream" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#ffe9c2" />
          <stop offset="50%" stopColor="#f7d199" />
          <stop offset="100%" stopColor="#e2b477" />
        </linearGradient>
        <linearGradient id="vm-slice-plate" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#6f481c" />
          <stop offset="48%" stopColor="#f0c879" />
          <stop offset="100%" stopColor="#81551f" />
        </linearGradient>
      </defs>

      <ellipse cx="100" cy="150" fill="#0d0709" rx="82" ry="12" />
      <ellipse cx="100" cy="147" fill="url(#vm-slice-plate)" rx="78" ry="10" />

      {/* Cut face pointing left, crust to the right - a wedge lifted out. */}
      <path d="M42 132 L150 132 L150 60 L42 96 Z" fill="url(#vm-slice-sponge)" />
      <path d="M42 96 L150 60 L150 46 L42 82 Z" fill="url(#vm-slice-cream)" />
      <path d="M42 118 L150 100 L150 92 L42 110 Z" fill="url(#vm-slice-cream)" opacity="0.85" />
      <path d="M150 132 L150 46 L162 52 L162 130 Z" fill="#3a1226" />

      {/* Drips down the cut face. */}
      <path d="M60 88 q6 14 12 0 z" fill="#ffe9c2" opacity="0.9" />
      <path d="M92 78 q7 16 14 0 z" fill="#ffe9c2" opacity="0.9" />
      <path d="M124 68 q6 13 12 0 z" fill="#ffe9c2" opacity="0.9" />

      <circle cx="96" cy="44" fill="#b5142f" r="9" />
      <path d="M96 35 q4 -12 13 -15" stroke="#4b7a2b" strokeWidth="2.5" />
      <circle cx="93" cy="41" fill="#ff8fa3" opacity="0.65" r="2.4" />
    </svg>
  );
}

export function BirthdaySliceModal({
  hasLeftRose,
  isLive,
  onGoToRose,
  ready,
}: {
  hasLeftRose: boolean;
  isLive: boolean;
  onGoToRose: () => void;
  ready: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Waits for `ready` so the copy matches reality: opening before the
    // celebration payload lands would tell a rose leaver to go leave a rose.
    if (!ready || !isLive) return;
    let seen = true;
    try {
      seen = window.localStorage.getItem(SEEN_STORAGE_KEY) === "1";
    } catch {
      // Private mode or blocked storage - show it, just do not remember.
      seen = false;
    }
    if (seen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage, which React cannot derive
    setIsOpen(true);
  }, [isLive, ready]);

  const dismiss = () => {
    setIsOpen(false);
    try {
      window.localStorage.setItem(SEEN_STORAGE_KEY, "1");
    } catch {
      // Nothing to do - it will simply show once more next time.
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      aria-labelledby="birthday-slice-title"
      aria-modal
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
      onClick={dismiss}
      role="dialog"
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-[#c89a55]/30 bg-[linear-gradient(165deg,rgba(38,10,24,.97),rgba(7,4,6,.99))] p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,.7)]"
        onClick={(event) => event.stopPropagation()}
      >
        <span aria-hidden className="pointer-events-none absolute inset-2 rounded-[1.7rem] border border-pink-200/[0.07]" />

        <button
          aria-label="Close"
          className="absolute right-4 top-4 text-lg leading-none text-zinc-600 transition hover:text-zinc-300"
          onClick={dismiss}
          type="button"
        >
          ×
        </button>

        <div className="relative">
          <p className="text-[9px] font-black uppercase tracking-[0.34em] text-[#d7ad69]/70">Her birthday cake</p>
          <h2 className="mt-3 font-serif text-3xl text-[#fff0e5]" id="birthday-slice-title">
            {hasLeftRose ? "She cut you a slice" : "A slice with your name on it"}
          </h2>

          <div className="mt-5">
            <CakeSlice />
          </div>

          <p className="mt-5 text-sm leading-6 text-zinc-400">
            {hasLeftRose
              ? "Your rose is at her throne, so a slice was set aside for you. Take it - it costs nothing and it is yours."
              : "Every rose left at her throne earns a slice of her cake. Yours is still on the plate, waiting for a rose."}
          </p>

          <button
            className={`mt-6 w-full rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.16em] transition ${
              hasLeftRose
                ? "border border-[#c89a55]/40 bg-[#c89a55]/15 text-[#fff0d2] hover:bg-[#c89a55]/25"
                : "border border-rose-300/30 bg-rose-500/15 text-rose-50 hover:bg-rose-500/25"
            }`}
            onClick={() => {
              if (!hasLeftRose) onGoToRose();
              dismiss();
            }}
            type="button"
          >
            {hasLeftRose ? "Take my slice" : "Leave a rose"}
          </button>

          <p className="mt-3 text-[10px] leading-4 text-zinc-600">
            Free, and shown once. The cake is a keepsake, not an item - nothing enters your vault.
          </p>
        </div>
      </div>
    </div>
  );
}
