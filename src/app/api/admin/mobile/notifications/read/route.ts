import { requireMobileAdmin } from "@/lib/mobile-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await requireMobileAdmin(request);

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];

  if (!ids.length || ids.length > 100) {
    return Response.json({ error: "Expected 1-100 notification ids" }, { status: 400 });
  }

  return Response.json({ ok: true });
}
