import { CRATE_TYPES, SAMPLE_CRATE_ITEMS } from "@/lib/crates";
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
  avatar_url?: string | null;
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
  const { data: openingRows, error: openingError } = await supabase
    .from("crate_opens")
    .select("id, user_id, crate_type, item_id, opened_at")
    .neq("crate_type", "sell")
    .neq("crate_type", "sell_all")
    .order("opened_at", { ascending: false })
    .limit(5);

  if (openingError) {
    console.error("Recent case openings lookup failed", openingError);
    return Response.json({ error: openingError.message }, { status: 500 });
  }

  const rows = (openingRows ?? []) as CaseOpeningRow[];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));

  const { data: profiles, error: profileError } = await supabase.rpc("get_public_profile_snippets", {
    p_user_ids: userIds.length > 0 ? userIds : [],
  });

  if (profileError) {
    console.error("Recent case openings profile lookup failed", profileError);
    return Response.json({ error: profileError.message }, { status: 500 });
  }

  const { data: cosmeticRows, error: cosmeticError } = await supabase.rpc("get_public_username_cosmetics", {
    p_user_ids: userIds.length > 0 ? userIds : [],
  });

  if (cosmeticError) {
    console.error("Recent case openings username cosmetic lookup failed", cosmeticError);
  }

  const profileMap = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );
  const usernameStyles = getUsernameStylesByUserId((cosmeticRows ?? []) as EquippedUsernameCosmeticRow[]);

  return Response.json({
    openings: rows.map((row) => {
      const profile = profileMap.get(row.user_id);
      const itemDef = row.item_id ? SAMPLE_CRATE_ITEMS[row.item_id] : null;
      const crateDef = CRATE_TYPES[row.crate_type];

      return {
        id: row.id,
        username: profile?.username ?? "@unknown",
        avatarUrl: profile?.avatar_url ?? null,
        crateName: crateDef?.name ?? row.crate_type,
        itemName: itemDef?.name ?? row.item_id ?? "Unknown item",
        itemRarity: itemDef?.rarity ?? "unknown",
        openedAt: row.opened_at,
        usernameStyle: usernameStyles.get(row.user_id),
      };
    }),
  });
}
