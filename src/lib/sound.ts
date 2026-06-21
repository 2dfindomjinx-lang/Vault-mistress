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
  | "jackpot_contribution"
  | "jackpot_win"
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
  volume?: number;
};

const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  gameplayEnabled: true,
  masterVolume: 0.7,
  uiEnabled: true,
};
const SOUND_SETTINGS_STORAGE_KEY = "vault:sound-settings";

const soundRegistry: Record<SoundEventName, SoundDefinition> = {
  button_click: { category: "ui", src: "/sounds/button-click.mp3" },
  tribute_sent: { category: "gameplay", src: "/sounds/tribute-sent.mp3" },
  gallery_unlock: { category: "gameplay", src: "/sounds/gallery-unlock.mp3" },
  task_completion: { category: "gameplay", src: "/sounds/task-completion.mp3" },
  task_fail: { category: "gameplay", src: "/sounds/task-fail.mp3" },
  error: { category: "ui", src: "/sounds/error.mp3" },
  affection_level_up: { category: "gameplay", src: "/sounds/affection-level-up.mp3" },
  debt_contract_signed: { category: "gameplay", src: "/sounds/debt-contract-signed.wav" },
  cosmetic_purchased: { category: "gameplay", src: "/sounds/cosmetic-purchased.wav" },
  jackpot_contribution: { category: "gameplay", src: "/sounds/jackpot-contribution.mp3" },
  jackpot_win: { category: "gameplay", src: "/sounds/jackpot-win.mp3" },
  random_event_activation: { category: "gameplay", src: "/sounds/random-event-activation.mp3" },

  // Crate opening sounds.
  // These are pre-wired to the filenames you will place in public/sounds/.
  // Just drop your new audio files with these exact names and they will work.
  // (No need to edit sound.ts again)
  crate_reel_tick: { category: "ui", src: "/sounds/crate-reel-tick.mp3", volume: 0.35 },
  crate_reveal: { category: "gameplay", src: "/sounds/crate-reveal.mp3", volume: 0.5 },
  crate_legendary_reveal: { category: "gameplay", src: "/sounds/crate-legendary-reveal.mp3", volume: 0.6 },
};

let soundSettings = { ...DEFAULT_SOUND_SETTINGS };
let hydrated = false;
let playbackUnlocked = false;
const audioCache = new Map<string, HTMLAudioElement>();

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
}

export function registerSoundEvent(
  eventName: SoundEventName,
  definition: Partial<SoundDefinition>,
) {
  soundRegistry[eventName] = {
    ...soundRegistry[eventName],
    ...definition,
  };
}

export function emitSoundEvent(eventName: SoundEventName) {
  if (typeof window === "undefined") {
    return;
  }

  hydrateSoundSettings();
  const definition = soundRegistry[eventName];

  if (!definition?.src) {
    console.info("[sound] skipped missing source", { eventName });
    return;
  }

  if (!isCategoryEnabled(definition.category)) {
    console.info("[sound] skipped disabled category", {
      category: definition.category,
      eventName,
      settings: soundSettings,
    });
    return;
  }

  try {
    let audio = audioCache.get(definition.src);

    if (!audio) {
      audio = new Audio(definition.src);
      audio.preload = "auto";
      audioCache.set(definition.src, audio);
    }

    audio.volume = clampVolume((definition.volume ?? 1) * soundSettings.masterVolume);
    audio.addEventListener("error", () => {
      console.error("[sound] audio file failed to load", {
        eventName,
        src: definition.src,
      });
    }, { once: true });

    console.info("[sound] play requested", {
      eventName,
      playbackUnlocked,
      src: definition.src,
      volume: audio.volume,
    });

    audio.currentTime = 0;
    void audio.play().then(() => {
      playbackUnlocked = true;
      console.info("[sound] play succeeded", { eventName });
    }).catch((error) => {
      console.error("[sound] play failed", {
        error,
        eventName,
        playbackUnlocked,
        src: definition.src,
      });
    });
  } catch {
    // Missing, invalid, or unsupported audio assets are intentionally ignored.
  }
}

export function unlockSoundPlayback() {
  if (typeof window === "undefined" || playbackUnlocked) {
    return;
  }

  hydrateSoundSettings();
  playbackUnlocked = true;
}

function hydrateSoundSettings() {
  if (hydrated || typeof window === "undefined") {
    return;
  }

  hydrated = true;

  try {
    const stored = window.localStorage.getItem(SOUND_SETTINGS_STORAGE_KEY);

    if (!stored) {
      return;
    }

    const parsed = JSON.parse(stored) as Partial<SoundSettings>;
    soundSettings = {
      ...soundSettings,
      gameplayEnabled: parsed.gameplayEnabled ?? soundSettings.gameplayEnabled,
      masterVolume: clampVolume(parsed.masterVolume ?? soundSettings.masterVolume),
      uiEnabled: parsed.uiEnabled ?? soundSettings.uiEnabled,
    };
  } catch {
    // Sound settings should never break gameplay.
  }
}

function persistSoundSettings() {
  if (typeof window === "undefined") {
    return;
  }

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
