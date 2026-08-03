import { requireAdminProfile } from "@/lib/admin-guard";

export async function GET() {
  const admin = await requireAdminProfile();
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });
  const { data, error } = await admin.supabase
    .from("premium_title_pool")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ pool: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (body?.action === "upsert") {
    const id = typeof body.id === "string" && body.id ? body.id : undefined;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const price = Math.max(0, Math.floor(Number(body.price)));
    const enabled = body.enabled !== false;
    const durationHours = Math.min(8760, Math.max(1, Math.floor(Number(body.durationHours)) || 720));

    if (!name || !description || !Number.isFinite(price)) {
      return Response.json({ error: "Name, description, and price are required." }, { status: 400 });
    }

    if (id) {
      const { error } = await admin.supabase
        .from("premium_title_pool")
        .update({ name, description, price, enabled, duration_hours: durationHours, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
    } else {
      const { data: maxRow } = await admin.supabase
        .from("premium_title_pool")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

      const { error } = await admin.supabase
        .from("premium_title_pool")
        .insert({ name, description, price, enabled, duration_hours: durationHours, sort_order: nextSortOrder });
      if (error) return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  }

  if (body?.action === "delete") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return Response.json({ error: "Missing pool entry id." }, { status: 400 });
    const { error } = await admin.supabase.from("premium_title_pool").delete().eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  if (body?.action === "reorder") {
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.filter((id): id is string => typeof id === "string") : [];
    if (orderedIds.length === 0) return Response.json({ error: "Missing ordered id list." }, { status: 400 });

    for (let index = 0; index < orderedIds.length; index += 1) {
      const { error } = await admin.supabase
        .from("premium_title_pool")
        .update({ sort_order: index, updated_at: new Date().toISOString() })
        .eq("id", orderedIds[index]);
      if (error) return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  }

  return Response.json({ error: "Invalid premium title pool action." }, { status: 400 });
}
