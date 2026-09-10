"use client";

import Image from "next/image";
import { useEffect, type CSSProperties, type ReactNode } from "react";
import { CoinAmount } from "@/components/CoinAmount";
import { LayeredAvatar } from "@/components/LayeredAvatar";
import { ProfileBorderFrame } from "@/components/ProfileBorderFrame";
import { ProfileFrameOrnaments } from "@/components/ProfileFrameOrnaments";
import {
  ADDRESS_TERM_LABELS,
  ADDRESS_TERM_VALUES,
  type AddressTerm,
} from "@/lib/address-term";
import { getAvatarBackgroundPresentation } from "@/lib/avatar-background-cosmetics";
import {
  getCosmeticItem,
  type CosmeticType,
  type SpendBadge,
} from "@/lib/cosmetics";
import type { EquippedAvatarSlots } from "@/lib/avatar-slots";
import type { ProfileBorderFramePresentation } from "@/lib/profile-border-presentation";

type ProfileHeaderStat = { label: string; value: ReactNode; hint?: string };

type ProfileHeaderProps = {
  avatarSrc: string;
  badgeStrip?: ReactNode;
  coins: number;
  currentTitle?: string;
  displayName?: string | null;
  equippedAvatarSlots?: EquippedAvatarSlots;
  equippedFullSetId?: string | null;
  hasUncensoredAvatar?: boolean;
  pageLabel: string;
  showCoinStat?: boolean;
  soundControls?: ReactNode;
  stats: ProfileHeaderStat[];
  username: string;
  usernameStyle?: CSSProperties;
  avatarBorderPresentation?: ProfileBorderFramePresentation;
  avatarBackgroundItemId?: string | null;
  spendBadge?: SpendBadge | null;
  equippedCosmeticIds?: Partial<Record<CosmeticType, string>>;
  actions?: ReactNode;
  progressStrip?: ReactNode;
  hasDisplayNameChangeRight?: boolean;
  isEditingDisplayName?: boolean;
  displayNameEditInput?: string;
  isDisplayNameSaveDisabled?: boolean;
  onStartDisplayNameEdit?: () => void;
  onSaveDisplayNameEdit?: () => void;
  onCancelDisplayNameEdit?: () => void;
  onDisplayNameEditInputChange?: (value: string) => void;
  addressTerm?: AddressTerm;
  isSavingAddressTerm?: boolean;
  onChangeAddressTerm?: (term: AddressTerm) => void;
};

export function ProfileHeader({
  actions,
  progressStrip,
  badgeStrip,
  coins,
  currentTitle,
  equippedAvatarSlots = {},
  equippedFullSetId = null,
  hasUncensoredAvatar = false,
  pageLabel,
  showCoinStat = true,
  soundControls,
  stats,
  username,
  usernameStyle,
  avatarBorderPresentation,
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
  addressTerm,
  isSavingAddressTerm = false,
  onChangeAddressTerm,
}: ProfileHeaderProps) {
  const avatarBackgroundPresentation = getAvatarBackgroundPresentation(
    getCosmeticItem(
      avatarBackgroundItemId ??
        equippedCosmeticIds?.["avatar-background"] ??
        "",
    ),
  );

  useEffect(() => {
    if (!isEditingDisplayName || !onCancelDisplayNameEdit) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelDisplayNameEdit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditingDisplayName, onCancelDisplayNameEdit]);

  const visibleName = displayName?.trim() || username;
  const ledgerStats: ProfileHeaderStat[] = [
    ...(showCoinStat
      ? [
          {
            hint: "Current balance",
            label: "Treasury",
            value: <CoinAmount amount={coins} iconSize={18} label="" />,
          },
        ]
      : []),
    ...stats,
  ];

  return (
    <header
      aria-label="Court profile"
      className="court-profile-header relative isolate overflow-visible border border-[#c89a55]/18 bg-[linear-gradient(105deg,rgba(13,6,9,.96),rgba(35,8,21,.78),rgba(8,4,6,.96))] shadow-[0_22px_65px_rgba(0,0,0,.32)]"
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 w-2/5 bg-[radial-gradient(circle_at_70%_20%,rgba(190,24,93,.14),transparent_52%)]" />
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#d7ad69]/35 to-transparent" />

      <div className="court-profile-layout relative">
        <div className="court-profile-portrait">
          <div className="court-profile-avatar relative">
            <ProfileBorderFrame
              className="h-full rounded-[1.1rem]"
              contentClassName="overflow-hidden rounded-[calc(1.1rem-3px)] bg-black/45"
              overlay={
                equippedCosmeticIds ? (
                  <ProfileFrameOrnaments
                    equippedCosmeticIds={equippedCosmeticIds}
                  />
                ) : null
              }
              presentation={
                avatarBorderPresentation ?? {
                  contentInset: 3,
                  layered: false,
                  layers: [],
                  variant: null,
                }
              }
            >
              <LayeredAvatar
                alt="Principessa court profile avatar"
                backgroundOverlayPath={
                  avatarBackgroundPresentation.backgroundOverlayPath
                }
                backgroundPath={avatarBackgroundPresentation.backgroundPath}
                backgroundStyle={avatarBackgroundPresentation.backgroundStyle}
                className="absolute inset-0"
                equipped={equippedAvatarSlots}
                equippedFullSetId={equippedFullSetId}
                hasUncensored={hasUncensoredAvatar}
                priority
              />
            </ProfileBorderFrame>
          </div>
        </div>

        <div className="court-profile-identity min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[.34em] text-[#d7ad69]/55">
            {pageLabel}
          </p>
          {!isEditingDisplayName ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2
                className="court-profile-name font-serif text-[#fff0d2]"
                style={usernameStyle}
              >
                {visibleName}
              </h2>
              {spendBadge?.isEarned ? (
                <span
                  className="inline-flex h-8 w-8 items-center justify-center border border-[#c89a55]/20 bg-black/30"
                  title={spendBadge.tooltip}
                >
                  <Image
                    alt=""
                    className="h-6 w-6 object-contain"
                    height={24}
                    src={spendBadge.imagePath}
                    width={24}
                  />
                </span>
              ) : null}
              {hasDisplayNameChangeRight && onStartDisplayNameEdit ? (
                <button
                  className="text-sm text-pink-300/60 transition hover:text-pink-200"
                  onClick={onStartDisplayNameEdit}
                  title="Change Display Name"
                  type="button"
                >
                  ✎
                </button>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 flex max-w-xl flex-wrap gap-2">
              <input
                autoFocus
                className="min-w-0 w-full flex-1 border border-[#c89a55]/20 bg-black/50 px-3 py-2 font-serif text-2xl text-[#fff0d2] outline-none focus:border-pink-300/50"
                maxLength={24}
                onChange={(event) =>
                  onDisplayNameEditInputChange?.(event.target.value)
                }
                value={displayNameEditInput}
              />
              <button
                className="bg-pink-700 px-4 py-2 text-xs font-black text-white disabled:opacity-40"
                disabled={isDisplayNameSaveDisabled}
                onClick={onSaveDisplayNameEdit}
                type="button"
              >
                Save
              </button>
              <button
                className="border border-white/10 px-4 py-2 text-xs font-black text-zinc-400"
                onClick={onCancelDisplayNameEdit}
                type="button"
              >
                Cancel
              </button>
            </div>
          )}
          <p className="mt-1 text-xs text-pink-200/35">
            {displayName?.trim() && !isEditingDisplayName
              ? username
              : "Identity held by Principessa"}
          </p>
          <p className="mt-3 text-[10px] font-black uppercase tracking-[.2em] text-pink-100/65">
            {currentTitle ?? "No title granted"}
          </p>
          {addressTerm && onChangeAddressTerm ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {ADDRESS_TERM_VALUES.map((term) => {
                const isCurrent = addressTerm === term;
                return (
                  <button
                    className={`border px-2 py-0.5 text-[9px] font-black uppercase tracking-[.14em] transition ${
                      isCurrent
                        ? "border-[#c89a55]/40 bg-[#c89a55]/15 text-[#fff0d2]"
                        : "border-white/10 text-zinc-500 hover:border-white/25 hover:text-zinc-300"
                    }`}
                    disabled={isSavingAddressTerm}
                    key={term}
                    onClick={() => onChangeAddressTerm(term)}
                    type="button"
                  >
                    {ADDRESS_TERM_LABELS[term]}
                  </button>
                );
              })}
            </div>
          ) : null}
          {badgeStrip ? <div className="mt-3">{badgeStrip}</div> : null}
        </div>
        {soundControls || actions ? (
          <div className="court-profile-actions">
            {soundControls && (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {soundControls}
              </div>
            )}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          </div>
        ) : null}

        {progressStrip ? (
          <div className="court-profile-progress min-w-0">{progressStrip}</div>
        ) : null}
        <div className="court-profile-ledger grid grid-cols-2 border-y border-[#c89a55]/10 xl:grid-cols-4">
          {ledgerStats.map((stat) => (
            <div
              className="court-profile-stat min-w-0 border-[#c89a55]/10 px-3 py-3"
              key={stat.label}
            >
              <p className="text-[8px] font-black uppercase tracking-[.24em] text-[#c89a55]/45">
                {stat.label}
              </p>
              <div className="mt-1 break-words text-base font-black text-[#fff0d2] sm:text-lg">
                {stat.value}
              </div>
              {stat.hint ? (
                <p className="mt-1 text-[9px] text-zinc-400">
                  {stat.hint}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
