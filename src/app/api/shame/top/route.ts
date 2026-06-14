import {
  createPublicSupabaseClient,
  getSupabasePublicConfigErrors,
  isSupabasePublicConfigured,
} from "@/lib/supabase/public";
import { getUsernameStylesByUserId, type EquippedUsernameCosmeticRow } from "@/lib/username-styles";

export async function GET() {
  if (!isSupabasePublicConfigured) {
    const configErrors = getSupabasePublicConfigErrors();
    console.error("Public shame board route is not configured", configErrors);
    return Response.json(
      { error: `Public shame board is not configured: ${configErrors.join(", ")}` },
      { status: 500 },
    );
  }

  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("get_public_shame_board", { p_limit: 3 });

  if (error) {
    console.error("Failed to load public shame board", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const profiles = (data ?? []) as Array<{
    id: string;
    username: string;
    shame_count: number;
  }>;
  const userIds = profiles.map((profile) => String(profile.id)).filter(Boolean);
  const { data: cosmeticRows, error: cosmeticError } = await supabase.rpc("get_public_username_cosmetics", {
    p_user_ids: userIds.length > 0 ? userIds : [],
  });

  if (cosmeticError) {
    console.error("Public shame board username cosmetic lookup failed", cosmeticError);
  }

  const usernameStyles = getUsernameStylesByUserId((cosmeticRows ?? []) as EquippedUsernameCosmeticRow[]);

  return Response.json({
    shame: profiles.map((profile) => ({
      shameCount: Number(profile.shame_count ?? 0),
      username: profile.username,
      usernameStyle: usernameStyles.get(String(profile.id)),
    })),
  });
}
