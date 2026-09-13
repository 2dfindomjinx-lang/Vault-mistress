import type { SupabaseClient } from "@supabase/supabase-js";
import { PRINCIPESSA_WALLPAPER_APP_KEY } from "@/lib/app-licenses";

export async function streamWallpaperAsset(
  supabase: SupabaseClient,
  assignmentId: string,
): Promise<Response> {
  const { data: assignment, error } = await supabase
    .from("wallpaper_assignments")
    .select("wallpaper_url")
    .eq("id", assignmentId)
    .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!assignment?.wallpaper_url) {
    return Response.json({ error: "Wallpaper was not found." }, { status: 404 });
  }

  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!publicBaseUrl) {
    return Response.json({ error: "Wallpaper storage is not configured." }, { status: 500 });
  }

  let upstreamUrl: URL;
  let publicBase: URL;
  try {
    upstreamUrl = new URL(assignment.wallpaper_url);
    publicBase = new URL(publicBaseUrl);
  } catch {
    return Response.json({ error: "Stored wallpaper URL is invalid." }, { status: 500 });
  }

  // Same guard as the device route: never let a stored value turn this into an open proxy.
  if (upstreamUrl.protocol !== "https:" || upstreamUrl.origin !== publicBase.origin) {
    return Response.json({ error: "Stored wallpaper URL is outside the configured storage." }, { status: 500 });
  }

  const upstream = await fetch(upstreamUrl, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return Response.json(
      { error: `Wallpaper storage returned HTTP ${upstream.status}.` },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return Response.json({ error: "Wallpaper storage returned a non-image response." }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Assignments are immutable per id, so this is safe to keep in the client for a while.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
