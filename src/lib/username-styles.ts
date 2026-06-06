import { getCosmeticItem, type CosmeticType } from "@/lib/cosmetics";

export type UsernameCosmeticStyle = {
  color?: string;
  textShadow?: string;
};

export type EquippedUsernameCosmeticRow = {
  user_id: string;
  item_id: string;
  item_type: CosmeticType;
  equipped: boolean | null;
};

export function getUsernameCosmeticStyleFromIds(
  colorItemId?: string | null,
  glowItemId?: string | null,
): UsernameCosmeticStyle | undefined {
  const colorItem = colorItemId ? getCosmeticItem(colorItemId) : null;
  const glowItem = glowItemId ? getCosmeticItem(glowItemId) : null;
  const style: UsernameCosmeticStyle = {
    color: colorItem?.color,
    textShadow: glowItem?.glow,
  };

  return style.color || style.textShadow ? style : undefined;
}

export function getUsernameStylesByUserId(rows: EquippedUsernameCosmeticRow[]) {
  const equippedByUser = new Map<string, Partial<Record<"username-color" | "username-glow", string>>>();

  rows.forEach((row) => {
    if (!row.equipped || (row.item_type !== "username-color" && row.item_type !== "username-glow")) {
      return;
    }

    const current = equippedByUser.get(row.user_id) ?? {};
    current[row.item_type] = row.item_id;
    equippedByUser.set(row.user_id, current);
  });

  return new Map(
    Array.from(equippedByUser.entries()).map(([userId, equipped]) => [
      userId,
      getUsernameCosmeticStyleFromIds(equipped["username-color"], equipped["username-glow"]),
    ]),
  );
}
