"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import type {
  ProfileBorderFramePresentation,
  ProfileBorderLayerPresentation,
} from "@/lib/profile-border-presentation";

const PROFILE_BORDER_PATH =
  "M 18 3 H 162 A 15 15 0 0 1 177 18 V 270 A 15 15 0 0 1 162 285 H 18 A 15 15 0 0 1 3 270 V 18 A 15 15 0 0 1 18 3 Z";

type ProfileBorderFrameProps = {
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  overlay?: ReactNode;
  presentation: ProfileBorderFramePresentation;
};

function buildMaskStyle(padding: number, style?: CSSProperties) {
  return {
    ...style,
    WebkitMask:
      "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
    WebkitMaskComposite: "xor",
    maskComposite: "exclude",
    padding,
  } satisfies CSSProperties;
}

function getAnimationStyle(layer: ProfileBorderLayerPresentation): CSSProperties | undefined {
  switch (layer.animation) {
    case "ember-flicker":
      return { animation: "profileBorderEmber 4.8s ease-in-out infinite" };
    case "flag-sheen":
      return { animation: "profileBorderSheen 7.4s linear infinite" };
    case "neon-pulse":
      return { animation: "profileBorderNeon 4.2s ease-in-out infinite" };
    case "royal-shimmer":
      return { animation: "profileBorderShimmer 6.8s ease-in-out infinite" };
    case "subtle-glow":
      return { animation: "profileBorderPulse 6.4s ease-in-out infinite" };
    case "wave-drift":
      return { animation: "profileBorderDrift 8.2s ease-in-out infinite" };
    default:
      return undefined;
  }
}

function LayeredBorderRing({
  layer,
  thickness,
}: {
  layer: ProfileBorderLayerPresentation;
  thickness: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
      style={buildMaskStyle(thickness, {
        ...(getAnimationStyle(layer) ?? {}),
        backgroundBlendMode: "screen",
        backgroundImage: layer.backgroundImage,
        backgroundPosition: layer.backgroundPosition,
        backgroundRepeat: layer.backgroundRepeat ?? "no-repeat",
        backgroundSize: layer.backgroundSize ?? "cover",
        filter: layer.filter,
        mixBlendMode: layer.mixBlendMode,
        opacity: layer.opacity ?? 1,
      })}
    />
  );
}

export function ProfileBorderFrame({
  children,
  className,
  contentClassName,
  contentStyle,
  overlay,
  presentation,
}: ProfileBorderFrameProps) {
  const ids = useId().replaceAll(":", "");
  const inset = presentation.contentInset;

  return (
    <div className={`relative ${className ?? ""}`}>
      {presentation.layered ? (
        <>
          {presentation.glowStyle ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-1 rounded-[inherit] opacity-95 blur-sm"
              style={presentation.glowStyle}
            />
          ) : null}
          {presentation.layers.map((layer, index) => (
            <LayeredBorderRing
              key={`${ids}-layer-${index}`}
              layer={layer}
              thickness={inset}
            />
          ))}
        </>
      ) : (
        <>
          <div
            aria-hidden="true"
            className={`absolute inset-0 rounded-[inherit] ${presentation.legacyBackgroundClassName ?? "bg-white/10"}`}
            style={buildMaskStyle(inset, presentation.legacyBackgroundStyle)}
          />
          {presentation.variant ? (
            <ProfileBorderLightRunner ids={ids} variant={presentation.variant} />
          ) : presentation.legacyRingClassName ? (
            <div
              aria-hidden="true"
              className={presentation.legacyRingClassName}
              style={presentation.legacyRingStyle}
            />
          ) : null}
        </>
      )}

      <div
        className={`absolute z-10 ${contentClassName ?? ""}`}
        style={{
          ...contentStyle,
          boxShadow: presentation.contentShadow ?? contentStyle?.boxShadow,
          inset,
        }}
      >
        {children}
      </div>

      {overlay ? (
        <div className="pointer-events-none absolute inset-0 z-20">
          {overlay}
        </div>
      ) : null}
    </div>
  );
}

type ProfileBorderLightRunnerProps = {
  ids: string;
  variant: "rainbow" | "runner";
};

function ProfileBorderLightRunner({ ids, variant }: ProfileBorderLightRunnerProps) {
  const isRainbow = variant === "rainbow";
  const baseGradientId = `${ids}-profile-border-base`;
  const coreGradientId = `${ids}-profile-border-core`;
  const auraGradientId = `${ids}-profile-border-aura`;
  const duration = isRainbow ? "7.5s" : "6.2s";
  const dashLength = isRainbow ? 28 : 24;
  const gapLength = 972;
  const runnerOutlineStroke = isRainbow ? "rgba(0, 0, 0, 0.58)" : "rgba(7, 4, 12, 0.82)";
  const runnerOutlineWidth = 7.15;
  const runnerStrokeWidth = 4.25;
  const baseBorderStroke = isRainbow ? "rgba(255, 255, 255, 0.08)" : `url(#${baseGradientId})`;
  const runnerCoreStroke = `url(#${coreGradientId})`;
  const runnerCoreOpacity = isRainbow ? 0.72 : 1;
  const auraStrokeOpacity = isRainbow ? 0.18 : 0.72;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
      preserveAspectRatio="none"
      viewBox="0 0 180 288"
    >
      <defs>
        <linearGradient id={baseGradientId} gradientUnits="userSpaceOnUse" x1="3" x2="177" y1="270" y2="18">
          {isRainbow ? (
            <>
              <stop offset="0%" stopColor="#2b173d" />
              <stop offset="22%" stopColor="#47206a" />
              <stop offset="50%" stopColor="#6d28d9" />
              <stop offset="78%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#f472b6" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#251528" />
              <stop offset="45%" stopColor="#5b2a58" />
              <stop offset="100%" stopColor="#8b3a7f" />
            </>
          )}
        </linearGradient>
        <linearGradient id={coreGradientId} gradientUnits="userSpaceOnUse" x1="3" x2="177" y1="270" y2="18">
          {isRainbow ? (
            <>
              <stop offset="0%" stopColor="#fb7185" stopOpacity="0.48" />
              <stop offset="12%" stopColor="#fb7185" stopOpacity="0.82" />
              <stop offset="28%" stopColor="#f472b6" stopOpacity="0.88" />
              <stop offset="44%" stopColor="#a855f7" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#22d3ee" stopOpacity="0.9" />
              <stop offset="76%" stopColor="#34d399" stopOpacity="0.88" />
              <stop offset="92%" stopColor="#f59e0b" stopOpacity="0.82" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.48" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="18%" stopColor="#fde7f3" />
              <stop offset="45%" stopColor="#f9a8d4" />
              <stop offset="72%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="#ffffff" />
            </>
          )}
        </linearGradient>
        <linearGradient id={auraGradientId} gradientUnits="userSpaceOnUse" x1="3" x2="177" y1="270" y2="18">
          {isRainbow ? (
            <>
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="20%" stopColor="#f472b6" />
              <stop offset="40%" stopColor="#a855f7" />
              <stop offset="60%" stopColor="#22d3ee" />
              <stop offset="80%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#f59e0b" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="26%" stopColor="#fda4af" />
              <stop offset="60%" stopColor="#f472b6" />
              <stop offset="100%" stopColor="#ffffff" />
            </>
          )}
        </linearGradient>
      </defs>

      <path
        d={PROFILE_BORDER_PATH}
        fill="none"
        pathLength={1000}
        stroke={baseBorderStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.95}
        strokeWidth={6.5}
      />
      <path
        d={PROFILE_BORDER_PATH}
        fill="none"
        filter="blur(1.6px)"
        pathLength={1000}
        stroke={`url(#${auraGradientId})`}
        strokeDasharray={`${dashLength} ${gapLength}`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={auraStrokeOpacity}
        strokeWidth={9}
      >
        <animate attributeName="stroke-dashoffset" dur={duration} from="0" repeatCount="indefinite" to="-1000" />
      </path>
      <path
        d={PROFILE_BORDER_PATH}
        fill="none"
        pathLength={1000}
        stroke={runnerOutlineStroke}
        strokeDasharray={`${dashLength} ${gapLength}`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={1}
        strokeWidth={runnerOutlineWidth}
      >
        <animate attributeName="stroke-dashoffset" dur={duration} from="0" repeatCount="indefinite" to="-1000" />
      </path>
      <path
        d={PROFILE_BORDER_PATH}
        fill="none"
        pathLength={1000}
        stroke={runnerCoreStroke}
        strokeDasharray={`${dashLength} ${gapLength}`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={runnerCoreOpacity}
        strokeWidth={runnerStrokeWidth}
      >
        <animate attributeName="stroke-dashoffset" dur={duration} from="0" repeatCount="indefinite" to="-1000" />
      </path>
      <path
        d={PROFILE_BORDER_PATH}
        fill="none"
        pathLength={1000}
        stroke={runnerOutlineStroke}
        strokeDasharray={`${dashLength} ${gapLength}`}
        strokeDashoffset="-500"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={1}
        strokeWidth={runnerOutlineWidth}
      >
        <animate attributeName="stroke-dashoffset" dur={duration} from="-500" repeatCount="indefinite" to="-1500" />
      </path>
      <path
        d={PROFILE_BORDER_PATH}
        fill="none"
        pathLength={1000}
        stroke={runnerCoreStroke}
        strokeDasharray={`${dashLength} ${gapLength}`}
        strokeDashoffset="-500"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={runnerCoreOpacity}
        strokeWidth={runnerStrokeWidth}
      >
        <animate attributeName="stroke-dashoffset" dur={duration} from="-500" repeatCount="indefinite" to="-1500" />
      </path>
    </svg>
  );
}
