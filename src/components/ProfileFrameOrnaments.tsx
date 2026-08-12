"use client";

import { memo, useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { LayeredAvatar } from "@/components/LayeredAvatar";
import { ProfileBorderFrame } from "@/components/ProfileBorderFrame";
import type { EquippedAvatarSlots } from "@/lib/avatar-slots";
import { getAvatarBackgroundPresentation } from "@/lib/avatar-background-cosmetics";
import {
  getCosmeticItem,
  type CosmeticItem,
  type CosmeticType,
} from "@/lib/cosmetics";
import { getProfileBorderFramePresentation } from "@/lib/profile-border-presentation";
import { PLUSH_IMAGE_PATH } from "@/lib/birthday-plush";
import {
  getProfileFrameDecorationDefinition,
  isProfileFrameCosmeticType,
  resolveFrameAttachment,
  type ProfileFrameDecorationDefinition,
} from "@/lib/profile-frame-cosmetics";

type EquippedCosmeticIds = Partial<Record<CosmeticType, string>>;

type ProfileFrameOrnamentsProps = {
  equippedCosmeticIds?: EquippedCosmeticIds;
  previewItem?: CosmeticItem | null;
  previewMode?: "default" | "shop";
};

type PrincipessaShowcasePreviewProps = {
  className?: string;
  equippedAvatarSlots?: EquippedAvatarSlots;
  equippedFullSetId?: string | null;
  equippedCosmeticIds?: EquippedCosmeticIds;
  hasUncensoredAvatar?: boolean;
  previewItem?: CosmeticItem | null;
  previewMode?: "default" | "shop";
};

function withAlpha(color: string, alpha: string) {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return `${color}${alpha}`;
  }

  return color;
}

function getPalette(definition: ProfileFrameDecorationDefinition) {
  return {
    accent: definition.palette[2] ?? definition.palette[1] ?? definition.palette[0],
    metal: definition.metal ?? definition.palette[2] ?? definition.palette[1] ?? definition.palette[0],
    primary: definition.palette[0],
    secondary: definition.palette[1] ?? definition.palette[0],
    shadow: definition.shadow ?? definition.palette[0],
  };
}

// Shared material layer for the frame ornaments. Before this everything was a
// flat fill plus a flat stroke, which is why the corner/top/side/overlay pieces
// read as clipart next to the rest of the UI. Nothing here does colour maths -
// depth comes from white/black alpha stops layered over the item's own palette, so
// it works for every palette including the non-hex ones withAlpha bails on.
//
// The ids are per-render (useId) because several ornaments - and several whole
// avatars, e.g. a leaderboard - can share one document, and duplicate SVG
// gradient ids silently make every copy use the first one's colours.
function useOrnamentPaint(definition: ProfileFrameDecorationDefinition) {
  const palette = getPalette(definition);
  const uid = useId().replace(/:/g, "");
  const ids = {
    body: `ofb-${uid}`,
    gem: `ofg-${uid}`,
    glow: `ofl-${uid}`,
    metal: `ofm-${uid}`,
    sheen: `ofs-${uid}`,
  };

  const defs = (
    <defs>
      {/* Brushed metal: dark shoulders, bright belly, one hot specular band. */}
      <linearGradient id={ids.metal} x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor={palette.metal} stopOpacity="0.42" />
        <stop offset="30%" stopColor={palette.metal} stopOpacity="1" />
        <stop offset="46%" stopColor="#ffffff" stopOpacity="0.82" />
        <stop offset="60%" stopColor={palette.metal} stopOpacity="1" />
        <stop offset="100%" stopColor={palette.metal} stopOpacity="0.38" />
      </linearGradient>
      {/* Gem: off-centre highlight, mid tone, dark rim - the classic 3-stop cabochon. */}
      <radialGradient id={ids.gem} cx="34%" cy="26%" r="78%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
        <stop offset="24%" stopColor={palette.accent} stopOpacity="1" />
        <stop offset="64%" stopColor={palette.secondary} stopOpacity="1" />
        <stop offset="100%" stopColor={palette.shadow} stopOpacity="1" />
      </radialGradient>
      {/* Body: lit from above, falling into the item's own shadow colour. */}
      <linearGradient id={ids.body} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor={palette.secondary} stopOpacity="1" />
        <stop offset="52%" stopColor={palette.primary} stopOpacity="1" />
        <stop offset="100%" stopColor={palette.shadow} stopOpacity="0.95" />
      </linearGradient>
      {/* Glass sheen laid over the top half of a solid shape. */}
      <linearGradient id={ids.sheen} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
        <stop offset="44%" stopColor="#ffffff" stopOpacity="0.06" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <filter height="220%" id={ids.glow} width="220%" x="-60%" y="-60%">
        <feDropShadow dx="0" dy="1.1" floodColor={palette.shadow} floodOpacity="0.65" stdDeviation="1.5" />
      </filter>
    </defs>
  );

  return {
    body: `url(#${ids.body})`,
    defs,
    gem: `url(#${ids.gem})`,
    glow: `url(#${ids.glow})`,
    metal: `url(#${ids.metal})`,
    palette,
    sheen: `url(#${ids.sheen})`,
  };
}

function getPreviewCosmeticIds(
  equippedCosmeticIds: EquippedCosmeticIds = {},
  previewItem?: CosmeticItem | null,
) {
  if (!previewItem) {
    return equippedCosmeticIds;
  }

  return {
    ...equippedCosmeticIds,
    [previewItem.type]: previewItem.id,
  };
}

function getDecorationItems(
  equippedCosmeticIds: EquippedCosmeticIds = {},
  previewItem?: CosmeticItem | null,
) {
  const resolvedIds = previewItem
    ? { ...equippedCosmeticIds, [previewItem.type]: previewItem.id }
    : equippedCosmeticIds;

  const decorations = Object.values(resolvedIds)
    .map((itemId) => getProfileFrameDecorationDefinition(itemId ?? ""))
    .filter((item): item is ProfileFrameDecorationDefinition => Boolean(item));

  return {
    bottom: decorations.find((item) => item.type === "profile-frame-bottom") ?? null,
    corner: decorations.find((item) => item.type === "profile-frame-corner") ?? null,
    overlay: decorations.find((item) => item.type === "profile-frame-overlay") ?? null,
    particles: decorations.find((item) => item.type === "profile-frame-particles") ?? null,
    side: decorations.find((item) => item.type === "profile-frame-side") ?? null,
    top: decorations.find((item) => item.type === "profile-frame-top") ?? null,
  };
}

function DecorationSvg({ children, className = "z-[18]" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`absolute inset-0 h-full w-full pointer-events-none overflow-visible ${className}`}
      style={{ overflow: "visible" }}
      viewBox="0 0 180 285"
    >
      {children}
    </svg>
  );
}

function RibbonBow({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);
  // Relative to bottom-center attach (0,0). Shifted x-90, y-240 so base ~0, body +y downward.
  return (
    <g>
      <path
        d="M0 -4 C-18 -18 -34 -20 -46 -7 C-33 7 -19 9 -5 1 L0 7 Z"
        fill={palette.primary}
        stroke={palette.accent}
        strokeWidth="1.6"
      />
      <path
        d="M0 -4 C18 -18 34 -20 46 -7 C33 7 19 9 5 1 L0 7 Z"
        fill={palette.secondary}
        stroke={palette.accent}
        strokeWidth="1.6"
      />
      <path
        d="M-15 0 L-27 30 L-9 20 L-4 41 L0 11 Z"
        fill={palette.primary}
        stroke={palette.accent}
        strokeWidth="1.4"
      />
      <path
        d="M15 0 L27 30 L9 20 L4 41 L0 11 Z"
        fill={palette.secondary}
        stroke={palette.accent}
        strokeWidth="1.4"
      />
      <ellipse cx="0" cy="-2" fill={palette.metal} rx="11" ry="8.2" />
      <ellipse
        cx="0"
        cy="-2"
        fill={withAlpha(palette.accent, "aa")}
        rx="4.4"
        ry="4.4"
      />
    </g>
  );
}

function HangingHeartLock({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);
  // Relative: x-90, y-240 so attach ~0 , extends +y
  return (
    <g>
      <path
        d="M0 -7 C-12 -16 -23 -17 -31 -8 C-22 0 -14 2 -3 -3 Z"
        fill={palette.primary}
      />
      <path
        d="M0 -7 C12 -16 23 -17 31 -8 C22 0 14 2 3 -3 Z"
        fill={palette.secondary}
      />
      <ellipse cx="0" cy="-5" fill={palette.metal} rx="7" ry="5.5" />
      <path d="M0 1 L0 18" stroke={palette.metal} strokeLinecap="round" strokeWidth="2" />
      <path
        d="M-6 21 C-6 16.2 -3.2 12.8 0 12.8 C3.2 12.8 6 16.2 6 21 V24"
        fill="none"
        stroke={palette.metal}
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M0 39 C-7.6 32.6 -12.2 28.2 -12.2 23 C-12.2 18.9 -9 16 -5.1 16 C-2.9 16 -1.1 17 0 18.6 C1.1 17 2.9 16 5.1 16 C9 16 12.2 18.9 12.2 23 C12.2 28.2 7.6 32.6 0 39 Z"
        fill={palette.primary}
        stroke={palette.metal}
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M0 33.2 C-4.2 29.6 -6.7 27.1 -6.7 24 C-6.7 21.5 -4.8 19.9 -2.6 19.9 C-1.3 19.9 -0.5 20.5 0 21.3 C0.5 20.5 1.3 19.9 2.6 19.9 C4.8 19.9 6.7 21.5 6.7 24 C6.7 27.1 4.2 29.6 0 33.2 Z"
        fill={palette.accent}
      />
    </g>
  );
}

function HangingMoonBell({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);

  return (
    <g>
      <path
        d="M90 233 C78 224 67 223 59 232 C68 240 76 242 87 237 Z"
        fill={palette.primary}
      />
      <path
        d="M90 233 C102 224 113 223 121 232 C112 240 104 242 93 237 Z"
        fill={palette.secondary}
      />
      <ellipse cx="90" cy="235" fill={palette.metal} rx="7" ry="5.5" />
      <path d="M90 241 L90 258" stroke={palette.metal} strokeLinecap="round" strokeWidth="2" />
      <path
        d="M88 257 A8 8 0 1 0 96 266 A5.8 5.8 0 1 1 88 257 Z"
        fill={palette.accent}
      />
      <path
        d="M82 270 C82 264.6 85.5 261 90 261 C94.5 261 98 264.6 98 270 V273 H82 Z"
        fill={palette.secondary}
        stroke={palette.metal}
        strokeWidth="1.4"
      />
      <circle cx="90" cy="274" fill={palette.metal} r="2.2" />
    </g>
  );
}

function WaxSeal({ definition, crest = false }: { crest?: boolean; definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);

  return (
    <g>
      <path
        d="M71 242 L62 270 L79 261 L83 279 L90 254 L97 279 L101 261 L118 270 L109 242 Z"
        fill={withAlpha(palette.secondary, "cc")}
      />
      <circle cx="90" cy="243" fill={palette.primary} r="16.5" />
      <circle
        cx="90"
        cy="243"
        fill={withAlpha(palette.secondary, "88")}
        r="12.5"
      />
      {crest ? (
        <>
          <path
            d="M90 232 L96 237 V244 C96 248.5 92.8 251.2 90 252.8 C87.2 251.2 84 248.5 84 244 V237 Z"
            fill={palette.metal}
          />
          <path d="M87 240 H93" stroke={palette.primary} strokeWidth="1.5" />
        </>
      ) : (
        <>
          <circle cx="90" cy="243" fill={palette.metal} r="5.8" />
          <path
            d="M84.5 243.2 L88.4 246.8 L95.4 239.7"
            fill="none"
            stroke={palette.primary}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </>
      )}
    </g>
  );
}

function GemClasp({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);

  return (
    <g>
      <path
        d="M59 244 C70 233 79 232 86 236 C80 242 74 246 63 250 Z"
        fill={palette.primary}
      />
      <path
        d="M121 244 C110 233 101 232 94 236 C100 242 106 246 117 250 Z"
        fill={palette.secondary}
      />
      <path
        d="M90 228 L99 235 L95 247 L85 247 L81 235 Z"
        fill={palette.accent}
        stroke={palette.metal}
        strokeWidth="1.8"
      />
      <circle cx="90" cy="240.5" fill={palette.metal} r="2.2" />
      <path
        d="M73 249 L68 267 L81 261 L87 274 L90 248 Z"
        fill={withAlpha(palette.primary, "dd")}
      />
      <path
        d="M107 249 L112 267 L99 261 L93 274 L90 248 Z"
        fill={withAlpha(palette.secondary, "dd")}
      />
    </g>
  );
}

function RoseCluster({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);

  return (
    <g>
      <ellipse cx="74" cy="248" fill={palette.primary} rx="8.5" ry="7.8" />
      <ellipse cx="90" cy="243" fill={palette.secondary} rx="9.5" ry="8.8" />
      <ellipse cx="106" cy="248" fill={palette.primary} rx="8.5" ry="7.8" />
      <path d="M70 248 C73 244 76 244 78 248 C76 252 73 252 70 248 Z" fill={palette.accent} />
      <path d="M86 243 C89 239 93 239 96 243 C93 247 89 247 86 243 Z" fill={palette.accent} />
      <path d="M102 248 C105 244 108 244 110 248 C108 252 105 252 102 248 Z" fill={palette.accent} />
      <path d="M80 257 C78 253 74 252 69 254 C72 260 76 262 80 257 Z" fill={palette.metal} />
      <path d="M100 257 C102 253 106 252 111 254 C108 260 104 262 100 257 Z" fill={palette.metal} />
      <path d="M89 252 L89 271" stroke={palette.metal} strokeWidth="2.2" />
    </g>
  );
}

function FestoonMedallion({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);

  return (
    <g>
      <path
        d="M-50 -6 C-35 3 -22 7 -8 6"
        fill="none"
        stroke={withAlpha(palette.metal, "d8")}
        strokeLinecap="round"
        strokeWidth="2.4"
      />
      <path
        d="M50 -6 C35 3 22 7 8 6"
        fill="none"
        stroke={withAlpha(palette.metal, "d8")}
        strokeLinecap="round"
        strokeWidth="2.4"
      />
      <path
        d="M-56 -10 C-46 -18 -33 -17 -24 -9 C-29 -1 -39 2 -50 -1 Z"
        fill={palette.primary}
        stroke={palette.accent}
        strokeWidth="1.6"
      />
      <path
        d="M56 -10 C46 -18 33 -17 24 -9 C29 -1 39 2 50 -1 Z"
        fill={palette.secondary}
        stroke={palette.accent}
        strokeWidth="1.6"
      />
      <circle cx="0" cy="-2" fill={palette.primary} r="15.5" stroke={palette.metal} strokeWidth="2" />
      <circle cx="0" cy="-2" fill={withAlpha(palette.secondary, "84")} r="10.5" />
      <path
        d="M0 -11 L4 -3 L13 -2 L6 4 L8 13 L0 8 L-8 13 L-6 4 L-13 -2 L-4 -3 Z"
        fill={palette.metal}
      />
      <circle cx="-29" cy="10" fill={palette.metal} r="3.1" />
      <circle cx="29" cy="10" fill={palette.metal} r="3.1" />
      <path d="M-29 13 L-29 28" stroke={palette.metal} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M29 13 L29 28" stroke={palette.metal} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M0 14 L0 34" stroke={palette.metal} strokeWidth="2" strokeLinecap="round" />
      <path d="M-35 30 L-29 24 L-23 30 Z" fill={palette.accent} />
      <path d="M23 30 L29 24 L35 30 Z" fill={palette.accent} />
      <path d="M-8 36 L0 24 L8 36 Z" fill={palette.accent} />
    </g>
  );
}

function JeweledLocket({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);

  return (
    <g>
      <path
        d="M-49 -6 C-33 -20 -18 -18 -7 -7 C-18 1 -31 5 -44 6 Z"
        fill={palette.primary}
        stroke={palette.metal}
        strokeWidth="1.5"
      />
      <path
        d="M49 -6 C33 -20 18 -18 7 -7 C18 1 31 5 44 6 Z"
        fill={palette.secondary}
        stroke={palette.metal}
        strokeWidth="1.5"
      />
      <path
        d="M-18 -16 H18 L24 -5 L18 15 H-18 L-24 -5 Z"
        fill={withAlpha(palette.primary, "ea")}
        stroke={palette.metal}
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <rect x="-12" y="-8" width="24" height="16" rx="4" fill={withAlpha(palette.secondary, "92")} />
      <circle cx="0" cy="-5" fill={palette.metal} r="3.4" />
      <path d="M-7 0 H7" stroke={palette.accent} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M0 15 L0 27" stroke={palette.metal} strokeWidth="2" strokeLinecap="round" />
      <path
        d="M0 42 C-7.6 35.8 -12.4 30.8 -12.4 25.6 C-12.4 21.3 -9 18 -5 18 C-2.7 18 -0.9 19 -0.1 20.4 C0.9 19 2.7 18 5 18 C9 18 12.4 21.3 12.4 25.6 C12.4 30.8 7.6 35.8 0 42 Z"
        fill={palette.accent}
        stroke={palette.metal}
        strokeWidth="1.5"
      />
    </g>
  );
}

function CathedralTassel({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);

  return (
    <g>
      <path
        d="M-34 -2 C-24 -14 -12 -20 0 -20 C12 -20 24 -14 34 -2"
        fill="none"
        stroke={withAlpha(palette.accent, "b8")}
        strokeLinecap="round"
        strokeWidth="2.3"
      />
      <path
        d="M-24 -2 C-15 -11 -8 -15 0 -15 C8 -15 15 -11 24 -2"
        fill="none"
        stroke={withAlpha(palette.metal, "d6")}
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M-16 -3 L-6 18 L0 8 L6 18 L16 -3 Z"
        fill={palette.primary}
        stroke={palette.metal}
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <circle cx="0" cy="-2" fill={palette.metal} r="5.2" />
      <circle cx="0" cy="-2" fill={palette.accent} r="2.3" />
      <path d="M-8 18 V38 M0 10 V44 M8 18 V38" stroke={palette.metal} strokeLinecap="round" strokeWidth="1.8" />
      <path d="M-11 38 L-7 48 L-3 38 Z" fill={palette.secondary} />
      <path d="M-4 44 L0 56 L4 44 Z" fill={palette.accent} />
      <path d="M3 38 L7 48 L11 38 Z" fill={palette.secondary} />
    </g>
  );
}

function OperaRoseSwag({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);

  return (
    <g>
      <path
        d="M-47 -3 C-31 8 -17 12 0 12 C17 12 31 8 47 -3"
        fill="none"
        stroke={withAlpha(palette.metal, "ca")}
        strokeLinecap="round"
        strokeWidth="2.1"
      />
      <path
        d="M-24 15 C-14 22 -6 24 0 24 C6 24 14 22 24 15"
        fill="none"
        stroke={withAlpha(palette.accent, "bc")}
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      <ellipse cx="-26" cy="-2" fill={palette.primary} rx="9.2" ry="8.4" />
      <ellipse cx="0" cy="-8" fill={palette.secondary} rx="10.5" ry="9.4" />
      <ellipse cx="26" cy="-2" fill={palette.primary} rx="9.2" ry="8.4" />
      <path d="M-30 -2 C-27 -6 -24 -6 -21 -2 C-24 2 -27 2 -30 -2 Z" fill={palette.accent} />
      <path d="M-4 -8 C-1 -13 2 -13 5 -8 C2 -3 -1 -3 -4 -8 Z" fill={palette.accent} />
      <path d="M22 -2 C25 -6 28 -6 31 -2 C28 2 25 2 22 -2 Z" fill={palette.accent} />
      <path d="M-17 11 C-20 6 -25 6 -31 10 C-28 17 -22 18 -17 11 Z" fill={palette.metal} />
      <path d="M17 11 C20 6 25 6 31 10 C28 17 22 18 17 11 Z" fill={palette.metal} />
      <circle cx="0" cy="25" fill={palette.metal} r="3.1" />
      <path d="M0 28 V38" stroke={palette.metal} strokeLinecap="round" strokeWidth="1.7" />
      <path d="M-6 39 L0 31 L6 39 Z" fill={palette.secondary} />
    </g>
  );
}

function CornerFiligree({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const paint = useOrnamentPaint(definition);
  const { palette } = paint;

  const renderCorner = (mirror = false) => (
    <g filter={paint.glow} transform={mirror ? "translate(180 0) scale(-1 1)" : undefined}>
      {/* Outer scroll, then an inner scroll offset inward so the metalwork
          reads as two nested vines instead of one flat leaf. */}
      <path
        d="M11 249 C11 233 17 223 30 217 C25 226 25 233 29 240 C35 236 42 236 48 239 C38 241 31 248 27 256 C21 256 15 254 11 249 Z"
        fill={paint.body}
        stroke={paint.metal}
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M11 249 C11 233 17 223 30 217 C25 226 25 233 29 240 C35 236 42 236 48 239 C38 241 31 248 27 256 C21 256 15 254 11 249 Z"
        fill={paint.sheen}
      />
      <path
        d="M15 248 C16 236 21 228 31 223"
        fill="none"
        stroke={paint.metal}
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <path
        d="M17 250 C20 241 26 235 36 231"
        fill="none"
        stroke={withAlpha(palette.accent, "d8")}
        strokeLinecap="round"
        strokeWidth="1.6"
      />
      {/* Trailing curls - cheap density that makes the corner feel worked. */}
      <path d="M13 256 C17 252 21 251 25 253" fill="none" stroke={withAlpha(palette.metal, "aa")} strokeLinecap="round" strokeWidth="1.2" />
      <path d="M32 243 C35 239 39 238 43 240" fill="none" stroke={paint.metal} strokeLinecap="round" strokeWidth="1.5" />
      <path d="M41 236 C44 233 47 233 50 235" fill="none" stroke={withAlpha(palette.metal, "9a")} strokeLinecap="round" strokeWidth="1.1" />
      <circle cx="26" cy="245" fill={paint.gem} r="3.2" stroke={withAlpha(palette.metal, "cc")} strokeWidth="0.8" />
      <circle cx="25" cy="243.8" fill="#ffffff" fillOpacity="0.75" r="0.85" />
      <circle cx="44" cy="239" fill={paint.gem} r="1.7" />
    </g>
  );

  return (
    <g>
      {paint.defs}
      {renderCorner(false)}
      {renderCorner(true)}
    </g>
  );
}

function CornerClaws({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const paint = useOrnamentPaint(definition);
  const { palette } = paint;

  const renderCorner = (mirror = false) => (
    <g filter={paint.glow} transform={mirror ? "translate(180 0) scale(-1 1)" : undefined}>
      {/* Lacquer plate under the claw so the metal has something to grip. */}
      <path
        d="M8 246 L18 229 L35 221 L30 236 L42 243 L27 247 L18 260 Z"
        fill={paint.body}
        stroke={paint.metal}
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="M8 246 L18 229 L35 221 L30 236 L42 243 L27 247 L18 260 Z" fill={paint.sheen} />
      {/* Three separated talons instead of one zigzag stroke. */}
      <path d="M16 231 L24 241" fill="none" stroke={paint.metal} strokeLinecap="round" strokeWidth="2.1" />
      <path d="M13 243 L23 244" fill="none" stroke={paint.metal} strokeLinecap="round" strokeWidth="1.9" />
      <path d="M17 255 L24 247" fill="none" stroke={paint.metal} strokeLinecap="round" strokeWidth="2.1" />
      <path d="M18 232 L25 242 L18 252" fill="none" stroke={withAlpha(palette.accent, "88")} strokeWidth="1.1" />
      {/* Marquise setting: dark bezel, faceted stone, cross glint. */}
      <path
        d="M28 238 L35 244 L28 250 L21 244 Z"
        fill={withAlpha(palette.shadow, "cc")}
        stroke={paint.metal}
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path d="M28 240 L33 244 L28 248 L23 244 Z" fill={paint.gem} />
      <path d="M28 240 L28 248 M23 244 L33 244" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.6" />
      <circle cx="26.4" cy="242.6" fill="#ffffff" fillOpacity="0.8" r="0.9" />
    </g>
  );

  return (
    <g>
      {paint.defs}
      {renderCorner(false)}
      {renderCorner(true)}
    </g>
  );
}

function CornerRosettes({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const paint = useOrnamentPaint(definition);
  const { palette } = paint;

  // A rosette is petals radiating from a centre, not two overlapping blobs.
  const petals = (cx: number, cy: number, radius: number, count: number, phase: number) =>
    Array.from({ length: count }, (_, index) => {
      const angle = phase + (index * 360) / count;
      return (
        <ellipse
          cx={cx}
          cy={cy - radius * 0.62}
          fill={paint.body}
          key={angle}
          rx={radius * 0.42}
          ry={radius * 0.66}
          stroke={withAlpha(palette.metal, "77")}
          strokeWidth="0.6"
          transform={`rotate(${angle} ${cx} ${cy})`}
        />
      );
    });

  const renderCorner = (mirror = false) => (
    <g filter={paint.glow} transform={mirror ? "translate(180 0) scale(-1 1)" : undefined}>
      {/* Metal leaves sit behind so the petals overlap them. */}
      <path d="M9 255 C13 248 19 246 25 249 C21 259 14 261 9 255 Z" fill={paint.metal} />
      <path d="M28 250 C33 244 40 243 46 247 C40 256 34 257 28 250 Z" fill={paint.metal} opacity="0.82" />
      <path d="M12 253 C16 250 20 249 24 250" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="0.7" />
      {petals(22, 247, 8, 6, 0)}
      <circle cx="22" cy="247" fill={paint.gem} r="3.4" stroke={withAlpha(palette.metal, "cc")} strokeWidth="0.9" />
      <circle cx="20.9" cy="245.8" fill="#ffffff" fillOpacity="0.8" r="0.95" />
      {petals(34, 238, 6.4, 5, 30)}
      <circle cx="34" cy="238" fill={paint.gem} r="2.6" stroke={withAlpha(palette.metal, "bb")} strokeWidth="0.8" />
      <circle cx="33.1" cy="237.1" fill="#ffffff" fillOpacity="0.72" r="0.75" />
    </g>
  );

  return (
    <g>
      {paint.defs}
      {renderCorner(false)}
      {renderCorner(true)}
    </g>
  );
}

function CornerGems({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const paint = useOrnamentPaint(definition);
  const { palette } = paint;

  const renderCorner = (mirror = false) => (
    <g filter={paint.glow} transform={mirror ? "translate(180 0) scale(-1 1)" : undefined}>
      {/* Velvet backing plate. */}
      <path
        d="M11 249 L20 231 L38 225 L47 239 L35 252 L16 258 Z"
        fill={paint.body}
        stroke={paint.metal}
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path d="M11 249 L20 231 L38 225 L47 239 L35 252 L16 258 Z" fill={paint.sheen} />
      {/* Emerald-cut centre stone: bezel, table, step facets, glint. */}
      <path
        d="M21 237 L30 231 L40 238 L35 248 L23 248 Z"
        fill={withAlpha(palette.shadow, "d8")}
        stroke={paint.metal}
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path d="M23 238 L30 233.5 L38 239 L33.5 246.5 L24.5 246.5 Z" fill={paint.gem} />
      <path
        d="M25.5 239.5 L30 236.5 L35.5 240 L33 244.5 L26.5 244.5 Z"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.32"
        strokeWidth="0.7"
      />
      <circle cx="27" cy="238.6" fill="#ffffff" fillOpacity="0.85" r="1.1" />
      {/* Two small accent stones on the rail. */}
      <circle cx="17" cy="252" fill={paint.gem} r="2.1" stroke={withAlpha(palette.metal, "bb")} strokeWidth="0.7" />
      <circle cx="42" cy="243" fill={paint.gem} r="1.9" stroke={withAlpha(palette.metal, "bb")} strokeWidth="0.7" />
      <path d="M17 258 L29 249 L41 251" fill="none" stroke={paint.metal} strokeLinecap="round" strokeWidth="1.6" />
    </g>
  );

  return (
    <g>
      {paint.defs}
      {renderCorner(false)}
      {renderCorner(true)}
    </g>
  );
}

function TopTiara({
  definition,
  previewMode = "default",
}: {
  definition: ProfileFrameDecorationDefinition;
  previewMode?: "default" | "shop";
}) {
  const paint = useOrnamentPaint(definition);
  const { palette } = paint;
  const s = previewMode === "shop" ? 0.92 : 1;

  return (
    <g filter={paint.glow} transform={`scale(${s})`}>
      {paint.defs}
      {/* Band, then the five rising spires drawn as filled tapers rather than
          a single polyline - a tiara is metal volume, not a wire. */}
      <path
        d="M-24 -4 C-16 -15 -8 -18 0 -18 C8 -18 16 -15 24 -4 L24 2 H-24 Z"
        fill={paint.body}
        stroke={paint.metal}
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M-24 -4 C-16 -15 -8 -18 0 -18 C8 -18 16 -15 24 -4 L24 -1 H-24 Z" fill={paint.sheen} />
      <path d="M-3.4 -7 L0 -24 L3.4 -7 Z" fill={paint.metal} stroke={withAlpha(palette.shadow, "88")} strokeWidth="0.6" />
      <path d="M-14.6 -6 L-12 -19 L-9.4 -6 Z" fill={paint.metal} stroke={withAlpha(palette.shadow, "88")} strokeWidth="0.6" />
      <path d="M9.4 -6 L12 -19 L14.6 -6 Z" fill={paint.metal} stroke={withAlpha(palette.shadow, "88")} strokeWidth="0.6" />
      <path d="M-21.6 -4.5 L-19.5 -13 L-17.4 -4.5 Z" fill={paint.metal} opacity="0.9" />
      <path d="M17.4 -4.5 L19.5 -13 L21.6 -4.5 Z" fill={paint.metal} opacity="0.9" />
      {/* Crown stones. */}
      <circle cx="0" cy="-24" fill={paint.gem} r="3" stroke={withAlpha(palette.metal, "cc")} strokeWidth="0.8" />
      <circle cx="-1" cy="-25" fill="#ffffff" fillOpacity="0.85" r="0.9" />
      <circle cx="-12" cy="-19" fill={paint.gem} r="2.4" stroke={withAlpha(palette.metal, "bb")} strokeWidth="0.7" />
      <circle cx="12" cy="-19" fill={paint.gem} r="2.4" stroke={withAlpha(palette.metal, "bb")} strokeWidth="0.7" />
      <circle cx="-19.5" cy="-13" fill={paint.gem} r="1.5" />
      <circle cx="19.5" cy="-13" fill={paint.gem} r="1.5" />
      {/* Pavé line along the band. */}
      <path d="M-20 -3 H20" stroke="#ffffff" strokeOpacity="0.3" strokeDasharray="1 2.6" strokeLinecap="round" strokeWidth="1.1" />
    </g>
  );
}

function TopMedallion({
  definition,
  previewMode = "default",
}: {
  definition: ProfileFrameDecorationDefinition;
  previewMode?: "default" | "shop";
}) {
  const paint = useOrnamentPaint(definition);
  const { palette } = paint;
  const s = previewMode === "shop" ? 0.9 : 1;

  // Pearl count is fixed - the medallion is small enough that more just reads
  // as a fuzzy outline at profile-card size.
  const pearls = Array.from({ length: 14 }, (_, index) => {
    const angle = (index * 360) / 14 - 90;
    const radians = (angle * Math.PI) / 180;
    return { key: angle, x: Math.cos(radians) * 14.6, y: Math.sin(radians) * 14.6 - 11 };
  });

  return (
    <g filter={paint.glow} transform={`scale(${s})`}>
      {paint.defs}
      <path d="M-16 -10 C-10 -20 -4 -24 0 -24 C4 -24 10 -20 16 -10" fill="none" stroke={paint.metal} strokeWidth="1.6" />
      {pearls.map((pearl) => (
        <circle cx={pearl.x} cy={pearl.y} fill={paint.metal} key={pearl.key} r="1.5" />
      ))}
      <path
        d="M0 -25 C7 -25 13 -19 13 -10 C13 -3 7 2 0 3 C-7 2 -13 -3 -13 -10 C-13 -19 -7 -25 0 -25 Z"
        fill={paint.metal}
      />
      <path
        d="M0 -23.2 C6.1 -23.2 11.3 -17.9 11.3 -10 C11.3 -3.7 6.1 0.6 0 1.4 C-6.1 0.6 -11.3 -3.7 -11.3 -10 C-11.3 -17.9 -6.1 -23.2 0 -23.2 Z"
        fill={paint.body}
      />
      {/* Inset heart, cut as a gem rather than a flat accent fill. */}
      <path
        d="M0 -18 C4.6 -18 8.4 -14.7 8.4 -10.2 C8.4 -5.4 4.7 -2.3 0 -0.2 C-4.7 -2.3 -8.4 -5.4 -8.4 -10.2 C-8.4 -14.7 -4.6 -18 0 -18 Z"
        fill={paint.gem}
        stroke={withAlpha(palette.metal, "aa")}
        strokeWidth="0.8"
      />
      <path d="M-3.4 -14.6 C-1.6 -16 0.4 -15.7 1.4 -14.2" fill="none" stroke="#ffffff" strokeOpacity="0.72" strokeLinecap="round" strokeWidth="1.3" />
      <path
        d="M0 -25 C7 -25 13 -19 13 -10 C13 -6.6 11.6 -3.8 9.4 -1.8 C7 -8 3.8 -12 0 -14 C-3.8 -12 -7 -8 -9.4 -1.8 C-11.6 -3.8 -13 -6.6 -13 -10 C-13 -19 -7 -25 0 -25 Z"
        fill={paint.sheen}
      />
      <circle cx="0" cy="-24.5" fill={paint.gem} r="2.6" stroke={withAlpha(palette.metal, "cc")} strokeWidth="0.8" />
      <circle cx="-0.9" cy="-25.3" fill="#ffffff" fillOpacity="0.8" r="0.8" />
    </g>
  );
}

function TopHalo({
  definition,
  previewMode = "default",
}: {
  definition: ProfileFrameDecorationDefinition;
  previewMode?: "default" | "shop";
}) {
  const paint = useOrnamentPaint(definition);
  const { palette } = paint;
  const s = previewMode === "shop" ? 0.9 : 1;

  // Spikes generated on a circle so they stay evenly radial - the old hand
  // written star path was visibly lopsided.
  const spikes = Array.from({ length: 12 }, (_, index) => {
    const angle = (index * 360) / 12;
    const long = index % 2 === 0;
    return { key: angle, length: long ? 17 : 12.5, angle, width: long ? 2.6 : 1.8 };
  });

  return (
    <g filter={paint.glow} transform={`scale(${s})`}>
      {paint.defs}
      <g transform="translate(0 -13)">
        {spikes.map((spike) => (
          <path
            d={`M${-spike.width} 0 L0 ${-spike.length} L${spike.width} 0 Z`}
            fill={paint.metal}
            key={spike.key}
            opacity={spike.width > 2 ? 1 : 0.72}
            transform={`rotate(${spike.angle})`}
          />
        ))}
        <circle cx="0" cy="0" fill={paint.metal} r="10.6" />
        <circle cx="0" cy="0" fill={paint.body} r="9.2" />
        {/* Engraved ring + centre cabochon. */}
        <circle cx="0" cy="0" fill="none" r="6.8" stroke={withAlpha(palette.metal, "9a")} strokeWidth="0.9" />
        <circle cx="0" cy="0" fill={paint.gem} r="4.6" stroke={withAlpha(palette.metal, "cc")} strokeWidth="0.9" />
        <circle cx="-1.5" cy="-1.6" fill="#ffffff" fillOpacity="0.82" r="1.2" />
        <path d="M-9.2 0 A9.2 9.2 0 0 1 9.2 0 Z" fill={paint.sheen} />
      </g>
    </g>
  );
}

function TopAigrette({
  definition,
  previewMode = "default",
}: {
  definition: ProfileFrameDecorationDefinition;
  previewMode?: "default" | "shop";
}) {
  const paint = useOrnamentPaint(definition);
  const { palette } = paint;
  const s = previewMode === "shop" ? 0.92 : 1;

  return (
    <g filter={paint.glow} transform={`scale(${s})`}>
      {paint.defs}
      {/* Feather spray: each plume gets a shaft so it reads as a feather
          instead of a coloured smear. */}
      <path d="M0 1 L0 -8" stroke={paint.metal} strokeLinecap="round" strokeWidth="2.2" />
      <path d="M-2 -6 C-8 -13 -13 -17 -17 -21 C-13 -12 -9 -7 -3 -4" fill={withAlpha(palette.accent, "cc")} />
      <path d="M-3 -5 C-8 -11 -12 -15 -16 -19" fill="none" stroke={withAlpha(palette.metal, "88")} strokeLinecap="round" strokeWidth="0.7" />
      <path d="M2 -8 C7 -16 10 -22 12 -30 C6 -25 2 -18 -1 -10" fill={palette.secondary} />
      <path d="M1 -9 C5 -16 8 -22 11 -28" fill="none" stroke={withAlpha(palette.metal, "9a")} strokeLinecap="round" strokeWidth="0.8" />
      <path d="M0 -7 C-4 -15 -7 -22 -7 -31 C-1 -26 3 -20 4 -11" fill={paint.body} />
      <path d="M-0.5 -8 C-3 -16 -5 -22 -6 -29" fill="none" stroke={withAlpha(palette.metal, "aa")} strokeLinecap="round" strokeWidth="0.9" />
      {/* Barb ticks - three per plume is enough at this size. */}
      <path d="M-4 -14 L-7 -16 M-5.4 -19 L-8.4 -21 M-6.2 -24 L-9 -26" stroke={withAlpha(palette.metal, "77")} strokeLinecap="round" strokeWidth="0.6" />
      <path d="M4 -14 L7.4 -16 M6 -19 L9.4 -21 M7.6 -24 L10.8 -26" stroke={withAlpha(palette.metal, "77")} strokeLinecap="round" strokeWidth="0.6" />
      {/* Clasp holding the spray. */}
      <ellipse cx="0" cy="-4" fill={paint.metal} rx="5.4" ry="4.8" />
      <ellipse cx="0" cy="-4" fill={paint.gem} rx="2.8" ry="2.4" stroke={withAlpha(palette.metal, "cc")} strokeWidth="0.7" />
      <circle cx="-0.9" cy="-4.8" fill="#ffffff" fillOpacity="0.8" r="0.75" />
    </g>
  );
}

function OverlayBeadVeil({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const paint = useOrnamentPaint(definition);
  const { palette } = paint;
  // Twice the strands, and each one is a real string of beads rather than a
  // line with two dots stuck on the end.
  const strands = [-56, -44, -32, -20, -8, 4, 16, 28, 40, 52];

  return (
    <g opacity="0.94">
      {paint.defs}
      <path d="M-62 4 C-38 -1 -16 -2 0 -2 C16 -2 38 -1 62 4" fill="none" stroke={paint.metal} strokeWidth="2.4" />
      <path d="M-62 4 C-38 -1 -16 -2 0 -2 C16 -2 38 -1 62 4" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.8" />
      {strands.map((x, index) => {
        // Alternating lengths with a slight curve toward the centre so the
        // veil hangs instead of sitting as parallel bars.
        const height = 34 + ((index * 7) % 22);
        const drift = x * 0.06;
        const beadCount = Math.max(3, Math.round(height / 9));
        return (
          <g key={x}>
            <path
              d={`M${x} 5 Q${x + drift} ${height * 0.55} ${x + drift * 2} ${height}`}
              fill="none"
              stroke={withAlpha(palette.metal, "9e")}
              strokeLinecap="round"
              strokeWidth="0.9"
            />
            {Array.from({ length: beadCount }, (_, beadIndex) => {
              const t = (beadIndex + 1) / (beadCount + 1);
              return (
                <circle
                  cx={x + drift * 2 * t}
                  cy={5 + (height - 5) * t}
                  fill={paint.gem}
                  key={beadIndex}
                  r={1.5 + t * 0.7}
                />
              );
            })}
            <circle cx={x + drift * 2} cy={height} fill={paint.gem} r="3.1" stroke={withAlpha(palette.metal, "bb")} strokeWidth="0.7" />
            <circle cx={x + drift * 2 - 0.9} cy={height - 1} fill="#ffffff" fillOpacity="0.7" r="0.8" />
          </g>
        );
      })}
    </g>
  );
}

function OverlayChainCurtain({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const paint = useOrnamentPaint(definition);
  const { palette } = paint;
  // Real links along each swag - a chain drawn as a plain stroke is the single
  // biggest reason this one looked cheap.
  const swagLinks = (from: number, to: number, sag: number, count: number, key: string) =>
    Array.from({ length: count }, (_, index) => {
      const t = (index + 0.5) / count;
      const x = from + (to - from) * t;
      const y = 9 + sag * 4 * t * (1 - t);
      const tilt = (index % 2 === 0 ? 32 : -32) + (t - 0.5) * 40;
      return (
        <ellipse
          cx={x}
          cy={y}
          fill="none"
          key={`${key}-${index}`}
          rx="2.6"
          ry="1.5"
          stroke={paint.metal}
          strokeWidth="1.1"
          transform={`rotate(${tilt} ${x} ${y})`}
        />
      );
    });

  return (
    <g opacity="0.92">
      {paint.defs}
      {/* Anchor rosettes. */}
      <circle cx="-58" cy="9" fill={paint.metal} r="4.4" />
      <circle cx="-58" cy="9" fill={paint.gem} r="2.2" />
      <circle cx="58" cy="9" fill={paint.metal} r="4.4" />
      <circle cx="58" cy="9" fill={paint.gem} r="2.2" />
      {swagLinks(-56, 56, 22, 20, "outer")}
      {swagLinks(-44, 44, 30, 16, "inner")}
      <path d="M-46 16 C-34 27 -18 35 0 35 C18 35 34 27 46 16" fill="none" stroke={withAlpha(palette.primary, "6a")} strokeWidth="1.1" />
      {/* Side drops with graduated beads. */}
      {[-1, 1].map((side) => (
        <g key={side}>
          <path d={`M${58 * side} 9 C${53 * side} 30 ${48 * side} 47 ${42 * side} 60`} fill="none" stroke={withAlpha(palette.metal, "9e")} strokeWidth="1.2" />
          {[0.3, 0.55, 0.78].map((t) => (
            <circle cx={(58 - 16 * t) * side} cy={9 + 51 * t} fill={paint.gem} key={t} r={1.4 + t} />
          ))}
          <circle cx={42 * side} cy="60" fill={paint.gem} r="3.4" stroke={withAlpha(palette.metal, "bb")} strokeWidth="0.7" />
          <circle cx={42 * side - 1} cy="59" fill="#ffffff" fillOpacity="0.7" r="0.85" />
        </g>
      ))}
    </g>
  );
}

function OverlayCrystalFacet({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const paint = useOrnamentPaint(definition);
  const { palette } = paint;

  // Crystal only reads as crystal when the facets have different brightnesses.
  // One shell path plus internal facet polygons at varying opacity does that
  // far better than two flat shapes with a seam drawn between them.
  const shard = (mirror: boolean) => (
    <g transform={mirror ? "scale(-1 1)" : undefined}>
      <path
        d="M-68 4 L-18 4 L-3 24 L-16 58 L-58 58 L-72 26 Z"
        fill={withAlpha(palette.primary, "5a")}
        stroke={withAlpha(palette.metal, "9a")}
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path d="M-68 4 L-18 4 L-35 30 L-72 26 Z" fill="#ffffff" fillOpacity="0.16" />
      <path d="M-35 30 L-18 4 L-3 24 L-16 58 Z" fill={withAlpha(palette.secondary, "5e")} />
      <path d="M-72 26 L-35 30 L-58 58 Z" fill={withAlpha(palette.shadow, "4e")} />
      <path d="M-35 30 L-16 58 L-58 58 Z" fill="#ffffff" fillOpacity="0.07" />
      <path
        d="M-18 4 L-35 30 L-16 58 M-72 26 L-35 30 M-58 58 L-35 30"
        fill="none"
        stroke={withAlpha(palette.accent, "80")}
        strokeWidth="1"
      />
      {/* Two hard glints where facets meet. */}
      <path d="M-60 8 L-46 6" stroke="#ffffff" strokeOpacity="0.5" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M-30 36 L-24 48" stroke="#ffffff" strokeOpacity="0.28" strokeLinecap="round" strokeWidth="1.1" />
    </g>
  );

  return (
    <g opacity="0.74">
      {paint.defs}
      {shard(false)}
      {shard(true)}
    </g>
  );
}

function OverlayStageCanopy({
  definition,
  previewMode = "default",
}: {
  definition: ProfileFrameDecorationDefinition;
  previewMode?: "default" | "shop";
}) {
  const paint = useOrnamentPaint(definition);
  const { palette } = paint;
  const depth = previewMode === "shop" ? 40 : 52;
  const hem = depth * 0.32;

  return (
    <g opacity="0.94">
      {paint.defs}
      <path
        d={`M-70 5 C-44 0 -18 -3 0 -3 C18 -3 44 0 70 5 C56 ${depth * 0.15} 36 ${hem} 0 ${hem} C-36 ${hem} -56 ${depth * 0.15} -70 5 Z`}
        fill={paint.body}
        stroke={paint.metal}
        strokeWidth="1.8"
      />
      {/* Gathered pleats - the flat canopy had no fabric in it at all. */}
      {[-56, -42, -28, -14, 0, 14, 28, 42, 56].map((x) => {
        const t = 1 - Math.abs(x) / 70;
        return (
          <path
            d={`M${x} ${-2 - t * 1.2} Q${x * 0.94} ${hem * 0.55} ${x * 0.86} ${hem * (0.62 + t * 0.38)}`}
            fill="none"
            key={x}
            stroke="#ffffff"
            strokeOpacity={x % 28 === 0 ? 0.2 : 0.1}
            strokeLinecap="round"
            strokeWidth="1.2"
          />
        );
      })}
      <path
        d={`M-70 5 C-44 0 -18 -3 0 -3 C18 -3 44 0 70 5 C58 ${depth * 0.1} 40 ${hem * 0.5} 0 ${hem * 0.5} C-40 ${hem * 0.5} -58 ${depth * 0.1} -70 5 Z`}
        fill={paint.sheen}
      />
      <path d="M-54 7 C-38 16 -22 20 0 20 C22 20 38 16 54 7" fill="none" stroke={paint.metal} strokeWidth="1.9" />
      {/* Tiebacks with proper finials. */}
      {[-1, 1].map((side) => (
        <g key={side}>
          <circle cx={50 * side} cy="10" fill={paint.metal} r="3.8" />
          <circle cx={50 * side} cy="10" fill={paint.gem} r="1.9" />
          <path d={`M${50 * side} 13 V${depth}`} stroke={paint.metal} strokeLinecap="round" strokeWidth="1.7" />
          <path
            d={`M${45 * side} ${depth} Q${50 * side} ${depth + 4} ${55 * side} ${depth} Q${50 * side} ${depth + 13} ${45 * side} ${depth} Z`}
            fill={paint.gem}
            stroke={withAlpha(palette.metal, "bb")}
            strokeWidth="0.8"
          />
        </g>
      ))}
    </g>
  );
}

function CornerBows({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);

  const renderBow = (translateX: number) => (
    <g transform={`translate(${translateX} 249) scale(0.92)`}>
      <path d="M0 7 C-8 0 -15 0 -20 6 C-14 12 -8 13 -2 10 Z" fill={palette.primary} />
      <path d="M0 7 C8 0 15 0 20 6 C14 12 8 13 2 10 Z" fill={palette.secondary} />
      <ellipse cx="0" cy="7" fill={palette.metal} rx="4.5" ry="3.8" />
      <path d="M-5 11 L-10 25 L-1 20 L0 30 L2 19 Z" fill={palette.primary} />
      <path d="M5 11 L10 25 L1 20 L0 30 L-2 19 Z" fill={palette.secondary} />
    </g>
  );

  return (
    <g>
      {renderBow(20)}
      {renderBow(160)}
    </g>
  );
}

function TopCrown({
  definition,
  previewMode = "default",
}: {
  definition: ProfileFrameDecorationDefinition;
  previewMode?: "default" | "shop";
}) {
  const palette = getPalette(definition);
  // Drawing relative to (0,0) = attachment point. Base of pin (bottom) at y~0 so it touches the top edge of border when anchor placed at rim.
  // Spikes extend upward (negative y).
  const s = previewMode === "shop" ? 0.9 : 1;

  return (
    <g transform={`scale(${s})`}>
      <path
        d="M-19 -7 L-12 -18 L-4 -9 L0 -22 L4 -9 L12 -18 L19 -7 V0 H-19 Z"
        fill={palette.primary}
        stroke={palette.metal}
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <circle cx="-12" cy="-18" fill={palette.accent} r="2.2" />
      <circle cx="0" cy="-22" fill={palette.accent} r="2.6" />
      <circle cx="12" cy="-18" fill={palette.accent} r="2.2" />
    </g>
  );
}

function TopCrest({
  definition,
  previewMode = "default",
}: {
  definition: ProfileFrameDecorationDefinition;
  previewMode?: "default" | "shop";
}) {
  const palette = getPalette(definition);
  // Relative to (0,0) attach at top center. Base (bottom) at y~0 to touch border top edge. Tip/spike upward negative.
  const s = previewMode === "shop" ? 0.9 : 1;

  return (
    <g transform={`scale(${s})`}>
      <path
        d="M0 -28 L10 -23 V-13 C10 -6 4.5 -2 0 0 C-4.5 -2 -10 -6 -10 -13 V-23 Z"
        fill={palette.primary}
        stroke={palette.metal}
        strokeWidth="1.6"
      />
      <path d="M-5 -16 H5" stroke={palette.accent} strokeWidth="1.8" />
      <circle cx="0" cy="-21" fill={palette.metal} r="2.6" />
    </g>
  );
}

function SideTassels({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const paint = useOrnamentPaint(definition);
  const { palette } = paint;

  // A tassel is a twisted cord, a carved head and a skirt of many threads.
  // The old version was a line, two dots and three ticks.
  const renderTassel = (x: number, mirror: boolean) => (
    <g filter={paint.glow} transform={`translate(${x} 86)${mirror ? " scale(-1 1)" : ""}`}>
      {/* Twisted cord: two offset strands reading as one rope. */}
      <path d="M0 0 C2 40 3 88 1 128" fill="none" stroke={paint.metal} strokeWidth="2.6" />
      <path
        d="M0 0 C2 40 3 88 1 128"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.22"
        strokeDasharray="3 5"
        strokeWidth="2.6"
      />
      {/* Sliding beads. */}
      {[27, 59, 92].map((cy, index) => (
        <g key={cy}>
          <ellipse cx={1 + index * 0.3} cy={cy} fill={paint.metal} rx={4 - index * 0.4} ry={3.2 - index * 0.3} />
          <ellipse cx={1 + index * 0.3} cy={cy} fill={paint.gem} rx={2.1 - index * 0.2} ry={1.6 - index * 0.15} />
        </g>
      ))}
      {/* Carved head with a collar ring. */}
      <path d="M1 128 C-6 130 -8 136 -7.4 142 H9.4 C10 136 8 130 1 128 Z" fill={paint.body} stroke={paint.metal} strokeWidth="1.2" />
      <path d="M1 128 C-6 130 -8 136 -7.4 142 H9.4 C10 136 8 130 1 128 Z" fill={paint.sheen} />
      <path d="M-7.6 142 H9.6" stroke={paint.metal} strokeLinecap="round" strokeWidth="2.2" />
      {/* Skirt: nine threads of varying length, tipped in metal. */}
      {Array.from({ length: 9 }, (_, index) => {
        const offset = (index - 4) * 2.1;
        const length = 15 + Math.round(Math.cos((index - 4) * 0.42) * 6);
        return (
          <g key={index}>
            <path
              d={`M${1 + offset * 0.55} 143 Q${1 + offset} ${143 + length * 0.6} ${1 + offset * 1.25} ${143 + length}`}
              fill="none"
              stroke={index % 2 === 0 ? withAlpha(palette.primary, "e6") : withAlpha(palette.secondary, "d2")}
              strokeLinecap="round"
              strokeWidth="1.5"
            />
            <circle cx={1 + offset * 1.25} cy={143 + length} fill={paint.metal} r="1.1" />
          </g>
        );
      })}
    </g>
  );

  return (
    <g>
      {paint.defs}
      {renderTassel(20, false)}
      {renderTassel(160, true)}
    </g>
  );
}

function PeekingAnimal({
  faceColor,
  innerColor,
  kind,
  mirror = false,
  x,
}: {
  faceColor: string;
  innerColor: string;
  kind:
    | "side-bear-pair"
    | "side-bunny-pair"
    | "side-cat-pair"
    | "side-dog-pair"
    | "side-fox-pair";
  mirror?: boolean;
  x: number;
}) {
  const earLeft = mirror ? 8 : -8;
  const earRight = mirror ? -8 : 8;

  return (
    <g transform={`translate(${x} 221)`}>
      {kind === "side-cat-pair" || kind === "side-fox-pair" ? (
        <>
          <path d={`M${earLeft} -10 L${earLeft - 5} -24 L${earLeft + 2} -16 Z`} fill={faceColor} />
          <path d={`M${earRight} -10 L${earRight + 5} -24 L${earRight - 2} -16 Z`} fill={faceColor} />
          <path d={`M${earLeft} -14 L${earLeft - 2.5} -21 L${earLeft + 0.4} -16.5 Z`} fill={innerColor} />
          <path d={`M${earRight} -14 L${earRight + 2.5} -21 L${earRight - 0.4} -16.5 Z`} fill={innerColor} />
        </>
      ) : null}
      {kind === "side-bunny-pair" ? (
        <>
          <rect x={mirror ? 4 : -8} y={-32} width="7" height="23" rx="4" fill={faceColor} />
          <rect x={mirror ? -11 : 4} y={-32} width="7" height="23" rx="4" fill={faceColor} />
          <rect x={mirror ? 6 : -6} y={-27} width="3" height="14" rx="2" fill={innerColor} />
          <rect x={mirror ? -9 : 6} y={-27} width="3" height="14" rx="2" fill={innerColor} />
        </>
      ) : null}
      {kind === "side-bear-pair" ? (
        <>
          <circle cx="-8" cy="-14" fill={faceColor} r="5.5" />
          <circle cx="8" cy="-14" fill={faceColor} r="5.5" />
          <circle cx="-8" cy="-14" fill={innerColor} r="2.4" />
          <circle cx="8" cy="-14" fill={innerColor} r="2.4" />
        </>
      ) : null}
      {kind === "side-dog-pair" ? (
        <>
          <ellipse cx="-12" cy="-9" fill={faceColor} rx="5" ry="10" transform="rotate(-18 -12 -9)" />
          <ellipse cx="12" cy="-9" fill={faceColor} rx="5" ry="10" transform="rotate(18 12 -9)" />
          <ellipse cx="-12" cy="-9" fill={innerColor} rx="2" ry="5" transform="rotate(-18 -12 -9)" />
          <ellipse cx="12" cy="-9" fill={innerColor} rx="2" ry="5" transform="rotate(18 12 -9)" />
        </>
      ) : null}
      <circle cx="0" cy="0" fill={faceColor} r={kind === "side-fox-pair" ? 18 : 16} />
      <circle cx="-5" cy="-2" fill="#111827" r="1.7" />
      <circle cx="5" cy="-2" fill="#111827" r="1.7" />
      <ellipse cx="0" cy="5" fill={innerColor} rx="5.5" ry="4.2" />
      <circle cx="0" cy="4.6" fill="#111827" r="1.2" />
      <path d="M-9 16 L-9 30 H-1 V22 H1 V30 H9 V16 Z" fill={faceColor} />
      <rect x="-7" y="24" width="4" height="7" rx="2" fill={innerColor} />
      <rect x="3" y="24" width="4" height="7" rx="2" fill={innerColor} />
    </g>
  );
}

/**
 * The one side pair that is a photograph rather than drawn shapes: the plush
 * itself, mirrored on the right so the two face inward like the SVG pairs do.
 */
function SidePlushPair() {
  return (
    <g>
      <image height="70" href={PLUSH_IMAGE_PATH} width="70" x="-10" y="186" />
      <image
        height="70"
        href={PLUSH_IMAGE_PATH}
        transform="scale(-1 1)"
        width="70"
        x="-190"
        y="186"
      />
    </g>
  );
}

function SideAnimals({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  if (definition.motif === "side-plush-pair") {
    return <SidePlushPair />;
  }

  const palette = getPalette(definition);
  const animalKind = definition.motif as
    | "side-bear-pair"
    | "side-bunny-pair"
    | "side-cat-pair"
    | "side-dog-pair"
    | "side-fox-pair";

  return (
    <g>
      <PeekingAnimal
        faceColor={palette.primary}
        innerColor={palette.accent}
        kind={animalKind}
        x={25}
      />
      <PeekingAnimal
        faceColor={palette.secondary}
        innerColor={palette.accent}
        kind={animalKind}
        mirror
        x={155}
      />
    </g>
  );
}

function OverlayLace({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);
  const scallops = Array.from({ length: 8 }, (_, index) => 20 + index * 20);

  // Drawn relative to (0,0) = bottom-center attachment point.
  // Lace hem/frill positioned higher inside the lower frame (pulled up from bottom edge).
  // Avoids excessive downward sagging. Main line ~y=-25.
  return (
    <g opacity="0.9">
      <path
        d="M18 -25 H162"
        stroke={withAlpha(palette.primary, "bb")}
        strokeLinecap="round"
        strokeWidth="2"
      />
      {scallops.map((cx) => (
        <path
          d={`M${cx - 10} -25 C${cx - 7} -12 ${cx + 7} -12 ${cx + 10} -25`}
          fill="none"
          key={cx}
          stroke={palette.secondary}
          strokeWidth="1.7"
        />
      ))}
      <path
        d="M26 -25 V-8 M154 -25 V-8"
        stroke={withAlpha(palette.accent, "cc")}
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </g>
  );
}

function OverlayDrape({
  definition,
  previewMode = "default",
}: {
  definition: ProfileFrameDecorationDefinition;
  previewMode?: "default" | "shop";
}) {
  const palette = getPalette(definition);

  // Now drawn relative to (0,0) = attachment point (bottom-center for drapes).
  // Clasp at ~ y=0 , body extends +y downward outside frame.
  // Shifted from original global coords (x-90, y-51) for relative drawing.

  if (previewMode === "shop") {
    return (
      <g opacity="0.8">
        <path
          d="M-76 -21 C-76 19 -70 65 -56 98 C-49 114 -39 124 -24 132 C-37 104 -43 67 -46 -1 Z"
          fill={withAlpha(palette.primary, "c8")}
        />
        <path
          d="M76 -21 C76 19 70 65 56 98 C49 114 39 124 24 132 C37 104 43 67 46 -1 Z"
          fill={withAlpha(palette.secondary, "c8")}
        />
        <path
          d="M-47 -1 C-41 -5 -35 -6 -28 -4"
          fill="none"
          stroke={withAlpha(palette.accent, "c2")}
          strokeWidth="1.6"
        />
        <path
          d="M47 -1 C41 -5 35 -6 28 -4"
          fill="none"
          stroke={withAlpha(palette.accent, "c2")}
          strokeWidth="1.6"
        />
        <circle cx="-46" cy="-1.5" fill={palette.metal} r="3.8" />
        <circle cx="46" cy="-1.5" fill={palette.metal} r="3.8" />
      </g>
    );
  }

  return (
    <g opacity="0.88">
      <path
        d="M-72 -19 C-72 25 -60 78 -38 115 C-30 128 -19 135 -6 139 C-26 113 -37 70 -43 1 Z"
        fill={withAlpha(palette.primary, "d2")}
      />
      <path
        d="M72 -19 C72 25 60 78 38 115 C30 128 19 135 6 139 C26 113 37 70 43 1 Z"
        fill={withAlpha(palette.secondary, "d2")}
      />
      <path
        d="M-44 1 C-36 -3 -29 -4 -20 -2"
        fill="none"
        stroke={withAlpha(palette.accent, "cc")}
        strokeWidth="1.8"
      />
      <path
        d="M44 1 C36 -3 29 -4 20 -2"
        fill="none"
        stroke={withAlpha(palette.accent, "cc")}
        strokeWidth="1.8"
      />
      <circle cx="-43" cy="0" fill={palette.metal} r="4.2" />
      <circle cx="43" cy="0" fill={palette.metal} r="4.2" />
    </g>
  );
}

type ParticleSpec = {
  animationDelay: string;
  animationDuration: string;
  color: string;
  delay: string;
  duration: number;
  leftPercent: number;
  opacity: number;
  scale: number;
  size: number;
  topPercent: number;
  translateX: number;
  translateY: number;
};

const particleSpecCache = new Map<string, ParticleSpec[]>();

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mediaQuery.matches);

    update();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  return prefersReducedMotion;
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildParticleSpecs(definition: ProfileFrameDecorationDefinition): ParticleSpec[] {
  const cached = particleSpecCache.get(definition.id);

  if (cached) {
    return cached;
  }

  const seededRandom = createSeededRandom(hashString(definition.id));
  const palette = getPalette(definition);
  const totalParticles = (() => {
    switch (definition.motif) {
      case "particles-dust":
        return 12;
      case "particles-hearts":
      case "particles-petals":
        return 10;
      case "particles-embers":
        return 12;
      default:
        return 8;
    }
  })();

  const specs = Array.from({ length: totalParticles }, (_, index) => {
    const duration = 4.8 + seededRandom() * 3.8;
    const delay = `${(seededRandom() * -4.5).toFixed(2)}s`;

    return {
      animationDelay: delay,
      animationDuration: `${duration.toFixed(2)}s`,
      color: index % 2 === 0 ? palette.primary : palette.secondary,
      delay,
      duration,
      leftPercent: 6 + seededRandom() * 88,
      opacity: 0.4 + seededRandom() * 0.42,
      scale: 0.76 + seededRandom() * 0.56,
      size: 5 + Math.round(seededRandom() * 4),
      topPercent: 6 + seededRandom() * 88,
      translateX: -8 + seededRandom() * 16,
      translateY: -14 + seededRandom() * 16,
    };
  });

  particleSpecCache.set(definition.id, specs);
  return specs;
}

const ParticleLayer = memo(function ParticleLayer({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);
  const prefersReducedMotion = usePrefersReducedMotion();
  const specs = useMemo(() => buildParticleSpecs(definition), [definition.id]);
  const visibleSpecs = prefersReducedMotion ? specs.slice(0, Math.min(4, specs.length)) : specs;

  const renderShape = (size: number, key: string) => {
    switch (definition.motif) {
      case "particles-hearts":
        return (
          <path
            d={`M0 ${size * 0.35} C0 ${size * 0.1} ${size * 0.22} 0 ${size * 0.44} 0 C${size * 0.62} 0 ${size * 0.74} ${size * 0.12} ${size * 0.8} ${size * 0.23} C${size * 0.86} ${size * 0.12} ${size * 0.98} 0 ${size * 1.16} 0 C${size * 1.38} 0 ${size * 1.6} ${size * 0.14} ${size * 1.6} ${size * 0.35} C${size * 1.6} ${size * 0.66} ${size * 1.23} ${size * 0.96} ${size * 0.8} ${size * 1.34} C${size * 0.37} ${size * 0.96} 0 ${size * 0.66} 0 ${size * 0.35} Z`}
            fill={key}
          />
        );
      case "particles-petals":
        return (
          <>
            <ellipse
              cx={size * 0.54}
              cy={size * 0.34}
              fill={withAlpha(key, "dd")}
              rx={size * 0.54}
              ry={size * 0.22}
              transform={`rotate(-34 ${size * 0.54} ${size * 0.34})`}
            />
            <path
              d={`M${size * 0.08} ${size * 0.68} C${size * 0.32} ${size * 0.38} ${size * 0.66} ${size * 0.34} ${size * 1.02} ${size * 0.72} C${size * 0.72} ${size * 0.98} ${size * 0.36} ${size * 0.98} ${size * 0.08} ${size * 0.68} Z`}
              fill={key}
            />
          </>
        );
      case "particles-dust":
        return (
          <>
            <circle cx={size * 0.45} cy={size * 0.45} fill={key} r={size * 0.18} />
            <path
              d={`M${size * 0.45} 0 L${size * 0.58} ${size * 0.3} L${size * 0.9} ${size * 0.45} L${size * 0.58} ${size * 0.6} L${size * 0.45} ${size * 0.92} L${size * 0.32} ${size * 0.6} L0 ${size * 0.45} L${size * 0.32} ${size * 0.3} Z`}
              fill={withAlpha(palette.accent, "c8")}
            />
            <path
              d={`M${size * 0.45} ${size * 0.14} V${size * 0.76} M${size * 0.14} ${size * 0.45} H${size * 0.76}`}
              stroke={withAlpha(key, "aa")}
              strokeLinecap="round"
              strokeWidth={Math.max(1, size * 0.08)}
            />
          </>
        );
      case "particles-embers":
        return (
          <>
            <ellipse
              cx={size * 0.46}
              cy={size * 0.58}
              fill={key}
              rx={size * 0.36}
              ry={size * 0.28}
            />
            <ellipse
              cx={size * 0.54}
              cy={size * 0.36}
              fill={withAlpha(palette.accent, "d4")}
              rx={size * 0.22}
              ry={size * 0.18}
            />
            <path
              d={`M${size * 0.46} ${size * 0.16} C${size * 0.62} ${size * 0.02} ${size * 0.76} ${size * 0.16} ${size * 0.74} ${size * 0.34} C${size * 0.7} ${size * 0.5} ${size * 0.56} ${size * 0.58} ${size * 0.46} ${size * 0.5} C${size * 0.34} ${size * 0.4} ${size * 0.34} ${size * 0.24} ${size * 0.46} ${size * 0.16} Z`}
              fill={withAlpha(palette.secondary, "dc")}
            />
          </>
        );
      default:
        return (
          <path
            d={`M${size * 0.45} 0 L${size * 0.86} ${size * 0.45} L${size * 0.45} ${size * 0.9} L0 ${size * 0.45} Z`}
            fill={key}
          />
        );
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[17] overflow-hidden rounded-[inherit]">
      {visibleSpecs.map((spec, index) => {
        const particleStyle = {
          animation: prefersReducedMotion
            ? "none"
            : `profileFrameParticleFloat ${spec.animationDuration} ease-in-out infinite`,
          animationDelay: spec.animationDelay,
          left: `${spec.leftPercent}%`,
          opacity: spec.opacity,
          top: `${spec.topPercent}%`,
          transform: `translate(-50%, -50%) translate3d(${spec.translateX}px, ${spec.translateY}px, 0) scale(${spec.scale})`,
        } satisfies CSSProperties;

        return (
          <div
            aria-hidden="true"
            className="absolute transform-gpu"
            key={`${definition.id}-${index}`}
            style={particleStyle}
          >
            <svg
              height={Math.round(spec.size * 1.8)}
              viewBox={`0 0 ${Math.round(spec.size * 1.7)} ${Math.round(spec.size * 1.7)}`}
              width={Math.round(spec.size * 1.8)}
            >
              {renderShape(spec.size, spec.color)}
            </svg>
          </div>
        );
      })}
    </div>
  );
});

function BottomDecoration({
  definition,
  previewMode = "default",
}: {
  definition: ProfileFrameDecorationDefinition;
  previewMode?: "default" | "shop";
}) {
  const extraY = previewMode === "shop" ? 2 : 0;
  const content = (() => {
    switch (definition.motif) {
      case "festoon-medallion":
        return <g transform={`translate(0 ${extraY})`}><FestoonMedallion definition={definition} /></g>;
      case "jeweled-locket":
        return <g transform={`translate(0 ${extraY})`}><JeweledLocket definition={definition} /></g>;
      case "cathedral-tassel":
        return <g transform={`translate(0 ${extraY})`}><CathedralTassel definition={definition} /></g>;
      case "opera-rose-swag":
        return <g transform={`translate(0 ${extraY})`}><OperaRoseSwag definition={definition} /></g>;
      default:
        return null;
    }
  })();

  return content;
}

export function ProfileFrameOrnaments({
  equippedCosmeticIds = {},
  previewItem = null,
  previewMode = "default",
}: ProfileFrameOrnamentsProps) {
  const items = getDecorationItems(equippedCosmeticIds, previewItem);

  const renderAttached = (
    def: ProfileFrameDecorationDefinition | null,
    children: ReactNode,
  ) => {
    if (!def) return null;
    const att = resolveFrameAttachment(def);
    const tx = att.x;
    const ty = att.y;
    let transform = `translate(${tx} ${ty})`;
    if (att.scale !== 1) transform += ` scale(${att.scale})`;
    if (att.rotation) transform += ` rotate(${att.rotation})`;

    return (
      <DecorationSvg className={`z-[${att.zIndex}]`}>
        <g transform={transform}>{children}</g>
      </DecorationSvg>
    );
  };

  return (
    <>
      {items.overlay ? (
        renderAttached(items.overlay, (() => {
          switch (items.overlay?.motif) {
            case "overlay-bead-veil":
              return <OverlayBeadVeil definition={items.overlay} />;
            case "overlay-chain-curtain":
              return <OverlayChainCurtain definition={items.overlay} />;
            case "overlay-crystal-facet":
              return <OverlayCrystalFacet definition={items.overlay} />;
            case "overlay-stage-canopy":
              return <OverlayStageCanopy definition={items.overlay} previewMode={previewMode} />;
            default:
              return null;
          }
        })())
      ) : null}
      {items.particles ? <ParticleLayer definition={items.particles} /> : null}
      {items.side ? (
        <DecorationSvg className="z-[19]">
          {items.side.motif === "side-tassels" ? (
            <SideTassels definition={items.side} />
          ) : (
            <SideAnimals definition={items.side} />
          )}
        </DecorationSvg>
      ) : null}
      {items.corner ? (
        <DecorationSvg className="z-[20]">
          {(() => {
            switch (items.corner?.motif) {
              case "corner-filigree":
                return <CornerFiligree definition={items.corner} />;
              case "corner-claws":
                return <CornerClaws definition={items.corner} />;
              case "corner-rosette":
                return <CornerRosettes definition={items.corner} />;
              case "corner-gems":
                return <CornerGems definition={items.corner} />;
              default:
                return null;
            }
          })()}
        </DecorationSvg>
      ) : null}
      {items.top ? (
        renderAttached(items.top, (() => {
          switch (items.top?.motif) {
            case "top-tiara":
              return <TopTiara definition={items.top} previewMode={previewMode} />;
            case "top-medallion":
              return <TopMedallion definition={items.top} previewMode={previewMode} />;
            case "top-halo":
              return <TopHalo definition={items.top} previewMode={previewMode} />;
            case "top-aigrette":
              return <TopAigrette definition={items.top} previewMode={previewMode} />;
            default:
              return null;
          }
        })())
      ) : null}
      {items.bottom ? (
        renderAttached(items.bottom, <BottomDecoration definition={items.bottom} previewMode={previewMode} />)
      ) : null}
    </>
  );
}

export function PrincipessaShowcasePreview({
  className,
  equippedAvatarSlots = {},
  equippedFullSetId = null,
  equippedCosmeticIds = {},
  hasUncensoredAvatar = false,
  previewItem = null,
  previewMode = "shop",
}: PrincipessaShowcasePreviewProps) {
  const previewCosmeticIds = getPreviewCosmeticIds(
    equippedCosmeticIds,
    previewItem,
  );
  const borderItem = getCosmeticItem(previewCosmeticIds["profile-border"] ?? "");
  const background = getAvatarBackgroundPresentation(
    getCosmeticItem(previewCosmeticIds["avatar-background"] ?? ""),
  );
  const borderPresentation = getProfileBorderFramePresentation(borderItem);

  return (
    <ProfileBorderFrame
      className={`relative aspect-[180/285] overflow-visible rounded-[1.45rem] bg-[linear-gradient(180deg,rgba(12,5,18,0.95),rgba(42,11,48,0.74),rgba(5,2,7,0.96))] shadow-[0_0_28px_rgba(217,70,239,0.14)] ${className ?? ""}`}
      contentClassName="overflow-hidden rounded-[calc(1.45rem-3px)] bg-black/42"
      overlay={
        <ProfileFrameOrnaments
          equippedCosmeticIds={previewCosmeticIds}
          previewMode={previewMode}
        />
      }
      presentation={borderPresentation}
    >
      <LayeredAvatar
        alt="Principessa showcase preview"
        backgroundOverlayPath={background.backgroundOverlayPath}
        backgroundPath={background.backgroundPath}
        backgroundStyle={background.backgroundStyle}
        className="absolute inset-0"
        equipped={equippedAvatarSlots}
        equippedFullSetId={equippedFullSetId}
        hasUncensored={hasUncensoredAvatar}
        imageClassName="object-contain object-bottom"
      />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
    </ProfileBorderFrame>
  );
}

export function hasRenderableProfileFramePreview(item: CosmeticItem | null) {
  if (!item) {
    return false;
  }

  return item.type === "profile-border" || isProfileFrameCosmeticType(item.type);
}
