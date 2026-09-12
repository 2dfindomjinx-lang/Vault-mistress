"use client";

import { LayeredAvatar } from "@/components/LayeredAvatar";
import type { EquippedAvatarSlots } from "@/lib/avatar-slots";
import { worldCupFarewellBorders } from "@/lib/cosmetics";
import { getCosmeticPurchasePrice, getWorldCupFarewell } from "@/lib/world-cup-farewell";
import styles from "./CollectionSurfaces.module.css";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CoinAmount } from "@/components/CoinAmount";
import { ProfileBorderFrame } from "@/components/ProfileBorderFrame";
import type { CosmeticItem, TitleItem } from "@/lib/cosmetics";
import { getProfileBorderFramePresentation } from "@/lib/profile-border-presentation";

function formatCountdown(targetIso: string) {
  const remainingMs = Math.max(0, new Date(targetIso).getTime() - Date.now());
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m`;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function ShopCountdown({ target }: { target: string }) {
  const [, tick] = useState(0);
  useEffect(() => { const interval = window.setInterval(() => tick((value) => value + 1), 1000); return () => window.clearInterval(interval); }, [target]);
  return <>{formatCountdown(target)}</>;
}

type CosmeticShopProps = {
  equippedAvatarSlots?: EquippedAvatarSlots;
  equippedFullSetId?: string | null;
  hasUncensoredAvatar?: boolean;
  coins: number;
  equippedCosmeticIds: Partial<Record<CosmeticItem["type"], string>>;
  ownedCosmeticIds: string[];
  ownedTitleIds: string[];
  premiumTitle: TitleItem;
  premiumTitleExpiresAt?: string | null;
  shopItems: CosmeticItem[];
  disabled?: boolean;
  eventSpeechAvatarId?: string | null;
  pendingCosmeticIds?: string[];
  pendingTitleIds?: string[];
  onEquipCosmetic: (item: CosmeticItem) => void;
  onPurchaseCosmetic: (item: CosmeticItem) => void;
  onPurchaseTitle: (title: TitleItem) => void;
};

export function CosmeticShop({
  equippedAvatarSlots = {},
  equippedFullSetId = null,
  hasUncensoredAvatar = false,
  coins,
  disabled = false,
  equippedCosmeticIds,
  eventSpeechAvatarId = null,
  ownedCosmeticIds,
  ownedTitleIds,
  pendingCosmeticIds = [],
  pendingTitleIds = [],
  premiumTitle,
  premiumTitleExpiresAt = null,
  shopItems,
  onEquipCosmetic,
  onPurchaseCosmetic,
  onPurchaseTitle,
}: CosmeticShopProps) {
  const [farewell, setFarewell] = useState(() => getWorldCupFarewell());
  useEffect(() => {
    const interval = window.setInterval(() => setFarewell(getWorldCupFarewell()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  const sortByPrice = (items: CosmeticItem[]) =>
    [...items].sort((a, b) => a.price - b.price);
  const groupedItems = [
    {
      label: "Speech Bubble Avatars",
      type: "speech-avatar" as const,
      items: sortByPrice(shopItems.filter((item) => item.type === "speech-avatar")),
    },
    {
      label: "Avatar Backgrounds",
      type: "avatar-background" as const,
      items: sortByPrice(shopItems.filter((item) => item.type === "avatar-background")),
    },
    {
      label: "Profile Header Borders",
      type: "profile-border" as const,
      items: sortByPrice(shopItems.filter((item) => item.type === "profile-border")),
    },
  ].filter((group) => group.items.length > 0);
  const usernameColorItems = sortByPrice(shopItems.filter((item) => item.type === "username-color"));
  const usernameGlowItems = sortByPrice(shopItems.filter((item) => item.type === "username-glow"));
  const displayNameChangeItem = shopItems.find((item) => item.id === "display-name-change");
  const premiumOwned = ownedTitleIds.includes(premiumTitle.id);

  const renderPreview = (item: CosmeticItem) => {
    if (item.type === "profile-border") {
      const presentation = getProfileBorderFramePresentation(item);

      return (
        <div className={styles.cosmeticPreview}>
          <div className="mx-auto w-[6.4rem]">
            <ProfileBorderFrame
              className="aspect-[180/288] rounded-[1.35rem]"
              contentClassName="overflow-hidden rounded-[calc(1.35rem-3px)] bg-[linear-gradient(180deg,rgba(20,8,28,0.96),rgba(9,4,16,0.98))]"
              presentation={presentation}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_18%,rgba(255,255,255,0.05)_78%,rgba(0,0,0,0.2)_100%)]" />
              <div className="absolute inset-x-[22%] top-[14%] h-[18%] rounded-full bg-[radial-gradient(circle,rgba(255,214,230,0.9),rgba(255,152,194,0.42)_58%,transparent_72%)] blur-[2px]" />
              <div className="absolute inset-x-[28%] top-[30%] h-[42%] rounded-[999px] bg-[linear-gradient(180deg,rgba(255,182,212,0.24),rgba(255,255,255,0.05),rgba(244,114,182,0.18))]" />
              <div className="absolute inset-x-[30%] bottom-[12%] h-[14%] rounded-[999px] bg-[linear-gradient(180deg,rgba(244,114,182,0.22),rgba(255,255,255,0.05))]" />
            </ProfileBorderFrame>
          </div>
        </div>
      );
    }

    if (item.type === "avatar-background") {
      return (
        <div className={styles.backgroundDollPreview}>
          <LayeredAvatar alt={item.name + " with your avatar"} equipped={equippedAvatarSlots} equippedFullSetId={equippedFullSetId} hasUncensored={hasUncensoredAvatar} backgroundPath={item.backgroundPath} backgroundOverlayPath={item.backgroundOverlayPath} backgroundStyle={item.backgroundFallback ? { background: item.backgroundFallback } : undefined} />
        </div>
      );
    }

    if (item.image) {
      return (
        <div
          className={`${styles.cosmeticPreview} ${styles.avatarSwatch} ${
            item.type === "speech-avatar" ? "rounded-full" : "rounded-2xl"
          }`}
        >
          <Image
            alt={item.name}
            className={`h-11 w-11 object-contain ${
              item.type === "speech-avatar" ? "rounded-full" : "rounded-2xl"
            }`}
            height={116}
            src={item.image}
            width={116}
          />
        </div>
      );
    }

    return null;
  };

  const renderCosmeticCards = (items: CosmeticItem[]) =>
    items.map((item) => {
      const eventAvailable =
        item.type === "speech-avatar" &&
        item.id === eventSpeechAvatarId &&
        !ownedCosmeticIds.includes(item.id);
      const owned = item.price === 0 || ownedCosmeticIds.includes(item.id) || eventAvailable;
      const equipped = equippedCosmeticIds[item.type] === item.id;
      const purchasePrice = getCosmeticPurchasePrice(item);
      const discounted = purchasePrice < item.price;
      const canAfford = coins >= purchasePrice;
      const pending = pendingCosmeticIds.includes(item.id);

      const isDisplayNameChange = item.id === "display-name-change";
      const displayChangeOwned = isDisplayNameChange && owned;

      return (
        <article
          className={`${styles.product} ${styles.cosmeticCard} ${
            equipped
              ? "border-pink-200/45 bg-pink-500/12 shadow-[0_0_24px_rgba(236,72,153,0.18)]"
              : owned
                ? "border-fuchsia-200/20 bg-white/[0.055]"
                : "border-white/10 bg-white/[0.035]"
          }`}
          key={item.id}
          data-equipped={equipped}
        >
          {renderPreview(item)}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className="truncate text-base font-black text-white"
                style={{
                  color: item.type === "username-color" ? item.color : undefined,
                  textShadow: item.type === "username-glow" ? item.glow : undefined,
                }}
              >
                {item.name}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">{item.description}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span
                className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                  equipped
                    ? "border-pink-200/35 bg-pink-500/15 text-pink-50"
                    : owned
                      ? "border-emerald-200/25 bg-emerald-400/10 text-emerald-100"
                      : "border-white/10 bg-black/35 text-zinc-400"
                }`}
              >
                {equipped ? "Equipped" : eventAvailable ? "Event" : owned ? "Owned" : "Locked"}
              </span>
            </div>
          </div>
          <div className={styles.productActions}>
            {item.price > 0 && !owned && (
              <div className={styles.salePrice}>
                {discounted && <span className={styles.originalPrice}><span className="sr-only">Original price: </span><s>{item.price.toLocaleString()}</s><span className={styles.discountBadge}>−50%</span></span>}
                <CoinAmount amount={purchasePrice} iconSize={16} label="" />
              </div>
            )}
            <button
              className="min-w-[8.5rem] rounded-2xl border border-pink-200/25 bg-pink-500/15 px-4 py-2 text-sm font-black text-pink-50 transition enabled:hover:border-pink-200/55 enabled:hover:bg-pink-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={disabled || pending || equipped || (isDisplayNameChange ? displayChangeOwned : (!owned && !canAfford))}
              onClick={() => {
                if (isDisplayNameChange && owned) return;
                if (owned && !isDisplayNameChange) {
                  onEquipCosmetic(item);
                } else {
                  onPurchaseCosmetic(item);
                }
              }}
              type="button"
            >
              {pending
                ? "Saving..."
                : isDisplayNameChange
                  ? (owned ? "Owned" : canAfford ? "Purchase" : "Need Coins")
                  : equipped
                  ? "Equipped"
                  : owned
                    ? "Equip"
                    : canAfford
                      ? "Purchase"
                      : "Need Coins"}
            </button>
          </div>
        </article>
      );
    });

  return (
    <section className={`${styles.surface} ${styles.wardrobe}`} data-collection-surface="wardrobe">
      <div className={styles.header}>
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-200/70">
            The dressing room
          </p>
          <h2 className="text-3xl font-black">Dress for her attention.</h2>
        </div>
        <p className={styles.balance}>
          <CoinAmount amount={coins} iconSize={15} label="coins" />
        </p>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        Make her mark your signature. Cosmetics count toward coin spending, not Tribute Total.
      </p>

      {farewell.active && farewell.endsAt && (
        <section className={styles.farewell} aria-label="World Cup farewell collection">
          <div className={styles.farewellHeading}><div><span>Last call · World Cup</span><h3>One final appearance.</h3><p>All {worldCupFarewellBorders.length} club and national-team borders. Half price for seven days. Yours to keep.</p></div><span className={styles.farewellTime}><ShopCountdown target={farewell.endsAt} /></span></div>
          <div className={styles.farewellGrid}>{renderCosmeticCards(worldCupFarewellBorders)}</div>
        </section>
      )}
      {groupedItems.map((group) => (
        <div className="mt-6" key={group.type}>
          <p className={styles.sectionLabel}>
            {group.label}
          </p>
        <div className="court-grid court-grid--collection mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {renderCosmeticCards(group.items)}
          </div>
        </div>
      ))}

      {/* Profile Identity category with sub items: colors, glows, and minimal display name */}
      <div className="mt-6">
        <p className={styles.sectionLabel}>Profile Identity</p>

        {usernameColorItems.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-pink-200/70">Username Colors</p>
        <div className="court-grid court-grid--collection mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {renderCosmeticCards(usernameColorItems)}
            </div>
          </div>
        )}

        {usernameGlowItems.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-pink-200/70">Username Glow</p>
        <div className="court-grid court-grid--collection mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {renderCosmeticCards(usernameGlowItems)}
            </div>
          </div>
        )}

        {displayNameChangeItem && (
          <div className="mt-3">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-pink-200/70">Display Name Change</p>
        <div className="court-grid court-grid--collection mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {renderCosmeticCards([displayNameChangeItem])}
            </div>
          </div>
        )}
      </div>

      <div className={styles.premium}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-100/80">
              Premium Title
            </p>
            <h3 className="mt-1 text-xl font-black text-white">{premiumTitle.name}</h3>
            <p className="mt-1 text-sm text-yellow-50/75">{premiumTitle.description}</p>
            {premiumTitleExpiresAt && (
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-yellow-200/70">
                New title in <ShopCountdown target={premiumTitleExpiresAt} />
              </p>
            )}
          </div>
          <button
            className="rounded-2xl border border-yellow-100/30 bg-yellow-400/15 px-4 py-3 text-sm font-black text-yellow-50 transition enabled:hover:border-yellow-100/60 enabled:hover:bg-yellow-400/25 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={disabled || pendingTitleIds.includes(premiumTitle.id) || premiumOwned || coins < (premiumTitle.price ?? 0)}
            onClick={() => onPurchaseTitle(premiumTitle)}
            type="button"
          >
            {pendingTitleIds.includes(premiumTitle.id)
              ? "Saving..."
              : premiumOwned
              ? "Owned"
              : coins >= (premiumTitle.price ?? 0)
                ? (
                  <CoinAmount amount={premiumTitle.price ?? 0} iconSize={16} label="" prefix="Buy " />
                )
                : (
                  <CoinAmount amount={premiumTitle.price ?? 0} iconSize={16} label="" prefix="Need " />
                )}
          </button>
        </div>
      </div>
    </section>
  );
}
