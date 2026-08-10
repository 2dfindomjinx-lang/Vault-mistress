import { Fragment, type ReactNode } from "react";

// Turns URLs inside plain text into real anchors.
//
// NOT via dangerouslySetInnerHTML. The text this renders is admin-authored, but
// "the author is trusted" is exactly the assumption that turns one compromised
// session into stored XSS for every visitor. The string is split into segments
// and React builds the elements, so the markup can only ever be an <a> or a
// text node no matter what the body contains.
//
// Only http and https are matched, and every candidate is re-validated through
// the URL parser before it becomes a link - a `javascript:` payload cannot
// reach an href from here.

// Matches an explicit http(s) URL, or a bare www. host. Deliberately does NOT
// match bare domains ("vault-mistress.com") or paths ("/birthday"): both
// false-positive constantly on ordinary prose - dates, ratios, "3/4 done".
const URL_PATTERN = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

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
  const candidate = url.toLowerCase().startsWith("www.") ? `https://${url}` : url;
  try {
    const parsed = new URL(candidate);
    // Belt and braces: the pattern cannot produce another scheme, but this is
    // the check that actually guarantees it.
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function LinkifiedText({ className = "", text }: { className?: string; text: string }) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  // Fresh regex state per render - a module-level /g regex carries lastIndex
  // between calls and would silently skip matches on every other render.
  const pattern = new RegExp(URL_PATTERN.source, "gi");
  let match = pattern.exec(text);

  while (match !== null) {
    const raw = match[0];
    const url = trimTrailing(raw);
    const href = toHref(url);

    if (href) {
      if (match.index > lastIndex) {
        nodes.push(<Fragment key={`t${key++}`}>{text.slice(lastIndex, match.index)}</Fragment>);
      }
      nodes.push(
        <a
          className="font-bold text-pink-200 underline decoration-pink-300/50 underline-offset-2 transition hover:text-white hover:decoration-white"
          href={href}
          key={`a${key++}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          {url}
        </a>,
      );
      lastIndex = match.index + url.length;
    }

    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(<Fragment key={`t${key++}`}>{text.slice(lastIndex)}</Fragment>);
  }

  // whitespace-pre-line keeps the line breaks an admin typed into the textarea.
  return <span className={`whitespace-pre-line ${className}`}>{nodes}</span>;
}
