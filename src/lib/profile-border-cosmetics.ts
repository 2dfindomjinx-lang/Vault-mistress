export type ProfileBorderStyle =
  | "solid"
  | "split-diagonal"
  | "split-vertical"
  | "tricolor-band"
  | "tricolor-diagonal"
  | "pinstripe"
  | "edge-stripe"
  | "stadium-glow"
  | "conic-slice"
  | "city-grid"
  | "cannon-corners"
  | "flame-lights"
  | "royal-ring"
  | "energy-rush"
  | "navy-minimal"
  | "honeycomb"
  | "bavarian-diamond"
  | "flag-sash"
  | "speed-lines"
  | "industrial-steel"
  | "neon-stripes"
  | "wave-glow"
  | "marble-noir"
  | "laurel-luxe"
  | "windflow"
  | "eagle-feathers"
  | "paris-lights"
  | "royal-chrome"
  | "split-metal"
  | "firestorm"
  | "starburst"
  | "saint-cross"
  | "tricolor-feathers"
  | "fleur-royale"
  | "sun-ember"
  | "crescent-trail"
  | "crescent-luxe"
  | "nordic-cross"
  | "scandi-geo"
  | "crystal-glass"
  | "ice-crystal"
  | "starfield"
  | "chrome-command"
  | "maple-corners"
  | "sun-rays"
  | "tropical-leaves"
  | "sakura-sun"
  | "stadium-steel";

export type ProfileBorderCatalogItem = {
  id: string;
  name: string;
  description: string;
  type: "profile-border";
  price: number;
  color: string;
  borderPalette: [string, string, string?];
  borderStyle: ProfileBorderStyle;
  isArchived?: boolean;
};

function footballBorder(
  item: Omit<ProfileBorderCatalogItem, "type">,
): ProfileBorderCatalogItem {
  return {
    ...item,
    type: "profile-border",
  };
}

export const footballInspiredRotatingBorders: ProfileBorderCatalogItem[] = [
  footballBorder({
    id: "profile-border-rotating-manchester-city",
    name: "Manchester City Border",
    description: "Sky blue chrome with thin gold guides and a sharp geometric city-grid finish.",
    price: 10000,
    color: "#6CABDD",
    borderPalette: ["#6CABDD", "#F8FBFF", "#D8B15A"],
    borderStyle: "city-grid",
  }),
  footballBorder({
    id: "profile-border-rotating-arsenal",
    name: "Arsenal Border",
    description: "Red and gold with premium corner accents shaped to hint at a cannon silhouette.",
    price: 10000,
    color: "#C8102E",
    borderPalette: ["#C8102E", "#7A0015", "#D4AF37"],
    borderStyle: "cannon-corners",
  }),
  footballBorder({
    id: "profile-border-rotating-liverpool",
    name: "Liverpool Border",
    description: "Deep red lacquer streaked with ember-like light trails and soft flame motion.",
    price: 10000,
    color: "#A50034",
    borderPalette: ["#A50034", "#6F0020", "#FF7A45"],
    borderStyle: "flame-lights",
  }),
  footballBorder({
    id: "profile-border-rotating-chelsea",
    name: "Chelsea Border",
    description: "Royal blue prestige with a noble gold ring and restrained crown-like detailing.",
    price: 10000,
    color: "#034694",
    borderPalette: ["#034694", "#0D2240", "#D4AF37"],
    borderStyle: "royal-ring",
  }),
  footballBorder({
    id: "profile-border-rotating-manchester-united",
    name: "Manchester United Border",
    description: "Heavy red metal charged by yellow-red energy lines and a stronger forged frame.",
    price: 10000,
    color: "#DA020E",
    borderPalette: ["#DA020E", "#6F0006", "#F6B800"],
    borderStyle: "energy-rush",
  }),
  footballBorder({
    id: "profile-border-rotating-tottenham",
    name: "Tottenham Border",
    description: "White and navy kept clean and sparse with a minimalist premium edge treatment.",
    price: 10000,
    color: "#F5F8FD",
    borderPalette: ["#F5F8FD", "#0E1B4D", "#90A4C3"],
    borderStyle: "navy-minimal",
  }),
  footballBorder({
    id: "profile-border-rotating-dortmund",
    name: "Borussia Dortmund Border",
    description: "Bright yellow and black with a stadium-wall honeycomb shell.",
    price: 10000,
    color: "#FDE100",
    borderPalette: ["#FDE100", "#111111", "#F7C600"],
    borderStyle: "honeycomb",
  }),
  footballBorder({
    id: "profile-border-rotating-bayern-munich",
    name: "Bayern Munich Border",
    description: "Red and white prestige structured with crisp Bavarian diamond geometry.",
    price: 10000,
    color: "#DC052D",
    borderPalette: ["#DC052D", "#FFFFFF", "#B9D9FF"],
    borderStyle: "bavarian-diamond",
  }),
  footballBorder({
    id: "profile-border-rotating-hertha-berlin",
    name: "Hertha Berlin Border",
    description: "Blue and white crossed by a clean diagonal sash like a waving club flag.",
    price: 10000,
    color: "#005CA9",
    borderPalette: ["#005CA9", "#FFFFFF", "#77B7E5"],
    borderStyle: "flag-sash",
  }),
  footballBorder({
    id: "profile-border-rotating-rb-leipzig",
    name: "RB Leipzig Border",
    description: "White and red cut by sharp forward speed lines for a modern sprinting feel.",
    price: 10000,
    color: "#FFFFFF",
    borderPalette: ["#FFFFFF", "#D60F2E", "#8B0014"],
    borderStyle: "speed-lines",
  }),
  footballBorder({
    id: "profile-border-rotating-union-berlin",
    name: "Union Berlin Border",
    description: "A clean Union Berlin frame built from bold red-white horizontal striping with a subtle animated sheen.",
    price: 10000,
    color: "#C81E2A",
    borderPalette: ["#C81E2A", "#FFFFFF", "#8E121B"],
    borderStyle: "stadium-steel",
  }),
  footballBorder({
    id: "profile-border-rotating-inter-milan",
    name: "Inter Milan Border",
    description: "Black and blue gloss with neon blue striping running through the frame.",
    price: 10000,
    color: "#0058A3",
    borderPalette: ["#0058A3", "#0B0C10", "#3FD6FF"],
    borderStyle: "neon-stripes",
  }),
  footballBorder({
    id: "profile-border-rotating-ac-milan",
    name: "AC Milan Border",
    description: "Red-black vertical metal bars with a more elegant Rossoneri severity.",
    price: 10000,
    color: "#B60017",
    borderPalette: ["#B60017", "#101010", "#5C0B0E"],
    borderStyle: "pinstripe",
  }),
  footballBorder({
    id: "profile-border-rotating-napoli",
    name: "Napoli Border",
    description: "Azure blue layered with sea-wave shimmer and bay-light reflections.",
    price: 10000,
    color: "#12A0D7",
    borderPalette: ["#12A0D7", "#66D3FF", "#0B5FFF"],
    borderStyle: "wave-glow",
  }),
  footballBorder({
    id: "profile-border-rotating-juventus",
    name: "Juventus Border",
    description: "Minimal black and white with a polished noir-marble finish.",
    price: 10000,
    color: "#111111",
    borderPalette: ["#111111", "#F5F5F5", "#8F8F8F"],
    borderStyle: "marble-noir",
  }),
  footballBorder({
    id: "profile-border-rotating-roma",
    name: "AS Roma Border",
    description: "Burgundy and gold enriched by laurel trim and old-imperial luxury.",
    price: 10000,
    color: "#7A263A",
    borderPalette: ["#7A263A", "#D4AF37", "#F2D574"],
    borderStyle: "laurel-luxe",
  }),
  footballBorder({
    id: "profile-border-rotating-atalanta",
    name: "Atalanta Border",
    description: "Black and blue shaped by sweeping windflow lines rather than hard stripes.",
    price: 10000,
    color: "#1856A6",
    borderPalette: ["#1856A6", "#0A0D12", "#58C0FF"],
    borderStyle: "windflow",
  }),
  footballBorder({
    id: "profile-border-rotating-lazio",
    name: "Lazio Border",
    description: "Sky blue built from feathered wing lines that feel light and aerial.",
    price: 10000,
    color: "#8FD5FF",
    borderPalette: ["#8FD5FF", "#DDF6FF", "#6AA7D8"],
    borderStyle: "eagle-feathers",
  }),
  footballBorder({
    id: "profile-border-rotating-psg",
    name: "Paris Saint-Germain Border",
    description: "Navy and red nightlife framed by subtle gold and city-light sparkle.",
    price: 10000,
    color: "#0A1D46",
    borderPalette: ["#0A1D46", "#C8113B", "#D4AF37"],
    borderStyle: "paris-lights",
  }),
  footballBorder({
    id: "profile-border-rotating-real-madrid",
    name: "Real Madrid Border",
    description: "White chrome and royal gold with a bright regal sheen across the frame.",
    price: 10000,
    color: "#F7F7F7",
    borderPalette: ["#F7F7F7", "#D5B15A", "#CFCFCF"],
    borderStyle: "royal-chrome",
  }),
  footballBorder({
    id: "profile-border-rotating-barcelona",
    name: "Barcelona Border",
    description: "Blaugrana metal split into burgundy and navy with a heavier forged divide.",
    price: 10000,
    color: "#A50044",
    borderPalette: ["#A50044", "#004D98", "#6B1839"],
    borderStyle: "split-metal",
  }),
  footballBorder({
    id: "profile-border-rotating-atletico-madrid",
    name: "Atletico Madrid Border",
    description: "Red, white, and navy pulled into aggressive diagonal battle stripes.",
    price: 10000,
    color: "#C9342F",
    borderPalette: ["#C9342F", "#FFFFFF", "#0B2C62"],
    borderStyle: "tricolor-diagonal",
  }),
  footballBorder({
    id: "profile-border-rotating-galatasaray",
    name: "Galatasaray Border",
    description: "Red and yellow heated by a firestorm glow and embered edges.",
    price: 10000,
    color: "#C71432",
    borderPalette: ["#C71432", "#F6C200", "#FF7A00"],
    borderStyle: "firestorm",
  }),
  footballBorder({
    id: "profile-border-rotating-fenerbahce",
    name: "Fenerbahce Border",
    description: "Navy and yellow prestige with subtle starburst glints across the frame.",
    price: 10000,
    color: "#0B2C62",
    borderPalette: ["#0B2C62", "#F2C200", "#FFF2A1"],
    borderStyle: "starburst",
  }),
  footballBorder({
    id: "profile-border-rotating-besiktas",
    name: "Besiktas Border",
    description: "Black-white marble and softened feather texture for a colder eagle finish.",
    price: 10000,
    color: "#111111",
    borderPalette: ["#111111", "#F2F2F2", "#6B6B6B"],
    borderStyle: "tricolor-feathers",
  }),
  footballBorder({
    id: "profile-border-rotating-trabzonspor",
    name: "Trabzonspor Border",
    description: "Claret and blue wrapped in misty glow with a quieter Black Sea shimmer.",
    price: 10000,
    color: "#6C1D45",
    borderPalette: ["#6C1D45", "#2D67A7", "#A8D3FF"],
    borderStyle: "stadium-glow",
  }),
  footballBorder({
    id: "profile-border-rotating-goztepe",
    name: "Goztepe Border",
    description: "Yellow-red vintage metal with classic striping and warmer aged highlights.",
    price: 10000,
    color: "#D8A100",
    borderPalette: ["#D8A100", "#A81E2A", "#F2D57A"],
    borderStyle: "edge-stripe",
  }),
  footballBorder({
    id: "profile-border-rotating-england-nt",
    name: "England National Border",
    description: "White and red crossed by a crisp St. George band structure.",
    price: 10000,
    color: "#F8FAFC",
    borderPalette: ["#F8FAFC", "#C8102E", "#A9B6C9"],
    borderStyle: "saint-cross",
  }),
  footballBorder({
    id: "profile-border-rotating-germany-nt",
    name: "Germany National Border",
    description: "Black and gold authority with feathered detailing and a restrained tricolor pulse.",
    price: 10000,
    color: "#111111",
    borderPalette: ["#111111", "#D4AF37", "#D10D1A"],
    borderStyle: "tricolor-feathers",
  }),
  footballBorder({
    id: "profile-border-rotating-italy-nt",
    name: "Italy National Border",
    description: "Azzurri blue recast as polished Roman marble with cooler depth.",
    price: 10000,
    color: "#0C58B5",
    borderPalette: ["#0C58B5", "#E7EEF8", "#6A7EA8"],
    borderStyle: "marble-noir",
  }),
  footballBorder({
    id: "profile-border-rotating-france-nt",
    name: "France National Border",
    description: "Deep blue nobility with subtle fleur-royale ornament and luminous trim.",
    price: 10000,
    color: "#123C8D",
    borderPalette: ["#123C8D", "#1E62D0", "#E9EEF7"],
    borderStyle: "fleur-royale",
  }),
  footballBorder({
    id: "profile-border-rotating-belgium-nt",
    name: "Belgium National Border",
    description: "Black, gold, and red fused into a strong diagonal national blend.",
    price: 10000,
    color: "#111111",
    borderPalette: ["#111111", "#F0C419", "#C8102E"],
    borderStyle: "tricolor-diagonal",
  }),
  footballBorder({
    id: "profile-border-rotating-netherlands-nt",
    name: "Netherlands National Border",
    description: "A hot orange frame with energetic glow and cleaner high-voltage motion.",
    price: 10000,
    color: "#F97316",
    borderPalette: ["#F97316", "#FDBA74", "#7C2D12"],
    borderStyle: "sun-ember",
  }),
  footballBorder({
    id: "profile-border-rotating-spain-nt",
    name: "Spain National Border",
    description: "Red and gold with rich royal embroidery and warmer ceremonial shine.",
    price: 10000,
    color: "#B91C1C",
    borderPalette: ["#B91C1C", "#F1BF00", "#7F1D1D"],
    borderStyle: "laurel-luxe",
  }),
  footballBorder({
    id: "profile-border-rotating-turkey-nt",
    name: "Turkiye National Border",
    description: "True Turkish crimson with silver crescent-star detailing and premium Ottoman-inspired engraving.",
    price: 10000,
    color: "#C8102E",
    borderPalette: ["#C8102E", "#7A0F20", "#F3F4F6"],
    borderStyle: "crescent-luxe",
  }),
  footballBorder({
    id: "profile-border-rotating-austria-nt",
    name: "Austria National Border",
    description: "Red and white with clean horizontal restraint and colder precision.",
    price: 10000,
    color: "#C8102E",
    borderPalette: ["#C8102E", "#FFFFFF", "#9D1127"],
    borderStyle: "tricolor-band",
  }),
  footballBorder({
    id: "profile-border-rotating-denmark-nt",
    name: "Denmark National Border",
    description: "Red and white crossed in a stark Nordic frame layout.",
    price: 10000,
    color: "#B91C1C",
    borderPalette: ["#B91C1C", "#FFFFFF", "#7F1D1D"],
    borderStyle: "nordic-cross",
  }),
  footballBorder({
    id: "profile-border-rotating-sweden-nt",
    name: "Sweden National Border",
    description: "Blue and yellow built with Scandinavian geometry rather than plain stripes.",
    price: 10000,
    color: "#005293",
    borderPalette: ["#005293", "#FECB00", "#B9D7F8"],
    borderStyle: "scandi-geo",
  }),
  footballBorder({
    id: "profile-border-rotating-switzerland-nt",
    name: "Switzerland National Border",
    description: "White and red polished into a crystalline glass finish with sharp depth.",
    price: 10000,
    color: "#D52B1E",
    borderPalette: ["#D52B1E", "#FFFFFF", "#FFC9C4"],
    borderStyle: "crystal-glass",
  }),
  footballBorder({
    id: "profile-border-rotating-poland-nt",
    name: "Poland National Border",
    description: "White and red softened by feathered texture inspired by an eagle motif.",
    price: 10000,
    color: "#FFFFFF",
    borderPalette: ["#FFFFFF", "#DC143C", "#B0B8C4"],
    borderStyle: "eagle-feathers",
  }),
  footballBorder({
    id: "profile-border-rotating-norway-nt",
    name: "Norway National Border",
    description: "Red and navy crossed by layered Nordic lines with a colder sea-state finish.",
    price: 10000,
    color: "#BA0C2F",
    borderPalette: ["#BA0C2F", "#00205B", "#FFFFFF"],
    borderStyle: "nordic-cross",
  }),
  footballBorder({
    id: "profile-border-rotating-finland-nt",
    name: "Finland National Border",
    description: "White and blue refracted through ice-crystal highlights.",
    price: 10000,
    color: "#FFFFFF",
    borderPalette: ["#FFFFFF", "#003580", "#BFE7FF"],
    borderStyle: "ice-crystal",
  }),
  footballBorder({
    id: "profile-border-rotating-usa-nt",
    name: "United States National Border",
    description: "An unmistakable stars-and-stripes frame with a navy canton, crisp white bands, and premium lacquered red trim.",
    price: 10000,
    color: "#1C2B4F",
    borderPalette: ["#1C2B4F", "#B22234", "#FFFFFF"],
    borderStyle: "chrome-command",
  }),
  footballBorder({
    id: "profile-border-rotating-canada-nt",
    name: "Canada National Border",
    description: "Red and white with maple-inspired corner detailing and a cold clean body.",
    price: 10000,
    color: "#D52B1E",
    borderPalette: ["#D52B1E", "#FFFFFF", "#F3B2AC"],
    borderStyle: "maple-corners",
  }),
  footballBorder({
    id: "profile-border-rotating-argentina-nt",
    name: "Argentina National Border",
    description: "Sky blue and white with radiant sun rays breaking through the frame.",
    price: 10000,
    color: "#6CB4EE",
    borderPalette: ["#6CB4EE", "#FFFFFF", "#F1C84C"],
    borderStyle: "sun-rays",
  }),
  footballBorder({
    id: "profile-border-rotating-brazil-nt",
    name: "Brazil National Border",
    description: "Yellow and green layered with tropical leaf rhythm and warmer movement.",
    price: 10000,
    color: "#009C3B",
    borderPalette: ["#009C3B", "#FFDF00", "#1B5E20"],
    borderStyle: "tropical-leaves",
  }),
  footballBorder({
    id: "profile-border-rotating-japan-nt",
    name: "Japan National Border",
    description: "White and red with a minimal rising-sun core and drifting sakura softness.",
    price: 10000,
    color: "#FFFFFF",
    borderPalette: ["#FFFFFF", "#BC002D", "#F4A8B8"],
    borderStyle: "sakura-sun",
  }),
];
