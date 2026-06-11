import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("ensure_global_principessa_current_month");

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
    progress: data,
  });
}
