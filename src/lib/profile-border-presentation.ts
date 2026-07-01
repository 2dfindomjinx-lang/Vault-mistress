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
    case "city-grid":
      return [
        `linear-gradient(135deg, ${primary} 0%, ${secondary} 58%, ${primary} 100%)`,
        `repeating-linear-gradient(90deg, transparent 0 18px, ${withAlpha(accent, "4A")} 18px 20px, transparent 20px 38px)`,
        `repeating-linear-gradient(0deg, transparent 0 18px, ${withAlpha("#ffffff", "24")} 18px 19px, transparent 19px 36px)`,
      ].join(", ");
    case "cannon-corners":
      return [
        `radial-gradient(circle at 6% 12%, ${withAlpha(accent, "BB")} 0 10%, transparent 11%)`,
        `radial-gradient(circle at 94% 12%, ${withAlpha(accent, "BB")} 0 10%, transparent 11%)`,
        `linear-gradient(160deg, ${primary} 0%, ${secondary} 70%)`,
      ].join(", ");
    case "flame-lights":
      return [
        `radial-gradient(circle at 15% 100%, ${withAlpha(accent, "AA")} 0 10%, transparent 28%)`,
        `radial-gradient(circle at 85% 0%, ${withAlpha("#FFD8A8", "66")} 0 7%, transparent 22%)`,
        `repeating-linear-gradient(125deg, transparent 0 16px, ${withAlpha(accent, "2C")} 16px 20px, transparent 20px 34px)`,
        `linear-gradient(160deg, ${primary} 0%, ${secondary} 100%)`,
      ].join(", ");
    case "royal-ring":
      return [
        `radial-gradient(circle at center, transparent 0 42%, ${withAlpha(accent, "70")} 43% 49%, transparent 50%)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 100%)`,
      ].join(", ");
    case "energy-rush":
      return [
        `repeating-linear-gradient(120deg, transparent 0 14px, ${withAlpha(accent, "66")} 14px 18px, transparent 18px 34px)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 100%)`,
      ].join(", ");
    case "navy-minimal":
      return [
        `linear-gradient(90deg, ${withAlpha(secondary, "D0")} 0 6%, transparent 6% 94%, ${withAlpha(secondary, "D0")} 94% 100%)`,
        `linear-gradient(145deg, ${primary} 0%, ${withAlpha(primary, "D8")} 65%, ${secondary} 100%)`,
      ].join(", ");
    case "honeycomb":
      return [
        `radial-gradient(circle at 25% 30%, ${withAlpha(secondary, "55")} 0 13%, transparent 14%)`,
        `radial-gradient(circle at 75% 70%, ${withAlpha(secondary, "55")} 0 13%, transparent 14%)`,
        `radial-gradient(circle at 75% 30%, ${withAlpha(secondary, "55")} 0 13%, transparent 14%)`,
        `radial-gradient(circle at 25% 70%, ${withAlpha(secondary, "55")} 0 13%, transparent 14%)`,
        `linear-gradient(145deg, ${primary} 0%, ${accent} 100%)`,
      ].join(", ");
    case "bavarian-diamond":
      return [
        `repeating-linear-gradient(135deg, ${withAlpha("#FFFFFF", "88")} 0 18px, ${withAlpha(accent, "B8")} 18px 36px)`,
        `repeating-linear-gradient(45deg, transparent 0 18px, ${withAlpha("#FFFFFF", "48")} 18px 36px)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 100%)`,
      ].join(", ");
    case "flag-sash":
      return [
        `linear-gradient(135deg, transparent 0 32%, ${withAlpha(secondary, "EE")} 32% 44%, transparent 44% 100%)`,
        `linear-gradient(145deg, ${primary} 0%, ${withAlpha(primary, "CC")} 100%)`,
      ].join(", ");
    case "speed-lines":
      return [
        `repeating-linear-gradient(118deg, transparent 0 14px, ${withAlpha(accent, "50")} 14px 18px, ${withAlpha(primary, "90")} 18px 26px, transparent 26px 38px)`,
        `linear-gradient(145deg, ${secondary} 0%, ${primary} 100%)`,
      ].join(", ");
    case "industrial-steel":
      return [
        `repeating-linear-gradient(135deg, ${withAlpha("#FFFFFF", "10")} 0 18px, ${withAlpha("#000000", "20")} 18px 36px)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 68%, ${accent} 100%)`,
      ].join(", ");
    case "neon-stripes":
      return [
        `repeating-linear-gradient(90deg, ${secondary} 0 12px, ${primary} 12px 24px, ${withAlpha(accent, "80")} 24px 27px, ${secondary} 27px 36px)`,
        `linear-gradient(145deg, ${secondary} 0%, ${primary} 100%)`,
      ].join(", ");
    case "wave-glow":
      return [
        `radial-gradient(circle at 50% 15%, ${withAlpha("#FFFFFF", "66")} 0 8%, transparent 20%)`,
        `repeating-radial-gradient(circle at 50% 120%, ${withAlpha(accent, "50")} 0 14px, transparent 14px 32px)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 55%, ${accent} 100%)`,
      ].join(", ");
    case "marble-noir":
      return [
        `repeating-linear-gradient(155deg, ${withAlpha("#FFFFFF", "0E")} 0 18px, ${withAlpha(accent, "22")} 18px 26px, transparent 26px 42px)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 52%, ${primary} 100%)`,
      ].join(", ");
    case "laurel-luxe":
      return [
        `radial-gradient(circle at 14% 50%, ${withAlpha(accent, "66")} 0 5%, transparent 6%)`,
        `radial-gradient(circle at 86% 50%, ${withAlpha(accent, "66")} 0 5%, transparent 6%)`,
        `repeating-radial-gradient(circle at 50% 50%, transparent 0 26px, ${withAlpha(accent, "24")} 26px 30px, transparent 30px 44px)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 100%)`,
      ].join(", ");
    case "windflow":
      return [
        `repeating-radial-gradient(circle at -10% 50%, ${withAlpha(accent, "44")} 0 18px, transparent 18px 42px)`,
        `linear-gradient(135deg, ${secondary} 0%, ${primary} 48%, ${secondary} 100%)`,
      ].join(", ");
    case "eagle-feathers":
      return [
        `repeating-linear-gradient(155deg, ${withAlpha(accent, "36")} 0 14px, transparent 14px 32px)`,
        `repeating-linear-gradient(25deg, ${withAlpha("#FFFFFF", "18")} 0 12px, transparent 12px 28px)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 100%)`,
      ].join(", ");
    case "paris-lights":
      return [
        `radial-gradient(circle at 20% 20%, ${withAlpha(accent, "66")} 0 3%, transparent 4%)`,
        `radial-gradient(circle at 80% 28%, ${withAlpha(accent, "52")} 0 3%, transparent 4%)`,
        `radial-gradient(circle at 72% 74%, ${withAlpha("#FFFFFF", "3C")} 0 4%, transparent 5%)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 68%, ${primary} 100%)`,
      ].join(", ");
    case "royal-chrome":
      return [
        `linear-gradient(115deg, ${withAlpha("#FFFFFF", "00")} 0 24%, ${withAlpha("#FFFFFF", "8A")} 24% 36%, ${withAlpha("#FFFFFF", "00")} 36% 100%)`,
        `linear-gradient(145deg, ${secondary} 0%, ${primary} 56%, ${accent} 100%)`,
      ].join(", ");
    case "split-metal":
      return [
        `linear-gradient(90deg, ${primary} 0 49%, ${withAlpha(accent, "C0")} 49% 51%, ${secondary} 51% 100%)`,
        `linear-gradient(145deg, ${withAlpha("#FFFFFF", "10")} 0%, ${withAlpha("#000000", "18")} 100%)`,
      ].join(", ");
    case "firestorm":
      return [
        `radial-gradient(circle at 50% 110%, ${withAlpha(accent, "A0")} 0 18%, transparent 36%)`,
        `repeating-linear-gradient(125deg, transparent 0 18px, ${withAlpha(accent, "36")} 18px 24px, transparent 24px 40px)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 72%)`,
      ].join(", ");
    case "starburst":
      return [
        `radial-gradient(circle at 18% 24%, ${withAlpha(accent, "90")} 0 2.5%, transparent 3%)`,
        `radial-gradient(circle at 78% 18%, ${withAlpha(accent, "70")} 0 2.5%, transparent 3%)`,
        `radial-gradient(circle at 82% 78%, ${withAlpha(accent, "70")} 0 2.5%, transparent 3%)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 100%)`,
      ].join(", ");
    case "saint-cross":
      return [
        `linear-gradient(90deg, transparent 0 41%, ${secondary} 41% 59%, transparent 59% 100%)`,
        `linear-gradient(0deg, transparent 0 41%, ${secondary} 41% 59%, transparent 59% 100%)`,
        `linear-gradient(145deg, ${primary} 0%, ${withAlpha(primary, "F0")} 100%)`,
      ].join(", ");
    case "tricolor-feathers":
      return [
        `repeating-linear-gradient(155deg, ${withAlpha(accent, "26")} 0 12px, transparent 12px 26px)`,
        `linear-gradient(90deg, ${primary} 0 34%, ${secondary} 34% 67%, ${accent} 67% 100%)`,
      ].join(", ");
    case "fleur-royale":
      return [
        `radial-gradient(circle at 20% 24%, ${withAlpha("#FFFFFF", "34")} 0 4%, transparent 5%)`,
        `radial-gradient(circle at 80% 24%, ${withAlpha("#FFFFFF", "34")} 0 4%, transparent 5%)`,
        `radial-gradient(circle at 50% 72%, ${withAlpha("#FFFFFF", "28")} 0 5%, transparent 6%)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 100%)`,
      ].join(", ");
    case "sun-ember":
      return [
        `radial-gradient(circle at 50% 50%, ${withAlpha(secondary, "66")} 0 12%, transparent 40%)`,
        `linear-gradient(145deg, ${primary} 0%, ${accent} 100%)`,
      ].join(", ");
    case "crescent-trail":
      return [
        `radial-gradient(circle at 34% 38%, ${withAlpha("#FFFFFF", "E2")} 0 9%, transparent 9.5%)`,
        `radial-gradient(circle at 39% 38%, ${withAlpha(primary, "FF")} 0 8%, transparent 8.5%)`,
        `radial-gradient(circle at 56% 38%, ${withAlpha("#FFFFFF", "E2")} 0 2.5%, transparent 3%)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 100%)`,
      ].join(", ");
    case "nordic-cross":
      return [
        `linear-gradient(90deg, transparent 0 34%, ${secondary} 34% 46%, ${accent} 46% 54%, ${secondary} 54% 66%, transparent 66% 100%)`,
        `linear-gradient(0deg, transparent 0 42%, ${secondary} 42% 54%, ${accent} 54% 62%, ${secondary} 62% 74%, transparent 74% 100%)`,
        `linear-gradient(145deg, ${primary} 0%, ${withAlpha(primary, "EE")} 100%)`,
      ].join(", ");
    case "scandi-geo":
      return [
        `repeating-linear-gradient(135deg, ${withAlpha(accent, "22")} 0 20px, transparent 20px 42px)`,
        `linear-gradient(90deg, transparent 0 38%, ${secondary} 38% 48%, transparent 48% 100%)`,
        `linear-gradient(145deg, ${primary} 0%, ${withAlpha(primary, "E8")} 100%)`,
      ].join(", ");
    case "crystal-glass":
      return [
        `linear-gradient(125deg, ${withAlpha("#FFFFFF", "00")} 0 20%, ${withAlpha("#FFFFFF", "80")} 20% 30%, ${withAlpha("#FFFFFF", "00")} 30% 100%)`,
        `repeating-linear-gradient(45deg, ${withAlpha(accent, "22")} 0 18px, transparent 18px 36px)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 100%)`,
      ].join(", ");
    case "ice-crystal":
      return [
        `repeating-linear-gradient(135deg, ${withAlpha(accent, "30")} 0 18px, transparent 18px 40px)`,
        `repeating-linear-gradient(45deg, ${withAlpha("#FFFFFF", "46")} 0 14px, transparent 14px 34px)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 72%, ${accent} 100%)`,
      ].join(", ");
    case "starfield":
      return [
        `radial-gradient(circle at 18% 24%, ${withAlpha("#FFFFFF", "AA")} 0 1.8%, transparent 2.2%)`,
        `radial-gradient(circle at 72% 18%, ${withAlpha("#FFFFFF", "88")} 0 1.5%, transparent 2%)`,
        `radial-gradient(circle at 82% 78%, ${withAlpha("#FFFFFF", "88")} 0 1.6%, transparent 2.1%)`,
        `radial-gradient(circle at 34% 72%, ${withAlpha("#FFFFFF", "70")} 0 1.4%, transparent 2%)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 65%, ${accent} 100%)`,
      ].join(", ");
    case "maple-corners":
      return [
        `radial-gradient(circle at 8% 8%, ${withAlpha(primary, "AA")} 0 8%, transparent 9%)`,
        `radial-gradient(circle at 92% 8%, ${withAlpha(primary, "AA")} 0 8%, transparent 9%)`,
        `linear-gradient(145deg, ${secondary} 0%, ${accent} 45%, ${secondary} 100%)`,
      ].join(", ");
    case "sun-rays":
      return [
        `conic-gradient(from 180deg at 50% 50%, ${withAlpha(accent, "66")} 0deg 20deg, transparent 20deg 40deg, ${withAlpha(accent, "44")} 40deg 60deg, transparent 60deg 80deg, ${withAlpha(accent, "44")} 80deg 100deg, transparent 100deg 120deg, ${withAlpha(accent, "44")} 120deg 140deg, transparent 140deg 160deg, ${withAlpha(accent, "44")} 160deg 180deg, transparent 180deg 360deg)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 100%)`,
      ].join(", ");
    case "tropical-leaves":
      return [
        `radial-gradient(ellipse at 20% 75%, ${withAlpha(accent, "34")} 0 14%, transparent 15%)`,
        `radial-gradient(ellipse at 78% 25%, ${withAlpha(secondary, "42")} 0 16%, transparent 17%)`,
        `repeating-linear-gradient(135deg, ${withAlpha("#FFFFFF", "10")} 0 18px, transparent 18px 38px)`,
        `linear-gradient(145deg, ${primary} 0%, ${secondary} 85%)`,
      ].join(", ");
    case "sakura-sun":
      return [
        `radial-gradient(circle at 50% 38%, ${withAlpha(secondary, "C0")} 0 10%, transparent 11%)`,
        `radial-gradient(circle at 24% 26%, ${withAlpha(accent, "72")} 0 4%, transparent 5%)`,
        `radial-gradient(circle at 76% 72%, ${withAlpha(accent, "72")} 0 4%, transparent 5%)`,
        `linear-gradient(145deg, ${primary} 0%, ${withAlpha(primary, "F2")} 100%)`,
      ].join(", ");
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
