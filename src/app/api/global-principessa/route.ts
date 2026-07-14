import {
  createPublicSupabaseClient,
  getSupabasePublicConfigErrors,
  isSupabasePublicConfigured,
} from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function getGmt3MonthBounds(year: number, month: number) {
  const safeMonth = Math.min(12, Math.max(1, Math.floor(month)));
  const safeYear = Math.max(1970, Math.floor(year));
  const start = new Date(Date.UTC(safeYear, safeMonth - 1, 1, 0, 0, 0, 0) - 3 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(safeYear, safeMonth, 1, 0, 0, 0, 0) - 3 * 60 * 60 * 1000);

  return { end, start };
}

export async function GET() {
  if (!isSupabasePublicConfigured) {
    return jsonError(`Supabase public environment is not configured: ${getSupabasePublicConfigErrors().join(", ")}`, 500);
  }

  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("ensure_global_principessa_current_month");

  if (error) {
    console.error("Global Principessa monthly reset failed", { code: error.code, message: error.message });
    return jsonError("Global Principessa monthly reset failed.", 500);
  }

  const progress = data && typeof data === "object" && !Array.isArray(data)
    ? data as { id?: string | boolean; level: number; month: number; updated_at?: string | null; xp: number; year: number }
    : null;

  const currentPeriod = progress
    ? getGmt3MonthBounds(Number(progress.year ?? new Date().getFullYear()), Number(progress.month ?? new Date().getMonth() + 1))
    : null;

  const latestLevelUpResult = currentPeriod
    ? await supabase
      .from("global_principessa_xp_events")
      .select("id, created_at, new_global_level, xp_amount")
      .eq("event_type", "level_up")
      .gte("created_at", currentPeriod.start.toISOString())
      .lt("created_at", currentPeriod.end.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    : { data: null, error: null };

  if (latestLevelUpResult.error) {
    console.error("Global Principessa level-up lookup failed", {
      code: latestLevelUpResult.error.code,
      message: latestLevelUpResult.error.message,
    });
  }

  return Response.json(
    {
      latestLevelUp: latestLevelUpResult.data ?? null,
      progress,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
}
