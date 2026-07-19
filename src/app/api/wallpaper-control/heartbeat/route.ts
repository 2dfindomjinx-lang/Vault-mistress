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

export async function POST(request: Request) {
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

  const now = new Date().toISOString();
  const [{ error: activationError }, { error: registrationError }] = await Promise.all([
    supabase
      .from("app_activation_codes")
      .update({ last_validated_at: now })
      .eq("id", license.id),
    supabase
      .from("wallpaper_device_push_registrations")
      .update({ last_seen_at: now })
      .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
      .eq("activation_id", license.id)
      .eq("installation_id", payload.installationId)
      .is("revoked_at", null),
  ]);
  if (activationError) {
    return Response.json({ error: activationError.message }, { status: 500 });
  }
  if (registrationError) {
    return Response.json({ error: registrationError.message }, { status: 500 });
  }

  return Response.json(
    { ok: true, lastSeenAt: now },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
