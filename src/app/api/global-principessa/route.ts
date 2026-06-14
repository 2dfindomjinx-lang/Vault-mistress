import {
  createPublicSupabaseClient,
  getSupabasePublicConfigErrors,
  isSupabasePublicConfigured,
} from "@/lib/supabase/public";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET() {
  if (!isSupabasePublicConfigured) {
    return jsonError(`Supabase public environment is not configured: ${getSupabasePublicConfigErrors().join(", ")}`, 500);
  }

  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase
    .from("global_principessa_progress")
    .select("id, month, year, level, xp, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Global Principessa progress lookup failed", { code: error.code, message: error.message });
    return jsonError("Global Principessa progress lookup failed.", 500);
  }

  const { data: latestLevelUp, error: levelUpError } = await supabase
    .from("global_principessa_xp_events")
    .select("id, created_at, new_global_level, xp_amount")
    .eq("event_type", "level_up")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (levelUpError) {
    console.error("Global Principessa level-up lookup failed", {
      code: levelUpError.code,
      message: levelUpError.message,
    });
  }

  return Response.json({
    latestLevelUp: latestLevelUp ?? null,
    progress: data ?? null,
  });
}
