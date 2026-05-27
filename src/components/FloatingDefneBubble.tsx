import Image from "next/image";
import { useEffect, useState } from "react";

type FloatingDefneBubbleProps = {
  message: string;
};

export function FloatingDefneBubble({ message }: FloatingDefneBubbleProps) {
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

    return () => {
      window.clearTimeout(hideTimer);
    };
  }, [message]);

  return (
    <aside className="fixed bottom-4 right-4 z-30 flex max-w-[calc(100vw-2rem)] items-end gap-3 sm:bottom-6 sm:right-6 sm:max-w-md">
      <div
        className={`rounded-[1.5rem] border border-pink-200/30 bg-black/80 px-4 py-3 text-sm leading-6 text-pink-50 shadow-[0_0_32px_rgba(236,72,153,0.28)] backdrop-blur transition-opacity duration-[2000ms] ${
          bubbleVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {message}
      </div>
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-pink-200/50 bg-fuchsia-950 shadow-[0_0_28px_rgba(236,72,153,0.4)]">
        <Image
          alt="Principessa avatar"
          className="object-cover object-top"
          fill
          unoptimized
          sizes="56px"
          src="/character-icon.png"
        />
      </div>
    </aside>
  );
}
