import type { TitleItem } from "@/lib/cosmetics";

type TitleCollectionProps = {
  equippedTitleId: string | null;
  ownedTitleIds: string[];
  titles: TitleItem[];
  onEquipTitle: (title: TitleItem) => void;
};

export function TitleCollection({
  equippedTitleId,
  ownedTitleIds,
  titles,
  onEquipTitle,
}: TitleCollectionProps) {
  const ownedTitles = titles.filter((title) => ownedTitleIds.includes(title.id));
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
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">
          {lockedCount} locked
        </p>
      )}
    </section>
  );
}
