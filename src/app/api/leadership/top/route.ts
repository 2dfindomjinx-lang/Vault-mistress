import { getLeadershipRank } from "@/lib/leadership";
import {
  createPublicSupabaseClient,
  getSupabasePublicConfigErrors,
  isSupabasePublicConfigured,
} from "@/lib/supabase/public";
import { getUsernameStylesByUserId, type EquippedUsernameCosmeticRow } from "@/lib/username-styles";
import { SAMPLE_CRATE_ITEMS } from "@/lib/crates";

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
  const { data, error } = await supabase.rpc("get_public_leaderboard", { p_limit: 5 });

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

  // Top 5 most valuable inventories (sum of quantity * sell_value from crate items)
  // Uses safe RPC (server-side calc, only public fields)
  let topInventories: Array<{ id: string; username: string; avatarUrl: string | null; value: number; usernameStyle?: any }> = [];
  let invUids: string[] = [];
  try {
    const { data: invData, error: invErr } = await supabase.rpc("get_public_top_valuable_inventories", { p_limit: 5 });
    if (invErr) {
      console.error("Failed to load top valuable inventories via RPC", invErr);
    } else if (invData) {
      invUids = (invData as any[]).map((r: any) => r.user_id);
      const { data: invProfData, error: invProfErr } = await supabase.rpc("get_public_profile_snippets", {
        p_user_ids: invUids.length > 0 ? invUids : [],
      });
      if (invProfErr) {
        console.error("Failed to load profiles for top inventories", invProfErr);
      }
      const invProfMap = new Map((invProfData ?? []).map((p: any) => [p.id, p]));
      topInventories = (invData as any[]).map((row: any) => ({
        id: row.user_id,
        username: (invProfMap.get(row.user_id) as any)?.username || "Unknown",
        avatarUrl: (invProfMap.get(row.user_id) as any)?.avatar_url || null,
        value: Number(row.value ?? 0),
        usernameStyle: undefined,
      }));
    }
  } catch (e) {
    console.error("Top valuable inventories computation error", e);
  }

  const allCosUserIds = Array.from(new Set([...userIds, ...invUids]));
  const { data: cosmeticRows, error: cosmeticError } = await supabase.rpc("get_public_username_cosmetics", {
    p_user_ids: allCosUserIds.length > 0 ? allCosUserIds : [],
  });

  if (cosmeticError) {
    console.error("Leadership username cosmetic lookup failed", cosmeticError);
  }

  const usernameStyles = getUsernameStylesByUserId((cosmeticRows ?? []) as EquippedUsernameCosmeticRow[]);

  // Enrich topInventories with styles (computed after fetch)
  topInventories = topInventories.map((ti, idx) => {
    const uid = invUids[idx] || "";
    return {
      ...ti,
      usernameStyle: usernameStyles.get(uid),
    };
  });

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
      .slice(0, 5)
      .map((leader) => ({
        rankTitle: leader.rankTitle,
        tributeTotal: leader.tributeTotal,
        username: leader.username,
        usernameStyle: usernameStyles.get(leader.id),
      })),
    topInventories,
  });
}
