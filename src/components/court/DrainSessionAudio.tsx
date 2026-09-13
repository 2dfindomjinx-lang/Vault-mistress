"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Mounted only during a Drain Session: each session starts with sound off. */
export function DrainSessionAudio({ volume = 1, muted = false }: { volume?: number; muted?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef(0);
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);
  const playbackVolume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;

  const stop = useCallback(() => {
    requestRef.current++;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setEnabled(false);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- invalidate the latest play request, not a captured render or DOM ref
      requestRef.current++;
      const audio = audioRef.current;
      if (audio) {
        audio.onerror = null;
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      audioRef.current = null;
    };
  }, [stop]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = playbackVolume;
      audioRef.current.muted = muted;
    }
  }, [playbackVolume, muted]);

  const toggle = () => {
    if (enabled) {
      stop();
      return;
    }
    // Create and play within the user's click, with no download before opt-in.
    const audio = audioRef.current ?? new Audio("/sounds/drain_session.mp3");
    // eslint-disable-next-line react-hooks/immutability -- this ref owns a mutable HTMLMediaElement, not immutable React data
    audio.loop = true;
    audio.volume = playbackVolume;
    audio.muted = muted;
    const request = ++requestRef.current;
    const handleFailure = () => {
      if (request !== requestRef.current) return;
      stop();
      setFailed(true);
    };
    audio.onerror = handleFailure;
    // Reload a failed source so the same button can retry a network error.
    if (audio.error) audio.load();
    audioRef.current = audio;
    setFailed(false);
    setEnabled(true);
    void audio.play().catch(handleFailure);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        aria-label="Drain session sound"
        aria-pressed={enabled}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition ${enabled ? "border-rose-200/30 bg-rose-500/15 text-rose-100" : "border-white/15 bg-black/20 text-zinc-400 hover:border-rose-200/30 hover:text-rose-100"}`}
        onClick={toggle}
        type="button"
      >
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          {enabled ? <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /> : <path d="m16 9 5 6m0-6-5 6" />}
        </svg>
        Sound {enabled ? "on" : "off"}
      </button>
      {enabled && (muted || playbackVolume === 0) && <span className="text-xs text-zinc-400">Site sound is muted.</span>}
      {failed && <span role="status" className="text-xs text-rose-200">Sound unavailable. Try again.</span>}
    </div>
  );
}
