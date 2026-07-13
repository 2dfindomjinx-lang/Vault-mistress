"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type FeedNotification = {
  body: string;
  created_at: string;
  id: string;
  kind: string;
  read_at: string | null;
  title: string;
};

async function parseResponse(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string; notifications?: FeedNotification[]; unreadCount?: number } | null;
  if (!response.ok) throw new Error(payload?.error ?? "Feed notifications failed.");
  return payload ?? { notifications: [], unreadCount: 0 };
}

export function PrincipessaFeedNotifications({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const payload = await fetch("/api/user/principessa-feed/notifications", { cache: "no-store" }).then(parseResponse);
      setNotifications(payload.notifications ?? []); setUnreadCount(payload.unreadCount ?? 0);
    } finally { setLoading(false); }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const initial = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => { if (document.visibilityState !== "hidden") void load(); }, 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [isLoggedIn, load]);

  const action = async (actionName: "delete" | "markRead" | "markReadAll", notificationId?: string) => {
    const payload = await fetch("/api/user/principessa-feed/notifications", {
      body: JSON.stringify({ action: actionName, notificationId }),
      headers: { "Content-Type": "application/json" }, method: "POST",
    }).then(parseResponse);
    setNotifications(payload.notifications ?? []); setUnreadCount(payload.unreadCount ?? 0);
  };

  if (!isLoggedIn) return null;
  return <><button className="flex w-full items-center justify-between rounded-2xl border border-fuchsia-300/15 bg-fuchsia-500/[0.06] px-4 py-3 text-left text-sm font-black text-fuchsia-100 transition hover:border-fuchsia-300/30" onClick={() => { setOpen(true); void load(); }} type="button"><span>♢ Feed Notifications</span>{unreadCount > 0 ? <span className="rounded-full bg-pink-500 px-2 py-0.5 text-xs text-white">{unreadCount}</span> : null}</button>{open ? createPortal(<div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/85 p-3 backdrop-blur-lg" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-fuchsia-300/20 bg-[#0e070e] shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0e070e]/95 px-5 py-4 backdrop-blur"><div><h2 className="font-serif text-xl text-[#ffe4b5]">Feed Notifications</h2><p className="mt-1 text-xs text-zinc-500">Mentions, replies, likes, reposts and private messages.</p></div><button className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-zinc-400" onClick={() => setOpen(false)} type="button">CLOSE</button></header><div className="p-4">{unreadCount > 0 ? <button className="mb-3 text-xs font-black text-pink-300" onClick={() => void action("markReadAll")} type="button">Mark all as read</button> : null}<div className="grid gap-2">{notifications.map((notification) => <article className={`rounded-2xl border p-4 ${notification.read_at ? "border-white/10 bg-white/[0.025]" : "border-pink-300/20 bg-pink-500/[0.08]"}`} key={notification.id}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-white">{notification.title}</p><p className="mt-1 text-sm leading-6 text-zinc-400">{notification.body}</p><p className="mt-2 text-[10px] text-zinc-600">{new Date(notification.created_at).toLocaleString()}</p></div>{!notification.read_at ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-pink-400 shadow-[0_0_10px_#ec4899]" /> : null}</div><div className="mt-3 flex gap-3">{!notification.read_at ? <button className="text-[10px] font-black uppercase text-pink-300" onClick={() => void action("markRead", notification.id)} type="button">Mark read</button> : null}<button className="text-[10px] font-black uppercase text-red-300/70" onClick={() => void action("delete", notification.id)} type="button">Delete</button></div></article>)}{!loading && notifications.length === 0 ? <p className="py-12 text-center text-sm text-zinc-600">No Principessa Feed notifications yet.</p> : null}{loading ? <p className="py-6 text-center text-sm text-zinc-600">Refreshing...</p> : null}</div></div></section></div>, document.body) : null}</>;
}
