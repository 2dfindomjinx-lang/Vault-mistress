export type GalleryRarity = "Common" | "Rare" | "Divine" | "Secret";

export type GalleryTag = "Maid" | "Office" | "Goth" | "Tease" | "Luxury";

export type GalleryItem = {
  id: string;
  title: string;
  rarity: GalleryRarity;
  unlockCost?: number;
  moodRequired?: number;
  tag: GalleryTag;
  image: string;
  unlocked: boolean;
};

export type TaskItem = {
  id: string;
  title: string;
  reward: number;
  completed: boolean;
  claimed: boolean;
};
