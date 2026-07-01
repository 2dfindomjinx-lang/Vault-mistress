import type { CSSProperties } from "react";
import type { CosmeticItem } from "@/lib/cosmetics";

export type ProfileBorderFramePresentation = {
  backgroundClassName: string;
  backgroundStyle?: CSSProperties;
  ringClassName: string;
  ringStyle?: CSSProperties;
  variant: "rainbow" | "runner" | null;
};

function withAlpha(color: string, alpha: string) {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return `${color}${alpha}`;
  }

  return color;
}

function resolveBackground(item: CosmeticItem, palette: [string, string, string?]) {
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
    case "solid":
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
      backgroundClassName:
        "bg-[conic-gradient(from_180deg,rgba(244,114,182,0.26)_0deg,rgba(168,85,247,0.28)_60deg,rgba(34,211,238,0.28)_120deg,rgba(16,185,129,0.26)_180deg,rgba(245,158,11,0.26)_240deg,rgba(244,63,94,0.28)_300deg,rgba(244,114,182,0.26)_360deg)]",
      backgroundStyle: {
        boxShadow:
          "0 0 16px rgba(168, 85, 247, 0.18), 0 0 28px rgba(34, 211, 238, 0.12)",
      },
      ringClassName: "profile-border-frame profile-border-frame--rainbow",
      ringStyle: undefined,
      variant: "rainbow",
    };
  }

  if (isRunner) {
    return {
      backgroundClassName:
        "bg-[linear-gradient(135deg,rgba(255,255,255,0.15),rgba(251,113,133,0.22),rgba(236,72,153,0.24),rgba(255,255,255,0.1))]",
      backgroundStyle: {
        boxShadow:
          "0 0 16px rgba(236, 72, 153, 0.18), 0 0 24px rgba(251, 113, 133, 0.12)",
      },
      ringClassName: "profile-border-frame profile-border-frame--runner",
      ringStyle: undefined,
      variant: "runner",
    };
  }

  if (item?.type === "profile-border" && item.borderPalette?.length) {
    const palette = item.borderPalette;
    const primary = palette[0];
    const accent = palette[2] ?? palette[1];
    const background = resolveBackground(item, palette);
    const sharedStyle = {
      background,
      boxShadow: `0 0 18px ${withAlpha(primary, "55")}, 0 0 30px ${withAlpha(accent, "28")}`,
    } satisfies CSSProperties;

    return {
      backgroundClassName: "bg-white/10",
      backgroundStyle: sharedStyle,
      ringClassName: "profile-border-frame",
      ringStyle: sharedStyle,
      variant: null,
    };
  }

  if (item?.color) {
    const solidStyle = {
      backgroundColor: item.color,
      boxShadow: `0 0 18px ${withAlpha(item.color, "66")}`,
    } satisfies CSSProperties;

    return {
      backgroundClassName: "bg-white/10",
      backgroundStyle: solidStyle,
      ringClassName: "profile-border-frame",
      ringStyle: solidStyle,
      variant: null,
    };
  }

  return {
    backgroundClassName: "bg-white/10",
    backgroundStyle: undefined,
    ringClassName: "profile-border-frame",
    ringStyle: undefined,
    variant: null,
  };
}
