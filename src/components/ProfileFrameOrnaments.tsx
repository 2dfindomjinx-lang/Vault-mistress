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

function DecorationSvg({ children, className = "z-[18]", zIndex }: { children: ReactNode; className?: string; zIndex?: number }) {
  return (
    <svg
      aria-hidden="true"
      className={`absolute inset-0 h-full w-full pointer-events-none overflow-visible ${className}`}
      style={{ overflow: "visible", zIndex }}
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
  const p = useOrnamentPaint(definition);
  const heart = definition.id.includes("heart");
  const prism = definition.id.includes("prism");
  const seal = definition.id.includes("seal");
  return <g filter={p.glow}>{p.defs}
    {[-1, 1].map(side => <g key={side} transform={`scale(${side} 1)`}>
      <path d="M10 -7 C26 -22 46 -18 60 -7 L48 1 C34 -10 22 -1 12 4Z" fill={p.body} stroke={p.metal} strokeWidth=".8"/>
      <path d="M16 -6 Q34 -16 54 -8 M18 0 Q35 -7 46 -2" fill="none" stroke={p.sheen} strokeWidth="2"/>
      <path d="M13 7 Q34 22 55 0 M18 9 Q35 17 47 4" fill="none" stroke={p.metal} strokeWidth=".85"/>
      {[24,34,44].map((x,i)=><circle key={x} cx={x} cy={12-i*1.8} r="1.4" fill={p.gem}/>)}
      <path d="M52 1 V14" stroke={p.metal} strokeWidth=".8"/><path d="M52 11 Q46 18 52 21 Q58 18 52 11" fill={p.gem} stroke={p.metal} strokeWidth=".6"/>
    </g>)}
    <path d={heart ? "M0 16C-27 0-15-21 0-10C15-21 27 0 0 16Z" : prism ? "M0-20 20-3 0 17-20-3Z" : "M0-20 7-16 15-17 18-9 23-3 18 4 16 12 7 13 0 19-7 13-16 12-18 4-23-3-18-9-15-17-7-16Z"} fill={p.metal}/>
    <ellipse cy="-1" rx={heart?10:14} ry="13" fill={p.body} stroke={p.palette.accent} strokeWidth=".7"/>
    {heart?<path d="M0 9C-17-1-9-12 0-6C9-12 17-1 0 9" fill={p.gem}/>:seal?<><path d="M-8-5-5 4H5L8-5 3-1 0-8-3-1Z" fill={p.metal}/><path d="M-5 7H5" stroke={p.metal}/></>:prism?<path d="M0-12 9-2 0 10-9-2Z" fill={p.gem} stroke={p.metal} strokeWidth=".6"/>:<path d="M0-11 3-3 11 0 3 3 0 11-3 3-11 0-3-3Z" fill={p.gem}/>}
    <path d="M-10-7 Q0-16 10-7" fill="none" stroke="white" strokeOpacity=".5" strokeWidth=".8"/>
  </g>;
}

function JeweledLocket({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const p=useOrnamentPaint(definition);const cherry=definition.id.includes("cherry"), crest=definition.id.includes("crest");
  return <g filter={p.glow}>{p.defs}
    {[-1,1].map(side=><g key={side} transform={`scale(${side} 1)`}>
      <path d="M14-5 Q28-20 55-8 Q47 4 30 2 Q41-7 48-7 Q28-10 17 5" fill={p.metal}/>
      <path d="M20-4 Q35-11 45-8" fill="none" stroke={p.palette.primary} strokeWidth="2"/>
      <circle cx="52" cy="-8" r="3" fill={p.gem}/>
      <path d="M18 8Q34 20 45 2" fill="none" stroke={p.metal} strokeWidth=".9"/>
    </g>)}
    <path d={crest?"M0-24 19-14 17 7 0 21-17 7-19-14Z":"M-10-12V-18A10 10 0 0 1 10-18V-12"} fill={crest?p.body:"none"} stroke={p.metal} strokeWidth="3"/>
    {!crest&&<path d="M-18-13Q0-19 18-13L17 8Q0 20-17 8Z" fill={p.body} stroke={p.metal} strokeWidth="1.3"/>}
    {cherry?<g><path d="M-5 2Q0-10 4-10L7 3" fill="none" stroke={p.metal}/><circle cx="-5" cy="5" r="5" fill={p.gem}/><circle cx="7" cy="6" r="5" fill={p.gem}/><path d="M3-9Q10-17 14-9Q9-5 3-9" fill={p.metal}/></g>:crest?<path d="M-9-8-5 2H5L9-8 3-3 0-13-3-3ZM-5 5H5V8H-5Z" fill={p.metal}/>:<><circle cy="-3" r="3.4" fill="#150c20"/><path d="M-2-1-3 7H3L2-1" fill="#150c20"/></>}
    <path d="M0 16V22" stroke={p.metal}/><path d="M0 31C-15 21-7 15 0 20C7 15 15 21 0 31" fill={p.gem} stroke={p.metal} strokeWidth=".7"/>
  </g>;
}

function CathedralTassel({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const p=useOrnamentPaint(definition);const prism=definition.id.includes("prism"), star=definition.id.includes("starlit");
  return <g filter={p.glow}>{p.defs}
    <path d="M-37 0Q-21-22 0-17Q21-22 37 0L22-2Q10-10 0-6Q-10-10-22-2Z" fill={p.body} stroke={p.metal} strokeWidth=".9"/>
    {[-1,1].map(side=><g key={side} transform={`scale(${side} 1)`}><path d="M7-9 24-6 15 0 22 6 8 3" fill="none" stroke={p.metal} strokeWidth=".9"/><path d="M22 5V17" stroke={p.metal}/><path d="M22 13 26 19 22 25 18 19Z" fill={p.gem}/></g>)}
    <path d={prism?"M0-23 12-8 0 7-12-8Z":"M0-23Q17-10 9 2H-9Q-17-10 0-23"} fill={p.gem} stroke={p.metal} strokeWidth="1"/>
    <path d="M0 7V14" stroke={p.metal}/>
    {star?<path d="M0 10 3 18 11 21 3 24 0 32-3 24-11 21-3 18Z" fill={p.gem} stroke={p.metal} strokeWidth=".6"/>:prism?<path d="M0 12 7 20 0 33-7 20Z" fill={p.gem} stroke={p.metal} strokeWidth=".8"/>:<><path d="M-7 15Q0 10 7 15L9 29Q0 33-9 29Z" fill={p.body} stroke={p.metal} strokeWidth=".8"/>{[-5,-2,2,5].map(x=><path key={x} d={`M${x} 16L${x*1.4} 29`} stroke={p.metal} strokeWidth=".55"/>)}</>}
    <path d="M-4-14-3-8" stroke="white" strokeOpacity=".6" strokeWidth="1.4" strokeLinecap="round"/>
  </g>;
}

function OperaRoseSwag({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const p=useOrnamentPaint(definition);const lavender=definition.id.includes("lavender");
  return <g filter={p.glow}>{p.defs}
    <path d="M-52-3Q0 31 52-3M-34 6Q0 30 34 6" fill="none" stroke={p.metal} strokeWidth=".9"/>
    {[-1,1].map(side=><g key={side} transform={`scale(${side} 1)`}><path d="M16 0Q29-19 41-10Q35 2 16 0M31 4Q46-3 51 7Q38 12 31 4" fill={p.metal}/><path d="M22-2 37-9M36 5 47 7" stroke={p.palette.primary} strokeWidth=".9"/></g>)}
    {[-23,0,23].map((x,i)=><g key={x} transform={`translate(${x} ${i===1?-10:-3}) scale(${i===1?1:.76})`}>
      {[0,60,120,180,240,300].map(angle=><ellipse key={angle} cx="0" cy="-6" rx="6" ry="8" transform={`rotate(${angle})`} fill={p.body} stroke={p.palette.accent} strokeWidth=".6"/>)}
      <path d="M-7 1Q-10-8 0-9Q10-7 7 2Q2 11-5 5Q-9-1-2-4Q6-5 4 2Q0 7-2 1Q-3-1 1-1" fill={p.gem} stroke={p.palette.accent} strokeWidth=".7"/>
    </g>)}
    <path d="M0 14V22" stroke={p.metal}/><path d={lavender?"M0 18 5 25 0 33-5 25Z":"M0 32C-13 22-7 16 0 21C7 16 13 22 0 32"} fill={p.gem} stroke={p.metal} strokeWidth=".65"/>
  </g>;
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
  const p=useOrnamentPaint(definition);
  return <g>{p.defs}<path d="M-82 2Q-45-7 0-5Q45-7 82 2" fill="none" stroke={p.metal} strokeWidth="1.2"/>
    {[-1,1].map(side=><g key={side} transform={`scale(${side} 1)`}>{[58,68,78].map((x,i)=><g key={x}>
      <path d={`M${x} 0Q${x-2} 28 ${x} ${45+i*15}`} fill="none" stroke={p.metal} strokeWidth=".65"/>
      {Array.from({length:5+i},(_,j)=><circle key={j} cx={x-1} cy={8+j*9} r="1.65" fill={p.gem}/>)}
      <path d={`M${x} ${46+i*15}q-6 8 0 12q6-4 0-12`} fill={p.gem} stroke={p.metal} strokeWidth=".5"/>
    </g>)}</g>)}
  </g>;
}

function OverlayChainCurtain({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const p=useOrnamentPaint(definition);
  return <g>{p.defs}<path d="M-82-2Q0-8 82-2" stroke={p.metal} fill="none" strokeWidth="1"/>
    {[-1,1].map(side=><g key={side} transform={`scale(${side} 1)`}>
      <path d="M82 3Q45 25 79 53M81 17Q52 46 80 76M81 50Q58 78 81 106" fill="none" stroke={p.metal} strokeWidth="1.2" strokeDasharray="2.1 1.1"/>
      {[4,52,105].map(y=><g key={y} transform={`translate(80 ${y})`}><circle r="3.5" fill={p.body} stroke={p.metal} strokeWidth=".7"/><path d="M0 5V12M0 10 4 16 0 22-4 16Z" fill={p.gem} stroke={p.metal} strokeWidth=".6"/></g>)}
    </g>)}
  </g>;
}

function OverlayCrystalFacet({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const p=useOrnamentPaint(definition);const silver=definition.id.includes("silver");
  return <g>{p.defs}{[-1,1].map(side=><g key={side} transform={`scale(${side} 1)`}>
    <path d="M81 0 57 3 70 17 60 44 81 66Z" fill={p.body} opacity=".4" stroke={p.metal} strokeWidth=".8"/>
    <path d="M81 0 70 17 81 66M57 3 70 17 60 44 81 66" stroke={p.palette.accent} fill="none" strokeWidth=".7"/>
    {[0,1,2].map(i=><g key={i} transform={`translate(${76-i*5} ${10+i*27})`}><path d={silver?"M0-8 4 0 0 12-4 0Z":"M0-7 6 0 0 9-6 0Z"} fill={p.gem} stroke={p.metal} strokeWidth=".6"/><path d="M0-7 0 9-4 0Z" fill="white" opacity=".2"/></g>)}
    <path d="M81 70V108" stroke={p.metal} strokeWidth=".8"/><path d="M81 105 84 112 81 121 78 112Z" fill={p.gem}/>
  </g>)}</g>;
}

function OverlayStageCanopy({ definition }: { definition: ProfileFrameDecorationDefinition; previewMode?: "default" | "shop" }) {
  const p=useOrnamentPaint(definition);
  return <g>{p.defs}<path d="M-84-2Q0-12 84-2" fill="none" stroke={p.metal} strokeWidth="1.7"/>
    {[-1,1].map(side=><g key={side} transform={`scale(${side} 1)`}>
      <path d="M82-2H53Q51 25 66 43L72 55Q58 97 65 143L83 160Z" fill={p.body} stroke={p.metal} strokeWidth=".7"/>
      <path d="M59 0Q58 26 73 50M68 1Q65 28 77 49M78 1V47M72 61Q65 98 73 145M78 62 79 153" fill="none" stroke={p.sheen} strokeWidth="2.7"/>
      <path d="M65 50Q76 55 84 48L83 55Q73 61 66 56Z" fill={p.metal}/>
      <path d="M70 58V80" stroke={p.metal}/><path d="M70 77Q62 88 70 92Q78 88 70 77" fill={p.gem} stroke={p.metal} strokeWidth=".6"/>
    </g>)}
  </g>;
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

function PeekingAnimal({ faceColor, innerColor, kind, mirror=false, x }: {
  faceColor:string;innerColor:string;kind:"side-bear-pair"|"side-bunny-pair"|"side-cat-pair"|"side-dog-pair"|"side-fox-pair";mirror?:boolean;x:number;
}) {
  const id="fur-"+useId().replace(/:/g,"");const fox=kind==="side-fox-pair",cat=kind==="side-cat-pair",bunny=kind==="side-bunny-pair",bear=kind==="side-bear-pair",dog=kind==="side-dog-pair";
  return <g transform={`translate(${x} 229) scale(${mirror?-1:1} 1)`}>
    <defs><radialGradient id={id} cx="34%" cy="20%" r="82%"><stop stopColor={innerColor}/><stop offset=".42" stopColor={faceColor}/><stop offset="1" stopColor={faceColor} stopOpacity=".65"/></radialGradient></defs>
    <ellipse cy="29" rx="21" ry="4" fill="#090710" opacity=".4"/>
    {(cat||fox)&&<path d={fox?"M10 22Q34 22 25 1Q43 16 26 31L7 28Z":"M12 22Q31 24 26 9Q25 3 20 9"} fill={fox?`url(#${id})`:"none"} stroke={faceColor} strokeWidth={fox?"1":"5"} strokeLinecap="round"/>}
    {fox&&<path d="M26 3Q33 11 31 18L23 15Z" fill={innerColor}/>}
    <ellipse cy="17" rx="14" ry="17" fill={`url(#${id})`} stroke={faceColor} strokeWidth=".6"/>
    <ellipse cy="18" rx="8" ry="11" fill={innerColor} opacity=".4"/>
    {(cat||fox)&&<><path d={fox?"M-16-8-17-28-3-16M16-8 17-28 3-16":"M-15-10-14-24-2-15M15-10 14-24 2-15"} fill={`url(#${id})`} stroke={faceColor}/><path d="M-13-13-13-20-7-15M13-13 13-20 7-15" fill={innerColor}/></>}
    {bunny&&<><ellipse cx="-8" cy="-23" rx="5" ry="17" transform="rotate(-14 -8 -23)" fill={`url(#${id})`}/><ellipse cx="8" cy="-23" rx="5" ry="17" transform="rotate(12 8 -23)" fill={`url(#${id})`}/><path d="M-9-33-5-17M9-33 6-17" stroke={innerColor} strokeWidth="3" strokeLinecap="round"/></>}
    {bear&&[-1,1].map(side=><g key={side}><circle cx={side*12} cy="-17" r="7" fill={`url(#${id})`}/><circle cx={side*12} cy="-17" r="3.4" fill={innerColor} opacity=".7"/></g>)}
    <path d={fox?"M-17-13Q0-25 17-13L20-2 0 11-20-2Z":"M-17-6Q-18-21 0-21Q18-21 17-6Q18 9 0 10Q-18 9-17-6"} fill={`url(#${id})`} stroke={faceColor} strokeWidth=".8"/>
    {dog&&[-1,1].map(side=><path key={side} d="M10-17Q25-18 22 5Q20 12 13 6L11-8Z" transform={`scale(${side} 1)`} fill={faceColor} stroke={innerColor} strokeWidth=".6"/>)}
    {fox?<path d="M-17-7Q-8-2 0 3Q8-2 17-7L0 10Z" fill={innerColor}/>:<ellipse cy="3" rx={bear?8:7} ry="5" fill={innerColor} opacity=".7"/>}
    {cat&&<path d="M-7-19-5-13M0-20V-14M7-19 5-13" stroke={faceColor} strokeWidth="2.2" strokeLinecap="round"/>}
    {[-1,1].map(side=><g key={side}><ellipse cx={side*6} cy="-6" rx="2.25" ry="2.8" fill="#15101b"/><circle cx={side*6-.6} cy="-7" r=".8" fill="white"/><ellipse cx={side*11} cy="0" rx="3" ry="1.4" fill="#f3a4bb" opacity=".4"/></g>)}
    <path d="M-2 1Q0 0 2 1L0 3Z" fill="#241422"/><path d="M0 3V5M-3 5Q0 8 3 5" fill="none" stroke="#392336" strokeWidth=".6" strokeLinecap="round"/>
    {(cat||bunny)&&<path d="M-9 2-19 0M-9 5-19 6M9 2 19 0M9 5 19 6" stroke={innerColor} strokeWidth=".65"/>}
    <path d="M-9 10Q0 14 9 10" stroke={innerColor} strokeWidth="2" fill="none"/><path d="M0 11 3 15 0 19-3 15Z" fill="#dfbd7b"/>
    {[-1,1].map(side=><g key={side}><ellipse cx={side*9} cy="27" rx={bunny?8:6} ry="4.2" fill={`url(#${id})`} stroke={innerColor} strokeWidth=".5"/><path d={`M${side*9-1} 27v2M${side*9+1} 27v2`} stroke={faceColor} strokeWidth=".6"/><ellipse cx={side*10} cy="16" rx="3.5" ry="7" fill={`url(#${id})`}/></g>)}
  </g>;
}

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

function RoyalKey({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const p=useOrnamentPaint(definition);return <g filter={p.glow}>{p.defs}<path d="M-34-5H36V2H31V9H24V2H17V-5" fill={p.metal}/><path d="M-38 12C-68-5-49-26-38-14C-27-26-8-5-38 12Z" fill={p.body} stroke={p.metal} strokeWidth="2"/><path d="M-38 4C-56-6-46-17-38-10C-30-17-20-6-38 4Z" fill={p.gem}/><path d="M-21-3H31" stroke="white" strokeOpacity=".65" strokeWidth=".7"/><path d="M-42 13-50 29-35 23-26 31-27 10" fill={p.body} stroke={p.metal} strokeWidth=".6"/></g>;
}
function EclipseCrescent({ definition }: { definition: ProfileFrameDecorationDefinition }) {
  const p=useOrnamentPaint(definition);return <g filter={p.glow}>{p.defs}<path d="M10-29A23 23 0 1 0 10 9A19 19 0 0 1 10-29" fill={p.metal}/><path d="M2-23A16 16 0 0 0 2 3" fill="none" stroke={p.palette.accent} strokeWidth="1"/><path d="M13-19 16-12 23-9 16-6 13 1 10-6 3-9 10-12Z" fill={p.gem} stroke={p.metal} strokeWidth=".6"/><path d="M-18 6-25 17M-21 8-30 10M0 14V22" stroke={p.metal} strokeWidth=".8"/><path d="M0 19 3 25 0 30-3 25Z" fill={p.gem}/></g>;
}

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
      case "royal-key": return <RoyalKey definition={definition} />;
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
      <DecorationSvg zIndex={att.zIndex}>
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
            case "top-crescent": return <EclipseCrescent definition={items.top} />;
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
