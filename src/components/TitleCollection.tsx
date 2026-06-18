import type { TitleItem } from "@/lib/cosmetics";
import { rebrandProfile } from "@/lib/rebrand-profile";

type TitleCollectionProps = {
  equippedTitleId: string | null;
  ownedTitleIds: string[];
  titles: TitleItem[];
  disabled?: boolean;
  layout?: "vertical" | "horizontal";
  onEquipTitle: (title: TitleItem) => void;
};

type ProfileTaskCardProps = {
  disabled?: boolean;
  isPending?: boolean;
  onRebrandProfile: () => void;
};

function formatCoins(value: number) {
  return value.toLocaleString();
}

function describeTitleUnlock(title: TitleItem) {
  if (title.source === "progression" && typeof title.minTribute === "number") {
    return `Reach ${formatCoins(title.minTribute)} Tribute Total.`;
  }

  if (title.source === "throne" && typeof title.minThroneCoins === "number") {
    return `Receive ${formatCoins(title.minThroneCoins)} manual Throne tribute coins.`;
  }

  if (title.source === "shop" && typeof title.price === "number") {
    return `Buy in Cosmetics Shop for ${formatCoins(title.price)} coins.`;
  }

  if (title.source === "admin") {
    return "Manual admin-granted title.";
  }

  if (title.source === "crate" && typeof title.minCrateLegendaries === "number") {
    return `Pull ${title.minCrateLegendaries} Legendary item${title.minCrateLegendaries === 1 ? "" : "s"} from a crate.`;
  }

  if (title.source === "inventory" && typeof title.minInventoryValue === "number") {
    return `Reach ${formatCoins(title.minInventoryValue)} in total crate inventory value.`;
  }

  return "Unlock through progression, shop purchases, Throne tribute, crates, inventory milestones, or admin rewards.";
}

export function TitleCollection({
  equippedTitleId,
  disabled = false,
  layout = "vertical",
  ownedTitleIds,
  titles,
  onEquipTitle,
}: TitleCollectionProps) {
  const ownedTitles = titles.filter((title) => ownedTitleIds.includes(title.id));
  const equippedTitle =
    titles.find((title) => title.id === equippedTitleId) ?? ownedTitles[0] ?? null;

  // Sort: owned first, then non-owned. Within each group, preserve original order (general sorting rule from titleItems).
  const displayTitles = [...titles].sort((a, b) => {
    const aOwned = ownedTitleIds.includes(a.id);
    const bOwned = ownedTitleIds.includes(b.id);
    if (aOwned !== bOwned) {
      return aOwned ? -1 : 1;
    }
    return titles.indexOf(a) - titles.indexOf(b);
  });

  const handleSelect = (title: TitleItem, isOwned: boolean) => {
    if (!isOwned) {
      return;
    }

    onEquipTitle(title);
  };

  const isHorizontal = layout === "horizontal";

  return (
    <section className="rounded-[1.35rem] border border-fuchsia-200/15 bg-[linear-gradient(150deg,rgba(0,0,0,0.62),rgba(88,28,135,0.16))] p-4 shadow-[0_0_24px_rgba(168,85,247,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-200/70">
            Title
          </p>
          <p className="mt-1 truncate text-base font-black text-white">
            {equippedTitle?.name ?? "No title equipped"}
          </p>
        </div>
        <p className="shrink-0 rounded-full border border-pink-200/20 bg-pink-500/10 px-2 py-1 text-[10px] font-black text-pink-100">
          {ownedTitles.length}/{titles.length}
        </p>
      </div>

      <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-400">
        {equippedTitle?.description ??
          "Unlock titles through progression, shop purchases, Throne tribute, crates, inventory value milestones, and admin rewards."}
      </p>

      <div
        className={`mt-3 pr-1 ${
          isHorizontal
            ? "w-full flex flex-nowrap gap-3 overflow-x-auto overflow-y-hidden pb-3 touch-pan-x scroll-smooth snap-x snap-mandatory scrollbar-thin scrollbar-thumb-pink-400/40 scrollbar-track-transparent"
            : "max-h-64 space-y-2 overflow-y-auto"
        }`}
      >
        {displayTitles.map((title) => {
          const isOwned = ownedTitleIds.includes(title.id);
          const isEquipped = title.id === equippedTitle?.id;

          return (
            <button
              className={`${isHorizontal ? "min-h-[10rem] min-w-[17rem] max-w-[17rem] shrink-0 snap-start" : "w-full"} rounded-2xl border px-3 py-2 text-left transition ${
                disabled
                  ? "cursor-not-allowed border-white/5 bg-black/25 opacity-60"
                  : isOwned
                  ? isEquipped
                    ? "border-pink-200/45 bg-pink-500/15"
                    : "border-white/10 bg-white/[0.035] hover:border-pink-200/30 hover:bg-pink-500/10"
                  : "cursor-not-allowed border-white/5 bg-black/25 opacity-60"
              }`}
              disabled={disabled || !isOwned}
              key={title.id}
              onClick={() => handleSelect(title, isOwned)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <p
                  className={`min-w-0 text-sm font-black ${
                    isOwned ? "text-white" : "text-zinc-500"
                  }`}
                >
                  {title.name}
                </p>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${
                    isOwned
                      ? "border-pink-200/20 text-pink-100"
                      : "border-white/10 text-zinc-600"
                  }`}
                >
                  {isOwned ? (isEquipped ? "equipped" : title.source) : "locked"}
                </span>
              </div>
              <p
                className={`mt-1 ${isHorizontal ? "line-clamp-4 min-h-[4rem]" : ""} text-[11px] leading-4 ${
                  isOwned ? "text-zinc-400" : "text-zinc-600"
                }`}
              >
                {isOwned ? title.description : describeTitleUnlock(title)}
              </p>
              {!isOwned && (
                <p className="mt-1 line-clamp-1 text-[10px] leading-4 text-zinc-700">
                  {title.description}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ProfileTaskCard({
  disabled = false,
  isPending = false,
  onRebrandProfile,
}: ProfileTaskCardProps) {
  return (
    <section className="flex min-h-[18rem] flex-col justify-between rounded-[1.35rem] border border-pink-200/20 bg-[linear-gradient(150deg,rgba(236,72,153,0.14),rgba(0,0,0,0.42))] p-4 shadow-[0_0_24px_rgba(236,72,153,0.08)]">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-200/70">
          Profile Task
        </p>
        <h3 className="mt-1 text-base font-black text-white">
          Rebrand for Principessa
        </h3>
        <div className="mt-3 overflow-hidden rounded-2xl border border-pink-200/15 bg-black/35">
          <div
            className="h-16 bg-cover bg-center"
            style={{ backgroundImage: `url(${rebrandProfile.bannerPath})` }}
          />
          <div className="flex items-center gap-3 px-3 pb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              className="-mt-6 h-12 w-12 shrink-0 rounded-full border-2 border-black bg-black object-cover"
              src={rebrandProfile.avatarPath}
            />
            <div className="min-w-0 pt-2">
              <p className="truncate text-xs font-black text-white">
                {rebrandProfile.displayName}
              </p>
              <p className="truncate text-[10px] font-bold text-pink-100/65">
                {rebrandProfile.location}
              </p>
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs leading-5 text-zinc-400">
          Authorize X and apply the configured profile rebrand. No coin reward, no cooldown.
        </p>
      </div>
        <button
          className="mt-4 rounded-2xl border border-pink-200/25 bg-pink-500/15 px-3 py-2 text-xs font-black text-pink-50 transition enabled:hover:border-pink-200/55 enabled:hover:bg-pink-500/25 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={disabled || isPending}
        onClick={onRebrandProfile}
        type="button"
      >
        {isPending ? "Opening X..." : "Rebrand Profile"}
      </button>
    </section>
  );
}
