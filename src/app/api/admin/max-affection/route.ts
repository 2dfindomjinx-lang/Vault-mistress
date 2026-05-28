import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

async function isAdminRequest() {
  const authSupabase = await createSupabaseServerClient();
  const { data } = await authSupabase.auth.getUser();

  if (!data.user) {
    return false;
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username, is_admin")
    .eq("id", data.user.id)
    .maybeSingle();

  if (error) {
    console.error("Admin max affection auth profile lookup failed", error);
    return false;
  }

  return (
    Boolean(profile?.is_admin) ||
    String(profile?.username ?? "").toLowerCase() === "@principessa2dfd"
  );
}

export async function POST() {
  const configErrors = getSupabaseAdminConfigErrors();

  if (!isSupabaseAdminConfigured) {
    console.error("Admin max affection route is not configured", configErrors);
    return Response.json(
      { error: `Admin environment is not configured: ${configErrors.join(", ")}` },
      { status: 500 },
    );
  }

  if (!(await isAdminRequest())) {
    return Response.json({ error: "Admin access required." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, affection, tribute_total, updated_at")
    .gte("affection", 100)
    .order("tribute_total", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Admin max affection list failed", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ users: data ?? [] });
}
