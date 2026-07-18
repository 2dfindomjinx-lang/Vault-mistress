export type AddressTerm = "sub" | "femsub";

export const ADDRESS_TERM_VALUES: AddressTerm[] = ["sub", "femsub"];

export const DEFAULT_ADDRESS_TERM: AddressTerm = "sub";

/** Display labels for the preference UI. */
export const ADDRESS_TERM_LABELS: Record<AddressTerm, string> = {
  sub: "Sub",
  femsub: "Femsub",
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
  return DEFAULT_ADDRESS_TERM;
}

export function isAddressTerm(value: unknown): value is AddressTerm {
  return typeof value === "string" && (ADDRESS_TERM_VALUES as string[]).includes(value);
}

/** Spoken praise word in short UI copy ("Good boy" / "Good girl"). */
const ADDRESS_TERM_WORD: Record<AddressTerm, string> = {
  sub: "boy",
  femsub: "girl",
};

export function addressTermWord(term: AddressTerm | null | undefined) {
  return ADDRESS_TERM_WORD[normalizeAddressTerm(term)];
}

export function goodAddressPhrase(term: AddressTerm | null | undefined) {
  return `Good ${addressTermWord(term)}`;
}

/** Messages that only make sense for male anatomy - drop for femsub pools. */
const MALE_ANATOMY_ONLY_RE =
  /\b(balls?|ballbust(?:ing)?|testicles?|cock\s*ring|chastity\s*cage|tiny\s+dick\s+energy)\b/i;

export function isMaleAnatomyOnlyMessage(message: string) {
  return MALE_ANATOMY_ONLY_RE.test(message);
}

/**
 * Male terms that still address the user after safe rewrites have run.
 * Do not match broad words such as "man", "him", or "his": persona copy can
 * intentionally use those for a third party (for example a boss or bull).
 */
const FEMSUB_USER_DIRECTED_MALE_RE =
  /\b(?:boyfriend|husband|hubby)\b|\b(?:my|your)\s+(?:[a-z'’-]+\s+){0,3}boy\b|\b(?:good|bad|sweet|favorite|amazing|best|little|pretty|pathetic|worthless|useless|clumsy|desperate|weak|loyal|boring|lucky)\s+boys?\b|\byou(?:'re|’re|\s+are)\s+(?:not\s+)?(?:a\s+)?(?:real\s+)?man\b/i;

export function isFemsubUserDirectedMaleMessage(message: string) {
  return FEMSUB_USER_DIRECTED_MALE_RE.test(message);
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
  ["you're not a man", "you're not a woman"],
  ["you’re not a man", "you’re not a woman"],
  ["you're not a real man", "you're not a real woman"],
  ["you’re not a real man", "you’re not a real woman"],
  ["Losers with small dicks", "Losers with needy pussies"],
  ["tiny useless dick", "needy dripping pussy"],
  ["tiny useless cock", "needy dripping pussy"],
  ["That pathetic cock", "That dripping pussy"],
  ["Your dick is useless", "Your pussy is useless"],
  ["leaking paypig whose tiny cock", "leaking paypig whose dripping pussy"],
  ["my amazing boyfriend", "my amazing girlfriend"],
  ["the best boyfriend", "the best girlfriend"],
  ["best boyfriend", "best girlfriend"],
  ["boyfriend", "girlfriend"],
  ["husband", "wife"],
  ["hubby", "wifey"],
  ["beta", "bimbo"],
  ["my sweet boy", "my sweet girl"],
  ["my favorite boy", "my favorite girl"],
  ["my amazing boy", "my amazing girl"],
  ["my best boy", "my best girl"],
  ["my pretty boy", "my pretty girl"],
  ["my little boy", "my little girl"],
  ["my good boy", "my good girl"],
  ["your sweet boy", "your sweet girl"],
  ["your favorite boy", "your favorite girl"],
  ["your good boy", "your good girl"],
  ["favorite boy", "favorite girl"],
  ["sweetest boy", "sweetest girl"],
  ["sweet boy", "sweet girl"],
  ["amazing boy", "amazing girl"],
  ["best boy", "best girl"],
  ["lucky boy", "lucky girl"],
  ["pretty boys", "pretty girls"],
  ["bad boys", "bad girls"],
  ["weak boys", "weak girls"],
  ["boring boys", "boring girls"],
  ["other boys", "other girls"],
  ["better boys", "better girls"],
  ["better boy", "better girl"],
  ["clumsy boy", "clumsy girl"],
  ["desperate boy", "desperate girl"],
  ["worthless boy", "worthless girl"],
  ["useless boy", "useless girl"],
  ["pathetic boy", "pathetic girl"],
  ["loyal boy", "loyal girl"],
  ["boy who", "girl who"],
  ["boys who", "girls who"],
  ["boy in the world", "girl in the world"],
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
  ["pay his owner", "pay her owner"],
  ["keeps his maid", "keeps her maid"],
  ["disappoint his maid", "disappoint her maid"],
  ["giving everything to his Goth Mommy", "giving everything to her Goth Mommy"],
  ["useless dick", "useless wet cunt"],
  ["useless cock", "useless wet cunt"],
  ["stroke it", "touch it"],
  ["stroke", "rub"],
  ["cock", "pussy"],
  ["dick", "pussy"],
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

  return applyPhraseRewrites(message, FEMSUB_SPEECH_REPLACEMENTS);
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
    .map((message) => genderizeSpeechBubbleMessage(message, resolved))
    .filter((message) => !isFemsubUserDirectedMaleMessage(message));
}
