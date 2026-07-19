import { requireAdminProfile } from "@/lib/admin-guard";
import { PRINCIPESSA_WALLPAPER_APP_KEY } from "@/lib/app-licenses";
import { prepareWallpaperUpload } from "@/lib/r2-wallpapers";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  action?: "prepare-upload" | "assign";
  activationId?: string | null;
  contentType?: string;
  objectKey?: string;
  version?: string;
  wallpaperUrl?: string;
};

async function loadWallpaperAdminState(supabase: SupabaseClient) {
  const [{ data: devices, error: devicesError }, { data: assignments, error: assignmentsError }] = await Promise.all([
    supabase
      .from("app_activation_codes")
      .select(
        "id, activation_code, status, owner_name, bound_installation_id, bound_device_label, bound_at, last_validated_at",
      )
      .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
      .not("bound_installation_id", "is", null)
      .order("owner_name", { ascending: true }),
    supabase
      .from("wallpaper_assignments")
      .select("id, activation_id, scope, wallpaper_url, version, created_at")
      .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
      .eq("active", true)
      .order("created_at", { ascending: false }),
  ]);

  if (devicesError) throw devicesError;
  if (assignmentsError) throw assignmentsError;

  return { devices: devices ?? [], assignments: assignments ?? [] };
}

export async function GET() {
  const admin = await requireAdminProfile();
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    return Response.json(await loadWallpaperAdminState(admin.supabase));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Wallpaper admin state failed." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as Body;

  try {
    if (body.action === "prepare-upload") {
      return Response.json(await prepareWallpaperUpload(body.contentType?.trim() ?? ""));
    }

    if (body.action === "assign") {
      const activationId = body.activationId?.trim() || null;
      const objectKey = body.objectKey?.trim() ?? "";
      const wallpaperUrl = body.wallpaperUrl?.trim() ?? "";
      const version = body.version?.trim() ?? "";

      if (!objectKey || !wallpaperUrl || !version) {
        return Response.json({ error: "Missing uploaded wallpaper metadata." }, { status: 400 });
      }

      if (activationId) {
        const { data: target, error: targetError } = await admin.supabase
          .from("app_activation_codes")
          .select("id")
          .eq("id", activationId)
          .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
          .eq("status", "active")
          .not("bound_installation_id", "is", null)
          .maybeSingle();
        if (targetError) throw targetError;
        if (!target) {
          return Response.json({ error: "Wallpaper target device was not found." }, { status: 404 });
        }
      }

      const { error } = await admin.supabase.rpc("assign_wallpaper", {
        p_app_key: PRINCIPESSA_WALLPAPER_APP_KEY,
        p_activation_id: activationId,
        p_object_key: objectKey,
        p_wallpaper_url: wallpaperUrl,
        p_version: version,
        p_created_by: admin.adminUser.id,
      });
      if (error) throw error;

      return Response.json({
        ok: true,
        ...(await loadWallpaperAdminState(admin.supabase)),
      });
    }

    return Response.json({ error: "Invalid wallpaper action." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Wallpaper action failed." },
      { status: 500 },
    );
  }
}
