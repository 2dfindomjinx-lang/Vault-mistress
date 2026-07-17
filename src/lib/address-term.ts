export type AddressTerm = "sub" | "femsub" | "neutral";

export const ADDRESS_TERM_VALUES: AddressTerm[] = ["sub", "femsub", "neutral"];

export const DEFAULT_ADDRESS_TERM: AddressTerm = "sub";

/** Display labels for the preference UI. */
export const ADDRESS_TERM_LABELS: Record<AddressTerm, string> = {
  sub: "Sub",
  femsub: "Femsub",
  neutral: "Neutral",
};

/**
 * Normalize stored / client values. Accepts legacy "boy" / "girl" so existing
 * profiles keep working until SQL migration runs.
 */
export function normalizeAddressTerm(value: unknown): AddressTerm {
  if (value === "sub" || value === "boy") {
    return "sub";
  }
  if (value === "femsub" || value === "girl") {
    return "femsub";
  }
  if (value === "neutral") {
    return "neutral";
  }
  return DEFAULT_ADDRESS_TERM;
}

export function isAddressTerm(value: unknown): value is AddressTerm {
  return typeof value === "string" && (ADDRESS_TERM_VALUES as string[]).includes(value);
}

/** Spoken praise word in short UI copy ("Good boy" / "Good girl" / "Good pet"). */
const ADDRESS_TERM_WORD: Record<AddressTerm, string> = {
  sub: "boy",
  femsub: "girl",
  neutral: "pet",
};

export function addressTermWord(term: AddressTerm | null | undefined) {
  return ADDRESS_TERM_WORD[normalizeAddressTerm(term)];
}

export function goodAddressPhrase(term: AddressTerm | null | undefined) {
  return `Good ${addressTermWord(term)}`;
}

/** Messages that only make sense for male anatomy - drop for femsub/neutral pools. */
const MALE_ANATOMY_ONLY_RE =
  /\b(balls?|ballbust(?:ing)?|testicles?|cock\s*ring|chastity\s*cage|tiny\s+dick\s+energy)\b/i;

export function isMaleAnatomyOnlyMessage(message: string) {
  return MALE_ANATOMY_ONLY_RE.test(message);
}

/** Case-preserving phrase rewrite: keeps the matched text's capitalization shape. */
function rewritePhrase(source: string, from: string, to: string) {
  const pattern = new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  return source.replace(pattern, (match) => {
    if (match === match.toUpperCase() && match.length > 1) {
      return to.toUpperCase();
    }
    if (match[0] === match[0].toUpperCase()) {
      return to.charAt(0).toUpperCase() + to.slice(1);
    }
    return to;
  });
}

const FEMSUB_SPEECH_REPLACEMENTS: Array<[string, string]> = [
  ["Who's my good boy", "Who's my good girl"],
  ["I love ruining boys", "I love ruining girls"],
  ["breaking good boys", "breaking good girls"],
  ["Losers with small dicks", "Losers with needy pussies"],
  ["tiny useless dick", "needy dripping pussy"],
  ["tiny useless cock", "needy dripping pussy"],
  ["That pathetic cock", "That dripping pussy"],
  ["Your dick is useless", "Your pussy is useless"],
  ["leaking paypig whose tiny cock", "leaking paypig whose dripping pussy"],
  ["my good boy", "my good girl"],
  ["a good boy", "a good girl"],
  ["the good boy", "the good girl"],
  ["good boys", "good girls"],
  ["good boy", "good girl"],
  ["boys like you", "girls like you"],
  ["Pathetic boys", "Pathetic girls"],
  ["pathetic boys", "pathetic girls"],
  ["ruining boys", "ruining girls"],
  ["small dicks", "needy pussies"],
  ["small dick", "needy pussy"],
  ["tiny dick", "needy clit"],
  ["tiny cock", "needy clit"],
  ["Your dick", "Your pussy"],
  ["your dick", "your pussy"],
  ["my dick", "my pussy"],
  ["useless dick", "useless wet cunt"],
  ["useless cock", "useless wet cunt"],
  ["stroke it", "touch it"],
  ["stroke", "rub"],
  ["cock", "pussy"],
  ["dick", "pussy"],
];

const NEUTRAL_SPEECH_REPLACEMENTS: Array<[string, string]> = [
  ["Who's my good boy", "Who's my good pet"],
  ["I love ruining boys", "I love ruining pets"],
  ["breaking good boys", "breaking good pets"],
  ["Losers with small dicks", "Losers with useless bodies"],
  ["tiny useless dick", "needy denied body"],
  ["tiny useless cock", "needy denied body"],
  ["That pathetic cock", "That pathetic body"],
  ["Your dick is useless", "Your body is useless"],
  ["my good boy", "my good pet"],
  ["a good boy", "a good pet"],
  ["the good boy", "the good pet"],
  ["good boys", "good pets"],
  ["good boy", "good pet"],
  ["boys like you", "pets like you"],
  ["Pathetic boys", "Pathetic pets"],
  ["pathetic boys", "pathetic pets"],
  ["ruining boys", "ruining pets"],
  ["small dicks", "needy bodies"],
  ["small dick", "needy body"],
  ["tiny dick", "needy body"],
  ["tiny cock", "needy body"],
  ["Your dick", "Your body"],
  ["your dick", "your body"],
  ["my dick", "my body"],
  ["useless dick", "useless body"],
  ["useless cock", "useless body"],
  ["cock", "body"],
  ["dick", "body"],
];

function applyPhraseRewrites(message: string, pairs: Array<[string, string]>) {
  return pairs.reduce((text, [from, to]) => rewritePhrase(text, from, to), message);
}

/**
 * Rewrite persona speech for the user's preferred address term.
 * Male anatomy-only lines should be filtered before calling this for non-sub terms.
 */
export function genderizeSpeechBubbleMessage(
  message: string,
  term: AddressTerm | null | undefined,
) {
  const resolved = normalizeAddressTerm(term);

  if (resolved === "sub") {
    return message;
  }

  if (resolved === "femsub") {
    return applyPhraseRewrites(message, FEMSUB_SPEECH_REPLACEMENTS);
  }

  return applyPhraseRewrites(message, NEUTRAL_SPEECH_REPLACEMENTS);
}

export function adaptSpeechBubbleMessages(
  messages: string[] | undefined,
  term: AddressTerm | null | undefined,
) {
  const resolved = normalizeAddressTerm(term);
  const source = messages ?? [];

  if (resolved === "sub") {
    return source;
  }

  return source
    .filter((message) => !isMaleAnatomyOnlyMessage(message))
    .map((message) => genderizeSpeechBubbleMessage(message, resolved));
}
