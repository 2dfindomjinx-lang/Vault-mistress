import { CoinAmount } from "@/components/CoinAmount";
import type { CosmeticItem } from "@/lib/cosmetics";

type RotatingShopProps = {
  coins: number;
  disabled?: boolean;
  endsAt: string;
  equippedCosmeticIds: Partial<Record<CosmeticItem["type"], string>>;
  items: CosmeticItem[];
  ownedCosmeticIds: string[];
  pendingCosmeticIds?: string[];
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
    return `${days}d ${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m`;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function RotatingShop({
  coins,
  disabled = false,
  endsAt,
  equippedCosmeticIds,
  items,
  ownedCosmeticIds,
  pendingCosmeticIds = [],
  onEquipCosmetic,
  onPurchaseCosmetic,
}: RotatingShopProps) {
  return (
    <section className="rounded-[2rem] border border-amber-200/18 bg-[linear-gradient(145deg,rgba(22,10,2,0.92),rgba(120,53,15,0.52),rgba(0,0,0,0.68))] p-5 shadow-[0_0_46px_rgba(251,191,36,0.12)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-amber-200/74">Rotating Shop</p>
          <h2 className="mt-2 text-3xl font-black text-white">Limited Vault Selection</h2>
        </div>
        <div className="rounded-[1.25rem] border border-amber-200/20 bg-black/30 px-4 py-3 text-sm text-amber-50/80">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-100/70">Next refresh</p>
          <p className="mt-1 text-lg font-black text-white">{formatCountdown(endsAt)}</p>
        </div>
      </div>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-50/72">
        These cosmetics are separate from the permanent shop and rotate automatically. Event items
        can appear here without removing any of the core permanent cosmetics.
      </p>

      {items.length === 0 ? (
        <div className="mt-5 rounded-[1.55rem] border border-white/10 bg-black/28 p-5 text-sm leading-6 text-amber-50/78">
          Rotating shop is temporarily empty. Placeholder items are hidden for now so nobody wastes coins.
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {items.map((item) => {
          const owned = ownedCosmeticIds.includes(item.id);
          const equipped = equippedCosmeticIds[item.type] === item.id;
          const pending = pendingCosmeticIds.includes(item.id);
          const canAfford = coins >= item.price;

          return (
            <article
              className={`rounded-[1.55rem] border p-4 transition ${
                equipped
                  ? "border-amber-200/50 bg-amber-400/12 shadow-[0_0_26px_rgba(251,191,36,0.14)]"
                  : owned
                    ? "border-emerald-200/22 bg-white/[0.05]"
                    : "border-white/10 bg-black/28"
              }`}
              key={item.id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p
                    className="text-lg font-black text-white"
                    style={{
                      color: item.type === "username-color" ? item.color : undefined,
                      textShadow: item.type === "username-glow" ? item.glow : undefined,
                    }}
                  >
                    {item.name}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-amber-50/70">{item.description}</p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                    equipped
                      ? "border-amber-200/35 bg-amber-400/15 text-amber-50"
                      : owned
                        ? "border-emerald-200/25 bg-emerald-400/12 text-emerald-50"
                        : "border-white/12 bg-black/35 text-zinc-300"
                  }`}
                >
                  {equipped ? "Equipped" : owned ? "Owned" : "Limited"}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <CoinAmount amount={item.price} iconSize={16} label="" />
                <button
                  className="rounded-2xl border border-amber-200/28 bg-amber-400/15 px-4 py-2 text-sm font-black text-amber-50 transition enabled:hover:border-amber-200/55 enabled:hover:bg-amber-400/22 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={disabled || pending || equipped || (!owned && !canAfford)}
                  onClick={() => (owned ? onEquipCosmetic(item) : onPurchaseCosmetic(item))}
                  type="button"
                >
                  {pending ? "Saving..." : equipped ? "Equipped" : owned ? "Equip" : canAfford ? "Purchase" : "Need Coins"}
                </button>
              </div>
            </article>
          );
        })}
        </div>
      ) : null}
    </section>
  );
}
