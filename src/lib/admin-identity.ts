const TRUSTED_ADMIN_USERNAMES = new Set(["@vmprincipessa"]);

export function isTrustedAdminUsername(username?: string | null) {
  return TRUSTED_ADMIN_USERNAMES.has(String(username ?? "").toLowerCase());
}
