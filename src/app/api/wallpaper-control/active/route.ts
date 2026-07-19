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
    .select("id, status, bound_installation_id, owner_name, last_validated_at")
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
    .select("wallpaper_url, version, created_at")
    .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
    .eq("activation_id", license.id)
    .eq("active", true)
    .maybeSingle();
  if (deviceError) {
    return Response.json({ error: deviceError.message }, { status: 500 });
  }

  let assignment = deviceAssignment;
  let scope: "device" | "global" = "device";
  if (!assignment) {
    const { data: globalAssignment, error: globalError } = await supabase
      .from("wallpaper_assignments")
      .select("wallpaper_url, version, created_at")
      .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
      .eq("scope", "global")
      .eq("active", true)
      .maybeSingle();
    if (globalError) {
      return Response.json({ error: globalError.message }, { status: 500 });
    }
    assignment = globalAssignment;
    scope = "global";
  }

  const { data: deviceMessage, error: deviceMessageError } = await supabase
    .from("wallpaper_live_messages")
    .select("message, version, created_at")
    .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
    .eq("activation_id", license.id)
    .eq("active", true)
    .maybeSingle();
  if (deviceMessageError) {
    return Response.json({ error: deviceMessageError.message }, { status: 500 });
  }

  let liveMessage = deviceMessage;
  let liveMessageScope: "device" | "global" = "device";
  if (!liveMessage) {
    const { data: globalMessage, error: globalMessageError } = await supabase
      .from("wallpaper_live_messages")
      .select("message, version, created_at")
      .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
      .eq("scope", "global")
      .eq("active", true)
      .maybeSingle();
    if (globalMessageError) {
      return Response.json({ error: globalMessageError.message }, { status: 500 });
    }
    liveMessage = globalMessage;
    liveMessageScope = "global";
  }

  const lastValidatedAt = license.last_validated_at
    ? new Date(license.last_validated_at).getTime()
    : 0;
  if (!Number.isFinite(lastValidatedAt) || Date.now() - lastValidatedAt >= 5 * 60 * 1000) {
    await supabase
      .from("app_activation_codes")
      .update({ last_validated_at: new Date().toISOString() })
      .eq("id", license.id);
  }

  if (!assignment && !liveMessage) {
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  return Response.json(
    {
      wallpaperUrl: assignment?.wallpaper_url ?? null,
      version: assignment?.version ?? null,
      assignedAt: assignment?.created_at ?? null,
      scope: assignment ? scope : null,
      liveMessage: liveMessage?.message ?? null,
      liveMessageVersion: liveMessage?.version ?? null,
      liveMessageAt: liveMessage?.created_at ?? null,
      liveMessageScope: liveMessage ? liveMessageScope : null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
