"use client";

import Image from "next/image";
import { useEffect, useId, type CSSProperties, type ReactNode } from "react";
import { CoinAmount } from "@/components/CoinAmount";
import { LayeredAvatar } from "@/components/LayeredAvatar";
import { PageStatCard } from "@/components/PageStatCard";
import type { SpendBadge } from "@/lib/cosmetics";
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
  coins: number;
  currentTitle?: string;
  displayName?: string | null;
  equippedAvatarSlots?: EquippedAvatarSlots;
  hasUncensoredAvatar?: boolean;
  pageLabel: string;
  soundControls?: ReactNode;
  stats: ProfileHeaderStat[];
  username: string;
  usernameStyle?: CSSProperties;
  avatarFrameClassName?: string;
  avatarFrameStyle?: CSSProperties;
  avatarFrameVariant?: AvatarFrameVariant;
  spendBadge?: SpendBadge | null;
  actions?: ReactNode;
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
  avatarSrc,
  coins,
  currentTitle,
  equippedAvatarSlots = {},
  hasUncensoredAvatar = false,
  pageLabel,
  soundControls,
  stats,
  username,
  usernameStyle,
  avatarFrameClassName,
  avatarFrameStyle,
  avatarFrameVariant = null,
  spendBadge,
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
        <div className="relative overflow-hidden rounded-[1.5rem] sm:h-64 lg:h-72">
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
              className="absolute inset-0"
              equipped={equippedAvatarSlots}
              hasUncensored={hasUncensoredAvatar}
              priority
            />
          </div>
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
            </div>
            <div className="flex w-full flex-col gap-2 xl:w-auto xl:items-end">
              {soundControls && <div className="flex flex-wrap items-center gap-2">{soundControls}</div>}
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PageStatCard
              hint="Current balance"
              label="Coins"
              value={<CoinAmount amount={coins} iconSize={22} label="" />}
            />
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
  const glowFilterId = `${ids}-profile-border-glow`;
  const coreGradientId = `${ids}-profile-border-core`;
  const auraGradientId = `${ids}-profile-border-aura`;
  const pathId = `${ids}-profile-border-path`;
  const duration = isRainbow ? "8.8s" : "7.2s";
  const halfDuration = isRainbow ? "4.4s" : "3.6s";

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
      viewBox="0 0 180 288"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={coreGradientId} x1="0%" x2="100%" y1="0%" y2="0%">
          {isRainbow ? (
            <>
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="12%" stopColor="#f9a8d4" />
              <stop offset="28%" stopColor="#a855f7" />
              <stop offset="46%" stopColor="#22d3ee" />
              <stop offset="64%" stopColor="#34d399" />
              <stop offset="82%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#fb7185" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="18%" stopColor="#fdf2f8" />
              <stop offset="42%" stopColor="#f9a8d4" />
              <stop offset="70%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="#ec4899" />
            </>
          )}
        </linearGradient>
        <linearGradient id={auraGradientId} x1="0%" x2="100%" y1="0%" y2="0%">
          {isRainbow ? (
            <>
              <stop offset="0%" stopColor="#fb7185" stopOpacity="0.15" />
              <stop offset="18%" stopColor="#f472b6" stopOpacity="0.55" />
              <stop offset="36%" stopColor="#a855f7" stopOpacity="0.95" />
              <stop offset="54%" stopColor="#22d3ee" stopOpacity="0.9" />
              <stop offset="72%" stopColor="#34d399" stopOpacity="0.85" />
              <stop offset="88%" stopColor="#f59e0b" stopOpacity="0.78" />
              <stop offset="100%" stopColor="#fb7185" stopOpacity="0.22" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
              <stop offset="24%" stopColor="#f472b6" stopOpacity="0.42" />
              <stop offset="58%" stopColor="#f9a8d4" stopOpacity="0.82" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.18" />
            </>
          )}
        </linearGradient>
        <filter
          id={glowFilterId}
          x="-70%"
          y="-70%"
          width="240%"
          height="240%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation={isRainbow ? 2.15 : 1.5} result="blur" />
          <feColorMatrix
            in="blur"
            result="colorBlur"
            type="matrix"
            values={
              isRainbow
                ? "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 16 -6"
                : "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 12 -4"
            }
          />
        </filter>
      </defs>

      <path id={pathId} d={PROFILE_BORDER_PATH} fill="none" />

      <g filter={`url(#${glowFilterId})`}>
        <g opacity={0.96}>
          <animateMotion dur={duration} repeatCount="indefinite" rotate="auto">
            <mpath href={`#${pathId}`} />
          </animateMotion>
          <rect
            x="-10.5"
            y="-2.1"
            width="21"
            height="4.2"
            rx="2.1"
            fill={`url(#${coreGradientId})`}
          />
        </g>
        <g opacity={0.78}>
          <animateMotion dur={duration} begin={`-${halfDuration}`} repeatCount="indefinite" rotate="auto">
            <mpath href={`#${pathId}`} />
          </animateMotion>
          <rect
            x="-8.5"
            y="-1.6"
            width="17"
            height="3.2"
            rx="1.6"
            fill={`url(#${auraGradientId})`}
          />
        </g>
      </g>
    </svg>
  );
}
