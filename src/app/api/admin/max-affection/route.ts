import { getSupabaseAdminConfigErrors, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { requireAdminProfile } from "@/lib/admin-guard";

export async function POST() {
  const configErrors = getSupabaseAdminConfigErrors();

  if (!isSupabaseAdminConfigured) {
    console.error("Admin max affection route is not configured", configErrors);
    return Response.json(
      { error: `Admin environment is not configured: ${configErrors.join(", ")}` },
      { status: 500 },
    );
  }

  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const supabase = admin.supabase;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, affection, tribute_total, updated_at")
    .gte("affection", 100)
    .order("updated_at", { ascending: false })
    .order("tribute_total", { ascending: false });

  if (error) {
    console.error("Admin max affection list failed", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ users: data ?? [] });
}
