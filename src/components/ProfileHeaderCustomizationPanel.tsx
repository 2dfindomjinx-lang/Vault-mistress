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
  equippedFullSetId?: string | null;
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

  if (type === "profile-border") return "Profile Border";
  if (type === "username-color") return "Username Color";
  if (type === "username-glow") return "Username Glow";

  return type;
}

function renderMiniPreview(item: CosmeticItem | null, compact = false) {
  const sizeClass = compact ? "h-8 w-8 rounded-xl" : "h-10 w-10 rounded-2xl";

  if (!item) {
    return <div className={`${sizeClass} border border-dashed border-white/10 bg-black/35`} />;
  }

  if (item.type === "profile-border" && item.color) {
    return (
      <div
        aria-hidden="true"
        className={`${sizeClass} border border-white/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]`}
        style={{ backgroundColor: item.color }}
      />
    );
  }

  if (item.type === "username-color" && item.color) {
    return (
      <div className={`${sizeClass} flex items-center justify-center border border-white/15 bg-black/35`}>
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
      <div className={`${sizeClass} flex items-center justify-center border border-white/15 bg-black/35`}>
        <div
          aria-hidden="true"
          className="h-4 w-4 rounded-full bg-white"
          style={{ boxShadow: item.glow.replace(/0 0 \d+px/g, "0 0 7px") }}
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClass} flex items-center justify-center border border-white/15 bg-black/35 text-[10px] font-black uppercase tracking-[0.16em] text-amber-200/90`}>
      F
    </div>
  );
}

export function ProfileHeaderCustomizationPanel({
  currentTitle,
  displayName,
  equippedAvatarSlots,
  equippedFullSetId = null,
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

  const itemById = useMemo(() => new Map(ownedItems.map((item) => [item.id, item])), [ownedItems]);
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
    <div className="court-feature-card court-grid-card court-grid-card--violet mt-5 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(150deg,rgba(10,5,15,0.92),rgba(35,10,32,0.45),rgba(0,0,0,0.92))] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-pink-100/60">
              Profile Header Customization
            </p>
            <h3 className="mt-1 text-lg font-black text-white">Header cosmetics</h3>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 lg:max-w-[62%]">
            <button
              className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                categoryFilter === null
                  ? "border-pink-200/40 bg-pink-500/16 text-pink-50"
                  : "border-white/10 bg-black/25 text-zinc-300 hover:border-white/25"
              }`}
              onClick={() => setCategoryFilter(null)}
              type="button"
            >
              All {ownedItems.length}
            </button>
            {typeOrder.map((type) => {
              const count = (ownedItemsByType.get(type) ?? []).length;
              const isActive = categoryFilter === type;

              return (
                <button
                  className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                    isActive
                      ? "border-pink-200/40 bg-pink-500/16 text-pink-50"
                      : "border-white/10 bg-black/25 text-zinc-300 hover:border-white/25"
                  }`}
                  key={`header-filter-${type}`}
                  onClick={() => setCategoryFilter((current) => (current === type ? null : type))}
                  type="button"
                >
                  {getHeaderTypeLabel(type)} {count}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {ownedItems.length === 0 ? (
        <div className="m-5 rounded-[1.2rem] border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm leading-6 text-zinc-400">
          You do not own any Profile Header cosmetics yet. Buy limited header items from the Rotating Shop
          to customize borders, ornaments, particles, and username presentation here.
        </div>
      ) : (
        <div className="grid gap-0 xl:grid-cols-[23rem_minmax(0,1fr)]">
          <aside className="border-b border-white/10 p-4 sm:p-5 xl:border-b-0 xl:border-r">
          <div className="court-feature-inset rounded-[1.35rem] border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-pink-100/62">
                  Preview
                </p>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-300">
                  {previewItem ? "Hover preview" : "Equipped"}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-[7.25rem_minmax(0,1fr)] items-center gap-4">
                <PrincipessaShowcasePreview
                  className="w-[7.25rem]"
                  equippedAvatarSlots={equippedAvatarSlots}
                  equippedFullSetId={equippedFullSetId}
                  equippedCosmeticIds={equippedCosmeticIds}
                  hasUncensoredAvatar={hasUncensoredAvatar}
                  previewItem={previewItem}
                  previewMode="shop"
                />
                <div className="min-w-0">
                  <p
                    className="truncate text-2xl font-black text-white"
                    style={previewUsernameStyle}
                    title={previewDisplayName}
                  >
                    {previewDisplayName}
                  </p>
                  {displayName?.trim() ? (
                    <p className="mt-1 truncate text-xs font-black text-pink-100/62">{username}</p>
                  ) : null}
                  <p className="mt-2 line-clamp-2 text-xs font-black uppercase tracking-[0.16em] text-pink-100/78">
                    {currentTitle ?? "No title equipped"}
                  </p>
                </div>
              </div>
            </div>

          <div className="court-feature-inset mt-4 rounded-[1.35rem] border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                  Equipped loadout
                </p>
                <span className="text-[10px] font-black text-zinc-500">{previewEquippedItems.length}</span>
              </div>
              <div className="mt-3 grid gap-2">
                {typeOrder.map((type) => {
                  const itemId = previewCosmeticIds[type];
                  const item = itemId ? itemById.get(itemId) ?? getCosmeticItem(itemId) ?? null : null;
                  const count = (ownedItemsByType.get(type) ?? []).length;

                  return (
                    <button
                      className={`flex items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition ${
                        categoryFilter === type
                          ? "border-pink-200/35 bg-pink-500/12"
                          : "border-white/10 bg-black/20 hover:border-white/25"
                      }`}
                      key={`header-summary-${type}`}
                      onClick={() => setCategoryFilter((current) => (current === type ? null : type))}
                      type="button"
                    >
                      {renderMiniPreview(item, true)}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-black uppercase tracking-[0.1em] text-white/85">
                          {getHeaderTypeLabel(type)}
                        </p>
                        <p className="truncate text-[11px] text-zinc-500">
                          {item ? item.name : count > 0 ? "Owned, not equipped" : "None owned"}
                        </p>
                      </div>
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-black text-zinc-300">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="min-w-0 p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-pink-100/62">
                  Owned items
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Hover to preview, click to equip. Equipped cards can be clicked again to remove.
                </p>
              </div>
              {categoryFilter ? (
                <button
                  className="w-fit rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300 hover:border-white/25"
                  onClick={() => setCategoryFilter(null)}
                  type="button"
                >
                  Clear filter
                </button>
              ) : null}
            </div>

            {hasVisibleItems ? (
              <div className="space-y-4">
                {visibleTypes.map((type) => {
                  const items = ownedItemsByType.get(type) ?? [];
                  if (items.length === 0) return null;

                  const equippedItemId = equippedCosmeticIds[type];

                  return (
                    <div key={`header-group-${type}`} className="rounded-[1.25rem] border border-white/10 bg-black/18 p-3">
                      {!categoryFilter ? (
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-100/68">
                            {getHeaderTypeLabel(type)}
                          </p>
                          <span className="text-[10px] text-zinc-500">{items.length} items</span>
                        </div>
                      ) : null}

                      <div className="court-grid court-grid--collection grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                        {items.map((item) => {
                          const isEquipped = equippedItemId === item.id;
                          const isPreviewed = previewItem?.id === item.id;
                          const isPending =
                            pendingActionIds.includes(`cosmetic:${item.id}`) ||
                            pendingActionIds.includes(`cosmetic:unequip:${type}`);

                          return (
                            <button
                              className={`court-grid-card court-grid-card--violet group flex min-h-[5.5rem] items-start gap-3 rounded-2xl border p-3 text-left transition ${
                                isEquipped
                                  ? "border-amber-200/35 bg-[linear-gradient(135deg,rgba(251,191,36,0.14),rgba(80,35,10,0.2))]"
                                  : isPreviewed
                                    ? "border-pink-200/35 bg-pink-500/10"
                                    : "border-white/10 bg-black/24 hover:border-white/25 hover:bg-white/[0.045]"
                              } ${isPending ? "opacity-60" : ""}`}
                              disabled={isPending}
                              key={`header-item-${item.id}`}
                              onBlur={() => setPreviewItemId((current) => (current === item.id ? null : current))}
                              onClick={() => {
                                if (isPending) return;
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
                              {renderMiniPreview(item)}
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center gap-2">
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
                                    <span className="shrink-0 rounded-full border border-amber-200/25 bg-amber-400/14 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-50">
                                      On
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                                  {item.description}
                                </p>
                                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.13em] text-zinc-400 group-hover:text-pink-100">
                                  {isPending ? "Saving..." : isEquipped ? "Click to remove" : "Click to equip"}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-zinc-400">
                No owned items in this category yet.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
