export function getDisplayNameOrUsername(
  displayName: string | null | undefined,
  username: string,
) {
  const trimmed = displayName?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }

  return username.startsWith("@") ? username : `@${username}`;
}

export function getDisplayNameOrUsernamePlain(
  displayName: string | null | undefined,
  username: string,
) {
  const trimmed = displayName?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }

  return username.trim();
}
