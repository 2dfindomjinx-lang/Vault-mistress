import { createCourtSealToken } from "@/lib/court-seal";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  if (!isSupabaseAdminConfigured) return Response.json({ error: "Supabase is not configured." }, { status: 500 });
  const auth = await createSupabaseServerClient();
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const { data: ranking, error: rankingError } = await supabase.rpc("get_devotion_leaderboard", {
    p_limit: 1,
    p_period: "all_time",
    p_viewer_id: data.user.id,
  });
  if (rankingError) return Response.json({ error: rankingError.message }, { status: 500 });
  const viewer = (ranking ?? []).find((row: { row_type?: string; user_id?: string }) => row.row_type === "viewer" && row.user_id === data.user.id) as { rank?: number | string } | undefined;
  const { data: profile, error: profileError } = await supabase.from("profiles").select("loyalty_streak").eq("id", data.user.id).single();
  if (profileError || !profile) return Response.json({ error: profileError?.message ?? "Profile not found." }, { status: 404 });

  try {
    const token = createCourtSealToken({
      board: "devotion",
      rank: viewer?.rank ? Number(viewer.rank) : undefined,
      streak: Number(profile.loyalty_streak ?? 0),
      createdAt: Date.now(),
    });
    return Response.json({ url: `/s/${token}` });
  } catch (sealError) {
    return Response.json({ error: sealError instanceof Error ? sealError.message : "Court Seal is unavailable." }, { status: 503 });
  }
}

