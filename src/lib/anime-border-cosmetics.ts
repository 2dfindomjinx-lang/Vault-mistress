// Anime / Manga collection. Keep these IDs stable after launch.
export type AnimeBorderMotion = "drift" | "pulse" | "sweep" | "ember" | "float" | "slash" | "charge";
export type AnimeBorderLayout = "diagonal" | "opposed" | "crown";
export type AnimeBorderDefinition = {
  slug: string;
  name: string;
  series: string;
  description: string;
  palette: [string, string, string];
  edge: string;
  layout: AnimeBorderLayout;
  motion: AnimeBorderMotion;
};

export const animeBorderDefinitions: AnimeBorderDefinition[] = [
  {
    "slug": "akatsuki",
    "name": "Akatsuki",
    "series": "Naruto",
    "description": "Crimson clouds across black lacquer, with a slow storm glow.",
    "palette": [
      "#d92b4d",
      "#130f1b",
      "#fff0ed"
    ],
    "edge": "cloud",
    "layout": "diagonal",
    "motion": "drift"
  },
  {
    "slug": "sharingan",
    "name": "Sharingan",
    "series": "Naruto",
    "description": "Three-tomoe eyes set into a fractured crimson frame.",
    "palette": [
      "#e72c45",
      "#130d18",
      "#ffc7bb"
    ],
    "edge": "shard",
    "layout": "opposed",
    "motion": "pulse"
  },
  {
    "slug": "hidden-leaf",
    "name": "Hidden Leaf",
    "series": "Naruto",
    "description": "An engraved leaf crest, steel headband and forest-green cord.",
    "palette": [
      "#68b482",
      "#16231d",
      "#d5e0c9"
    ],
    "edge": "cord",
    "layout": "crown",
    "motion": "sweep"
  },
  {
    "slug": "sand-seal",
    "name": "Sand Seal",
    "series": "Naruto",
    "description": "A sealed gourd and wind-cut sandstone around the portrait.",
    "palette": [
      "#d4a364",
      "#402523",
      "#f7dfab"
    ],
    "edge": "sand",
    "layout": "diagonal",
    "motion": "drift"
  },
  {
    "slug": "nine-tails",
    "name": "Nine Tails",
    "series": "Naruto",
    "description": "Nine fox tails unfurl through a burning chakra seal.",
    "palette": [
      "#ff8a32",
      "#32131d",
      "#ffe2a3"
    ],
    "edge": "flame",
    "layout": "opposed",
    "motion": "ember"
  },
  {
    "slug": "paper-angel",
    "name": "Paper Angel",
    "series": "Naruto",
    "description": "Folded paper wings and a violet origami rose.",
    "palette": [
      "#b6a2ee",
      "#26213b",
      "#f8f4ff"
    ],
    "edge": "paper",
    "layout": "diagonal",
    "motion": "float"
  },
  {
    "slug": "straw-hat",
    "name": "Straw Hat",
    "series": "One Piece",
    "description": "A red-banded straw hat, ship rope and brass rivets.",
    "palette": [
      "#e3b654",
      "#392327",
      "#ed5b58"
    ],
    "edge": "rope",
    "layout": "crown",
    "motion": "sweep"
  },
  {
    "slug": "three-sword-style",
    "name": "Three Sword Style",
    "series": "One Piece",
    "description": "Three blades cross a jade frame wrapped in sword cord.",
    "palette": [
      "#64caa0",
      "#123329",
      "#e8d9af"
    ],
    "edge": "katana",
    "layout": "opposed",
    "motion": "slash"
  },
  {
    "slug": "heart-pirates",
    "name": "Heart Pirates",
    "series": "One Piece",
    "description": "A grinning heart-pirate crest on black and yellow steel.",
    "palette": [
      "#efc64b",
      "#242024",
      "#fff3c7"
    ],
    "edge": "metal",
    "layout": "diagonal",
    "motion": "pulse"
  },
  {
    "slug": "flame-fist",
    "name": "Flame Fist",
    "series": "One Piece",
    "description": "A burnt orange hat, beadwork and curling fire.",
    "palette": [
      "#ff9b43",
      "#351921",
      "#f6dfab"
    ],
    "edge": "flame",
    "layout": "crown",
    "motion": "ember"
  },
  {
    "slug": "ghost-princess",
    "name": "Ghost Princess",
    "series": "One Piece",
    "description": "Little ghosts drift between gothic pink ribbons.",
    "palette": [
      "#f18cbc",
      "#2d1734",
      "#eee4ff"
    ],
    "edge": "lace",
    "layout": "opposed",
    "motion": "float"
  },
  {
    "slug": "hollow-mask",
    "name": "Hollow Mask",
    "series": "Bleach",
    "description": "A striped ivory mask breaks through black spirit metal.",
    "palette": [
      "#e9e4d5",
      "#21151e",
      "#cf3447"
    ],
    "edge": "bone",
    "layout": "diagonal",
    "motion": "pulse"
  },
  {
    "slug": "thousand-petals",
    "name": "Thousand Petals",
    "series": "Bleach",
    "description": "A thousand-blade bloom, pale pink petals and polished steel.",
    "palette": [
      "#eaa7cf",
      "#342039",
      "#f8e4f1"
    ],
    "edge": "petal",
    "layout": "opposed",
    "motion": "float"
  },
  {
    "slug": "ice-dragon",
    "name": "Ice Dragon",
    "series": "Bleach",
    "description": "A crystalline dragon curls around a frozen silver edge.",
    "palette": [
      "#7de3ee",
      "#142e42",
      "#ecfbff"
    ],
    "edge": "crystal",
    "layout": "diagonal",
    "motion": "sweep"
  },
  {
    "slug": "soul-butterfly",
    "name": "Soul Butterfly",
    "series": "Bleach",
    "description": "Black swallowtail wings outlined in violet spirit light.",
    "palette": [
      "#bd9df1",
      "#24182e",
      "#eddefb"
    ],
    "edge": "wing",
    "layout": "crown",
    "motion": "float"
  },
  {
    "slug": "water-breathing",
    "name": "Water Breathing",
    "series": "Demon Slayer",
    "description": "Cresting blue waves and a green-black checked sword wrap.",
    "palette": [
      "#45c0c5",
      "#17352b",
      "#c0f4fa"
    ],
    "edge": "wave",
    "layout": "diagonal",
    "motion": "drift"
  },
  {
    "slug": "flame-hashira",
    "name": "Flame Hashira",
    "series": "Demon Slayer",
    "description": "A flame-shaped sword guard inside a white-hot red mantle.",
    "palette": [
      "#f15735",
      "#3e1320",
      "#ffe4a3"
    ],
    "edge": "flame",
    "layout": "opposed",
    "motion": "ember"
  },
  {
    "slug": "butterfly-estate",
    "name": "Butterfly Estate",
    "series": "Demon Slayer",
    "description": "Lavender butterfly wings, dotted hems and a needle-fine blade.",
    "palette": [
      "#b48de8",
      "#281d3d",
      "#d6f6e9"
    ],
    "edge": "lace",
    "layout": "diagonal",
    "motion": "float"
  },
  {
    "slug": "thunder-breathing",
    "name": "Thunder Breathing",
    "series": "Demon Slayer",
    "description": "Golden lightning cuts through a triangle-patterned haori edge.",
    "palette": [
      "#f1be46",
      "#35263d",
      "#fff6c6"
    ],
    "edge": "bolt",
    "layout": "crown",
    "motion": "charge"
  },
  {
    "slug": "limitless",
    "name": "Limitless",
    "series": "Jujutsu Kaisen",
    "description": "An ice-blue eye and two opposing infinity rings.",
    "palette": [
      "#74d9ff",
      "#151e3e",
      "#eae6ff"
    ],
    "edge": "orbit",
    "layout": "opposed",
    "motion": "pulse"
  },
  {
    "slug": "king-of-curses",
    "name": "King of Curses",
    "series": "Jujutsu Kaisen",
    "description": "Cursed markings and a dark shrine crowned in crimson.",
    "palette": [
      "#e66880",
      "#311b2e",
      "#f5c0a4"
    ],
    "edge": "shrine",
    "layout": "crown",
    "motion": "ember"
  },
  {
    "slug": "ten-shadows",
    "name": "Ten Shadows",
    "series": "Jujutsu Kaisen",
    "description": "Twin divine-dog silhouettes emerge from indigo shadow.",
    "palette": [
      "#a6adf7",
      "#19162c",
      "#e1dffa"
    ],
    "edge": "ink",
    "layout": "diagonal",
    "motion": "drift"
  },
  {
    "slug": "wings-of-freedom",
    "name": "Wings of Freedom",
    "series": "Attack on Titan",
    "description": "Blue and silver feathers over weathered expedition steel.",
    "palette": [
      "#8cb8df",
      "#23323f",
      "#e6e8dc"
    ],
    "edge": "wing",
    "layout": "opposed",
    "motion": "sweep"
  },
  {
    "slug": "the-walls",
    "name": "The Walls",
    "series": "Attack on Titan",
    "description": "Three concentric stone walls, gate towers and ember-lit seams.",
    "palette": [
      "#c9b49b",
      "#35302e",
      "#e7d8b7"
    ],
    "edge": "stone",
    "layout": "diagonal",
    "motion": "ember"
  },
  {
    "slug": "thunder-spears",
    "name": "Thunder Spears",
    "series": "Attack on Titan",
    "description": "Paired thunder spears and taut grappling cables.",
    "palette": [
      "#b8c9ce",
      "#223d40",
      "#e8bd75"
    ],
    "edge": "cable",
    "layout": "opposed",
    "motion": "charge"
  },
  {
    "slug": "four-star",
    "name": "Four-Star Dragon Ball",
    "series": "Dragon Ball",
    "description": "Four red stars suspended in amber glass and a coiled dragon rim.",
    "palette": [
      "#f4a62e",
      "#382029",
      "#eb5545"
    ],
    "edge": "scale",
    "layout": "crown",
    "motion": "pulse"
  },
  {
    "slug": "saiyan-armor",
    "name": "Saiyan Armor",
    "series": "Dragon Ball",
    "description": "White armor plates, gold ribs and a ruby scouter lens.",
    "palette": [
      "#9fa9f4",
      "#222740",
      "#e8ce73"
    ],
    "edge": "armor",
    "layout": "diagonal",
    "motion": "charge"
  },
  {
    "slug": "capsule-corp",
    "name": "Capsule Corp.",
    "series": "Dragon Ball",
    "description": "A capsule case in clean white, turquoise and cobalt.",
    "palette": [
      "#64d8de",
      "#182e46",
      "#eaf8f9"
    ],
    "edge": "tech",
    "layout": "crown",
    "motion": "sweep"
  },
  {
    "slug": "scarlet-chains",
    "name": "Scarlet Chains",
    "series": "Hunter x Hunter",
    "description": "A scarlet eye suspended between silver chains and a cross pendant.",
    "palette": [
      "#e65a62",
      "#2c192c",
      "#e1e6ec"
    ],
    "edge": "chain",
    "layout": "diagonal",
    "motion": "pulse"
  },
  {
    "slug": "phantom-troupe",
    "name": "Phantom Troupe",
    "series": "Hunter x Hunter",
    "description": "A twelve-legged spider on a dark, thread-bound frame.",
    "palette": [
      "#bd8cbc",
      "#201a29",
      "#dfcbd9"
    ],
    "edge": "web",
    "layout": "crown",
    "motion": "drift"
  },
  {
    "slug": "bungee-gum",
    "name": "Bungee Gum",
    "series": "Hunter x Hunter",
    "description": "Playing cards, a star and a teardrop linked by elastic pink strands.",
    "palette": [
      "#ef84b7",
      "#33214b",
      "#acb4ff"
    ],
    "edge": "ribbon",
    "layout": "opposed",
    "motion": "float"
  },
  {
    "slug": "brand-of-sacrifice",
    "name": "Brand of Sacrifice",
    "series": "Berserk",
    "description": "A red sacrificial mark carved into eclipse-black iron.",
    "palette": [
      "#bf3d4c",
      "#21141c",
      "#d89979"
    ],
    "edge": "thorn",
    "layout": "crown",
    "motion": "ember"
  },
  {
    "slug": "dragonslayer",
    "name": "Dragonslayer",
    "series": "Berserk",
    "description": "A massive scarred blade, riveted iron and fractured sparks.",
    "palette": [
      "#adb7c5",
      "#24252d",
      "#d88656"
    ],
    "edge": "iron",
    "layout": "diagonal",
    "motion": "slash"
  },
  {
    "slug": "death-note",
    "name": "Death Note",
    "series": "Death Note",
    "description": "A black notebook, a silver quill and fine ruled edges.",
    "palette": [
      "#ced0d8",
      "#191922",
      "#a78cbf"
    ],
    "edge": "page",
    "layout": "diagonal",
    "motion": "sweep"
  },
  {
    "slug": "shinigami-apple",
    "name": "Shinigami Apple",
    "series": "Death Note",
    "description": "A lacquer-red apple hangs among sharp black feathers.",
    "palette": [
      "#c9425c",
      "#241524",
      "#d4b2e5"
    ],
    "edge": "feather",
    "layout": "opposed",
    "motion": "float"
  },
  {
    "slug": "transmutation-circle",
    "name": "Transmutation Circle",
    "series": "Fullmetal Alchemist",
    "description": "Nested alchemical geometry engraved in brass and blue light.",
    "palette": [
      "#6cd9e7",
      "#1b3044",
      "#e8c676"
    ],
    "edge": "glyph",
    "layout": "opposed",
    "motion": "charge"
  },
  {
    "slug": "blood-seal",
    "name": "Blood Seal",
    "series": "Fullmetal Alchemist",
    "description": "A red seal inside a riveted suit of dark silver armor.",
    "palette": [
      "#d25c63",
      "#28252e",
      "#c3c8d4"
    ],
    "edge": "armor",
    "layout": "crown",
    "motion": "pulse"
  },
  {
    "slug": "unit-01",
    "name": "Unit-01",
    "series": "Neon Genesis Evangelion",
    "description": "Horned violet armor with acid-green vents and warning ticks.",
    "palette": [
      "#9864df",
      "#291b40",
      "#c7f467"
    ],
    "edge": "mecha",
    "layout": "diagonal",
    "motion": "charge"
  },
  {
    "slug": "at-field",
    "name": "A.T. Field",
    "series": "Neon Genesis Evangelion",
    "description": "Nested amber octagons cross a black hazard frame.",
    "palette": [
      "#f4a644",
      "#342033",
      "#fff1b6"
    ],
    "edge": "hex",
    "layout": "opposed",
    "motion": "pulse"
  },
  {
    "slug": "moon-prism",
    "name": "Moon Prism",
    "series": "Sailor Moon",
    "description": "A jeweled lunar compact, gold crescent and flowing pink ribbons.",
    "palette": [
      "#f2a8cf",
      "#352141",
      "#f3d782"
    ],
    "edge": "ribbon",
    "layout": "crown",
    "motion": "float"
  },
  {
    "slug": "mars-flame",
    "name": "Mars Flame",
    "series": "Sailor Moon",
    "description": "A red talisman, bow and sacred flame in a ruby frame.",
    "palette": [
      "#dc526e",
      "#381b2f",
      "#edc981"
    ],
    "edge": "talisman",
    "layout": "diagonal",
    "motion": "ember"
  },
  {
    "slug": "saturn-silence",
    "name": "Saturn Silence",
    "series": "Sailor Moon",
    "description": "A long silver glaive and violet rings beneath a quiet starfield.",
    "palette": [
      "#ab8bd9",
      "#261e3b",
      "#ede6fa"
    ],
    "edge": "orbit",
    "layout": "opposed",
    "motion": "sweep"
  },
  {
    "slug": "gold-experience",
    "name": "Gold Experience",
    "series": "JoJo’s Bizarre Adventure",
    "description": "A gilded ladybird and heart-shaped pink metalwork.",
    "palette": [
      "#deb34d",
      "#352336",
      "#ef96c3"
    ],
    "edge": "beetle",
    "layout": "crown",
    "motion": "sweep"
  },
  {
    "slug": "star-platinum",
    "name": "Star Platinum",
    "series": "JoJo’s Bizarre Adventure",
    "description": "An armored fist strikes through amethyst stars and speed lines.",
    "palette": [
      "#ad87e3",
      "#27203d",
      "#e5c879"
    ],
    "edge": "burst",
    "layout": "diagonal",
    "motion": "charge"
  },
  {
    "slug": "heavens-door",
    "name": "Heaven’s Door",
    "series": "JoJo’s Bizarre Adventure",
    "description": "An open book, fountain-pen nib and emerald manuscript trim.",
    "palette": [
      "#79bd9f",
      "#20382e",
      "#eddfaa"
    ],
    "edge": "page",
    "layout": "opposed",
    "motion": "sweep"
  },
  {
    "slug": "chainsaw-devil",
    "name": "Chainsaw Devil",
    "series": "Chainsaw Man",
    "description": "Chainsaw teeth, an orange engine shell and a pull-cord grip.",
    "palette": [
      "#ee8e45",
      "#30212b",
      "#ced1cd"
    ],
    "edge": "saw",
    "layout": "diagonal",
    "motion": "slash"
  },
  {
    "slug": "control-devil",
    "name": "Control Devil",
    "series": "Chainsaw Man",
    "description": "Concentric golden eyes watch from a red chain-bound frame.",
    "palette": [
      "#e08b72",
      "#38202d",
      "#eed787"
    ],
    "edge": "chain",
    "layout": "opposed",
    "motion": "pulse"
  },
  {
    "slug": "forest-guardian",
    "name": "Forest Guardian",
    "series": "My Neighbor Totoro",
    "description": "A broad green leaf shelters acorns and soft forest silhouettes.",
    "palette": [
      "#85b590",
      "#253d32",
      "#e4d7b8"
    ],
    "edge": "leaf",
    "layout": "crown",
    "motion": "float"
  },
  {
    "slug": "no-face",
    "name": "No-Face",
    "series": "Spirited Away",
    "description": "A pale spirit mask, purple markings and scattered gold.",
    "palette": [
      "#d6b9e5",
      "#261d35",
      "#e4c78c"
    ],
    "edge": "ink",
    "layout": "diagonal",
    "motion": "drift"
  },
  {
    "slug": "swordfish-ii",
    "name": "Swordfish II",
    "series": "Cowboy Bebop",
    "description": "A red racing ship, blue engine light and a star-map frame.",
    "palette": [
      "#de5a64",
      "#192b3f",
      "#a1dce9"
    ],
    "edge": "tech",
    "layout": "opposed",
    "motion": "charge"
  }
];

const animeBorderById = new Map(animeBorderDefinitions.map((border) => ["profile-border-anime-" + border.slug, border]));
export function getAnimeBorderDefinition(itemId: string) {
  return animeBorderById.get(itemId) ?? null;
}
export const animeMangaRotatingBorders = animeBorderDefinitions.map((border) => ({
  id: "profile-border-anime-" + border.slug,
  name: border.name + " Border",
  description: border.description,
  type: "profile-border" as const,
  price: 10000,
  color: border.palette[0],
  borderPalette: border.palette,
  collection: "Anime / Manga",
  series: border.series,
}));
