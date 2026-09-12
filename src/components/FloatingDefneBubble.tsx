"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { getGlobalPrincipessaVisualTier } from "@/lib/global-principessa";
import styles from "./SpeechPresence.module.css";

const subscribeToMount = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

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
  avatarSrc = "/character-icon.webp",
  globalPrincipessaLevel = 1,
  message,
  messageId,
  messageStyle,
  onBubbleFullyHidden,
}: FloatingDefneBubbleProps) {
  const bubbleKey = messageId ?? message;
  const displayMessage = sanitizeBubbleMessage(message);
  const [hiddenBubbleKey, setHiddenBubbleKey] = useState<number | string | null>(null);
  const mounted = useSyncExternalStore(subscribeToMount, clientSnapshot, serverSnapshot);
  const presenceRef = useRef<HTMLElement>(null);
  const visualTier = getGlobalPrincipessaVisualTier(globalPrincipessaLevel);

  useEffect(() => {
    const presence = presenceRef.current;
    if (!mounted || !presence || typeof presence.showPopover !== "function") return;
    const bringForward = () => {
      if (!presence.isConnected) return;
      if (presence.matches(":popover-open")) presence.hidePopover();
      presence.showPopover();
    };
    bringForward();
    // Native dialogs/popovers also live above CSS stacking contexts. Re-promote
    // this non-modal presence when one opens, without changing keyboard focus.
    const onOverlayToggle = (event: Event) => {
      if (event.target !== presence && "newState" in event && event.newState === "open") bringForward();
    };
    document.addEventListener("toggle", onOverlayToggle, true);
    return () => {
      document.removeEventListener("toggle", onOverlayToggle, true);
      if (presence.isConnected && presence.matches(":popover-open")) presence.hidePopover();
    };
  }, [mounted]);

  // Significantly stronger and more distinct visual progression so Level Drain
  // power increases are actually visible and satisfying on the speech bubble.
  const visualClass =
    visualTier === "maximum"
      ? "border-red-300 shadow-[0_0_85px_rgba(248,113,113,0.95),0_0_150px_rgba(236,72,153,0.7),0_0_220px_rgba(248,113,113,0.5)] ring-2 ring-red-400/80"
      : visualTier === "boss-fire"
        ? "border-red-300/90 shadow-[0_0_75px_rgba(239,68,68,0.88),0_0_120px_rgba(236,72,153,0.58)] ring-1 ring-red-400/70"
      : visualTier === "heavy-fire"
          ? "border-orange-300/90 shadow-[0_0_65px_rgba(249,115,22,0.82),0_0_100px_rgba(251,146,60,0.52)] ring-1 ring-orange-400/60"
      : visualTier === "burning-border"
          ? "border-orange-200/90 shadow-[0_0_58px_rgba(251,146,60,0.78),0_0_90px_rgba(249,115,22,0.48)]"
      : visualTier === "fire"
            ? "border-amber-300/90 shadow-[0_0_50px_rgba(245,158,11,0.75),0_0_78px_rgba(251,191,36,0.42)]"
      : visualTier === "spark"
              ? "border-yellow-300/85 shadow-[0_0_45px_rgba(250,204,21,0.72),0_0_68px_rgba(245,158,11,0.4)]"
      : visualTier === "energy"
                ? "border-cyan-300/80 shadow-[0_0_44px_rgba(103,232,249,0.68),0_0_65px_rgba(34,211,238,0.38)]"
      : visualTier === "particles"
                  ? "border-fuchsia-300/80 shadow-[0_0_42px_rgba(217,70,239,0.68),0_0_62px_rgba(192,38,211,0.38)]"
      : visualTier === "neon-border"
                    ? "border-pink-300/85 shadow-[0_0_44px_rgba(236,72,153,0.62),0_0_60px_rgba(217,70,239,0.35)]"
      : visualTier === "pulse"
                      ? "principessa-aura-sparkle border-pink-200/70 shadow-[0_0_40px_rgba(236,72,153,0.58),0_0_55px_rgba(217,70,239,0.3)]"
      : visualTier === "strong-glow"
                        ? "border-pink-200/60 shadow-[0_0_38px_rgba(236,72,153,0.52)]"
      : visualTier === "subtle-glow"
                          ? "border-pink-200/50 shadow-[0_0_30px_rgba(236,72,153,0.4)]"
      : "border-pink-200/35 shadow-[0_0_24px_rgba(236,72,153,0.28)]";

  // Make the Principessa avatar portrait also glow more as her global level rises.
  // This makes the level progression feel much more impactful.
  const portraitGlow =
    visualTier === "maximum"
      ? "shadow-[0_0_55px_rgba(248,113,113,0.9),0_0_90px_rgba(239,68,68,0.6)] ring-2 ring-red-400/80"
      : visualTier === "boss-fire" || visualTier === "heavy-fire"
        ? "shadow-[0_0_42px_rgba(239,68,68,0.75)] ring-1 ring-red-400/60"
      : visualTier === "fire" || visualTier === "burning-border" || visualTier === "spark"
        ? "shadow-[0_0_36px_rgba(249,115,22,0.65)] ring-1 ring-orange-400/50"
      : visualTier === "energy" || visualTier === "particles"
        ? "shadow-[0_0_32px_rgba(103,232,249,0.55)]"
      : "shadow-[0_0_32px_rgba(236,72,153,0.44)]";

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
  const hasActiveMessage = displayMessage.length > 0;
  const showInteractive = bubbleVisible && hasActiveMessage;

  if (!mounted) return null;

  return createPortal(
    <aside
      ref={presenceRef}
      popover="manual"
      aria-label="Principessa speech"
      className={`court-floating-character ${styles.presence} ${showInteractive ? styles.speaking : ""}`}
    >
      {hasActiveMessage && (
        <div
          className={`${styles.message} ${visualClass} transition-opacity duration-[2000ms] ${
            bubbleVisible ? "opacity-100" : "opacity-0"
          }`}
          style={messageStyle}
        >
          <span className="relative z-10">{displayMessage}</span>
        </div>
      )}
      <button type="button" aria-label="Open Live Chat" onClick={() => window.dispatchEvent(new Event("court:toggle-chat"))}
        className={`${styles.portrait} ${portraitGlow}`}
      >
        <Image
          alt="Principessa avatar"
          className="object-cover object-top"
          fill
          unoptimized
          sizes="88px"
          src={avatarSrc}
        />
      </button>
    </aside>, document.body,
  );
}
