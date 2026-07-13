"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type FeedNotification = { body: string; created_at: string; id: string; kind: string; read_at: string | null; title: string };

async function parseResponse(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string; notifications?: FeedNotification[]; unreadCount?: number } | null;
  if (!response.ok) throw new Error(payload?.error ?? "Feed notifications failed.");
  return payload ?? { notifications: [], unreadCount: 0 };
}

export function PrincipessaFeedNotifications({ active = false, isLoggedIn }: { active?: boolean; isLoggedIn: boolean }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const loadCount = useCallback(async () => {
    if (!isLoggedIn) return;
    const payload = await fetch("/api/user/principessa-feed/notifications", { cache: "no-store" }).then(parseResponse);
    setUnreadCount(payload.unreadCount ?? 0);
  }, [isLoggedIn]);
  useEffect(() => {
    if (!isLoggedIn) return;
    const initial = window.setTimeout(() => void loadCount(), 0);
    const interval = window.setInterval(() => { if (document.visibilityState !== "hidden") void loadCount(); }, 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [isLoggedIn, loadCount]);
  if (!isLoggedIn) return null;
  return <Link className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${active ? "border-[#f4c06a]/20 bg-pink-500/10 text-[#ffe5b8]" : "border-fuchsia-300/15 bg-fuchsia-500/[0.06] text-fuchsia-100 hover:border-fuchsia-300/30"}`} href="/principessa-feed/notifications"><span>♢ Feed Notifications</span>{unreadCount > 0 ? <span className="rounded-full bg-pink-500 px-2 py-0.5 text-xs text-white">{unreadCount}</span> : null}</Link>;
}

export function PrincipessaFeedNotificationsPage({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [loading, setLoading] = useState(isLoggedIn);
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!isLoggedIn) return;
    try { const payload = await fetch("/api/user/principessa-feed/notifications", { cache: "no-store" }).then(parseResponse); setNotifications(payload.notifications ?? []); setUnreadCount(payload.unreadCount ?? 0); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Notifications failed."); }
    finally { setLoading(false); }
  }, [isLoggedIn]);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initial);
  }, [load]);
  const action = async (actionName: "delete" | "markRead" | "markReadAll", notificationId?: string) => { const payload = await fetch("/api/user/principessa-feed/notifications", { body: JSON.stringify({ action: actionName, notificationId }), headers: { "Content-Type": "application/json" }, method: "POST" }).then(parseResponse); setNotifications(payload.notifications ?? []); setUnreadCount(payload.unreadCount ?? 0); };
  if (!isLoggedIn) return <p className="p-16 text-center text-sm text-zinc-500">Sign in to view Principessa Feed notifications.</p>;
  return <div>{unreadCount > 0 ? <div className="flex justify-end border-b border-white/10 px-5 py-3"><button className="text-xs font-black text-pink-300" onClick={() => void action("markReadAll")} type="button">Mark all as read</button></div> : null}{error ? <p className="border-b border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</p> : null}{notifications.map((notification) => <article className={`border-b p-5 transition ${notification.read_at ? "border-white/10 hover:bg-white/[0.02]" : "border-pink-300/15 bg-pink-500/[0.06]"}`} key={notification.id}><div className="flex items-start gap-4"><div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${notification.read_at ? "bg-white/[0.05] text-zinc-600" : "bg-pink-500/15 text-pink-300"}`}>♢</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="font-black text-white">{notification.title}</p>{!notification.read_at ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-pink-400 shadow-[0_0_10px_#ec4899]" /> : null}</div><p className="mt-1 text-sm leading-6 text-zinc-400">{notification.body}</p><p className="mt-2 text-[10px] text-zinc-600">{new Date(notification.created_at).toLocaleString()}</p><div className="mt-3 flex gap-4">{!notification.read_at ? <button className="text-[10px] font-black uppercase text-pink-300" onClick={() => void action("markRead", notification.id)} type="button">Mark read</button> : null}<button className="text-[10px] font-black uppercase text-red-300/70" onClick={() => void action("delete", notification.id)} type="button">Delete</button></div></div></div></article>)}{!loading && notifications.length === 0 ? <div className="p-16 text-center"><p className="font-serif text-2xl text-[#ffe4b5]">Nothing new</p><p className="mt-2 text-sm text-zinc-600">Mentions, replies, likes, reposts and private messages will appear here.</p></div> : null}{loading ? <p className="p-10 text-center text-sm text-zinc-600">Loading notifications...</p> : null}</div>;
}
