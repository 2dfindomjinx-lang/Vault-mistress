import { PRINCIPESSA_WALLPAPER_APP_KEY } from "@/lib/app-licenses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Compatibility endpoint for old APKs. New APKs use the authenticated,
// device-aware /api/wallpaper-control/active endpoint.
export async function GET() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("wallpaper_assignments")
    .select("wallpaper_url, version, created_at")
    .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
    .eq("scope", "global")
    .eq("active", true)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json(
      { wallpaperUrl: null, version: "manual-none", updatedAt: null, nextUpdateAt: null },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    {
      wallpaperUrl: data.wallpaper_url,
      version: data.version,
      updatedAt: data.created_at,
      nextUpdateAt: null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
