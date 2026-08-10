// URL detection for plain text. Pure logic, no rendering - which is what makes
// it directly testable (see scripts/linkify-check.mjs). The renderer lives in
// src/components/LinkifiedText.tsx.

// Bare domains have to work: people write "vault-mistress.vercel.app/x", not
// "https://vault-mistress.vercel.app/x". The danger is false positives on
// ordinary text, so a bare host only counts when it ends in a TLD from this
// list. That is what keeps "sound.ts", "page.tsx", "birthday-2026.sql" and
// "1.5" from turning into links, which a generic \w+\.\w{2,} pattern would.
//
// Add to this list rather than loosening the pattern.
export const KNOWN_TLDS = [
  // generic
  "com", "net", "org", "io", "co", "dev", "app", "me", "tv", "gg", "xyz",
  "link", "site", "online", "store", "shop", "live", "news", "blog", "info",
  "biz", "art", "fun", "life", "world", "space", "click", "page", "wiki",
  "cloud", "tech", "digital", "media", "social", "chat", "email", "cam",
  // country
  "tr", "uk", "de", "fr", "nl", "es", "it", "ru", "jp", "kr", "us", "ca",
  "au", "br", "in", "se", "no", "fi", "dk", "pl", "cz", "gr", "pt", "ch",
  "at", "be", "ie", "nz", "mx", "ar", "cl", "il", "ae", "sa", "za",
];

const DOMAIN_LABEL = "[a-z0-9](?:[a-z0-9-]*[a-z0-9])?";
const PATH_TAIL = "(?:/[^\\s<>\"']*)?";

// Order matters: an explicit scheme must win over the bare-host alternative so
// "https://a.com/b" is captured whole rather than starting at "a.com".
//
// Site-relative paths ("/birthday-2026") are deliberately NOT matched. They
// collide with dates and ratios - "3/4 done" - and the payoff is small when
// writing the full host works.
const URL_PATTERN = [
  "https?://[^\\s<>\"']+",
  "www\\.[^\\s<>\"']+",
  `(?:${DOMAIN_LABEL}\\.)+(?:${KNOWN_TLDS.join("|")})\\b${PATH_TAIL}`,
].join("|");

const TRAILING_PUNCTUATION = /[.,!?;:'"]+$/;

/**
 * Sentence punctuation that follows a URL belongs to the sentence, not the
 * link: "see https://x.com/foo." must not link to `foo.`.
 *
 * A closing bracket is only trimmed when it has no opener inside the match, so
 * URLs that legitimately contain brackets survive.
 */
function trimTrailing(raw: string) {
  let url = raw.replace(TRAILING_PUNCTUATION, "");

  while (/[)\]}]$/.test(url)) {
    const closing = url[url.length - 1];
    const opening = closing === ")" ? "(" : closing === "]" ? "[" : "{";
    const openCount = url.split(opening).length - 1;
    const closeCount = url.split(closing).length - 1;
    if (openCount >= closeCount) break;
    url = url.slice(0, -1).replace(TRAILING_PUNCTUATION, "");
  }

  return url;
}

function toHref(url: string) {
  // Anything matched without a scheme is a bare host - assume https. Without
  // this the URL parser rejects it and the link silently never appears, which
  // is exactly how "vault-mistress.vercel.app/birthday-2026" rendered as text.
  const candidate = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    const parsed = new URL(candidate);
    // Belt and braces: the pattern cannot produce another scheme, but this is
    // the check that actually guarantees it. A `javascript:` payload can never
    // reach an href from here.
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Rejects a match that is really the middle of a larger token.
 *
 * Two cases this exists for, both found by scripts/linkify-check.mjs:
 *   * "principessa@example.com" - the bare-host rule matches "example.com" and
 *     would link an email address to a website.
 *   * "javascript://x.com" - matches "x.com" and turns a string about another
 *     scheme into a link somewhere unrelated. Not an XSS, since the href is
 *     still https, but wrong.
 *
 * Anything that can continue an identifier, a path or a scheme disqualifies the
 * position. Opening brackets and quotes do not - "(vercel.app)" is a link.
 *
 * Checked against the source text rather than with a regex lookbehind, so there
 * is no dependency on lookbehind support.
 */
const TOKEN_CONTINUATION = /[\w@:/.\-_+%]/;

function isMidToken(text: string, index: number) {
  return index > 0 && TOKEN_CONTINUATION.test(text[index - 1]);
}

export type TextLink = {
  /** Index in the source string where the link text begins. */
  start: number;
  /** The visible text, punctuation already trimmed. */
  text: string;
  /** The resolved, scheme-qualified destination. */
  href: string;
};

export function findLinks(text: string): TextLink[] {
  const links: TextLink[] = [];
  // Built per call: a shared /g regex carries lastIndex between calls and would
  // silently skip matches on every other invocation.
  const pattern = new RegExp(URL_PATTERN, "gi");
  let match = pattern.exec(text);

  while (match !== null) {
    const url = trimTrailing(match[0]);
    const href = isMidToken(text, match.index) ? null : toHref(url);

    if (href) {
      links.push({ href, start: match.index, text: url });
    }

    match = pattern.exec(text);
  }

  return links;
}
