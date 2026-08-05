// "Drain Session": an opt-in, user-started/stopped visual coin sink. While
// active, a fixed coins-per-second rate ticks away in real time on screen,
// cycling through the viewer's own unlocked Shrine Memories. Pure sink - no
// reward, no devotion, no pet score - the point is watching the balance melt
// while looking at something, not earning anything back.
export const DRAIN_SESSION_MIN_RATE = 100;
export const DRAIN_SESSION_MAX_RATE = 5_000;
export const DRAIN_SESSION_DEFAULT_RATE = 100;
export const DRAIN_SESSION_TICK_MS = 1_000;
// A new floating image spawns this often; each one lives for
// DRAIN_SESSION_IMAGE_LIFESPAN_MS before fading out and being removed, so
// several can be on screen at once instead of one replacing the last.
export const DRAIN_SESSION_IMAGE_INTERVAL_MS = 1_800;
export const DRAIN_SESSION_IMAGE_LIFESPAN_MS = 3_500;
export const DRAIN_SESSION_MAX_CONCURRENT_IMAGES = 6;
export const DRAIN_SESSION_SYNC_INTERVAL_MS = 5_000;

export function clampDrainSessionRate(value: number) {
  if (!Number.isFinite(value)) return DRAIN_SESSION_DEFAULT_RATE;
  return Math.min(DRAIN_SESSION_MAX_RATE, Math.max(DRAIN_SESSION_MIN_RATE, Math.floor(value)));
}
