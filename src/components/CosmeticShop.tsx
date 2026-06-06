import type { CosmeticItem, TitleItem } from "@/lib/cosmetics";
import { CoinAmount } from "@/components/CoinAmount";

type CosmeticShopProps = {
  coins: number;
  equippedCosmeticIds: Partial<Record<CosmeticItem["type"], string>>;
  ownedCosmeticIds: string[];
  ownedTitleIds: string[];
  premiumTitle: TitleItem;
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
  coins,
  disabled = false,
  equippedCosmeticIds,
  eventSpeechAvatarId = null,
  ownedCosmeticIds,
  ownedTitleIds,
  pendingCosmeticIds = [],
  pendingTitleIds = [],
  premiumTitle,
  shopItems,
  onEquipCosmetic,
  onPurchaseCosmetic,
  onPurchaseTitle,
}: CosmeticShopProps) {
  const sortByPrice = (items: CosmeticItem[]) =>
    [...items].sort((a, b) => a.price - b.price);
  const groupedItems = {
    "speech-avatar": sortByPrice(shopItems.filter((item) => item.type === "speech-avatar")),
    "username-color": sortByPrice(shopItems.filter((item) => item.type === "username-color")),
    "username-glow": sortByPrice(shopItems.filter((item) => item.type === "username-glow")),
  };
  const premiumOwned = ownedTitleIds.includes(premiumTitle.id);

  return (
    <section className="rounded-[2rem] border border-fuchsia-200/15 bg-black/50 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-200/70">
            Cosmetic Shop
          </p>
          <h2 className="text-3xl font-black">Spend Without Tribute</h2>
        </div>
        <p className="rounded-full border border-pink-200/20 bg-pink-500/10 px-3 py-1 text-xs font-bold text-pink-100">
          <CoinAmount amount={coins} iconSize={15} label="coins" />
        </p>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        Cosmetic purchases personalize your profile and speech bubble. They never increase Tribute
        Total.
      </p>

      {Object.entries(groupedItems).map(([type, items]) => (
        <div className="mt-6" key={type}>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-pink-200">
            {type === "speech-avatar"
              ? "Speech Bubble Avatars"
              : type === "username-color"
                ? "Username Colors"
                : "Username Glow"}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const eventAvailable =
                item.type === "speech-avatar" &&
                item.id === eventSpeechAvatarId &&
                !ownedCosmeticIds.includes(item.id);
              const owned = item.price === 0 || ownedCosmeticIds.includes(item.id) || eventAvailable;
              const equipped = equippedCosmeticIds[item.type] === item.id;
              const canAfford = coins >= item.price;
              const pending = pendingCosmeticIds.includes(item.id);

              return (
                <article
                  className={`rounded-[1.35rem] border p-4 transition ${
                    equipped
                      ? "border-pink-200/45 bg-pink-500/12 shadow-[0_0_24px_rgba(236,72,153,0.18)]"
                      : owned
                        ? "border-fuchsia-200/20 bg-white/[0.055]"
                        : "border-white/10 bg-white/[0.035]"
                  }`}
                  key={item.id}
                >
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
                    <span
                      className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
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
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-pink-100">
                      {eventAvailable ? (
                        "Event Access"
                      ) : item.price === 0 ? (
                        "Default"
                      ) : (
                        <CoinAmount amount={item.price} iconSize={16} label="coins" />
                      )}
                    </p>
                    <button
                      className="rounded-2xl border border-pink-200/25 bg-pink-500/15 px-4 py-2 text-sm font-black text-pink-50 transition enabled:hover:border-pink-200/55 enabled:hover:bg-pink-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={disabled || pending || equipped || (!owned && !canAfford)}
                      onClick={() => (owned ? onEquipCosmetic(item) : onPurchaseCosmetic(item))}
                      type="button"
                    >
                      {pending
                        ? "Saving..."
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
            })}
          </div>
        </div>
      ))}

      <div className="mt-6 rounded-[1.35rem] border border-yellow-200/25 bg-yellow-300/10 p-4 shadow-[0_0_28px_rgba(250,204,21,0.1)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-100/80">
              Premium Title
            </p>
            <h3 className="mt-1 text-xl font-black text-white">{premiumTitle.name}</h3>
            <p className="mt-1 text-sm text-yellow-50/75">{premiumTitle.description}</p>
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
