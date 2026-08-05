import { requireMobileAdmin } from "@/lib/mobile-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Confirms a companion-app bearer token really belongs to the Vault Mistress admin.
 *
 * This exists so a separate product (Principessa Lock) can trust a Vault Mistress session
 * without holding any Vault Mistress secrets: it forwards the token here and treats a 200 as
 * proof of admin identity. Returns no personal data beyond the admin's own id/username.
 */
export async function GET(request: Request) {
  const admin = await requireMobileAdmin(request);

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  return Response.json({
    ok: true,
    userId: admin.adminUser.id,
    username: admin.adminProfile.username,
  });
}
