import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

const LEADERBOARD_LIMIT = 10;

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(
      `Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`,
      500,
    );
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, pet_score, created_at")
    .eq("hide_from_leaderboard", false)
    .eq("is_admin", false)
    .gt("pet_score", 0)
    .order("pet_score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(LEADERBOARD_LIMIT);

  if (error) {
    console.error("[pet-score-leaderboard] profile lookup failed", error);
    return jsonError(error.message, 500);
  }

  return Response.json({
    leaders: (data ?? []).map((profile, index) => ({
      displayName: profile.display_name ?? null,
      petScore: Number(profile.pet_score ?? 0),
      rank: index + 1,
      userId: String(profile.id),
      username: profile.username.startsWith("@") ? profile.username : `@${profile.username}`,
    })),
  });
}
