const DEFAULT_TRUSTED_ADMIN_USERNAMES = ["@vmprincipessa"];

export function normalizeAdminUsername(username?: string | null) {
  return String(username ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
}

export function getTrustedAdminUsernames() {
  const configured = process.env.ADMIN_USERNAMES?.split(",") ?? DEFAULT_TRUSTED_ADMIN_USERNAMES;
  return new Set(configured.map(normalizeAdminUsername).filter(Boolean));
}

export function isTrustedAdminUsername(username?: string | null) {
  return getTrustedAdminUsernames().has(normalizeAdminUsername(username));
}
