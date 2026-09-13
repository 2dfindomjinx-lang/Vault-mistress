import {
  createPublicSupabaseClient,
  getSupabasePublicConfigErrors,
  isSupabasePublicConfigured,
} from "@/lib/supabase/public";
import { getDisplayNameOrUsername } from "@/lib/display-name";
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
  // Home shows a Top 5. The RPC already clamps to 10, so no migration needed.
  const { data, error } = await supabase.rpc("get_public_shame_board", { p_limit: 5 });

  if (error) {
    console.error("Failed to load public shame board", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const profiles = (data ?? []) as Array<{
    id: string;
    username: string;
    display_name?: string | null;
    shame_count: number;
  }>;
  const userIds = profiles.map((profile) => String(profile.id)).filter(Boolean);
  const [{ data: cosmeticRows, error: cosmeticError }, avatarResult] = await Promise.all([
    supabase.rpc("get_public_username_cosmetics", { p_user_ids: userIds }),
    supabase.rpc("get_public_profile_snippets", { p_user_ids: userIds }),
  ]);
  if (avatarResult.error) {
    console.error("Leaderboard avatar lookup failed", avatarResult.error);
  }
  const avatarById = new Map(
    ((avatarResult.data ?? []) as Array<{ id: string; avatar_url: string | null }>)
      .map((profile) => [profile.id, profile.avatar_url]),
  );

  if (cosmeticError) {
    console.error("Public shame board username cosmetic lookup failed", cosmeticError);
  }

  const usernameStyles = getUsernameStylesByUserId((cosmeticRows ?? []) as EquippedUsernameCosmeticRow[]);

  return Response.json(
    {
      shame: profiles.map((profile) => ({
        avatarUrl: avatarById.get(String(profile.id)) ?? null,
        shameCount: Number(profile.shame_count ?? 0),
        username: getDisplayNameOrUsername(profile.display_name ?? null, profile.username),
        rawUsername: profile.username,
        displayName: profile.display_name ?? null,
        display_name: profile.display_name ?? null,
        usernameStyle: usernameStyles.get(String(profile.id)),
      })),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    },
  );
}
