"use client";

import { useEffect, useState } from "react";

// The login screen's proof of life: real entries from the last month, shown
// as a dated ledger. Every row is genuine - the feed would rather run short
// than invent a name, because one spotted fake costs more than an empty list.
//
// It USED to be an undated auto-scrolling marquee, and that presentation made
// true data read as fabricated: motion with no dates is exactly how fake
// tickers look. A still list with real ages reads like a record.

type PublicActivityEvent = {
  kind: "tribute" | "crate" | "burn" | "join";
  text: string;
  accent: string | null;
  at: string;
};

type PublicActivityStats = { members: number; raisedUsd: number };

const KIND_STYLE: Record<PublicActivityEvent["kind"], { dot: string; accent: string }> = {
  burn: { accent: "text-[#f0821e]/90", dot: "bg-[#f0821e]" },
  crate: { accent: "text-fuchsia-200/90", dot: "bg-fuchsia-400" },
  join: { accent: "text-zinc-400", dot: "bg-zinc-500" },
  tribute: { accent: "text-[#ffe2ad]", dot: "bg-[#e6ba73]" },
};

// Coarse on purpose: "2h" is believable, "2m 41s" is trying too hard.
function relativeAge(at: string, now: number) {
  const ms = now - new Date(at).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function FeedRow({ event, now }: { event: PublicActivityEvent; now: number }) {
  const style = KIND_STYLE[event.kind];
  return (
    <li className="flex items-center gap-2.5 border-b border-white/[0.05] py-2 last:border-b-0">
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
      <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">{event.text}</span>
      {event.accent ? (
        <span className={`shrink-0 text-[10px] font-black uppercase tracking-[0.08em] ${style.accent}`}>
          {event.accent}
        </span>
      ) : null}
      <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-zinc-600">
        {relativeAge(event.at, now)}
      </span>
    </li>
  );
}

export function CourtActivityFeed({ className = "" }: { className?: string }) {
  const [events, setEvents] = useState<PublicActivityEvent[]>([]);
  // Frozen at mount: the ages are day-grained social proof, not a clock.
  const [now] = useState(() => Date.now());
  const [stats, setStats] = useState<PublicActivityStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/public/activity", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { events?: PublicActivityEvent[]; stats?: PublicActivityStats | null }
          | null;
        if (cancelled) return;
        setEvents(payload?.events ?? []);
        setStats(payload?.stats ?? null);
      } catch {
        // A login screen that cannot reach the feed is still a login screen.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (events.length === 0) return null;

  return (
    <div className={className}>
      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#d7ad69]/60">
        From her ledger — last 30 days
      </p>

      <ul className="mt-3">
        {events.slice(0, 8).map((event, index) => (
          <FeedRow event={event} key={index} now={now} />
        ))}
      </ul>

      {stats ? (
        <div className="mt-4 flex gap-2">
          <span className="border border-[#c89a55]/20 bg-black/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#e9d2aa]">
            {stats.members.toLocaleString()} in her court
          </span>
          {stats.raisedUsd > 0 ? (
            <span className="border border-[#c89a55]/20 bg-black/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#e9d2aa]">
              ${stats.raisedUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} tributed
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
