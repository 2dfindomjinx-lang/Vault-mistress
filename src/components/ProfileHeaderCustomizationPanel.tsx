"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { EquippedAvatarSlots } from "@/lib/avatar-slots";
import { getCosmeticItem, type CosmeticItem, type CosmeticType } from "@/lib/cosmetics";
import { getProfileFrameCosmeticTypeLabel, isProfileFrameCosmeticType } from "@/lib/profile-frame-cosmetics";
import { PrincipessaShowcasePreview } from "@/components/ProfileFrameOrnaments";

type ProfileHeaderCustomizationPanelProps = {
  currentTitle?: string;
  displayName?: string | null;
  equippedAvatarSlots: EquippedAvatarSlots;
  equippedCosmeticIds: Partial<Record<CosmeticType, string>>;
  hasUncensoredAvatar?: boolean;
  ownedItems: CosmeticItem[];
  ownedItemsByType: Map<CosmeticType, CosmeticItem[]>;
  pendingActionIds: string[];
  typeOrder: CosmeticType[];
  username: string;
  usernameStyle?: CSSProperties;
  onEquipItem: (item: CosmeticItem) => void | Promise<void>;
  onUnequipType: (type: CosmeticType) => void | Promise<void>;
};

function getHeaderTypeLabel(type: CosmeticType) {
  if (isProfileFrameCosmeticType(type)) {
    return getProfileFrameCosmeticTypeLabel(type);
  }

  if (type === "profile-border") {
    return "Profile Border";
  }

  if (type === "username-color") {
    return "Username Color";
  }

  if (type === "username-glow") {
    return "Username Glow";
  }

  return type;
}

function renderMiniPreview(item: CosmeticItem | null) {
  if (!item) {
    return <div className="h-9 w-9 rounded-xl border border-dashed border-white/10 bg-black/30" />;
  }

  if (item.type === "profile-border" && item.color) {
    return (
      <div
        aria-hidden="true"
        className="h-9 w-9 rounded-xl border border-white/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
        style={{ backgroundColor: item.color }}
      />
    );
  }

  if (item.type === "username-color" && item.color) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-black/25">
        <div
          aria-hidden="true"
          className="h-4 w-4 rounded-full border border-white/30"
          style={{ backgroundColor: item.color }}
        />
      </div>
    );
  }

  if (item.type === "username-glow" && item.glow) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-black/25">
        <div
          aria-hidden="true"
          className="h-4 w-4 rounded-full bg-white"
          style={{ boxShadow: item.glow.replace(/0 0 \d+px/g, "0 0 7px") }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-black/25 text-[11px] font-black uppercase tracking-[0.18em] text-amber-200/80">
      F
    </div>
  );
}

export function ProfileHeaderCustomizationPanel({
  currentTitle,
  displayName,
  equippedAvatarSlots,
  equippedCosmeticIds,
  hasUncensoredAvatar = false,
  ownedItems,
  ownedItemsByType,
  pendingActionIds,
  typeOrder,
  username,
  usernameStyle,
  onEquipItem,
  onUnequipType,
}: ProfileHeaderCustomizationPanelProps) {
  const [categoryFilter, setCategoryFilter] = useState<CosmeticType | null>(null);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);

  const itemById = useMemo(
    () => new Map(ownedItems.map((item) => [item.id, item])),
    [ownedItems],
  );
  const previewItem = previewItemId ? itemById.get(previewItemId) ?? null : null;
  const previewCosmeticIds = useMemo(
    () => (previewItem ? { ...equippedCosmeticIds, [previewItem.type]: previewItem.id } : equippedCosmeticIds),
    [equippedCosmeticIds, previewItem],
  );
  const previewUsernameStyle = useMemo(() => {
    const nextStyle: CSSProperties = { ...(usernameStyle ?? {}) };
    const usernameColor = getCosmeticItem(previewCosmeticIds["username-color"] ?? "");
    const usernameGlow = getCosmeticItem(previewCosmeticIds["username-glow"] ?? "");

    nextStyle.color = usernameColor?.color;
    nextStyle.textShadow = usernameGlow?.glow;

    return nextStyle;
  }, [previewCosmeticIds, usernameStyle]);
  const previewEquippedItems = useMemo(
    () =>
      typeOrder
        .map((type) => {
          const itemId = previewCosmeticIds[type];
          return itemId ? itemById.get(itemId) ?? getCosmeticItem(itemId) ?? null : null;
        })
        .filter((item): item is CosmeticItem => Boolean(item)),
    [itemById, previewCosmeticIds, typeOrder],
  );
  const visibleTypes = categoryFilter ? [categoryFilter] : typeOrder;
  const hasVisibleItems = visibleTypes.some((type) => (ownedItemsByType.get(type) ?? []).length > 0);
  const previewDisplayName = displayName?.trim() || username;

  return (
    <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-100/70">
            Profile Header Customization
          </p>
          <h3 className="mt-1 text-xl font-black text-white">
            Header cosmetics
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Hover items to preview them, click to equip, and filter by category the same way the avatar
            wardrobe works.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200/15 bg-amber-400/10 px-4 py-3 text-sm text-amber-50/85">
          <p className="font-semibold">Owned header cosmetics: {ownedItems.length}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-amber-100/65">
            Equipped now: {previewEquippedItems.length}
          </p>
        </div>
      </div>

      {ownedItems.length === 0 ? (
        <div className="mt-4 rounded-[1.2rem] border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm leading-6 text-zinc-400">
          You do not own any Profile Header cosmetics yet. Buy limited header items from the Rotating Shop
          to customize borders, ornaments, particles, and username presentation here.
        </div>
      ) : (
        <div className="mt-6 grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="flex min-w-0 flex-col rounded-[1.5rem] border border-white/10 bg-black/35 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-100/70">
                Header Preview
              </p>
              <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-pink-100/70">
                {previewItem ? `Previewing ${previewItem.name}` : "Live equipped header"}
              </span>
            </div>

            <div className="mt-5 flex min-h-0 flex-col gap-5 2xl:flex-row">
              <div className="flex-1 min-w-0">
                <div className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,rgba(11,5,20,0.96),rgba(67,20,60,0.5),rgba(0,0,0,0.82))] p-5 shadow-[0_0_30px_rgba(244,114,182,0.08)]">
                  <div className="grid gap-5 md:grid-cols-[8rem_minmax(0,1fr)] md:items-center">
                    <PrincipessaShowcasePreview
                      className="mx-auto w-[8rem] md:mx-0"
                      equippedAvatarSlots={equippedAvatarSlots}
                      equippedCosmeticIds={equippedCosmeticIds}
                      hasUncensoredAvatar={hasUncensoredAvatar}
                      previewItem={previewItem}
                      previewMode="shop"
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-fuchsia-200/68">
                        Live Header Snapshot
                      </p>
                      <p
                        className="mt-2 truncate text-2xl font-black text-white sm:text-[2rem]"
                        style={previewUsernameStyle}
                        title={previewDisplayName}
                      >
                        {previewDisplayName}
                      </p>
                      {displayName?.trim() ? (
                        <p className="mt-1 truncate text-sm font-black text-pink-100/68">{username}</p>
                      ) : null}
                      <p className="mt-2 truncate text-sm font-black uppercase tracking-[0.18em] text-pink-100/82">
                        {currentTitle ?? "No title equipped"}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-2.5">
                        {previewEquippedItems.length > 0 ? (
                          previewEquippedItems.map((item) => (
                            <span
                              key={`preview-equipped-${item.id}`}
                              className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${
                                previewItem?.id === item.id
                                  ? "border-pink-300/45 bg-pink-500/16 text-pink-50"
                                  : "border-amber-200/18 bg-amber-400/10 text-amber-50/90"
                              }`}
                            >
                              {item.name}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                            No header cosmetic equipped
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full flex-shrink-0 border-t border-white/10 pt-5 2xl:w-[18rem] 2xl:border-l 2xl:border-t-0 2xl:pl-5 2xl:pt-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-100/68">
                    Categories
                  </p>
                  {categoryFilter ? (
                    <button
                      className="text-[10px] font-black uppercase tracking-[0.14em] text-pink-300 hover:underline"
                      onClick={() => setCategoryFilter(null)}
                      type="button"
                    >
                      Show all
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-col gap-3 text-xs">
                  {typeOrder.map((type) => {
                    const activeItemId = previewCosmeticIds[type];
                    const activeItem = activeItemId
                      ? itemById.get(activeItemId) ?? getCosmeticItem(activeItemId) ?? null
                      : null;
                    const isFiltered = categoryFilter === type;
                    const ownedCount = (ownedItemsByType.get(type) ?? []).length;

                    return (
                      <button
                        key={`header-category-${type}`}
                        className={`flex items-center gap-3 rounded-[1rem] border px-3.5 py-3 text-left transition ${
                          isFiltered
                            ? "border-pink-300/45 bg-pink-500/12 ring-1 ring-pink-300/30"
                            : "border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/[0.04]"
                        }`}
                        onClick={() => setCategoryFilter((current) => (current === type ? null : type))}
                        type="button"
                      >
                        {renderMiniPreview(activeItem)}
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/90">
                            {getHeaderTypeLabel(type)}
                          </p>
                          <p className="mt-1 text-[11px] leading-4 text-zinc-400">
                            {activeItem ? activeItem.name : ownedCount > 0 ? "Owned but not equipped" : "No item owned"}
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-black text-zinc-300">
                          {ownedCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-100/70">
                  Owned Header Items
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Hover any card to preview it instantly. Click an equipped card to unequip it.
                </p>
              </div>
              {categoryFilter ? (
                <span className="rounded-full border border-pink-300/25 bg-pink-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-pink-100">
                  {getHeaderTypeLabel(categoryFilter)}
                </span>
              ) : null}
            </div>

            <div className="mt-5 h-[440px] space-y-5 overflow-y-auto pr-2">
              {hasVisibleItems ? (
                visibleTypes.map((type) => {
                  const items = ownedItemsByType.get(type) ?? [];

                  if (items.length === 0) {
                    return null;
                  }

                  const equippedItemId = equippedCosmeticIds[type];

                  return (
                    <div key={`header-group-${type}`}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-100/70">
                          {getHeaderTypeLabel(type)}
                        </p>
                        <span className="text-[10px] text-zinc-500">{items.length} items</span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {items.map((item) => {
                          const isEquipped = equippedItemId === item.id;
                          const isPreviewed = previewItem?.id === item.id;
                          const isPending =
                            pendingActionIds.includes(`cosmetic:${item.id}`) ||
                            pendingActionIds.includes(`cosmetic:unequip:${type}`);
                          const actionLabel = isPending
                            ? "Saving..."
                            : isEquipped
                              ? "Equipped (tap to remove)"
                              : "Tap to equip";

                          return (
                            <button
                              className={`rounded-[1.1rem] border px-4 py-4 text-left transition ${
                                isEquipped
                                  ? "border-amber-200/35 bg-amber-400/10 shadow-[0_0_0_1px_rgba(251,191,36,0.08)]"
                                  : isPreviewed
                                    ? "border-pink-300/35 bg-pink-500/10"
                                    : "border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/[0.04]"
                              }`}
                              disabled={isPending}
                              key={`header-item-${item.id}`}
                              onBlur={() => setPreviewItemId((current) => (current === item.id ? null : current))}
                              onClick={() => {
                                if (isPending) {
                                  return;
                                }

                                if (isEquipped) {
                                  void onUnequipType(type);
                                  return;
                                }

                                void onEquipItem(item);
                              }}
                              onFocus={() => setPreviewItemId(item.id)}
                              onMouseEnter={() => setPreviewItemId(item.id)}
                              onMouseLeave={() => setPreviewItemId((current) => (current === item.id ? null : current))}
                              type="button"
                            >
                              <div className="flex flex-col gap-3">
                                <div className="flex min-w-0 gap-3">
                                  {renderMiniPreview(item)}
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p
                                        className="truncate text-sm font-black text-white"
                                        style={{
                                          color: item.type === "username-color" ? item.color : undefined,
                                          textShadow: item.type === "username-glow" ? item.glow : undefined,
                                        }}
                                      >
                                        {item.name}
                                      </p>
                                      {isEquipped ? (
                                        <span className="rounded-full border border-amber-200/25 bg-amber-400/12 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-50">
                                          Equipped
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">
                                      {item.description}
                                    </p>
                                  </div>
                                </div>
                                <span className="inline-flex w-fit rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
                                  {actionLabel}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-zinc-400">
                  No owned items in this category yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
