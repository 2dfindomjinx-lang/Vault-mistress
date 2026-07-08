"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CoinAmount } from "@/components/CoinAmount";

type LiveChatProfile = {
  avatar_url?: string | null;
  display_name?: string | null;
  username?: string | null;
};

type LiveChatMessage = {
  coin_cost?: number | null;
  created_at: string;
  id: string;
  is_deleted?: boolean | null;
  message: string;
  message_type?: string | null;
  profiles?: LiveChatProfile | LiveChatProfile[] | null;
  user_id: string;
};

type LiveChatResponse = {
  currentUser?: {
    isAdmin?: boolean;
    mutedReason?: string;
    mutedUntil?: string | null;
  };
  messages?: LiveChatMessage[];
};

type LiveChatWidgetProps = {
  onCoinsChange?: (coins: number) => void;
};

function getMessageProfile(message: LiveChatMessage) {
  return Array.isArray(message.profiles) ? message.profiles[0] : message.profiles;
}

function formatChatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function LiveChatWidget({ onCoinsChange }: LiveChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [highlighted, setHighlighted] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [mutedText, setMutedText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = async () => {
    try {
      const response = await fetch("/api/live-chat", { cache: "no-store" });
      const payload = (await response.json()) as LiveChatResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Live Chat could not be loaded.");
      }

      setMessages(payload.messages ?? []);
      setIsAdmin(Boolean(payload.currentUser?.isAdmin));
      setMutedText(payload.currentUser?.mutedUntil ? "Muted" : payload.currentUser?.mutedReason ? "Muted" : "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Live Chat could not be loaded.");
    }
  };

  useEffect(() => {
    void loadMessages();
    const timer = window.setInterval(() => {
      void loadMessages();
    }, 7000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [isOpen, messages.length]);

  const sendMessage = async () => {
    const message = draft.replace(/\s+/g, " ").trim();

    if (!message || isSending) {
      return;
    }

    setIsSending(true);
    setError("");

    try {
      const response = await fetch("/api/live-chat", {
        body: JSON.stringify({
          action: "send",
          message,
          messageType: highlighted ? "highlighted" : "normal",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: LiveChatMessage;
        profile?: { coins?: number };
      };

      if (!response.ok || !payload.message) {
        throw new Error(payload.error ?? "Message could not be sent.");
      }

      setMessages((current) => [...current, payload.message!].slice(-100));
      setDraft("");
      setHighlighted(false);

      if (typeof payload.profile?.coins === "number") {
        onCoinsChange?.(payload.profile.coins);
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Message could not be sent.");
    } finally {
      setIsSending(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    const response = await fetch("/api/live-chat", {
      body: JSON.stringify({ action: "delete", messageId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (response.ok) {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, is_deleted: true, message: "Message deleted." } : message,
        ),
      );
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex w-[calc(100vw-2rem)] max-w-[390px] flex-col items-end gap-3 sm:bottom-5 sm:right-5">
      {isOpen ? (
        <section className="w-full overflow-hidden rounded-[1.35rem] border border-cyan-200/20 bg-[linear-gradient(145deg,rgba(4,12,18,0.96),rgba(10,44,52,0.92),rgba(0,0,0,0.9))] shadow-[0_0_42px_rgba(34,211,238,0.18)]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-100/70">Community</p>
              <h2 className="text-base font-black text-white">Live Chat</h2>
            </div>
            <button
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black text-cyan-50 transition hover:border-cyan-200/40"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>

          <div className="flex max-h-[360px] flex-col gap-3 overflow-y-auto px-3 py-3">
            {messages.map((message) => {
              const profile = getMessageProfile(message);
              const displayName = profile?.display_name || profile?.username || "Vault User";
              const highlightedMessage = message.message_type === "highlighted";

              return (
                <article
                  className={`rounded-[1rem] border px-3 py-2 ${
                    highlightedMessage
                      ? "border-amber-200/45 bg-amber-300/12 shadow-[0_0_24px_rgba(251,191,36,0.16)]"
                      : "border-white/10 bg-white/[0.045]"
                  }`}
                  key={message.id}
                >
                  <div className="flex items-start gap-2">
                    <div className="relative mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/40">
                      {profile?.avatar_url ? (
                        <Image alt="" className="object-cover" fill sizes="32px" src={profile.avatar_url} unoptimized />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-black text-white">{displayName}</p>
                        <time className="shrink-0 text-[10px] font-bold text-cyan-100/55">{formatChatTime(message.created_at)}</time>
                      </div>
                      <p className={`mt-1 break-words text-sm leading-5 ${message.is_deleted ? "italic text-zinc-500" : "text-cyan-50/86"}`}>
                        {message.is_deleted ? "Message deleted." : message.message}
                      </p>
                      {isAdmin && !message.is_deleted ? (
                        <button
                          className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-200/80"
                          onClick={() => void deleteMessage(message.id)}
                          type="button"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-white/10 p-3">
            {mutedText ? (
              <p className="mb-2 rounded-xl border border-red-200/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100">
                {mutedText}
              </p>
            ) : null}
            <textarea
              className="min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-200/45"
              disabled={Boolean(mutedText) || isSending}
              maxLength={250}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Send a message..."
              value={draft}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                  highlighted
                    ? "border-amber-200/50 bg-amber-300/15 text-amber-50"
                    : "border-white/10 bg-white/5 text-cyan-50"
                }`}
                onClick={() => setHighlighted((current) => !current)}
                type="button"
              >
                <CoinAmount amount={250} iconSize={14} label="" prefix="Highlight " />
              </button>
              <button
                className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!draft.trim() || isSending || Boolean(mutedText)}
                onClick={() => void sendMessage()}
                type="button"
              >
                Send
              </button>
            </div>
            {error ? <p className="mt-2 text-xs font-bold text-red-200">{error}</p> : null}
          </div>
        </section>
      ) : null}

      <button
        className="rounded-full border border-cyan-200/30 bg-cyan-300 px-5 py-3 text-sm font-black text-black shadow-[0_0_30px_rgba(34,211,238,0.24)] transition hover:bg-cyan-200"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        Live Chat
      </button>
    </div>
  );
}

