"use client";

import { useMemo, useState } from "react";
import { CoinAmount } from "@/components/CoinAmount";
import { PrincipessaShowcasePreview, hasRenderableProfileFramePreview } from "@/components/ProfileFrameOrnaments";
import type { EquippedAvatarSlots } from "@/lib/avatar-slots";
import type { CosmeticItem } from "@/lib/cosmetics";
import {
  getProfileFrameCosmeticTypeLabel,
  isProfileFrameCosmeticType,
} from "@/lib/profile-frame-cosmetics";

type RotatingShopProps = {
  coins: number;
  disabled?: boolean;
  endsAt: string;
  equippedAvatarSlots?: EquippedAvatarSlots;
  equippedCosmeticIds: Partial<Record<CosmeticItem["type"], string>>;
  hasUncensoredAvatar?: boolean;
  items: CosmeticItem[];
  ownedCosmeticIds: string[];
  pendingCosmeticIds?: string[];
  possibleItems?: CosmeticItem[];
  onEquipCosmetic: (item: CosmeticItem) => void;
  onPurchaseCosmetic: (item: CosmeticItem) => void;
};

function formatCountdown(targetIso: string) {
  const remainingMs = Math.max(0, new Date(targetIso).getTime() - Date.now());
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, "0")}h ${minutes
      .toString()
      .padStart(2, "0")}m`;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function getSlotLabel(item: CosmeticItem) {
  if (item.type === "profile-border") {
    return "Frame Finish";
  }

  if (isProfileFrameCosmeticType(item.type)) {
    return getProfileFrameCosmeticTypeLabel(item.type);
  }

  if (item.type === "username-color") {
    return "Username Color";
  }

  if (item.type === "username-glow") {
    return "Username Glow";
  }

  return "Limited Cosmetic";
}

function getCatalogPreviewIds(
  equippedCosmeticIds: Partial<Record<CosmeticItem["type"], string>>,
  item: CosmeticItem,
) {
  return {
    ...equippedCosmeticIds,
    [item.type]: item.id,
  };
}

export function RotatingShop({
  coins,
  disabled = false,
  endsAt,
  equippedAvatarSlots = {},
  equippedCosmeticIds,
  hasUncensoredAvatar = false,
  items,
  ownedCosmeticIds,
  pendingCosmeticIds = [],
  possibleItems = [],
  onEquipCosmetic,
  onPurchaseCosmetic,
}: RotatingShopProps) {
  const [showPossibleItems, setShowPossibleItems] = useState(false);
  const activeItemIdSet = useMemo(
    () => new Set(items.map((item) => item.id)),
    [items],
  );
  const sortedPossibleItems = useMemo(() => {
    const typeOrder: CosmeticItem["type"][] = [
      "profile-border",
      "profile-frame-bottom",
      "profile-frame-side",
      "profile-frame-corner",
      "profile-frame-top",
      "profile-frame-overlay",
      "profile-frame-particles",
      "username-color",
      "username-glow",
    ];

    return [...possibleItems].sort((left, right) => {
      const leftTypeIndex = typeOrder.indexOf(left.type);
      const rightTypeIndex = typeOrder.indexOf(right.type);

      if (leftTypeIndex !== rightTypeIndex) {
        return leftTypeIndex - rightTypeIndex;
      }

      if (left.price !== right.price) {
        return left.price - right.price;
      }

      return left.name.localeCompare(right.name);
    });
  }, [possibleItems]);

  const renderItemCard = (item: CosmeticItem, mode: "active" | "catalog") => {
    const owned = ownedCosmeticIds.includes(item.id);
    const equipped = equippedCosmeticIds[item.type] === item.id;
    const pending = pendingCosmeticIds.includes(item.id);
    const canAfford = coins >= item.price;
    const isCurrentlyOffered = activeItemIdSet.has(item.id);
    const slotLabel = getSlotLabel(item);
    const previewCosmeticIds = getCatalogPreviewIds(equippedCosmeticIds, item);
    const canInteract = mode === "active" || owned;
    const buttonDisabled =
      disabled ||
      pending ||
      equipped ||
      (!owned && (!canInteract || !canAfford));

    let buttonLabel = "May Appear Later";

    if (pending) {
      buttonLabel = "Saving...";
    } else if (equipped) {
      buttonLabel = "Equipped";
    } else if (owned) {
      buttonLabel = "Equip";
    } else if (canInteract && canAfford) {
      buttonLabel = "Purchase";
    } else if (canInteract) {
      buttonLabel = "Need Coins";
    }

    return (
      <article
        className={`rounded-[1.55rem] border p-4 transition ${
          equipped
            ? "border-amber-200/50 bg-amber-400/12 shadow-[0_0_26px_rgba(251,191,36,0.14)]"
            : owned
              ? "border-emerald-200/22 bg-white/[0.05]"
              : isCurrentlyOffered
                ? "border-amber-200/18 bg-black/30"
                : "border-white/10 bg-black/20"
        }`}
        key={`${mode}-${item.id}`}
      >
        <div className="flex flex-col gap-4">
          {hasRenderableProfileFramePreview(item) ? (
            <PrincipessaShowcasePreview
              className="mx-auto w-full max-w-[9.5rem]"
              equippedAvatarSlots={equippedAvatarSlots}
              equippedCosmeticIds={previewCosmeticIds}
              hasUncensoredAvatar={hasUncensoredAvatar}
              previewItem={item}
            />
          ) : null}

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className="text-lg font-black text-white"
                  style={{
                    color: item.type === "username-color" ? item.color : undefined,
                    textShadow: item.type === "username-glow" ? item.glow : undefined,
                  }}
                >
                  {item.name}
                </p>
                <span className="rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
                  {slotLabel}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-amber-50/70">{item.description}</p>
            </div>
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                equipped
                  ? "border-amber-200/35 bg-amber-400/15 text-amber-50"
                  : owned
                    ? "border-emerald-200/25 bg-emerald-400/12 text-emerald-50"
                    : isCurrentlyOffered
                      ? "border-fuchsia-200/25 bg-fuchsia-400/10 text-fuchsia-50"
                      : "border-white/12 bg-black/35 text-zinc-300"
              }`}
            >
              {equipped
                ? "Equipped"
                : owned
                  ? "Owned"
                  : isCurrentlyOffered
                    ? "Live Now"
                    : "Possible"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <CoinAmount amount={item.price} iconSize={16} label="" />
            <button
              className="rounded-2xl border border-amber-200/28 bg-amber-400/15 px-4 py-2 text-sm font-black text-amber-50 transition enabled:hover:border-amber-200/55 enabled:hover:bg-amber-400/22 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={buttonDisabled}
              onClick={() => (owned ? onEquipCosmetic(item) : onPurchaseCosmetic(item))}
              type="button"
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <section className="rounded-[2rem] border border-amber-200/18 bg-[linear-gradient(145deg,rgba(22,10,2,0.92),rgba(120,53,15,0.52),rgba(0,0,0,0.68))] p-5 shadow-[0_0_46px_rgba(251,191,36,0.12)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-amber-200/74">Rotating Shop</p>
          <h2 className="mt-2 text-3xl font-black text-white">Principessa Showcase Rotation</h2>
        </div>
        <div className="rounded-[1.25rem] border border-amber-200/20 bg-black/30 px-4 py-3 text-sm text-amber-50/80">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-100/70">Next refresh</p>
          <p className="mt-1 text-lg font-black text-white">{formatCountdown(endsAt)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <p className="max-w-3xl text-sm leading-6 text-amber-50/72">
          Limited frame cosmetics rotate here every cycle. The active offer stays clean with four
          items, but you can open the full candidate list below to review what should stay, change,
          or disappear next.
        </p>
        <button
          className="rounded-2xl border border-amber-200/28 bg-black/25 px-4 py-2 text-sm font-black text-amber-50 transition hover:border-amber-200/55 hover:bg-amber-400/14"
          onClick={() => setShowPossibleItems((current) => !current)}
          type="button"
        >
          {showPossibleItems
            ? `Hide Possible Items (${sortedPossibleItems.length})`
            : `Show Possible Items (${sortedPossibleItems.length})`}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-[1.55rem] border border-white/10 bg-black/28 p-5 text-sm leading-6 text-amber-50/78">
          Rotating shop is temporarily empty. Limited frame cosmetics will appear here again once
          the catalog is seeded.
        </div>
      ) : (
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {items.map((item) => renderItemCard(item, "active"))}
        </div>
      )}

      {showPossibleItems ? (
        <div className="mt-5 rounded-[1.55rem] border border-white/10 bg-black/28 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-100/70">
                Candidate Library
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-50/72">
                Use this panel to review the whole rotation pool quickly. Only live items can be
                purchased, but owned items stay equippable here even when they are not active.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {sortedPossibleItems.map((item) => renderItemCard(item, "catalog"))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
