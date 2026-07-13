"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PrincipessaFeedPost } from "@/lib/principessa-feed";

type Channel = "principessa" | "sub";

const IMAGE_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

async function fetchPosts(channel: Channel, signal?: AbortSignal) {
  const response = await fetch(`/api/principessa-feed?channel=${channel}`, { cache: "no-store", signal });
  const result = (await response.json()) as { error?: string; posts?: PrincipessaFeedPost[] };
  if (!response.ok) throw new Error(result.error ?? "Feed could not be loaded.");
  return result.posts ?? [];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function PostImages({ post }: { post: PrincipessaFeedPost }) {
  const [preview, setPreview] = useState<string | null>(null);
  const columns = post.images.length === 1 ? "grid-cols-1" : post.images.length === 2 ? "grid-cols-2" : "grid-cols-2";

  if (post.images.length === 0) return null;

  return (
    <>
      <div className={`grid ${columns} mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black`}>
        {post.images.map((image, index) => (
          <button className={`relative overflow-hidden ${post.images.length === 1 ? "max-h-[620px]" : "aspect-square"}`} key={image.id} onClick={() => setPreview(image.url)} type="button">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={`${post.title} ${index + 1}`} className="h-full w-full object-cover" draggable={false} loading="lazy" src={image.url} />
            {post.images.length > 1 ? <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-black">{index + 1}/{post.images.length}</span> : null}
          </button>
        ))}
      </div>
      {preview ? (
        <button className="fixed inset-0 z-[200] flex items-center justify-center bg-black/92 p-4 backdrop-blur-md" onClick={() => setPreview(null)} type="button">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Full preview" className="max-h-[94vh] max-w-[96vw] object-contain" draggable={false} src={preview} />
          <span className="absolute right-5 top-5 rounded-full border border-white/20 bg-black/70 px-4 py-2 text-xs font-black">CLOSE</span>
        </button>
      ) : null}
    </>
  );
}

function SelectedImagePreviews({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);
  if (previews.length === 0) return null;
  return <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{previews.map((preview, index) => <div className="group relative aspect-square overflow-hidden rounded-xl border border-pink-300/15 bg-black" key={`${preview.file.name}-${preview.file.lastModified}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img alt={preview.file.name} className="h-full w-full object-cover" draggable={false} src={preview.url} />
    <button aria-label={`Remove ${preview.file.name}`} className="absolute right-2 top-2 rounded-full border border-white/20 bg-black/80 px-2 py-1 text-[10px] font-black text-white hover:bg-red-500" onClick={() => onRemove(index)} type="button">REMOVE</button>
    <p className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-2 py-1 text-[9px] text-zinc-300">{preview.file.name}</p>
  </div>)}</div>;
}

function AdminComposer({ onPublished }: { onPublished: (posts: PrincipessaFeedPost[]) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("description", description.trim());
      files.forEach((file) => form.append("images", file));
      const response = await fetch("/api/admin/principessa-feed", { body: form, method: "POST" });
      const result = (await response.json()) as { error?: string; posts?: PrincipessaFeedPost[] };
      if (!response.ok) throw new Error(result.error ?? "Post could not be published.");
      onPublished(result.posts ?? []);
      setTitle(""); setDescription(""); setFiles([]); setOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Post could not be published.");
    } finally { setBusy(false); }
  };

  if (!open) {
    return <button className="w-full border-b border-white/10 px-4 py-4 text-left text-lg text-zinc-500 transition hover:bg-white/[0.025] hover:text-white" onClick={() => setOpen(true)} type="button">Share something as Principessa...</button>;
  }

  return (
    <section className="border-b border-white/10 p-4">
      <input className="w-full bg-transparent text-lg font-black outline-none placeholder:text-zinc-700" maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Post title" value={title} />
      <textarea className="mt-3 min-h-28 w-full resize-none bg-transparent text-lg leading-7 outline-none placeholder:text-zinc-700" maxLength={4000} onChange={(e) => setDescription(e.target.value)} placeholder="What is happening?" value={description} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
        <label className="cursor-pointer rounded-full px-3 py-2 text-xs font-black text-pink-400 hover:bg-pink-500/10">Add up to 8 images (optional)<input accept="image/gif,image/jpeg,image/png,image/webp" className="sr-only" multiple onChange={(e) => setFiles((current) => [...current, ...Array.from(e.target.files ?? [])].slice(0, 8))} type="file" /></label>
        <div className="flex gap-2">
          <button className="rounded-full px-4 py-2 text-xs font-black text-zinc-400" onClick={() => setOpen(false)} type="button">Cancel</button>
          <button className="rounded-full bg-pink-500 px-5 py-2 text-xs font-black disabled:opacity-40" disabled={busy || title.trim().length < 2 || !description.trim()} onClick={() => void submit()} type="button">{busy ? "Publishing..." : "Publish"}</button>
        </div>
      </div>
      <SelectedImagePreviews files={files} onRemove={(index) => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} />
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </section>
  );
}

function SubComposer({ onSubmitted }: { onSubmitted: (message: string) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true); setError("");
    try {
      const form = new FormData();
      form.set("title", title.trim()); form.set("description", description.trim()); if (image) form.set("image", image);
      const response = await fetch("/api/user/principessa-feed/posts", { body: form, method: "POST" });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error ?? "Post could not be submitted.");
      setTitle(""); setDescription(""); setImage(null);
      onSubmitted(result.message ?? "Post submitted for approval.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Post could not be submitted.");
    } finally { setBusy(false); }
  };

  const chooseImage = (file?: File) => {
    if (!file || !IMAGE_TYPES.has(file.type) || file.size > 4 * 1024 * 1024) {
      setImage(null); setError("Choose one JPG, PNG, WEBP or GIF image up to 4MB."); return;
    }
    setImage(file); setError("");
  };

  return (
    <section className="border-b border-white/10 p-4">
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-black">SUB</div>
        <div className="min-w-0 flex-1">
          <input className="w-full bg-transparent font-black outline-none placeholder:text-zinc-700" maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Short title" value={title} />
          <textarea className="mt-2 min-h-24 w-full resize-none bg-transparent text-lg leading-7 outline-none placeholder:text-zinc-700" maxLength={500} onChange={(e) => setDescription(e.target.value)} placeholder="Share with the community..." value={description} />
          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
            <label className="cursor-pointer rounded-full px-3 py-2 text-xs font-black text-pink-400 hover:bg-pink-500/10">{image ? "Change image" : "Add one image (optional)"}<input accept="image/gif,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => chooseImage(e.target.files?.[0])} type="file" /></label>
            <div className="flex items-center gap-3"><span className={description.length > 460 ? "text-xs text-amber-300" : "text-xs text-zinc-600"}>{description.length}/500</span><button className="rounded-full bg-pink-500 px-5 py-2 text-xs font-black disabled:opacity-40" disabled={busy || title.trim().length < 2 || !description.trim()} onClick={() => void submit()} type="button">{busy ? "Sending..." : "Send for approval"}</button></div>
          </div>
          <SelectedImagePreviews files={image ? [image] : []} onRemove={() => setImage(null)} />
          {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}

function PostAdminActions({ onChanged, post }: { onChanged: (posts: PrincipessaFeedPost[]) => void; post: PrincipessaFeedPost }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [description, setDescription] = useState(post.description);
  const [replacement, setReplacement] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.set("postId", post.id); form.set("title", title.trim()); form.set("description", description.trim()); replacement.forEach((file) => form.append("images", file));
      const response = await fetch("/api/admin/principessa-feed", { body: form, method: "PATCH" });
      const result = (await response.json()) as { error?: string; posts?: PrincipessaFeedPost[] };
      if (!response.ok) throw new Error(result.error ?? "Post could not be updated.");
      onChanged(result.posts ?? []); setEditing(false); setReplacement([]);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Post could not be updated."); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${post.title}"?`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/principessa-feed", { body: JSON.stringify({ postId: post.id }), headers: { "Content-Type": "application/json" }, method: "DELETE" });
      const result = (await response.json()) as { error?: string; posts?: PrincipessaFeedPost[] };
      if (!response.ok) throw new Error(result.error ?? "Post could not be deleted.");
      onChanged(result.posts ?? []);
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "Post could not be deleted."); setBusy(false); }
  };

  return (
    <div className="mb-2 ml-14">
      <div className="flex gap-3 text-xs font-black"><button className="text-zinc-500 hover:text-pink-400" disabled={busy} onClick={() => setEditing(!editing)} type="button">{editing ? "Cancel" : "Edit"}</button><button className="text-zinc-500 hover:text-red-400" disabled={busy} onClick={() => void remove()} type="button">Delete</button></div>
      {editing ? <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-black/40 p-3"><input className="rounded-lg bg-white/5 px-3 py-2 outline-none" maxLength={120} onChange={(e) => setTitle(e.target.value)} value={title} /><textarea className="min-h-24 rounded-lg bg-white/5 px-3 py-2 outline-none" maxLength={4000} onChange={(e) => setDescription(e.target.value)} value={description} /><label className="cursor-pointer text-xs text-pink-400">Replace all images (optional)<input accept="image/gif,image/jpeg,image/png,image/webp" className="sr-only" multiple onChange={(e) => setReplacement(Array.from(e.target.files ?? []).slice(0, 8))} type="file" /></label><SelectedImagePreviews files={replacement} onRemove={(index) => setReplacement((current) => current.filter((_, fileIndex) => fileIndex !== index))} /><button className="rounded-full bg-pink-500 px-4 py-2 text-xs font-black disabled:opacity-40" disabled={busy || title.trim().length < 2 || !description.trim()} onClick={() => void save()} type="button">{busy ? "Saving..." : "Save changes"}</button></div> : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

type FeedProfile = { avatarUrl: string | null; displayName: string; headerUrl: string | null; username: string };
const BRAND_IMAGE = "/principessa-feed/branding/principessa-feed-hero.png";

function FeedAvatar({ author, official = false, large = false }: { author?: PrincipessaFeedPost["author"]; official?: boolean; large?: boolean }) {
  const image = author?.avatarUrl || (official ? BRAND_IMAGE : null);
  const size = large ? "h-28 w-28" : "h-11 w-11";
  if (image) return <div className={`${size} shrink-0 rounded-full border border-[#f4c06a]/40 bg-cover shadow-[0_0_20px_rgba(236,72,153,.18)]`} style={{ backgroundImage: `url(${image})`, backgroundPosition: official && !author?.avatarUrl ? "72% 28%" : "center" }} />;
  return <div className={`${size} flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-xs font-black`}>{author?.displayName?.slice(0, 1).toUpperCase() || "S"}</div>;
}

export function PrincipessaSocialFeed({ isAdmin, isLoggedIn }: { isAdmin: boolean; isLoggedIn: boolean }) {
  const [view, setView] = useState<"home" | "profile">("home");
  const [channel, setChannel] = useState<Channel>("principessa");
  const [posts, setPosts] = useState<PrincipessaFeedPost[]>([]);
  const [pendingPosts, setPendingPosts] = useState<PrincipessaFeedPost[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [commentBusy, setCommentBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState<FeedProfile | null>(null);
  const [profilePosts, setProfilePosts] = useState<PrincipessaFeedPost[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [headerFile, setHeaderFile] = useState<File | null>(null);

  const switchChannel = (nextChannel: Channel) => {
    if (nextChannel === channel) return;
    setChannel(nextChannel);
    setLoading(true);
    setError("");
    setNotice("");
    setPendingPosts([]);
  };

  const reload = useCallback(async () => {
    try { setPosts(await fetchPosts(channel)); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Feed could not be loaded."); }
  }, [channel]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPosts(channel, controller.signal).then(setPosts).catch((loadError: unknown) => { if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(loadError instanceof Error ? loadError.message : "Feed could not be loaded."); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [channel]);

  useEffect(() => {
    if (!isAdmin || channel !== "sub") return;
    fetch("/api/admin/principessa-feed/moderation", { cache: "no-store" }).then(async (response) => { const result = (await response.json()) as { error?: string; posts?: PrincipessaFeedPost[] }; if (!response.ok) throw new Error(result.error); setPendingPosts(result.posts ?? []); }).catch((queueError: unknown) => setError(queueError instanceof Error ? queueError.message : "Queue failed."));
  }, [channel, isAdmin]);

  const loadProfile = useCallback(async () => {
    if (!isLoggedIn) return;
    setProfileLoading(true); setError("");
    try {
      const response = await fetch("/api/user/principessa-feed/profile", { cache: "no-store" });
      const result = (await response.json()) as { error?: string; posts?: PrincipessaFeedPost[]; profile?: FeedProfile };
      if (!response.ok) throw new Error(result.error ?? "Profile could not be loaded.");
      setProfile(result.profile ?? null); setProfilePosts(result.posts ?? []);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Profile could not be loaded."); }
    finally { setProfileLoading(false); }
  }, [isLoggedIn]);

  const openProfile = () => {
    if (!isLoggedIn) { setNotice("Sign in from Main Page to open your feed profile."); return; }
    setView("profile"); setNotice(""); void loadProfile();
  };

  const saveProfile = async () => {
    if (!avatarFile && !headerFile) return;
    setProfileSaving(true); setError("");
    try {
      const form = new FormData();
      if (avatarFile) form.set("avatar", avatarFile);
      if (headerFile) form.set("header", headerFile);
      const response = await fetch("/api/user/principessa-feed/profile", { body: form, method: "POST" });
      const result = (await response.json()) as { error?: string; posts?: PrincipessaFeedPost[]; profile?: FeedProfile };
      if (!response.ok) throw new Error(result.error ?? "Profile could not be saved.");
      setProfile(result.profile ?? null); setProfilePosts(result.posts ?? []); setAvatarFile(null); setHeaderFile(null); setNotice("Feed appearance updated.");
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Profile could not be saved."); }
    finally { setProfileSaving(false); }
  };

  const deleteOwnSubPost = async (post: PrincipessaFeedPost) => {
    if (!window.confirm(`Delete "${post.title}"?`)) return;
    setError("");
    try {
      const response = await fetch("/api/user/principessa-feed/posts", { body: JSON.stringify({ postId: post.id }), headers: { "Content-Type": "application/json" }, method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Post could not be deleted.");
      setProfilePosts((current) => current.filter((item) => item.id !== post.id));
      setNotice("Post deleted.");
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "Post could not be deleted."); }
  };

  const comment = async (postId: string) => {
    const body = String(drafts[postId] ?? "").trim(); if (!body) return; setCommentBusy(postId);
    try { const response = await fetch("/api/user/principessa-feed/comments", { body: JSON.stringify({ body, postId }), headers: { "Content-Type": "application/json" }, method: "POST" }); const result = (await response.json()) as { error?: string }; if (!response.ok) throw new Error(result.error); setDrafts((current) => ({ ...current, [postId]: "" })); await reload(); }
    catch (commentError) { setError(commentError instanceof Error ? commentError.message : "Comment failed."); } finally { setCommentBusy(null); }
  };

  const moderate = async (postId: string, action: "approve" | "reject") => {
    const response = await fetch("/api/admin/principessa-feed/moderation", { body: JSON.stringify({ action, postId }), headers: { "Content-Type": "application/json" }, method: "POST" });
    const result = (await response.json()) as { error?: string; pendingPosts?: PrincipessaFeedPost[]; publishedPosts?: PrincipessaFeedPost[] };
    if (!response.ok) { setError(result.error ?? "Moderation failed."); return; }
    setPendingPosts(result.pendingPosts ?? []); setPosts(result.publishedPosts ?? []);
  };

  return (
    <div className="relative mx-auto grid min-h-[calc(100vh-76px)] max-w-[1380px] grid-cols-1 bg-[#060206] lg:grid-cols-[240px_minmax(0,720px)_300px]">
      <div className="pointer-events-none fixed inset-y-[76px] right-0 -z-10 w-[46vw] bg-[url('/principessa-feed/branding/principessa-feed-hero.png')] bg-cover bg-[65%_center] opacity-[0.1]" />
      <aside className="hidden border-r border-[#f4c06a]/10 p-5 lg:block"><div className="sticky top-[100px]"><FeedAvatar official large /><h1 className="mt-5 font-serif text-2xl text-[#ffe5b8]">Principessa Feed</h1><p className="mt-2 text-[10px] font-black uppercase tracking-[0.22em] text-pink-300/45">Her private court</p><div className="mt-8 grid gap-2"><button className={`rounded-2xl px-4 py-3 text-left font-black ${view === "home" ? "border border-[#f4c06a]/20 bg-pink-500/10 text-[#ffe5b8]" : "text-zinc-500 hover:bg-white/5"}`} onClick={() => setView("home")} type="button">⌂&nbsp;&nbsp; Home</button><button className={`rounded-2xl px-4 py-3 text-left font-black ${view === "profile" ? "border border-[#f4c06a]/20 bg-pink-500/10 text-[#ffe5b8]" : "text-zinc-500 hover:bg-white/5"}`} onClick={openProfile} type="button">♙&nbsp;&nbsp; Profile</button></div><p className="mt-10 border-l border-[#f4c06a]/30 pl-3 font-serif text-sm italic leading-6 text-zinc-600">A velvet room for Principessa’s official visions and approved offerings.</p></div></aside>

      <section className="min-w-0 border-x border-[#f4c06a]/10 bg-[#090509]/95 shadow-[0_0_50px_rgba(0,0,0,.5)]">
        <header className="sticky top-[76px] z-40 border-b border-[#f4c06a]/10 bg-[#090509]/92 backdrop-blur-xl"><div className="flex items-center justify-between px-4 py-3"><div><h1 className="font-serif text-xl text-[#ffe5b8]">{view === "home" ? "The Velvet Network" : "My Feed Profile"}</h1><p className="text-[10px] uppercase tracking-[0.18em] text-pink-300/40">{view === "home" ? "Inside Principessa’s court" : "Your posts and private identity"}</p></div><div className="flex gap-1 lg:hidden"><button className={`rounded-full px-3 py-2 text-xs font-black ${view === "home" ? "bg-pink-500" : "text-zinc-500"}`} onClick={() => setView("home")} type="button">Home</button><button className={`rounded-full px-3 py-2 text-xs font-black ${view === "profile" ? "bg-pink-500" : "text-zinc-500"}`} onClick={openProfile} type="button">Profile</button></div></div>{view === "home" ? <div className="grid grid-cols-2">{(["principessa", "sub"] as const).map((item) => <button className="relative py-4 text-sm font-black capitalize text-zinc-500 hover:bg-white/[0.03]" key={item} onClick={() => switchChannel(item)} type="button">{item === "sub" ? "Subs" : item}{channel === item ? <span className="absolute inset-x-1/3 bottom-0 h-0.5 bg-gradient-to-r from-pink-500 via-[#f4c06a] to-pink-500 shadow-[0_0_12px_#ec4899]" /> : null}</button>)}</div> : null}</header>

        {view === "profile" ? (
          profileLoading ? <p className="p-16 text-center text-zinc-600">Opening your profile...</p> : profile ? <div>
            <div className="relative mb-16"><div className="h-52 bg-cover bg-center sm:h-64" style={{ backgroundImage: `linear-gradient(0deg,rgba(9,5,9,.72),transparent 60%),url(${profile.headerUrl || BRAND_IMAGE})` }} /><div className="absolute -bottom-14 left-5"><FeedAvatar author={{ avatarUrl: profile.avatarUrl, displayName: profile.displayName, username: profile.username }} official={isAdmin} large /></div></div>
            <div className="px-5 pb-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-serif text-2xl text-[#ffe4b5]">{profile.displayName}</h2><p className="text-sm text-zinc-600">@{profile.username.replace(/^@/, "")}</p><p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-pink-300/50">{profilePosts.length} feed post{profilePosts.length === 1 ? "" : "s"}</p></div><div className="flex flex-wrap gap-2"><label className="cursor-pointer rounded-full border border-[#f4c06a]/20 px-4 py-2 text-xs font-black text-[#f8dca8]">{avatarFile ? avatarFile.name : "Change photo"}<input accept="image/gif,image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} type="file" /></label><label className="cursor-pointer rounded-full border border-[#f4c06a]/20 px-4 py-2 text-xs font-black text-[#f8dca8]">{headerFile ? headerFile.name : "Change header"}<input accept="image/gif,image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setHeaderFile(event.target.files?.[0] ?? null)} type="file" /></label><button className="rounded-full bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-2 text-xs font-black disabled:opacity-40" disabled={profileSaving || (!avatarFile && !headerFile)} onClick={() => void saveProfile()} type="button">{profileSaving ? "Saving..." : "Save appearance"}</button></div></div></div>
            {notice ? <p className="border-y border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">{notice}</p> : null}{error ? <p className="border-y border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</p> : null}
            <div className="border-y border-[#f4c06a]/10 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Your posts</div>
            {profilePosts.length ? profilePosts.map((post) => <article className="border-b border-[#f4c06a]/10 p-5" key={post.id}><div className="flex gap-3"><FeedAvatar author={post.author} official={post.channel === "principessa"} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-black">{post.author.displayName}</span><span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-black uppercase text-zinc-500">{post.status}</span></div><h3 className="mt-1 font-serif text-xl text-[#ffe4b5]">{post.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{post.description}</p><PostImages post={post} /></div></div>{isAdmin && post.channel === "principessa" ? <PostAdminActions onChanged={setProfilePosts} post={post} /> : post.channel === "sub" ? <div className="ml-14 mt-3"><button className="text-xs font-black text-red-300/70 hover:text-red-300" onClick={() => void deleteOwnSubPost(post)} type="button">Delete post</button></div> : null}</article>) : <p className="p-16 text-center text-zinc-600">Your submitted posts will appear here.</p>}
          </div> : null
        ) : <>
        <div className="relative h-48 overflow-hidden border-b border-[#f4c06a]/10 sm:h-56"><div className="absolute inset-0 bg-[url('/principessa-feed/branding/principessa-feed-hero.png')] bg-cover bg-[center_28%]" /><div className="absolute inset-0 bg-gradient-to-r from-[#090509] via-[#090509]/30 to-transparent" /><div className="absolute inset-0 bg-gradient-to-t from-[#090509] via-transparent to-transparent" /><div className="absolute bottom-5 left-5 max-w-sm"><p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#f4c06a]">The court is open</p><h2 className="mt-1 font-serif text-3xl">Principessa has entered.</h2><p className="mt-1 text-sm text-zinc-300/70">Official visions, private moments and offerings worthy of the feed.</p></div></div>
        {channel === "principessa" && isAdmin ? <AdminComposer onPublished={setPosts} /> : null}
        {channel === "sub" && isLoggedIn ? <SubComposer onSubmitted={setNotice} /> : null}
        {channel === "sub" && !isLoggedIn ? <p className="border-b border-white/10 p-4 text-sm text-zinc-500">Sign in from Main Page to submit or comment.</p> : null}
        {channel === "sub" && isAdmin && pendingPosts.length > 0 ? <section className="border-b border-amber-300/20 bg-amber-400/[0.04]"><div className="flex items-center justify-between p-4"><h2 className="font-black text-amber-100">Approval queue</h2><span className="rounded-full bg-amber-300 px-2 py-0.5 text-xs font-black text-black">{pendingPosts.length}</span></div>{pendingPosts.map((post) => <article className="border-t border-amber-300/10 p-4" key={post.id}><p className="text-xs font-black text-amber-200">{post.author.displayName}</p><h3 className="mt-1 font-black">{post.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-300">{post.description}</p><PostImages post={post} /><div className="mt-3 grid grid-cols-2 gap-2"><button className="rounded-full bg-emerald-500 py-2 text-xs font-black text-black" onClick={() => void moderate(post.id, "approve")} type="button">Approve</button><button className="rounded-full border border-red-400/30 py-2 text-xs font-black text-red-300" onClick={() => void moderate(post.id, "reject")} type="button">Reject</button></div></article>)}</section> : null}
        {notice ? <p className="border-b border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">{notice}</p> : null}
        {error ? <p className="border-b border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</p> : null}

        {loading ? <p className="p-16 text-center text-zinc-600">Loading feed...</p> : posts.length === 0 ? <div className="p-16 text-center"><p className="text-lg font-black">No posts yet.</p><p className="mt-2 text-sm text-zinc-600">Published posts will appear here.</p></div> : posts.map((post) => (
          <article className="border-b border-white/10 p-4 transition hover:bg-white/[0.015]" key={post.id}>
            <div className="flex gap-3"><FeedAvatar author={post.author} official={post.channel === "principessa"} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-black">{post.author.displayName}</span><span className={post.channel === "principessa" ? "text-xs text-pink-400" : "text-xs text-zinc-600"}>{post.channel === "principessa" ? "◆ Official court" : "Approved Sub"}</span><span className="text-xs text-zinc-700">· {formatDate(post.createdAt)}</span></div><h2 className="mt-1 font-serif text-xl text-[#ffe4b5]">{post.title}</h2><p className="mt-1 whitespace-pre-wrap text-[15px] leading-6 text-zinc-300">{post.description}</p><PostImages post={post} /></div></div>
            {isAdmin ? <PostAdminActions onChanged={setPosts} post={post} /> : null}
            {post.comments.length > 0 ? <div className="ml-14 mt-3 grid gap-2 border-l border-white/10 pl-3">{post.comments.map((item) => <div key={item.id}><div className="flex justify-between gap-2"><span className="text-xs font-black text-zinc-300">{item.author.displayName}</span><span className="text-[10px] text-zinc-700">{formatDate(item.createdAt)}</span></div><p className="text-sm text-zinc-400">{item.body}</p></div>)}</div> : null}
            {isLoggedIn ? <div className="ml-14 mt-4 flex gap-2"><input className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm outline-none focus:border-pink-400/40" maxLength={500} onChange={(e) => setDrafts((current) => ({ ...current, [post.id]: e.target.value }))} placeholder="Post your reply" value={drafts[post.id] ?? ""} /><button className="rounded-full bg-pink-500 px-4 py-2 text-xs font-black disabled:opacity-40" disabled={commentBusy === post.id || !String(drafts[post.id] ?? "").trim()} onClick={() => void comment(post.id)} type="button">Reply</button></div> : null}
          </article>
        ))}
        </>}
      </section>

      <aside className="hidden p-5 lg:block"><div className="sticky top-[100px] space-y-4"><section className="overflow-hidden rounded-3xl border border-[#f4c06a]/15 bg-[#120813]/80"><div className="h-28 bg-[url('/principessa-feed/branding/principessa-feed-hero.png')] bg-cover bg-[center_28%] opacity-70" /><div className="p-4"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#f4c06a]">House rules</p><ol className="mt-3 grid gap-3 text-sm text-zinc-500"><li><b className="text-zinc-300">One image.</b> Subs may attach a single offering.</li><li><b className="text-zinc-300">80 / 500.</b> Title and post limits stay concise.</li><li><b className="text-zinc-300">Approval.</b> Every Sub post enters the queue.</li></ol></div></section><section className="rounded-3xl border border-pink-300/10 bg-pink-500/[0.04] p-4 font-serif text-sm italic leading-6 text-pink-100/60">Principessa posts may hold up to eight images. Her court, her rules.</section></div></aside>
    </div>
  );
}
