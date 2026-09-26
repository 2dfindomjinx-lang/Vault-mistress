import { findAppLicense, PRINCIPESSA_TECHDOM_APP_KEY, verifySignedLicenseToken } from "@/lib/app-licenses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || token.length > 8192) return Response.json({ error: "Invalid license." }, { status: 401 });
  const payload = verifySignedLicenseToken(token);
  if (payload?.appKey !== PRINCIPESSA_TECHDOM_APP_KEY) {
    return Response.json({ error: "Invalid license." }, { status: 401 });
  }

  try {
    const license = await findAppLicense(PRINCIPESSA_TECHDOM_APP_KEY, payload.activationCode);
    const active = license?.status === "active" &&
      license.bound_installation_id === payload.installationId &&
      license.owner_name === payload.ownerName;
    return Response.json({ active }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "License status unavailable." }, { status: 503 });
  }
}
