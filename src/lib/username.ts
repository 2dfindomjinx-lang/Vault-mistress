// profiles.username is stored WITH its leading @ (see profile-bootstrap), but
// nothing in the type system says so, and a handle read from a mention, a
// command argument or a Throne message arrives without one. Every display site
// therefore has to normalise before printing, and the ones that forgot printed
// "@@andreww_170".
//
// Two helpers rather than one, because the two directions are genuinely
// different jobs: formatHandle produces something to show a person, and
// stripHandle produces something to compare or interpolate into a URL.
export function formatHandle(username: string | null | undefined, fallback = "unknown") {
  const bare = stripHandle(username);
  return `@${bare || fallback}`;
}

export function stripHandle(username: string | null | undefined) {
  return String(username ?? "").trim().replace(/^@+/, "");
}
