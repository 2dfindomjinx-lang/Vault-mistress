// Sound playback for the court.
//
// The audio itself is generated, not sourced - see scripts/generate-sounds.mjs
// for the synthesis and the reasoning. Everything is short 16-bit mono WAV so
// there is no decode stall and no multi-megabyte music bed hiding behind a UI
// cue.

export type SoundEventName =
  | "button_click"
  | "tribute_sent"
  | "gallery_unlock"
  | "task_completion"
  | "task_fail"
  | "error"
  | "affection_level_up"
  | "debt_contract_signed"
  | "cosmetic_purchased"
  | "random_event_activation"
  | "crate_reel_tick"
  | "crate_reveal"
  | "crate_legendary_reveal";

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
  masterVolume: 0.7,
  uiEnabled: true,
};
const SOUND_SETTINGS_STORAGE_KEY = "vault:sound-settings";

/** Upper bound on simultaneous elements per source, so a stuck loop cannot pile up. */
const MAX_VOICES_PER_SOURCE = 4;

// Volumes are set against each other by ear, not by peak level: the sustained
// low cues (error, task_fail) measure louder in RMS than the bells at the same
// peak, so they are pulled down here rather than re-rendered quieter.
const soundRegistry: Record<SoundEventName, SoundDefinition> = {
  button_click: { category: "ui", src: "/sounds/button-click.wav", volume: 0.45, minIntervalMs: 45, polyphonic: true },
  // Original hand-made asset, kept by preference. Not produced by
  // scripts/generate-sounds.mjs - do not "fix" the extension to .wav.
  crate_reel_tick: { category: "ui", src: "/sounds/crate-reel-tick.mp3", volume: 0.3, minIntervalMs: 28, polyphonic: true },
  error: { category: "ui", src: "/sounds/error.wav", volume: 0.5, minIntervalMs: 450 },

  task_completion: { category: "gameplay", src: "/sounds/task-completion.wav", volume: 0.7, minIntervalMs: 180 },
  task_fail: { category: "gameplay", src: "/sounds/task-fail.wav", volume: 0.55, minIntervalMs: 400 },
  tribute_sent: { category: "gameplay", src: "/sounds/tribute-sent.wav", volume: 0.8 },
  cosmetic_purchased: { category: "gameplay", src: "/sounds/cosmetic-purchased.wav", volume: 0.7, minIntervalMs: 180 },

  // Everything below keeps its ORIGINAL hand-made asset, by preference. They
  // are not produced by scripts/generate-sounds.mjs and several are .mp3 - do
  // not "tidy" the extensions to match the generated ones above.
  //
  // Their levels are the originals too, so they sound exactly as they did
  // before the palette work.
  debt_contract_signed: { category: "gameplay", src: "/sounds/debt-contract-signed.wav", volume: 0.65 },
  gallery_unlock: { category: "gameplay", src: "/sounds/gallery-unlock.mp3" },
  affection_level_up: { category: "gameplay", src: "/sounds/affection-level-up.mp3" },
  random_event_activation: { category: "gameplay", src: "/sounds/random-event-activation.mp3" },
  crate_reveal: { category: "gameplay", src: "/sounds/crate-reveal.mp3", volume: 0.5 },
  crate_legendary_reveal: { category: "gameplay", src: "/sounds/crate-legendary-reveal.mp3", volume: 0.6 },
};

let soundSettings = { ...DEFAULT_SOUND_SETTINGS };
let hydrated = false;
let playbackUnlocked = false;

/** One reusable element per source, plus clones only when overlap is allowed. */
const primaryVoices = new Map<string, HTMLAudioElement>();
const activeVoices = new Set<HTMLAudioElement>();
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

  // Turning a category off should silence what is already playing, not wait it
  // out. Cheap to be thorough: nothing here loops.
  if (!soundSettings.uiEnabled || !soundSettings.gameplayEnabled) {
    stopAllSounds();
  }
}

export function registerSoundEvent(eventName: SoundEventName, definition: Partial<SoundDefinition>) {
  soundRegistry[eventName] = { ...soundRegistry[eventName], ...definition };
}

export function emitSoundEvent(eventName: SoundEventName) {
  if (typeof window === "undefined") return;

  hydrateSoundSettings();
  const definition = soundRegistry[eventName];
  if (!definition?.src || failedSources.has(definition.src)) return;
  if (!isCategoryEnabled(definition.category)) return;

  const now = Date.now();
  const minInterval = definition.minIntervalMs ?? 0;
  if (minInterval > 0) {
    const previous = lastPlayedAt.get(eventName);
    if (previous !== undefined && now - previous < minInterval) return;
  }
  lastPlayedAt.set(eventName, now);

  try {
    const audio = acquireVoice(definition);
    if (!audio) return;

    audio.volume = clampVolume((definition.volume ?? 1) * soundSettings.masterVolume);
    audio.currentTime = 0;
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

  const primer = getPrimaryVoice("/sounds/button-click.wav");
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
