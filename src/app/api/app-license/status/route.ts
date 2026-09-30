import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  PRINCIPESSA_DISCIPLINE_APP_KEY,
  createSignedLicenseToken,
  findAppLicense,
  normalizeLicenseCode,
  normalizeOwnerName,
  verifySignedLicenseToken,
} from "@/lib/app-licenses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StatusBody = { signedLicenseToken?: string };

export async function POST(request: Request) {
  let body: StatusBody;
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 8_192) {
      return Response.json({ error: "Request too large." }, { status: 413 });
    }
    body = (await request.json()) as StatusBody;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const token = body.signedLicenseToken?.trim() ?? "";
  if (!token || token.length > 4_096) {
    return Response.json({ error: "A valid license token is required." }, { status: 400 });
  }

  const payload = verifySignedLicenseToken(token);
  if (!payload || payload.appKey !== PRINCIPESSA_DISCIPLINE_APP_KEY) {
    return Response.json({ error: "License is invalid." }, { status: 403 });
  }

  try {
    const license = await findAppLicense(payload.appKey, normalizeLicenseCode(payload.activationCode));
    if (
      !license || license.status !== "active" ||
      license.bound_installation_id !== payload.installationId ||
      normalizeOwnerName(license.owner_name ?? "") !== normalizeOwnerName(payload.ownerName)
    ) {
      return Response.json({ error: "This activation is no longer valid." }, { status: 403 });
    }

    const now = Date.now();
    const supabase = createSupabaseAdminClient();
    const nowIso = new Date(now).toISOString();
    const { data: updated, error } = await supabase
      .from("app_activation_codes")
      .update({ last_validated_at: nowIso, updated_at: nowIso })
      .eq("id", license.id)
      .eq("app_key", payload.appKey)
      .eq("status", "active")
      .eq("bound_installation_id", payload.installationId)
      .eq("owner_name", normalizeOwnerName(payload.ownerName))
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!updated) return Response.json({ error: "This activation is no longer valid." }, { status: 403 });

    const validUntilMillis = now + 7 * 24 * 60 * 60 * 1000;
    const signedLicenseToken = createSignedLicenseToken({
      appKey: payload.appKey,
      activationCode: normalizeLicenseCode(payload.activationCode),
      installationId: payload.installationId,
      ownerName: normalizeOwnerName(payload.ownerName),
      issuedAtMillis: now,
      validUntilMillis,
    });
    return Response.json({ signedLicenseToken, validUntilMillis });
  } catch (error) {
    console.error("[app-license/status] validation failed", error);
    return Response.json({ error: "License verification is temporarily unavailable." }, { status: 503 });
  }
}
