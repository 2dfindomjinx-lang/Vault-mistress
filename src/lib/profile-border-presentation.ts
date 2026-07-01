import type { CSSProperties } from "react";
import type { CosmeticItem } from "@/lib/cosmetics";
import {
  layeredBorderConfigById,
  type LayeredBorderAnimation,
  type LayeredBorderConfig,
  type LayeredBorderMotif,
  type LayeredBorderPattern,
} from "@/lib/profile-border-layered-config";

export type ProfileBorderLayerPresentation = {
  animation?: LayeredBorderAnimation;
  backgroundImage?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  backgroundSize?: string;
  filter?: string;
  mixBlendMode?: CSSProperties["mixBlendMode"];
  opacity?: number;
};

export type ProfileBorderFramePresentation = {
  contentInset: number;
  contentShadow?: string;
  glowStyle?: CSSProperties;
  layered: boolean;
  layers: ProfileBorderLayerPresentation[];
  legacyBackgroundClassName?: string;
  legacyBackgroundStyle?: CSSProperties;
  legacyRingClassName?: string;
  legacyRingStyle?: CSSProperties;
  variant: "rainbow" | "runner" | null;
};

type BorderVars = CSSProperties & {
  "--pb-accent": string;
  "--pb-primary": string;
  "--pb-secondary": string;
  "--pb-soft-light": string;
};

function withAlpha(color: string, alpha: string) {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return `${color}${alpha}`;
  }

  return color;
}

function varsFromPalette(palette: [string, string, string?] | undefined) {
  const primary = palette?.[0] ?? "#ec4899";
  const secondary = palette?.[1] ?? "#111111";
  const accent = palette?.[2] ?? secondary;

  return {
    "--pb-accent": accent,
    "--pb-primary": primary,
    "--pb-secondary": secondary,
    "--pb-soft-light": "rgba(255,255,255,0.88)",
  } satisfies BorderVars;
}

function applyVars(template: string | undefined, vars: BorderVars) {
  if (!template) {
    return undefined;
  }

  return template
    .replaceAll("var(--pb-primary)", String(vars["--pb-primary"]))
    .replaceAll("var(--pb-secondary)", String(vars["--pb-secondary"]))
    .replaceAll("var(--pb-accent)", String(vars["--pb-accent"]))
    .replaceAll("var(--pb-soft-light)", String(vars["--pb-soft-light"]));
}

function svgDataUri(svg: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function resolvePattern(pattern: LayeredBorderPattern | undefined, vars: BorderVars) {
  const primary = String(vars["--pb-primary"]);
  const secondary = String(vars["--pb-secondary"]);
  const accent = String(vars["--pb-accent"]);

  switch (pattern) {
    case "bavarian-diamonds":
      return {
        backgroundImage: [
          "repeating-linear-gradient(135deg, rgba(255,255,255,0.82) 0 18px, rgba(185,217,255,0.88) 18px 36px)",
          "repeating-linear-gradient(45deg, transparent 0 18px, rgba(255,255,255,0.24) 18px 36px)",
        ].join(", "),
      };
    case "city-rings":
      return {
        backgroundImage: [
          "radial-gradient(circle at 50% 18%, rgba(255,255,255,0.16) 0 16%, transparent 17%)",
          "radial-gradient(circle at 50% 82%, rgba(255,255,255,0.1) 0 14%, transparent 15%)",
          "repeating-linear-gradient(90deg, transparent 0 18px, rgba(255,255,255,0.06) 18px 19px, transparent 19px 38px)",
        ].join(", "),
      };
    case "feather-slash":
      return {
        backgroundImage: [
          "repeating-linear-gradient(155deg, rgba(255,255,255,0.18) 0 10px, transparent 10px 24px)",
          "repeating-linear-gradient(25deg, rgba(0,0,0,0.08) 0 12px, transparent 12px 28px)",
        ].join(", "),
      };
    case "flame-flickers":
      return {
        backgroundImage: [
          "radial-gradient(circle at 14% 82%, rgba(255,122,69,0.34) 0 11%, transparent 12%)",
          "radial-gradient(circle at 82% 18%, rgba(255,184,92,0.26) 0 9%, transparent 10%)",
          "repeating-linear-gradient(118deg, transparent 0 14px, rgba(255,122,69,0.12) 14px 18px, transparent 18px 32px)",
        ].join(", "),
      };
    case "flag-ribbon":
      return {
        backgroundImage:
          "linear-gradient(135deg, transparent 0 34%, rgba(255,255,255,0.68) 34% 42%, rgba(0,92,169,0.22) 42% 52%, transparent 52% 100%)",
      };
    case "honeycomb-dots":
      return {
        backgroundImage: [
          "radial-gradient(circle at 25% 30%, rgba(17,17,17,0.22) 0 12%, transparent 13%)",
          "radial-gradient(circle at 75% 30%, rgba(17,17,17,0.22) 0 12%, transparent 13%)",
          "radial-gradient(circle at 25% 72%, rgba(17,17,17,0.22) 0 12%, transparent 13%)",
          "radial-gradient(circle at 75% 72%, rgba(17,17,17,0.22) 0 12%, transparent 13%)",
        ].join(", "),
      };
    case "industrial-brush":
      return {
        backgroundImage: [
          "repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0 16px, rgba(0,0,0,0.16) 16px 32px)",
          "repeating-linear-gradient(90deg, transparent 0 20px, rgba(158,155,151,0.12) 20px 22px, transparent 22px 40px)",
        ].join(", "),
      };
    case "laurel-columns":
      return {
        backgroundImage: [
          "repeating-linear-gradient(180deg, rgba(242,213,116,0.16) 0 16px, transparent 16px 32px)",
          "linear-gradient(90deg, rgba(242,213,116,0.18) 0 7%, transparent 7% 93%, rgba(242,213,116,0.18) 93% 100%)",
        ].join(", "),
      };
    case "maple-fragments":
      return {
        backgroundImage: [
          "linear-gradient(135deg, rgba(213,43,30,0.9) 0 8%, transparent 8% 100%)",
          "linear-gradient(225deg, rgba(213,43,30,0.9) 0 8%, transparent 8% 100%)",
        ].join(", "),
      };
    case "neon-double-lines":
      return {
        backgroundImage:
          "linear-gradient(90deg, transparent 0 24%, rgba(63,214,255,0.8) 24% 26%, transparent 26% 74%, rgba(63,214,255,0.8) 74% 76%, transparent 76% 100%)",
      };
    case "nordic-cross":
      return {
        backgroundImage:
          "linear-gradient(90deg, transparent 0 31%, rgba(255,255,255,0.18) 31% 46%, transparent 46% 100%), linear-gradient(180deg, transparent 0 43%, rgba(255,255,255,0.18) 43% 58%, transparent 58% 100%)",
      };
    case "racing-diagonals":
      return {
        backgroundImage:
          "repeating-linear-gradient(123deg, transparent 0 13px, rgba(255,255,255,0.16) 13px 16px, rgba(0,0,0,0.08) 16px 24px, transparent 24px 36px)",
        backgroundSize: "160% 160%",
      };
    case "sea-foam":
      return {
        backgroundImage: [
          "repeating-radial-gradient(circle at 50% 118%, rgba(255,255,255,0.24) 0 14px, transparent 14px 30px)",
          "radial-gradient(circle at 50% 12%, rgba(255,255,255,0.18) 0 10%, transparent 11%)",
        ].join(", "),
        backgroundSize: "160% 160%",
      };
    case "soft-stars":
      return {
        backgroundImage: [
          "radial-gradient(circle at 18% 24%, rgba(255,255,255,0.34) 0 1.6%, transparent 1.8%)",
          "radial-gradient(circle at 78% 20%, rgba(255,255,255,0.28) 0 1.4%, transparent 1.6%)",
          "radial-gradient(circle at 26% 74%, rgba(255,255,255,0.22) 0 1.3%, transparent 1.5%)",
          "radial-gradient(circle at 82% 78%, rgba(255,255,255,0.22) 0 1.4%, transparent 1.6%)",
        ].join(", "),
      };
    case "sunburst-rays":
      return {
        backgroundImage:
          "conic-gradient(from 180deg at 50% 50%, rgba(241,200,76,0.34) 0deg 16deg, transparent 16deg 32deg, rgba(241,200,76,0.16) 32deg 48deg, transparent 48deg 360deg)",
      };
    case "vertical-pinstripes":
      return {
        backgroundImage:
          "repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 14px)",
      };
    case "wave-ribbon":
      return {
        backgroundImage:
          "repeating-radial-gradient(circle at 50% 124%, rgba(168,211,255,0.16) 0 18px, transparent 18px 40px)",
        backgroundSize: "180% 180%",
      };
    default:
      return null;
  }
}

function resolveMotif(motif: LayeredBorderMotif | undefined, vars: BorderVars) {
  const accent = String(vars["--pb-accent"]);
  const secondary = String(vars["--pb-secondary"]);

  switch (motif) {
    case "crescent-star":
      return {
        backgroundImage: svgDataUri(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360">
            <circle cx="92" cy="86" r="34" fill="rgba(255,255,255,0.94)"/>
            <circle cx="105" cy="86" r="28" fill="${secondary}"/>
            <polygon points="137,72 142,84 155,84 144,92 148,105 137,97 126,105 130,92 119,84 132,84" fill="rgba(255,255,255,0.94)"/>
          </svg>
        `),
        backgroundRepeat: "no-repeat",
        backgroundPosition: "18% 18%",
        backgroundSize: "32% 32%",
      };
    case "rising-sun":
      return {
        backgroundImage: svgDataUri(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360">
            <circle cx="120" cy="84" r="36" fill="rgba(188,0,45,0.92)"/>
          </svg>
        `),
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center 18%",
        backgroundSize: "28% 28%",
      };
    case "sun-core":
      return {
        backgroundImage: svgDataUri(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360">
            <circle cx="120" cy="84" r="20" fill="rgba(241,200,76,0.95)"/>
            <g stroke="rgba(241,200,76,0.65)" stroke-width="4" stroke-linecap="round">
              <path d="M120 48v18"/><path d="M120 102v18"/><path d="M84 84h18"/><path d="M138 84h18"/>
              <path d="M95 59l12 12"/><path d="M145 59l-12 12"/><path d="M95 109l12-12"/><path d="M145 109l-12-12"/>
            </g>
          </svg>
        `),
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center 18%",
        backgroundSize: "30% 30%",
      };
    case "swiss-cross":
      return {
        backgroundImage: svgDataUri(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360">
            <rect x="102" y="52" width="36" height="68" rx="4" fill="rgba(255,255,255,0.94)"/>
            <rect x="86" y="68" width="68" height="36" rx="4" fill="rgba(255,255,255,0.94)"/>
          </svg>
        `),
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center 18%",
        backgroundSize: "28% 28%",
      };
    case "tiny-stars":
      return {
        backgroundImage: svgDataUri(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360">
            <g fill="rgba(255,255,255,0.9)">
              <circle cx="46" cy="48" r="3"/><circle cx="68" cy="64" r="3"/><circle cx="90" cy="44" r="3"/>
              <circle cx="112" cy="60" r="3"/><circle cx="46" cy="82" r="3"/><circle cx="68" cy="98" r="3"/>
              <circle cx="90" cy="78" r="3"/><circle cx="112" cy="94" r="3"/>
            </g>
          </svg>
        `),
        backgroundRepeat: "no-repeat",
        backgroundPosition: "12% 12%",
        backgroundSize: "38% 38%",
      };
    default:
      return null;
  }
}

function resolveAnimationStyle(animation: LayeredBorderAnimation | undefined): CSSProperties | undefined {
  switch (animation) {
    case "ember-flicker":
      return { animation: "profileBorderEmber 4.8s ease-in-out infinite" };
    case "flag-sheen":
      return { animation: "profileBorderSheen 7.4s linear infinite", backgroundSize: "180% 180%" };
    case "neon-pulse":
      return { animation: "profileBorderNeon 4.2s ease-in-out infinite" };
    case "royal-shimmer":
      return { animation: "profileBorderShimmer 6.8s ease-in-out infinite", backgroundSize: "180% 180%" };
    case "subtle-glow":
      return { animation: "profileBorderPulse 6.4s ease-in-out infinite" };
    case "wave-drift":
      return { animation: "profileBorderDrift 8.2s ease-in-out infinite", backgroundSize: "190% 190%" };
    default:
      return undefined;
  }
}

function getLayeredPresentation(item: CosmeticItem, palette: [string, string, string?], config: LayeredBorderConfig) {
  const vars = varsFromPalette(palette);
  const layers: ProfileBorderLayerPresentation[] = [
    {
      backgroundImage: applyVars(config.baseGradient, vars),
      opacity: 1,
    },
  ];

  const patternLayer = resolvePattern(config.pattern, vars);
  if (patternLayer) {
    layers.push({
      ...patternLayer,
      animation: config.animation,
      mixBlendMode: "screen",
      opacity: 0.84,
    });
  }

  if (config.innerStripe) {
    layers.push({
      backgroundImage: applyVars(config.innerStripe, vars),
      animation: config.animation,
      mixBlendMode: "screen",
      opacity: 0.9,
    });
  }

  if (config.cornerAccents) {
    layers.push({
      backgroundImage: applyVars(config.cornerAccents, vars),
      opacity: 0.96,
    });
  }

  const motifLayer = resolveMotif(config.motif, vars);
  if (motifLayer) {
    layers.push({
      ...motifLayer,
      animation: config.animation,
      opacity: 0.95,
    });
  }

  return {
    contentInset: 3,
    contentShadow: `inset 0 0 20px ${withAlpha(palette[0], "18")}, inset 0 0 36px ${withAlpha(palette[2] ?? palette[1], "16")}`,
    glowStyle: {
      boxShadow: config.outerGlow ?? `0 0 18px ${withAlpha(palette[0], "55")}, 0 0 30px ${withAlpha(palette[2] ?? palette[1], "28")}`,
    },
    layered: true,
    layers,
    variant: null,
  } satisfies ProfileBorderFramePresentation;
}

function resolveLegacyBackground(item: CosmeticItem, palette: [string, string, string?]) {
  const [primary, secondary, accent = secondary] = palette;

  switch (item.borderStyle) {
    case "split-diagonal":
      return `linear-gradient(135deg, ${primary} 0 48%, ${secondary} 52% 100%)`;
    case "split-vertical":
      return `linear-gradient(90deg, ${primary} 0 50%, ${secondary} 50% 100%)`;
    case "tricolor-band":
      return `linear-gradient(90deg, ${primary} 0 33.33%, ${secondary} 33.33% 66.66%, ${accent} 66.66% 100%)`;
    case "tricolor-diagonal":
      return `linear-gradient(135deg, ${primary} 0 33.33%, ${secondary} 33.33% 66.66%, ${accent} 66.66% 100%)`;
    case "pinstripe":
      return `repeating-linear-gradient(135deg, ${primary} 0 16px, ${secondary} 16px 24px, ${accent} 24px 30px, ${primary} 30px 44px)`;
    case "edge-stripe":
      return `linear-gradient(90deg, ${secondary} 0 10%, ${primary} 10% 44%, ${accent} 44% 56%, ${primary} 56% 90%, ${secondary} 90% 100%)`;
    case "stadium-glow":
      return `linear-gradient(145deg, ${primary} 0%, ${secondary} 54%, ${accent} 100%)`;
    case "conic-slice":
      return `conic-gradient(from 180deg, ${primary} 0deg 120deg, ${secondary} 120deg 240deg, ${accent} 240deg 360deg)`;
    default:
      return primary;
  }
}

export function getProfileBorderFramePresentation(
  item: CosmeticItem | null,
): ProfileBorderFramePresentation {
  const isRainbow = item?.id === "profile-border-rainbow-animated";
  const isRunner = item?.id === "profile-border-animated";

  if (isRainbow) {
    return {
      contentInset: 3,
      layered: false,
      layers: [],
      legacyBackgroundClassName:
        "bg-[conic-gradient(from_180deg,rgba(244,114,182,0.26)_0deg,rgba(168,85,247,0.28)_60deg,rgba(34,211,238,0.28)_120deg,rgba(16,185,129,0.26)_180deg,rgba(245,158,11,0.26)_240deg,rgba(244,63,94,0.28)_300deg,rgba(244,114,182,0.26)_360deg)]",
      legacyBackgroundStyle: {
        boxShadow:
          "0 0 16px rgba(168, 85, 247, 0.18), 0 0 28px rgba(34, 211, 238, 0.12)",
      },
      legacyRingClassName: "profile-border-frame profile-border-frame--rainbow",
      variant: "rainbow",
    };
  }

  if (isRunner) {
    return {
      contentInset: 3,
      layered: false,
      layers: [],
      legacyBackgroundClassName:
        "bg-[linear-gradient(135deg,rgba(255,255,255,0.15),rgba(251,113,133,0.22),rgba(236,72,153,0.24),rgba(255,255,255,0.1))]",
      legacyBackgroundStyle: {
        boxShadow:
          "0 0 16px rgba(236, 72, 153, 0.18), 0 0 24px rgba(251, 113, 133, 0.12)",
      },
      legacyRingClassName: "profile-border-frame profile-border-frame--runner",
      variant: "runner",
    };
  }

  if (item?.type === "profile-border" && item.borderPalette?.length) {
    const layeredConfig = layeredBorderConfigById[item.id];

    if (layeredConfig) {
      return getLayeredPresentation(item, item.borderPalette, layeredConfig);
    }

    const background = resolveLegacyBackground(item, item.borderPalette);
    const primary = item.borderPalette[0];
    const accent = item.borderPalette[2] ?? item.borderPalette[1];
    const sharedStyle = {
      background,
      boxShadow: `0 0 18px ${withAlpha(primary, "55")}, 0 0 30px ${withAlpha(accent, "28")}`,
    } satisfies CSSProperties;

    return {
      contentInset: 3,
      layered: false,
      layers: [],
      legacyBackgroundClassName: "bg-white/10",
      legacyBackgroundStyle: sharedStyle,
      legacyRingClassName: "profile-border-frame",
      legacyRingStyle: sharedStyle,
      variant: null,
    };
  }

  if (item?.color) {
    const solidStyle = {
      backgroundColor: item.color,
      boxShadow: `0 0 18px ${withAlpha(item.color, "66")}`,
    } satisfies CSSProperties;

    return {
      contentInset: 3,
      layered: false,
      layers: [],
      legacyBackgroundClassName: "bg-white/10",
      legacyBackgroundStyle: solidStyle,
      legacyRingClassName: "profile-border-frame",
      legacyRingStyle: solidStyle,
      variant: null,
    };
  }

  return {
    contentInset: 3,
    layered: false,
    layers: [],
    legacyBackgroundClassName: "bg-white/10",
    variant: null,
  };
}
