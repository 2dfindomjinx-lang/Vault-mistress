import { requireAdminProfile } from "@/lib/admin-guard";

export async function GET() {
  const admin = await requireAdminProfile();
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });
  const { data, error } = await admin.supabase.from("premium_title_config").select("*").eq("id", true).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ config: data ?? null });
}

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (body?.action !== "save") return Response.json({ error: "Invalid premium title action." }, { status: 400 });
  const currentName = typeof body.currentName === "string" ? body.currentName.trim() : "";
  const currentDescription = typeof body.currentDescription === "string" ? body.currentDescription.trim() : "";
  const currentPrice = Math.max(0, Math.floor(Number(body.currentPrice)));
  const currentExpiresAt = typeof body.currentExpiresAt === "string" ? new Date(body.currentExpiresAt).toISOString() : "";
  const nextName = typeof body.nextName === "string" ? body.nextName.trim() : "";
  const nextDescription = typeof body.nextDescription === "string" ? body.nextDescription.trim() : "";
  const nextPrice = Math.max(0, Math.floor(Number(body.nextPrice)));
  const nextStartsAt = typeof body.nextStartsAt === "string" && body.nextStartsAt ? new Date(body.nextStartsAt).toISOString() : null;
  if (!currentName || !currentDescription || !Number.isFinite(currentPrice) || !currentExpiresAt || Number.isNaN(new Date(currentExpiresAt).getTime())) {
    return Response.json({ error: "Current title name, description, price, and expiry are required." }, { status: 400 });
  }
  if (nextName && (!nextDescription || !Number.isFinite(nextPrice))) return Response.json({ error: "Complete the next title fields or leave them all blank." }, { status: 400 });
  const { error } = await admin.supabase.from("premium_title_config").upsert({
    id: true, current_name: currentName, current_description: currentDescription, current_price: currentPrice,
    current_expires_at: currentExpiresAt, next_name: nextName || null, next_description: nextDescription || null,
    next_price: nextName ? nextPrice : null, next_starts_at: nextName ? nextStartsAt : null, updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
