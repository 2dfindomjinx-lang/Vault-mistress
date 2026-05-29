import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { getLeadershipRank } from "@/lib/leadership";

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
  .select("username, tribute_total, created_at")
  .eq("hide_from_leaderboard", false)
  .limit(100);

  if (error) {
    console.error("Failed to load leadership leaderboard", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    leaders: (data ?? [])
      .map((profile) => {
        const tributeTotal = Number(profile.tribute_total ?? 0);

        return {
          createdAt: String(profile.created_at ?? ""),
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
      })),
  });
}
