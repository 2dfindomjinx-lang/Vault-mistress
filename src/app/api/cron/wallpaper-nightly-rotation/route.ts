import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { sendWallpaperSyncPush } from "@/lib/wallpaper-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RotationResult = { status: string; version?: string };

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized cron request." }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured) {
    return Response.json({ error: "Supabase admin is not configured." }, { status: 500 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("rotate_wallpaper_if_no_manual_assignment");
    if (error) throw error;
    const result = data as RotationResult | null;
    if (!result || typeof result.status !== "string") {
      throw new Error("Wallpaper rotation returned no status.");
    }
    if (result.status === "assigned" && result.version) {
      await sendWallpaperSyncPush({ activationId: null, wallpaperVersion: result.version });
    }
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Nightly wallpaper rotation failed:", error);
    return Response.json({ error: "Nightly wallpaper rotation failed." }, { status: 500 });
  }
}
