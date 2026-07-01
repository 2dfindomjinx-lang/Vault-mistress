"use client";

import type { ReactNode } from "react";
import { LayeredAvatar } from "@/components/LayeredAvatar";
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
  type ProfileFrameDecorationDefinition,
} from "@/lib/profile-frame-cosmetics";

type EquippedCosmeticIds = Partial<Record<CosmeticType, string>>;

type ProfileFrameOrnamentsProps = {
  equippedCosmeticIds?: EquippedCosmeticIds;
  previewItem?: CosmeticItem | null;
};

type PrincipessaShowcasePreviewProps = {
  className?: string;
  equippedAvatarSlots?: EquippedAvatarSlots;
  equippedCosmeticIds?: EquippedCosmeticIds;
  hasUncensoredAvatar?: boolean;
  previewItem?: CosmeticItem | null;
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

function getBorderPresentation(item: CosmeticItem | null) {
  const presentation = getProfileBorderFramePresentation(item);

  return {
    className: presentation.ringClassName,
    style: presentation.ringStyle,
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
      className={`absolute inset-0 h-full w-full pointer-events-none ${className}`}
      viewBox="0 0 180 285"
    >
      {children}
    </svg>
  );
}

function RibbonBow({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);

  return (
    <g>
      <path
        d="M90 236 C72 222 56 220 44 233 C57 247 71 249 85 241 L90 247 Z"
        fill={palette.primary}
        stroke={palette.accent}
        strokeWidth="1.6"
      />
      <path
        d="M90 236 C108 222 124 220 136 233 C123 247 109 249 95 241 L90 247 Z"
        fill={palette.secondary}
        stroke={palette.accent}
        strokeWidth="1.6"
      />
      <path
        d="M75 240 L63 270 L81 260 L86 281 L90 251 Z"
        fill={palette.primary}
        stroke={palette.accent}
        strokeWidth="1.4"
      />
      <path
        d="M105 240 L117 270 L99 260 L94 281 L90 251 Z"
        fill={palette.secondary}
        stroke={palette.accent}
        strokeWidth="1.4"
      />
      <ellipse cx="90" cy="238" fill={palette.metal} rx="11" ry="8.2" />
      <ellipse
        cx="90"
        cy="238"
        fill={withAlpha(palette.accent, "aa")}
        rx="4.4"
        ry="4.4"
      />
    </g>
  );
}

function HangingHeartLock({ definition }: { definition: ProfileFrameDecorationDefinition }) {
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
      <path d="M90 241 L90 260" stroke={palette.metal} strokeLinecap="round" strokeWidth="2" />
      <path
        d="M82 265 C82 259.5 86 256 90 256 C94 256 98 259.5 98 265 V274 H82 Z"
        fill={palette.primary}
        stroke={palette.metal}
        strokeWidth="1.5"
      />
      <path
        d="M86 267 C86 264.6 87.8 263.2 90 263.2 C92.2 263.2 94 264.6 94 267 C94 269.2 92.1 270.8 90 272.5 C87.9 270.8 86 269.2 86 267 Z"
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
    <g transform={`translate(${translateX} 240)`}>
      <path d="M0 7 C-8 0 -15 0 -20 6 C-14 12 -8 13 -2 10 Z" fill={palette.primary} />
      <path d="M0 7 C8 0 15 0 20 6 C14 12 8 13 2 10 Z" fill={palette.secondary} />
      <ellipse cx="0" cy="7" fill={palette.metal} rx="4.5" ry="3.8" />
      <path d="M-5 11 L-10 25 L-1 20 L0 30 L2 19 Z" fill={palette.primary} />
      <path d="M5 11 L10 25 L1 20 L0 30 L-2 19 Z" fill={palette.secondary} />
    </g>
  );

  return (
    <g>
      {renderBow(34)}
      {renderBow(146)}
    </g>
  );
}

function TopCrown({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);

  return (
    <g transform="translate(90 22)">
      <path
        d="M-19 9 L-12 -2 L-4 7 L0 -6 L4 7 L12 -2 L19 9 V16 H-19 Z"
        fill={palette.primary}
        stroke={palette.metal}
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <circle cx="-12" cy="-2" fill={palette.accent} r="2.2" />
      <circle cx="0" cy="-6" fill={palette.accent} r="2.6" />
      <circle cx="12" cy="-2" fill={palette.accent} r="2.2" />
    </g>
  );
}

function TopCrest({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);

  return (
    <g transform="translate(90 24)">
      <path
        d="M0 -6 L10 -1 V9 C10 16 4.5 20 0 22 C-4.5 20 -10 16 -10 9 V-1 Z"
        fill={palette.primary}
        stroke={palette.metal}
        strokeWidth="1.6"
      />
      <path d="M-5 6 H5" stroke={palette.accent} strokeWidth="1.8" />
      <circle cx="0" cy="1" fill={palette.metal} r="2.6" />
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

  return (
    <g opacity="0.9">
      <path
        d="M18 238 H162"
        stroke={withAlpha(palette.primary, "bb")}
        strokeLinecap="round"
        strokeWidth="2"
      />
      {scallops.map((cx) => (
        <path
          d={`M${cx - 10} 238 C${cx - 7} 249 ${cx + 7} 249 ${cx + 10} 238`}
          fill="none"
          key={cx}
          stroke={palette.secondary}
          strokeWidth="1.7"
        />
      ))}
      <path
        d="M26 238 V255 M154 238 V255"
        stroke={withAlpha(palette.accent, "cc")}
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </g>
  );
}

function OverlayDrape({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);

  return (
    <g opacity="0.88">
      <path
        d="M18 32 C18 76 30 129 52 166 C60 179 71 186 84 190 C64 164 53 121 47 52 Z"
        fill={withAlpha(palette.primary, "d2")}
      />
      <path
        d="M162 32 C162 76 150 129 128 166 C120 179 109 186 96 190 C116 164 127 121 133 52 Z"
        fill={withAlpha(palette.secondary, "d2")}
      />
      <path
        d="M46 52 C54 48 61 47 70 49"
        fill="none"
        stroke={withAlpha(palette.accent, "cc")}
        strokeWidth="1.8"
      />
      <path
        d="M134 52 C126 48 119 47 110 49"
        fill="none"
        stroke={withAlpha(palette.accent, "cc")}
        strokeWidth="1.8"
      />
      <circle cx="47" cy="51" fill={palette.metal} r="4.2" />
      <circle cx="133" cy="51" fill={palette.metal} r="4.2" />
    </g>
  );
}

function ParticleLayer({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const palette = getPalette(definition);
  const specs = [
    { delay: "0s", left: 18, size: 8, top: 30 },
    { delay: "-0.8s", left: 78, size: 6, top: 54 },
    { delay: "-1.4s", left: 130, size: 10, top: 92 },
    { delay: "-2.1s", left: 40, size: 7, top: 138 },
    { delay: "-0.4s", left: 142, size: 7, top: 176 },
    { delay: "-1.8s", left: 86, size: 9, top: 212 },
  ];

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
          <ellipse
            cx={size * 0.6}
            cy={size * 0.45}
            fill={key}
            rx={size * 0.55}
            ry={size * 0.32}
            transform={`rotate(-28 ${size * 0.6} ${size * 0.45})`}
          />
        );
      case "particles-dust":
        return (
          <>
            <circle cx={size * 0.45} cy={size * 0.45} fill={key} r={size * 0.28} />
            <path
              d={`M${size * 0.45} 0 L${size * 0.55} ${size * 0.3} L${size * 0.9} ${size * 0.45} L${size * 0.55} ${size * 0.6} L${size * 0.45} ${size * 0.9} L${size * 0.3} ${size * 0.6} L0 ${size * 0.45} L${size * 0.3} ${size * 0.3} Z`}
              fill={withAlpha(palette.accent, "aa")}
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
    <div className="absolute inset-0 z-[17] overflow-hidden pointer-events-none">
      <svg className="h-full w-full" viewBox="0 0 180 285">
        {specs.map((spec, index) => (
          <g
            key={`${definition.id}-${index}`}
            style={{
              animation: `profileFrameParticleFloat ${4.8 + index * 0.35}s ease-in-out infinite`,
              animationDelay: spec.delay,
              transformBox: "fill-box",
              transformOrigin: "center",
            }}
            transform={`translate(${spec.left} ${spec.top})`}
          >
            {renderShape(spec.size, index % 2 === 0 ? palette.primary : palette.secondary)}
          </g>
        ))}
      </svg>
    </div>
  );
}

function BottomDecoration({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  switch (definition.motif) {
    case "ribbon-bow":
      return <RibbonBow definition={definition} />;
    case "hanging-heart-lock":
      return <HangingHeartLock definition={definition} />;
    case "hanging-moon-bell":
      return <HangingMoonBell definition={definition} />;
    case "wax-seal":
      return <WaxSeal definition={definition} />;
    case "wax-crest":
      return <WaxSeal crest definition={definition} />;
    case "gem-clasp":
      return <GemClasp definition={definition} />;
    case "rose-cluster":
      return <RoseCluster definition={definition} />;
    default:
      return null;
  }
}

export function ProfileFrameOrnaments({
  equippedCosmeticIds = {},
  previewItem = null,
}: ProfileFrameOrnamentsProps) {
  const items = getDecorationItems(equippedCosmeticIds, previewItem);

  return (
    <>
      {items.overlay ? (
        <DecorationSvg className="z-[16]">
          {items.overlay.motif === "overlay-lace" ? (
            <OverlayLace definition={items.overlay} />
          ) : (
            <OverlayDrape definition={items.overlay} />
          )}
        </DecorationSvg>
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
        <DecorationSvg className="z-[20]">
          {items.top.motif === "top-crown" ? (
            <TopCrown definition={items.top} />
          ) : (
            <TopCrest definition={items.top} />
          )}
        </DecorationSvg>
      ) : null}
      {items.bottom ? (
        <DecorationSvg className="z-[21]">
          <BottomDecoration definition={items.bottom} />
        </DecorationSvg>
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
}: PrincipessaShowcasePreviewProps) {
  const previewCosmeticIds = getPreviewCosmeticIds(
    equippedCosmeticIds,
    previewItem,
  );
  const borderItem = getCosmeticItem(previewCosmeticIds["profile-border"] ?? "");
  const background = getAvatarBackgroundPresentation(
    getCosmeticItem(previewCosmeticIds["avatar-background"] ?? ""),
  );
  const border = getBorderPresentation(borderItem);

  return (
    <div
      className={`relative aspect-[180/285] overflow-hidden rounded-[1.45rem] bg-[linear-gradient(180deg,rgba(12,5,18,0.95),rgba(42,11,48,0.74),rgba(5,2,7,0.96))] shadow-[0_0_28px_rgba(217,70,239,0.14)] ${className ?? ""}`}
    >
      <div aria-hidden="true" className={border.className} style={border.style} />
      <div className="absolute inset-[3px] overflow-hidden rounded-[calc(1.45rem-3px)] bg-black/42">
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
      </div>
      <ProfileFrameOrnaments equippedCosmeticIds={previewCosmeticIds} />
    </div>
  );
}

export function hasRenderableProfileFramePreview(item: CosmeticItem | null) {
  if (!item) {
    return false;
  }

  return item.type === "profile-border" || isProfileFrameCosmeticType(item.type);
}
