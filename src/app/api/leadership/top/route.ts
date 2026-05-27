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
    .select("username, tribute_total")
    .order("tribute_total", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(3);

  if (error) {
    console.error("Failed to load leadership leaderboard", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    leaders: (data ?? []).map((profile) => {
      const tributeTotal = Number(profile.tribute_total ?? 0);

      return {
        username: profile.username,
        tributeTotal,
        rankTitle: getLeadershipRank(tributeTotal).currentRank.title,
      };
    }),
  });
}
