"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DisplayNameWithUsername } from "@/components/DisplayNameWithUsername";

type PublicIdentity = { displayName: string | null; userId: string; username: string; usernameStyle?: { color?: string; textShadow?: string } };
type SearchPost = { author: PublicIdentity | null; channel: string; createdAt: string; description: string; id: string; postType: string; title: string };
type DirectMessage = { body: string; createdAt: string; id: string; mine: boolean; other: PublicIdentity | null; otherId: string; readAt: string | null };
type Achievement = { data: Record<string, unknown>; description: string; key: string; shared: boolean; title: string };

async function json<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(payload?.error ?? "Request failed.");
  if (!payload) throw new Error("The server returned an empty response.");
  return payload;
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/85 p-3 backdrop-blur-lg" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[#f4c06a]/20 bg-[#0e070e] shadow-2xl">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0e070e]/95 px-5 py-4 backdrop-blur"><h2 className="font-serif text-xl text-[#ffe4b5]">{title}</h2><button className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-zinc-400" onClick={onClose} type="button">CLOSE</button></header>
      {children}
    </section>
  </div>;
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<PublicIdentity[]>([]);
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => { setLoading(true); void fetch(`/api/principessa-feed/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
      .then((response) => json<{ accounts: PublicIdentity[]; posts: SearchPost[] }>(response))
      .then((payload) => { setAccounts(payload.accounts); setPosts(payload.posts); })
      .catch(() => undefined).finally(() => setLoading(false)); }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);
  return <Modal onClose={onClose} title="Search the Velvet Network"><div className="p-5"><input autoFocus className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-pink-300/40" onChange={(event) => setQuery(event.target.value)} placeholder="Search posts, confessions or accounts..." value={query} />{loading ? <p className="mt-4 text-sm text-zinc-500">Searching...</p> : null}<div className="mt-5 grid gap-6"><section><h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-300/60">Accounts</h3><div className="mt-2 grid gap-2">{accounts.map((account) => <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3" key={account.userId}><DisplayNameWithUsername displayName={account.displayName} secondaryStyle={account.usernameStyle} username={account.username} /></div>)}{query.length >= 2 && !loading && accounts.length === 0 ? <p className="text-sm text-zinc-600">No matching accounts.</p> : null}</div></section><section><h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-300/60">Posts</h3><div className="mt-2 grid gap-2">{posts.map((post) => <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" key={post.id}><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-black uppercase text-pink-300/60">{post.postType}</span><span className="text-[10px] text-zinc-600">{new Date(post.createdAt).toLocaleDateString()}</span></div><h4 className="mt-2 font-black text-[#ffe4b5]">{post.title}</h4><p className="mt-1 line-clamp-3 text-sm leading-6 text-zinc-400">{post.description}</p>{post.author ? <div className="mt-3"><DisplayNameWithUsername displayName={post.author.displayName} primaryClassName="text-xs font-black" secondaryClassName="text-[10px] text-zinc-600" secondaryStyle={post.author.usernameStyle} username={post.author.username} /></div> : <p className="mt-3 text-xs font-black text-fuchsia-300">Anonymous Confession</p>}</article>)}{query.length >= 2 && !loading && posts.length === 0 ? <p className="text-sm text-zinc-600">No matching posts.</p> : null}</div></section></div></div></Modal>;
}

function MessagesPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipients, setRecipients] = useState<Array<{ displayName: string; id: string; username: string }>>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => fetch("/api/user/principessa-feed/messages", { cache: "no-store" }).then((response) => json<{ messages: DirectMessage[] }>(response)).then((payload) => setMessages(payload.messages)).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Messages failed.")), []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (recipientQuery.length < 1) return;
    const controller = new AbortController(); const timer = window.setTimeout(() => fetch(`/api/user/principessa-feed/users?q=${encodeURIComponent(recipientQuery)}`, { signal: controller.signal }).then((response) => json<{ users: Array<{ displayName: string; id: string; username: string }> }>(response)).then((payload) => setRecipients(payload.users)).catch(() => undefined), 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [recipientQuery]);
  const conversations = useMemo(() => Array.from(new Map(messages.map((message) => [message.otherId, message.other])).entries()), [messages]);
  const selectedMessages = messages.filter((message) => message.otherId === selectedId);
  const send = async () => { if (!selectedId || !draft.trim()) return; setError(""); try { const payload = await fetch("/api/user/principessa-feed/messages", { body: JSON.stringify({ body: draft.trim(), recipientId: selectedId }), headers: { "Content-Type": "application/json" }, method: "POST" }).then((response) => json<{ messages: DirectMessage[] }>(response)); setMessages(payload.messages); setDraft(""); } catch (sendError) { setError(sendError instanceof Error ? sendError.message : "Message failed."); } };
  return <Modal onClose={onClose} title="Direct Messages"><div className="grid min-h-[32rem] sm:grid-cols-[14rem_1fr]"><aside className="border-b border-white/10 p-3 sm:border-b-0 sm:border-r"><input className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none" onChange={(event) => setRecipientQuery(event.target.value.replace(/^@/, ""))} placeholder="Find an account" value={recipientQuery} />{recipients.length > 0 ? <div className="mt-2 rounded-xl border border-white/10 bg-[#160b16]">{recipients.map((recipient) => <button className="block w-full px-3 py-2 text-left text-sm hover:bg-pink-500/10" key={recipient.id} onClick={() => { setSelectedId(recipient.id); setRecipientQuery(""); setRecipients([]); }} type="button"><b>{recipient.displayName}</b><span className="block text-xs text-zinc-600">@{recipient.username}</span></button>)}</div> : null}<div className="mt-3 grid gap-1">{conversations.map(([id, identity]) => <button className={`rounded-xl px-3 py-2 text-left ${selectedId === id ? "bg-pink-500/15" : "hover:bg-white/5"}`} key={id} onClick={() => setSelectedId(id)} type="button">{identity ? <DisplayNameWithUsername displayName={identity.displayName} primaryClassName="text-xs font-black" secondaryClassName="text-[10px] text-zinc-600" secondaryStyle={identity.usernameStyle} username={identity.username} /> : "Unknown"}</button>)}</div></aside><div className="flex min-h-[28rem] flex-col"><div className="flex-1 space-y-2 overflow-y-auto p-4">{selectedId ? selectedMessages.map((message) => <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6 ${message.mine ? "ml-auto bg-pink-500/20 text-pink-50" : "bg-white/[0.06] text-zinc-300"}`} key={message.id}>{message.body}<span className="mt-1 block text-[9px] text-zinc-600">{new Date(message.createdAt).toLocaleString()}</span></div>) : <p className="pt-20 text-center text-sm text-zinc-600">Choose a conversation or find an account.</p>}</div>{error ? <p className="px-4 text-xs text-red-300">{error}</p> : null}<div className="flex gap-2 border-t border-white/10 p-3"><textarea className="min-h-12 flex-1 resize-none rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none" disabled={!selectedId} maxLength={2000} onChange={(event) => setDraft(event.target.value)} placeholder="Write a private message..." value={draft} /><button className="rounded-2xl bg-pink-500 px-4 text-xs font-black disabled:opacity-40" disabled={!selectedId || !draft.trim()} onClick={() => void send()} type="button">Send</button></div></div></div></Modal>;
}

function AchievementsPanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Achievement[]>([]); const [notice, setNotice] = useState("");
  const load = useCallback(() => fetch("/api/user/principessa-feed/achievements", { cache: "no-store" }).then((response) => json<{ achievements: Achievement[] }>(response)).then((payload) => setItems(payload.achievements)), []);
  useEffect(() => { void load(); }, [load]);
  const share = async (key: string) => { const payload = await fetch("/api/user/principessa-feed/achievements", { body: JSON.stringify({ key }), headers: { "Content-Type": "application/json" }, method: "POST" }).then((response) => json<{ message: string }>(response)); setNotice(payload.message); await load(); };
  return <Modal onClose={onClose} title="Share an achievement"><div className="p-5">{notice ? <p className="mb-4 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">{notice}</p> : null}<p className="mb-4 text-sm leading-6 text-zinc-500">Nothing is posted automatically. Choose exactly what you want to send to Principessa for approval.</p><div className="grid gap-3">{items.map((item) => <article className="rounded-2xl border border-[#f4c06a]/15 bg-[linear-gradient(135deg,rgba(244,192,106,.08),rgba(236,72,153,.05))] p-4" key={item.key}><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f4c06a]">Achievement card</p><h3 className="mt-2 font-serif text-lg text-[#ffe4b5]">{item.title}</h3><p className="mt-1 text-sm text-zinc-400">{item.description}</p><button className="mt-3 rounded-full bg-pink-500 px-4 py-2 text-xs font-black disabled:opacity-40" disabled={item.shared} onClick={() => void share(item.key)} type="button">{item.shared ? "Already shared" : "Share"}</button></article>)}{items.length === 0 ? <p className="text-sm text-zinc-600">No shareable achievements yet.</p> : null}</div></div></Modal>;
}

export function PrincipessaFeedSocialPanels({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [panel, setPanel] = useState<"search" | "messages" | "achievements" | null>(null);
  return <><div className="mt-2 grid gap-1"><button className="rounded-2xl px-4 py-3 text-left text-sm font-black text-zinc-500 hover:bg-white/5 hover:text-white" onClick={() => setPanel("search")} type="button">⌕&nbsp;&nbsp; Search</button>{isLoggedIn ? <><button className="rounded-2xl px-4 py-3 text-left text-sm font-black text-zinc-500 hover:bg-white/5 hover:text-white" onClick={() => setPanel("messages")} type="button">✉&nbsp;&nbsp; Direct Messages</button><button className="rounded-2xl px-4 py-3 text-left text-sm font-black text-zinc-500 hover:bg-white/5 hover:text-white" onClick={() => setPanel("achievements")} type="button">◇&nbsp;&nbsp; Share Achievement</button></> : null}</div>{panel === "search" ? <SearchPanel onClose={() => setPanel(null)} /> : null}{panel === "messages" ? <MessagesPanel onClose={() => setPanel(null)} /> : null}{panel === "achievements" ? <AchievementsPanel onClose={() => setPanel(null)} /> : null}</>;
}
