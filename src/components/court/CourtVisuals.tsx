"use client";

import type { CSSProperties, ReactNode } from "react";

const shapes: Record<string, ReactNode> = {
  crown: (
    <>
      <path d="m9 20 10 10 13-17 13 17 10-10-5 29H14Z" />
      <path d="M16 42h32M22 50h20" />
      <circle cx="9" cy="17" r="3" />
      <circle cx="32" cy="10" r="3" />
      <circle cx="55" cy="17" r="3" />
    </>
  ),
  gem: (
    <>
      <path d="m10 24 10-12h24l10 12-22 30Z" />
      <path d="M10 24h44M20 12l-2 12 14 30 14-30-2-12M32 12v42" />
    </>
  ),
  heart: <path d="M32 53 12 34C-2 18 19 3 32 20 45 3 66 18 52 34Z" />,
  star: (
    <>
      <path d="m32 7 7 17 18 8-18 7-7 18-7-18-18-7 18-8Z" />
      <circle cx="32" cy="32" r="4" />
    </>
  ),
  lily: (
    <>
      <path d="M32 54V15c-12 13-10 22 0 27 10-5 12-14 0-27ZM27 38C11 11 0 39 24 42M37 38c16-27 27 1 3 4M20 48h24M25 54h14" />
    </>
  ),
  seal: (
    <>
      <path d="m32 5 24 27-24 27L8 32Z" />
      <path d="m32 17 13 15-13 15-13-15Z" />
      <circle cx="32" cy="32" r="3" />
    </>
  ),
  lock: (
    <>
      <rect x="14" y="28" width="36" height="27" rx="7" />
      <path d="M22 28V17a10 10 0 0 1 20 0v11" />
      <circle cx="32" cy="39" r="3" />
      <path d="M32 42v5" />
    </>
  ),
  coin: (
    <>
      <circle cx="32" cy="32" r="25" />
      <circle cx="32" cy="32" r="20" />
      <path d="M25 43V21h9a7 7 0 0 1 0 14h-9M29 17v30" />
    </>
  ),
  threat: (
    <>
      <path d="M32 7 54 48H10Z" />
      <path d="m23 24 18 18M41 24 23 42" />
    </>
  ),
  bolt: <path d="M37 5 14 36h16l-3 23 23-32H34Z" />,
  gift: (
    <>
      <rect x="12" y="28" width="40" height="27" rx="3" />
      <path d="M9 23h46v9H9ZM32 23v32M32 22C9 26 12 3 23 11ZM32 22c23 4 20-19 9-11Z" />
    </>
  ),
  letter: (
    <>
      <rect x="8" y="17" width="48" height="32" rx="4" />
      <path d="m9 20 23 18 23-18M9 46l16-14m30 14L39 32" />
    </>
  ),
  pet: (
    <>
      <path d="M17 24 10 9l17 9h10L54 9l-7 15v18L32 55 17 42Z" />
      <path d="m23 31 4 2m10 0 4-2m-13 9 4 3 4-3M32 43v5" />
    </>
  ),
  principessa: (
    <>
      <circle cx="32" cy="36" r="21" />
      <path d="m19 15-3-9 10 5 6-8 6 8 10-5-3 9M26 48V25h8a7 7 0 0 1 0 14h-8M29 22v29" />
      <path d="m6 29-3 7 3 7m52-14 3 7-3 7" />
    </>
  ),
};
const aliases: Record<string, string> = {
  "♛": "crown",
  "♕": "crown",
  "♦": "gem",
  "♥": "heart",
  "✦": "star",
  "⚜": "lily",
  "◈": "seal",
  "☠": "threat",
  "⚡": "bolt",
  "✖": "threat",
  "💐": "gift",
  "💎": "gem",
  "✉": "letter",
};
export function CourtGlyph({
  symbol = "crown",
  className = "",
}: {
  symbol?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={"court-glyph " + className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes[aliases[symbol] ?? symbol] ?? shapes.seal}
    </svg>
  );
}
export function SealFaces({
  open,
  matched = false,
  children,
}: {
  open: boolean;
  matched?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className="seal-flip"
      data-open={open}
      data-matched={matched}
      aria-hidden="true"
    >
      <span className="seal-flip-inner">
        <span className="seal-face seal-back">
          <span className="seal-corner seal-corner-a" />
          <CourtGlyph />
          <span className="seal-corner seal-corner-b" />
        </span>
        <span className="seal-face seal-front">
          {children}
          {matched && <span className="seal-matched">✓</span>}
        </span>
      </span>
    </span>
  );
}
export function CourtPortrait({
  mood = "neutral",
  caption,
  compact = false,
}: {
  mood?: "neutral" | "approved" | "watchful" | "disappointed";
  caption?: string;
  compact?: boolean;
}) {
  const positions = {
    neutral: "0% 0%",
    approved: "100% 0%",
    watchful: "0% 100%",
    disappointed: "100% 100%",
  };
  return (
    <div
      className={
        "court-reaction-portrait " +
        (compact ? "court-reaction-portrait--compact" : "")
      }
      data-mood={mood}
    >
      <div
        className="court-reaction-frame"
        role="img"
        aria-label={"Principessa, " + mood}
        style={{ backgroundPosition: positions[mood] }}
      />
      <span className="court-portrait-vignette" />
      {caption && (
        <p className="court-portrait-caption" key={caption}>
          {caption}
        </p>
      )}
    </div>
  );
}
export function WritingLine({
  text,
  value,
  complete = false,
}: {
  text: string;
  value: string;
  complete?: boolean;
}) {
  return (
    <span className="court-writing-line">
      {text.split("").map((character, index) => (
        <span key={index} className={complete ? "court-writing-ink" : index < value.length ? character === value[index] ? "court-writing-ink" : "court-writing-error" : index === value.length ? "court-writing-cursor" : undefined}>
          {character}
        </span>
      ))}
      {!complete && value.length > text.length && <span className="court-writing-error" aria-label="Extra characters">{value.slice(text.length)}</span>}
      {complete && (
        <span className="court-writing-seal" aria-label="Complete">
          ✓
        </span>
      )}
    </span>
  );
}
export function CourtDie({
  value,
  rolling = false,
}: {
  value: number;
  rolling?: boolean;
}) {
  const dots: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  return (
    <span
      className="court-die"
      data-rolling={rolling}
      aria-label={String(value)}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} data-dot={(dots[value] ?? []).includes(i)} />
      ))}
    </span>
  );
}
export function CourtRunner({
  running = false,
  color = "#dfb978",
}: {
  running?: boolean;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 80 48"
      className="court-runner"
      data-running={running}
      style={{ "--runner-color": color } as CSSProperties}
      aria-hidden="true"
    >
      <ellipse cx="37" cy="43" rx="25" ry="3" fill="black" opacity=".3" />
      <g fill="currentColor">
        <ellipse cx="35" cy="22" rx="20" ry="10" />
        <path d="m53 21 4-15 13 4 6 12-9 6-15-2Z" />
        <path d="M18 21C4 22 4 4 11 6c-2 9 9 6 10 12Z" />
        <path
          className="runner-leg runner-leg-a"
          d="m21 26-3 15h7l5-15Zm23 0 3 15h7l-3-15Z"
        />
        <path
          className="runner-leg runner-leg-b"
          d="m28 26 4 14h7l-3-14Zm22-1 8 15h7l-8-15Z"
        />
      </g>
      <path d="m55 23 11 2" stroke="var(--runner-color)" strokeWidth="4" />
      <circle cx="66" cy="15" r="1.5" fill="#fff0cf" />
    </svg>
  );
}
export function ActionFigure({ action }: { action: string | null }) {
  return (
    <svg
      className="court-action-figure"
      data-action={action ?? "idle"}
      viewBox="0 0 80 64"
      aria-hidden="true"
    >
      <path d="M6 58h68" stroke="currentColor" opacity=".25" />
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      >
        <g className="action-figure-upper">
          <circle cx="40" cy="12" r="6" />
          <path d="M40 20v20m0-16-12 10m12-10 12 10" />
        </g>
        <path className="action-figure-legs" d="M40 40 30 56m10-16 10 16" />
      </g>
    </svg>
  );
}
