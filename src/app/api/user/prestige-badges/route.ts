import { getPrestigeBadgeDefinition } from "@/lib/prestige";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) return Response.json({ error: "Supabase admin is not configured." }, { status: 500 });

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();
  if (authError || !authData.user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { badgeId?: string; equipped?: boolean } | null;
  const badgeId = String(body?.badgeId ?? "").trim();
  if (!badgeId || typeof body?.equipped !== "boolean" || !getPrestigeBadgeDefinition(badgeId)) {
    return Response.json({ error: "Invalid badge update." }, { status: 422 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_prestige_badges")
    .update({ equipped: body.equipped })
    .eq("user_id", authData.user.id)
    .eq("badge_id", badgeId)
    .select("badge_id, equipped")
    .maybeSingle();
  if (error || !data) return Response.json({ error: error?.message ?? "Badge not found." }, { status: error ? 500 : 404 });

  return Response.json({ badgeId: data.badge_id, equipped: data.equipped });
}
