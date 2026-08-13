import { createHash } from "node:crypto";

/**
 * A stable, non-identifying key for rate-limiting anonymous requests.
 *
 * Only `x-forwarded-for` is consulted, and only its LAST entry.
 *
 * The headers this replaces - `cf-connecting-ip` and `x-real-ip` - are plain
 * request headers. Unless something in front of the app overwrites them on
 * every request (Cloudflare does for its own header; this project does not sit
 * behind it), a caller can simply send whatever value it likes and land in a
 * fresh rate-limit bucket on each request, which makes the limit decorative.
 *
 * `x-forwarded-for` has the same weakness at the FRONT of the list: a proxy
 * appends the address it saw to whatever the client already sent, so a request
 * carrying `X-Forwarded-For: 1.2.3.4` arrives as `1.2.3.4, <real address>`.
 * The last entry is the one written by the hop closest to us, so that is the
 * only part worth reading.
 *
 * Anyone genuinely determined can still rotate real addresses; the point is to
 * stop a single client from trivially bypassing the limit with a header.
 */
export function requestFingerprint(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const hops = forwardedFor
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const address = hops.length > 0 ? hops[hops.length - 1] : "unknown";

  // Hashed so rate-limit keys never carry a raw address around.
  return createHash("sha256").update(address).digest("hex").slice(0, 24);
}
