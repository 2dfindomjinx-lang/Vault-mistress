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
    price: 10000,
    backgroundPath: "/avatar/background/bar.webp",
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-beach",
    name: "Beach",
    description: "A bright beach scene that makes the profile feel lighter and more open.",
    price: 10000,
    backgroundPath: "/avatar/background/beach.webp",
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-bedroom",
    name: "Bedroom",
    description: "A private bedroom backdrop with a softer, more intimate room feel.",
    price: 10000,
    backgroundPath: "/avatar/background/bedroom.webp",
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-cherry-park",
    name: "Cherry Park",
    description: "A cherry-blossom park backdrop with softer outdoor color.",
    price: 10000,
    backgroundPath: "/avatar/background/cherry_park.webp",
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-dressing-room",
    name: "Dressing Room",
    description: "A dressing room backdrop that leans more stylish and performative.",
    price: 10000,
    backgroundPath: "/avatar/background/dressing_room.webp",
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-kitchen",
    name: "Kitchen",
    description: "A domestic kitchen backdrop for a more grounded everyday scene.",
    price: 10000,
    backgroundPath: "/avatar/background/kitchen.webp",
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-living-room",
    name: "Living Room",
    description: "A lounge-style living room backdrop with a calmer home setting.",
    price: 10000,
    backgroundPath: "/avatar/background/living_room.webp",
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-park",
    name: "Park",
    description: "A green park backdrop that keeps the frame feeling airy and open.",
    price: 10000,
    backgroundPath: "/avatar/background/park.webp",
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-rainy-street",
    name: "Rainy Street",
    description: "A rain-soaked street backdrop with colder atmosphere and mood.",
    price: 10000,
    backgroundPath: "/avatar/background/rainy_street.webp",
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-rooftop",
    name: "Rooftop",
    description: "A rooftop backdrop that gives the profile a higher, cleaner city feel.",
    price: 10000,
    backgroundPath: "/avatar/background/rooftop.webp",
    backgroundOverlayPath: null,
  }),
  backgroundItem({
    id: "avatar-background-seaside-sidewalk",
    name: "Seaside Sidewalk",
    description: "A seaside walkway backdrop with brighter coast-side depth.",
    price: 10000,
    backgroundPath: "/avatar/background/seaside_sidewalk.webp",
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
