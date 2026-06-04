export type SoundEventName =
  | "button_click"
  | "tribute_sent"
  | "gallery_unlock"
  | "task_completion"
  | "affection_level_up"
  | "debt_contract_signed"
  | "cosmetic_purchased"
  | "jackpot_contribution"
  | "jackpot_win"
  | "random_event_activation";

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

const soundRegistry: Record<SoundEventName, SoundDefinition> = {
  button_click: { category: "ui", src: "/sounds/button-click.mp3" },
  tribute_sent: { category: "gameplay", src: "/sounds/tribute-sent.mp3" },
  gallery_unlock: { category: "gameplay", src: "/sounds/gallery-unlock.mp3" },
  task_completion: { category: "gameplay", src: "/sounds/task-completion.mp3" },
  affection_level_up: { category: "gameplay", src: "/sounds/affection-level-up.mp3" },
  debt_contract_signed: { category: "gameplay", src: "/sounds/debt-contract-signed.mp3" },
  cosmetic_purchased: { category: "gameplay", src: "/sounds/cosmetic-purchased.mp3" },
  jackpot_contribution: { category: "gameplay", src: "/sounds/jackpot-contribution.mp3" },
  jackpot_win: { category: "gameplay", src: "/sounds/jackpot-win.mp3" },
  random_event_activation: { category: "gameplay", src: "/sounds/random-event-activation.mp3" },
};

let soundSettings = { ...DEFAULT_SOUND_SETTINGS };

export function getSoundSettings() {
  return { ...soundSettings };
}

export function updateSoundSettings(settings: Partial<SoundSettings>) {
  soundSettings = {
    ...soundSettings,
    ...settings,
    masterVolume: clampVolume(settings.masterVolume ?? soundSettings.masterVolume),
  };
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

  const definition = soundRegistry[eventName];

  if (!definition?.src || !isCategoryEnabled(definition.category)) {
    return;
  }

  try {
    const audio = new Audio(definition.src);
    audio.volume = clampVolume((definition.volume ?? 1) * soundSettings.masterVolume);
    void audio.play().catch(() => {
      // Browsers can block playback before user interaction; sound must never break gameplay.
    });
  } catch {
    // Missing, invalid, or unsupported audio assets are intentionally ignored.
  }
}

function isCategoryEnabled(category: SoundCategory) {
  return category === "ui" ? soundSettings.uiEnabled : soundSettings.gameplayEnabled;
}

function clampVolume(value: number) {
  return Math.min(1, Math.max(0, value));
}
