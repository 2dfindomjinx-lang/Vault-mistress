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
    <aside className="fixed bottom-4 right-4 z-30 flex max-w-[calc(100vw-2rem)] items-center gap-3 sm:bottom-6 sm:right-6 sm:max-w-2xl sm:gap-4">
      <div
        className={`flex min-h-16 items-center rounded-[1.5rem] border border-pink-200/30 bg-black/80 px-4 py-3 text-base font-semibold leading-6 text-pink-50 shadow-[0_0_34px_rgba(236,72,153,0.3)] backdrop-blur transition-opacity duration-[2000ms] sm:min-h-20 sm:px-5 sm:py-4 sm:text-lg sm:leading-7 ${
          bubbleVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {message}
      </div>
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-pink-200/50 bg-fuchsia-950 shadow-[0_0_32px_rgba(236,72,153,0.44)] sm:h-22 sm:w-22">
        <Image
          alt="Principessa avatar"
          className="object-cover object-top"
          fill
          unoptimized
          sizes="88px"
          src="/character-icon.png"
        />
      </div>
    </aside>
  );
}
