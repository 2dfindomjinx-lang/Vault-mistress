import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { getLeadershipRank } from "@/lib/leadership";
import { getUsernameStylesByUserId, type EquippedUsernameCosmeticRow } from "@/lib/username-styles";

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    const configErrors = getSupabaseAdminConfigErrors();
    console.error("Leadership leaderboard route is not configured", configErrors);
    return Response.json(
      {
        error: `Leadership leaderboard is not configured: ${configErrors.join(", ")}`,
      },
      { status: 500 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
  .from("profiles")
  .select("id, username, tribute_total, created_at")
  .eq("hide_from_leaderboard", false)
  .order("tribute_total", { ascending: false })
  .order("created_at", { ascending: true })
  .limit(3);

  if (error) {
    console.error("Failed to load leadership leaderboard", error);
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
    console.error("Leadership username cosmetic lookup failed", cosmeticError);
  }

  const usernameStyles = getUsernameStylesByUserId((cosmeticRows ?? []) as EquippedUsernameCosmeticRow[]);

  return Response.json({
    leaders: (data ?? [])
      .map((profile) => {
        const tributeTotal = Number(profile.tribute_total ?? 0);

        return {
          createdAt: String(profile.created_at ?? ""),
          id: String(profile.id),
          rankTitle: getLeadershipRank(tributeTotal).currentRank.title,
          tributeTotal,
          username: profile.username,
        };
      })
      .sort((first, second) => {
        if (second.tributeTotal !== first.tributeTotal) {
          return second.tributeTotal - first.tributeTotal;
        }

        return first.createdAt.localeCompare(second.createdAt);
      })
      .slice(0, 3)
      .map((leader) => ({
        rankTitle: leader.rankTitle,
        tributeTotal: leader.tributeTotal,
        username: leader.username,
        usernameStyle: usernameStyles.get(leader.id),
      })),
  });
}
