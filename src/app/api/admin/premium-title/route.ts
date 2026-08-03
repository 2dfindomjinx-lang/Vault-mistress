import { requireAdminProfile } from "@/lib/admin-guard";

export async function GET() {
  const admin = await requireAdminProfile();
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });
  const { data, error } = await admin.supabase
    .from("premium_title_config")
    .select("current_name, current_description, current_price, current_expires_at, current_pool_id")
    .eq("id", true)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ config: data ?? null });
}
