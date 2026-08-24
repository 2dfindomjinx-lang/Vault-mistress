"use client";

import { useEffect, useState } from "react";

// The login screen's proof of life: a slow vertical loop of real events from
// the last month. Every row is genuine - the feed would rather run short than
// invent a name, because one spotted fake costs more than an empty list.
//
// No timestamps on purpose. "2 minutes ago" reads as alive but "6 days ago"
// reads as dead, so the rows simply exist and the loop supplies the motion.

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

function FeedRow({ event, hidden = false }: { event: PublicActivityEvent; hidden?: boolean }) {
  const style = KIND_STYLE[event.kind];
  return (
    <li aria-hidden={hidden || undefined} className="flex items-center gap-2.5 py-1.5">
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
      <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">{event.text}</span>
      {event.accent ? (
        <span className={`shrink-0 text-[10px] font-black uppercase tracking-[0.08em] ${style.accent}`}>
          {event.accent}
        </span>
      ) : null}
    </li>
  );
}

export function CourtActivityFeed({ className = "" }: { className?: string }) {
  const [events, setEvents] = useState<PublicActivityEvent[]>([]);
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

  // Below this the loop would visibly repeat every few seconds, which reads as
  // a trick. A short list is shown standing still instead.
  const loops = events.length >= 6;
  // Slow enough to read, scaled so a longer list does not scroll faster.
  const durationSeconds = events.length * 2.4;

  return (
    <div className={className}>
      <style>{`
        @keyframes vm-court-feed-scroll {
          from { transform: translateY(0); }
          to   { transform: translateY(-50%); }
        }
        .vm-court-feed:hover .vm-court-feed-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .vm-court-feed-track { animation: none !important; }
        }
      `}</style>

      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#d7ad69]/60">
        The court, this month
      </p>

      <div
        className="vm-court-feed relative mt-3 h-44 overflow-hidden"
        style={{
          maskImage: "linear-gradient(180deg, transparent, black 14%, black 86%, transparent)",
          WebkitMaskImage: "linear-gradient(180deg, transparent, black 14%, black 86%, transparent)",
        }}
      >
        <ul
          className="vm-court-feed-track"
          style={
            loops
              ? { animation: `vm-court-feed-scroll ${durationSeconds}s linear infinite` }
              : undefined
          }
        >
          {events.map((event, index) => (
            <FeedRow event={event} key={`a-${index}`} />
          ))}
          {/* Second copy makes the -50% translate land exactly on frame one,
              so the loop has no visible seam. aria-hidden per row - it is the
              same list twice, and li must stay a direct child of ul. */}
          {loops
            ? events.map((event, index) => <FeedRow event={event} hidden key={`b-${index}`} />)
            : null}
        </ul>
      </div>

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
