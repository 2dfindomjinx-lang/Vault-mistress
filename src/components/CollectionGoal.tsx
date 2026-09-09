"use client";
import { useCourtStorage } from "@/hooks/use-court-storage";
import type { GalleryItem, PetGalleryItem } from "@/lib/types";
export function CollectionGoal({
  items,
  petItems,
  coins,
  mood,
  petScore,
  userKey,
  petUnlockedItemIds = [],
}: {
  items: GalleryItem[];
  petItems: PetGalleryItem[];
  coins: number;
  mood: number;
  petScore: number;
  userKey: string;
  petUnlockedItemIds?: string[];
}) {
  const [goal, setGoal] = useCourtStorage("court-collection-goal:" + userKey);
  const options = [
    ...items
      .filter((i) => !i.unlocked)
      .map((i) => ({
        id: i.id,
        title: i.title,
        need:
          i.unlockCost !== undefined
            ? Math.max(0, i.unlockCost - coins) + " more Coin"
            : i.moodRequired !== undefined
              ? Math.max(0, i.moodRequired - mood) + " more Affection"
              : "Unlock through " + i.rarity,
        where:
          i.unlockCost !== undefined
            ? "Earn Coin in Games."
            : i.moodRequired !== undefined
              ? "Raise Affection with Coin tribute."
              : "Visit Tribute to see the unlock rules.",
      })),
    ...petItems
      .filter(
        (i) => petScore < i.unlockCost && !petUnlockedItemIds.includes(i.id),
      )
      .map((i) => ({
        id: i.id,
        title: i.title,
        need: Math.max(0, i.unlockCost - petScore) + " more Pet Score",
        where: "Complete Pet tasks to increase your score.",
      })),
  ];
  const selected = options.find((o) => o.id === goal);
  const achieved =
    goal &&
    !selected &&
    (items.some((i) => i.id === goal && i.unlocked) ||
      petItems.some(
        (i) =>
          i.id === goal &&
          (petScore >= i.unlockCost || petUnlockedItemIds.includes(i.id)),
      ));
  return (
    <div className="court-panel my-4">
      <label
        className="text-sm font-semibold text-amber-100"
        htmlFor="collection-goal"
      >
        Your next collectible
      </label>
      <select
        id="collection-goal"
        value={selected ? goal : ""}
        onChange={(e) => setGoal(e.target.value)}
        className="mt-2 block w-full rounded-lg border border-white/20 bg-[#160b12] p-3 text-sm text-zinc-100"
      >
        <option value="">Choose a collection goal</option>
        {options.map((o) => (
          <option value={o.id} key={o.id}>
            {o.title}
          </option>
        ))}
      </select>
      {selected ? (
        <p className="mt-3 text-sm text-zinc-300">
          <strong className="text-amber-100">{selected.need}</strong> ·{" "}
          {selected.where}
        </p>
      ) : achieved ? (
        <p role="status" className="mt-3 text-sm text-emerald-200">
          Goal reached. Choose your next collectible.
        </p>
      ) : (
        <p className="mt-3 text-xs text-zinc-400">
          Saved on this browser for your account.
        </p>
      )}
    </div>
  );
}
