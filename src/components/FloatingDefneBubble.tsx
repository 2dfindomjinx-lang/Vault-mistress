import Image from "next/image";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { getGlobalPrincipessaVisualTier } from "@/lib/global-principessa";

type FloatingDefneBubbleProps = {
  avatarSrc?: string;
  message: string;
  messageId?: number;
  messageStyle?: CSSProperties;
  globalPrincipessaLevel?: number;
  onBubbleFullyHidden?: (message: string, messageId: number) => void;
};

const fadeDuration = 2000;

function sanitizeBubbleMessage(message: string) {
  return message
    .replace(/(?:https?:\/\/|www\.)\S+/gi, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function FloatingDefneBubble({
  avatarSrc = "/character-icon.png",
  globalPrincipessaLevel = 1,
  message,
  messageId,
  messageStyle,
  onBubbleFullyHidden,
}: FloatingDefneBubbleProps) {
  const bubbleKey = messageId ?? message;
  const displayMessage = sanitizeBubbleMessage(message);
  const [hiddenBubbleKey, setHiddenBubbleKey] = useState<number | string | null>(null);
  const visualTier = getGlobalPrincipessaVisualTier(globalPrincipessaLevel);
  const visualClass =
    visualTier === "maximum"
      ? "border-red-200/80 shadow-[0_0_60px_rgba(248,113,113,0.75),0_0_100px_rgba(236,72,153,0.45)]"
      : visualTier === "boss-fire"
        ? "border-red-300/70 shadow-[0_0_54px_rgba(239,68,68,0.62)]"
      : visualTier === "heavy-fire"
          ? "border-orange-300/65 shadow-[0_0_48px_rgba(249,115,22,0.55)]"
          : visualTier === "burning-border"
            ? "border-orange-200/60 shadow-[0_0_42px_rgba(251,146,60,0.46)]"
            : visualTier === "fire"
              ? "border-amber-200/55 shadow-[0_0_40px_rgba(245,158,11,0.42)]"
              : visualTier === "spark"
                ? "border-yellow-200/55 shadow-[0_0_38px_rgba(250,204,21,0.38)]"
                : visualTier === "energy"
                  ? "border-cyan-200/50 shadow-[0_0_38px_rgba(34,211,238,0.34)]"
                  : visualTier === "particles"
                    ? "border-fuchsia-200/55 shadow-[0_0_38px_rgba(217,70,239,0.34)]"
                    : visualTier === "neon-border"
                      ? "border-pink-200/60 shadow-[0_0_40px_rgba(236,72,153,0.42)]"
                      : visualTier === "pulse"
                        ? "principessa-aura-sparkle border-pink-200/50 shadow-[0_0_36px_rgba(236,72,153,0.36)]"
                        : visualTier === "strong-glow"
                          ? "border-pink-200/45 shadow-[0_0_34px_rgba(236,72,153,0.38)]"
                          : visualTier === "subtle-glow"
                            ? "border-pink-200/40 shadow-[0_0_30px_rgba(236,72,153,0.32)]"
                            : "border-pink-200/30 shadow-[0_0_34px_rgba(236,72,153,0.3)]";

  useEffect(() => {
    const visibleDuration = Math.floor(Math.random() * 2001) + 4000;
    const hideTimer = window.setTimeout(() => {
      setHiddenBubbleKey(bubbleKey);
    }, visibleDuration);
    const hiddenTimer = window.setTimeout(() => {
      onBubbleFullyHidden?.(displayMessage, messageId ?? 0);
    }, visibleDuration + fadeDuration);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(hiddenTimer);
    };
  }, [bubbleKey, displayMessage, messageId, onBubbleFullyHidden]);

  const bubbleVisible = hiddenBubbleKey !== bubbleKey;

  return (
    <aside className="fixed bottom-4 right-4 z-30 flex max-w-[calc(100vw-2rem)] items-center gap-3 sm:bottom-6 sm:right-6 sm:max-w-2xl sm:gap-4">
      <div
        className={`flex min-h-16 items-center rounded-[1.5rem] border bg-black/80 px-4 py-3 text-base font-semibold leading-6 text-pink-50 ${visualClass} backdrop-blur transition-opacity duration-[2000ms] sm:min-h-20 sm:px-5 sm:py-4 sm:text-lg sm:leading-7 ${
          bubbleVisible ? "opacity-100" : "opacity-0"
        }`}
        style={messageStyle}
      >
        <span className="relative z-10">{displayMessage}</span>
      </div>
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-pink-200/50 bg-fuchsia-950 shadow-[0_0_32px_rgba(236,72,153,0.44)] sm:h-22 sm:w-22">
        <Image
          alt="Principessa avatar"
          className="object-cover object-top"
          fill
          unoptimized
          sizes="88px"
          src={avatarSrc}
        />
      </div>
    </aside>
  );
}
