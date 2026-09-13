import { selectedSounds } from "./selected-sounds";
export type SoundEventName = keyof typeof selectedSounds;
export type SoundCategory = "ui" | "gameplay";

export type SoundSettings = {
  masterVolume: number;
  uiEnabled: boolean;
  gameplayEnabled: boolean;
};

export type SoundDefinition = {
  category: SoundCategory;
  src?: string;
  /** Relative level. Balances the palette by ear; see the registry notes. */
  volume?: number;
  /**
   * Minimum gap between two plays of this event. Several cues fire from dozens
   * of call sites (`error` from 25), and two landing in the same tick reads as
   * a stutter rather than one sound.
   */
  minIntervalMs?: number;
  /**
   * Whether repeats may overlap. Off means a repeat restarts the same element,
   * which is right for a one-shot confirmation and wrong for a reel tick.
   */
  polyphonic?: boolean;
};

const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  gameplayEnabled: true,
  // Raised from 0.7. Every cue is now attenuated to a common -30.5 LUFS base
  // (see the registry note), so the headroom that used to be spent hiding the
  // loudest asset belongs to the master control instead. Anyone with a stored
  // setting keeps it - this only affects a fresh browser.
  masterVolume: 1,
  uiEnabled: true,
};
const SOUND_SETTINGS_STORAGE_KEY = "vault:sound-settings";

/** Upper bound on simultaneous elements per source, so a stuck loop cannot pile up. */
const MAX_VOICES_PER_SOURCE = 4;

const soundRegistry: Record<SoundEventName, SoundDefinition> = { ...selectedSounds };

let soundSettings = { ...DEFAULT_SOUND_SETTINGS };
let hydrated = false;
let playbackUnlocked = false;

/** One reusable element per source, plus clones only when overlap is allowed. */
const primaryVoices = new Map<string, HTMLAudioElement>();
const activeVoices = new Set<HTMLAudioElement>();
const voiceDefinitions = new WeakMap<HTMLAudioElement, SoundDefinition>();
const lastPlayedAt = new Map<SoundEventName, number>();
const failedSources = new Set<string>();

export function getSoundSettings() {
  hydrateSoundSettings();
  return { ...soundSettings };
}

export function updateSoundSettings(settings: Partial<SoundSettings>) {
  hydrateSoundSettings();
  soundSettings = {
    ...soundSettings,
    ...settings,
    masterVolume: clampVolume(settings.masterVolume ?? soundSettings.masterVolume),
  };
  persistSoundSettings();
  window.dispatchEvent(new Event("vault:sound-settings-changed"));

  for (const audio of activeVoices) {
    const definition = voiceDefinitions.get(audio);
    if (!definition) continue;
    audio.volume = clampVolume((definition.volume ?? 1) * soundSettings.masterVolume);
    audio.muted = !isCategoryEnabled(definition.category);
  }
}

export function registerSoundEvent(eventName: SoundEventName, definition: Partial<SoundDefinition>) {
  soundRegistry[eventName] = { ...soundRegistry[eventName], ...definition };
}

export function emitSoundEvent(eventName: SoundEventName, options: { loop?: boolean } = {}): (() => void) | undefined {
  if (typeof window === "undefined") return;

  hydrateSoundSettings();
  const definition = soundRegistry[eventName];
  if (!definition?.src || failedSources.has(definition.src)) return;
  if (!isCategoryEnabled(definition.category) || document.hidden) return;

  const now = Date.now();
  const minInterval = definition.minIntervalMs ?? 0;
  if (minInterval > 0 && !options.loop) {
    const previous = lastPlayedAt.get(eventName);
    if (previous !== undefined && now - previous < minInterval) return;
  }
  lastPlayedAt.set(eventName, now);

  try {
    const audio = acquireVoice(definition);
    if (!audio) return;

    audio.volume = clampVolume((definition.volume ?? 1) * soundSettings.masterVolume);
    audio.currentTime = 0;
    audio.muted = false;
    audio.loop = options.loop ?? false;
    voiceDefinitions.set(audio, definition);
    activeVoices.add(audio);

    void audio.play().then(
      () => {
        playbackUnlocked = true;
      },
      () => {
        // Autoplay policy or a decode failure. Either way this is not worth a
        // console entry on every click - the earlier build logged both a play
        // request and its result for every single sound.
        activeVoices.delete(audio);
      },
    );
    return () => { audio.pause(); audio.currentTime = 0; audio.loop = false; activeVoices.delete(audio); };
  } catch {
    // Audio must never be able to break an interaction.
  }
}

/**
 * Must be called from a real user gesture. The previous version only flipped a
 * boolean, which does nothing for the browser's autoplay policy - the first
 * genuine cue could still be blocked. Playing a muted element inside the
 * gesture is what actually unlocks the channel.
 */
export function unlockSoundPlayback() {
  if (typeof window === "undefined" || playbackUnlocked) return;

  hydrateSoundSettings();
  playbackUnlocked = true;

  // Primed with the click because it is the smallest asset, not because the
  // event matters - keep this in step with button_click's src in the registry.
  const primer = new Audio(soundRegistry.button_click.src);
  if (!primer) return;
  primer.muted = true;
  void primer
    .play()
    .then(() => {
      primer.pause();
      primer.currentTime = 0;
      primer.muted = false;
    })
    .catch(() => {
      primer.muted = false;
    });
}

export function stopAllSounds() {
  for (const audio of activeVoices) {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // Already torn down.
    }
  }
  activeVoices.clear();
}

function acquireVoice(definition: SoundDefinition) {
  const src = definition.src;
  if (!src) return null;

  const primary = getPrimaryVoice(src);
  if (!primary) return null;

  // A one-shot cue restarts itself; only an explicitly polyphonic cue is
  // allowed to layer, and even then within a hard voice cap.
  if (!definition.polyphonic || primary.paused || primary.ended) {
    return primary;
  }

  let voiceCount = 0;
  for (const active of activeVoices) {
    if (active.src.endsWith(src)) voiceCount++;
  }
  if (voiceCount >= MAX_VOICES_PER_SOURCE) return primary;

  const clone = primary.cloneNode(true) as HTMLAudioElement;
  clone.addEventListener("ended", () => activeVoices.delete(clone), { once: true });
  return clone;
}

function getPrimaryVoice(src: string) {
  let audio = primaryVoices.get(src);
  if (audio) return audio;

  audio = new Audio(src);
  audio.preload = "auto";
  audio.addEventListener(
    "error",
    () => {
      // Remembered so a missing file is reported once instead of on every play.
      failedSources.add(src);
      console.warn("[sound] failed to load", src);
    },
    { once: true },
  );
  audio.addEventListener("ended", () => activeVoices.delete(audio!), { once: false });
  primaryVoices.set(src, audio);
  return audio;
}

function hydrateSoundSettings() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;

  try {
    const stored = window.localStorage.getItem(SOUND_SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<SoundSettings>;
      soundSettings = {
        ...soundSettings,
        gameplayEnabled: parsed.gameplayEnabled ?? soundSettings.gameplayEnabled,
        masterVolume: clampVolume(parsed.masterVolume ?? soundSettings.masterVolume),
        uiEnabled: parsed.uiEnabled ?? soundSettings.uiEnabled,
      };
    }
  } catch {
    // Sound settings should never break gameplay.
  }

  // A cue that was still ringing when the tab was hidden should not resume in
  // the background, and should not be waiting to finish on return.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") stopAllSounds();
  });
}

function persistSoundSettings() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SOUND_SETTINGS_STORAGE_KEY, JSON.stringify(soundSettings));
  } catch {
    // Storage failures should never break gameplay.
  }
}

function isCategoryEnabled(category: SoundCategory) {
  return category === "ui" ? soundSettings.uiEnabled : soundSettings.gameplayEnabled;
}

function clampVolume(value: number) {
  return Math.min(1, Math.max(0, value));
}
