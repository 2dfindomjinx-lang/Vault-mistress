import Image from "next/image";
import { useEffect, useState } from "react";

type FloatingDefneBubbleProps = {
  message: string;
  onBubbleFullyHidden?: (message: string) => void;
};

const fadeDuration = 2000;

export function FloatingDefneBubble({
  message,
  onBubbleFullyHidden,
}: FloatingDefneBubbleProps) {
  const [bubbleVisible, setBubbleVisible] = useState(true);
  const [lastMessage, setLastMessage] = useState(message);

  if (message !== lastMessage) {
    setLastMessage(message);
    setBubbleVisible(true);
  }

  useEffect(() => {
    const visibleDuration = Math.floor(Math.random() * 2001) + 4000;
    const hideTimer = window.setTimeout(() => {
      setBubbleVisible(false);
    }, visibleDuration);
    const hiddenTimer = window.setTimeout(() => {
      onBubbleFullyHidden?.(message);
    }, visibleDuration + fadeDuration);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(hiddenTimer);
    };
  }, [message, onBubbleFullyHidden]);

  return (
    <aside className="fixed bottom-4 right-4 z-30 flex max-w-[calc(100vw-2rem)] items-end gap-5 sm:bottom-6 sm:right-6 sm:max-w-2xl">
      <div
        className={`rounded-[2rem] border border-pink-200/30 bg-black/80 px-6 py-5 text-lg leading-8 text-pink-50 shadow-[0_0_44px_rgba(236,72,153,0.34)] backdrop-blur transition-opacity duration-[2000ms] ${
          bubbleVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {message}
      </div>
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border border-pink-200/50 bg-fuchsia-950 shadow-[0_0_42px_rgba(236,72,153,0.48)]">
        <Image
          alt="Principessa avatar"
          className="object-cover object-top"
          fill
          unoptimized
          sizes="112px"
          src="/character-icon.png"
        />
      </div>
    </aside>
  );
}
