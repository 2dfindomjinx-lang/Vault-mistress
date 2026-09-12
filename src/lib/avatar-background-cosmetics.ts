import type { CSSProperties } from "react";

export type AvatarBackgroundCatalogItem = {
  id: string;
  name: string;
  description: string;
  type: "avatar-background";
  price: number;
  image?: string;
  backgroundPath?: string | null;
  backgroundOverlayPath?: string | null;
  backgroundFallback?: string;
  backgroundCanvasWidth?: number;
};

export type AvatarBackgroundItemShape = {
  type?: string;
  backgroundPath?: string | null;
  backgroundOverlayPath?: string | null;
  backgroundFallback?: string;
};

export type AvatarBackgroundPresentation = {
  backgroundPath: string | null;
  backgroundOverlayPath: string | null;
  backgroundStyle?: CSSProperties;
};

function backgroundItem(
  item: Omit<AvatarBackgroundCatalogItem, "type">,
): AvatarBackgroundCatalogItem {
  return {
    ...item,
    type: "avatar-background",
  };
}

export const avatarBackgroundCosmeticItems: AvatarBackgroundCatalogItem[] = [
  backgroundItem({
    id: "avatar-background-none",
    name: "No Background",
    description: "Keeps the frame clean with no backdrop behind Principessa.",
    price: 0,
    backgroundPath: null,
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-bar",
    name: "Bar",
    description: "A polished bar backdrop for a louder late-night profile mood.",
    price: 5000,
    backgroundPath: "/avatar/background/bar.webp",
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-beach",
    name: "Beach",
    description: "A bright beach scene that makes the profile feel lighter and more open.",
    price: 5000,
    backgroundPath: "/avatar/background/v6/beach.webp",
    backgroundCanvasWidth: 1024,
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-bedroom",
    name: "Bedroom",
    description: "A private bedroom backdrop with a softer, more intimate room feel.",
    price: 5000,
    backgroundPath: "/avatar/background/v6/bedroom.webp",
    backgroundCanvasWidth: 1024,
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-cherry-park",
    name: "Cherry Park",
    description: "A cherry-blossom park backdrop with softer outdoor color.",
    price: 5000,
    backgroundPath: "/avatar/background/v6/cherry-park.webp",
    backgroundCanvasWidth: 1024,
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-dressing-room",
    name: "Dressing Room",
    description: "A dressing room backdrop that leans more stylish and performative.",
    price: 5000,
    backgroundPath: "/avatar/background/v7/dressing-room.webp",
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-kitchen",
    name: "Kitchen",
    description: "A domestic kitchen backdrop for a more grounded everyday scene.",
    price: 5000,
    backgroundPath: "/avatar/background/v6/kitchen.webp",
    backgroundCanvasWidth: 1024,
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-living-room",
    name: "Living Room",
    description: "A lounge-style living room backdrop with a calmer home setting.",
    price: 5000,
    backgroundPath: "/avatar/background/v6/living-room.webp",
    backgroundCanvasWidth: 1024,
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-park",
    name: "Park",
    description: "A green park backdrop that keeps the frame feeling airy and open.",
    price: 5000,
    backgroundPath: "/avatar/background/v7/park.webp",
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-rainy-street",
    name: "Rainy Street",
    description: "A rain-soaked street backdrop with colder atmosphere and mood.",
    price: 5000,
    backgroundPath: "/avatar/background/v7/rainy-street.webp",
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-rooftop",
    name: "Rooftop",
    description: "A rooftop backdrop that gives the profile a higher, cleaner city feel.",
    price: 5000,
    backgroundPath: "/avatar/background/rooftop.webp",
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-seaside-sidewalk",
    name: "Seaside Sidewalk",
    description: "A seaside walkway backdrop with brighter coast-side depth.",
    price: 5000,
    backgroundPath: "/avatar/background/v7/seaside-sidewalk.webp",
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-throne-antechamber",
    name: "Throne Antechamber",
    description: "Wine marble and gilded doors at the entrance to her private court.",
    price: 5000,
    backgroundPath: "/avatar/background/v6/throne-antechamber.webp",
    backgroundCanvasWidth: 1024,
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-moonlit-conservatory",
    name: "Moonlit Conservatory",
    description: "Silver moonlight, antique glass and roses in her palace garden.",
    price: 5000,
    backgroundPath: "/avatar/background/v6/moonlit-conservatory.webp",
    backgroundCanvasWidth: 1024,
    backgroundOverlayPath: null,
  }),
];

export function getAvatarBackgroundPresentation(
  item: AvatarBackgroundItemShape | null | undefined,
): AvatarBackgroundPresentation {
  if (!item || item.type !== "avatar-background") {
    return {
      backgroundPath: null,
      backgroundOverlayPath: null,
    };
  }

  return {
    backgroundPath: item.backgroundPath ?? null,
    backgroundOverlayPath: item.backgroundOverlayPath ?? null,
    backgroundStyle: item.backgroundFallback
      ? { background: item.backgroundFallback }
      : undefined,
  };
}

// All wardrobe layers use the same 512 x 1536 coordinate system. Wider art
// extends into the frame gutters without changing the ground under the feet.
export function getAvatarBackgroundCanvasWidth(imagePath: string) {
  return avatarBackgroundCosmeticItems.find((item) => item.backgroundPath === imagePath)?.backgroundCanvasWidth ?? 512;
}
