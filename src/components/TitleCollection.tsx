import type { TitleItem } from "@/lib/cosmetics";

type TitleCollectionProps = {
  equippedTitleId: string | null;
  ownedTitleIds: string[];
  titles: TitleItem[];
  onEquipTitle: (title: TitleItem) => void;
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

  return "Unlock through progression, shop purchases, Throne tribute, or admin rewards.";
}

export function TitleCollection({
  equippedTitleId,
  ownedTitleIds,
  titles,
  onEquipTitle,
}: TitleCollectionProps) {
  const ownedTitles = titles.filter((title) => ownedTitleIds.includes(title.id));
  const lockedTitles = titles.filter((title) => !ownedTitleIds.includes(title.id));
  const lockedCount = Math.max(0, titles.length - ownedTitles.length);
  const equippedTitle =
    titles.find((title) => title.id === equippedTitleId) ?? ownedTitles[0] ?? null;

  const handleSelect = (titleId: string) => {
    const nextTitle = ownedTitles.find((title) => title.id === titleId);

    if (!nextTitle || nextTitle.id === equippedTitleId) {
      return;
    }

    onEquipTitle(nextTitle);
  };

  return (
    <section className="relative overflow-visible rounded-[1.35rem] border border-fuchsia-200/15 bg-[linear-gradient(150deg,rgba(0,0,0,0.62),rgba(88,28,135,0.16))] p-4 shadow-[0_0_24px_rgba(168,85,247,0.08)]">
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

      <select
        className="mt-3 w-full rounded-2xl border border-pink-200/20 bg-black/55 px-3 py-2 text-sm font-bold text-pink-50 outline-none transition focus:border-pink-200/55"
        disabled={ownedTitles.length === 0}
        onChange={(event) => handleSelect(event.target.value)}
        value={equippedTitle?.id ?? ""}
      >
        {ownedTitles.map((title) => (
          <option key={title.id} value={title.id}>
            {title.name}
          </option>
        ))}
      </select>

      <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-400">
        {equippedTitle?.description ?? "Unlock titles through progression, shop purchases, and admin rewards."}
      </p>
      {lockedCount > 0 && (
        <details className="group relative mt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 transition hover:border-pink-200/25 hover:text-pink-100">
            <span>{lockedCount} locked titles</span>
            <span className="text-zinc-600 transition group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/70 p-2 pr-1 shadow-[0_18px_40px_rgba(0,0,0,0.45)] xl:absolute xl:left-full xl:top-0 xl:z-30 xl:ml-3 xl:mt-0 xl:w-80 xl:max-h-72">
            {lockedTitles.map((title) => (
              <div
                key={title.id}
                className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-xs font-black text-zinc-200">{title.name}</p>
                  <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500">
                    {title.source}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-bold leading-4 text-pink-100/75">
                  {describeTitleUnlock(title)}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-zinc-500">
                  {title.description}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
