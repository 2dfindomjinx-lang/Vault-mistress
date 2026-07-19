import { PRINCIPESSA_WALLPAPER_APP_KEY } from "@/lib/app-licenses";
import { requireMobileAdmin } from "@/lib/mobile-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const { data, error } = await admin.supabase
    .from("wallpaper_assignments")
    .select("wallpaper_url, created_at")
    .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
    .eq("scope", "global")
    .eq("active", true)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json({ image_url: "", updated_at: null }, { status: 404 });
  }

  return Response.json({
    image_url: data.wallpaper_url,
    updated_at: data.created_at,
  });
}
