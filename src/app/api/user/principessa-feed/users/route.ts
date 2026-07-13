import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return Response.json({ error: "Supabase admin is not configured." }, { status: 500 });
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData } = await authSupabase.auth.getUser();
  if (!authData.user) return Response.json({ error: "Sign in to tag users." }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim().replace(/^@/, "") ?? "";
  if (query.length < 1 || query.length > 40 || !/^[a-zA-Z0-9_.-]+$/.test(query)) {
    return Response.json({ users: [] });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .or(`username.ilike.${query}%,username.ilike.@${query}%`)
    .order("username", { ascending: true })
    .limit(6);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    users: (data ?? []).map((profile) => ({
      displayName: profile.display_name?.trim() || profile.username,
      id: profile.id,
      username: String(profile.username).replace(/^@/, ""),
    })),
  });
}
