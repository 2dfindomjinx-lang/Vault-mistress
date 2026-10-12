import {
  createPublicSupabaseClient,
  getSupabasePublicConfigErrors,
  isSupabasePublicConfigured,
} from "@/lib/supabase/public";

export async function GET() {
  if (!isSupabasePublicConfigured) {
    return Response.json(
      { error: `Tribute goal is not configured: ${getSupabasePublicConfigErrors().join(", ")}` },
      { status: 500 },
    );
  }

  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("get_public_tribute_goal");

  if (error) {
    console.error("Tribute goal lookup failed", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { goal_floor_usd?: number | string | null; goal_usd: number | string; raised_usd: number | string }
    | undefined;

  if (!row) {
    return Response.json({ goalFloorUsd: 0, goalUsd: 0, raisedUsd: 0 }, { headers: { "Cache-Control": "no-store" } });
  }

  return Response.json(
    { goalFloorUsd: Number(row.goal_floor_usd ?? 0), goalUsd: Number(row.goal_usd ?? 0), raisedUsd: Number(row.raised_usd ?? 0) },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
