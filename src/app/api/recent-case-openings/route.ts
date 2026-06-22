import {
  CRATE_TYPES,
  SAMPLE_CRATE_ITEMS,
  getCrateIconUrl,
  getCrateItemDropChancePercent,
  getCrateItemImageUrl,
  getCrateItemSellValue,
} from "@/lib/crates";
import { getDisplayNameOrUsername } from "@/lib/display-name";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { getUsernameStylesByUserId, type EquippedUsernameCosmeticRow } from "@/lib/username-styles";

type CaseOpeningRow = {
  id: string;
  user_id: string;
  crate_type: string;
  item_id: string | null;
  opened_at: string;
};

type ProfileRow = {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

type CaseOpener = {
  id: string;
  username: string;
  rawUsername: string;
  displayName: string | null;
  avatarUrl: string | null;
  usernameStyle?: { color?: string; textShadow?: string };
  lastOpenedAt: string;
  totalOpens: number;
  totalCoinsWon: number;
  recentOpenings: Array<{
    id: string;
    crateName: string;
    crateIconUrl: string | null;
    itemId: string;
    itemName: string;
    itemRarity: string;
    itemChancePercent: number | null;
    itemSellValue: number | null;
    itemImageUrl: string | null;
    openedAt: string;
  }>;
};

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    const configErrors = getSupabaseAdminConfigErrors();
    console.error("Recent case openings route is not configured", configErrors);
    return Response.json(
      { error: `Recent case openings are not configured: ${configErrors.join(", ")}` },
      { status: 500 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: openingRows, error: openingError } = await supabase
    .from("crate_opens")
    .select("id, user_id, crate_type, item_id, opened_at")
    .gte("opened_at", since)
    .order("opened_at", { ascending: false })
    .limit(500);

  if (openingError) {
    console.error("Recent case openings lookup failed", openingError);
    return Response.json({ error: openingError.message }, { status: 500 });
  }

  const rows = ((openingRows ?? []) as CaseOpeningRow[]).filter((row) => {
    return Object.prototype.hasOwnProperty.call(CRATE_TYPES, row.crate_type) && Boolean(row.item_id);
  });
  const groupedRows = new Map<string, CaseOpeningRow[]>();
  for (const row of rows) {
    const current = groupedRows.get(row.user_id) ?? [];
    current.push(row);
    groupedRows.set(row.user_id, current);
  }

  const openerUserIds = Array.from(groupedRows.keys());

  const { data: profiles, error: profileError } = await supabase.rpc("get_public_profile_snippets", {
    p_user_ids: openerUserIds.length > 0 ? openerUserIds : [],
  });

  if (profileError) {
    console.error("Recent case openings profile lookup failed", profileError);
    return Response.json({ error: profileError.message }, { status: 500 });
  }

  const { data: cosmeticRows, error: cosmeticError } = await supabase.rpc("get_public_username_cosmetics", {
    p_user_ids: openerUserIds.length > 0 ? openerUserIds : [],
  });

  if (cosmeticError) {
    console.error("Recent case openings username cosmetic lookup failed", cosmeticError);
  }

  const profileMap = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );
  const usernameStyles = getUsernameStylesByUserId((cosmeticRows ?? []) as EquippedUsernameCosmeticRow[]);

  const openers: CaseOpener[] = openerUserIds
    .map((userId) => {
      const userRows = groupedRows.get(userId) ?? [];
      const profile = profileMap.get(userId);
      const totalCoinsWon = userRows.reduce((sum, row) => {
        const itemId = row.item_id;
        if (!itemId) {
          return sum;
        }

        return sum + (getCrateItemSellValue(itemId) ?? 0);
      }, 0);
      const recentOpenings = userRows.slice(0, 5).map((row) => {
        const itemDef = row.item_id ? SAMPLE_CRATE_ITEMS[row.item_id] : null;
        const crateDef = CRATE_TYPES[row.crate_type];
        const itemImageUrl = row.item_id ? getCrateItemImageUrl(row.item_id, itemDef?.image_url ?? null) : null;

        return {
          id: row.id,
          crateName: crateDef?.name ?? row.crate_type,
          crateIconUrl: getCrateIconUrl(row.crate_type, crateDef?.icon_url ?? null),
          itemId: row.item_id ?? "unknown",
          itemName: itemDef?.name ?? row.item_id ?? "Unknown item",
          itemRarity: itemDef?.rarity ?? "unknown",
          itemChancePercent: row.item_id ? getCrateItemDropChancePercent(row.crate_type, row.item_id) : null,
          itemSellValue: row.item_id ? getCrateItemSellValue(row.item_id) : null,
          itemImageUrl,
          openedAt: row.opened_at,
        };
      });

      return {
        id: userId,
        username: getDisplayNameOrUsername(profile?.display_name ?? null, profile?.username ?? "unknown"),
        rawUsername: profile?.username ?? "unknown",
        displayName: profile?.display_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        usernameStyle: usernameStyles.get(userId),
        lastOpenedAt: userRows[0]?.opened_at ?? "",
        recentOpenings,
        totalOpens: userRows.length,
        totalCoinsWon,
      };
    })
    .sort((a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime());

  return Response.json(
    { openers },
    {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
      },
    },
  );
}
