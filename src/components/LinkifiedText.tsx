import { Fragment, type ReactNode } from "react";
import { findLinks } from "@/lib/linkify";

// Turns URLs inside plain text into real anchors.
//
// NOT via dangerouslySetInnerHTML. The text this renders is admin-authored, but
// "the author is trusted" is exactly the assumption that turns one compromised
// session into stored XSS for every visitor. The string is split into segments
// and React builds the elements, so the markup can only ever be an <a> or a
// text node no matter what the body contains.
//
// Detection rules and their reasoning live in src/lib/linkify.ts.

export function LinkifiedText({ className = "", text }: { className?: string; text: string }) {
  const links = findLinks(text);

  if (links.length === 0) {
    return <span className={`whitespace-pre-line ${className}`}>{text}</span>;
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;

  links.forEach((link, index) => {
    if (link.start > cursor) {
      nodes.push(<Fragment key={`t${index}`}>{text.slice(cursor, link.start)}</Fragment>);
    }
    nodes.push(
      <a
        className="font-bold text-pink-200 underline decoration-pink-300/50 underline-offset-2 transition hover:text-white hover:decoration-white"
        href={link.href}
        key={`a${index}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        {link.text}
      </a>,
    );
    cursor = link.start + link.text.length;
  });

  if (cursor < text.length) {
    nodes.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>);
  }

  // whitespace-pre-line keeps the line breaks an admin typed into the textarea.
  return <span className={`whitespace-pre-line ${className}`}>{nodes}</span>;
}
