"use client";

import { PrincipessaPowerPortrait } from "./PrincipessaPowerPortrait";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { getPrincipessaPresence } from "@/lib/principessa-presence";
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
  const power = getPrincipessaPresence(globalPrincipessaLevel);

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

  useEffect(() => {
    const presence = presenceRef.current;
    if (!mounted || !presence) return;
    const root = document.documentElement;
    const updateChatClearance = () => {
      const bounds = presence.getBoundingClientRect();
      if (!bounds.height || !bounds.width) {
        root.style.removeProperty("--court-chat-bottom");
        return;
      }
      // Include the message and the full level frame, not just the avatar image.
      root.style.setProperty("--court-chat-bottom", `${Math.ceil(window.innerHeight - bounds.top + 12)}px`);
    };
    const observer = new ResizeObserver(updateChatClearance);
    observer.observe(presence);
    window.addEventListener("resize", updateChatClearance);
    document.addEventListener("toggle", updateChatClearance, true);
    updateChatClearance();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateChatClearance);
      document.removeEventListener("toggle", updateChatClearance, true);
      root.style.removeProperty("--court-chat-bottom");
    };
  }, [mounted]);

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
      data-speaking={showInteractive}
      data-power-tier={power.id}
      style={{ "--presence-accent": power.accent } as CSSProperties}
      className={`court-floating-character ${styles.presence} ${showInteractive ? styles.speaking : ""}`}
    >
      {hasActiveMessage && (
        <div
          className={`${styles.message} transition-opacity duration-[2000ms] ${
            bubbleVisible ? "opacity-100" : "opacity-0"
          }`}
          style={messageStyle}
        >
          <span className={styles.messageSignature}>{power.name} <span>Lv. {power.currentLevel}</span></span>
          <span className="relative z-10">{displayMessage}</span>
        </div>
      )}
      <button type="button" aria-label="Open Live Chat" onClick={() => window.dispatchEvent(new Event("court:toggle-chat"))}
        className={styles.portrait}
      >
        <PrincipessaPowerPortrait level={globalPrincipessaLevel} avatarSrc={avatarSrc} />
      </button>
    </aside>, document.body,
  );
}
