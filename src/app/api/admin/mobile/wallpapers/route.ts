import { requireMobileAdmin } from "@/lib/mobile-admin";
import {
  loadWallpaperAdminState,
  runWallpaperAdminAction,
  type WallpaperAdminBody,
} from "@/lib/wallpaper-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = await requireMobileAdmin(request);
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
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json().catch(() => ({}))) as WallpaperAdminBody;

  try {
    const result = await runWallpaperAdminAction(admin.supabase, admin.adminUser.id, body);

    if (result.kind === "error") {
      return Response.json({ error: result.error }, { status: result.status });
    }
    if (result.kind === "payload") {
      return Response.json(result.payload);
    }

    return Response.json({
      ok: true,
      ...(await loadWallpaperAdminState(admin.supabase)),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Wallpaper action failed." },
      { status: 500 },
    );
  }
}
