"use client";

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
import {
  getProfileFrameDecorationDefinition,
  isProfileFrameCosmeticType,
  resolveFrameAttachment,
  type FrameAttachmentAnchor,
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
  const palette = getPalette(definition);

  const renderTassel = (x: number) => (
    <g transform={`translate(${x} 86)`}>
      <path d="M0 0 C2 40 3 88 1 130" fill="none" stroke={palette.primary} strokeWidth="2.2" />
      <circle cx="0" cy="27" fill={palette.metal} r="3.2" />
      <circle cx="1" cy="59" fill={palette.metal} r="2.8" />
      <path d="M0 130 L-7 144 H7 Z" fill={palette.secondary} />
      <path d="M-5 143 L-8 154 M0 143 L0 156 M5 143 L8 154" stroke={palette.accent} strokeWidth="1.5" />
    </g>
  );

  return (
    <g>
      {renderTassel(20)}
      {renderTassel(160)}
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

function SideAnimals({ definition }: { definition: ProfileFrameDecorationDefinition }) {
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
  // For backward compatibility with remaining global paths, compensate x-90 and y shift.
  // (Some bottom motifs updated to relative; this keeps others working until full refactor.)
  const extraY = previewMode === "shop" ? 2 : 0;
  const content = (() => {
    switch (definition.motif) {
      case "ribbon-bow":
        return <g transform={`translate(0 ${extraY})`}><RibbonBow definition={definition} /></g>;
      case "hanging-heart-lock":
        return <g transform={`translate(0 ${extraY})`}><HangingHeartLock definition={definition} /></g>;
      case "hanging-moon-bell":
        return <g transform={`translate(0 ${extraY})`}><HangingMoonBell definition={definition} /></g>;
      case "wax-seal":
        return <g transform={`translate(0 ${extraY})`}><WaxSeal definition={definition} /></g>;
      case "wax-crest":
        return <g transform={`translate(0 ${extraY})`}><WaxSeal crest definition={definition} /></g>;
      case "gem-clasp":
        return <g transform={`translate(0 ${extraY})`}><GemClasp definition={definition} /></g>;
      case "rose-cluster":
        return <g transform={`translate(0 ${extraY})`}><RoseCluster definition={definition} /></g>;
      default:
        return null;
    }
  })();

  return <g transform="translate(-90 -240)">{content}</g>;
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
    defaultAnchor: FrameAttachmentAnchor = "bottom-center",
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
        renderAttached(items.overlay, items.overlay.motif === "overlay-lace" ? (
          <OverlayLace definition={items.overlay} />
        ) : (
          <OverlayDrape definition={items.overlay} previewMode={previewMode} />
        ), "bottom-center")
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
          <CornerBows definition={items.corner} />
        </DecorationSvg>
      ) : null}
      {items.top ? (
        renderAttached(items.top, items.top.motif === "top-crown" ? (
          <TopCrown definition={items.top} previewMode={previewMode} />
        ) : (
          <TopCrest definition={items.top} previewMode={previewMode} />
        ), "top-center")
      ) : null}
      {items.bottom ? (
        renderAttached(items.bottom, <BottomDecoration definition={items.bottom} previewMode={previewMode} />, "bottom-center")
      ) : null}
    </>
  );
}

export function PrincipessaShowcasePreview({
  className,
  equippedAvatarSlots = {},
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
