import { requireAdminProfile } from "@/lib/admin-guard";

// The stored url is rendered into an <a href> for the user, so an unvalidated
// value here is an XSS sink (javascript:, data:). Only https is accepted.
function normalizeJigsawUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const admin = await requireAdminProfile();
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });

  const { data, error } = await admin.supabase
    .from("jigsaw_links")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ links: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (body?.action === "upsert") {
    const id = typeof body.id === "string" && body.id ? body.id : undefined;
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const url = normalizeJigsawUrl(body.url);
    const coinCost = Math.max(0, Math.floor(Number(body.coinCost)));
    const enabled = body.enabled !== false;

    if (!label) return Response.json({ error: "Label is required." }, { status: 400 });
    if (!url) return Response.json({ error: "URL must be a valid https:// link." }, { status: 400 });
    if (!Number.isFinite(coinCost)) return Response.json({ error: "Coin cost is required." }, { status: 400 });

    if (id) {
      const { error } = await admin.supabase
        .from("jigsaw_links")
        .update({ label, url, coin_cost: coinCost, enabled, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
    } else {
      const { data: maxRow } = await admin.supabase
        .from("jigsaw_links")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

      const { error } = await admin.supabase
        .from("jigsaw_links")
        .insert({ label, url, coin_cost: coinCost, enabled, sort_order: nextSortOrder });
      if (error) return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  }

  if (body?.action === "delete") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return Response.json({ error: "Missing link id." }, { status: 400 });
    const { error } = await admin.supabase.from("jigsaw_links").delete().eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  if (body?.action === "reorder") {
    const orderedIds = Array.isArray(body.orderedIds)
      ? body.orderedIds.filter((id): id is string => typeof id === "string")
      : [];
    if (orderedIds.length === 0) return Response.json({ error: "Missing ordered id list." }, { status: 400 });

    for (let index = 0; index < orderedIds.length; index += 1) {
      const { error } = await admin.supabase
        .from("jigsaw_links")
        .update({ sort_order: index, updated_at: new Date().toISOString() })
        .eq("id", orderedIds[index]);
      if (error) return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  }

  return Response.json({ error: "Invalid jigsaw link action." }, { status: 400 });
}
