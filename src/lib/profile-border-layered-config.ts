export type LayeredBorderPattern =
  | "bavarian-diamonds"
  | "city-rings"
  | "feather-slash"
  | "flame-flickers"
  | "flag-ribbon"
  | "honeycomb-dots"
  | "industrial-brush"
  | "laurel-columns"
  | "maple-fragments"
  | "neon-double-lines"
  | "nordic-cross"
  | "racing-diagonals"
  | "sea-foam"
  | "soft-stars"
  | "sunburst-rays"
  | "vertical-pinstripes"
  | "wave-ribbon";

export type LayeredBorderMotif =
  | "crescent-star"
  | "rising-sun"
  | "sun-core"
  | "swiss-cross"
  | "tiny-stars"
  | null;

export type LayeredBorderAnimation =
  | "ember-flicker"
  | "flag-sheen"
  | "neon-pulse"
  | "royal-shimmer"
  | "subtle-glow"
  | "wave-drift"
  | null;

export type LayeredBorderConfig = {
  animation?: LayeredBorderAnimation;
  baseGradient: string;
  cornerAccents?: string;
  innerStripe?: string;
  motif?: LayeredBorderMotif;
  outerGlow?: string;
  pattern?: LayeredBorderPattern;
};

export const layeredBorderConfigById: Record<string, LayeredBorderConfig> = {
  "profile-border-rotating-ac-milan": {
    animation: "subtle-glow",
    baseGradient: "linear-gradient(180deg, #060606 0%, #140607 48%, #050505 100%)",
    cornerAccents:
      "linear-gradient(0deg, transparent 0 82%, rgba(255,255,255,0.85) 82% 84%, transparent 84% 100%)",
    innerStripe:
      "repeating-linear-gradient(90deg, rgba(7,7,7,0.92) 0 15px, rgba(177,10,27,0.96) 15px 28px, rgba(11,11,11,0.94) 28px 42px)",
    outerGlow: "0 0 18px rgba(182,0,23,0.38), 0 0 32px rgba(255,255,255,0.08)",
    pattern: "vertical-pinstripes",
  },
  "profile-border-rotating-arsenal": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(145deg, #7d0016 0%, #c8102e 46%, #630010 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(212,175,55,0.9) 0 16%, transparent 16% 84%, rgba(212,175,55,0.9) 84% 100%), linear-gradient(180deg, rgba(212,175,55,0.55) 0 10%, transparent 10% 90%, rgba(212,175,55,0.55) 90% 100%)",
    innerStripe:
      "linear-gradient(180deg, transparent 0 14%, rgba(212,175,55,0.2) 14% 18%, transparent 18% 82%, rgba(212,175,55,0.2) 82% 86%, transparent 86% 100%)",
    outerGlow: "0 0 18px rgba(212,175,55,0.28), 0 0 34px rgba(200,16,46,0.24)",
    pattern: "city-rings",
  },
  "profile-border-rotating-atalanta": {
    animation: "flag-sheen",
    baseGradient: "linear-gradient(135deg, #05070c 0%, #0f1728 36%, #1856a6 68%, #040608 100%)",
    cornerAccents:
      "linear-gradient(135deg, rgba(88,192,255,0.85) 0 12%, transparent 12% 88%, rgba(88,192,255,0.7) 88% 100%)",
    innerStripe:
      "repeating-linear-gradient(122deg, transparent 0 12px, rgba(88,192,255,0.36) 12px 16px, rgba(24,86,166,0.75) 16px 26px, transparent 26px 38px)",
    outerGlow: "0 0 18px rgba(24,86,166,0.34), 0 0 28px rgba(88,192,255,0.18)",
    pattern: "racing-diagonals",
  },
  "profile-border-rotating-bayern-munich": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(180deg, #b90029 0%, #dc052d 58%, #8f001e 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(255,255,255,0.18) 0 8%, transparent 8% 92%, rgba(255,255,255,0.18) 92% 100%)",
    innerStripe:
      "linear-gradient(0deg, rgba(255,255,255,0.1) 0 8%, transparent 8% 92%, rgba(255,255,255,0.1) 92% 100%)",
    outerGlow: "0 0 18px rgba(220,5,45,0.34), 0 0 30px rgba(185,217,255,0.16)",
    pattern: "bavarian-diamonds",
  },
  "profile-border-rotating-besiktas": {
    animation: "subtle-glow",
    baseGradient: "linear-gradient(180deg, #060606 0%, #161616 35%, #f2f2f2 36%, #ededed 60%, #090909 100%)",
    cornerAccents:
      "linear-gradient(135deg, rgba(255,255,255,0.88) 0 8%, transparent 8% 92%, rgba(212,24,40,0.85) 92% 100%), linear-gradient(225deg, rgba(255,255,255,0.88) 0 8%, transparent 8% 92%, rgba(212,24,40,0.85) 92% 100%)",
    innerStripe:
      "linear-gradient(90deg, rgba(0,0,0,0.92) 0 28%, rgba(255,255,255,0.98) 28% 72%, rgba(0,0,0,0.92) 72% 100%)",
    outerGlow: "0 0 18px rgba(255,255,255,0.14), 0 0 26px rgba(212,24,40,0.14)",
    pattern: "feather-slash",
  },
  "profile-border-rotating-canada-nt": {
    animation: "flag-sheen",
    baseGradient: "linear-gradient(90deg, #d52b1e 0 26%, #ffffff 26% 74%, #d52b1e 74% 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(213,43,30,0.14) 0 11%, transparent 11% 89%, rgba(213,43,30,0.14) 89% 100%)",
    innerStripe:
      "linear-gradient(90deg, rgba(255,255,255,0.08) 0 24%, transparent 24% 76%, rgba(255,255,255,0.08) 76% 100%)",
    outerGlow: "0 0 18px rgba(213,43,30,0.26), 0 0 26px rgba(255,255,255,0.12)",
    pattern: "maple-fragments",
  },
  "profile-border-rotating-chelsea": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(180deg, #032b6b 0%, #034694 56%, #08142c 100%)",
    cornerAccents:
      "radial-gradient(circle at 12% 14%, rgba(212,175,55,0.92) 0 4%, transparent 5%), radial-gradient(circle at 88% 14%, rgba(212,175,55,0.92) 0 4%, transparent 5%), radial-gradient(circle at 12% 86%, rgba(212,175,55,0.92) 0 4%, transparent 5%), radial-gradient(circle at 88% 86%, rgba(212,175,55,0.92) 0 4%, transparent 5%)",
    innerStripe:
      "radial-gradient(circle at center, transparent 0 52%, rgba(212,175,55,0.38) 52% 58%, transparent 58% 100%)",
    outerGlow: "0 0 18px rgba(3,70,148,0.34), 0 0 28px rgba(212,175,55,0.18)",
    pattern: "city-rings",
  },
  "profile-border-rotating-dortmund": {
    animation: "subtle-glow",
    baseGradient: "linear-gradient(180deg, #fde100 0%, #f7c600 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(17,17,17,0.12) 0 16%, transparent 16% 84%, rgba(17,17,17,0.16) 84% 100%)",
    innerStripe:
      "linear-gradient(180deg, rgba(17,17,17,0.35) 0 10%, transparent 10% 90%, rgba(17,17,17,0.35) 90% 100%)",
    outerGlow: "0 0 18px rgba(253,225,0,0.3), 0 0 26px rgba(17,17,17,0.2)",
    pattern: "honeycomb-dots",
  },
  "profile-border-rotating-finland-nt": {
    animation: "subtle-glow",
    baseGradient: "linear-gradient(180deg, #fbfdff 0%, #eef7ff 100%)",
    cornerAccents:
      "linear-gradient(135deg, rgba(191,231,255,0.5) 0 12%, transparent 12% 88%, rgba(0,53,128,0.15) 88% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 31%, #003580 31% 45%, transparent 45% 100%), linear-gradient(180deg, transparent 0 43%, #003580 43% 57%, transparent 57% 100%)",
    outerGlow: "0 0 18px rgba(0,53,128,0.24), 0 0 30px rgba(191,231,255,0.2)",
    pattern: "nordic-cross",
  },
  "profile-border-rotating-france-nt": {
    animation: "flag-sheen",
    baseGradient: "linear-gradient(90deg, #123c8d 0 33.33%, #f8fbff 33.33% 66.66%, #c8102e 66.66% 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(255,255,255,0.12) 0 10%, transparent 10% 90%, rgba(255,255,255,0.12) 90% 100%)",
    innerStripe:
      "linear-gradient(90deg, rgba(255,255,255,0.15) 0 34%, transparent 34% 66%, rgba(255,255,255,0.15) 66% 100%)",
    outerGlow: "0 0 18px rgba(18,60,141,0.2), 0 0 26px rgba(200,16,46,0.16)",
  },
  "profile-border-rotating-germany-nt": {
    animation: "subtle-glow",
    baseGradient: "linear-gradient(180deg, #111111 0 32%, #b00018 32% 64%, #d4af37 64% 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(255,255,255,0.1) 0 6%, transparent 6% 94%, rgba(212,175,55,0.22) 94% 100%)",
    innerStripe:
      "linear-gradient(180deg, transparent 0 60%, rgba(212,175,55,0.22) 60% 100%)",
    outerGlow: "0 0 18px rgba(212,175,55,0.24), 0 0 26px rgba(17,17,17,0.24)",
    pattern: "feather-slash",
  },
  "profile-border-rotating-hertha-berlin": {
    animation: "flag-sheen",
    baseGradient: "linear-gradient(180deg, #f7fbff 0%, #d7ecff 100%)",
    cornerAccents:
      "linear-gradient(135deg, transparent 0 22%, rgba(0,92,169,0.9) 22% 42%, rgba(255,255,255,0.95) 42% 54%, rgba(0,92,169,0.75) 54% 68%, transparent 68% 100%)",
    innerStripe:
      "linear-gradient(180deg, rgba(0,92,169,0.08) 0 16%, transparent 16% 84%, rgba(0,92,169,0.08) 84% 100%)",
    outerGlow: "0 0 18px rgba(0,92,169,0.22), 0 0 26px rgba(119,183,229,0.18)",
    pattern: "flag-ribbon",
  },
  "profile-border-rotating-inter-milan": {
    animation: "neon-pulse",
    baseGradient: "linear-gradient(180deg, #03060d 0%, #0a1020 42%, #06070a 100%)",
    cornerAccents:
      "linear-gradient(90deg, transparent 0 10%, rgba(63,214,255,0.7) 10% 12%, transparent 12% 88%, rgba(63,214,255,0.7) 88% 90%, transparent 90% 100%)",
    innerStripe:
      "linear-gradient(90deg, rgba(5,88,163,0.92) 0 18%, transparent 18% 38%, rgba(63,214,255,0.92) 38% 42%, transparent 42% 58%, rgba(63,214,255,0.92) 58% 62%, transparent 62% 82%, rgba(5,88,163,0.92) 82% 100%)",
    outerGlow: "0 0 18px rgba(0,88,163,0.32), 0 0 32px rgba(63,214,255,0.22)",
    pattern: "neon-double-lines",
  },
  "profile-border-rotating-italy-nt": {
    animation: "flag-sheen",
    baseGradient: "linear-gradient(90deg, #009246 0 33.33%, #ffffff 33.33% 66.66%, #ce2b37 66.66% 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(255,255,255,0.16) 0 10%, transparent 10% 90%, rgba(255,255,255,0.16) 90% 100%)",
    innerStripe:
      "linear-gradient(90deg, rgba(255,255,255,0.12) 0 34%, transparent 34% 66%, rgba(255,255,255,0.12) 66% 100%)",
    outerGlow: "0 0 18px rgba(0,146,70,0.16), 0 0 24px rgba(206,43,55,0.16)",
  },
  "profile-border-rotating-japan-nt": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(180deg, #ffffff 0%, #f8f8f8 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(188,0,45,0.06) 0 8%, transparent 8% 92%, rgba(188,0,45,0.06) 92% 100%)",
    innerStripe:
      "linear-gradient(90deg, rgba(255,255,255,0.85) 0 6%, transparent 6% 94%, rgba(255,255,255,0.85) 94% 100%)",
    motif: "rising-sun",
    outerGlow: "0 0 16px rgba(255,255,255,0.22), 0 0 22px rgba(188,0,45,0.12)",
  },
  "profile-border-rotating-juventus": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(90deg, #0f0f0f 0 48%, #f5f5f5 48% 52%, #111111 52% 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(212,175,55,0.78) 0 6%, transparent 6% 94%, rgba(212,175,55,0.78) 94% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 20%, rgba(255,255,255,0.14) 20% 22%, transparent 22% 78%, rgba(255,255,255,0.14) 78% 80%, transparent 80% 100%)",
    outerGlow: "0 0 18px rgba(212,175,55,0.16), 0 0 24px rgba(255,255,255,0.1)",
  },
  "profile-border-rotating-lazio": {
    animation: "wave-drift",
    baseGradient: "linear-gradient(180deg, #dff7ff 0%, #8fd5ff 54%, #6aa7d8 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(255,255,255,0.3) 0 12%, transparent 12% 88%, rgba(255,255,255,0.3) 88% 100%)",
    innerStripe:
      "repeating-linear-gradient(160deg, rgba(255,255,255,0.28) 0 12px, transparent 12px 26px)",
    outerGlow: "0 0 18px rgba(143,213,255,0.28), 0 0 26px rgba(255,255,255,0.14)",
    pattern: "feather-slash",
  },
  "profile-border-rotating-liverpool": {
    animation: "ember-flicker",
    baseGradient: "linear-gradient(180deg, #6f0020 0%, #a50034 55%, #4d0015 100%)",
    cornerAccents:
      "radial-gradient(circle at 12% 18%, rgba(255,122,69,0.85) 0 6%, transparent 7%), radial-gradient(circle at 88% 18%, rgba(255,184,92,0.75) 0 5%, transparent 6%), radial-gradient(circle at 18% 86%, rgba(255,122,69,0.68) 0 5%, transparent 6%), radial-gradient(circle at 82% 84%, rgba(255,184,92,0.52) 0 5%, transparent 6%)",
    innerStripe:
      "linear-gradient(180deg, transparent 0 16%, rgba(255,255,255,0.08) 16% 20%, transparent 20% 80%, rgba(255,255,255,0.08) 80% 84%, transparent 84% 100%)",
    outerGlow: "0 0 18px rgba(255,122,69,0.26), 0 0 30px rgba(165,0,52,0.22)",
    pattern: "flame-flickers",
  },
  "profile-border-rotating-manchester-city": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(180deg, #eef8ff 0%, #6cabdd 56%, #f8fbff 100%)",
    cornerAccents:
      "radial-gradient(circle at 50% 18%, rgba(10,33,70,0.2) 0 14%, transparent 15%), radial-gradient(circle at 50% 82%, rgba(10,33,70,0.14) 0 12%, transparent 13%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 15%, rgba(10,33,70,0.26) 15% 17%, transparent 17% 83%, rgba(10,33,70,0.26) 83% 85%, transparent 85% 100%)",
    outerGlow: "0 0 18px rgba(108,171,221,0.3), 0 0 30px rgba(216,177,90,0.14)",
    pattern: "city-rings",
  },
  "profile-border-rotating-napoli": {
    animation: "wave-drift",
    baseGradient: "linear-gradient(180deg, #66d3ff 0%, #12a0d7 56%, #0b5fff 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(255,255,255,0.18) 0 9%, transparent 9% 91%, rgba(255,255,255,0.18) 91% 100%)",
    innerStripe:
      "linear-gradient(90deg, rgba(255,255,255,0.14) 0 10%, transparent 10% 90%, rgba(255,255,255,0.14) 90% 100%)",
    outerGlow: "0 0 18px rgba(18,160,215,0.3), 0 0 30px rgba(255,255,255,0.12)",
    pattern: "sea-foam",
  },
  "profile-border-rotating-poland-nt": {
    animation: "subtle-glow",
    baseGradient: "linear-gradient(180deg, #ffffff 0 50%, #dc143c 50% 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(255,255,255,0.12) 0 12%, transparent 12% 88%, rgba(255,255,255,0.12) 88% 100%)",
    innerStripe:
      "linear-gradient(180deg, rgba(255,255,255,0.14) 0 46%, transparent 46% 54%, rgba(220,20,60,0.14) 54% 100%)",
    outerGlow: "0 0 18px rgba(220,20,60,0.18), 0 0 26px rgba(255,255,255,0.12)",
    pattern: "feather-slash",
  },
  "profile-border-rotating-psg": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(180deg, #061230 0%, #0a1d46 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(212,175,55,0.22) 0 9%, transparent 9% 91%, rgba(212,175,55,0.22) 91% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 41%, #c8113b 41% 59%, transparent 59% 100%), linear-gradient(90deg, transparent 0 38%, rgba(255,255,255,0.9) 38% 40%, transparent 40% 60%, rgba(255,255,255,0.9) 60% 62%, transparent 62% 100%)",
    outerGlow: "0 0 18px rgba(10,29,70,0.3), 0 0 28px rgba(200,17,59,0.18)",
    pattern: "soft-stars",
  },
  "profile-border-rotating-rb-leipzig": {
    animation: "flag-sheen",
    baseGradient: "linear-gradient(180deg, #ffffff 0%, #f7f8fb 100%)",
    cornerAccents:
      "linear-gradient(90deg, transparent 0 14%, rgba(11,44,98,0.18) 14% 16%, transparent 16% 84%, rgba(11,44,98,0.18) 84% 86%, transparent 86% 100%)",
    innerStripe:
      "repeating-linear-gradient(122deg, transparent 0 12px, rgba(214,15,46,0.88) 12px 18px, transparent 18px 34px)",
    outerGlow: "0 0 18px rgba(214,15,46,0.2), 0 0 24px rgba(11,44,98,0.12)",
    pattern: "racing-diagonals",
  },
  "profile-border-rotating-real-madrid": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(180deg, #fffdf8 0%, #f7f7f7 56%, #efe8d4 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(213,177,90,0.8) 0 8%, transparent 8% 92%, rgba(182,146,255,0.34) 92% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 13%, rgba(213,177,90,0.24) 13% 15%, transparent 15% 85%, rgba(213,177,90,0.24) 85% 87%, transparent 87% 100%)",
    outerGlow: "0 0 18px rgba(213,177,90,0.26), 0 0 28px rgba(182,146,255,0.12)",
  },
  "profile-border-rotating-roma": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(180deg, #4f1722 0%, #7a263a 56%, #2c0f16 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(212,175,55,0.9) 0 8%, transparent 8% 92%, rgba(212,175,55,0.9) 92% 100%)",
    innerStripe:
      "linear-gradient(180deg, transparent 0 12%, rgba(242,213,116,0.16) 12% 18%, transparent 18% 82%, rgba(242,213,116,0.16) 82% 88%, transparent 88% 100%)",
    outerGlow: "0 0 18px rgba(212,175,55,0.22), 0 0 28px rgba(122,38,58,0.22)",
    pattern: "laurel-columns",
  },
  "profile-border-rotating-spain-nt": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(180deg, #b91c1c 0 26%, #f1bf00 26% 74%, #8a1212 74% 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(255,255,255,0.12) 0 10%, transparent 10% 90%, rgba(255,255,255,0.12) 90% 100%)",
    innerStripe:
      "linear-gradient(180deg, transparent 0 34%, rgba(179,28,28,0.22) 34% 38%, transparent 38% 62%, rgba(179,28,28,0.22) 62% 66%, transparent 66% 100%)",
    outerGlow: "0 0 18px rgba(241,191,0,0.28), 0 0 26px rgba(185,28,28,0.16)",
    pattern: "laurel-columns",
  },
  "profile-border-rotating-switzerland-nt": {
    animation: "subtle-glow",
    baseGradient: "linear-gradient(180deg, #d52b1e 0%, #bf2013 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(255,255,255,0.12) 0 12%, transparent 12% 88%, rgba(255,255,255,0.12) 88% 100%)",
    innerStripe:
      "linear-gradient(180deg, rgba(255,255,255,0.08) 0 10%, transparent 10% 90%, rgba(255,255,255,0.08) 90% 100%)",
    motif: "swiss-cross",
    outerGlow: "0 0 18px rgba(213,43,30,0.28), 0 0 24px rgba(255,255,255,0.12)",
  },
  "profile-border-rotating-tottenham": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(180deg, #ffffff 0%, #eef3fb 62%, #d8e0ef 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(14,27,77,0.9) 0 7%, transparent 7% 93%, rgba(14,27,77,0.9) 93% 100%)",
    innerStripe:
      "linear-gradient(180deg, rgba(144,164,195,0.65) 0 7%, transparent 7% 93%, rgba(144,164,195,0.65) 93% 100%)",
    outerGlow: "0 0 18px rgba(144,164,195,0.24), 0 0 28px rgba(14,27,77,0.16)",
    pattern: "city-rings",
  },
  "profile-border-rotating-trabzonspor": {
    animation: "wave-drift",
    baseGradient: "linear-gradient(180deg, #42122a 0%, #6c1d45 52%, #2d67a7 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(168,211,255,0.18) 0 10%, transparent 10% 90%, rgba(168,211,255,0.18) 90% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 13%, rgba(45,103,167,0.28) 13% 17%, transparent 17% 83%, rgba(108,29,69,0.22) 83% 87%, transparent 87% 100%)",
    outerGlow: "0 0 18px rgba(108,29,69,0.28), 0 0 28px rgba(45,103,167,0.18)",
    pattern: "wave-ribbon",
  },
  "profile-border-rotating-turkey-nt": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(180deg, #8a0018 0%, #c8102e 56%, #6c0011 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(255,255,255,0.08) 0 10%, transparent 10% 90%, rgba(255,255,255,0.08) 90% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 16%, rgba(255,255,255,0.12) 16% 18%, transparent 18% 82%, rgba(255,255,255,0.12) 82% 84%, transparent 84% 100%)",
    motif: "crescent-star",
    outerGlow: "0 0 18px rgba(200,16,46,0.28), 0 0 26px rgba(255,255,255,0.14)",
  },
  "profile-border-rotating-union-berlin": {
    animation: "subtle-glow",
    baseGradient: "linear-gradient(180deg, #3b1418 0%, #7a1e24 56%, #211d1f 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(158,155,151,0.62) 0 7%, transparent 7% 93%, rgba(158,155,151,0.62) 93% 100%)",
    innerStripe:
      "linear-gradient(180deg, rgba(255,255,255,0.06) 0 8%, transparent 8% 92%, rgba(0,0,0,0.18) 92% 100%)",
    outerGlow: "0 0 18px rgba(122,30,36,0.28), 0 0 24px rgba(47,42,44,0.28)",
    pattern: "industrial-brush",
  },
  "profile-border-rotating-usa-nt": {
    animation: "flag-sheen",
    baseGradient: "linear-gradient(180deg, #1f2852 0%, #3c3b6e 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(255,255,255,0.16) 0 8%, transparent 8% 92%, rgba(255,255,255,0.16) 92% 100%)",
    innerStripe:
      "repeating-linear-gradient(180deg, rgba(178,34,52,0.95) 0 10px, rgba(255,255,255,0.95) 10px 18px, transparent 18px 26px)",
    motif: "tiny-stars",
    outerGlow: "0 0 18px rgba(60,59,110,0.28), 0 0 26px rgba(178,34,52,0.18)",
    pattern: "soft-stars",
  },
  "profile-border-rotating-argentina-nt": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(180deg, #6cb4ee 0 26%, #ffffff 26% 74%, #6cb4ee 74% 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(255,255,255,0.14) 0 8%, transparent 8% 92%, rgba(255,255,255,0.14) 92% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 12%, rgba(241,200,76,0.18) 12% 14%, transparent 14% 86%, rgba(241,200,76,0.18) 86% 88%, transparent 88% 100%)",
    motif: "sun-core",
    outerGlow: "0 0 18px rgba(108,180,238,0.28), 0 0 30px rgba(241,200,76,0.2)",
    pattern: "sunburst-rays",
  },
};
