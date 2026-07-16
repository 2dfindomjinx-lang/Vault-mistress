"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { CoinAmount } from "@/components/CoinAmount";
import { ProfileBorderFrame } from "@/components/ProfileBorderFrame";
import {
  PrincipessaShowcasePreview,
  hasRenderableProfileFramePreview,
} from "@/components/ProfileFrameOrnaments";
import type { EquippedAvatarSlots } from "@/lib/avatar-slots";
import type { CosmeticItem } from "@/lib/cosmetics";
import { getProfileBorderFramePresentation } from "@/lib/profile-border-presentation";
import {
  getProfileFrameDecorationDefinition,
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

type AnimatedSlotState = {
  animationKey: number;
  current: CosmeticItem | null;
  next: CosmeticItem | null;
  isAnimating: boolean;
};

const ACTIVE_SLOT_COUNT = 4;
const SLOT_ANIMATION_MS = 560;

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

function normalizeActiveItems(items: CosmeticItem[]) {
  return Array.from(
    { length: ACTIVE_SLOT_COUNT },
    (_, index) => items[index] ?? null,
  );
}

function createAnimatedSlotState(item: CosmeticItem | null): AnimatedSlotState {
  return {
    animationKey: 0,
    current: item,
    next: null,
    isAnimating: false,
  };
}

function CompactCatalogPreview({ item }: { item: CosmeticItem }) {
  if (item.type === "profile-border") {
    return (
      <div className="mx-auto w-12">
        <ProfileBorderFrame
          className="aspect-[180/285] rounded-[0.9rem]"
          contentClassName="overflow-hidden rounded-[calc(0.9rem-3px)] bg-[linear-gradient(180deg,rgba(16,8,22,0.98),rgba(6,3,10,0.96))]"
          presentation={getProfileBorderFramePresentation(item)}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(255,255,255,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_18%,rgba(255,255,255,0.06)_75%,rgba(0,0,0,0.18)_100%)]" />
        </ProfileBorderFrame>
      </div>
    );
  }

  if (!isProfileFrameCosmeticType(item.type)) {
    return (
      <div className="flex min-h-[3.5rem] items-center justify-center">
        <div className="h-4 w-4 rounded-full border border-white/20 bg-white/12" />
      </div>
    );
  }

  const definition = getProfileFrameDecorationDefinition(item.id);
  const palette = definition?.palette ?? ["#f59e0b", "#fcd34d", "#fff7ed"];
  const primary = palette[0];
  const secondary = palette[1] ?? palette[0];
  const accent = palette[2] ?? palette[1] ?? palette[0];

  return (
    <div className="flex min-h-[3.5rem] items-center justify-center">
      <div className="relative h-[3.55rem] w-[2.45rem] rounded-[0.9rem] bg-[linear-gradient(180deg,rgba(14,7,20,0.96),rgba(5,2,8,0.98))] shadow-[0_0_16px_rgba(0,0,0,0.18)]">
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-[0.9rem] border-[2px]"
          style={{
            borderColor: primary,
            boxShadow: `0 0 10px ${primary}33, inset 0 0 10px ${secondary}22`,
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-[3px] rounded-[0.72rem] border border-white/8"
          style={{
            background: `linear-gradient(180deg, ${secondary}12, transparent 26%, ${accent}10 100%)`,
          }}
        />

        {item.type === "profile-frame-bottom" ? (
          <>
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-[2.55rem] h-2.5 w-4.5 -translate-x-1/2 rounded-full"
              style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }}
            />
            <div
              aria-hidden="true"
              className="absolute left-[0.58rem] top-[2.82rem] h-2 w-2.5 -rotate-12 rounded-full"
              style={{ backgroundColor: primary }}
            />
            <div
              aria-hidden="true"
              className="absolute right-[0.58rem] top-[2.82rem] h-2 w-2.5 rotate-12 rounded-full"
              style={{ backgroundColor: secondary }}
            />
          </>
        ) : null}

        {item.type === "profile-frame-side" ? (
          <>
            <div aria-hidden="true" className="absolute left-[-1px] top-[1rem] h-6 w-1 rounded-full" style={{ backgroundColor: primary }} />
            <div aria-hidden="true" className="absolute right-[-1px] top-[1rem] h-6 w-1 rounded-full" style={{ backgroundColor: secondary }} />
            <div aria-hidden="true" className="absolute left-[0.12rem] top-[1.55rem] h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
            <div aria-hidden="true" className="absolute right-[0.12rem] top-[1.55rem] h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
          </>
        ) : null}

        {item.type === "profile-frame-corner" ? (
          <>
            <div aria-hidden="true" className="absolute left-[0.2rem] top-[2.45rem] h-2.5 w-2.5 rounded-full" style={{ backgroundColor: primary }} />
            <div aria-hidden="true" className="absolute right-[0.2rem] top-[2.45rem] h-2.5 w-2.5 rounded-full" style={{ backgroundColor: secondary }} />
          </>
        ) : null}

        {item.type === "profile-frame-top" ? (
          <>
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-[-3px] h-0 w-0 -translate-x-1/2 border-x-[8px] border-b-[10px] border-x-transparent"
              style={{ borderBottomColor: primary }}
            />
            <div aria-hidden="true" className="absolute left-1/2 top-[0.28rem] h-1.5 w-1.5 -translate-x-1/2 rounded-full" style={{ backgroundColor: accent }} />
          </>
        ) : null}

        {item.type === "profile-frame-overlay" ? (
          <>
            <div
              aria-hidden="true"
              className="absolute left-[0.38rem] right-[0.38rem] top-[2.4rem] h-[2px] rounded-full"
              style={{ backgroundColor: primary }}
            />
            <div
              aria-hidden="true"
              className="absolute left-[0.55rem] right-[0.55rem] top-[2.72rem] h-[2px] rounded-full opacity-80"
              style={{ backgroundColor: secondary }}
            />
          </>
        ) : null}

        {item.type === "profile-frame-particles" ? (
          <>
            <div aria-hidden="true" className="absolute left-[0.3rem] top-[0.55rem] h-1 w-1 rounded-full" style={{ backgroundColor: primary }} />
            <div aria-hidden="true" className="absolute right-[0.35rem] top-[0.85rem] h-1.5 w-1.5 rounded-full" style={{ backgroundColor: secondary }} />
            <div aria-hidden="true" className="absolute left-[0.72rem] top-[1.55rem] h-1 w-1 rounded-full" style={{ backgroundColor: accent }} />
            <div aria-hidden="true" className="absolute right-[0.72rem] top-[2.2rem] h-1 w-1 rounded-full" style={{ backgroundColor: primary }} />
            <div aria-hidden="true" className="absolute left-[1.05rem] top-[2.72rem] h-1.5 w-1.5 rounded-full" style={{ backgroundColor: secondary }} />
          </>
        ) : null}
      </div>
    </div>
  );
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
  const [activeSlots, setActiveSlots] = useState<AnimatedSlotState[]>(() =>
    normalizeActiveItems(items).map((item) => createAnimatedSlotState(item)),
  );
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const groupedPossibleItems = useMemo(() => {
    const groups = new Map<string, CosmeticItem[]>();

    sortedPossibleItems.forEach((item) => {
      const label = getSlotLabel(item);
      const current = groups.get(label) ?? [];
      current.push(item);
      groups.set(label, current);
    });

    return Array.from(groups.entries());
  }, [sortedPossibleItems]);

  useEffect(() => {
    const normalizedItems = normalizeActiveItems(items);

    setActiveSlots((previousSlots) => {
      if (previousSlots.length === 0) {
        return normalizedItems.map((item) => createAnimatedSlotState(item));
      }

      return normalizedItems.map((nextItem, index) => {
        const previousSlot = previousSlots[index] ?? createAnimatedSlotState(null);
        const visibleItem = previousSlot.next ?? previousSlot.current;

        if (!visibleItem && !nextItem) {
          return previousSlot;
        }

        if (!visibleItem || !nextItem) {
          return {
            ...previousSlot,
            current: nextItem,
            next: null,
            isAnimating: false,
          };
        }

        if (visibleItem.id === nextItem.id) {
          return {
            ...previousSlot,
            current: nextItem,
            next: null,
            isAnimating: false,
          };
        }

        return {
          animationKey: previousSlot.animationKey + 1,
          current: visibleItem,
          next: nextItem,
          isAnimating: true,
        };
      });
    });
  }, [items]);

  useEffect(() => {
    const hasAnimatingSlot = activeSlots.some((slot) => slot.isAnimating && slot.next);

    if (!hasAnimatingSlot) {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
      return;
    }

    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    animationTimeoutRef.current = setTimeout(() => {
      setActiveSlots((previousSlots) =>
        previousSlots.map((slot) =>
          slot.isAnimating && slot.next
            ? {
                ...slot,
                current: slot.next,
                next: null,
                isAnimating: false,
              }
            : slot,
        ),
      );
      animationTimeoutRef.current = null;
    }, SLOT_ANIMATION_MS);

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    };
  }, [activeSlots]);

  const renderMinimalPreview = (item: CosmeticItem) => {
    if (item.type === "profile-border" && item.color) {
      return (
        <div
          aria-hidden
          className="h-4 w-6 shrink-0 rounded border border-white/40"
          style={{ backgroundColor: item.color }}
          title="Border color preview"
        />
      );
    }
    if (item.type === "username-color" && item.color) {
      return (
        <div
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/30"
          style={{ backgroundColor: item.color }}
          title="Color preview"
        />
      );
    }
    if (item.type === "username-glow" && item.glow) {
      return (
        <div
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/30 bg-white"
          style={{ boxShadow: item.glow.replace(/0 0 \d+px/g, "0 0 5px") }}
          title="Glow preview"
        />
      );
    }
    if (isProfileFrameCosmeticType(item.type)) {
      return (
        <div
          aria-hidden
          className="flex h-4 w-5 shrink-0 items-center justify-center rounded border border-white/30 bg-white/10 text-[8px] font-black text-amber-200/80"
          title="Frame preview"
        >
          F
        </div>
      );
    }
    return null;
  };

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
        className={`court-grid-card court-grid-card--gold flex h-full min-h-[15.75rem] flex-col rounded-[1.45rem] border p-3 transition lg:min-h-[14rem] ${
          equipped
            ? "border-amber-200/50 bg-amber-400/12 shadow-[0_0_26px_rgba(251,191,36,0.14)]"
            : owned
              ? "border-emerald-200/22 bg-white/[0.05]"
              : isCurrentlyOffered
                ? "border-amber-200/18 bg-black/30"
                : "border-white/10 bg-black/20"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-300">
            {slotLabel}
          </span>
          <span
            className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${
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

        <div className="mt-3 flex items-start gap-3">
          {hasRenderableProfileFramePreview(item) ? (
            <PrincipessaShowcasePreview
              className="w-[5.75rem] shrink-0 lg:w-[5.4rem]"
              equippedAvatarSlots={equippedAvatarSlots}
              equippedCosmeticIds={previewCosmeticIds}
              hasUncensoredAvatar={hasUncensoredAvatar}
              previewItem={item}
              previewMode="shop"
            />
          ) : (
            <div className="flex h-[6.5rem] w-[5.75rem] shrink-0 items-center justify-center rounded-[1rem] border border-white/10 bg-black/20 lg:h-[6.1rem] lg:w-[5.4rem]">
              {renderMinimalPreview(item)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p
              className="line-clamp-2 text-base font-black leading-5 text-white lg:text-[0.95rem]"
              style={{
                color: item.type === "username-color" ? item.color : undefined,
                textShadow: item.type === "username-glow" ? item.glow : undefined,
              }}
            >
              {item.name}
            </p>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-amber-50/70 lg:line-clamp-2">
              {item.description}
            </p>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <CoinAmount amount={item.price} iconSize={14} label="" />
          <button
            className="rounded-2xl border border-amber-200/28 bg-amber-400/15 px-3 py-2 text-xs font-black text-amber-50 transition enabled:hover:border-amber-200/55 enabled:hover:bg-amber-400/22 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={buttonDisabled}
            onClick={() => (owned ? onEquipCosmetic(item) : onPurchaseCosmetic(item))}
            type="button"
          >
            {buttonLabel}
          </button>
        </div>
      </article>
    );
  };

  const renderCatalogTile = (item: CosmeticItem) => {
    const owned = ownedCosmeticIds.includes(item.id);
    const equipped = equippedCosmeticIds[item.type] === item.id;
    const pending = pendingCosmeticIds.includes(item.id);
    const canAfford = coins >= item.price;
    const isCurrentlyOffered = activeItemIdSet.has(item.id);
    const canInteract = owned || isCurrentlyOffered;
    const buttonDisabled =
      disabled ||
      pending ||
      equipped ||
      (!owned && (!canInteract || !canAfford));

    let buttonLabel = "Later";

    if (pending) {
      buttonLabel = "...";
    } else if (equipped) {
      buttonLabel = "On";
    } else if (owned) {
      buttonLabel = "Equip";
    } else if (canInteract && canAfford) {
      buttonLabel = "Buy";
    } else if (canInteract) {
      buttonLabel = "Need";
    }

    const nameStyle: CSSProperties = {};
    if (item.type === "username-color" && item.color) {
      nameStyle.color = item.color;
    }
    if (item.type === "username-glow" && item.glow) {
      nameStyle.textShadow = item.glow.replace(/0 0 22px/g, "0 0 6px");
    }

    return (
      <div
        className={`flex h-full flex-col gap-2 rounded-[1.15rem] border px-2 py-2 ${
          equipped
            ? "border-amber-200/35 bg-amber-400/10"
            : owned
              ? "border-emerald-200/20 bg-emerald-400/5"
              : isCurrentlyOffered
                ? "border-fuchsia-200/20 bg-fuchsia-400/5"
                : "border-white/8 bg-black/18"
        }`}
        key={item.id}
      >
        {hasRenderableProfileFramePreview(item) ? (
          <CompactCatalogPreview item={item} />
        ) : (
          <div className="flex min-h-[3.5rem] items-center justify-center">
            {renderMinimalPreview(item)}
          </div>
        )}

        <div className="min-w-0 text-center">
          <p
            className="line-clamp-2 text-[11px] font-black leading-4 text-white"
            style={nameStyle}
          >
            {item.name}
          </p>
          <p className="mt-1 text-[10px] text-amber-50/58">
            {item.price.toLocaleString()}
          </p>
        </div>

        <button
          className="mt-auto rounded-xl border border-amber-200/22 bg-black/25 px-2 py-1 text-[10px] font-black text-amber-50 transition enabled:hover:border-amber-200/45 enabled:hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-35"
          disabled={buttonDisabled}
          onClick={() => (owned ? onEquipCosmetic(item) : onPurchaseCosmetic(item))}
          type="button"
        >
          {buttonLabel}
        </button>
      </div>
    );
  };

  const renderAnimatedActiveSlot = (slot: AnimatedSlotState, slotIndex: number) => {
    if (!slot.current && !slot.next) {
      return (
        <div className="rounded-[1.45rem] border border-white/10 bg-black/20 p-4 text-sm text-amber-50/65">
          Empty slot
        </div>
      );
    }

    if (!slot.isAnimating || !slot.current || !slot.next) {
      return slot.current ? renderItemCard(slot.current, "active") : null;
    }

    return (
      <div className="h-full overflow-hidden rounded-[1.45rem]">
        <div
          className="flex h-[200%] flex-col animate-[rotating-shop-reel-up_560ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
          key={`${slotIndex}-${slot.animationKey}`}
        >
          <div className="h-1/2">{renderItemCard(slot.current, "active")}</div>
          <div className="h-1/2">{renderItemCard(slot.next, "active")}</div>
        </div>
      </div>
    );
  };

  return (
    <section className="court-feature-panel rounded-[2rem] border border-amber-200/18 bg-[linear-gradient(145deg,rgba(22,10,2,0.92),rgba(120,53,15,0.52),rgba(0,0,0,0.68))] p-5 shadow-[0_0_46px_rgba(251,191,36,0.12)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-amber-200/74">Rotating Shop</p>
          <h2 className="mt-2 text-3xl font-black text-white">Principessa Showcase Rotation</h2>
        </div>
        <div className="rounded-[1.25rem] border border-amber-200/20 bg-black/30 px-4 py-3 text-sm text-amber-50/80">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-100/70">
            Next refresh
          </p>
          <p className="mt-1 text-lg font-black text-white">{formatCountdown(endsAt)}</p>
          <p className="mt-1 text-[11px] text-amber-50/55">2 of 4 slots rotate every 12h</p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <p className="max-w-3xl text-sm leading-6 text-amber-50/72">
          Four live slots stay visible at once. Every 12 hours, only two slots reel upward into
          fresh items while the other two remain unchanged for continuity.
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
        <div className="court-grid court-grid--shop mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {activeSlots.map((slot, index) => (
            <div className="h-full" key={`active-slot-${index}`}>
              {renderAnimatedActiveSlot(slot, index)}
            </div>
          ))}
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
                Full visual previews of the candidate pool. Live items stay buyable, and desktop
                density is tuned so you can scan far more options at once.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {groupedPossibleItems.map(([label, groupedItems]) => (
              <div key={label}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-100/68">
                    {label}
                  </p>
                  <p className="text-[11px] text-amber-50/45">{groupedItems.length} items</p>
                </div>
          <div className="court-grid court-grid--shop grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
                  {groupedItems.map((item) => renderCatalogTile(item))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        @keyframes rotating-shop-reel-up {
          0% {
            transform: translateY(0%);
            filter: brightness(1);
          }
          100% {
            transform: translateY(-50%);
            filter: brightness(1.03);
          }
        }
      `}</style>
    </section>
  );
}
