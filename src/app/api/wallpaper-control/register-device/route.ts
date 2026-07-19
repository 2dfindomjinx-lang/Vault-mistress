import {
  PRINCIPESSA_WALLPAPER_APP_KEY,
  buildDeviceLabel,
  normalizeLicenseCode,
  verifySignedLicenseToken,
} from "@/lib/app-licenses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RegistrationBody = {
  firebaseInstallationId?: string;
  installationId?: string;
  deviceManufacturer?: string;
  deviceModel?: string;
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

  const body = (await request.json()) as RegistrationBody;
  const firebaseInstallationId = body.firebaseInstallationId?.trim() ?? "";
  if (firebaseInstallationId.length < 10 || firebaseInstallationId.length > 512) {
    return Response.json({ error: "Invalid Firebase installation id." }, { status: 400 });
  }
  if (body.installationId?.trim() !== payload.installationId) {
    return Response.json({ error: "Installation id does not match the activation." }, { status: 403 });
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
  const { error: revokeError } = await supabase
    .from("wallpaper_device_push_registrations")
    .update({ revoked_at: now })
    .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
    .eq("activation_id", license.id)
    .eq("installation_id", payload.installationId)
    .neq("firebase_installation_id", firebaseInstallationId)
    .is("revoked_at", null);
  if (revokeError) {
    return Response.json({ error: revokeError.message }, { status: 500 });
  }

  const { error } = await supabase.from("wallpaper_device_push_registrations").upsert(
    {
      app_key: PRINCIPESSA_WALLPAPER_APP_KEY,
      activation_id: license.id,
      installation_id: payload.installationId,
      firebase_installation_id: firebaseInstallationId,
      platform: "android",
      device_label: buildDeviceLabel(body.deviceManufacturer, body.deviceModel),
      last_seen_at: now,
      revoked_at: null,
    },
    { onConflict: "firebase_installation_id" },
  );
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
