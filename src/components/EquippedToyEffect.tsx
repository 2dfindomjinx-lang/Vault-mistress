"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { SAMPLE_CRATE_ITEMS } from "@/lib/crates";
import type { EquippedAvatarSlots } from "@/lib/avatar-slots";
import styles from "./EquippedToyEffect.module.css";

type EffectKind = "vibration" | "control" | "tease" | "discipline";

const TOY_EFFECTS: Record<string, { kind: EffectKind; mark: string; label: string }> = {
  "classic-buttplug": { kind: "control", mark: "◆", label: "Plug" },
  "classic-anal-beads": { kind: "control", mark: "•••", label: "Beads" },
  "classic-dildo": { kind: "vibration", mark: "∿", label: "Sensation" },
  "black-dildo": { kind: "vibration", mark: "∿", label: "Sensation" },
  "pink-small-vibrator": { kind: "vibration", mark: "⌁", label: "Vibration" },
  vibrator: { kind: "vibration", mark: "⌁", label: "Vibration" },
  "ultra-vibrator": { kind: "vibration", mark: "⌁", label: "Vibration" },
  "remote-control-vibrator": { kind: "vibration", mark: "⌁", label: "Remote pulse" },
  "rabbit-small-vibrator": { kind: "vibration", mark: "⌁", label: "Vibration" },
  latex_whip: { kind: "discipline", mark: "╱", label: "Discipline" },
  cat_o_nine_tails: { kind: "discipline", mark: "╱", label: "Discipline" },
  pink_paddle: { kind: "discipline", mark: "╱", label: "Discipline" },
  ruler: { kind: "discipline", mark: "╱", label: "Discipline" },
  pink_feather_tickler: { kind: "tease", mark: "✧", label: "Tease" },
};

const RARITY_ACCENTS: Record<string, string> = {
  common: "244 114 182",
  uncommon: "110 231 183",
  rare: "96 165 250",
  epic: "192 132 252",
  legendary: "251 191 36",
  ultimate: "244 244 245",
};

const RARITY_AMBIENT_CLASS: Record<string, string> = {
  rare: "ambientRare",
  epic: "ambientEpic",
  legendary: "ambientLegendary",
  ultimate: "ambientUltimate",
};

function getRarityClass(rarity: string) {
  const normalized = rarity.toLowerCase();
  return `rarity${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

export function EquippedToyEffect({ equipped }: { equipped: EquippedAvatarSlots }) {
  const itemId = equipped.toy;
  const item = itemId ? SAMPLE_CRATE_ITEMS[itemId] : null;
  const effect = itemId ? TOY_EFFECTS[itemId] : null;
  const [pulseId, setPulseId] = useState(0);

  useEffect(() => {
    if (pulseId === 0) return;
    const timeout = window.setTimeout(() => setPulseId(0), 1_350);
    return () => window.clearTimeout(timeout);
  }, [pulseId]);

  if (!itemId || !item || !effect) return null;

  const rarity = item.rarity.toLowerCase();
  const rarityClass = getRarityClass(rarity);
  const accent = RARITY_ACCENTS[rarity] ?? RARITY_ACCENTS.common;

  return (
    <div className={`${styles.overlay} ${pulseId > 0 ? styles.active : ""}`} style={{ "--toy-accent": accent } as CSSProperties}>
      <span aria-hidden="true" className={`${styles.aura} ${styles[rarityClass] ?? ""}`} />
      <button
        aria-label={`Activate ${item.name} ${rarity} ${effect.label} effect`}
        className={`${styles.signature} ${styles[rarityClass] ?? ""}`}
        onClick={(event) => {
          event.stopPropagation();
          setPulseId((current) => current + 1);
        }}
        title={`${item.name} · ${rarity} ${effect.label} effect`}
        type="button"
      >
        <span aria-hidden="true" className={`${styles.ambient} ${styles[RARITY_AMBIENT_CLASS[rarity] ?? ""] ?? ""}`} />
        <span aria-hidden="true">{effect.mark}</span>
        <span aria-hidden="true" className={styles.kindLabel}>TOY</span>
      </button>
      {pulseId > 0 && (
        <span aria-hidden="true" className={styles.pulseField} key={pulseId}>
          {effect.kind === "discipline" ? (
            <>
              <i className={styles.disciplineMark} />
              {rarity !== "common" && <i className={styles.disciplineMark} />}
            </>
          ) : effect.kind === "tease" ? (
            <>
              <i className={styles.teaseWave} />
              {rarity !== "common" && <i className={styles.teaseWave} />}
            </>
          ) : effect.kind === "control" ? (
            <>
              <i className={styles.controlWave} />
              {rarity !== "common" && <i className={styles.controlWave} />}
            </>
          ) : (
            <>
              <i className={styles.vibrationWave} />
              {rarity !== "common" && <i className={styles.vibrationWave} />}
            </>
          )}
        </span>
      )}
    </div>
  );
}
