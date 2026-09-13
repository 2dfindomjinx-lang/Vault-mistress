"use client";

import { useEffect, type RefObject } from "react";
import { emitSoundEvent, type SoundEventName } from "./sound";

/** A material sound lasts only while its owning animation is active. */
export function useSoundLoop(event: SoundEventName, active: boolean) {
  useEffect(() => {
    if (!active) return;
    let stop: (() => void) | undefined;
    const sync = () => {
      stop?.();
      stop = document.hidden ? undefined : emitSoundEvent(event, { loop: true });
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    const settingsChanged = () => { if (!stop) sync(); };
    window.addEventListener("vault:sound-settings-changed", settingsChanged);
    return () => { stop?.(); document.removeEventListener("visibilitychange", sync); window.removeEventListener("vault:sound-settings-changed", settingsChanged); };
  }, [active, event]);
}

/** Read the rendered rotation: easing, slowdown and reduced motion stay in sync. */
export function useWheelSound(ref: RefObject<HTMLElement | null>, active: boolean, segments: number) {
  useEffect(() => {
    const node = ref.current;
    if (!active || !node || segments < 1) return;
    let frame = 0, previous: number | undefined, travel = 0, boundary = 0;
    const tick = () => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
      const angle = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
      if (previous !== undefined && !document.hidden) {
        travel += ((angle - previous + 540) % 360) - 180;
        const next = Math.floor(travel / (360 / segments));
        if (next !== boundary) { boundary = next; emitSoundEvent("wheel_tick"); }
      }
      previous = angle;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, ref, segments]);
}
