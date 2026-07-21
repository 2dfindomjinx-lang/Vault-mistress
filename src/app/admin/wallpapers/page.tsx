"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WallpaperCropTool } from "@/components/admin/WallpaperCropTool";
import { cropWallpaperImage } from "@/lib/wallpaper-crop";

type Device = {
  id: string;
  activation_code: string;
  status: string;
  owner_name: string | null;
  bound_device_label: string | null;
  bound_at: string | null;
  last_validated_at: string | null;
  favorite_kink: "BNWO" | "Censored" | "Femdom" | "All" | null;
};

type Assignment = {
  id: string;
  activation_id: string | null;
  scope: "global" | "device";
  wallpaper_url: string;
  version: string;
  created_at: string;
};

type WallpaperAsset = {
  id: string;
  object_key: string;
  wallpaper_url: string;
  version: string;
  created_at: string;
};

type LiveMessage = {
  id: string;
  activation_id: string | null;
  scope: "global" | "device";
  message: string;
  version: string;
  sender_role: "admin" | "sub";
  active: boolean;
  created_at: string;
};

type WallpaperEvent = {
  id: string;
  activation_id: string;
  event_type: "wallpaper_changed";
  changed_scopes: string[];
  system_wallpaper_id: number | null;
  lock_wallpaper_id: number | null;
  created_at: string;
};

type AdminState = {
  devices?: Device[];
  assignments?: Assignment[];
  messages?: LiveMessage[];
  events?: WallpaperEvent[];
  library?: WallpaperAsset[];
  error?: string;
};

type PreparedUpload = {
  uploadUrl: string;
  objectKey: string;
  wallpaperUrl: string;
  version: string;
  error?: string;
};

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const shortCode = (value: string) =>
  value.length > 9 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value;

const DAY_MS = 24 * 60 * 60 * 1000;

const devicePresence = (device: Device) => {
  const seenAt = device.last_validated_at ?? device.bound_at;
  const ageDays = seenAt
    ? Math.max(0, (Date.now() - new Date(seenAt).getTime()) / DAY_MS)
    : 0;
  if (ageDays >= 14) {
    return { hidden: true, label: "Muhtemelen kaldırıldı" };
  }
  if (ageDays >= 7) {
    return { hidden: true, label: "Uzun süredir görülmedi" };
  }
  if (ageDays >= 3) {
    return { hidden: false, label: "Pasif" };
  }
  return { hidden: false, label: "Aktif" };
};

export default function WallpaperAdminPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [events, setEvents] = useState<WallpaperEvent[]>([]);
  const [library, setLibrary] = useState<WallpaperAsset[]>([]);
  const [target, setTarget] = useState("global");
  const [file, setFile] = useState<File | null>(null);
  const [cropPanX, setCropPanX] = useState(0.5);
  const [cropPanY, setCropPanY] = useState(0.5);
  const [liveMessage, setLiveMessage] = useState("");
  const [status, setStatus] = useState("");
  const [isBusy, setIsBusy] = useState(true);
  const [showHiddenDevices, setShowHiddenDevices] = useState(false);

  const selectedDevice = devices.find((device) => device.id === target) ?? null;
  const hiddenDeviceCount = devices.filter((device) => devicePresence(device).hidden).length;
  const listedDevices = devices.filter(
    (device) => showHiddenDevices || !devicePresence(device).hidden,
  );
  const visibleDeviceCount = devices.length - hiddenDeviceCount;
  const globalAssignment = assignments.find((item) => item.scope === "global") ?? null;
  const directAssignment =
    target === "global"
      ? globalAssignment
      : assignments.find((item) => item.activation_id === target) ?? null;
  const effectiveAssignment = directAssignment ?? globalAssignment;
  const visibleMessages = messages
    .filter((item) =>
      target === "global"
        ? item.scope === "global"
        : item.scope === "global" || item.activation_id === target,
    )
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const deviceById = useMemo(
    () => new Map(devices.map((device) => [device.id, device])),
    [devices],
  );
  const visibleEvents =
    target === "global"
      ? events
      : events.filter((event) => event.activation_id === target);

  const targetTitle =
    target === "global"
      ? "Tüm cihazlar"
      : selectedDevice?.owner_name || selectedDevice?.bound_device_label || "Seçili cihaz";
  const targetDescription =
    target === "global"
      ? `${visibleDeviceCount} görünür · ${devices.length} toplam bağlı cihaz`
      : `${selectedDevice?.bound_device_label || "Bilinmeyen cihaz"} · ${selectedDevice?.activation_code || ""} · Favori kink: ${selectedDevice?.favorite_kink || "Seçilmedi"}`;

  const applyState = (result: AdminState) => {
    setDevices(result.devices ?? []);
    setAssignments(result.assignments ?? []);
    setMessages(result.messages ?? []);
    setEvents(result.events ?? []);
    setLibrary(result.library ?? []);
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/wallpapers", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as AdminState;
        if (!response.ok) throw new Error(result.error ?? "Panel verileri alınamadı.");
        if (!cancelled) {
          setDevices(result.devices ?? []);
          setAssignments(result.assignments ?? []);
          setMessages(result.messages ?? []);
          setEvents(result.events ?? []);
          setLibrary(result.library ?? []);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Panel verileri alınamadı.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      fetch("/api/admin/wallpapers", { cache: "no-store" })
        .then(async (response) => {
          const result = (await response.json()) as AdminState;
          if (response.ok) applyState(result);
        })
        .catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(interval);
  }, []);

  const refresh = async () => {
    setIsBusy(true);
    setStatus("Veriler yenileniyor…");
    try {
      const response = await fetch("/api/admin/wallpapers", { cache: "no-store" });
      const result = (await response.json()) as AdminState;
      if (!response.ok) throw new Error(result.error ?? "Panel verileri alınamadı.");
      applyState(result);
      setStatus("Panel güncellendi.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Panel verileri alınamadı.");
    } finally {
      setIsBusy(false);
    }
  };

  const uploadAndAssign = async () => {
    if (!file) {
      setStatus("Önce bir görsel seç.");
      return;
    }

    setIsBusy(true);
    setStatus("Görsel kırpılıyor…");
    try {
      const croppedBlob = await cropWallpaperImage(file, cropPanX, cropPanY);

      setStatus("Yükleme hazırlanıyor…");
      const prepareResponse = await fetch("/api/admin/wallpapers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare-upload", contentType: croppedBlob.type }),
      });
      const prepared = (await prepareResponse.json()) as PreparedUpload;
      if (!prepareResponse.ok) throw new Error(prepared.error ?? "Yükleme hazırlanamadı.");

      setStatus("Görsel R2'ye yükleniyor…");
      const uploadResponse = await fetch(prepared.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": croppedBlob.type },
        body: croppedBlob,
      });
      if (!uploadResponse.ok) {
        throw new Error(`R2 yüklemesi HTTP ${uploadResponse.status} hatası verdi.`);
      }

      setStatus("Duvar kâğıdı uygulanıyor…");
      const assignResponse = await fetch("/api/admin/wallpapers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          activationId: target === "global" ? null : target,
          objectKey: prepared.objectKey,
          wallpaperUrl: prepared.wallpaperUrl,
          version: prepared.version,
        }),
      });
      const assigned = (await assignResponse.json()) as AdminState;
      if (!assignResponse.ok) throw new Error(assigned.error ?? "Duvar kâğıdı uygulanamadı.");

      applyState(assigned);
      setFile(null);
      setCropPanX(0.5);
      setCropPanY(0.5);
      const input = document.getElementById("wallpaper-file") as HTMLInputElement | null;
      if (input) input.value = "";
      setStatus(`${targetTitle} için yeni duvar kâğıdı uygulandı.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Duvar kâğıdı yüklenemedi.");
    } finally {
      setIsBusy(false);
    }
  };

  const reuseWallpaper = async (asset: WallpaperAsset) => {
    setIsBusy(true);
    setStatus("Kütüphanedeki görsel uygulanıyor…");
    try {
      const response = await fetch("/api/admin/wallpapers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reuse",
          activationId: target === "global" ? null : target,
          assignmentId: asset.id,
        }),
      });
      const result = (await response.json()) as AdminState;
      if (!response.ok) throw new Error(result.error ?? "Görsel yeniden uygulanamadı.");
      applyState(result);
      setStatus(`${targetTitle} için kütüphanedeki görsel uygulandı.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Görsel yeniden uygulanamadı.");
    } finally {
      setIsBusy(false);
    }
  };

  const resetToDefaultWallpaper = async () => {
    if (target === "global") {
      return;
    }

    setIsBusy(true);
    setStatus("Varsayılan duvar kâğıdına döndürülüyor…");
    try {
      const response = await fetch("/api/admin/wallpapers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-to-default", activationId: target }),
      });
      const result = (await response.json()) as AdminState;
      if (!response.ok) throw new Error(result.error ?? "Varsayılana döndürülemedi.");
      applyState(result);
      setStatus(`${targetTitle} artık varsayılan (global) duvar kâğıdını kullanıyor.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Varsayılana döndürülemedi.");
    } finally {
      setIsBusy(false);
    }
  };

  const updateLiveMessage = async (action: "send-message" | "clear-message") => {
    if (action === "send-message" && !liveMessage.trim()) {
      setStatus("Önce bir mesaj yaz.");
      return;
    }

    setIsBusy(true);
    setStatus(action === "send-message" ? "Mesaj gönderiliyor…" : "Mesaj kaldırılıyor…");
    try {
      const response = await fetch("/api/admin/wallpapers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          activationId: target === "global" ? null : target,
          message: liveMessage,
        }),
      });
      const result = (await response.json()) as AdminState;
      if (!response.ok) throw new Error(result.error ?? "Mesaj işlemi başarısız oldu.");
      applyState(result);
      if (action === "send-message") setLiveMessage("");
      setStatus(action === "send-message" ? "Canlı mesaj gönderildi." : "Canlı mesaj kaldırıldı.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Mesaj işlemi başarısız oldu.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="border-b border-white/[0.07] bg-[#0d0d10] lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0">
          <div className="flex h-full flex-col">
            <div className="border-b border-white/[0.07] px-5 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-pink-400">
                Principessa
              </p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight">Wallpaper Control</h1>
            </div>

            <nav className="min-h-0 flex-1 p-3 lg:overflow-y-auto" aria-label="Cihazlar">
              <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
                Cihazlar
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible">
                <TargetButton
                  active={target === "global"}
                  label="Tüm cihazlar"
                  meta={`${visibleDeviceCount} görünür cihaz`}
                  onClick={() => setTarget("global")}
                />
                {listedDevices.map((device) => {
                  const presence = devicePresence(device);
                  return (
                    <TargetButton
                      active={target === device.id}
                      key={device.id}
                      label={device.owner_name || device.bound_device_label || "İsimsiz cihaz"}
                      meta={`${device.bound_device_label || shortCode(device.activation_code)} · ${presence.label}${device.favorite_kink ? ` · ${device.favorite_kink}` : ""}`}
                      onClick={() => setTarget(device.id)}
                    />
                  );
                })}
              </div>
              {hiddenDeviceCount > 0 && (
                <button
                  className="mt-3 w-full rounded-xl border border-white/[0.06] px-3 py-2 text-left text-xs text-zinc-500 transition hover:bg-white/[0.03] hover:text-zinc-300"
                  onClick={() => setShowHiddenDevices((current) => !current)}
                  type="button"
                >
                  {showHiddenDevices
                    ? "Gizlenen cihazları kapat"
                    : `Gizlenen cihazları göster (${hiddenDeviceCount})`}
                </button>
              )}
            </nav>

            <div className="hidden border-t border-white/[0.07] p-3 lg:grid lg:gap-1">
              <Link className="rounded-xl px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.04] hover:text-white" href="/admin">
                Admin Console
              </Link>
              <Link className="rounded-xl px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.04] hover:text-white" href="/admin/analytics">
                Analytics
              </Link>
              <Link className="rounded-xl px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.04] hover:text-white" href="/admin/app-licenses">
                Aktivasyon kodları
              </Link>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-4 border-b border-white/[0.07] bg-[#09090b]/90 px-4 py-4 backdrop-blur-xl sm:px-7">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.7)]" />
                <h2 className="truncate text-base font-semibold sm:text-lg">{targetTitle}</h2>
              </div>
              <p className="mt-1 truncate text-xs text-zinc-500">{targetDescription}</p>
            </div>
            <button
              className="shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.07] disabled:opacity-50"
              disabled={isBusy}
              onClick={() => void refresh()}
              type="button"
            >
              Yenile
            </button>
          </header>

          <div className="mx-auto max-w-[92rem] p-4 sm:p-7">
            {status && (
              <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-pink-400/15 bg-pink-400/[0.06] px-4 py-3 text-sm text-pink-100">
                <span>{status}</span>
                <button className="text-pink-300/60 hover:text-pink-200" onClick={() => setStatus("")} type="button" aria-label="Bildirimi kapat">
                  ×
                </button>
              </div>
            )}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)]">
              <article className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111114]">
                <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold">Aktif duvar kâğıdı</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {!directAssignment && target !== "global" && effectiveAssignment
                        ? "Global duvar kâğıdı kullanılıyor"
                        : "Bu hedefe doğrudan atanmış"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {target !== "global" && directAssignment && (
                      <button
                        className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-pink-400/25 hover:bg-pink-400/[0.08] hover:text-pink-100 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={isBusy}
                        onClick={() => void resetToDefaultWallpaper()}
                        type="button"
                      >
                        Varsayılana döndür
                      </button>
                    )}
                    {effectiveAssignment && (
                      <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                        Aktif
                      </span>
                    )}
                  </div>
                </div>
                {effectiveAssignment ? (
                  <div className="relative min-h-64 flex-1 overflow-hidden bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt="Aktif duvar kâğıdı"
                      className="h-full w-full object-cover"
                      src={effectiveAssignment.wallpaper_url}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-5 pb-4 pt-16">
                      <p className="text-xs text-zinc-300">
                        {dateTime(effectiveAssignment.created_at)} tarihinde atandı
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-64 flex-1 items-center justify-center bg-white/[0.015] px-6 text-center text-sm text-zinc-600">
                    Bu hedef için henüz bir duvar kâğıdı yok.
                  </div>
                )}
              </article>

              <div className="grid gap-5">
                <article className="rounded-2xl border border-white/[0.08] bg-[#111114] p-5">
                  <p className="text-sm font-semibold">Yeni görsel yükle</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    JPG, PNG veya WebP seç (kare görseller de olur). Görsel {targetTitle} için uygulanır.
                  </p>
                  <label
                    className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-4 text-center transition hover:border-pink-400/30 hover:bg-pink-400/[0.03]"
                    htmlFor="wallpaper-file"
                  >
                    <span className="text-sm font-medium text-zinc-300">
                      {file ? file.name : "Görsel seç"}
                    </span>
                    <span className="mt-1 text-xs text-zinc-600">
                      {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "Dosyayı buradan seçebilirsin"}
                    </span>
                  </label>
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={isBusy}
                    id="wallpaper-file"
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                      setCropPanX(0.5);
                      setCropPanY(0.5);
                    }}
                    type="file"
                  />
                  {file && (
                    <div className="mt-4 flex justify-center rounded-xl border border-white/[0.07] bg-black/20 p-3">
                      <WallpaperCropTool
                        file={file}
                        onPanChange={(nextPanX, nextPanY) => {
                          setCropPanX(nextPanX);
                          setCropPanY(nextPanY);
                        }}
                        panX={cropPanX}
                        panY={cropPanY}
                      />
                    </div>
                  )}
                  <button
                    className="mt-3 w-full rounded-xl bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={isBusy || !file}
                    onClick={() => void uploadAndAssign()}
                    type="button"
                  >
                    Yükle ve uygula
                  </button>
                </article>

                <article className="rounded-2xl border border-white/[0.08] bg-[#111114] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">Live Chat</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Mesaj geçmişi saklanır; sub seçili cihazdan cevap verebilir.
                      </p>
                    </div>
                    <span className="rounded-full bg-sky-400/10 px-2 py-1 text-[10px] font-semibold text-sky-300">
                      {visibleMessages.length} mesaj
                    </span>
                  </div>
                  <div className="mt-4 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-white/[0.07] bg-black/20 p-3">
                    {visibleMessages.length > 0 ? (
                      visibleMessages.slice(-100).map((item) => (
                        <div
                          className={`flex ${item.sender_role === "admin" ? "justify-end" : "justify-start"}`}
                          key={item.id}
                        >
                          <div
                            className={`max-w-[88%] rounded-2xl px-3 py-2 ${
                              item.sender_role === "admin"
                                ? "rounded-br-md bg-pink-500/20 text-pink-50"
                                : "rounded-bl-md bg-white/[0.07] text-zinc-100"
                            }`}
                          >
                            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                              <span>{item.sender_role === "admin" ? "Principessa" : "Sub"}</span>
                              {item.scope === "global" && <span>Global</span>}
                            </div>
                            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5">{item.message}</p>
                            <time className="mt-1 block text-[9px] text-zinc-600">{dateTime(item.created_at)}</time>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="py-8 text-center text-xs text-zinc-600">Henüz mesaj yok.</p>
                    )}
                  </div>
                  {target === "global" && (
                    <div className="mt-3 rounded-lg border border-amber-400/10 bg-amber-400/[0.04] px-3 py-2 text-[10px] leading-4 text-amber-200/70">
                      Global mesaj tüm cihazlara gider. Sub cevaplarını görmek için soldan cihaz seç.
                    </div>
                  )}
                  <textarea
                    className="mt-4 min-h-20 w-full resize-none rounded-xl border border-white/[0.09] bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-pink-400/40"
                    disabled={isBusy}
                    maxLength={240}
                    onChange={(event) => setLiveMessage(event.target.value)}
                    placeholder={target === "global" ? "Tüm cihazlara mesaj yaz…" : "Sub'a cevap yaz…"}
                    value={liveMessage}
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-[10px] text-zinc-600">{liveMessage.length}/240</span>
                    <button
                      className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
                      disabled={isBusy || !liveMessage.trim()}
                      onClick={() => void updateLiveMessage("send-message")}
                      type="button"
                    >
                      Gönder
                    </button>
                  </div>
                </article>
              </div>
            </div>

            <section className="mt-5 rounded-2xl border border-white/[0.08] bg-[#111114]">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold">Görsel kütüphanesi</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Daha önce yüklenen R2 görsellerini tekrar yüklemeden kullan.
                  </p>
                </div>
                <span className="text-xs text-zinc-600">{library.length} görsel</span>
              </div>
              {library.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
                  {library.map((asset) => {
                    const isActive = effectiveAssignment?.wallpaper_url === asset.wallpaper_url;
                    return (
                      <article
                        className="group overflow-hidden rounded-xl border border-white/[0.07] bg-black/20"
                        key={asset.object_key}
                      >
                        <div className="relative aspect-[4/5] overflow-hidden bg-black">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt=""
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                            loading="lazy"
                            src={asset.wallpaper_url}
                          />
                          {isActive && (
                            <span className="absolute left-2 top-2 rounded-full bg-emerald-400 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-950">
                              Aktif
                            </span>
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="truncate text-[10px] text-zinc-600">{dateTime(asset.created_at)}</p>
                          <button
                            className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-xs font-medium text-zinc-300 transition hover:border-pink-400/25 hover:bg-pink-400/[0.08] hover:text-pink-100 disabled:opacity-35"
                            disabled={isBusy || isActive}
                            onClick={() => void reuseWallpaper(asset)}
                            type="button"
                          >
                            {isActive ? "Kullanılıyor" : "Bu görseli kullan"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="px-5 py-10 text-center text-sm text-zinc-600">
                  İlk görselini yüklediğinde burada görünecek.
                </p>
              )}
            </section>

            <section className="mt-5 rounded-2xl border border-white/[0.08] bg-[#111114]">
              <div className="flex items-end justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold">Son hareketler</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {target === "global" ? "Tüm cihazların" : "Seçili cihazın"} duvar kâğıdı değişiklikleri
                  </p>
                </div>
                <span className="text-xs text-zinc-600">{visibleEvents.length} kayıt</span>
              </div>
              <div className="divide-y divide-white/[0.06] px-5">
                {visibleEvents.length > 0 ? (
                  visibleEvents.slice(0, 20).map((event) => {
                    const device = deviceById.get(event.activation_id);
                    return (
                      <article className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between" key={event.id}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-200">
                            {device?.owner_name || device?.bound_device_label || "Bilinmeyen cihaz"}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {event.changed_scopes.join(" ve ")} duvar kâğıdı değiştirildi
                          </p>
                        </div>
                        <div className="shrink-0 text-left sm:text-right">
                          <time className="text-xs text-zinc-600">{dateTime(event.created_at)}</time>
                          <p className="mt-1 text-[10px] text-zinc-700">
                            Sistem #{event.system_wallpaper_id ?? "?"} · Kilit #{event.lock_wallpaper_id ?? "?"}
                          </p>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <p className="py-10 text-center text-sm text-zinc-600">Henüz raporlanan bir değişiklik yok.</p>
                )}
              </div>
            </section>

            <div className="mt-5 flex gap-4 px-1 text-xs text-zinc-600 lg:hidden">
              <Link className="hover:text-zinc-300" href="/admin">Admin paneli</Link>
              <Link className="hover:text-zinc-300" href="/admin/analytics">Analytics</Link>
              <Link className="hover:text-zinc-300" href="/admin/app-licenses">Aktivasyon kodları</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function TargetButton({
  active,
  label,
  meta,
  onClick,
}: {
  active: boolean;
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`min-w-48 rounded-xl border px-3 py-3 text-left transition lg:min-w-0 ${
        active
          ? "border-pink-400/20 bg-pink-400/[0.09]"
          : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.03]"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-pink-400" : "bg-emerald-400"}`} />
        <span className={`truncate text-sm font-medium ${active ? "text-pink-100" : "text-zinc-300"}`}>
          {label}
        </span>
      </span>
      <span className="mt-1 block truncate pl-3.5 text-[10px] text-zinc-600">{meta}</span>
    </button>
  );
}
