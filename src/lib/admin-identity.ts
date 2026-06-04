const TRUSTED_ADMIN_USERNAMES = new Set(["@principessa2dfd"]);

export function isTrustedAdminUsername(username?: string | null) {
  return TRUSTED_ADMIN_USERNAMES.has(String(username ?? "").toLowerCase());
}
