import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    const configErrors = getSupabaseAdminConfigErrors();
    console.error("Public shame board route is not configured", configErrors);
    return Response.json(
      { error: `Public shame board is not configured: ${configErrors.join(", ")}` },
      { status: 500 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("username, shame_count")
    .gt("shame_count", 0)
    .order("shame_count", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(3);

  if (error) {
    console.error("Failed to load public shame board", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    shame: (data ?? []).map((profile) => ({
      shameCount: Number(profile.shame_count ?? 0),
      username: profile.username,
    })),
  });
}
