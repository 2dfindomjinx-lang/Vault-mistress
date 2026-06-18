export function normalizeAdminUserId(userId?: string | null) {
  return String(userId ?? "").trim().toLowerCase();
}

export function normalizeAdminUsername(username?: string | null) {
  return String(username ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
}

export function getTrustedAdminUserIds() {
  return new Set(
    (process.env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map(normalizeAdminUserId)
      .filter(Boolean),
  );
}

export function isTrustedAdminUserId(userId?: string | null) {
  const normalizedUserId = normalizeAdminUserId(userId);

  if (!normalizedUserId) {
    return false;
  }

  return getTrustedAdminUserIds().has(normalizedUserId);
}

export function getDirectCoinAdminUserIds() {
  return new Set(
    (process.env.ADMIN_DIRECT_COIN_USER_IDS ?? "")
      .split(",")
      .map(normalizeAdminUserId)
      .filter(Boolean),
  );
}

export function isDirectCoinAdminUserId(userId?: string | null) {
  const normalizedUserId = normalizeAdminUserId(userId);

  if (!normalizedUserId) {
    return false;
  }

  return getDirectCoinAdminUserIds().has(normalizedUserId);
}
