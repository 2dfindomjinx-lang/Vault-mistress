import { getLeadershipRank } from "@/lib/leadership";
import {
  createPublicSupabaseClient,
  getSupabasePublicConfigErrors,
  isSupabasePublicConfigured,
} from "@/lib/supabase/public";
import { getUsernameStylesByUserId, type EquippedUsernameCosmeticRow } from "@/lib/username-styles";

export async function GET() {
  if (!isSupabasePublicConfigured) {
    const configErrors = getSupabasePublicConfigErrors();
    console.error("Leadership leaderboard route is not configured", configErrors);
    return Response.json(
      {
        error: `Leadership leaderboard is not configured: ${configErrors.join(", ")}`,
      },
      { status: 500 },
    );
  }

  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("get_public_leaderboard", { p_limit: 3 });

  if (error) {
    console.error("Failed to load leadership leaderboard", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const leaders = (data ?? []) as Array<{
    id: string;
    username: string;
    tribute_total: number;
    created_at: string;
  }>;
  const userIds = leaders.map((profile) => String(profile.id)).filter(Boolean);
  const { data: cosmeticRows, error: cosmeticError } = await supabase.rpc("get_public_username_cosmetics", {
    p_user_ids: userIds.length > 0 ? userIds : [],
  });

  if (cosmeticError) {
    console.error("Leadership username cosmetic lookup failed", cosmeticError);
  }

  const usernameStyles = getUsernameStylesByUserId((cosmeticRows ?? []) as EquippedUsernameCosmeticRow[]);

  return Response.json({
    leaders: leaders
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
