"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DisplayNameWithUsername } from "@/components/DisplayNameWithUsername";

type PublicIdentity = { displayName: string | null; userId: string; username: string; usernameStyle?: { color?: string; textShadow?: string } };
type SearchPost = { author: PublicIdentity | null; channel: string; createdAt: string; description: string; id: string; postType: string; title: string };
type DirectMessage = { body: string; createdAt: string; id: string; mine: boolean; other: PublicIdentity | null; otherId: string; readAt: string | null };
type Achievement = { data: Record<string, unknown>; description: string; key: string; shared: boolean; title: string };
type SocialView = "achievements" | "approvals" | "messages" | "notifications" | "search";

async function json<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(payload?.error ?? "Request failed.");
  if (!payload) throw new Error("The server returned an empty response.");
  return payload;
}

function MessageLink({ compact = false, userId }: { compact?: boolean; userId: string }) {
  return <Link aria-label="Send Direct Message" className={compact
    ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-pink-300/20 text-pink-200 transition hover:bg-pink-500/15"
    : "inline-flex items-center gap-2 rounded-full border border-pink-300/20 px-3 py-2 text-xs font-black text-pink-200 transition hover:bg-pink-500/15"} href={`/principessa-feed/messages?to=${encodeURIComponent(userId)}`} title="Send Direct Message">✉{compact ? null : <span>Message</span>}</Link>;
}

export function PrincipessaFeedSearchPage({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<PublicIdentity[]>([]);
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch(`/api/principessa-feed/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((response) => json<{ accounts: PublicIdentity[]; posts: SearchPost[] }>(response))
        .then((payload) => { setAccounts(payload.accounts); setPosts(payload.posts); })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  const hasQuery = query.trim().length >= 2;
  return <div>
    <div className="sticky top-[145px] z-30 border-b border-white/10 bg-[#090509]/95 p-3 backdrop-blur-xl">
      <label className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 focus-within:border-pink-300/40">
        <span className="text-zinc-500">⌕</span>
        <input autoFocus className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600" onChange={(event) => { const next = event.target.value; setQuery(next); if (next.trim().length < 2) { setAccounts([]); setPosts([]); setLoading(false); } }} placeholder="Search people, posts and confessions" value={query} />
      </label>
    </div>
    {!hasQuery ? <div className="px-6 py-16 text-center"><p className="font-serif text-2xl text-[#ffe4b5]">Search the Velvet Network</p><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">Find accounts by display name or username, and search through published posts.</p></div> : null}
    {loading ? <p className="p-10 text-center text-sm text-zinc-600">Searching...</p> : null}
    {hasQuery && !loading ? <>
      <section className="border-b border-white/10">
        <h2 className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-pink-300/60">People</h2>
        {accounts.map((account) => <article className="flex items-center justify-between gap-4 border-t border-white/[0.06] px-5 py-4 transition hover:bg-white/[0.025]" key={account.userId}><DisplayNameWithUsername displayName={account.displayName} primaryClassName="font-black" secondaryClassName="text-xs text-zinc-600" secondaryStyle={account.usernameStyle} username={account.username} />{isLoggedIn ? <MessageLink compact userId={account.userId} /> : null}</article>)}
        {accounts.length === 0 ? <p className="px-5 pb-5 text-sm text-zinc-600">No matching accounts.</p> : null}
      </section>
      <section>
        <h2 className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-pink-300/60">Posts</h2>
        {posts.map((post) => <article className="border-t border-white/[0.06] p-5 transition hover:bg-white/[0.025]" key={post.id}><div className="flex items-start justify-between gap-4"><div>{post.author ? <DisplayNameWithUsername displayName={post.author.displayName} primaryClassName="text-sm font-black" secondaryClassName="text-xs text-zinc-600" secondaryStyle={post.author.usernameStyle} username={post.author.username} /> : <p className="text-sm font-black text-fuchsia-300">Anonymous Confession</p>}<p className="mt-1 text-[10px] font-black uppercase text-pink-300/50">{post.channel} · {post.postType}</p></div>{post.author && isLoggedIn ? <MessageLink compact userId={post.author.userId} /> : null}</div><h3 className="mt-3 font-serif text-xl text-[#ffe4b5]">{post.title}</h3><p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{post.description}</p><p className="mt-3 text-[10px] text-zinc-700">{new Date(post.createdAt).toLocaleString()}</p></article>)}
        {posts.length === 0 ? <p className="px-5 pb-8 text-sm text-zinc-600">No matching posts.</p> : null}
      </section>
    </> : null}
  </div>;
}

export function PrincipessaFeedMessagesPage({ initialRecipientId = "", isLoggedIn }: { initialRecipientId?: string; isLoggedIn: boolean }) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [selectedId, setSelectedId] = useState(initialRecipientId);
  const [selectedIdentity, setSelectedIdentity] = useState<PublicIdentity | null>(null);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipients, setRecipients] = useState<Array<{ displayName: string; id: string; username: string }>>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(isLoggedIn);

  const load = useCallback(() => {
    if (!isLoggedIn) return Promise.resolve();
    return fetch("/api/user/principessa-feed/messages", { cache: "no-store" })
      .then((response) => json<{ messages: DirectMessage[] }>(response))
      .then((payload) => setMessages(payload.messages))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Messages failed."))
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!initialRecipientId || !isLoggedIn) return;
    const controller = new AbortController();
    void fetch(`/api/user/principessa-feed/users?id=${encodeURIComponent(initialRecipientId)}`, { signal: controller.signal })
      .then((response) => json<{ users: Array<{ displayName: string; id: string; username: string }> }>(response))
      .then((payload) => { const user = payload.users[0]; if (user) setSelectedIdentity({ displayName: user.displayName, userId: user.id, username: user.username }); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [initialRecipientId, isLoggedIn]);
  useEffect(() => {
    if (recipientQuery.length < 1) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void fetch(`/api/user/principessa-feed/users?q=${encodeURIComponent(recipientQuery)}`, { signal: controller.signal }).then((response) => json<{ users: Array<{ displayName: string; id: string; username: string }> }>(response)).then((payload) => setRecipients(payload.users)).catch(() => undefined); }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [recipientQuery]);

  const conversations = useMemo(() => Array.from(new Map(messages.map((message) => [message.otherId, message.other])).entries()), [messages]);
  const selectedMessages = messages.filter((message) => message.otherId === selectedId);
  const activeIdentity = conversations.find(([id]) => id === selectedId)?.[1] ?? selectedIdentity;
  const selectRecipient = (recipient: { displayName: string; id: string; username: string }) => { setSelectedId(recipient.id); setSelectedIdentity({ displayName: recipient.displayName, userId: recipient.id, username: recipient.username }); setRecipientQuery(""); setRecipients([]); setError(""); };
  const send = async () => {
    if (!selectedId || !draft.trim()) return;
    setError("");
    try {
      const payload = await fetch("/api/user/principessa-feed/messages", { body: JSON.stringify({ body: draft.trim(), recipientId: selectedId }), headers: { "Content-Type": "application/json" }, method: "POST" }).then((response) => json<{ messages: DirectMessage[] }>(response));
      setMessages(payload.messages); setDraft("");
    } catch (sendError) { setError(sendError instanceof Error ? sendError.message : "Message failed."); }
  };

  if (!isLoggedIn) return <div className="p-16 text-center"><p className="font-serif text-2xl text-[#ffe4b5]">Direct Messages</p><p className="mt-2 text-sm text-zinc-500">Sign in from Main Page to view and send private messages.</p></div>;
  return <div className="grid min-h-[calc(100vh-145px)] md:grid-cols-[250px_minmax(0,1fr)]">
    <aside className="border-b border-white/10 md:border-b-0 md:border-r">
      <div className="relative border-b border-white/10 p-3"><input className="w-full rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 text-sm outline-none focus:border-pink-300/40" onChange={(event) => { const next = event.target.value.replace(/^@/, ""); setRecipientQuery(next); if (!next) setRecipients([]); }} placeholder="Search people" value={recipientQuery} />{recipients.length > 0 ? <div className="absolute inset-x-3 top-[4.2rem] z-30 overflow-hidden rounded-2xl border border-white/10 bg-[#160b16] shadow-2xl">{recipients.map((recipient) => <button className="block w-full border-b border-white/[0.06] px-4 py-3 text-left text-sm hover:bg-pink-500/10" key={recipient.id} onClick={() => selectRecipient(recipient)} type="button"><b>{recipient.displayName}</b><span className="block text-xs text-zinc-600">@{recipient.username}</span></button>)}</div> : null}</div>
      <div>{conversations.map(([id, identity]) => <button className={`block w-full border-b border-white/[0.06] px-4 py-4 text-left ${selectedId === id ? "border-r-2 border-r-pink-400 bg-pink-500/10" : "hover:bg-white/[0.03]"}`} key={id} onClick={() => { setSelectedId(id); setSelectedIdentity(identity); }} type="button">{identity ? <DisplayNameWithUsername displayName={identity.displayName} primaryClassName="text-sm font-black" secondaryClassName="text-xs text-zinc-600" secondaryStyle={identity.usernameStyle} username={identity.username} /> : <span className="text-sm text-zinc-500">Unknown account</span>}</button>)}{!loading && conversations.length === 0 ? <p className="p-5 text-sm leading-6 text-zinc-600">No conversations yet. Search for an account to start one.</p> : null}</div>
    </aside>
    <section className="flex min-h-[32rem] flex-col">
      <header className="border-b border-white/10 px-4 py-3">{activeIdentity ? <DisplayNameWithUsername displayName={activeIdentity.displayName} primaryClassName="font-black" secondaryClassName="text-xs text-zinc-600" secondaryStyle={activeIdentity.usernameStyle} username={activeIdentity.username} /> : <p className="text-sm font-black text-zinc-500">Select a conversation</p>}</header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">{selectedId ? selectedMessages.map((message) => <div className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-6 ${message.mine ? "ml-auto rounded-br-md bg-pink-600 text-white" : "rounded-bl-md bg-white/[0.08] text-zinc-200"}`} key={message.id}>{message.body}<span className={`mt-1 block text-[9px] ${message.mine ? "text-pink-100/60" : "text-zinc-600"}`}>{new Date(message.createdAt).toLocaleString()}</span></div>) : <p className="pt-20 text-center text-sm text-zinc-600">Choose a conversation or search for an account.</p>}</div>
      {error ? <p className="border-t border-red-300/20 bg-red-500/10 px-4 py-2 text-xs text-red-200">{error}</p> : null}
      <div className="flex gap-2 border-t border-white/10 p-3"><textarea className="min-h-12 flex-1 resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-pink-300/40" disabled={!selectedId} maxLength={2000} onChange={(event) => setDraft(event.target.value)} placeholder="Write a private message" value={draft} /><button className="rounded-full bg-pink-500 px-5 text-xs font-black disabled:opacity-40" disabled={!selectedId || !draft.trim()} onClick={() => void send()} type="button">Send</button></div>
    </section>
  </div>;
}

export function PrincipessaFeedAchievementsPage({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [items, setItems] = useState<Achievement[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => { if (!isLoggedIn) return Promise.resolve(); return fetch("/api/user/principessa-feed/achievements", { cache: "no-store" }).then((response) => json<{ achievements: Achievement[] }>(response)).then((payload) => setItems(payload.achievements)).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Achievements failed.")); }, [isLoggedIn]);
  useEffect(() => { void load(); }, [load]);
  const share = async (key: string) => { try { const payload = await fetch("/api/user/principessa-feed/achievements", { body: JSON.stringify({ key }), headers: { "Content-Type": "application/json" }, method: "POST" }).then((response) => json<{ message: string }>(response)); setNotice(payload.message); await load(); } catch (shareError) { setError(shareError instanceof Error ? shareError.message : "Achievement could not be shared."); } };
  if (!isLoggedIn) return <p className="p-16 text-center text-sm text-zinc-500">Sign in to share achievements.</p>;
  return <div className="p-5"><p className="mb-5 text-sm leading-6 text-zinc-500">Nothing is posted automatically. Choose exactly what you want to send to Principessa for approval.</p>{notice ? <p className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">{notice}</p> : null}{error ? <p className="mb-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</p> : null}<div className="grid gap-3">{items.map((item) => <article className="rounded-3xl border border-[#f4c06a]/15 bg-[linear-gradient(135deg,rgba(244,192,106,.08),rgba(236,72,153,.05))] p-5" key={item.key}><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f4c06a]">Achievement card</p><h3 className="mt-2 font-serif text-xl text-[#ffe4b5]">{item.title}</h3><p className="mt-1 text-sm leading-6 text-zinc-400">{item.description}</p><button className="mt-4 rounded-full bg-pink-500 px-5 py-2 text-xs font-black disabled:opacity-40" disabled={item.shared} onClick={() => void share(item.key)} type="button">{item.shared ? "Already shared" : "Share"}</button></article>)}{items.length === 0 ? <p className="py-12 text-center text-sm text-zinc-600">No shareable achievements yet.</p> : null}</div></div>;
}

export function PrincipessaFeedSocialPanels({ activeView, isAdmin = false, isLoggedIn }: { activeView: string; isAdmin?: boolean; isLoggedIn: boolean }) {
  const links: Array<{ adminOnly?: boolean; href: string; icon: string; label: string; view: SocialView }> = [
    { adminOnly: true, href: "/principessa-feed/approvals", icon: "✓", label: "Post Approvals", view: "approvals" },
    { href: "/principessa-feed/search", icon: "⌕", label: "Search", view: "search" },
    { href: "/principessa-feed/messages", icon: "✉", label: "Direct Messages", view: "messages" },
    { href: "/principessa-feed/achievements", icon: "◇", label: "Share Achievement", view: "achievements" },
  ];
  return <nav className="mt-2 grid gap-1">{links.filter((link) => (!link.adminOnly || isAdmin) && (isLoggedIn || link.view === "search")).map((link) => <Link className={`rounded-2xl px-4 py-3 text-left text-sm font-black transition ${activeView === link.view ? "border border-[#f4c06a]/20 bg-pink-500/10 text-[#ffe5b8]" : link.adminOnly ? "border border-amber-300/10 text-amber-200/70 hover:bg-amber-400/10 hover:text-amber-100" : "text-zinc-500 hover:bg-white/5 hover:text-white"}`} href={link.href} key={link.view}>{link.icon}&nbsp;&nbsp; {link.label}</Link>)}</nav>;
}
