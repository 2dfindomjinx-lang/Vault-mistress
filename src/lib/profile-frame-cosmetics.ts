export const PROFILE_FRAME_COSMETIC_TYPES = [
  "profile-frame-bottom",
  "profile-frame-side",
  "profile-frame-corner",
  "profile-frame-top",
  "profile-frame-overlay",
  "profile-frame-particles",
] as const;

export type ProfileFrameCosmeticType = (typeof PROFILE_FRAME_COSMETIC_TYPES)[number];

export type ProfileFrameDecorationMotif =
  | "festoon-medallion"
  | "jeweled-locket"
  | "cathedral-tassel"
  | "opera-rose-swag"
  | "corner-filigree"
  | "corner-claws"
  | "corner-rosette"
  | "corner-gems"
  | "top-tiara"
  | "top-medallion"
  | "top-halo"
  | "top-aigrette"
  | "overlay-bead-veil"
  | "overlay-chain-curtain"
  | "overlay-crystal-facet"
  | "overlay-stage-canopy"
  | "side-tassels"
  | "side-cat-pair"
  | "side-dog-pair"
  | "side-bunny-pair"
  | "side-fox-pair"
  | "side-bear-pair"
  | "particles-hearts"
  | "particles-petals"
  | "particles-dust"
  | "particles-embers";

export type FrameAttachmentAnchor =
  | "top-center"
  | "bottom-center"
  | "left-center"
  | "right-center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type ProfileFrameAttachment = {
  anchor: FrameAttachmentAnchor;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  rotation?: number;
  zIndex?: number;
};

export type ProfileFrameDecorationDefinition = {
  id: string;
  name: string;
  description: string;
  type: ProfileFrameCosmeticType;
  price: number;
  motif: ProfileFrameDecorationMotif;
  palette: [string, string, string?];
  metal?: string;
  shadow?: string;
  attachment?: ProfileFrameAttachment;
};

export type ProfileFrameCatalogItem = Pick<
  ProfileFrameDecorationDefinition,
  "description" | "id" | "name" | "price" | "type"
>;

const FRAME_ANCHOR_POSITIONS: Record<FrameAttachmentAnchor, { x: number; y: number }> = {
  "top-center": { x: 90, y: 2 },
  "bottom-center": { x: 90, y: 268 },
  "left-center": { x: 22, y: 142 },
  "right-center": { x: 158, y: 142 },
  "top-left": { x: 22, y: 6 },
  "top-right": { x: 158, y: 6 },
  "bottom-left": { x: 22, y: 268 },
  "bottom-right": { x: 158, y: 268 },
};

function getDefaultZIndex(type: ProfileFrameCosmeticType): number {
  switch (type) {
    case "profile-frame-particles": return 17;
    case "profile-frame-overlay": return 16;
    case "profile-frame-side": return 19;
    case "profile-frame-corner": return 20;
    case "profile-frame-top": return 20;
    case "profile-frame-bottom": return 21;
    default: return 18;
  }
}

export function resolveFrameAttachment(def: ProfileFrameDecorationDefinition) {
  const att = def.attachment || ({} as Partial<ProfileFrameAttachment>);
  const anchorKey = att.anchor || (def.type.includes("-top") ? "top-center" : def.type.includes("-bottom") ? "bottom-center" : "bottom-center");
  const basePos = FRAME_ANCHOR_POSITIONS[anchorKey as FrameAttachmentAnchor] || { x: 90, y: 140 };

  return {
    x: basePos.x + (att.offsetX ?? 0),
    y: basePos.y + (att.offsetY ?? 0),
    scale: att.scale ?? 1,
    rotation: att.rotation ?? 0,
    zIndex: att.zIndex ?? getDefaultZIndex(def.type),
  };
}

const definition = (
  item: ProfileFrameDecorationDefinition,
): ProfileFrameDecorationDefinition => item;

export const profileFrameDecorationDefinitions: ProfileFrameDecorationDefinition[] = [
  definition({
    id: "frame-bottom-satin-noir",
    name: "Satin Noir Medallion",
    description: "Dark enamel swags and chain drops turn the lower frame into a collector-piece clasp.",
    type: "profile-frame-bottom",
    price: 5000,
    motif: "festoon-medallion",
    palette: ["#26112f", "#f472b6", "#fbcfe8"],
    metal: "#facc15",
    shadow: "#ec4899",
  }),
  definition({
    id: "frame-bottom-sugar-heart",
    name: "Sugar Heart Festoon",
    description: "Pastel chain swags and a glossy heart centerpiece make the frame feel gift-box expensive.",
    type: "profile-frame-bottom",
    price: 5000,
    motif: "festoon-medallion",
    palette: ["#fb7185", "#f9a8d4", "#fff1f2"],
    metal: "#fde68a",
    shadow: "#fb7185",
  }),
  definition({
    id: "frame-bottom-heart-lock",
    name: "Heart Lock Reliquary",
    description: "An ornate lockplate with polished wings and a suspended heart jewel for possessive luxury.",
    type: "profile-frame-bottom",
    price: 5000,
    motif: "jeweled-locket",
    palette: ["#6b2149", "#f472b6", "#ffe4e6"],
    metal: "#facc15",
    shadow: "#be185d",
  }),
  definition({
    id: "frame-bottom-moon-bell",
    name: "Moonlit Tassel Reliquary",
    description: "Layered silk fans and a moon-bright drop crystal give the bottom edge a ceremonial finish.",
    type: "profile-frame-bottom",
    price: 5000,
    motif: "cathedral-tassel",
    palette: ["#312e81", "#a78bfa", "#e0e7ff"],
    metal: "#cbd5e1",
    shadow: "#7c3aed",
  }),
  definition({
    id: "frame-bottom-royal-seal",
    name: "Royal House Seal",
    description: "A formal medallion seal framed by velvet swags and pearl-set chainwork.",
    type: "profile-frame-bottom",
    price: 5000,
    motif: "festoon-medallion",
    palette: ["#7f1d1d", "#ef4444", "#fee2e2"],
    metal: "#fcd34d",
    shadow: "#991b1b",
  }),
  definition({
    id: "frame-bottom-obsidian-crest",
    name: "Obsidian Crest Reliquary",
    description: "A black-lacquer lockplate with a cold crest insert and heavier metallic depth.",
    type: "profile-frame-bottom",
    price: 5000,
    motif: "jeweled-locket",
    palette: ["#111827", "#374151", "#f9a8d4"],
    metal: "#facc15",
    shadow: "#111827",
  }),
  definition({
    id: "frame-bottom-aurora-clasp",
    name: "Aurora Cathedral Tassel",
    description: "A luminous cathedral fan with split tassels and a cold glass centerpiece.",
    type: "profile-frame-bottom",
    price: 5000,
    motif: "cathedral-tassel",
    palette: ["#14b8a6", "#67e8f9", "#ecfeff"],
    metal: "#f8fafc",
    shadow: "#0f766e",
  }),
  definition({
    id: "frame-bottom-rose-bouquet",
    name: "Rose Opera Swag",
    description: "Sculpted roses, leafwork, and gem chains create a softer but still premium lower flourish.",
    type: "profile-frame-bottom",
    price: 5000,
    motif: "opera-rose-swag",
    palette: ["#f43f5e", "#fda4af", "#fef2f2"],
    metal: "#4ade80",
    shadow: "#be123c",
  }),
  definition({
    id: "frame-corner-sugarpink",
    name: "Sugarpink Rosette Guards",
    description: "Glossy rosettes and petal-metal leaves make the frame corners feel boutique rather than basic.",
    type: "profile-frame-corner",
    price: 5000,
    motif: "corner-rosette",
    palette: ["#fb7185", "#f9a8d4", "#fff1f2"],
    metal: "#fde68a",
    shadow: "#fb7185",
  }),
  definition({
    id: "frame-corner-noir-gold",
    name: "Noir Gold Claw Guards",
    description: "Angular metal claws and lacquer inserts grip the corners like jewelry settings.",
    type: "profile-frame-corner",
    price: 5000,
    motif: "corner-claws",
    palette: ["#1f2937", "#111827", "#facc15"],
    metal: "#facc15",
    shadow: "#111827",
  }),
  definition({
    id: "frame-corner-mint-lace",
    name: "Mint Filigree Corners",
    description: "Mint metal scrollwork lifts the corners with airy premium detail instead of a plain ribbon silhouette.",
    type: "profile-frame-corner",
    price: 5000,
    motif: "corner-filigree",
    palette: ["#5eead4", "#99f6e4", "#ecfeff"],
    metal: "#f8fafc",
    shadow: "#14b8a6",
  }),
  definition({
    id: "frame-corner-wine-velvet",
    name: "Wine Velvet Gem Corners",
    description: "Velvet-backed gem clusters sit in the corners like tailored couture settings.",
    type: "profile-frame-corner",
    price: 5000,
    motif: "corner-gems",
    palette: ["#7f1d1d", "#be123c", "#ffe4e6"],
    metal: "#fda4af",
    shadow: "#881337",
  }),
  definition({
    id: "frame-top-gilded-crown",
    name: "Gilded Tiara Arc",
    description: "A raised tiara arc with taller jewel points makes the top edge read instantly premium.",
    type: "profile-frame-top",
    price: 5000,
    motif: "top-tiara",
    palette: ["#d97706", "#facc15", "#fef3c7"],
    metal: "#fde68a",
    shadow: "#b45309",
    attachment: { anchor: "top-center", offsetY: 0, scale: 1 },
  }),
  definition({
    id: "frame-top-roseglass-crown",
    name: "Roseglass Tiara Arc",
    description: "Rose-pink stones and a wider jeweled sweep give the frame a softer luxury silhouette.",
    type: "profile-frame-top",
    price: 5000,
    motif: "top-tiara",
    palette: ["#f472b6", "#fbcfe8", "#fff1f2"],
    metal: "#fdf2f8",
    shadow: "#ec4899",
  }),
  definition({
    id: "frame-top-night-crest",
    name: "Night Halo Emblem",
    description: "A dark ceremonial emblem with halo spikes and a colder center stone.",
    type: "profile-frame-top",
    price: 5000,
    motif: "top-halo",
    palette: ["#0f172a", "#475569", "#cbd5e1"],
    metal: "#cbd5e1",
    shadow: "#0f172a",
  }),
  definition({
    id: "frame-top-pearl-heart-pin",
    name: "Pearl Heart Medallion",
    description: "A pearl-trimmed heart medallion keeps the sweetness while still feeling collectible.",
    type: "profile-frame-top",
    price: 5000,
    motif: "top-medallion",
    palette: ["#f9a8d4", "#fde2e8", "#fff1f2"],
    metal: "#f8fafc",
    shadow: "#f472b6",
  }),
  definition({
    id: "frame-side-noir-tassels",
    name: "Noir Tassel Pair",
    description: "Long side tassels with darker cords and brighter tips.",
    type: "profile-frame-side",
    price: 5000,
    motif: "side-tassels",
    palette: ["#111827", "#374151", "#f9a8d4"],
    metal: "#facc15",
    shadow: "#111827",
  }),
  definition({
    id: "frame-side-rosegold-tassels",
    name: "Rosegold Tassel Pair",
    description: "Beaded tassels with lighter satin cords and a warm metallic tip.",
    type: "profile-frame-side",
    price: 5000,
    motif: "side-tassels",
    palette: ["#f472b6", "#fdba74", "#fff7ed"],
    metal: "#fdba74",
    shadow: "#ea580c",
  }),
  definition({
    id: "frame-side-sleepy-cats",
    name: "Sleepy Cat Pair",
    description: "Two peeking cats holding the lower frame corners like plush guards.",
    type: "profile-frame-side",
    price: 5000,
    motif: "side-cat-pair",
    palette: ["#f472b6", "#fbcfe8", "#fff1f2"],
    metal: "#fcd34d",
    shadow: "#db2777",
  }),
  definition({
    id: "frame-side-guardian-pups",
    name: "Guardian Pup Pair",
    description: "A softer puppy pair for a friendlier lower-frame silhouette.",
    type: "profile-frame-side",
    price: 5000,
    motif: "side-dog-pair",
    palette: ["#f59e0b", "#fde68a", "#fff7ed"],
    metal: "#fef3c7",
    shadow: "#d97706",
  }),
  definition({
    id: "frame-side-cupid-bunnies",
    name: "Cupid Bunny Pair",
    description: "Two upright bunnies peeking in with tall ears and tiny hearts.",
    type: "profile-frame-side",
    price: 5000,
    motif: "side-bunny-pair",
    palette: ["#f9a8d4", "#fde2e8", "#fff1f2"],
    metal: "#fda4af",
    shadow: "#ec4899",
  }),
  definition({
    id: "frame-side-velvet-foxes",
    name: "Velvet Fox Pair",
    description: "Sharper fox faces that make the frame feel a bit more cunning.",
    type: "profile-frame-side",
    price: 5000,
    motif: "side-fox-pair",
    palette: ["#fb7185", "#fdba74", "#fff7ed"],
    metal: "#fef3c7",
    shadow: "#c2410c",
  }),
  definition({
    id: "frame-side-plush-bears",
    name: "Plush Bear Pair",
    description: "Rounder bear faces for a toy-shelf kind of sweetness.",
    type: "profile-frame-side",
    price: 5000,
    motif: "side-bear-pair",
    palette: ["#a16207", "#d6b38d", "#fef3c7"],
    metal: "#fde68a",
    shadow: "#854d0e",
  }),
  definition({
    id: "frame-overlay-pearl-lace",
    name: "Pearl Bead Veil",
    description: "A falling veil of pearl chains makes the whole frame feel more dressed and expensive.",
    type: "profile-frame-overlay",
    price: 5000,
    motif: "overlay-bead-veil",
    palette: ["#f8fafc", "#fde2e8", "#fff1f2"],
    metal: "#e2e8f0",
    shadow: "#fbcfe8",
    attachment: { anchor: "top-center", offsetY: 4, scale: 1 },
  }),
  definition({
    id: "frame-overlay-noir-lace",
    name: "Noir Chain Curtain",
    description: "Dark chain loops and jewel catches add dramatic stage-dressing without hiding the avatar.",
    type: "profile-frame-overlay",
    price: 5000,
    motif: "overlay-chain-curtain",
    palette: ["#111827", "#374151", "#f9a8d4"],
    metal: "#cbd5e1",
    shadow: "#111827",
    attachment: { anchor: "top-center", offsetY: 5, scale: 1 },
  }),
  definition({
    id: "frame-overlay-royal-drape",
    name: "Royal Stage Canopy",
    description: "A layered canopy with jewel tassels turns the frame into a little ceremonial stage.",
    type: "profile-frame-overlay",
    price: 5000,
    motif: "overlay-stage-canopy",
    palette: ["#7c3aed", "#312e81", "#fbcfe8"],
    metal: "#facc15",
    shadow: "#4c1d95",
    attachment: { anchor: "top-center", offsetY: 3, scale: 1 },
  }),
  definition({
    id: "frame-overlay-candy-drape",
    name: "Candy Crystal Veil",
    description: "Faceted glass panels and candy-colored highlights make the overlay look like a premium filter, not trim.",
    type: "profile-frame-overlay",
    price: 5000,
    motif: "overlay-crystal-facet",
    palette: ["#fb7185", "#f472b6", "#fff1f2"],
    metal: "#fde68a",
    shadow: "#e11d48",
    attachment: { anchor: "top-center", offsetY: 1, scale: 1 },
  }),
  definition({
    id: "frame-particles-soft-hearts",
    name: "Soft Heart Particles",
    description: "Small floating hearts that sit comfortably around the frame edges.",
    type: "profile-frame-particles",
    price: 5000,
    motif: "particles-hearts",
    palette: ["#f472b6", "#f9a8d4", "#fff1f2"],
    metal: "#fde68a",
    shadow: "#ec4899",
  }),
  definition({
    id: "frame-particles-rose-petals",
    name: "Rose Petal Drift",
    description: "Tiny rose petals drifting lightly inside the showcase area.",
    type: "profile-frame-particles",
    price: 5000,
    motif: "particles-petals",
    palette: ["#fb7185", "#f43f5e", "#ffe4e6"],
    metal: "#fda4af",
    shadow: "#be123c",
  }),
  definition({
    id: "frame-particles-gilded-dust",
    name: "Gilded Dust",
    description: "Warm gold dust and sparkles for a richer premium finish.",
    type: "profile-frame-particles",
    price: 5000,
    motif: "particles-dust",
    palette: ["#f59e0b", "#facc15", "#fef3c7"],
    metal: "#fef3c7",
    shadow: "#d97706",
  }),
  definition({
    id: "frame-particles-embers",
    name: "Velvet Embers",
    description: "Hot drifting embers for darker or more dramatic frame looks.",
    type: "profile-frame-particles",
    price: 5000,
    motif: "particles-embers",
    palette: ["#ef4444", "#fb7185", "#fff7ed"],
    metal: "#fdba74",
    shadow: "#b91c1c",
  }),
  definition({
    id: "frame-bottom-frosted-opera",
    name: "Frosted Opera Festoon",
    description: "An icy enamel medallion with silver chains brings opera-house polish to colder palettes.",
    type: "profile-frame-bottom",
    price: 5000,
    motif: "festoon-medallion",
    palette: ["#dbeafe", "#a5b4fc", "#ffffff"],
    metal: "#e2e8f0",
    shadow: "#818cf8",
  }),
  definition({
    id: "frame-bottom-prism-cabaret",
    name: "Prism Cabaret Tassel",
    description: "A three-tone cathedral tassel with prism metalwork gives the frame a louder premium finish.",
    type: "profile-frame-bottom",
    price: 5000,
    motif: "cathedral-tassel",
    palette: ["#fb7185", "#8b5cf6", "#fde68a"],
    metal: "#fde68a",
    shadow: "#c026d3",
  }),
  definition({
    id: "frame-bottom-cherry-locket",
    name: "Cherry Locket Reliquary",
    description: "Wine lacquer, pearl trim, and a suspended heart locket turn the bottom edge into jewelry.",
    type: "profile-frame-bottom",
    price: 5000,
    motif: "jeweled-locket",
    palette: ["#9f1239", "#fb7185", "#fff1f2"],
    metal: "#f8fafc",
    shadow: "#be123c",
  }),
  definition({
    id: "frame-bottom-starlit-bell",
    name: "Starlit Cathedral Tassel",
    description: "Midnight silk fans and pale star-metal drops give the showcase a colder cathedral finish.",
    type: "profile-frame-bottom",
    price: 5000,
    motif: "cathedral-tassel",
    palette: ["#1e1b4b", "#818cf8", "#e0f2fe"],
    metal: "#cbd5e1",
    shadow: "#4338ca",
  }),
  definition({
    id: "frame-bottom-ivory-seal",
    name: "Ivory House Medallion",
    description: "Champagne enamel, cream swags, and a polished seal read soft but unmistakably premium.",
    type: "profile-frame-bottom",
    price: 5000,
    motif: "festoon-medallion",
    palette: ["#fef3c7", "#fcd34d", "#fff7ed"],
    metal: "#f8fafc",
    shadow: "#d97706",
  }),
  definition({
    id: "frame-bottom-midnight-crest",
    name: "Midnight Crest Reliquary",
    description: "A navy-black lockplate with cold silver crestwork sharpens the whole showcase silhouette.",
    type: "profile-frame-bottom",
    price: 5000,
    motif: "jeweled-locket",
    palette: ["#0f172a", "#1e3a8a", "#dbeafe"],
    metal: "#e2e8f0",
    shadow: "#0f172a",
  }),
  definition({
    id: "frame-bottom-prism-clasp",
    name: "Prism Festoon Clasp",
    description: "Teal, orchid, and pearl meet in a glassy festoon centerpiece with hanging chain accents.",
    type: "profile-frame-bottom",
    price: 5000,
    motif: "festoon-medallion",
    palette: ["#2dd4bf", "#c084fc", "#f8fafc"],
    metal: "#f8fafc",
    shadow: "#7c3aed",
  }),
  definition({
    id: "frame-bottom-lavender-bouquet",
    name: "Lavender Rose Swag",
    description: "Lilac roses, blush chainwork, and leaf-metal details give the frame a softer couture finish.",
    type: "profile-frame-bottom",
    price: 5000,
    motif: "opera-rose-swag",
    palette: ["#a78bfa", "#f9a8d4", "#fff7ed"],
    metal: "#86efac",
    shadow: "#8b5cf6",
  }),
  definition({
    id: "frame-corner-pearl-sky",
    name: "Pearl Sky Filigree",
    description: "Airy pearl-metal scrollwork lifts the corners without falling back to ribbon shapes again.",
    type: "profile-frame-corner",
    price: 5000,
    motif: "corner-filigree",
    palette: ["#93c5fd", "#dbeafe", "#ffffff"],
    metal: "#f8fafc",
    shadow: "#60a5fa",
  }),
  definition({
    id: "frame-corner-sunset-ribbon",
    name: "Sunset Gem Corners",
    description: "Coral and amber stones mounted in corner settings add a louder collectible sparkle.",
    type: "profile-frame-corner",
    price: 5000,
    motif: "corner-gems",
    palette: ["#fb7185", "#fdba74", "#fef3c7"],
    metal: "#fde68a",
    shadow: "#ea580c",
  }),
  definition({
    id: "frame-corner-lilac-frost",
    name: "Lilac Frost Rosettes",
    description: "Layered frosted rosettes give the corners a boutique floral silhouette with better presence.",
    type: "profile-frame-corner",
    price: 5000,
    motif: "corner-rosette",
    palette: ["#8b5cf6", "#c4b5fd", "#eef2ff"],
    metal: "#e2e8f0",
    shadow: "#7c3aed",
  }),
  definition({
    id: "frame-corner-emerald-noir",
    name: "Emerald Noir Claws",
    description: "Dark metal claw guards cut into the corners with emerald-lit accents and sharper prestige.",
    type: "profile-frame-corner",
    price: 5000,
    motif: "corner-claws",
    palette: ["#111827", "#10b981", "#d1fae5"],
    metal: "#a7f3d0",
    shadow: "#065f46",
  }),
  definition({
    id: "frame-top-sapphire-crown",
    name: "Sapphire Aigrette",
    description: "A sapphire plume pin adds height and shape variety instead of another crown recolor.",
    type: "profile-frame-top",
    price: 5000,
    motif: "top-aigrette",
    palette: ["#1d4ed8", "#60a5fa", "#dbeafe"],
    metal: "#e0f2fe",
    shadow: "#1e3a8a",
  }),
  definition({
    id: "frame-top-sunset-tiara",
    name: "Sunset Tiara Arc",
    description: "Peach, rose, and gold stones sweep wider across the top for a more couture tiara read.",
    type: "profile-frame-top",
    price: 5000,
    motif: "top-tiara",
    palette: ["#fb7185", "#fdba74", "#fef3c7"],
    metal: "#fde68a",
    shadow: "#ea580c",
  }),
  definition({
    id: "frame-top-ruby-crest",
    name: "Ruby Halo Emblem",
    description: "A ruby-centered sunburst emblem gives the frame top a stronger ceremonial identity.",
    type: "profile-frame-top",
    price: 5000,
    motif: "top-halo",
    palette: ["#991b1b", "#ef4444", "#fee2e2"],
    metal: "#fca5a5",
    shadow: "#7f1d1d",
  }),
  definition({
    id: "frame-top-mint-heart-pin",
    name: "Mint Heart Medallion",
    description: "Mint glass and pearl trim now sit in a proper medallion mount instead of a tiny basic pin.",
    type: "profile-frame-top",
    price: 5000,
    motif: "top-medallion",
    palette: ["#2dd4bf", "#99f6e4", "#ecfeff"],
    metal: "#f8fafc",
    shadow: "#0f766e",
  }),
  definition({
    id: "frame-side-ivory-tassels",
    name: "Ivory Tassel Pair",
    description: "Long cream tassels with pearl cords for a cleaner romantic look.",
    type: "profile-frame-side",
    price: 5000,
    motif: "side-tassels",
    palette: ["#fff7ed", "#fde68a", "#ffffff"],
    metal: "#f8fafc",
    shadow: "#d6d3d1",
  }),
  definition({
    id: "frame-side-twilight-tassels",
    name: "Twilight Tassel Pair",
    description: "A purple-blue tassel mix that feels colder and more luxurious.",
    type: "profile-frame-side",
    price: 5000,
    motif: "side-tassels",
    palette: ["#312e81", "#8b5cf6", "#e0e7ff"],
    metal: "#cbd5e1",
    shadow: "#4338ca",
  }),
  definition({
    id: "frame-side-moon-cats",
    name: "Moon Cat Pair",
    description: "Peeking cats recolored in moonstone blues and silver instead of pink.",
    type: "profile-frame-side",
    price: 5000,
    motif: "side-cat-pair",
    palette: ["#93c5fd", "#e0f2fe", "#ffffff"],
    metal: "#e2e8f0",
    shadow: "#60a5fa",
  }),
  definition({
    id: "frame-side-cinnamon-pups",
    name: "Cinnamon Pup Pair",
    description: "Warmer puppy guards with caramel fur and soft cream details.",
    type: "profile-frame-side",
    price: 5000,
    motif: "side-dog-pair",
    palette: ["#c2410c", "#fdba74", "#fff7ed"],
    metal: "#fde68a",
    shadow: "#9a3412",
  }),
  definition({
    id: "frame-side-snow-bunnies",
    name: "Snow Bunny Pair",
    description: "A frosted bunny version with icy whites and pale lavender accents.",
    type: "profile-frame-side",
    price: 5000,
    motif: "side-bunny-pair",
    palette: ["#e5e7eb", "#c4b5fd", "#ffffff"],
    metal: "#f8fafc",
    shadow: "#a78bfa",
  }),
  definition({
    id: "frame-side-ember-foxes",
    name: "Ember Fox Pair",
    description: "Fox guards recolored with ember orange, gold, and a hotter dramatic finish.",
    type: "profile-frame-side",
    price: 5000,
    motif: "side-fox-pair",
    palette: ["#ea580c", "#fb923c", "#ffedd5"],
    metal: "#fde68a",
    shadow: "#c2410c",
  }),
  definition({
    id: "frame-side-honey-bears",
    name: "Honey Bear Pair",
    description: "Bear guards in honey, caramel, and cream for a richer toy-box palette.",
    type: "profile-frame-side",
    price: 5000,
    motif: "side-bear-pair",
    palette: ["#a16207", "#f59e0b", "#fef3c7"],
    metal: "#fde68a",
    shadow: "#854d0e",
  }),
  definition({
    id: "frame-overlay-silver-lace",
    name: "Silver Prism Veil",
    description: "Icy faceted panels and pearl-silver lines make the overlay feel engineered, not decorative filler.",
    type: "profile-frame-overlay",
    price: 5000,
    motif: "overlay-crystal-facet",
    palette: ["#e2e8f0", "#bae6fd", "#ffffff"],
    metal: "#f8fafc",
    shadow: "#94a3b8",
    attachment: { anchor: "top-center", offsetY: 1, scale: 1 },
  }),
  definition({
    id: "frame-overlay-rose-noir-lace",
    name: "Rose Noir Chain Curtain",
    description: "Rose-threaded chain loops and darker catches make the overlay feel heavier and more deliberate.",
    type: "profile-frame-overlay",
    price: 5000,
    motif: "overlay-chain-curtain",
    palette: ["#111827", "#f472b6", "#fff1f2"],
    metal: "#f9a8d4",
    shadow: "#be185d",
    attachment: { anchor: "top-center", offsetY: 5, scale: 1 },
  }),
  definition({
    id: "frame-overlay-sapphire-drape",
    name: "Sapphire Stage Canopy",
    description: "A cobalt-sapphire canopy with pearl catches gives the profile frame a colder premium staging.",
    type: "profile-frame-overlay",
    price: 5000,
    motif: "overlay-stage-canopy",
    palette: ["#2563eb", "#1d4ed8", "#dbeafe"],
    metal: "#e0f2fe",
    shadow: "#1e3a8a",
    attachment: { anchor: "top-center", offsetY: 3, scale: 1 },
  }),
  definition({
    id: "frame-overlay-aurora-drape",
    name: "Aurora Bead Veil",
    description: "Mint, lilac, and pearl strands turn the overlay into a hanging jewel veil instead of a recolored drape.",
    type: "profile-frame-overlay",
    price: 5000,
    motif: "overlay-bead-veil",
    palette: ["#2dd4bf", "#a78bfa", "#f8fafc"],
    metal: "#f8fafc",
    shadow: "#7c3aed",
    attachment: { anchor: "top-center", offsetY: 4, scale: 1 },
  }),
  definition({
    id: "frame-particles-candy-hearts",
    name: "Candy Heart Sprinkle",
    description: "Brighter candy hearts in pink, coral, and cream drifting around the frame.",
    type: "profile-frame-particles",
    price: 5000,
    motif: "particles-hearts",
    palette: ["#fb7185", "#f472b6", "#fff7ed"],
    metal: "#fde68a",
    shadow: "#e11d48",
  }),
  definition({
    id: "frame-particles-sakura-petals",
    name: "Sakura Petal Drift",
    description: "A softer petal variant leaning blossom-pink instead of deep rose.",
    type: "profile-frame-particles",
    price: 5000,
    motif: "particles-petals",
    palette: ["#f9a8d4", "#fbcfe8", "#fff1f2"],
    metal: "#f8fafc",
    shadow: "#ec4899",
  }),
  definition({
    id: "frame-particles-prism-dust",
    name: "Prism Dust",
    description: "Sparkle dust with blue, lilac, and pale gold mixed together.",
    type: "profile-frame-particles",
    price: 5000,
    motif: "particles-dust",
    palette: ["#60a5fa", "#a78bfa", "#fde68a"],
    metal: "#f8fafc",
    shadow: "#7c3aed",
  }),
  definition({
    id: "frame-particles-amethyst-embers",
    name: "Amethyst Embers",
    description: "Dark floating embers recolored into magenta-violet heat.",
    type: "profile-frame-particles",
    price: 5000,
    motif: "particles-embers",
    palette: ["#c026d3", "#8b5cf6", "#fdf4ff"],
    metal: "#f9a8d4",
    shadow: "#86198f",
  }),
];

export const rotatingProfileFrameCosmeticItems: ProfileFrameCatalogItem[] =
  profileFrameDecorationDefinitions.map(
    ({ description, id, name, price, type }) => ({
      description,
      id,
      name,
      price,
      type,
    }),
  );

const definitionMap = new Map(
  profileFrameDecorationDefinitions.map((item) => [item.id, item]),
);

export function getProfileFrameDecorationDefinition(id: string) {
  return definitionMap.get(id) ?? null;
}

export function isProfileFrameCosmeticType(
  value: string | null | undefined,
): value is ProfileFrameCosmeticType {
  return PROFILE_FRAME_COSMETIC_TYPES.includes(
    value as ProfileFrameCosmeticType,
  );
}

export function getProfileFrameCosmeticTypeLabel(type: ProfileFrameCosmeticType) {
  switch (type) {
    case "profile-frame-bottom":
      return "Bottom Ornament";
    case "profile-frame-side":
      return "Side Ornament";
    case "profile-frame-corner":
      return "Corner Ornament";
    case "profile-frame-top":
      return "Top Pin";
    case "profile-frame-overlay":
      return "Frame Overlay";
    case "profile-frame-particles":
      return "Particles";
    default:
      return "Frame Cosmetic";
  }
}
