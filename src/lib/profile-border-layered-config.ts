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
  | "ottoman-filigree"
  | "neon-double-lines"
  | "nordic-cross"
  | "chrome-command"
  | "racing-diagonals"
  | "sea-foam"
  | "soft-stars"
  | "stadium-ribs"
  | "sunburst-rays"
  | "vertical-pinstripes"
  | "wave-ribbon";

export type LayeredBorderMotif =
  | "crescent-star"
  | "rising-sun"
  | "crescent-seal"
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
    baseGradient: "linear-gradient(160deg, #5f0010 0%, #8a0018 24%, #c8102e 62%, #670011 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(212,175,55,0.94) 0 14%, transparent 14% 86%, rgba(212,175,55,0.94) 86% 100%), linear-gradient(180deg, rgba(212,175,55,0.42) 0 9%, transparent 9% 91%, rgba(212,175,55,0.42) 91% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 12%, rgba(212,175,55,0.95) 12% 15%, transparent 15% 85%, rgba(212,175,55,0.95) 85% 88%, transparent 88% 100%)",
    outerGlow: "0 0 18px rgba(212,175,55,0.3), 0 0 34px rgba(200,16,46,0.2)",
    pattern: "vertical-pinstripes",
  },
  "profile-border-rotating-atalanta": {
    animation: "wave-drift",
    baseGradient: "linear-gradient(140deg, #020408 0%, #07101d 34%, #11305f 62%, #020408 100%)",
    cornerAccents:
      "linear-gradient(135deg, rgba(74,181,255,0.9) 0 10%, transparent 10% 90%, rgba(74,181,255,0.78) 90% 100%)",
    innerStripe:
      "repeating-linear-gradient(124deg, transparent 0 10px, rgba(81,190,255,0.92) 10px 14px, rgba(16,78,164,0.7) 14px 24px, transparent 24px 36px)",
    outerGlow: "0 0 18px rgba(54,153,255,0.28), 0 0 30px rgba(81,190,255,0.22)",
    pattern: "racing-diagonals",
  },
  "profile-border-rotating-bayern-munich": {
    animation: "flag-sheen",
    baseGradient: "linear-gradient(180deg, #99001f 0%, #dc052d 56%, #890019 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(255,255,255,0.3) 0 8%, transparent 8% 92%, rgba(255,255,255,0.3) 92% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 13%, rgba(255,255,255,0.94) 13% 16%, transparent 16% 84%, rgba(255,255,255,0.94) 84% 87%, transparent 87% 100%)",
    outerGlow: "0 0 18px rgba(220,5,45,0.3), 0 0 28px rgba(255,255,255,0.14)",
    pattern: "bavarian-diamonds",
  },
  "profile-border-rotating-besiktas": {
    animation: "subtle-glow",
    baseGradient: "linear-gradient(90deg, #0a0a0a 0 43%, #f2f2f2 43% 57%, #101010 57% 100%)",
    cornerAccents:
      "linear-gradient(135deg, rgba(255,255,255,0.92) 0 8%, transparent 8% 92%, rgba(30,30,30,0.92) 92% 100%), linear-gradient(225deg, rgba(255,255,255,0.92) 0 8%, transparent 8% 92%, rgba(30,30,30,0.92) 92% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 48%, rgba(212,24,40,0.94) 48% 50%, transparent 50% 100%)",
    outerGlow: "0 0 18px rgba(255,255,255,0.18), 0 0 28px rgba(15,15,15,0.16)",
    pattern: "industrial-brush",
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
      "radial-gradient(circle at 12% 14%, rgba(212,175,55,0.96) 0 4%, transparent 5%), radial-gradient(circle at 88% 14%, rgba(212,175,55,0.96) 0 4%, transparent 5%), radial-gradient(circle at 12% 86%, rgba(212,175,55,0.96) 0 4%, transparent 5%), radial-gradient(circle at 88% 86%, rgba(212,175,55,0.96) 0 4%, transparent 5%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 14%, rgba(212,175,55,0.9) 14% 17%, transparent 17% 83%, rgba(212,175,55,0.9) 83% 86%, transparent 86% 100%), radial-gradient(circle at center, transparent 0 52%, rgba(212,175,55,0.3) 52% 58%, transparent 58% 100%)",
    outerGlow: "0 0 18px rgba(3,70,148,0.36), 0 0 28px rgba(212,175,55,0.14)",
    pattern: "city-rings",
  },
  "profile-border-rotating-manchester-united": {
    animation: "ember-flicker",
    baseGradient: "linear-gradient(180deg, #6f0006 0%, #da020e 54%, #490004 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(246,184,0,0.92) 0 9%, transparent 9% 91%, rgba(246,184,0,0.92) 91% 100%)",
    innerStripe:
      "repeating-linear-gradient(126deg, transparent 0 12px, rgba(246,184,0,0.72) 12px 16px, rgba(255,255,255,0.1) 16px 21px, transparent 21px 35px)",
    outerGlow: "0 0 18px rgba(218,2,14,0.34), 0 0 28px rgba(246,184,0,0.2)",
    pattern: "racing-diagonals",
  },
  "profile-border-rotating-dortmund": {
    animation: "ember-flicker",
    baseGradient: "linear-gradient(180deg, #fde100 0%, #f7c600 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(17,17,17,0.18) 0 16%, transparent 16% 84%, rgba(17,17,17,0.22) 84% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 12%, rgba(17,17,17,0.88) 12% 16%, transparent 16% 84%, rgba(17,17,17,0.88) 84% 88%, transparent 88% 100%)",
    outerGlow: "0 0 18px rgba(253,225,0,0.34), 0 0 26px rgba(17,17,17,0.12)",
    pattern: "honeycomb-dots",
  },
  "profile-border-rotating-finland-nt": {
    animation: "subtle-glow",
    baseGradient: "linear-gradient(180deg, #fbfdff 0%, #eef7ff 56%, #d8efff 100%)",
    cornerAccents:
      "linear-gradient(135deg, rgba(191,231,255,0.75) 0 12%, transparent 12% 88%, rgba(89,186,255,0.22) 88% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 31%, #003580 31% 45%, transparent 45% 100%), linear-gradient(180deg, transparent 0 43%, #003580 43% 57%, transparent 57% 100%)",
    outerGlow: "0 0 18px rgba(157,225,255,0.2), 0 0 30px rgba(0,53,128,0.18)",
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
    baseGradient: "linear-gradient(180deg, #ffffff 0%, #d7ecff 52%, #005ca9 100%)",
    cornerAccents:
      "linear-gradient(135deg, transparent 0 20%, rgba(255,255,255,0.96) 20% 34%, rgba(0,92,169,0.96) 34% 52%, rgba(255,255,255,0.92) 52% 64%, rgba(0,92,169,0.82) 64% 76%, transparent 76% 100%)",
    innerStripe:
      "linear-gradient(135deg, transparent 0 24%, rgba(0,92,169,0.92) 24% 39%, rgba(255,255,255,0.96) 39% 50%, rgba(0,92,169,0.8) 50% 64%, transparent 64% 100%)",
    outerGlow: "0 0 18px rgba(0,92,169,0.28), 0 0 28px rgba(255,255,255,0.1)",
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
    baseGradient: "linear-gradient(180deg, #fffefc 0%, #f7f3ee 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(188,0,45,0.12) 0 8%, transparent 8% 92%, rgba(188,0,45,0.12) 92% 100%)",
    innerStripe:
      "radial-gradient(circle at 50% 50%, rgba(188,0,45,0.16) 0 18%, transparent 19%), linear-gradient(90deg, rgba(255,255,255,0.9) 0 6%, transparent 6% 94%, rgba(255,255,255,0.9) 94% 100%)",
    motif: "rising-sun",
    outerGlow: "0 0 16px rgba(255,248,236,0.26), 0 0 22px rgba(188,0,45,0.12)",
    pattern: "sunburst-rays",
  },
  "profile-border-rotating-juventus": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(90deg, #0f0f0f 0 48%, #f5f5f5 48% 52%, #111111 52% 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(255,255,255,0.88) 0 6%, transparent 6% 94%, rgba(255,255,255,0.88) 94% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 14%, rgba(212,175,55,0.88) 14% 16%, transparent 16% 84%, rgba(212,175,55,0.88) 84% 86%, transparent 86% 100%)",
    outerGlow: "0 0 18px rgba(255,255,255,0.18), 0 0 24px rgba(212,175,55,0.08)",
    pattern: "vertical-pinstripes",
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
    baseGradient: "linear-gradient(180deg, #5b0018 0%, #880027 42%, #a50034 70%, #4a0013 100%)",
    cornerAccents:
      "radial-gradient(circle at 12% 18%, rgba(255,196,110,0.78) 0 5%, transparent 6%), radial-gradient(circle at 88% 18%, rgba(255,196,110,0.82) 0 5%, transparent 6%), radial-gradient(circle at 18% 86%, rgba(255,184,92,0.52) 0 4%, transparent 5%), radial-gradient(circle at 82% 84%, rgba(255,184,92,0.52) 0 4%, transparent 5%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 14%, rgba(95,0,28,0.9) 14% 18%, transparent 18% 82%, rgba(95,0,28,0.9) 82% 86%, transparent 86% 100%)",
    outerGlow: "0 0 18px rgba(255,166,84,0.24), 0 0 30px rgba(165,0,52,0.22)",
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
    baseGradient: "linear-gradient(180deg, #8ae2ff 0%, #12a0d7 54%, #0b74ff 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(112,226,255,0.4) 0 9%, transparent 9% 91%, rgba(112,226,255,0.4) 91% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 13%, rgba(255,255,255,0.94) 13% 16%, transparent 16% 84%, rgba(255,255,255,0.94) 84% 87%, transparent 87% 100%)",
    outerGlow: "0 0 18px rgba(114,207,255,0.28), 0 0 30px rgba(18,160,215,0.2)",
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
    baseGradient: "linear-gradient(180deg, #ffffff 0%, #f8f8fb 58%, #ffdfe5 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(214,15,46,0.88) 0 8%, transparent 8% 92%, rgba(214,15,46,0.88) 92% 100%)",
    innerStripe:
      "repeating-linear-gradient(122deg, transparent 0 10px, rgba(214,15,46,0.94) 10px 16px, rgba(255,255,255,0.14) 16px 22px, transparent 22px 34px)",
    outerGlow: "0 0 18px rgba(255,255,255,0.18), 0 0 24px rgba(214,15,46,0.16)",
    pattern: "racing-diagonals",
  },
  "profile-border-rotating-real-madrid": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(180deg, #fffef9 0%, #faf8f2 48%, #efe7d7 100%)",
    cornerAccents:
      "radial-gradient(circle at 50% 18%, rgba(213,177,90,0.24) 0 12%, transparent 13%), radial-gradient(circle at 50% 82%, rgba(213,177,90,0.18) 0 11%, transparent 12%), linear-gradient(180deg, rgba(213,177,90,0.86) 0 8%, transparent 8% 92%, rgba(213,177,90,0.86) 92% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 13%, rgba(213,177,90,0.94) 13% 16%, transparent 16% 84%, rgba(213,177,90,0.94) 84% 87%, transparent 87% 100%)",
    outerGlow: "0 0 18px rgba(213,177,90,0.3), 0 0 28px rgba(255,255,255,0.12)",
    pattern: "city-rings",
  },
  "profile-border-rotating-barcelona": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(90deg, #6d1238 0%, #a50044 36%, #1b2b78 64%, #004d98 100%)",
    cornerAccents:
      "linear-gradient(135deg, rgba(122,18,58,0.88) 0 10%, transparent 10% 90%, rgba(0,77,152,0.88) 90% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 47%, rgba(255,195,0,0.88) 47% 53%, transparent 53% 100%)",
    outerGlow: "0 0 18px rgba(122,18,58,0.24), 0 0 30px rgba(0,77,152,0.18)",
    pattern: "vertical-pinstripes",
  },
  "profile-border-rotating-atletico-madrid": {
    animation: "flag-sheen",
    baseGradient: "linear-gradient(180deg, #0b2c62 0%, #173a74 42%, #7c1118 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(255,255,255,0.92) 0 8%, transparent 8% 92%, rgba(255,255,255,0.92) 92% 100%)",
    innerStripe:
      "repeating-linear-gradient(90deg, rgba(201,52,47,0.94) 0 14px, rgba(255,255,255,0.96) 14px 24px, rgba(201,52,47,0.94) 24px 38px, transparent 38px 42px)",
    outerGlow: "0 0 18px rgba(201,52,47,0.24), 0 0 28px rgba(255,255,255,0.12)",
    pattern: "vertical-pinstripes",
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
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(180deg, #d52b1e 0%, #bf2013 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(255,255,255,0.92) 0 10%, transparent 10% 90%, rgba(255,255,255,0.92) 90% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 40%, rgba(255,255,255,0.9) 40% 60%, transparent 60% 100%), linear-gradient(180deg, transparent 0 40%, rgba(255,255,255,0.9) 40% 60%, transparent 60% 100%)",
    motif: "swiss-cross",
    outerGlow: "0 0 18px rgba(255,255,255,0.16), 0 0 24px rgba(213,43,30,0.24)",
  },
  "profile-border-rotating-tottenham": {
    animation: "subtle-glow",
    baseGradient: "linear-gradient(180deg, #ffffff 0%, #eef3fb 56%, #0e1b4d 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(14,27,77,0.9) 0 7%, transparent 7% 93%, rgba(14,27,77,0.9) 93% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 13%, rgba(226,232,240,0.9) 13% 16%, transparent 16% 84%, rgba(226,232,240,0.9) 84% 87%, transparent 87% 100%)",
    outerGlow: "0 0 18px rgba(255,255,255,0.18), 0 0 28px rgba(14,27,77,0.12)",
    pattern: "flag-ribbon",
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
  "profile-border-rotating-galatasaray": {
    animation: "ember-flicker",
    baseGradient: "linear-gradient(135deg, #c71432 0%, #921123 42%, #f6c200 72%, #ff7a00 100%)",
    cornerAccents:
      "radial-gradient(circle at 14% 18%, rgba(255,196,0,0.9) 0 5%, transparent 6%), radial-gradient(circle at 86% 84%, rgba(255,122,0,0.8) 0 5%, transparent 6%)",
    innerStripe:
      "repeating-linear-gradient(118deg, transparent 0 14px, rgba(255,196,0,0.28) 14px 18px, rgba(255,122,0,0.22) 18px 24px, transparent 24px 40px)",
    outerGlow: "0 0 18px rgba(199,20,50,0.28), 0 0 30px rgba(246,194,0,0.22)",
    pattern: "flame-flickers",
  },
  "profile-border-rotating-fenerbahce": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(180deg, #071a42 0%, #0b2c62 58%, #f2c200 100%)",
    cornerAccents:
      "radial-gradient(circle at 20% 20%, rgba(255,242,161,0.85) 0 4%, transparent 5%), radial-gradient(circle at 80% 18%, rgba(255,242,161,0.78) 0 4%, transparent 5%), radial-gradient(circle at 50% 82%, rgba(255,242,161,0.72) 0 4%, transparent 5%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 12%, rgba(242,194,0,0.82) 12% 16%, transparent 16% 84%, rgba(242,194,0,0.82) 84% 88%, transparent 88% 100%)",
    outerGlow: "0 0 18px rgba(11,44,98,0.32), 0 0 28px rgba(242,194,0,0.18)",
    pattern: "soft-stars",
  },
  "profile-border-rotating-goztepe": {
    animation: "flag-sheen",
    baseGradient: "linear-gradient(135deg, #d8a100 0%, #f2c14f 36%, #c73a2d 68%, #a81e2a 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(168,30,42,0.76) 0 8%, transparent 8% 92%, rgba(168,30,42,0.76) 92% 100%)",
    innerStripe:
      "repeating-linear-gradient(125deg, transparent 0 12px, rgba(168,30,42,0.88) 12px 18px, rgba(242,193,79,0.86) 18px 28px, transparent 28px 40px)",
    outerGlow: "0 0 18px rgba(255,150,58,0.24), 0 0 26px rgba(168,30,42,0.16)",
    pattern: "racing-diagonals",
  },
  "profile-border-rotating-turkey-nt": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(165deg, #4c0815 0%, #7a0f20 18%, #c8102e 50%, #a50f27 76%, #32060f 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(243,244,246,0.92) 0 8%, transparent 8% 92%, rgba(243,244,246,0.92) 92% 100%), linear-gradient(180deg, rgba(255,255,255,0.18) 0 8%, transparent 8% 92%, rgba(243,244,246,0.26) 92% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 11%, rgba(255,255,255,0.92) 11% 12.5%, rgba(243,244,246,0.92) 12.5% 15%, transparent 15% 85%, rgba(243,244,246,0.92) 85% 87.5%, rgba(255,255,255,0.92) 87.5% 89%, transparent 89% 100%), linear-gradient(180deg, transparent 0 14%, rgba(243,244,246,0.12) 14% 18%, transparent 18% 82%, rgba(243,244,246,0.12) 82% 86%, transparent 86% 100%)",
    motif: "crescent-star",
    outerGlow: "0 0 18px rgba(200,16,46,0.36), 0 0 28px rgba(243,244,246,0.16)",
    pattern: "ottoman-filigree",
  },
  "profile-border-rotating-union-berlin": {
    animation: "flag-sheen",
    baseGradient: "repeating-linear-gradient(180deg, #c81e2a 0 14px, #ffffff 14px 28px)",
    cornerAccents:
      "linear-gradient(90deg, rgba(255,255,255,0.18) 0 6%, transparent 6% 94%, rgba(255,255,255,0.18) 94% 100%), linear-gradient(180deg, rgba(142,18,27,0.2) 0 8%, transparent 8% 92%, rgba(142,18,27,0.2) 92% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 12%, rgba(255,255,255,0.92) 12% 14%, transparent 14% 86%, rgba(255,255,255,0.92) 86% 88%, transparent 88% 100%), repeating-linear-gradient(180deg, rgba(255,255,255,0.08) 0 14px, transparent 14px 28px)",
    outerGlow: "0 0 18px rgba(200,30,42,0.24), 0 0 24px rgba(255,255,255,0.14)",
    pattern: "vertical-pinstripes",
  },
  "profile-border-rotating-usa-nt": {
    animation: "flag-sheen",
    baseGradient: "repeating-linear-gradient(180deg, #b22234 0 11px, #ffffff 11px 22px)",
    cornerAccents:
      "linear-gradient(180deg, #1c2b4f 0 36%, transparent 36% 100%), linear-gradient(90deg, #1c2b4f 0 38%, transparent 38% 100%), linear-gradient(90deg, rgba(255,255,255,0.16) 0 4%, transparent 4% 96%, rgba(255,255,255,0.16) 96% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 38%, rgba(255,255,255,0.22) 38% 40%, transparent 40% 100%), repeating-linear-gradient(180deg, rgba(255,255,255,0.12) 0 11px, transparent 11px 22px)",
    motif: "tiny-stars",
    outerGlow: "0 0 18px rgba(178,34,52,0.24), 0 0 24px rgba(28,43,79,0.22), 0 0 18px rgba(255,255,255,0.12)",
    pattern: "vertical-pinstripes",
  },
  "profile-border-rotating-england-nt": {
    animation: "flag-sheen",
    baseGradient: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    cornerAccents:
      "linear-gradient(90deg, transparent 0 43%, #c8102e 43% 57%, transparent 57% 100%), linear-gradient(180deg, transparent 0 43%, #c8102e 43% 57%, transparent 57% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 39%, rgba(200,16,46,0.18) 39% 61%, transparent 61% 100%), linear-gradient(180deg, transparent 0 39%, rgba(200,16,46,0.18) 39% 61%, transparent 61% 100%)",
    outerGlow: "0 0 18px rgba(200,16,46,0.18), 0 0 24px rgba(169,182,201,0.12)",
    pattern: "nordic-cross",
  },
  "profile-border-rotating-belgium-nt": {
    animation: "flag-sheen",
    baseGradient: "linear-gradient(90deg, #111111 0 33.33%, #f0c419 33.33% 66.66%, #c8102e 66.66% 100%)",
    cornerAccents:
      "linear-gradient(180deg, rgba(255,255,255,0.08) 0 8%, transparent 8% 92%, rgba(255,255,255,0.08) 92% 100%)",
    innerStripe:
      "linear-gradient(90deg, rgba(255,255,255,0.1) 0 34%, transparent 34% 66%, rgba(255,255,255,0.1) 66% 100%)",
    outerGlow: "0 0 18px rgba(240,196,25,0.24), 0 0 26px rgba(200,16,46,0.14)",
  },
  "profile-border-rotating-netherlands-nt": {
    animation: "ember-flicker",
    baseGradient: "linear-gradient(180deg, #f97316 0%, #fdba74 52%, #7c2d12 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(255,255,255,0.12) 0 10%, transparent 10% 90%, rgba(255,255,255,0.12) 90% 100%)",
    innerStripe:
      "repeating-linear-gradient(120deg, transparent 0 16px, rgba(255,255,255,0.12) 16px 20px, rgba(124,45,18,0.22) 20px 30px, transparent 30px 42px)",
    outerGlow: "0 0 18px rgba(249,115,22,0.32), 0 0 28px rgba(124,45,18,0.2)",
    pattern: "flame-flickers",
  },
  "profile-border-rotating-austria-nt": {
    animation: "flag-sheen",
    baseGradient: "linear-gradient(180deg, #c8102e 0 30%, #ffffff 30% 70%, #9d1127 70% 100%)",
    cornerAccents:
      "linear-gradient(90deg, rgba(255,255,255,0.14) 0 10%, transparent 10% 90%, rgba(255,255,255,0.14) 90% 100%)",
    innerStripe:
      "linear-gradient(180deg, transparent 0 26%, rgba(255,255,255,0.1) 26% 30%, transparent 30% 70%, rgba(157,17,39,0.12) 70% 74%, transparent 74% 100%)",
    outerGlow: "0 0 18px rgba(200,16,46,0.22), 0 0 24px rgba(255,255,255,0.12)",
  },
  "profile-border-rotating-denmark-nt": {
    animation: "flag-sheen",
    baseGradient: "linear-gradient(180deg, #b91c1c 0%, #8f1212 100%)",
    cornerAccents:
      "linear-gradient(90deg, transparent 0 28%, #ffffff 28% 40%, transparent 40% 100%), linear-gradient(180deg, transparent 0 42%, #ffffff 42% 58%, transparent 58% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 24%, rgba(255,255,255,0.16) 24% 44%, transparent 44% 100%), linear-gradient(180deg, transparent 0 38%, rgba(255,255,255,0.16) 38% 62%, transparent 62% 100%)",
    outerGlow: "0 0 18px rgba(185,28,28,0.24), 0 0 24px rgba(255,255,255,0.14)",
    pattern: "nordic-cross",
  },
  "profile-border-rotating-sweden-nt": {
    animation: "royal-shimmer",
    baseGradient: "linear-gradient(180deg, #005293 0%, #003f70 100%)",
    cornerAccents:
      "linear-gradient(90deg, transparent 0 29%, #fecb00 29% 42%, transparent 42% 100%), linear-gradient(180deg, transparent 0 42%, #fecb00 42% 57%, transparent 57% 100%)",
    innerStripe:
      "repeating-linear-gradient(135deg, transparent 0 16px, rgba(254,203,0,0.16) 16px 20px, transparent 20px 34px)",
    outerGlow: "0 0 18px rgba(0,82,147,0.28), 0 0 28px rgba(254,203,0,0.18)",
    pattern: "nordic-cross",
  },
  "profile-border-rotating-norway-nt": {
    animation: "flag-sheen",
    baseGradient: "linear-gradient(180deg, #ba0c2f 0%, #8f0923 100%)",
    cornerAccents:
      "linear-gradient(90deg, transparent 0 26%, #ffffff 26% 42%, #00205b 42% 52%, #ffffff 52% 60%, transparent 60% 100%), linear-gradient(180deg, transparent 0 40%, #ffffff 40% 58%, #00205b 58% 66%, #ffffff 66% 74%, transparent 74% 100%)",
    innerStripe:
      "linear-gradient(90deg, transparent 0 22%, rgba(255,255,255,0.14) 22% 62%, transparent 62% 100%), linear-gradient(180deg, transparent 0 36%, rgba(255,255,255,0.14) 36% 76%, transparent 76% 100%)",
    outerGlow: "0 0 18px rgba(186,12,47,0.22), 0 0 28px rgba(0,32,91,0.18)",
    pattern: "nordic-cross",
  },
  "profile-border-rotating-brazil-nt": {
    animation: "wave-drift",
    baseGradient: "linear-gradient(180deg, #009c3b 0%, #1b5e20 100%)",
    cornerAccents:
      "radial-gradient(circle at 50% 50%, rgba(255,223,0,0.88) 0 18%, transparent 19%), linear-gradient(135deg, transparent 0 35%, rgba(255,223,0,0.8) 35% 50%, transparent 50% 100%)",
    innerStripe:
      "repeating-linear-gradient(140deg, rgba(255,223,0,0.12) 0 12px, transparent 12px 30px), linear-gradient(90deg, transparent 0 36%, rgba(44,108,223,0.78) 36% 64%, transparent 64% 100%)",
    outerGlow: "0 0 18px rgba(0,156,59,0.28), 0 0 30px rgba(255,223,0,0.18)",
    pattern: "wave-ribbon",
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
