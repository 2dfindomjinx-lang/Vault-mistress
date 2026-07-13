"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PrincipessaFeedPost } from "@/lib/principessa-feed";
import { DisplayNameWithUsername } from "@/components/DisplayNameWithUsername";
import { PrincipessaFeedNotifications, PrincipessaFeedNotificationsPage } from "@/components/PrincipessaFeedNotifications";
import { PrincipessaFeedAchievementsPage, PrincipessaFeedMessagesPage, PrincipessaFeedSearchPage, PrincipessaFeedSocialPanels } from "@/components/PrincipessaFeedSocialPanels";

type Channel = "principessa" | "sub";
export type PrincipessaFeedView = "achievements" | "home" | "messages" | "notifications" | "profile" | "search";
type MentionUser = { displayName: string; id: string; username: string };

const IMAGE_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);
const MAX_FUNCTION_UPLOAD_BYTES = 4 * 1024 * 1024;

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new Error(response.status === 413
      ? "The selected images are too large to upload together. Keep the total below 4 MB."
      : `The server returned an empty response (${response.status}). Please try again.`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(response.status === 413
      ? "The selected images are too large to upload together. Keep the total below 4 MB."
      : `The server returned an invalid response (${response.status}). Please try again.`);
  }
}

async function fetchPosts(channel: Channel, signal?: AbortSignal) {
  const response = await fetch(`/api/principessa-feed?channel=${channel}`, { signal });
  const result = await readJsonResponse<{ error?: string; posts?: PrincipessaFeedPost[] }>(response);
  if (!response.ok) throw new Error(result.error ?? "Feed could not be loaded.");
  return result.posts ?? [];
}

function MentionText({ text }: { text: string }) {
  return <>{text.split(/(@[a-zA-Z0-9_.-]+)/g).map((part, index) => part.startsWith("@")
    ? <span className="font-black text-pink-300" key={`${part}-${index}`}>{part}</span>
    : part)}</>;
}

function MentionTextarea({ className, maxLength, onChange, placeholder, value }: {
  className: string;
  maxLength: number;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<MentionUser[]>([]);
  const cursorRef = useRef(value.length);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/user/principessa-feed/users?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => readJsonResponse<{ users?: MentionUser[] }>(response))
        .then((result) => setUsers(result.users ?? []))
        .catch(() => setUsers([]));
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  const updateQuery = (nextValue: string, cursor: number) => {
    cursorRef.current = cursor;
    const match = nextValue.slice(0, cursor).match(/(?:^|\s)@([a-zA-Z0-9_.-]*)$/);
    setQuery(match?.[1] ?? "");
    if (!match) setUsers([]);
  };

  const insertMention = (username: string) => {
    const beforeCursor = value.slice(0, cursorRef.current);
    const match = beforeCursor.match(/(?:^|\s)@[a-zA-Z0-9_.-]*$/);
    if (!match) return;
    const mentionStart = cursorRef.current - match[0].trimStart().length;
    onChange(`${value.slice(0, mentionStart)}@${username} ${value.slice(cursorRef.current)}`);
    setQuery(""); setUsers([]);
  };

  return <div className="relative">
    <textarea className={className} maxLength={maxLength} onChange={(event) => {
      onChange(event.target.value);
      updateQuery(event.target.value, event.target.selectionStart);
    }} onClick={(event) => updateQuery(value, event.currentTarget.selectionStart)} placeholder={placeholder} value={value} />
    {users.length > 0 ? <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-pink-300/20 bg-[#160b16] shadow-2xl">{users.map((user) => <button className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-pink-500/10" key={user.id} onMouseDown={(event) => { event.preventDefault(); insertMention(user.username); }} type="button"><span className="text-sm font-black text-zinc-200">{user.displayName}</span><span className="text-xs text-pink-300">@{user.username}</span></button>)}</div> : null}
  </div>;
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

type CropTarget = "avatar" | "header";

function drawCrop(canvas: HTMLCanvasElement, image: HTMLImageElement, zoom: number, x: number, y: number) {
  const imageWidth = image.naturalWidth;
  const imageHeight = image.naturalHeight;
  const targetAspect = canvas.width / canvas.height;
  const imageAspect = imageWidth / imageHeight;
  const baseWidth = imageAspect > targetAspect ? imageHeight * targetAspect : imageWidth;
  const baseHeight = imageAspect > targetAspect ? imageHeight : imageWidth / targetAspect;
  const cropWidth = baseWidth / zoom;
  const cropHeight = baseHeight / zoom;
  const centerX = (imageWidth - cropWidth) / 2;
  const centerY = (imageHeight - cropHeight) / 2;
  const sourceX = centerX + (x / 100) * centerX;
  const sourceY = centerY + (y / 100) * centerY;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
}

function useFilePreview(file: File | null) {
  const url = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

function ImageCropEditor({ file, onApply, onCancel, target }: { file: File; onApply: (file: File) => void; onCancel: () => void; target: CropTarget }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceUrl = useFilePreview(file);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [busy, setBusy] = useState(false);
  const previewWidth = target === "avatar" ? 720 : 900;
  const previewHeight = target === "avatar" ? 720 : 300;

  useEffect(() => {
    if (!sourceUrl || !canvasRef.current) return;
    const image = new Image();
    image.onload = () => { if (canvasRef.current) drawCrop(canvasRef.current, image, zoom, x, y); };
    image.src = sourceUrl;
  }, [sourceUrl, x, y, zoom]);

  const apply = async () => {
    if (!sourceUrl) return;
    setBusy(true);
    try {
      const image = new Image();
      image.src = sourceUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = target === "avatar" ? 1024 : 1800;
      canvas.height = target === "avatar" ? 1024 : 600;
      drawCrop(canvas, image, zoom, x, y);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
      if (!blob) throw new Error("The cropped image could not be created.");
      onApply(new File([blob], `${target}-${Date.now()}.webp`, { type: "image/webp" }));
    } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl">
    <section className="w-full max-w-3xl rounded-3xl border border-[#f4c06a]/20 bg-[#100811] p-4 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><h2 className="font-serif text-2xl text-[#ffe4b5]">Adjust {target === "avatar" ? "profile photo" : "header"}</h2><p className="mt-1 text-sm text-zinc-500">Zoom and move the image until the frame looks right.</p></div><button className="rounded-full border border-white/10 px-3 py-2 text-xs font-black text-zinc-400" onClick={onCancel} type="button">CLOSE</button></div>
      <div className={`mx-auto mt-5 overflow-hidden border border-pink-300/20 bg-black shadow-[0_0_28px_rgba(236,72,153,.12)] ${target === "avatar" ? "aspect-square max-w-md rounded-full" : "aspect-[3/1] w-full rounded-2xl"}`}><canvas className="h-full w-full" height={previewHeight} ref={canvasRef} width={previewWidth} /></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3"><label className="text-xs font-black uppercase tracking-wider text-zinc-500">Zoom <span className="float-right text-pink-300">{zoom.toFixed(1)}×</span><input className="mt-2 w-full accent-pink-500" max="3" min="1" onChange={(event) => setZoom(Number(event.target.value))} step="0.05" type="range" value={zoom} /></label><label className="text-xs font-black uppercase tracking-wider text-zinc-500">Horizontal<input className="mt-2 w-full accent-pink-500" max="100" min="-100" onChange={(event) => setX(Number(event.target.value))} type="range" value={x} /></label><label className="text-xs font-black uppercase tracking-wider text-zinc-500">Vertical<input className="mt-2 w-full accent-pink-500" max="100" min="-100" onChange={(event) => setY(Number(event.target.value))} type="range" value={y} /></label></div>
      <div className="mt-6 flex justify-end gap-2"><button className="rounded-full px-5 py-2 text-xs font-black text-zinc-500" onClick={onCancel} type="button">Cancel</button><button className="rounded-full bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 py-2 text-xs font-black disabled:opacity-50" disabled={busy} onClick={() => void apply()} type="button">{busy ? "Preparing..." : "Use this crop"}</button></div>
    </section>
  </div>;
}

function AdminComposer({ onPublished }: { onPublished: (posts: PrincipessaFeedPost[]) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (files.reduce((total, file) => total + file.size, 0) > MAX_FUNCTION_UPLOAD_BYTES) {
      setError("The selected images are too large to upload together. Keep the total below 4 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("description", description.trim());
      files.forEach((file) => form.append("images", file));
      const response = await fetch("/api/admin/principessa-feed", { body: form, method: "POST" });
      const result = await readJsonResponse<{ error?: string; posts?: PrincipessaFeedPost[] }>(response);
      if (!response.ok) throw new Error(result.error ?? "Post could not be published.");
      onPublished(result.posts ?? []);
      setTitle(""); setDescription(""); setFiles([]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Post could not be published.");
    } finally { setBusy(false); }
  };

  return (
    <section className="border-b border-white/10 p-4">
      <input className="w-full bg-transparent text-lg font-black outline-none placeholder:text-zinc-700" maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Post title" value={title} />
      <MentionTextarea className="mt-3 min-h-28 w-full resize-none bg-transparent text-lg leading-7 outline-none placeholder:text-zinc-700" maxLength={4000} onChange={setDescription} placeholder="What is happening? Type @ to tag someone." value={description} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
        <label className="cursor-pointer rounded-full px-3 py-2 text-xs font-black text-pink-400 hover:bg-pink-500/10">Add up to 8 images (4 MB total)<input accept="image/gif,image/jpeg,image/png,image/webp" className="sr-only" multiple onChange={(event) => { const next = [...files, ...Array.from(event.target.files ?? [])].slice(0, 8); if (next.reduce((total, file) => total + file.size, 0) > MAX_FUNCTION_UPLOAD_BYTES) setError("The selected images are too large to upload together. Keep the total below 4 MB."); else { setFiles(next); setError(""); } event.target.value = ""; }} type="file" /></label>
        <div className="flex gap-2">
          <button className="rounded-full px-4 py-2 text-xs font-black text-zinc-400" onClick={() => { setTitle(""); setDescription(""); setFiles([]); setError(""); }} type="button">Clear</button>
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
  const [postType, setPostType] = useState<"normal" | "confession">("normal");
  const [confessionMode, setConfessionMode] = useState<"anonymous" | "pseudonymous">("anonymous");

  const submit = async () => {
    setBusy(true); setError("");
    try {
      const form = new FormData();
      form.set("title", title.trim()); form.set("description", description.trim()); form.set("postType", postType); form.set("confessionMode", confessionMode); if (image) form.set("image", image);
      const response = await fetch("/api/user/principessa-feed/posts", { body: form, method: "POST" });
      const result = await readJsonResponse<{ error?: string; message?: string }>(response);
      if (!response.ok) throw new Error(result.error ?? "Post could not be submitted.");
      setTitle(""); setDescription(""); setImage(null); setPostType("normal"); setConfessionMode("anonymous");
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
          <div className="mb-3 flex flex-wrap gap-2"><button className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${postType === "normal" ? "bg-pink-500 text-white" : "border border-white/10 text-zinc-500"}`} onClick={() => setPostType("normal")} type="button">Regular post</button><button className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${postType === "confession" ? "bg-fuchsia-500 text-white" : "border border-white/10 text-zinc-500"}`} onClick={() => setPostType("confession")} type="button">Confession</button>{postType === "confession" ? <select className="rounded-full border border-fuchsia-300/20 bg-black/40 px-3 py-1 text-[10px] font-black text-fuchsia-200" onChange={(event) => setConfessionMode(event.target.value === "pseudonymous" ? "pseudonymous" : "anonymous")} value={confessionMode}><option value="anonymous">Fully anonymous</option><option value="pseudonymous">Veiled alias</option></select> : null}</div>
          <input className="w-full bg-transparent font-black outline-none placeholder:text-zinc-700" maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Short title" value={title} />
          <MentionTextarea className="mt-2 min-h-24 w-full resize-none bg-transparent text-lg leading-7 outline-none placeholder:text-zinc-700" maxLength={500} onChange={setDescription} placeholder="Share with the community... Type @ to tag someone." value={description} />
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

  const togglePin = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/principessa-feed/pin", { body: JSON.stringify({ postId: post.id }), headers: { "Content-Type": "application/json" }, method: "POST" });
      const result = await readJsonResponse<{ error?: string; posts?: PrincipessaFeedPost[] }>(response);
      if (!response.ok) throw new Error(result.error ?? "Pin update failed.");
      onChanged(result.posts ?? []);
    } catch (pinError) { setError(pinError instanceof Error ? pinError.message : "Pin update failed."); }
    finally { setBusy(false); }
  };

  return (
    <div className="mb-2 ml-14">
      <div className="flex gap-3 text-xs font-black"><button className="text-zinc-500 hover:text-pink-400" disabled={busy} onClick={() => setEditing(!editing)} type="button">{editing ? "Cancel" : "Edit"}</button><button className={post.pinned ? "text-[#f4c06a]" : "text-zinc-500 hover:text-[#f4c06a]"} disabled={busy} onClick={() => void togglePin()} type="button">{post.pinned ? "Unpin" : "Pin to profile"}</button><button className="text-zinc-500 hover:text-red-400" disabled={busy} onClick={() => void remove()} type="button">Delete</button></div>
      {editing ? <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-black/40 p-3"><input className="rounded-lg bg-white/5 px-3 py-2 outline-none" maxLength={120} onChange={(e) => setTitle(e.target.value)} value={title} /><textarea className="min-h-24 rounded-lg bg-white/5 px-3 py-2 outline-none" maxLength={4000} onChange={(e) => setDescription(e.target.value)} value={description} /><label className="cursor-pointer text-xs text-pink-400">Replace all images (optional)<input accept="image/gif,image/jpeg,image/png,image/webp" className="sr-only" multiple onChange={(e) => setReplacement(Array.from(e.target.files ?? []).slice(0, 8))} type="file" /></label><SelectedImagePreviews files={replacement} onRemove={(index) => setReplacement((current) => current.filter((_, fileIndex) => fileIndex !== index))} /><button className="rounded-full bg-pink-500 px-4 py-2 text-xs font-black disabled:opacity-40" disabled={busy || title.trim().length < 2 || !description.trim()} onClick={() => void save()} type="button">{busy ? "Saving..." : "Save changes"}</button></div> : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

type FeedProfile = { avatarUrl: string | null; displayName: string; headerUrl: string | null; username: string };
const BRAND_IMAGE = "/principessa-feed/branding/principessa-feed-hero.webp";

function FeedAvatar({ author, empty = false, official = false, large = false }: { author?: PrincipessaFeedPost["author"]; empty?: boolean; official?: boolean; large?: boolean }) {
  const image = author?.avatarUrl || (official ? BRAND_IMAGE : null);
  const size = large ? "h-28 w-28" : "h-11 w-11";
  if (image) return <div className={`${size} shrink-0 rounded-full border border-[#f4c06a]/40 bg-cover shadow-[0_0_20px_rgba(236,72,153,.18)]`} style={{ backgroundImage: `url(${image})`, backgroundPosition: official && !author?.avatarUrl ? "72% 28%" : "center" }} />;
  if (empty) return <div className={`${size} flex shrink-0 items-center justify-center rounded-full border border-[#f4c06a]/25 bg-[#100811] text-[#f4c06a]/40`}><svg aria-hidden="true" className="h-1/2 w-1/2" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" /><path d="M4.5 21c.6-5 3.1-7.5 7.5-7.5s6.9 2.5 7.5 7.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" /></svg></div>;
  return <div className={`${size} flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-xs font-black`}>{author?.displayName?.slice(0, 1).toUpperCase() || "S"}</div>;
}

function PostInteractions({ busy, isLoggedIn, onHighlight, onToggle, post }: {
  busy: string | null;
  isLoggedIn: boolean;
  onHighlight: (postId: string) => void;
  onToggle: (postId: string, action: "like" | "repost") => void;
  post: PrincipessaFeedPost;
}) {
  return <div className="ml-14 mt-3 flex items-center gap-5 border-t border-white/[0.06] pt-3 text-xs font-black">
    <button className={post.likedByViewer ? "text-pink-400" : "text-zinc-600 hover:text-pink-300"} disabled={busy === `${post.id}:like`} onClick={() => onToggle(post.id, "like")} title={isLoggedIn ? "Like" : "Sign in to like"} type="button">{post.likedByViewer ? "♥" : "♡"} Like {post.likeCount > 0 ? post.likeCount : ""}</button>
    <button className={post.repostedByViewer ? "text-emerald-400" : "text-zinc-600 hover:text-emerald-300"} disabled={busy === `${post.id}:repost`} onClick={() => onToggle(post.id, "repost")} title={isLoggedIn ? "Repost" : "Sign in to repost"} type="button">↻ Repost {post.repostCount > 0 ? post.repostCount : ""}</button>
    <span className="text-zinc-700">{post.comments.length} {post.comments.length === 1 ? "reply" : "replies"}</span>
    {post.ownedByViewer && !post.highlightedUntil ? <button className="text-amber-400/70 hover:text-amber-300" disabled={busy === `${post.id}:highlight`} onClick={() => onHighlight(post.id)} title="Highlight for 24 hours" type="button">✦ Highlight · 2000 LP</button> : null}
    {post.likedByAdmin ? <span className="rounded-full border border-[#f4c06a]/25 bg-[#f4c06a]/10 px-2 py-1 text-[10px] text-[#f8dca8]">◆ Liked by Principessa</span> : null}
  </div>;
}

export function PrincipessaSocialFeed({ initialRecipientId = "", initialView = "home", isAdmin, isLoggedIn }: { initialRecipientId?: string; initialView?: PrincipessaFeedView; isAdmin: boolean; isLoggedIn: boolean }) {
  const [view] = useState<PrincipessaFeedView>(initialView);
  const [channel, setChannel] = useState<Channel>("principessa");
  const [posts, setPosts] = useState<PrincipessaFeedPost[]>([]);
  const [pendingPosts, setPendingPosts] = useState<PrincipessaFeedPost[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [commentBusy, setCommentBusy] = useState<string | null>(null);
  const [interactionBusy, setInteractionBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(initialView === "home");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState<FeedProfile | null>(null);
  const [profilePosts, setProfilePosts] = useState<PrincipessaFeedPost[]>([]);
  const [profileLoading, setProfileLoading] = useState(initialView === "profile" && isLoggedIn);
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [cropSource, setCropSource] = useState<File | null>(null);
  const [cropTarget, setCropTarget] = useState<CropTarget>("avatar");
  const avatarPreviewUrl = useFilePreview(avatarFile);
  const headerPreviewUrl = useFilePreview(headerFile);

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
    if (view !== "home") return;
    const controller = new AbortController();
    fetchPosts(channel, controller.signal).then(setPosts).catch((loadError: unknown) => { if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(loadError instanceof Error ? loadError.message : "Feed could not be loaded."); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [channel, view]);

  useEffect(() => {
    if (view !== "home" || !isAdmin || channel !== "sub") return;
    fetch("/api/admin/principessa-feed/moderation", { cache: "no-store" }).then(async (response) => { const result = (await response.json()) as { error?: string; posts?: PrincipessaFeedPost[] }; if (!response.ok) throw new Error(result.error); setPendingPosts(result.posts ?? []); }).catch((queueError: unknown) => setError(queueError instanceof Error ? queueError.message : "Queue failed."));
  }, [channel, isAdmin, view]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const controller = new AbortController();
    fetch(`/api/user/principessa-feed/profile?includePosts=${view === "profile" ? "true" : "false"}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as { posts?: PrincipessaFeedPost[]; profile?: FeedProfile };
        if (response.ok) { setProfile(result.profile ?? null); if (view === "profile") setProfilePosts(result.posts ?? []); }
      })
      .catch(() => undefined)
      .finally(() => {
        setProfileLoading(false);
      });
    return () => controller.abort();
  }, [isLoggedIn, view]);

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

  const beginCrop = (target: CropTarget, file?: File) => {
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type) || file.size > 8 * 1024 * 1024) {
      setError("Choose a JPG, PNG, WEBP or GIF image up to 8MB.");
      return;
    }
    setCropTarget(target); setCropSource(file); setError("");
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

  const pinOwnPost = async (postId: string) => {
    setError("");
    try {
      const response = await fetch("/api/user/principessa-feed/pin", { body: JSON.stringify({ postId }), headers: { "Content-Type": "application/json" }, method: "POST" });
      const result = await readJsonResponse<{ error?: string; pinned?: boolean; posts?: PrincipessaFeedPost[] }>(response);
      if (!response.ok) throw new Error(result.error ?? "Pin update failed.");
      setProfilePosts(result.posts ?? []); setNotice(result.pinned ? "Post pinned to your profile." : "Post unpinned.");
    } catch (pinError) { setError(pinError instanceof Error ? pinError.message : "Pin update failed."); }
  };

  const comment = async (postId: string) => {
    const body = String(drafts[postId] ?? "").trim(); if (!body) return; setCommentBusy(postId);
    try {
      const response = await fetch("/api/user/principessa-feed/comments", { body: JSON.stringify({ body, postId }), headers: { "Content-Type": "application/json" }, method: "POST" });
      const result = (await response.json()) as { comment?: { body: string; createdAt: string; id: string }; error?: string };
      if (!response.ok) throw new Error(result.error);
      setDrafts((current) => ({ ...current, [postId]: "" }));
      if (result.comment && profile) {
        const appendedComment: PrincipessaFeedPost["comments"][number] = {
          author: { avatarUrl: profile.avatarUrl, displayName: profile.displayName, username: profile.username },
          ...result.comment,
        };
        const append = (items: PrincipessaFeedPost[]) => items.map((post) => post.id === postId
          ? { ...post, comments: [...post.comments, appendedComment] }
          : post);
        setPosts(append);
        setProfilePosts(append);
      } else {
        await reload();
      }
    }
    catch (commentError) { setError(commentError instanceof Error ? commentError.message : "Comment failed."); } finally { setCommentBusy(null); }
  };

  const toggleInteraction = async (postId: string, action: "like" | "repost") => {
    if (!isLoggedIn) { setNotice("Sign in from Main Page to like or repost."); return; }
    const busyKey = `${postId}:${action}`;
    setInteractionBusy(busyKey); setError("");
    try {
      const response = await fetch("/api/user/principessa-feed/interactions", {
        body: JSON.stringify({ action, postId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await readJsonResponse<{ active?: boolean; count?: number; error?: string; likedByAdmin?: boolean }>(response);
      if (!response.ok) throw new Error(result.error ?? "Interaction failed.");
      const update = (items: PrincipessaFeedPost[]) => items.map((post) => post.id === postId ? {
        ...post,
        ...(action === "like"
          ? { likedByAdmin: result.likedByAdmin ?? post.likedByAdmin, likedByViewer: Boolean(result.active), likeCount: result.count ?? post.likeCount }
          : { repostedByViewer: Boolean(result.active), repostCount: result.count ?? post.repostCount }),
      } : post);
      setPosts(update); setProfilePosts(update);
    } catch (interactionError) {
      setError(interactionError instanceof Error ? interactionError.message : "Interaction failed.");
    } finally { setInteractionBusy(null); }
  };

  const highlightPost = async (postId: string) => {
    const busyKey = `${postId}:highlight`; setInteractionBusy(busyKey); setError("");
    try {
      const response = await fetch("/api/user/principessa-feed/highlight", { body: JSON.stringify({ postId }), headers: { "Content-Type": "application/json" }, method: "POST" });
      const result = await readJsonResponse<{ error?: string; highlightedUntil?: string }>(response);
      if (!response.ok || !result.highlightedUntil) throw new Error(result.error ?? "Highlight failed.");
      const update = (items: PrincipessaFeedPost[]) => items.map((post) => post.id === postId ? { ...post, highlightedUntil: result.highlightedUntil ?? null } : post);
      setPosts(update); setProfilePosts(update); setNotice("Post highlighted for 24 hours. 2000 LP was charged.");
    } catch (highlightError) { setError(highlightError instanceof Error ? highlightError.message : "Highlight failed."); }
    finally { setInteractionBusy(null); }
  };

  const moderate = async (postId: string, action: "approve" | "reject") => {
    const response = await fetch("/api/admin/principessa-feed/moderation", { body: JSON.stringify({ action, postId }), headers: { "Content-Type": "application/json" }, method: "POST" });
    const result = (await response.json()) as { error?: string; pendingPosts?: PrincipessaFeedPost[]; publishedPosts?: PrincipessaFeedPost[] };
    if (!response.ok) { setError(result.error ?? "Moderation failed."); return; }
    setPendingPosts(result.pendingPosts ?? []); setPosts(result.publishedPosts ?? []);
  };

  const viewCopy: Record<PrincipessaFeedView, { subtitle: string; title: string }> = {
    achievements: { subtitle: "Choose what enters the feed", title: "Share Achievement" },
    home: { subtitle: "Inside Principessa’s court", title: "The Velvet Network" },
    messages: { subtitle: "Private conversations", title: "Direct Messages" },
    notifications: { subtitle: "Mentions, replies and activity", title: "Notifications" },
    profile: { subtitle: "Your posts and private identity", title: "My Feed Profile" },
    search: { subtitle: "People and posts", title: "Search" },
  };

  return (
    <div className="relative mx-auto grid min-h-[calc(100vh-76px)] max-w-[1380px] grid-cols-1 bg-[#060206] lg:grid-cols-[240px_minmax(0,720px)_300px]">
      <div className="pointer-events-none fixed inset-y-[76px] right-0 -z-10 w-[46vw] bg-[url('/principessa-feed/branding/principessa-feed-hero.webp')] bg-cover bg-[65%_center] opacity-[0.1]" />
      <aside className="hidden border-r border-[#f4c06a]/10 p-5 lg:block"><div className="sticky top-[100px]"><FeedAvatar author={profile ? { avatarUrl: profile.avatarUrl, displayName: profile.displayName, username: profile.username } : undefined} empty large />{profile ? <DisplayNameWithUsername className="mt-5" displayName={profile.displayName} primaryClassName="truncate font-serif text-2xl text-[#ffe5b8]" secondaryClassName="mt-1 truncate text-xs text-zinc-600" username={profile.username} /> : <h1 className="mt-5 truncate font-serif text-2xl text-[#ffe5b8]">{isLoggedIn ? "Loading profile..." : "Guest"}</h1>}<div className="mt-4"><PrincipessaFeedNotifications active={view === "notifications"} isLoggedIn={isLoggedIn} /></div><nav className="mt-5 grid gap-2"><Link className={`rounded-2xl px-4 py-3 text-left font-black ${view === "home" ? "border border-[#f4c06a]/20 bg-pink-500/10 text-[#ffe5b8]" : "text-zinc-500 hover:bg-white/5"}`} href="/principessa-feed">⌂&nbsp;&nbsp; Home</Link>{isLoggedIn ? <Link className={`rounded-2xl px-4 py-3 text-left font-black ${view === "profile" ? "border border-[#f4c06a]/20 bg-pink-500/10 text-[#ffe5b8]" : "text-zinc-500 hover:bg-white/5"}`} href="/principessa-feed/profile">♙&nbsp;&nbsp; Profile</Link> : null}</nav><PrincipessaFeedSocialPanels activeView={view} isLoggedIn={isLoggedIn} /><p className="mt-8 border-l border-[#f4c06a]/30 pl-3 font-serif text-sm italic leading-6 text-zinc-600">A velvet room for Principessa’s official visions and approved offerings.</p></div></aside>

      <section className="min-w-0 border-x border-[#f4c06a]/10 bg-[#090509]/95 shadow-[0_0_50px_rgba(0,0,0,.5)]">
        <header className="sticky top-[76px] z-40 border-b border-[#f4c06a]/10 bg-[#090509]/92 backdrop-blur-xl"><div className="flex items-center justify-between px-4 py-3"><div><h1 className="font-serif text-xl text-[#ffe5b8]">{viewCopy[view].title}</h1><p className="text-[10px] uppercase tracking-[0.18em] text-pink-300/40">{viewCopy[view].subtitle}</p></div><div className="flex gap-2 lg:hidden"><Link className="rounded-full px-3 py-2 text-xs font-black text-zinc-500" href="/principessa-feed">Home</Link>{isLoggedIn ? <Link className="rounded-full px-3 py-2 text-xs font-black text-zinc-500" href="/principessa-feed/profile">Profile</Link> : null}</div></div>{view === "home" ? <div className="grid grid-cols-2">{(["principessa", "sub"] as const).map((item) => <button className="relative py-4 text-sm font-black capitalize text-zinc-500 hover:bg-white/[0.03]" key={item} onClick={() => switchChannel(item)} type="button">{item === "sub" ? "Subs" : item}{channel === item ? <span className="absolute inset-x-1/3 bottom-0 h-0.5 bg-gradient-to-r from-pink-500 via-[#f4c06a] to-pink-500 shadow-[0_0_12px_#ec4899]" /> : null}</button>)}</div> : null}</header>

        <div className="grid grid-cols-2 gap-2 border-b border-white/10 p-3 lg:hidden"><PrincipessaFeedNotifications active={view === "notifications"} isLoggedIn={isLoggedIn} /><PrincipessaFeedSocialPanels activeView={view} isLoggedIn={isLoggedIn} /></div>

        {view === "profile" ? (
          profileLoading ? <p className="p-16 text-center text-zinc-600">Opening your profile...</p> : profile ? <div>
            <div className="relative mb-16"><div className={`h-52 bg-cover bg-center sm:h-64 ${headerPreviewUrl || profile.headerUrl ? "" : "bg-[radial-gradient(circle_at_70%_20%,rgba(190,24,93,.18),transparent_35%),linear-gradient(135deg,#160815,#080408)]"}`} style={headerPreviewUrl || profile.headerUrl ? { backgroundImage: `linear-gradient(0deg,rgba(9,5,9,.72),transparent 60%),url(${headerPreviewUrl || profile.headerUrl})` } : undefined} /><div className="absolute -bottom-14 left-5"><FeedAvatar author={{ avatarUrl: avatarPreviewUrl || profile.avatarUrl, displayName: profile.displayName, username: profile.username }} empty large /></div>{headerFile ? <span className="absolute right-4 top-4 rounded-full bg-black/75 px-3 py-1 text-[10px] font-black text-pink-200">UNSAVED PREVIEW</span> : null}</div>
            <div className="px-5 pb-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-serif text-2xl text-[#ffe4b5]">{profile.displayName}</h2><p className="text-sm text-zinc-600">@{profile.username.replace(/^@/, "")}</p><p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-pink-300/50">{profilePosts.length} feed post{profilePosts.length === 1 ? "" : "s"}</p></div><div className="flex flex-wrap gap-2"><label className="cursor-pointer rounded-full border border-[#f4c06a]/20 px-4 py-2 text-xs font-black text-[#f8dca8]">{avatarFile ? "Re-crop photo" : "Change photo"}<input accept="image/gif,image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { beginCrop("avatar", event.target.files?.[0]); event.target.value = ""; }} type="file" /></label><label className="cursor-pointer rounded-full border border-[#f4c06a]/20 px-4 py-2 text-xs font-black text-[#f8dca8]">{headerFile ? "Re-crop header" : "Change header"}<input accept="image/gif,image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { beginCrop("header", event.target.files?.[0]); event.target.value = ""; }} type="file" /></label><button className="rounded-full bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-2 text-xs font-black disabled:opacity-40" disabled={profileSaving || (!avatarFile && !headerFile)} onClick={() => void saveProfile()} type="button">{profileSaving ? "Saving..." : "Save appearance"}</button></div></div>{avatarFile ? <p className="mt-3 text-xs text-pink-200/60">Profile photo preview is shown above. Save appearance to publish it.</p> : null}</div>
            {notice ? <p className="border-y border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">{notice}</p> : null}{error ? <p className="border-y border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</p> : null}
            <div className="border-y border-[#f4c06a]/10 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Your posts</div>
            {profilePosts.length ? profilePosts.map((post) => <article className={`border-b p-5 ${post.highlightedUntil ? "border-amber-300/30 bg-amber-400/[0.05]" : "border-[#f4c06a]/10"}`} key={post.id}><div className="flex gap-3"><FeedAvatar author={post.author} official={post.channel === "principessa"} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><DisplayNameWithUsername displayName={post.author.displayName} primaryClassName="font-black" secondaryClassName="text-xs text-zinc-600" secondaryStyle={post.author.usernameStyle} username={post.author.username} /><div className="flex gap-2">{post.pinned ? <span className="rounded-full border border-[#f4c06a]/20 px-2 py-0.5 text-[9px] font-black uppercase text-[#f4c06a]">Pinned</span> : null}<span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-black uppercase text-zinc-500">{post.status}</span></div></div><h3 className="mt-2 font-serif text-xl text-[#ffe4b5]">{post.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-300"><MentionText text={post.description} /></p><PostImages post={post} /></div></div>{post.status === "published" ? <PostInteractions busy={interactionBusy} isLoggedIn={isLoggedIn} onHighlight={highlightPost} onToggle={toggleInteraction} post={post} /> : null}{isAdmin && post.channel === "principessa" ? <PostAdminActions onChanged={setProfilePosts} post={post} /> : post.channel === "sub" ? <div className="ml-14 mt-3 flex gap-3"><button className={post.pinned ? "text-xs font-black text-[#f4c06a]" : "text-xs font-black text-zinc-500 hover:text-[#f4c06a]"} onClick={() => void pinOwnPost(post.id)} type="button">{post.pinned ? "Unpin" : "Pin to profile"}</button><button className="text-xs font-black text-red-300/70 hover:text-red-300" onClick={() => void deleteOwnSubPost(post)} type="button">Delete post</button></div> : null}</article>) : <p className="p-16 text-center text-zinc-600">Your submitted posts will appear here.</p>}
          </div> : <p className="p-16 text-center text-sm text-zinc-500">Sign in from Main Page to open your feed profile.</p>
        ) : view === "search" ? <PrincipessaFeedSearchPage isLoggedIn={isLoggedIn} />
          : view === "notifications" ? <PrincipessaFeedNotificationsPage isLoggedIn={isLoggedIn} />
          : view === "messages" ? <PrincipessaFeedMessagesPage initialRecipientId={initialRecipientId} isLoggedIn={isLoggedIn} />
          : view === "achievements" ? <PrincipessaFeedAchievementsPage isLoggedIn={isLoggedIn} />
          : <>
            <div className="relative h-48 overflow-hidden border-b border-[#f4c06a]/10 sm:h-56"><div className="absolute inset-0 bg-[url('/principessa-feed/branding/principessa-feed-hero.webp')] bg-cover bg-[center_28%]" /><div className="absolute inset-0 bg-gradient-to-r from-[#090509] via-[#090509]/30 to-transparent" /><div className="absolute inset-0 bg-gradient-to-t from-[#090509] via-transparent to-transparent" /><div className="absolute bottom-5 left-5 max-w-sm"><p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#f4c06a]">The court is open</p><h2 className="mt-1 font-serif text-3xl">Principessa has entered.</h2><p className="mt-1 text-sm text-zinc-300/70">Official visions, private moments and offerings worthy of the feed.</p></div></div>
        {channel === "principessa" && isAdmin ? <AdminComposer onPublished={setPosts} /> : null}
        {channel === "sub" && isLoggedIn ? <SubComposer onSubmitted={setNotice} /> : null}
        {channel === "sub" && !isLoggedIn ? <p className="border-b border-white/10 p-4 text-sm text-zinc-500">Sign in from Main Page to submit or comment.</p> : null}
        {channel === "sub" && isAdmin && pendingPosts.length > 0 ? <section className="border-b border-amber-300/20 bg-amber-400/[0.04]"><div className="flex items-center justify-between p-4"><h2 className="font-black text-amber-100">Approval queue</h2><span className="rounded-full bg-amber-300 px-2 py-0.5 text-xs font-black text-black">{pendingPosts.length}</span></div>{pendingPosts.map((post) => <article className="border-t border-amber-300/10 p-4" key={post.id}><DisplayNameWithUsername displayName={post.author.displayName} primaryClassName="text-sm font-black text-amber-200" secondaryClassName="text-xs text-zinc-600" secondaryStyle={post.author.usernameStyle} username={post.author.username} />{post.postType === "confession" ? <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-fuchsia-300">Confession · identity visible only to Principessa</p> : null}<h3 className="mt-2 font-black">{post.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-300"><MentionText text={post.description} /></p><PostImages post={post} /><div className="mt-3 grid grid-cols-2 gap-2"><button className="rounded-full bg-emerald-500 py-2 text-xs font-black text-black" onClick={() => void moderate(post.id, "approve")} type="button">Approve</button><button className="rounded-full border border-red-400/30 py-2 text-xs font-black text-red-300" onClick={() => void moderate(post.id, "reject")} type="button">Reject</button></div></article>)}</section> : null}
        {notice ? <p className="border-b border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">{notice}</p> : null}
        {error ? <p className="border-b border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</p> : null}

        {loading ? <p className="p-16 text-center text-zinc-600">Loading feed...</p> : posts.length === 0 ? <div className="p-16 text-center"><p className="text-lg font-black">No posts yet.</p><p className="mt-2 text-sm text-zinc-600">Published posts will appear here.</p></div> : posts.map((post) => (
          <article className={`border-b p-4 transition ${post.highlightedUntil ? "border-amber-300/30 bg-[linear-gradient(135deg,rgba(251,191,36,.11),rgba(236,72,153,.06))] shadow-[inset_3px_0_0_#f4c06a]" : "border-white/10 hover:bg-white/[0.015]"}`} key={post.id}>
            <div className="flex gap-3"><FeedAvatar author={post.author} official={post.channel === "principessa"} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><DisplayNameWithUsername displayName={post.author.displayName} primaryClassName="font-black text-white" secondaryClassName="text-xs text-zinc-600" secondaryStyle={post.author.usernameStyle} username={post.author.username} /><div className="mt-1 flex flex-wrap items-center gap-2"><span className={post.channel === "principessa" ? "text-[10px] font-black uppercase text-pink-400" : "text-[10px] font-black uppercase text-zinc-600"}>{post.channel === "principessa" ? "◆ Official court" : "Approved Sub"}</span>{post.pinned ? <span className="text-[10px] font-black uppercase text-[#f4c06a]">⌖ Pinned</span> : null}{post.postType === "confession" ? <span className="text-[10px] font-black uppercase text-fuchsia-300">◐ Confession</span> : null}{post.postType === "achievement" ? <span className="text-[10px] font-black uppercase text-amber-300">◇ Achievement</span> : null}{post.highlightedUntil ? <span className="text-[10px] font-black uppercase text-amber-300">✦ Highlighted</span> : null}</div></div><span className="shrink-0 text-[10px] text-zinc-700">{formatDate(post.createdAt)}</span></div><h2 className="mt-2 font-serif text-xl text-[#ffe4b5]">{post.title}</h2><p className="mt-1 whitespace-pre-wrap text-[15px] leading-6 text-zinc-300"><MentionText text={post.description} /></p><PostImages post={post} /></div></div>
            {isLoggedIn && post.author.userId && !post.ownedByViewer ? <div className="ml-14 mt-3"><Link className="inline-flex items-center gap-2 rounded-full border border-pink-300/15 px-3 py-1.5 text-[10px] font-black text-pink-200 transition hover:bg-pink-500/10" href={`/principessa-feed/messages?to=${encodeURIComponent(post.author.userId)}`}>✉ Message</Link></div> : null}
            <PostInteractions busy={interactionBusy} isLoggedIn={isLoggedIn} onHighlight={highlightPost} onToggle={toggleInteraction} post={post} />
            {isAdmin ? <PostAdminActions onChanged={setPosts} post={post} /> : null}
            {post.comments.length > 0 ? <div className="ml-14 mt-3 grid gap-3 border-l border-white/10 pl-3">{post.comments.map((item) => <div key={item.id}><div className="flex justify-between gap-2"><DisplayNameWithUsername displayName={item.author.displayName} primaryClassName="text-xs font-black text-zinc-300" secondaryClassName="text-[10px] text-zinc-600" secondaryStyle={item.author.usernameStyle} username={item.author.username} /><span className="text-[10px] text-zinc-700">{formatDate(item.createdAt)}</span></div><p className="mt-1 text-sm text-zinc-400"><MentionText text={item.body} /></p></div>)}</div> : null}
            {isLoggedIn ? <div className="ml-14 mt-4 flex gap-2"><input className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm outline-none focus:border-pink-400/40" maxLength={500} onChange={(e) => setDrafts((current) => ({ ...current, [post.id]: e.target.value }))} placeholder="Post your reply" value={drafts[post.id] ?? ""} /><button className="rounded-full bg-pink-500 px-4 py-2 text-xs font-black disabled:opacity-40" disabled={commentBusy === post.id || !String(drafts[post.id] ?? "").trim()} onClick={() => void comment(post.id)} type="button">Reply</button></div> : null}
          </article>
        ))}
        </>}
      </section>

      <aside className="hidden p-5 lg:block"><div className="sticky top-[100px] space-y-4"><section className="overflow-hidden rounded-3xl border border-[#f4c06a]/15 bg-[#120813]/80"><div className="h-28 bg-[url('/principessa-feed/branding/principessa-feed-hero.webp')] bg-cover bg-[center_28%] opacity-70" /><div className="p-4"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#f4c06a]">House rules</p><ol className="mt-3 grid gap-3 text-sm text-zinc-500"><li><b className="text-zinc-300">One image.</b> Subs may attach a single offering.</li><li><b className="text-zinc-300">80 / 500.</b> Title and post limits stay concise.</li><li><b className="text-zinc-300">Approval.</b> Every Sub post enters the queue.</li></ol></div></section><section className="rounded-3xl border border-pink-300/10 bg-pink-500/[0.04] p-4 font-serif text-sm italic leading-6 text-pink-100/60">Principessa posts may hold up to eight images. Her court, her rules.</section></div></aside>
      {cropSource ? <ImageCropEditor file={cropSource} onApply={(file) => { if (cropTarget === "avatar") setAvatarFile(file); else setHeaderFile(file); setCropSource(null); }} onCancel={() => setCropSource(null)} target={cropTarget} /> : null}
    </div>
  );
}
