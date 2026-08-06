import { requireAdminProfile } from "@/lib/admin-guard";
import { streamWallpaperAsset } from "@/lib/wallpaper-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = await requireAdminProfile();
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const assignmentId = new URL(request.url).searchParams.get("assignmentId")?.trim();
  if (!assignmentId) {
    return Response.json({ error: "assignmentId is required." }, { status: 400 });
  }

  return streamWallpaperAsset(admin.supabase, assignmentId);
}
