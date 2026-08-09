import Image from "next/image";

// The Principessa Money banknote. The source art in
// public/principessa-money-icon.png is a 1254x1254 canvas with the note
// letterboxed inside transparent padding, which made it render as a tiny
// stamp in a big empty box. public/principessa-money.png is that same art
// trimmed to the note (480x282, ~115 KB instead of 2.2 MB) so it can be used
// inline at text size without any cropping tricks.
const MONEY_ICON_ASPECT = 480 / 282;

export function MoneyIcon({ className = "", height = 16 }: { className?: string; height?: number }) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={`inline-block shrink-0 align-[-0.18em] ${className}`}
      height={height}
      src="/principessa-money.png"
      width={Math.round(height * MONEY_ICON_ASPECT)}
    />
  );
}
