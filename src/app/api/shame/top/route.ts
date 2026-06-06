import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { getUsernameStylesByUserId, type EquippedUsernameCosmeticRow } from "@/lib/username-styles";

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    const configErrors = getSupabaseAdminConfigErrors();
    console.error("Public shame board route is not configured", configErrors);
    return Response.json(
      { error: `Public shame board is not configured: ${configErrors.join(", ")}` },
      { status: 500 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, shame_count")
    .gt("shame_count", 0)
    .order("shame_count", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(3);

  if (error) {
    console.error("Failed to load public shame board", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const userIds = (data ?? []).map((profile) => String(profile.id)).filter(Boolean);
  const { data: cosmeticRows, error: cosmeticError } = await supabase
    .from("user_cosmetics")
    .select("user_id, item_id, item_type, equipped")
    .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("equipped", true)
    .in("item_type", ["username-color", "username-glow"]);

  if (cosmeticError) {
    console.error("Public shame board username cosmetic lookup failed", cosmeticError);
  }

  const usernameStyles = getUsernameStylesByUserId((cosmeticRows ?? []) as EquippedUsernameCosmeticRow[]);

  return Response.json({
    shame: (data ?? []).map((profile) => ({
      shameCount: Number(profile.shame_count ?? 0),
      username: profile.username,
      usernameStyle: usernameStyles.get(String(profile.id)),
    })),
  });
}
