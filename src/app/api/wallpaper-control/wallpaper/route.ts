import {
  PRINCIPESSA_WALLPAPER_APP_KEY,
  normalizeLicenseCode,
  verifySignedLicenseToken,
} from "@/lib/app-licenses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

export async function GET(request: Request) {
  const payload = verifySignedLicenseToken(bearerToken(request));
  if (!payload || payload.appKey !== PRINCIPESSA_WALLPAPER_APP_KEY) {
    return Response.json({ error: "Valid wallpaper activation is required." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: license, error: licenseError } = await supabase
    .from("app_activation_codes")
    .select("id, status, bound_installation_id, owner_name")
    .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
    .eq("activation_code", normalizeLicenseCode(payload.activationCode))
    .maybeSingle();

  if (licenseError) {
    return Response.json({ error: licenseError.message }, { status: 500 });
  }
  if (
    !license ||
    license.status !== "active" ||
    license.bound_installation_id !== payload.installationId ||
    license.owner_name !== payload.ownerName
  ) {
    return Response.json({ error: "Wallpaper activation is no longer valid." }, { status: 403 });
  }

  const { data: deviceAssignment, error: deviceError } = await supabase
    .from("wallpaper_assignments")
    .select("wallpaper_url")
    .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
    .eq("activation_id", license.id)
    .eq("active", true)
    .maybeSingle();
  if (deviceError) {
    return Response.json({ error: deviceError.message }, { status: 500 });
  }

  let wallpaperUrl = deviceAssignment?.wallpaper_url;
  if (!wallpaperUrl) {
    const { data: globalAssignment, error: globalError } = await supabase
      .from("wallpaper_assignments")
      .select("wallpaper_url")
      .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
      .eq("scope", "global")
      .eq("active", true)
      .maybeSingle();
    if (globalError) {
      return Response.json({ error: globalError.message }, { status: 500 });
    }
    wallpaperUrl = globalAssignment?.wallpaper_url;
  }

  if (!wallpaperUrl) {
    return Response.json({ error: "No wallpaper is currently assigned." }, { status: 404 });
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(wallpaperUrl);
  } catch {
    return Response.json({ error: "Stored wallpaper URL is invalid." }, { status: 500 });
  }
  if (upstreamUrl.protocol !== "https:") {
    return Response.json({ error: "Stored wallpaper URL must use HTTPS." }, { status: 500 });
  }
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!publicBaseUrl) {
    return Response.json({ error: "Wallpaper storage is not configured." }, { status: 500 });
  }
  let publicBase: URL;
  try {
    publicBase = new URL(publicBaseUrl);
  } catch {
    return Response.json({ error: "Wallpaper storage configuration is invalid." }, { status: 500 });
  }
  if (upstreamUrl.origin !== publicBase.origin) {
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
      "Cache-Control": "private, no-store",
    },
  });
}
