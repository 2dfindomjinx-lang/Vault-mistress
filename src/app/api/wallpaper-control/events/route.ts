import {
  PRINCIPESSA_WALLPAPER_APP_KEY,
  normalizeLicenseCode,
  verifySignedLicenseToken,
} from "@/lib/app-licenses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EventBody = {
  eventType?: string;
  changedScopes?: unknown;
  systemWallpaperId?: number | null;
  lockWallpaperId?: number | null;
};

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

export async function POST(request: Request) {
  const payload = verifySignedLicenseToken(bearerToken(request));
  if (!payload || payload.appKey !== PRINCIPESSA_WALLPAPER_APP_KEY) {
    return Response.json({ error: "Valid wallpaper activation is required." }, { status: 401 });
  }

  const body = (await request.json()) as EventBody;
  if (body.eventType !== "wallpaper_changed") {
    return Response.json({ error: "Unsupported wallpaper event." }, { status: 400 });
  }

  const acceptedScopes = new Set(["system", "lock", "unknown"]);
  const changedScopes = Array.isArray(body.changedScopes)
    ? [...new Set(body.changedScopes.filter(
        (value): value is string => typeof value === "string" && acceptedScopes.has(value),
      ))]
    : [];
  if (changedScopes.length === 0) {
    return Response.json({ error: "At least one changed wallpaper scope is required." }, { status: 400 });
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

  const { error } = await supabase.from("wallpaper_device_events").insert({
    app_key: PRINCIPESSA_WALLPAPER_APP_KEY,
    activation_id: license.id,
    event_type: "wallpaper_changed",
    changed_scopes: changedScopes,
    system_wallpaper_id:
      typeof body.systemWallpaperId === "number" && Number.isInteger(body.systemWallpaperId)
        ? body.systemWallpaperId
        : null,
    lock_wallpaper_id:
      typeof body.lockWallpaperId === "number" && Number.isInteger(body.lockWallpaperId)
        ? body.lockWallpaperId
        : null,
  });
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
