"use client";

import Image from "next/image";
import { useEffect, useId, type CSSProperties, type ReactNode } from "react";
import { CoinAmount } from "@/components/CoinAmount";
import { LayeredAvatar } from "@/components/LayeredAvatar";
import { PageStatCard } from "@/components/PageStatCard";
import { ProfileFrameOrnaments } from "@/components/ProfileFrameOrnaments";
import { getAvatarBackgroundPresentation } from "@/lib/avatar-background-cosmetics";
import { getCosmeticItem } from "@/lib/cosmetics";
import type { CosmeticType, SpendBadge } from "@/lib/cosmetics";
import type { EquippedAvatarSlots } from "@/lib/avatar-slots";

type AvatarFrameVariant = "runner" | "rainbow" | null;

const PROFILE_BORDER_PATH =
  "M 18 3 H 162 A 15 15 0 0 1 177 18 V 270 A 15 15 0 0 1 162 285 H 18 A 15 15 0 0 1 3 270 V 18 A 15 15 0 0 1 18 3 Z";

type ProfileHeaderStat = {
  label: string;
  value: ReactNode;
  hint?: string;
};

type ProfileHeaderProps = {
  avatarSrc: string;
  badgeStrip?: ReactNode;
  coins: number;
  currentTitle?: string;
  displayName?: string | null;
  equippedAvatarSlots?: EquippedAvatarSlots;
  hasUncensoredAvatar?: boolean;
  pageLabel: string;
  showCoinStat?: boolean;
  soundControls?: ReactNode;
  stats: ProfileHeaderStat[];
  username: string;
  usernameStyle?: CSSProperties;
  avatarFrameClassName?: string;
  avatarFrameStyle?: CSSProperties;
  avatarFrameVariant?: AvatarFrameVariant;
  avatarBackgroundItemId?: string | null;
  spendBadge?: SpendBadge | null;
  equippedCosmeticIds?: Partial<Record<CosmeticType, string>>;
  actions?: ReactNode;
  progressStrip?: ReactNode;
  // Display Name change right pencil mechanic in the top header box
  hasDisplayNameChangeRight?: boolean;
  isEditingDisplayName?: boolean;
  displayNameEditInput?: string;
  isDisplayNameSaveDisabled?: boolean;
  onStartDisplayNameEdit?: () => void;
  onSaveDisplayNameEdit?: () => void;
  onCancelDisplayNameEdit?: () => void;
  onDisplayNameEditInputChange?: (value: string) => void;
};

export function ProfileHeader({
  actions,
  progressStrip,
  avatarSrc,
  badgeStrip,
  coins,
  currentTitle,
  equippedAvatarSlots = {},
  hasUncensoredAvatar = false,
  pageLabel,
  showCoinStat = true,
  soundControls,
  stats,
  username,
  usernameStyle,
  avatarFrameClassName,
  avatarFrameStyle,
  avatarFrameVariant = null,
  avatarBackgroundItemId = null,
  spendBadge,
  equippedCosmeticIds,
  displayName,
  hasDisplayNameChangeRight = false,
  isEditingDisplayName = false,
  displayNameEditInput = "",
  isDisplayNameSaveDisabled = false,
  onStartDisplayNameEdit,
  onSaveDisplayNameEdit,
  onCancelDisplayNameEdit,
  onDisplayNameEditInputChange,
}: ProfileHeaderProps) {
  const profileBorderIds = useId().replaceAll(":", "");
  const avatarBackgroundPresentation = getAvatarBackgroundPresentation(
    getCosmeticItem(
      avatarBackgroundItemId ?? equippedCosmeticIds?.["avatar-background"] ?? "",
    ),
  );

  useEffect(() => {
    if (!isEditingDisplayName || !onCancelDisplayNameEdit) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelDisplayNameEdit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isEditingDisplayName, onCancelDisplayNameEdit]);

  return (
    <header className="overflow-hidden rounded-[2rem] border border-fuchsia-200/15 bg-[linear-gradient(135deg,rgba(18,7,27,0.96),rgba(79,13,68,0.48),rgba(0,0,0,0.78))] shadow-[0_0_44px_rgba(217,70,239,0.12)]">
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[180px_minmax(0,1fr)]">
        <div className="relative rounded-[1.5rem] sm:h-64 lg:h-72">
          <div
            aria-hidden="true"
            className={`absolute inset-0 rounded-[1.5rem] ${avatarFrameClassName ?? "bg-white/10"}`}
            style={{
              ...avatarFrameStyle,
              inset: 0,
              padding: "3px",
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />
          {avatarFrameVariant ? (
            <ProfileBorderLightRunner
              ids={profileBorderIds}
              variant={avatarFrameVariant}
            />
          ) : null}
          <div className="absolute inset-[3px] z-10 overflow-hidden rounded-[calc(1.5rem-3px)] bg-black/35">
            <LayeredAvatar
              alt="Full-body Principessa avatar preview"
              backgroundOverlayPath={avatarBackgroundPresentation.backgroundOverlayPath}
              backgroundPath={avatarBackgroundPresentation.backgroundPath}
              backgroundStyle={avatarBackgroundPresentation.backgroundStyle}
              className="absolute inset-0"
              equipped={equippedAvatarSlots}
              hasUncensored={hasUncensoredAvatar}
              priority
            />
          </div>
          {equippedCosmeticIds ? (
            <div className="absolute inset-0 z-20 pointer-events-none">
              <ProfileFrameOrnaments equippedCosmeticIds={equippedCosmeticIds} />
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.32em] text-fuchsia-200/70">
                {pageLabel}
              </p>
              {!isEditingDisplayName ? (
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-3xl font-black text-white sm:text-4xl" style={usernameStyle}>
                    {displayName && displayName.trim() ? displayName.trim() : username}
                  </h2>
                  {spendBadge?.isEarned && (
                    <span
                      aria-label={spendBadge.tooltip}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-fuchsia-200/20 bg-white/5 text-lg shadow-[0_0_18px_rgba(217,70,239,0.12)]"
                      title={spendBadge.tooltip}
                    >
                      <Image
                        alt=""
                        className="h-7 w-7 rounded-full object-contain"
                        height={28}
                        src={spendBadge.imagePath}
                        width={28}
                      />
                    </span>
                  )}
                  {hasDisplayNameChangeRight && onStartDisplayNameEdit && (
                    <button
                      onClick={onStartDisplayNameEdit}
                      className="text-lg leading-none text-pink-300 hover:text-pink-200 transition hover:scale-110"
                      title="Change Display Name using your purchased right"
                      type="button"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative z-20 flex w-full flex-col gap-3">
                  <input
                    value={displayNameEditInput}
                    onChange={(e) => onDisplayNameEditInputChange?.(e.target.value)}
                    className="min-w-0 w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-3xl font-black text-white outline-none focus:border-pink-300/60"
                    maxLength={24}
                    placeholder="New display name"
                    autoFocus
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        onCancelDisplayNameEdit?.();
                      }
                    }}
                  />
                  <div className="flex flex-wrap gap-2 text-sm">
                    <button
                      onClick={onSaveDisplayNameEdit}
                      disabled={isDisplayNameSaveDisabled}
                      className="rounded-full bg-pink-500 px-4 py-2 font-black text-black transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:bg-pink-500/35 disabled:text-black/60"
                      type="button"
                    >
                      Save
                    </button>
                    <button
                      onClick={onCancelDisplayNameEdit}
                      className="rounded-full border border-white/20 px-4 py-2 font-black transition hover:border-white/35 hover:bg-white/5"
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <p className="mt-1 text-sm font-black text-pink-100/70">
                {displayName && displayName.trim() && !isEditingDisplayName ? username : null}
              </p>
              <p className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-pink-100/80">
                {currentTitle ?? "No title equipped"}
              </p>
              {badgeStrip ? <div className="mt-3">{badgeStrip}</div> : null}
            </div>
            <div className="flex w-full flex-col gap-2 xl:w-auto xl:items-end">
              {soundControls && <div className="flex flex-wrap items-center gap-2">{soundControls}</div>}
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
          </div>

          {progressStrip ? <div>{progressStrip}</div> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {showCoinStat ? (
              <PageStatCard
                hint="Current balance"
                label="Coins"
                value={<CoinAmount amount={coins} iconSize={22} label="" />}
              />
            ) : null}
            {stats.map((stat) => (
              <PageStatCard
                hint={stat.hint}
                key={stat.label}
                label={stat.label}
                value={stat.value}
              />
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

type ProfileBorderLightRunnerProps = {
  ids: string;
  variant: Exclude<AvatarFrameVariant, null>;
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
      viewBox="0 0 180 288"
      preserveAspectRatio="none"
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
        pathLength={1000}
        stroke={`url(#${auraGradientId})`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={auraStrokeOpacity}
        strokeWidth={9}
        filter="blur(1.6px)"
        strokeDasharray={`${dashLength} ${gapLength}`}
      >
        <animate
          attributeName="stroke-dashoffset"
          dur={duration}
          repeatCount="indefinite"
          from="0"
          to="-1000"
        />
      </path>
      <path
        d={PROFILE_BORDER_PATH}
        fill="none"
        pathLength={1000}
        stroke={runnerOutlineStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={1}
        strokeWidth={runnerOutlineWidth}
        strokeDasharray={`${dashLength} ${gapLength}`}
      >
        <animate
          attributeName="stroke-dashoffset"
          dur={duration}
          repeatCount="indefinite"
          from="0"
          to="-1000"
        />
      </path>
      <path
        d={PROFILE_BORDER_PATH}
        fill="none"
        pathLength={1000}
        stroke={runnerCoreStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={runnerCoreOpacity}
        strokeWidth={runnerStrokeWidth}
        strokeDasharray={`${dashLength} ${gapLength}`}
      >
        <animate
          attributeName="stroke-dashoffset"
          dur={duration}
          repeatCount="indefinite"
          from="0"
          to="-1000"
        />
      </path>
      <path
        d={PROFILE_BORDER_PATH}
        fill="none"
        pathLength={1000}
        stroke={runnerOutlineStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={1}
        strokeWidth={runnerOutlineWidth}
        strokeDasharray={`${dashLength} ${gapLength}`}
        strokeDashoffset="-500"
      >
        <animate
          attributeName="stroke-dashoffset"
          dur={duration}
          repeatCount="indefinite"
          from="-500"
          to="-1500"
        />
      </path>
      <path
        d={PROFILE_BORDER_PATH}
        fill="none"
        pathLength={1000}
        stroke={runnerCoreStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={runnerCoreOpacity}
        strokeWidth={runnerStrokeWidth}
        strokeDasharray={`${dashLength} ${gapLength}`}
        strokeDashoffset="-500"
      >
        <animate
          attributeName="stroke-dashoffset"
          dur={duration}
          repeatCount="indefinite"
          from="-500"
          to="-1500"
        />
      </path>
    </svg>
  );
}
