import { requireAdminProfile } from "@/lib/admin-guard";
export async function GET() {
  const admin = await requireAdminProfile();
  if ("error" in admin)
    return Response.json({ error: admin.error }, { status: admin.status });
  const [failures, receipts, milestones] = await Promise.all([
    admin.supabase
      .from("economy_failures")
      .select(
        "id,user_id,operation_key,reason,error_code,created_at,resolved_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    admin.supabase
      .from("economy_receipts")
      .select("operation_key", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 86400000).toISOString()),
    admin.supabase.rpc("get_product_milestone_counts"),
  ]);
  if (failures.error || receipts.error)
    return Response.json(
      {
        error:
          "Economy monitoring is unavailable. Check the required migration.",
      },
      { status: 503 },
    );
  return Response.json(
    {
      failures: failures.data,
      completedLast24h: receipts.count,
      milestones: milestones.error ? null : milestones.data,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if ("error" in admin)
    return Response.json({ error: admin.error }, { status: admin.status });
  const body = await request.json().catch(() => null);
  if (
    body?.action !== "reviewed" ||
    typeof body.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(body.id)
  )
    return Response.json({ error: "Invalid review." }, { status: 400 });
  const result = await admin.supabase
    .from("economy_failures")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", body.id)
    .is("resolved_at", null)
    .select("id")
    .maybeSingle();
  if (result.error)
    return Response.json(
      { error: "Review could not be saved." },
      { status: 503 },
    );
  return Response.json({ reviewed: true });
}
