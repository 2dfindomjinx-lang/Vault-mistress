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
    <aside className="fixed bottom-4 right-4 z-30 flex max-w-[calc(100vw-2rem)] items-center gap-4 sm:bottom-6 sm:right-6 sm:max-w-3xl sm:gap-5">
      <div
        className={`flex min-h-20 items-center rounded-[1.75rem] border border-pink-200/30 bg-black/80 px-5 py-4 text-lg font-semibold leading-7 text-pink-50 shadow-[0_0_40px_rgba(236,72,153,0.32)] backdrop-blur transition-opacity duration-[2000ms] sm:min-h-24 sm:px-6 sm:py-5 sm:text-xl sm:leading-8 ${
          bubbleVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {message}
      </div>
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-pink-200/50 bg-fuchsia-950 shadow-[0_0_38px_rgba(236,72,153,0.46)] sm:h-26 sm:w-26">
        <Image
          alt="Principessa avatar"
          className="object-cover object-top"
          fill
          unoptimized
          sizes="104px"
          src="/character-icon.png"
        />
      </div>
    </aside>
  );
}
